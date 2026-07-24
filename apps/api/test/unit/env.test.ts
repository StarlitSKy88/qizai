// apps/api/test/unit/env.test.ts
import { describe, it, expect } from 'vitest';
import { parseEnv, AppEnv } from '../../src/utils/env';

describe('parseEnv', () => {
  it('throws when JWT_SECRET missing', () => {
    expect(() => parseEnv({ NODE_ENV: 'test' })).toThrow('JWT_SECRET');
  });

  it('returns AppEnv when all required fields present', () => {
    const env = parseEnv({ NODE_ENV: 'test', JWT_SECRET: 'secret' });
    expect(env.JWT_SECRET).toBe('secret');
    expect(env.NODE_ENV).toBe('test');
  });

  it('defaults NODE_ENV to development', () => {
    const env = parseEnv({ JWT_SECRET: 'secret' });
    expect(env.NODE_ENV).toBe('development');
  });
});

export type { AppEnv };
