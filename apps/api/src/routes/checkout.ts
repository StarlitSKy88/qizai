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