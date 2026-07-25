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

export function parseEnv(raw: Record<string, unknown>): AppEnv {
  if (!raw.JWT_SECRET || typeof raw.JWT_SECRET !== 'string') {
    throw new Error('JWT_SECRET is required');
  }
  const jwtSecret = raw.JWT_SECRET as string;
  const nodeEnv = (raw.NODE_ENV as string) ?? 'development';
  if (nodeEnv === 'production' && (jwtSecret === 'dev-secret-replace-in-prod' || jwtSecret === 'test-secret-isolated-from-dev')) {
    throw new Error('JWT_SECRET must be set via `wrangler secret put JWT_SECRET` in production; placeholder value detected');
  }
  // Permissive boolean parser: wrangler [vars] blocks sometimes serialize
  // booleans as the string "true" / "True" / "TRUE". Accept any case so a
  // misconfigured prod doesn't silently default to sandbox=false (or vice
  // versa) and disable the bypass gate in an unexpected place.
  const sandboxRaw = raw.WXPAY_USE_SANDBOX;
  const useSandbox =
    typeof sandboxRaw === 'boolean'
      ? sandboxRaw
      : typeof sandboxRaw === 'string'
      ? sandboxRaw.toLowerCase() === 'true'
      : false;
  // Defense in depth: a production deployment with WXPAY_USE_SANDBOX=true
  // would route every signed WXPay request to the sandbox host with a
  // 32-zero-byte HMAC key fallback — silently broken and trivially
  // forgeable. Refuse at boot so the misconfig is loud, not silent.
  if (nodeEnv === 'production' && useSandbox) {
    throw new Error('WXPAY_USE_SANBOX=true is not allowed in production; signV3 falls back to a 32-zero-byte HMAC key in sandbox mode');
  }
  return {
    NODE_ENV: nodeEnv,
    JWT_SECRET: jwtSecret,
    ALIBABA_BAILIAN_API_KEY: raw.ALIBABA_BAILIAN_API_KEY as string | undefined,
    FIREWORKS_API_KEY: raw.FIREWORKS_API_KEY as string | undefined,
    DEEPSEEK_API_KEY: raw.DEEPSEEK_API_KEY as string | undefined,
    DB: raw.DB as D1Database | undefined,
    WXPAY_MCH_ID: raw.WXPAY_MCH_ID as string | undefined,
    WXPAY_API_KEY_V3: raw.WXPAY_API_KEY_V3 as string | undefined,
    WXPAY_PRIVATE_KEY: raw.WXPAY_PRIVATE_KEY as string | undefined,
    WXPAY_PLATFORM_CERT: raw.WXPAY_PLATFORM_CERT as string | undefined,
    WXPAY_CERT_SERIAL: raw.WXPAY_CERT_SERIAL as string | undefined,
    WXPAY_NOTIFY_URL: raw.WXPAY_NOTIFY_URL as string | undefined,
    WXPAY_USE_SANDBOX: useSandbox,
  };
}

export function getEnv(c: Context): AppEnv {
  return parseEnv((c.env ?? {}) as Record<string, unknown>);
}
