// apps/api/test/integration/report.test.ts
//
// T20-T22 integration tests for the report routes.
//   GET /api/report/:id  — fetch one report (owner-gated: NOT_FOUND for both
//                          missing-id and other-user-id — see B2)
//   GET /api/report/     — list current user's 50 most recent reports
// Runs inside the Cloudflare Workers runtime via @cloudflare/vitest-pool-workers.
// D1 migrations are applied once per suite via test/setup-integration.ts.

import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../src/index';

async function setupUser(email = 'a@b.com') {
  const res = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'correct horse' }),
  }, env);
  const body = (await res.json()) as any;
  return { userId: body.userId, token: body.token, auth: { Authorization: `Bearer ${body.token}` } };
}

async function insertReport(id: string, userId: string, title: string, createdAt?: number) {
  await env.DB.prepare(
    `INSERT INTO reports (id, user_id, title, platforms, persona_count, content_hash, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, userId, title, '["xhs"]', 100, `hash-${id}`, 'done', createdAt ?? Math.floor(Date.now() / 1000))
    .run();
}

describe('report routes', () => {
  beforeEach(async () => {
    // H5: also clear rate_limits so a later test in this file does not
    // inherit a previous test's per-IP register/login budget.
    await env.DB.exec('DELETE FROM reports; DELETE FROM users; DELETE FROM rate_limits;');
  });

  it('GET /:id returns own report', async () => {
    const { userId, auth } = await setupUser();
    await insertReport('r1', userId, 'My Report');

    const res = await app.request('/api/report/r1', { headers: { ...auth } }, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.id).toBe('r1');
    expect(body.title).toBe('My Report');
    expect(body.status).toBe('done');
  });

  // B2: regression for the 403-vs-404 ownership leak. Returning 403 for
  // "exists but belongs to someone else" lets an attacker enumerate every
  // report id in the system — 404 means "no such row", 403 means "the
  // row exists". We collapse both into 404 NOT_FOUND so the two cases
  // are indistinguishable from the outside. The web UI already maps
  // 403+404 to the same not-found UX in apps/web/src/pages/Report.tsx.
  it('GET /:id returns 404 NOT_FOUND for another user\'s report (B2)', async () => {
    const { auth } = await setupUser('owner@b.com');
    const other = await setupUser('other@b.com');
    await insertReport('r2', other.userId, 'Other Report');

    const res = await app.request('/api/report/r2', { headers: { ...auth } }, env);
    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  it('GET /:id returns 404 NOT_FOUND for a nonexistent id (B2)', async () => {
    const { auth } = await setupUser('lonely@b.com');

    const res = await app.request('/api/report/does-not-exist', { headers: { ...auth } }, env);
    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  it('GET / returns user history list', async () => {
    const { userId, auth } = await setupUser();
    await insertReport('h1', userId, 'First', 1000);
    await insertReport('h2', userId, 'Second', 2000);

    const res = await app.request('/api/report', { headers: { ...auth } }, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.reports).toHaveLength(2);
    // ORDER BY created_at DESC — newest first
    expect(body.reports[0].id).toBe('h2');
    expect(body.reports[1].id).toBe('h1');
  });
});
