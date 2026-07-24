// apps/api/test/integration/auth.test.ts
//
// T06+T07 integration tests for POST /api/auth/register and POST /api/auth/login.
// Runs inside the Cloudflare Workers runtime via @cloudflare/vitest-pool-workers.
// D1 migrations are applied once per suite via test/setup-integration.ts.

import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../src/index';

async function clearUsers() {
  // H5: also clear rate_limits so the per-IP throttle bucket is fresh
  // for each test — otherwise a later test in the same file would
  // inherit the previous test's register/login budget.
  await env.DB.exec('DELETE FROM reports; DELETE FROM users; DELETE FROM rate_limits;');
}

describe('POST /api/auth/register', () => {
  beforeEach(clearUsers);

  it('registers a new user and returns token', async () => {
    const res = await app.request(
      '/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.com', password: 'correct horse' }),
      },
      env,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { userId: string; token: string };
    expect(body.userId).toBeTruthy();
    expect(body.token).toBeTruthy();
    expect(body.token.split('.')).toHaveLength(3);
  });

  it('rejects weak password', async () => {
    const res = await app.request(
      '/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.com', password: 'short' }),
      },
      env,
    );
    expect(res.status).toBe(400);
  });

  it('rejects duplicate email', async () => {
    await app.request(
      '/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.com', password: 'correct horse' }),
      },
      env,
    );
    const res = await app.request(
      '/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.com', password: 'another good one' }),
      },
      env,
    );
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(clearUsers);

  it('logs in existing user', async () => {
    await app.request(
      '/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.com', password: 'correct horse' }),
      },
      env,
    );
    const res = await app.request(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.com', password: 'correct horse' }),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string };
    expect(body.token).toBeTruthy();
  });

  it('rejects wrong password', async () => {
    await app.request(
      '/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.com', password: 'correct horse' }),
      },
      env,
    );
    const res = await app.request(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.com', password: 'wrong' }),
      },
      env,
    );
    expect(res.status).toBe(401);
  });

  // H5: register is throttled at 5/h per IP. The first 5 calls return
  // 201 / 409; the 6th call (same IP, same hour window) must return 429
  // with a RATE_LIMITED code so a credential-stuffing bot can't burn
  // bcrypt CPU without bound.
  it('returns 429 RATE_LIMITED after 5 register attempts within 1 hour', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await app.request(
        '/api/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: `rate-${i}@b.com`,
            password: 'correct horse',
          }),
        },
        env,
      );
      expect(res.status).toBe(201);
    }
    const blocked = await app.request(
      '/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'rate-6@b.com', password: 'correct horse' }),
      },
      env,
    );
    expect(blocked.status).toBe(429);
    const body = (await blocked.json()) as { code: string };
    expect(body.code).toBe('RATE_LIMITED');
  });
});
