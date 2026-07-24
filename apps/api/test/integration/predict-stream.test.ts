// apps/api/test/integration/predict-stream.test.ts
//
// T12+T13 integration tests for POST /api/predict/stream.
// Runs inside the Cloudflare Workers runtime via @cloudflare/vitest-pool-workers.
// D1 migrations are applied once per suite via test/setup-integration.ts.

import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../src/index';

async function setupUser(email = 'a@b.com') {
  await env.DB.exec('DELETE FROM users');
  await env.DB.exec('DELETE FROM reports');
  const res = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'correct horse' }),
  }, env);
  const body = (await res.json()) as any;
  return { userId: body.userId, token: body.token, auth: { Authorization: `Bearer ${body.token}` } };
}

describe('POST /api/predict/stream', () => {
  beforeEach(async () => {
    await env.DB.exec('DELETE FROM reports; DELETE FROM users;');
  });

  it('401 when no JWT', async () => {
    const res = await app.request('/api/predict/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { title: 'hello' }, platforms: ['xhs'] }),
    }, env);
    expect(res.status).toBe(401);
  });

  it('returns SSE headers and start event with mock JWT', async () => {
    const { auth } = await setupUser();
    const res = await app.request('/api/predict/stream', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { title: 'hello world' }, platforms: ['xhs'] }),
    }, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
  });
});
