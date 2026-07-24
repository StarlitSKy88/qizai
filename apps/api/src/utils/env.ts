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
}

export function parseEnv(raw: Record<string, unknown>): AppEnv {
  if (!raw.JWT_SECRET || typeof raw.JWT_SECRET !== 'string') {
    throw new Error('JWT_SECRET is required');
  }
  const jwtSecret = raw.JWT_SECRET as string;
  if ((raw.NODE_ENV as string) === 'production' && (jwtSecret === 'dev-secret-replace-in-prod' || jwtSecret === 'test-secret-isolated-from-dev')) {
    throw new Error('JWT_SECRET must be set via `wrangler secret put JWT_SECRET` in production; placeholder value detected');
  }
  return {
    NODE_ENV: (raw.NODE_ENV as string) ?? 'development',
    JWT_SECRET: jwtSecret,
    ALIBABA_BAILIAN_API_KEY: raw.ALIBABA_BAILIAN_API_KEY as string | undefined,
    FIREWORKS_API_KEY: raw.FIREWORKS_API_KEY as string | undefined,
    DEEPSEEK_API_KEY: raw.DEEPSEEK_API_KEY as string | undefined,
    DB: raw.DB as D1Database | undefined,
  };
}

export function getEnv(c: Context): AppEnv {
  return parseEnv((c.env ?? {}) as Record<string, unknown>);
}
