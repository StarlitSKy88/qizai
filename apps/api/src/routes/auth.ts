import { Hono } from 'hono';
import { hashPassword, verifyPassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { getEnv } from '../utils/env';

export const authRouter = new Hono();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 8;

authRouter.post('/register', async (c) => {
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

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: string }>();
  if (existing) {
    return c.json({ code: 'EMAIL_TAKEN', message: '该邮箱已注册' }, 409);
  }

  const userId = `user-${crypto.randomUUID()}`;
  const hash = await hashPassword(password);
  await env.DB.prepare(
    'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
  )
    .bind(userId, email, hash)
    .run();

  const token = await signToken({ sub: userId, email }, env.JWT_SECRET);
  return c.json({ userId, token }, 201);
});

authRouter.post('/login', async (c) => {
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
