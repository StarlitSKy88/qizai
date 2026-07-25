// apps/api/src/utils/quota-upgrade.ts
//
// v0.15.0 — atomic quota upgrade when an order is paid.
//   personal_sub: +30 quota/month (renew_at = now + 30 days)
//   team_sub:     +300 quota/month (renew_at = now + 30 days)
//   topup_100:    +100 quota one-shot (renew_at stays NULL via COALESCE)
//
// COALESCE on renew_at: a topup after a subscription does NOT extend the
// renewal date; a subscription renewal DOES update it (cfg.renewMonths > 0).
//
// Concurrency: this UPDATE is atomic per row in D1. Multiple concurrent
// callbacks for the same order are safe — D1 serializes the write. Cross-row
// (different orders, same user) is also fine; each UPDATE is independent.

export type OrderPlan = 'personal_sub' | 'team_sub' | 'topup_100';

const PLAN_CONFIG: Record<OrderPlan, { add: number; renewMonths: number }> = {
  personal_sub: { add: 30, renewMonths: 1 },
  team_sub: { add: 300, renewMonths: 1 },
  topup_100: { add: 100, renewMonths: 0 },
};

export async function applyQuotaUpgrade(
  db: D1Database,
  userId: string,
  plan: OrderPlan,
): Promise<void> {
  const cfg = PLAN_CONFIG[plan];
  const renewAt =
    cfg.renewMonths > 0
      ? Math.floor(Date.now() / 1000) + cfg.renewMonths * 30 * 86400
      : null;
  await db
    .prepare(
      `UPDATE users
       SET quota_limit = quota_limit + ?,
           plan = ?,
           quota_limit_renew_at = COALESCE(?, quota_limit_renew_at)
       WHERE id = ?`,
    )
    .bind(cfg.add, plan, renewAt, userId)
    .run();
}