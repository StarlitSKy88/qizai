import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the API client so auth.ts exercises the real localStorage wiring
// (write/read/clear JWT) without opening a network socket. The mock
// returns a fake Response object whose `.ok` and `.json()` are configured
// per test, matching the server contract in apps/api/src/routes/auth.ts.
vi.mock('../../src/api/client', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '../../src/api/client';
import { signup, login } from '../../src/api/auth';

const mockedApiFetch = vi.mocked(apiFetch);

/**
 * Build a minimal Response-like object: `{ ok, status, json }`. We don't
 * pull in the global `Response` because jsdom 29 ships a stripped stub
 * that throws on `.json()` for non-2xx with no body, and our error path
 * needs to read `.json()` regardless of status.
 */
function fakeResponse(opts: {
  ok: boolean;
  status?: number;
  body?: unknown;
}): Response {
  const { ok, status = ok ? 200 : 400, body = {} } = opts;
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('auth', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    // test/setup.ts clears localStorage before each test.
  });

  it('signup OK stores JWT in localStorage and returns body', async () => {
    mockedApiFetch.mockResolvedValue(
      fakeResponse({
        ok: true,
        status: 201,
        body: { userId: 'user-1', token: 'jwt-abc' },
      }),
    );

    const result = await signup('alice@example.com', 'password123');

    expect(result).toEqual({ userId: 'user-1', token: 'jwt-abc' });
    expect(localStorage.getItem('qizai_jwt')).toBe('jwt-abc');
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
    const [path, init] = mockedApiFetch.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/auth/register');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(
      JSON.stringify({ email: 'alice@example.com', password: 'password123' }),
    );
  });

  it('signup duplicate email throws Error with code EMAIL_TAKEN', async () => {
    mockedApiFetch.mockResolvedValue(
      fakeResponse({
        ok: false,
        status: 409,
        body: { code: 'EMAIL_TAKEN', message: '该邮箱已注册' },
      }),
    );

    await expect(
      signup('alice@example.com', 'password123'),
    ).rejects.toMatchObject({
      message: '该邮箱已注册',
      code: 'EMAIL_TAKEN',
    });
    // A failed signup must NOT have written a JWT — otherwise a stale
    // token from a prior successful login would survive a 409.
    expect(localStorage.getItem('qizai_jwt')).toBeNull();
  });

  it('login OK stores JWT in localStorage', async () => {
    mockedApiFetch.mockResolvedValue(
      fakeResponse({
        ok: true,
        body: { userId: 'user-2', token: 'jwt-xyz' },
      }),
    );

    const result = await login('bob@example.com', 'password123');

    expect(result).toEqual({ userId: 'user-2', token: 'jwt-xyz' });
    expect(localStorage.getItem('qizai_jwt')).toBe('jwt-xyz');
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
    const [path, init] = mockedApiFetch.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/auth/login');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(
      JSON.stringify({ email: 'bob@example.com', password: 'password123' }),
    );
  });

  it('login wrong password throws Error with code AUTH_FAILED', async () => {
    mockedApiFetch.mockResolvedValue(
      fakeResponse({
        ok: false,
        status: 401,
        body: { code: 'AUTH_FAILED', message: '邮箱或密码不对' },
      }),
    );

    await expect(
      login('bob@example.com', 'wrongpass'),
    ).rejects.toMatchObject({
      message: '邮箱或密码不对',
      code: 'AUTH_FAILED',
    });
    expect(localStorage.getItem('qizai_jwt')).toBeNull();
  });
});