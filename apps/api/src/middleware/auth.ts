// apps/api/src/middleware/auth.ts
import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import { verifyToken, JWTPayload } from '../utils/jwt';
import { getEnv } from '../utils/env';

export const requireAuth = createMiddleware(async (c: Context, next) => {
  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ code: 'AUTH_REQUIRED', message: '请先登录' }, 401);
  }
  const token = auth.slice(7);
  try {
    const env = getEnv(c);
    const payload = await verifyToken(token, env.JWT_SECRET);
    c.set('user', payload);
    await next();
  } catch (err) {
    return c.json({ code: 'AUTH_REQUIRED', message: 'Token 无效或已过期' }, 401);
  }
});

export function getUser(c: Context): JWTPayload {
  return c.get('user') as JWTPayload;
}
