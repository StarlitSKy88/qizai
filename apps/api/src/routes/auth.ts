import { Hono } from 'hono';
import { hashPassword, verifyPassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { getEnv } from '../utils/env';
import { rateLimitByIp } from '../middleware/rate-limit';

export const authRouter = new Hono();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 8;

// H5: bcrypt is intentionally expensive (≈100ms per call on a CF Worker
// CPU). Without a per-IP throttle a single attacker can saturate the
// auth path with thousands of register / login attempts per minute.
// 5/h for register blocks account-stuffing bots; 10/h for login blocks
// credential stuffing without locking out legitimate retry-on-typo.
const registerRateLimit = rateLimitByIp('register', 5, 3600);
const loginRateLimit = rateLimitByIp('login', 10, 3600);

authRouter.post('/register', registerRateLimit, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  const email = body.email?.toLowerCase().trim();
  const password = body.password ?? '';

  if (!email || !EMAIL_RE.test(email)) {
    return c.json({ code: 'INVALID_EMAIL', message: '邮箱格式不对' }, 400);
  }
  if (password.length < MIN_PASSWORD_LEN) {
    return c.json(
      { code: 'WEAK_PASSWORD', message: `密码至少 ${MIN_PASSWORD_LEN} 位` },
      400,
    );
  }

  const env = getEnv(c);
  if (!env.DB) return c.json({ code: 'DB_NOT_CONFIGURED' }, 500);

  const userId = `user-${crypto.randomUUID()}`;

  // B1 fast-path: cheap SELECT first so a known-duplicate registration
  // doesn't pay the bcrypt cost (≈100ms on a CF Worker CPU). This is
  // intentionally *not* the race guard — two concurrent requests will
  // both pass this check. The atomic batch below is.
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: string }>();
  if (existing) {
    return c.json({ code: 'EMAIL_TAKEN', message: '该邮箱已注册' }, 409);
  }

  const hash = await hashPassword(password);

  // B1 atomic guard: race window between the pre-check SELECT above and
  // the INSERT below. A concurrent writer can land the same email in
  // that gap, which would otherwise produce two user rows and a leaked
  // 500. env.DB.batch([...]) runs the whole sequence as one transaction;
  // if either statement fails the batch rolls back. We rely on the
  // users.email UNIQUE constraint to trip and translate the rollback
  // into a clean 409 EMAIL_TAKEN — the same response the fast-path
  // would have produced if it had seen the row first.
  const selectStmt = env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email);
  const insertStmt = env.DB.prepare(
    'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
  ).bind(userId, email, hash);

  try {
    await env.DB.batch([selectStmt, insertStmt]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/UNIQUE constraint failed|users\.email/i.test(msg)) {
      console.debug('[auth/register] lost race to concurrent insert', { email });
      return c.json({ code: 'EMAIL_TAKEN', message: '该邮箱已注册' }, 409);
    }
    throw err;
  }

  const token = await signToken({ sub: userId, email }, env.JWT_SECRET);
  return c.json({ userId, token }, 201);
});

authRouter.post('/login', loginRateLimit, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  const email = body.email?.toLowerCase().trim() ?? '';
  const password = body.password ?? '';

  if (!EMAIL_RE.test(email)) {
    // Same shape as AUTH_FAILED but pre-DB validation; spec says 401 only after DB lookup.
    // We still want to avoid DB roundtrip for malformed input.
    return c.json({ code: 'AUTH_FAILED', message: '邮箱或密码不对' }, 401);
  }

  const env = getEnv(c);
  if (!env.DB) return c.json({ code: 'DB_NOT_CONFIGURED' }, 500);

  const user = await env.DB.prepare(
    'SELECT id, password_hash FROM users WHERE email = ?',
  )
    .bind(email)
    .first<{ id: string; password_hash: string }>();
  if (!user) {
    return c.json({ code: 'AUTH_FAILED', message: '邮箱或密码不对' }, 401);
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    return c.json({ code: 'AUTH_FAILED', message: '邮箱或密码不对' }, 401);
  }

  const token = await signToken({ sub: user.id, email }, env.JWT_SECRET);
  return c.json({ userId: user.id, token });
});
