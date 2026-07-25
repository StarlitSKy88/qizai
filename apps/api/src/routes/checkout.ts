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
    // Rollback order so user can retry cleanly
    await env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(orderId).run();
    return c.json({ code: 'WXPAY_ERROR', message: String(err) }, 500);
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
checkoutRouter.post('/callback', async (c) => {
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
  const ok = await verifyCallbackSignature(ts, nonce, rawBody, sig, serial);
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

  await env.DB
    .prepare(
      `UPDATE orders SET status = 'paid', wx_transaction_id = ?, paid_at = ? WHERE id = ?`,
    )
    .bind(payload.transaction_id ?? null, Math.floor(Date.now() / 1000), row.id)
    .run();

  await applyQuotaUpgrade(env.DB, row.user_id, row.plan as OrderPlan);
  return c.text('SUCCESS', 200);
});