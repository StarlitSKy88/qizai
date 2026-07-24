import { Hono } from 'hono';
import { requireAuth, getUser } from '../middleware/auth';
import { getEnv } from '../utils/env';

export const reportRouter = new Hono();

reportRouter.get('/:id', requireAuth, async (c) => {
  const id = c.req.param('id');
  const user = getUser(c);
  const env = getEnv(c);
  if (!env.DB) return c.json({ code: 'DB_NOT_CONFIGURED' }, 500);

  const row = await env.DB.prepare(
    'SELECT id, user_id, title, report_json, evidence_pack, status, created_at, completed_at FROM reports WHERE id = ?'
  ).bind(id).first<any>();
  // B2: collapse "not found" and "owned by someone else" into the same 404.
  // Returning 403 for the wrong owner would let an attacker enumerate
  // existing report ids (404 = nonexistent, 403 = exists-but-mine). The
  // web UI already treats 403+404 as the same not-found UX (Report.tsx).
  if (!row || row.user_id !== user.sub) {
    return c.json({ code: 'NOT_FOUND' }, 404);
  }

  return c.json({
    id: row.id,
    title: row.title,
    status: row.status,
    report: row.report_json ? JSON.parse(row.report_json) : null,
    evidence: row.evidence_pack ? JSON.parse(row.evidence_pack) : null,
    created_at: row.created_at,
    completed_at: row.completed_at,
  });
});

reportRouter.get('/', requireAuth, async (c) => {
  const user = getUser(c);
  const env = getEnv(c);
  if (!env.DB) return c.json({ code: 'DB_NOT_CONFIGURED' }, 500);
  const { results } = await env.DB.prepare(
    'SELECT id, title, status, created_at, completed_at FROM reports WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).bind(user.sub).all<any>();
  return c.json({ reports: results });
});
