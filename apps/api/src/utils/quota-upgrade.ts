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
//
// v0.15.0 hotfix (round-4 review): the orderId CAS lives HERE, not in the
// caller. This guarantees double-grant safety even if a future caller
// (admin refund webhook, upsell flow) forgets to check order state. The
// function throws on CAS miss so the caller's try/catch can roll back.

export type OrderPlan = 'personal_sub' | 'team_sub' | 'topup_100';

const PLAN_CONFIG: Record<OrderPlan, { add: number; renewMonths: number }> = {
  personal_sub: { add: 30, renewMonths: 1 },
  team_sub: { add: 300, renewMonths: 1 },
  topup_100: { add: 100, renewMonths: 0 },
};

export class QuotaUpgradeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaUpgradeError';
  }
}

export async function applyQuotaUpgrade(
  db: D1Database,
  userId: string,
  plan: OrderPlan,
  orderId: string,
): Promise<void> {
  const cfg = PLAN_CONFIG[plan];
  const renewAt =
    cfg.renewMonths > 0
      ? Math.floor(Date.now() / 1000) + cfg.renewMonths * 30 * 86400
      : null;
  // Order-level CAS: only grant quota if the order is still in 'paid' state
  // for THIS user. If another writer already granted (status='paid' was
  // flipped to a terminal state, or user_id doesn't match), we abort.
  const cas = await db
    .prepare(
      `UPDATE orders
         SET quota_granted_at = ?
       WHERE id = ? AND user_id = ? AND status = 'paid' AND quota_granted_at IS NULL`,
    )
    .bind(Math.floor(Date.now() / 1000), orderId, userId)
    .run();
  if (cas.meta?.changes !== 1) {
    throw new QuotaUpgradeError(
      `quota CAS miss for order ${orderId} (user=${userId}, plan=${plan}) — already granted or order not in 'paid' state`,
    );
  }
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