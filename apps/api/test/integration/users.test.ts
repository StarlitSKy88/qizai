// apps/api/test/integration/users.test.ts
//
// T08: GET /api/users/me integration tests.

import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
const { default: app } = await import('../../src/index');

async function setupUser(email = 'a@b.com') {
  const res = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'correct horse' }),
  }, env);
  const body = (await res.json()) as any;
  return { userId: body.userId, token: body.token, auth: { Authorization: `Bearer ${body.token}` } };
}

describe('users GET /me', () => {
  beforeEach(async () => {
    await env.DB.exec('DELETE FROM orders; DELETE FROM reports; DELETE FROM users; DELETE FROM rate_limits;');
  });

  it('returns current user profile with quota + plan', async () => {
    const { userId, auth } = await setupUser('me@b.com');
    const res = await app.request('/api/users/me', { headers: { ...auth } }, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.userId).toBe(userId);
    expect(body.email).toBe('me@b.com');
    expect(body.plan).toBe('free');
    expect(body.quota_used).toBe(0);
    expect(body.quota_limit).toBe(30);
    expect(body.quota_limit_renew_at).toBeNull();
  });

  it('returns 401 AUTH_REQUIRED without bearer token', async () => {
    const res = await app.request('/api/users/me', undefined, env);
    expect(res.status).toBe(401);
  });
});