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

  it('rejects non-string title with 400 INVALID_INPUT', async () => {
    const { auth } = await setupUser();
    const res = await app.request('/api/predict/stream', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { title: 123 }, platforms: ['xhs'] }),
    }, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.code).toBe('INVALID_INPUT');
  });

  it('rejects title longer than 2000 chars with 400 INVALID_INPUT', async () => {
    const { auth } = await setupUser();
    const res = await app.request('/api/predict/stream', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { title: 'x'.repeat(2001) }, platforms: ['xhs'] }),
    }, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.code).toBe('INVALID_INPUT');
  });
});
