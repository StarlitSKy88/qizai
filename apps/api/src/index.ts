import { Hono } from 'hono';
const app = new Hono();
app.get('/', (c) => c.json({ status: 'qizai-api-ok' }));
export default app;
