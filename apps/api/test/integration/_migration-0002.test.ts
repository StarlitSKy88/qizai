// apps/api/test/integration/_migration-0002.test.ts
//
// T01: 0002_orders_and_user_plan.sql migration schema verification.
// Runs inside Cloudflare Workers runtime; migrations auto-applied via
// vitest-pool-workers' TEST_MIGRATIONS binding before each suite.

import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';

describe('0002 migration schema', () => {
  beforeEach(async () => {
    await env.DB.exec('DELETE FROM orders; DELETE FROM users;');
  });

  it('creates orders table with all columns', async () => {
    const cols = await env.DB.prepare('PRAGMA table_info(orders)').all();
    const names = cols.results.map((r: any) => r.name);
    expect(names).toContain('id');
    expect(names).toContain('user_id');
    expect(names).toContain('plan');
    expect(names).toContain('amount_fen');
    expect(names).toContain('status');
    expect(names).toContain('wx_code_url');
    expect(names).toContain('wx_qr_code');
    expect(names).toContain('wx_transaction_id');
    expect(names).toContain('created_at');
    expect(names).toContain('paid_at');
    expect(names).toContain('expires_at');
    // quota_granted_at is the CAS column consumed by applyQuotaUpgrade.
    // If a future migration-edit drops it, the unit test would still pass
    // but prod callbacks would silently break at runtime. Pin the column
    // here so a regression breaks the test, not the customer.
    expect(names).toContain('quota_granted_at');
  });

  it('adds plan + quota_limit_renew_at columns to users', async () => {
    const cols = await env.DB.prepare('PRAGMA table_info(users)').all();
    const names = cols.results.map((r: any) => r.name);
    expect(names).toContain('plan');
    expect(names).toContain('quota_limit_renew_at');
  });

  it('creates idx_orders_user_id and idx_orders_status', async () => {
    const idx = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='orders'",
    ).all();
    const names = idx.results.map((r: any) => r.name);
    expect(names).toContain('idx_orders_user_id');
    expect(names).toContain('idx_orders_status');
  });
});