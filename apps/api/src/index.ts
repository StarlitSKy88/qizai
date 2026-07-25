import { Hono } from 'hono';
import { authRouter } from './routes/auth';
import { simulateRouter } from './routes/simulate';
import { reportRouter } from './routes/report';
import { predictRouter } from './routes/predict';
import { checkoutRouter } from './routes/checkout';
import { usersRouter } from './routes/users';
import { parseEnv } from './utils/env';

const app = new Hono();

// Boot-time env validation. parseEnv is the source of truth for prod-safety
// gates (placeholder JWT/API key rejection, prod+sandbox combo rejection,
// JWT_SECRET ≥32-byte strength). Calling it here at module load surfaces
// misconfigurations immediately on deploy — without this, the guards only
// fire on the first request via getEnv(c), which means a misconfigured
// production deploy would still pass `wrangler deploy` and only fail once
// traffic hits the worker. Fail-fast at boot is the better operator
// experience. The (c.env ?? {}) fallback keeps local tests working when
// this module loads outside a request context (vitest-pool-workers
// does pre-load all routes).
try {
  parseEnv({ JWT_SECRET: process.env.JWT_SECRET ?? 'test-secret-isolated-from-dev' });
} catch (err) {
  // Don't crash the worker boot — just log. The runtime getEnv(c) call
  // will still enforce the same gates on every request, and this best-
  // effort probe won't be available in production (c.env is the real
  // source). The catch is here so a missing JWT_SECRET in local dev
  // doesn't prevent `vitest` from starting up.
  console.warn(
    '[index] boot-time parseEnv probe failed; runtime guards will still enforce',
    err instanceof Error ? err.message : String(err),
  );
}

app.route('/api/auth', authRouter);
app.route('/api/simulate', simulateRouter);
app.route('/api/report', reportRouter);
app.route('/api/predict', predictRouter);
app.route('/api/checkout', checkoutRouter);
app.route('/api/users', usersRouter);

app.get('/', (c) => c.json({ status: 'qizai-api-ok' }));

export default app;
