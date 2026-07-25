// apps/api/src/index.ts
//
// Hono app entry for the qizai API.
// Routes: /api/auth, /api/simulate, /api/report, /api/predict,
//         /api/checkout, /api/users, GET /
//
// v0.15.1 — Boot probe via c.env:
//   Cloudflare Workers does NOT populate `process.env` from `wrangler secret
//   put` — secrets are bound via the worker context (c.env), not process.env.
//   The vitest-startup `parseEnv` probe below (lines 49-61) only sees
//   process.env, which is the dev/test fallback. The real prod-guard runs
//   on the first request via bootMiddleware (lines 32-43): we parse c.env
//   once per isolate, log a loud console.error on misconfiguration, and let
//   getEnv(c) throw per-request thereafter.
//
//   We do NOT throw from bootMiddleware: throwing would cascade to all
//   routes returning 503, which is worse than per-route 500 with actionable
//   error logs. getEnv(c) is the actual enforcement gate; bootMiddleware
//   is observability.
//
//   Implementation note: we keep `export default app` (Hono instance) so
//   integration tests can keep using `app.request('/path', {}, env)`. The
//   boot probe is a Hono middleware that fires on the first request —
//   this is the standard Hono way to access c.env at request time without
//   breaking the test infrastructure that vitest-pool-workers 0.18 expects.

import { Hono, type MiddlewareHandler } from 'hono';
import { authRouter } from './routes/auth';
import { simulateRouter } from './routes/simulate';
import { reportRouter } from './routes/report';
import { predictRouter } from './routes/predict';
import { checkoutRouter } from './routes/checkout';
import { usersRouter } from './routes/users';
import { parseEnv, type AppEnv } from './utils/env';

const app = new Hono();

// ──────────────────────────────────────────────────────────────────
// Boot probe state + middleware (v0.15.1)
// ──────────────────────────────────────────────────────────────────

interface BootState {
  /** True after the first call to bootMiddleware(). Prevents re-running. */
  validated: boolean;
  /** True if parseEnv(env) succeeded on the first call. */
  valid: boolean;
  /** Captured error from the first parseEnv failure, for future debugging. */
  error?: unknown;
}

const boot: BootState = { validated: false, valid: true };

/**
 * Hono middleware that runs parseEnv(c.env) on the FIRST request to this
 * Workers isolate, caches the result, and logs a loud console.error on
 * misconfiguration. Subsequent requests short-circuit.
 *
 * Why middleware (not a fetch wrapper): vitest-pool-workers 0.18 imports
 * `default` and calls `app.request(req, env, ctx)`. A `{ fetch }` wrapper
 * would break `app.request` semantics; middleware preserves it.
 *
 * Why we don't throw: see header comment. Per-route 500 from getEnv(c) is
 * the actionable failure mode; this hook is for ops visibility.
 */
const bootMiddleware: MiddlewareHandler = async (c, next) => {
  if (!boot.validated) {
    boot.validated = true;
    try {
      parseEnv(c.env as unknown as AppEnv);
      boot.valid = true;
    } catch (err) {
      boot.valid = false;
      boot.error = err;
      console.error(
        '[index] boot-time parseEnv FAILED on first request via c.env — runtime guards will still throw on each request',
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  await next();
};

// Apply boot middleware FIRST so it fires before any route's requireAuth
// (which calls getEnv(c) and throws on misconfig). The middleware is a
// no-op after the first call, so no per-request cost.
app.use('*', bootMiddleware);

// ──────────────────────────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────────────────────────

app.route('/api/auth', authRouter);
app.route('/api/simulate', simulateRouter);
app.route('/api/report', reportRouter);
app.route('/api/predict', predictRouter);
app.route('/api/checkout', checkoutRouter);
app.route('/api/users', usersRouter);

app.get('/', (c) => c.json({ status: 'qizai-api-ok' }));

// ──────────────────────────────────────────────────────────────────
// Vitest-startup sanity check (unchanged from v0.15.0 round-6)
// ──────────────────────────────────────────────────────────────────
//
// This probe exists ONLY for vitest-pool-workers, which pre-loads all
// routes via import and reads process.env from wrangler.test.toml.
// Cloudflare Workers production does NOT populate process.env from
// `wrangler secret put`, so this probe sees NODE_ENV=undefined and
// JWT_SECRET=undefined in prod → parseEnv defaults to 'development'
// and uses the fallback literal → prod guards never fire here.
//
// The real prod enforcement happens via:
//   1. bootMiddleware above — one-shot per isolate, fires on first request
//   2. getEnv(c) in every route — per-request enforcement
//
// If a future contributor wants to remove this probe entirely, that's
// safe — bootMiddleware covers the prod path. Keeping it catches dev-env
// regressions at module-load time.
try {
  parseEnv({ JWT_SECRET: process.env.JWT_SECRET ?? 'test-secret-isolated-from-dev' });
} catch (err) {
  console.warn(
    '[index] vitest-startup parseEnv sanity check failed; runtime guards still apply',
    err instanceof Error ? err.message : String(err),
  );
}

// ──────────────────────────────────────────────────────────────────
// Export — keep Hono app instance for test infrastructure compat
// ──────────────────────────────────────────────────────────────────
//
// vitest-pool-workers imports `default` and expects Hono's app.request
// signature (used by every integration test in test/integration/*.test.ts).
// The CF Workers runtime also accepts Hono's app directly — Wrangler's
// main entry can be a Hono instance because Hono's app.fetch matches the
// Workers fetch handler signature.
//
// If we ever need a custom wrapper, do it in wrangler.toml's main field
// rather than changing this default export.

export default app;