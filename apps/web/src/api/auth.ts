/**
 * apps/web/src/api/auth.ts
 *
 * Thin auth hooks for the web UI. Wraps the two Hono auth endpoints
 * (POST /api/auth/register, POST /api/auth/login) and persists the JWT
 * to localStorage under the `qizai_jwt` key — the same key `apiFetch`
 * reads on every authenticated request, so login just works.
 *
 * Server contract (apps/api/src/routes/auth.ts):
 *   - 201/200 → `{ userId: string, token: string }`
 *   - 4xx     → `{ code: 'EMAIL_TAKEN' | 'AUTH_FAILED' | 'INVALID_EMAIL' | 'WEAK_PASSWORD', message: string }`
 *
 * Errors thrown from `signup` / `login` are plain `Error` instances
 * augmented with `.code` (the server's machine-readable code) so callers
 * can switch on it without parsing message strings.
 */
import { apiFetch } from './client';

export interface AuthSuccess {
  userId: string;
  token: string;
}

export async function signup(
  email: string,
  password: string,
): Promise<AuthSuccess> {
  const r = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw await toApiError(r);
  const body = (await r.json()) as AuthSuccess;
  localStorage.setItem('qizai_jwt', body.token);
  return body;
}

export async function login(
  email: string,
  password: string,
): Promise<AuthSuccess> {
  const r = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw await toApiError(r);
  const body = (await r.json()) as AuthSuccess;
  localStorage.setItem('qizai_jwt', body.token);
  return body;
}

export function logout(): void {
  localStorage.removeItem('qizai_jwt');
}

export function getJwt(): string | null {
  return localStorage.getItem('qizai_jwt');
}

async function toApiError(r: Response): Promise<Error & { code: string }> {
  const body = (await r.json().catch(() => ({}))) as {
    code?: string;
    message?: string;
  };
  const err = new Error(body.message ?? `HTTP ${r.status}`) as Error & {
    code: string;
  };
  err.code = body.code ?? `HTTP_${r.status}`;
  return err;
}