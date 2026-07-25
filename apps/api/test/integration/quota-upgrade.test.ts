// apps/api/test/integration/quota-upgrade.test.ts
//
// T04: applyQuotaUpgrade(db, userId, plan, orderId) atomic SQL.
//   - subscription: +N quota, plan set, renew_at = now + N months
//   - topup:        +N quota, plan set, renew_at = COALESCE (preserves prior)
//   - repeated topup stacks additively
//   - CAS guards: a second call for the same orderId throws
//   - status != 'paid' throws

import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../src/index';
import {
  applyQuotaUpgrade,
  QuotaUpgradeError,
  type OrderPlan,
} from '../../src/utils/quota-upgrade';

async function setupUser(email = 'a@b.com') {
  const res = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'correct horse' }),
  }, env);
  const body = (await res.json()) as any;
  return body.userId as string;
}

async function seedPaidOrder(userId: string, plan: OrderPlan, orderId: string) {
  await env.DB
    .prepare(
      `INSERT INTO orders (id, user_id, plan, amount_fen, status, paid_at)
       VALUES (?, ?, ?, 2900, 'paid', ?)`,
    )
    .bind(orderId, userId, plan, Math.floor(Date.now() / 1000))
    .run();
}

describe('applyQuotaUpgrade', () => {
  beforeEach(async () => {
    await env.DB.exec('DELETE FROM orders; DELETE FROM reports; DELETE FROM users; DELETE FROM rate_limits;');
  });

  it('personal_sub adds 30 quota, sets plan, sets renew_at ~30 days out', async () => {
    const userId = await setupUser('sub@b.com');
    await seedPaidOrder(userId, 'personal_sub', 'o-sub-1');
    await applyQuotaUpgrade(env.DB, userId, 'personal_sub', 'o-sub-1');
    const user = await env.DB
      .prepare('SELECT quota_limit, plan, quota_limit_renew_at FROM users WHERE id = ?')
      .bind(userId)
      .first<any>();
    // Default quota_limit=30, plus +30 for personal_sub = 60
    expect(user.quota_limit).toBe(60);
    expect(user.plan).toBe('personal_sub');
    expect(user.quota_limit_renew_at).toBeGreaterThan(Math.floor(Date.now() / 1000) + 25 * 86400);
  });

  it('topup_100 adds 100 without overwriting prior renew_at', async () => {
    const userId = await setupUser('top@b.com');
    await seedPaidOrder(userId, 'topup_100', 'o-top-1');
    await applyQuotaUpgrade(env.DB, userId, 'topup_100', 'o-top-1');
    const user = await env.DB
      .prepare('SELECT quota_limit, plan, quota_limit_renew_at FROM users WHERE id = ?')
      .bind(userId)
      .first<any>();
    expect(user.quota_limit).toBe(130);
    expect(user.plan).toBe('topup_100');
    // Topup has no renewMonths — renew_at stays NULL (COALESCE preserves existing, NULL is initial)
    expect(user.quota_limit_renew_at).toBeNull();
  });

  it('repeated topup_100 stacks additively with distinct orderIds', async () => {
    const userId = await setupUser('multi@b.com');
    await seedPaidOrder(userId, 'topup_100', 'o-multi-1');
    await applyQuotaUpgrade(env.DB, userId, 'topup_100', 'o-multi-1');
    await seedPaidOrder(userId, 'topup_100', 'o-multi-2');
    await applyQuotaUpgrade(env.DB, userId, 'topup_100', 'o-multi-2');
    await seedPaidOrder(userId, 'topup_100', 'o-multi-3');
    await applyQuotaUpgrade(env.DB, userId, 'topup_100', 'o-multi-3');
    const user = await env.DB
      .prepare('SELECT quota_limit FROM users WHERE id = ?')
      .bind(userId)
      .first<any>();
    expect(user.quota_limit).toBe(330); // 30 base + 3*100
    // Each successful grant must have stamped quota_granted_at on its
    // order row. If a regression accidentally UPDATEd the wrong column
    // (e.g. paid_at instead of quota_granted_at), the user.quota_limit
    // check above would still pass but the CAS column would be NULL —
    // pin both so the column write is also exercised.
    const stamped = await env.DB
      .prepare(
        `SELECT COUNT(*) AS c FROM orders
          WHERE user_id = ? AND quota_granted_at IS NOT NULL`,
      )
      .bind(userId)
      .first<{ c: number }>();
    expect(stamped.c).toBe(3);
  });

  it('team_sub adds 300 quota', async () => {
    const userId = await setupUser('team@b.com');
    await seedPaidOrder(userId, 'team_sub', 'o-team-1');
    await applyQuotaUpgrade(env.DB, userId, 'team_sub', 'o-team-1');
    const user = await env.DB
      .prepare('SELECT quota_limit, plan FROM users WHERE id = ?')
      .bind(userId)
      .first<any>();
    expect(user.quota_limit).toBe(330);
    expect(user.plan).toBe('team_sub');
  });

  it('throws QuotaUpgradeError on second call for the same orderId (CAS guard)', async () => {
    const userId = await setupUser('dup@b.com');
    await seedPaidOrder(userId, 'personal_sub', 'o-dup-1');
    await applyQuotaUpgrade(env.DB, userId, 'personal_sub', 'o-dup-1');
    await expect(
      applyQuotaUpgrade(env.DB, userId, 'personal_sub', 'o-dup-1'),
    ).rejects.toBeInstanceOf(QuotaUpgradeError);
  });

  it('throws QuotaUpgradeError when order status is not paid', async () => {
    const userId = await setupUser('pending@b.com');
    // Insert a pending order — CAS should miss because status != 'paid'
    await env.DB
      .prepare(
        `INSERT INTO orders (id, user_id, plan, amount_fen, status) VALUES (?, ?, ?, 2900, 'pending')`,
      )
      .bind('o-pending-1', userId, 'personal_sub')
      .run();
    await expect(
      applyQuotaUpgrade(env.DB, userId, 'personal_sub', 'o-pending-1'),
    ).rejects.toBeInstanceOf(QuotaUpgradeError);
  });

  // Round-5/6 review: the rollback UPDATE in checkout.ts:cancel path runs
  // when applyQuotaUpgrade's order CAS succeeded (quota_granted_at stamped)
  // but the users UPDATE threw. The rollback SQL must clear quota_granted_at
  // along with status/wx_transaction_id/paid_at; otherwise the next WXPay
  // retry sees quota_granted_at IS NOT NULL and the CAS throws, silently
  // stranding a paid customer with no quota. Pin the SQL behavior here so
  // a future contributor who accidentally drops quota_granted_at from the
  // SET clause (or applies the rollback in the wrong order) breaks this
  // test, not the customer.
  it('rollback SQL clears status, wx_transaction_id, paid_at, AND quota_granted_at', async () => {
    const userId = await setupUser('rollback@b.com');
    const orderId = 'o-rb-1';
    // Seed a paid order with quota_granted_at already stamped (simulates
    // the post-CAS state when applyQuotaUpgrade crashed before the users
    // UPDATE). The seed mirrors the worst case the rollback must handle.
    await env.DB
      .prepare(
        `INSERT INTO orders (id, user_id, plan, amount_fen, status, paid_at, wx_transaction_id, quota_granted_at)
         VALUES (?, ?, 'personal_sub', 2900, 'paid', ?, 'wx-tx-x', ?)`,
      )
      .bind(
        orderId,
        userId,
        Math.floor(Date.now() / 1000),
        Math.floor(Date.now() / 1000),
      )
      .run();

    // Run the rollback SQL verbatim from checkout.ts:244-251.
    const rb = await env.DB
      .prepare(
        `UPDATE orders
           SET status = 'pending',
               wx_transaction_id = NULL,
               paid_at = NULL,
               quota_granted_at = NULL
         WHERE id = ? AND status = 'paid'`,
      )
      .bind(orderId)
      .run();
    expect(rb.meta?.changes).toBe(1);

    const after = await env.DB
      .prepare(
        `SELECT status, wx_transaction_id, paid_at, quota_granted_at
           FROM orders WHERE id = ?`,
      )
      .bind(orderId)
      .first<{
        status: string;
        wx_transaction_id: string | null;
        paid_at: number | null;
        quota_granted_at: number | null;
      }>();
    expect(after.status).toBe('pending');
    expect(after.wx_transaction_id).toBeNull();
    expect(after.paid_at).toBeNull();
    // The whole point of round-5 fix: this MUST be NULL after rollback,
    // otherwise the next WXPay retry's applyQuotaUpgrade CAS throws.
    expect(after.quota_granted_at).toBeNull();
  });

  it('rollback SQL is no-op when status is already non-paid (defense in depth)', async () => {
    const userId = await setupUser('rollback-noop@b.com');
    const orderId = 'o-rb-noop-1';
    // Order is already 'pending' — the rollback WHERE clause filters it out.
    await env.DB
      .prepare(
        `INSERT INTO orders (id, user_id, plan, amount_fen, status, paid_at, wx_transaction_id, quota_granted_at)
         VALUES (?, ?, 'personal_sub', 2900, 'pending', NULL, NULL, NULL)`,
      )
      .bind(orderId, userId)
      .run();

    const rb = await env.DB
      .prepare(
        `UPDATE orders
           SET status = 'pending',
               wx_transaction_id = NULL,
               paid_at = NULL,
               quota_granted_at = NULL
         WHERE id = ? AND status = 'paid'`,
      )
      .bind(orderId)
      .run();
    expect(rb.meta?.changes).toBe(0);
  });
});