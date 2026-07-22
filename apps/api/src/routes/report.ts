import { Hono } from 'hono';

export const reportRouter = new Hono();

reportRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  return c.json({ id, status: 'TODO' });
});
