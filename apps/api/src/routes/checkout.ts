// apps/api/src/routes/checkout.ts
//
// v0.15.0 — WeChat Pay checkout endpoints.
//   POST /api/checkout/create      (requireAuth) — order + unifiedorderNative → qr_code
//   GET  /api/checkout/status/:id  (requireAuth) — poll status, auto-close expired
//   POST /api/checkout/callback    (no auth)     — WXPay server-to-server; verify sig
//
// SECURITY:
//   - create: requires auth; only plan whitelist accepted
//   - status: B2-style 404 for missing OR not-owned (no info leak)
//   - callback: signature verified, idempotent on paid status, body parsed post-verify

import { Hono } from 'hono';
import { requireAuth, getUser } from '../middleware/auth';
import { getEnv } from '../utils/env';
import { unifiedorderNative, verifyCallbackSignature } from '../utils/wechat-pay';
import { applyQuotaUpgrade, type OrderPlan } from '../utils/quota-upgrade';
import { rateLimitByIp } from '../middleware/rate-limit';

export const checkoutRouter = new Hono();

const PLAN_AMOUNTS: Record<string, number> = {
  personal_sub: 2900,
  team_sub: 29900,
  topup_100: 990,
};

const PLAN_DESCRIPTIONS: Record<string, string> = {
  personal_sub: 'qizai 个人版月度订阅',
  team_sub: 'qizai 团队版月度订阅',
  topup_100: 'qizai 100 次预测加量包',
};

checkoutRouter.post('/create', requireAuth, async (c) => {
  const user = getUser(c);
  const env = getEnv(c);
  if (!env.DB) return c.json({ code: 'DB_NOT_CONFIGURED' }, 500);

  const { plan } = (await c.req.json()) as { plan?: string };
  if (!plan || !(plan in PLAN_AMOUNTS)) {
    return c.json({ code: 'INVALID_PLAN' }, 400);
  }
  const amountFen = PLAN_AMOUNTS[plan];
  const orderId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 1800; // 30 min

  await env.DB
    .prepare(
      `INSERT INTO orders (id, user_id, plan, amount_fen, status, created_at, expires_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
    )
    .bind(orderId, user.sub, plan, amountFen, now, expiresAt)
    .run();

  try {
    const { code_url, qr_code_base64 } = await unifiedorderNative(
      env,
      orderId,
      amountFen,
      PLAN_DESCRIPTIONS[plan],
      JSON.stringify({ user_id: user.sub, plan }),
    );
    await env.DB
      .prepare('UPDATE orders SET wx_code_url = ?, wx_qr_code = ? WHERE id = ?')
      .bind(code_url, qr_code_base64, orderId)
      .run();
    return c.json({ orderId, qrCodeBase64: qr_code_base64, amountFen, expiresAt });
  } catch (err) {
    // Rollback order so user can retry cleanly. Log the underlying error
    // server-side but never echo it to the client — `String(err)` can
    // include cert paths, env names, or internal D1 queries depending on
    // the exception source, which is an info-leak vector.
    console.error('[checkout/create] WXPay unifiedorder failed', {
      orderId,
      userId: user.sub,
      err: err instanceof Error ? err.message : String(err),
    });
    try {
      await env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(orderId).run();
    } catch {
      // best-effort cleanup; the order will be picked up by the auto-close
      // sweep on the next /status check once expires_at passes
    }
    return c.json({ code: 'WXPAY_ERROR' }, 500);
  }
});

// T06 — poll order status. B2-style 404 (missing OR not-owned unified as 404
// to prevent id enumeration). Also auto-closes expired pending orders.
checkoutRouter.get('/status/:orderId', requireAuth, async (c) => {
  const user = getUser(c);
  const env = getEnv(c);
  if (!env.DB) return c.json({ code: 'DB_NOT_CONFIGURED' }, 500);
  const orderId = c.req.param('orderId');

  const row = await env.DB
    .prepare('SELECT id, user_id, status, paid_at, expires_at FROM orders WHERE id = ?')
    .bind(orderId)
    .first<{
      id: string;
      user_id: string;
      status: string;
      paid_at: number | null;
      expires_at: number | null;
    }>();

  if (!row || row.user_id !== user.sub) {
    return c.json({ code: 'NOT_FOUND' }, 404);
  }

  // Auto-close expired pending orders so the frontend can show "closed".
  if (row.status === 'pending' && row.expires_at && row.expires_at < Math.floor(Date.now() / 1000)) {
    await env.DB
      .prepare(`UPDATE orders SET status = 'closed' WHERE id = ? AND status = 'pending'`)
      .bind(orderId)
      .run();
    return c.json({ status: 'closed', paidAt: row.paid_at });
  }

  return c.json({ status: row.status, paidAt: row.paid_at });
});

// T07 — WeChat Pay server-to-server callback. No auth; verifies signature,
// idempotent on already-paid orders, triggers quota upgrade on first SUCCESS.
//
// Rate-limit: 30/min per IP. The legitimate caller is WXPay's own retry
// scheduler, which paces at ~1 req per few seconds on a small set of
// fixed IPs. A 30/min budget is well above that ceiling. The bucket
// defends against an attacker probing /api/checkout/callback with
// synthetic Wechatpay-* headers to drive D1 SELECTs (line 181 below) and
// pollute console.error/Logpush via the verify-stub throw path.
const wxpayCallbackRateLimit = rateLimitByIp('wxpay-callback', 30, 60);
checkoutRouter.post('/callback', wxpayCallbackRateLimit, async (c) => {
  const env = getEnv(c);
  if (!env.DB) return c.json({ code: 'DB_NOT_CONFIGURED' }, 500);

  const sig = c.req.header('Wechatpay-Signature');
  const ts = c.req.header('Wechatpay-Timestamp');
  const nonce = c.req.header('Wechatpay-Nonce');
  const serial = c.req.header('Wechatpay-Serial');
  const rawBody = await c.req.text();

  if (!sig || !ts || !nonce || !serial) {
    return c.json({ code: 'INVALID_SIGNATURE' }, 401);
  }
  // verifyCallbackSignature throws WXPAY_VERIFY_NOT_IMPLEMENTED on the prod
  // path (real RSA verifier is v0.15.1 work). Without this try/catch, every
  // prod callback would surface as an uncaught 500 via Hono's default error
  // handler — WXPay treats 5xx as retryable, so a misconfigured prod with
  // WXPAY_USE_SANDBOX=false would generate a retry storm with no actionable
  // log. We catch the sentinel here and return a controlled 'FAIL' 500 so
  // WXPay retries cleanly until v0.15.1 ships the real verifier; ops can
  // grep for WXPAY_VERIFY_NOT_IMPLEMENTED to confirm the gap is the
  // expected v0.15.0 stub rather than a real config issue.
  let ok: boolean;
  try {
    ok = await verifyCallbackSignature(ts, nonce, rawBody, sig, serial, env);
  } catch (verifyErr) {
    const message = verifyErr instanceof Error ? verifyErr.message : String(verifyErr);
    if (message === 'WXPAY_VERIFY_NOT_IMPLEMENTED') {
      console.error('[checkout/callback] verify stub not implemented (v0.15.0)', {
        certSerial: serial,
        timestamp: ts,
      });
      return c.text('FAIL', 500);
    }
    // Unexpected verification error (network blip, crypto failure). Same
    // 500 treatment — WXPay retries, we don't ack partial work. Log the
    // full stack so ops can trace the root cause; the message alone is
    // often too terse to debug.
    console.error('[checkout/callback] verifyCallbackSignature threw unexpectedly', {
      certSerial: serial,
      timestamp: ts,
      err: verifyErr instanceof Error ? verifyErr.message : String(verifyErr),
      stack: verifyErr instanceof Error ? verifyErr.stack : undefined,
    });
    return c.text('FAIL', 500);
  }
  if (!ok) return c.json({ code: 'INVALID_SIGNATURE' }, 401);

  let payload: { out_trade_no?: string; transaction_id?: string; trade_state?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.json({ code: 'DECRYPT_FAILED' }, 400);
  }
  if (!payload.out_trade_no || payload.trade_state !== 'SUCCESS') {
    // Ack non-SUCCESS events so WXPay stops retrying
    return c.text('SUCCESS', 200);
  }

  const row = await env.DB
    .prepare('SELECT id, user_id, plan, status FROM orders WHERE id = ?')
    .bind(payload.out_trade_no)
    .first<{ id: string; user_id: string; plan: string; status: string }>();
  if (!row) return c.json({ code: 'ORDER_NOT_FOUND' }, 404);
  // Idempotent: already paid → ack, no quota change
  if (row.status === 'paid') return c.text('SUCCESS', 200);

  // CAS: only flip pending → paid. Concurrent WXPay retries for the same
  // out_trade_no will see meta.changes === 0 for all but the first writer;
  // subsequent writers ack 200 without re-running applyQuotaUpgrade. This
  // mirrors the auto-close pattern on line 101 and is the canonical fix for
  // the "double quota apply" race surfaced by the v0.15.0 security review.
  const res = await env.DB
    .prepare(
      `UPDATE orders
         SET status = 'paid', wx_transaction_id = ?, paid_at = ?
       WHERE id = ? AND status = 'pending'`,
    )
    .bind(payload.transaction_id ?? null, Math.floor(Date.now() / 1000), row.id)
    .run();
  if (res.meta?.changes !== 1) {
    // Lost the race — another callback already paid this order. Ack and bail.
    return c.text('SUCCESS', 200);
  }

  // CAS committed the paid state. Now run the quota grant — but if it
  // throws (D1 transient, network blip, exception in applyQuotaUpgrade),
  // we must NOT leave the user paid-without-quota. Roll status back to
  // 'pending' so the next WXPay retry can re-issue the grant.
  //
  // The rollback UPDATE has its own CAS (status='paid') and we check
  // meta.changes: if the rollback itself misses (someone else flipped the
  // row, or D1 is unhappy) we ack non-200 so WXPay retries — better than
  // silently stranding a paid order with no quota. Rollback success → ack
  // 200 (we've restored the original pending state, WXPay should retry the
  // callback and we'll re-enter the CAS path on the next attempt).
  try {
    await applyQuotaUpgrade(env.DB, row.user_id, row.plan as OrderPlan, row.id);
  } catch (quotaErr) {
    console.error('[checkout/callback] quota upgrade failed, rolling back', {
      orderId: row.id,
      userId: row.user_id,
      plan: row.plan,
      err: quotaErr instanceof Error ? quotaErr.message : String(quotaErr),
    });
    let rolledBack = false;
    try {
      // CAS rollback flips status AND clears wx_transaction_id + paid_at
      // AND quota_granted_at so the next WXPay retry has a clean slate.
      // CRITICAL (round-5 review): quota_granted_at MUST also be reset.
      // If applyQuotaUpgrade's order CAS succeeded (quota_granted_at set)
      // but the users UPDATE threw (D1 transient, network blip), the
      // rollback flips status back to 'pending' — but if quota_granted_at
      // stayed set, the next WXPay retry would see
      // `quota_granted_at IS NOT NULL` in applyQuotaUpgrade's CAS and
      // throw QuotaUpgradeError. The user would then be stuck:
      // order is back to 'pending' but quota grant can never re-fire,
      // silently stranding a paid customer with no quota. Preserving
      // tx_id/paid_at on rollback would similarly overwrite the next
      // attempt's tx_id and lose the audit trail.
      const rb = await env.DB
        .prepare(
          `UPDATE orders
             SET status = 'pending',
                 wx_transaction_id = NULL,
                 paid_at = NULL,
                 quota_granted_at = NULL
           WHERE id = ? AND status = 'paid'`,
        )
        .bind(row.id)
        .run();
      rolledBack = rb.meta?.changes === 1;
    } catch (rbErr) {
      console.error('[checkout/callback] rollback UPDATE itself failed', {
        orderId: row.id,
        err: rbErr instanceof Error ? rbErr.message : String(rbErr),
      });
    }
    if (!rolledBack) {
      // Could not safely restore pending state — force WXPay to retry by
      // returning non-200. The order is in an unknown state; ops should
      // grep for the console.error above to reconcile.
      return c.text('FAIL', 500);
    }
    return c.text('SUCCESS', 200);
  }
  return c.text('SUCCESS', 200);
});