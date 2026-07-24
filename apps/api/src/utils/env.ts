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
  return {
    NODE_ENV: (raw.NODE_ENV as string) ?? 'development',
    JWT_SECRET: raw.JWT_SECRET,
    ALIBABA_BAILIAN_API_KEY: raw.ALIBABA_BAILIAN_API_KEY as string | undefined,
    FIREWORKS_API_KEY: raw.FIREWORKS_API_KEY as string | undefined,
    DEEPSEEK_API_KEY: raw.DEEPSEEK_API_KEY as string | undefined,
    DB: raw.DB as D1Database | undefined,
  };
}

export function getEnv(c: Context): AppEnv {
  const env = (c.env ?? {}) as Record<string, unknown>;
  if (!process.env.JWT_SECRET_TEST_BYPASS) {
    return parseEnv(env);
  }
  return parseEnv({ ...env, JWT_SECRET: process.env.JWT_SECRET_TEST_BYPASS });
}
