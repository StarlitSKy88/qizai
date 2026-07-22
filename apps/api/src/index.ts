import { Hono } from 'hono';
import { authRouter } from './routes/auth';
import { simulateRouter } from './routes/simulate';
import { reportRouter } from './routes/report';

const app = new Hono();

app.route('/api/auth', authRouter);
app.route('/api/simulate', simulateRouter);
app.route('/api/report', reportRouter);

app.get('/', (c) => c.json({ status: 'qizai-api-ok' }));

export default app;
