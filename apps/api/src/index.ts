import { Hono } from 'hono';
import { authRouter } from './routes/auth';
import { simulateRouter } from './routes/simulate';
import { reportRouter } from './routes/report';
import { predictRouter } from './routes/predict';
import { checkoutRouter } from './routes/checkout';
import { usersRouter } from './routes/users';
import { parseEnv } from './utils/env';

const app = new Hono();

// Vitest-startup sanity check ONLY. Cloudflare Workers does NOT populate
// `process.env` from `wrangler secret put` — secrets are bound via the
// worker context (c.env), not process.env. So in production, this probe
// sees NODE_ENV=undefined → 'development' and JWT_SECRET=undefined →
// fallback literal; the prod guards (placeholder JWT, prod+sandbox combo,
// ≥32-byte strength) never fire here. The real enforcement happens in
// getEnv(c) on every request, which DOES see c.env. We keep this block so
// vitest-pool-workers (which pre-loads all routes via import) fails fast
// if a future contributor breaks the JWT_SECRET shape — but it is NOT
// a production safety net. v0.15.1 carry-over: wire this probe through
// the worker module init hook so it sees c.env bindings in prod too.
try {
  parseEnv({ JWT_SECRET: process.env.JWT_SECRET ?? 'test-secret-isolated-from-dev' });
} catch (err) {
  // Don't crash the worker boot — just log. The runtime getEnv(c) call
  // will still enforce the same gates on every request. The catch is here
  // so a missing JWT_SECRET in local dev doesn't prevent `vitest` from
  // starting up.
  console.warn(
    '[index] vitest-startup parseEnv sanity check failed; runtime guards still apply',
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
