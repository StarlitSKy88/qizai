// apps/web/test/api/billing.test.ts
//
// T10: web/api/billing.ts client functions.
// Uses vi.mock('client') to stub apiFetch — Node vitest works fine with mocks.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockApiFetch } = vi.hoisted(() => ({ mockApiFetch: vi.fn() }));

vi.mock('../../src/api/client', () => ({
  apiFetch: mockApiFetch,
}));

import { createCheckout, pollOrderStatus, getMe } from '../../src/api/billing';

describe('billing client', () => {
  beforeEach(() => mockApiFetch.mockReset());

  it('createCheckout POSTs to /api/checkout/create', async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ orderId: 'o-1', qrCodeBase64: 'data:x', amountFen: 2900, expiresAt: 9999 }),
    });
    const r = await createCheckout('personal_sub');
    expect(mockApiFetch).toHaveBeenCalledWith('/api/checkout/create', expect.objectContaining({ method: 'POST' }));
    expect(r.orderId).toBe('o-1');
  });

  it('createCheckout throws on non-ok', async () => {
    mockApiFetch.mockResolvedValue({ ok: false, status: 402 });
    await expect(createCheckout('personal_sub')).rejects.toThrow(/402/);
  });

  it('pollOrderStatus GETs /api/checkout/status/:orderId', async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'paid', paidAt: 1234 }),
    });
    const r = await pollOrderStatus('o-1');
    expect(mockApiFetch).toHaveBeenCalledWith('/api/checkout/status/o-1');
    expect(r.status).toBe('paid');
  });

  it('getMe GETs /api/users/me', async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ userId: 'u-1', email: 'a@b.com', plan: 'free', quota_used: 0, quota_limit: 30, quota_limit_renew_at: null }),
    });
    const r = await getMe();
    expect(mockApiFetch).toHaveBeenCalledWith('/api/users/me');
    expect(r.plan).toBe('free');
  });
});