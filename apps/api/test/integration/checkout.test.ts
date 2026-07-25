// apps/api/test/integration/checkout.test.ts
//
// T05-T07 integration tests for /api/checkout/*
//   POST /api/checkout/create       (T05) — order + qr_code
//   GET  /api/checkout/status/:id   (T06) — poll + auto-close + 404 leak fix
//   POST /api/checkout/callback     (T07) — verify sig + idempotent + quota upgrade
//
// MOCKING STRATEGY (v0.14 T16 lessons): vitest-pool-workers does NOT support
// vi.mock — use globalThis.fetch stub to intercept WXPay calls instead.

import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';

const { default: app } = await import('../../src/index');

// Global fetch stub: intercept WXPay unifiedorder + query, return fake codes.
// (vitest-pool-workers has no vi.mock — see T16 in v0.14 ledger.)
const realFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = (async (url: any, init?: any) => {
    const u = typeof url === 'string' ? url : url.toString();
    if (u.includes('/v3/pay/transactions/native')) {
      return new Response(
        JSON.stringify({ code_url: 'weixin://wxpay/bizpayurl?pr=TEST' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (u.includes('/v3/pay/transactions/out-trade-no/')) {
      return new Response(
        JSON.stringify({ trade_state: 'NOTPAY', transaction_id: null }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return realFetch(url, init);
  }) as typeof fetch;
});

async function setupUser(email = 'a@b.com') {
  const res = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'correct horse' }),
  }, env);
  const body = (await res.json()) as any;
  return { userId: body.userId, token: body.token, auth: { Authorization: `Bearer ${body.token}` } };
}

describe('checkout POST /create', () => {
  beforeEach(async () => {
    await env.DB.exec('DELETE FROM orders; DELETE FROM reports; DELETE FROM users; DELETE FROM rate_limits;');
  });

  it('returns orderId + qrCodeBase64 for personal_sub', async () => {
    const { auth } = await setupUser('create@b.com');
    const res = await app.request('/api/checkout/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ plan: 'personal_sub' }),
    }, env);
    if (res.status !== 200) {
      const txt = await res.text();
      throw new Error(`Expected 200, got ${res.status}: ${txt}`);
    }
    const body = (await res.json()) as any;
    expect(body.orderId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.qrCodeBase64).toMatch(/^data:[^;]+;base64,/);
    expect(body.amountFen).toBe(2900);
    expect(body.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('returns 400 INVALID_PLAN for unknown plan', async () => {
    const { auth } = await setupUser('create2@b.com');
    const res = await app.request('/api/checkout/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ plan: 'evil_plan' }),
    }, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.code).toBe('INVALID_PLAN');
  });

  it('returns 401 AUTH_REQUIRED without bearer token', async () => {
    const res = await app.request('/api/checkout/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'personal_sub' }),
    }, env);
    expect(res.status).toBe(401);
  });
});

describe('checkout GET /status/:orderId', () => {
  beforeEach(async () => {
    await env.DB.exec('DELETE FROM orders; DELETE FROM reports; DELETE FROM users; DELETE FROM rate_limits;');
  });

  async function seedOrder(userId: string, opts: { status?: string; expiresAt?: number; paidAt?: number } = {}) {
    const orderId = crypto.randomUUID();
    await env.DB
      .prepare(
        `INSERT INTO orders (id, user_id, plan, amount_fen, status, created_at, expires_at, paid_at)
         VALUES (?, ?, 'personal_sub', 2900, ?, ?, ?, ?)`,
      )
      .bind(
        orderId,
        userId,
        opts.status ?? 'pending',
        Math.floor(Date.now() / 1000),
        opts.expiresAt ?? Math.floor(Date.now() / 1000) + 1800,
        opts.paidAt ?? null,
      )
      .run();
    return orderId;
  }

  it('returns pending status for own order', async () => {
    const { userId, auth } = await setupUser('status1@b.com');
    const orderId = await seedOrder(userId, { status: 'pending' });
    const res = await app.request(`/api/checkout/status/${orderId}`, {
      headers: { ...auth },
    }, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.status).toBe('pending');
    expect(body.paidAt).toBeNull();
  });

  it('returns 404 NOT_FOUND for another user order (B2 leak fix)', async () => {
    const { userId: ownerId } = await setupUser('owner@b.com');
    const { auth: otherAuth } = await setupUser('other@b.com');
    const orderId = await seedOrder(ownerId, { status: 'pending' });
    const res = await app.request(`/api/checkout/status/${orderId}`, {
      headers: { ...otherAuth },
    }, env);
    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  it('auto-closes expired pending orders', async () => {
    const { userId, auth } = await setupUser('expired@b.com');
    const orderId = await seedOrder(userId, {
      status: 'pending',
      expiresAt: Math.floor(Date.now() / 1000) - 60, // expired 1 min ago
    });
    const res = await app.request(`/api/checkout/status/${orderId}`, {
      headers: { ...auth },
    }, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.status).toBe('closed');
    const row = await env.DB.prepare('SELECT status FROM orders WHERE id = ?').bind(orderId).first<any>();
    expect(row.status).toBe('closed');
  });
});

describe('checkout POST /callback', () => {
  beforeEach(async () => {
    await env.DB.exec('DELETE FROM orders; DELETE FROM reports; DELETE FROM users; DELETE FROM rate_limits;');
  });

  // T07 mocks verifyCallbackSignature to true via wrangler.test.toml. The
  // actual signature verification happens inside wechat-pay.ts; for v0.15.0
  // we test the route's handling logic here.
  function callbackHeaders() {
    return {
      'Content-Type': 'application/json',
      'Wechatpay-Timestamp': '1700000000',
      'Wechatpay-Nonce': 'test-nonce',
      'Wechatpay-Signature': 'mock-valid-sig',
      'Wechatpay-Serial': 'TEST_SERIAL_0001',
    };
  }

  it('updates order to paid + upgrades quota on SUCCESS', async () => {
    const { userId } = await setupUser('cb-success@b.com');
    const orderId = crypto.randomUUID();
    await env.DB
      .prepare(
        `INSERT INTO orders (id, user_id, plan, amount_fen, status, created_at)
         VALUES (?, ?, 'personal_sub', 2900, 'pending', ?)`,
      )
      .bind(orderId, userId, Math.floor(Date.now() / 1000))
      .run();

    const res = await app.request(
      '/api/checkout/callback',
      {
        method: 'POST',
        headers: callbackHeaders(),
        body: JSON.stringify({
          out_trade_no: orderId,
          transaction_id: 'wx-tx-001',
          trade_state: 'SUCCESS',
        }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const order = await env.DB
      .prepare('SELECT status, wx_transaction_id, paid_at FROM orders WHERE id = ?')
      .bind(orderId)
      .first<any>();
    expect(order.status).toBe('paid');
    expect(order.wx_transaction_id).toBe('wx-tx-001');
    expect(order.paid_at).toBeGreaterThan(0);
    const user = await env.DB
      .prepare('SELECT quota_limit, plan FROM users WHERE id = ?')
      .bind(userId)
      .first<any>();
    expect(user.quota_limit).toBe(60); // 30 base + 30 sub
    expect(user.plan).toBe('personal_sub');
  });

  it('is idempotent on already-paid orders (no quota change)', async () => {
    const { userId } = await setupUser('cb-idem@b.com');
    const orderId = crypto.randomUUID();
    await env.DB
      .prepare(
        `INSERT INTO orders (id, user_id, plan, amount_fen, status, created_at, paid_at)
         VALUES (?, ?, 'personal_sub', 2900, 'paid', ?, ?)`,
      )
      .bind(orderId, userId, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000))
      .run();

    const res = await app.request(
      '/api/checkout/callback',
      {
        method: 'POST',
        headers: callbackHeaders(),
        body: JSON.stringify({
          out_trade_no: orderId,
          transaction_id: 'wx-tx-002',
          trade_state: 'SUCCESS',
        }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const user = await env.DB
      .prepare('SELECT quota_limit FROM users WHERE id = ?')
      .bind(userId)
      .first<any>();
    // Quota must NOT double-apply (replay)
    expect(user.quota_limit).toBe(30);
  });

  it('returns 404 ORDER_NOT_FOUND for unknown orderId', async () => {
    const res = await app.request(
      '/api/checkout/callback',
      {
        method: 'POST',
        headers: callbackHeaders(),
        body: JSON.stringify({
          out_trade_no: 'nonexistent-id',
          transaction_id: 'wx-tx-003',
          trade_state: 'SUCCESS',
        }),
      },
      env,
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.code).toBe('ORDER_NOT_FOUND');
  });
});