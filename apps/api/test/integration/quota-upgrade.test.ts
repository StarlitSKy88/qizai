// apps/api/test/integration/quota-upgrade.test.ts
//
// T04: applyQuotaUpgrade(db, userId, plan) atomic SQL.
//   - subscription: +N quota, plan set, renew_at = now + N months
//   - topup:        +N quota, plan set, renew_at = COALESCE (preserves prior)
//   - repeated topup stacks additively

import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../src/index';
import { applyQuotaUpgrade, type OrderPlan } from '../../src/utils/quota-upgrade';

async function setupUser(email = 'a@b.com') {
  const res = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'correct horse' }),
  }, env);
  const body = (await res.json()) as any;
  return body.userId as string;
}

describe('applyQuotaUpgrade', () => {
  beforeEach(async () => {
    await env.DB.exec('DELETE FROM orders; DELETE FROM reports; DELETE FROM users; DELETE FROM rate_limits;');
  });

  it('personal_sub adds 30 quota, sets plan, sets renew_at ~30 days out', async () => {
    const userId = await setupUser('sub@b.com');
    await applyQuotaUpgrade(env.DB, userId, 'personal_sub');
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
    await applyQuotaUpgrade(env.DB, userId, 'topup_100');
    const user = await env.DB
      .prepare('SELECT quota_limit, plan, quota_limit_renew_at FROM users WHERE id = ?')
      .bind(userId)
      .first<any>();
    expect(user.quota_limit).toBe(130);
    expect(user.plan).toBe('topup_100');
    // Topup has no renewMonths — renew_at stays NULL (COALESCE preserves existing, NULL is initial)
    expect(user.quota_limit_renew_at).toBeNull();
  });

  it('repeated topup_100 stacks additively', async () => {
    const userId = await setupUser('multi@b.com');
    await applyQuotaUpgrade(env.DB, userId, 'topup_100');
    await applyQuotaUpgrade(env.DB, userId, 'topup_100');
    await applyQuotaUpgrade(env.DB, userId, 'topup_100');
    const user = await env.DB
      .prepare('SELECT quota_limit FROM users WHERE id = ?')
      .bind(userId)
      .first<any>();
    expect(user.quota_limit).toBe(330); // 30 base + 3*100
  });

  it('team_sub adds 300 quota', async () => {
    const userId = await setupUser('team@b.com');
    await applyQuotaUpgrade(env.DB, userId, 'team_sub');
    const user = await env.DB
      .prepare('SELECT quota_limit, plan FROM users WHERE id = ?')
      .bind(userId)
      .first<any>();
    expect(user.quota_limit).toBe(330);
    expect(user.plan).toBe('team_sub');
  });
});