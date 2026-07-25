// apps/api/src/routes/users.ts
//
// v0.15.0 — GET /api/users/me
// Returns the current user's profile including quota + plan so the
// web QuotaBadge + Predict banner can render without a separate auth call.

import { Hono } from 'hono';
import { requireAuth, getUser } from '../middleware/auth';
import { getEnv } from '../utils/env';

export const usersRouter = new Hono();

usersRouter.get('/me', requireAuth, async (c) => {
  const user = getUser(c);
  const env = getEnv(c);
  if (!env.DB) return c.json({ code: 'DB_NOT_CONFIGURED' }, 500);
  const row = await env.DB
    .prepare(
      'SELECT id, email, plan, quota_used, quota_limit, quota_limit_renew_at FROM users WHERE id = ?',
    )
    .bind(user.sub)
    .first<{
      id: string;
      email: string;
      plan: string;
      quota_used: number;
      quota_limit: number;
      quota_limit_renew_at: number | null;
    }>();
  if (!row) return c.json({ code: 'NOT_FOUND' }, 404);
  return c.json({
    userId: row.id,
    email: row.email,
    plan: row.plan,
    quota_used: row.quota_used,
    quota_limit: row.quota_limit,
    quota_limit_renew_at: row.quota_limit_renew_at,
  });
});