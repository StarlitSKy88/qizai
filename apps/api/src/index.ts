import { Hono } from 'hono';
import { authRouter } from './routes/auth';
import { simulateRouter } from './routes/simulate';
import { reportRouter } from './routes/report';
import { predictRouter } from './routes/predict';
import { checkoutRouter } from './routes/checkout';
import { usersRouter } from './routes/users';

const app = new Hono();

app.route('/api/auth', authRouter);
app.route('/api/simulate', simulateRouter);
app.route('/api/report', reportRouter);
app.route('/api/predict', predictRouter);
app.route('/api/checkout', checkoutRouter);
app.route('/api/users', usersRouter);

app.get('/', (c) => c.json({ status: 'qizai-api-ok' }));

export default app;
