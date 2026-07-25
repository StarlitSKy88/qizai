// apps/api/src/utils/env.ts
/// <reference types="@cloudflare/workers-types" />
import type { Context } from 'hono';

export interface AppEnv {
  NODE_ENV: string;
  JWT_SECRET: string;
  ALIBABA_BAILIAN_API_KEY?: string;
  FIREWORKS_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  DB?: D1Database;
  // WeChat Pay V3 — all secret/cert fields optional so dev/test can run
  // without WXPay credentials; production injects via `wrangler secret put`.
  WXPAY_MCH_ID?: string;
  WXPAY_API_KEY_V3?: string;
  WXPAY_PRIVATE_KEY?: string;
  WXPAY_PLATFORM_CERT?: string;
  WXPAY_CERT_SERIAL?: string;
  WXPAY_NOTIFY_URL?: string;
  WXPAY_USE_SANDBOX: boolean;
}

// Canonical aliases for NODE_ENV. Anything outside this set is treated as
// 'development' for guard purposes — that way a typo like 'prod ' (trailing
// space from copy-paste) or 'Prod' / 'PROD' (Windows) doesn't silently
// downgrade prod into a less-strict code path.
const NODE_ENV_ALIASES: Record<string, 'production' | 'staging' | 'test' | 'development'> = {
  production: 'production',
  prod: 'production',
  staging: 'staging',
  stage: 'staging',
  test: 'test',
  testing: 'test',
  development: 'development',
  dev: 'development',
};

function normalizeNodeEnv(raw: unknown): 'production' | 'staging' | 'test' | 'development' {
  if (typeof raw !== 'string') return 'development';
  const key = raw.trim().toLowerCase();
  return NODE_ENV_ALIASES[key] ?? 'development';
}

export function parseEnv(raw: unknown): AppEnv {
  if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('parseEnv: raw env must be an object');
  }
  const env = raw as Record<string, unknown>;
  if (!env.JWT_SECRET || typeof env.JWT_SECRET !== 'string') {
    throw new Error('JWT_SECRET is required');
  }
  const jwtSecret = env.JWT_SECRET as string;
  const nodeEnv = normalizeNodeEnv(env.NODE_ENV);
  if (
    nodeEnv === 'production' &&
    (jwtSecret === 'dev-secret-replace-in-prod' ||
      jwtSecret === 'test-secret-isolated-from-dev')
  ) {
    throw new Error(
      'JWT_SECRET must be set via `wrangler secret put JWT_SECRET` in production; placeholder value detected',
    );
  }
  // Strength floor: prod JWT_SECRET must be ≥32 bytes of entropy. Anything
  // shorter is brute-forceable regardless of complexity. The placeholder
  // guard above catches known-bad strings; this catches "looks-real-but-isn't".
  if (nodeEnv === 'production') {
    const bytes = new TextEncoder().encode(jwtSecret).byteLength;
    if (bytes < 32) {
      throw new Error(
        `JWT_SECRET must be at least 32 bytes in production (got ${bytes}); rotate via \`wrangler secret put JWT_SECRET\``,
      );
    }
  }
  // Permissive boolean parser: wrangler [vars] blocks sometimes serialize
  // booleans as the string "true" / "True" / "TRUE". Accept any case so a
  // misconfigured prod doesn't silently default to sandbox=false (or vice
  // versa) and disable the bypass gate in an unexpected place. Missing →
  // false (safer default: route to prod host with no zero-byte fallback).
  const sandboxRaw = env.WXPAY_USE_SANDBOX;
  const useSandbox =
    typeof sandboxRaw === 'boolean'
      ? sandboxRaw
      : typeof sandboxRaw === 'string'
        ? sandboxRaw.toLowerCase() === 'true'
        : false;
  // Defense in depth: a production deployment with WXPAY_USE_SANDBOX=true
  // would route every signed WXPay request to the sandbox host with a
  // 32-zero-byte HMAC key fallback — silently broken and trivially
  // forgeable. Refuse at parseEnv time so the misconfig is loud.
  if (nodeEnv === 'production' && useSandbox) {
    throw new Error(
      'WXPAY_USE_SANDBOX=true is not allowed in production; signV3 falls back to a 32-zero-byte HMAC key in sandbox mode',
    );
  }
  // Placeholder guard analog to JWT_SECRET: the test fixture value
  // 'test-api-key-32-bytes-long-pad!!' must never reach production. Without
  // this, a copy-paste from apps/api/test/unit/wechat-pay.test.ts into a
  // wrangler.toml as a placeholder would be accepted by the parser.
  if (
    nodeEnv === 'production' &&
    typeof env.WXPAY_API_KEY_V3 === 'string' &&
    env.WXPAY_API_KEY_V3 === 'test-api-key-32-bytes-long-pad!!'
  ) {
    throw new Error(
      'WXPAY_API_KEY_V3 is the test fixture value; set via `wrangler secret put WXPAY_API_KEY_V3` in production',
    );
  }
  return {
    NODE_ENV: nodeEnv,
    JWT_SECRET: jwtSecret,
    ALIBABA_BAILIAN_API_KEY: env.ALIBABA_BAILIAN_API_KEY as string | undefined,
    FIREWORKS_API_KEY: env.FIREWORKS_API_KEY as string | undefined,
    DEEPSEEK_API_KEY: env.DEEPSEEK_API_KEY as string | undefined,
    DB: env.DB as D1Database | undefined,
    WXPAY_MCH_ID: env.WXPAY_MCH_ID as string | undefined,
    WXPAY_API_KEY_V3: env.WXPAY_API_KEY_V3 as string | undefined,
    WXPAY_PRIVATE_KEY: env.WXPAY_PRIVATE_KEY as string | undefined,
    WXPAY_PLATFORM_CERT: env.WXPAY_PLATFORM_CERT as string | undefined,
    WXPAY_CERT_SERIAL: env.WXPAY_CERT_SERIAL as string | undefined,
    WXPAY_NOTIFY_URL: env.WXPAY_NOTIFY_URL as string | undefined,
    WXPAY_USE_SANDBOX: useSandbox,
  };
}

export function getEnv(c: Context): AppEnv {
  return parseEnv((c.env ?? {}) as Record<string, unknown>);
}
