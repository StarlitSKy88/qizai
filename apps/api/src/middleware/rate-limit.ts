// apps/api/src/middleware/rate-limit.ts
//
// H5 from Opus security/bug audit: the `rate_limits` table existed but
// was unused, so a script kiddie with a 16-core box could burn bcrypt
// CPU on /api/auth/register or pound /api/auth/login for credential
// stuffing without any throttle.
//
// We use a sliding fixed-window counter (windowStart = floor(now /
// windowSec) * windowSec). The PK is (ip, window_start) so concurrent
// inserts from the same IP collapse via ON CONFLICT. A single round-
// trip INSERT ... ON CONFLICT ... RETURNING is atomic on D1, so two
// concurrent requests cannot both observe count=N and both pass.
//
// The middleware exposes a helper, not a factory — callers decide the
// bucket (IP + route name) and the budget (limit, windowSec). The two
// call sites are /api/auth/register (5/h) and /api/auth/login (10/h),
// but a future /api/auth/forgot-password can reuse this without
// touching the helper.

import type { Context, MiddlewareHandler } from 'hono';
import { getEnv } from '../utils/env';

export interface RateLimitOptions {
  /** Bucket key, e.g. `register:1.2.3.4`. Must be unique per route+IP. */
  key: string;
  /** Max requests allowed inside one window. */
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** How many requests have been counted so far in this window. */
  count: number;
  /** Seconds until the window resets. */
  retryAfter: number;
}

/**
 * Increment the counter for `(key, window)` and return whether the
 * caller is still under `limit`. Skips silently when no D1 binding is
 * configured (tests / local dev) — the auth gate still applies, so the
 * worst case is "no throttle", not "auth bypass".
 */
export async function rateLimit(
  c: Context,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const { key, limit, windowSec } = options;
  const env = getEnv(c);
  if (!env.DB) {
    return { allowed: true, count: 0, retryAfter: 0 };
  }
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSec);
  const row = await env.DB
    .prepare(
      `INSERT INTO rate_limits (ip, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT (ip, window_start) DO UPDATE SET count = count + 1
       RETURNING count`,
    )
    .bind(key, windowStart)
    .first<{ count: number }>();
  const count = row?.count ?? 0;
  return {
    allowed: count <= limit,
    count,
    retryAfter: windowSec - (now - windowStart),
  };
}

/**
 * Build a Hono middleware that throttles requests by client IP. Use
 * only on routes where a malicious caller would burn expensive server
 * work (bcrypt, LLM calls). The IP comes from CF-Connecting-IP when
 * available (Cloudflare Workers standard), with a fallback to the
 * raw remote addr so unit tests / local dev still get bucketed.
 */
export function rateLimitByIp(
  bucket: string,
  limit: number,
  windowSec: number,
): MiddlewareHandler {
  return async (c, next) => {
    const ip =
      c.req.header('cf-connecting-ip') ??
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      'unknown';
    const result = await rateLimit(c, {
      key: `${bucket}:${ip}`,
      limit,
      windowSec,
    });
    if (!result.allowed) {
      c.header('Retry-After', String(result.retryAfter));
      return c.json(
        {
          code: 'RATE_LIMITED',
          message: `请求过于频繁，请 ${result.retryAfter} 秒后再试`,
        },
        429,
      );
    }
    await next();
  };
}