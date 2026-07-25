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