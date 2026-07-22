import { Hono } from 'hono';

export const authRouter = new Hono();

authRouter.post('/send-verify-code', async (c) => {
  const { phone } = await c.req.json();
  return c.json({ sent: true, phone });
});

authRouter.post('/login', async (c) => {
  const { phone, code } = await c.req.json();
  return c.json({ token: 'mock-jwt-token', phone });
});
