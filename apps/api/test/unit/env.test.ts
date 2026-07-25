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

  it('parses all WXPAY_* fields when fully configured', () => {
    const env = parseEnv({
      NODE_ENV: 'test',
      JWT_SECRET: 'secret',
      WXPAY_MCH_ID: '1234567890',
      WXPAY_API_KEY_V3: 'wxpay-key-32chars-aaaaaaaaaaaa',
      WXPAY_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nMIIE...',
      WXPAY_PLATFORM_CERT: '-----BEGIN CERTIFICATE-----\nMIID...',
      WXPAY_CERT_SERIAL: 'ABC123',
      WXPAY_NOTIFY_URL: 'https://api.qizai.app/api/checkout/callback',
      WXPAY_USE_SANDBOX: 'true',
    });
    expect(env.WXPAY_MCH_ID).toBe('1234567890');
    expect(env.WXPAY_API_KEY_V3).toBe('wxpay-key-32chars-aaaaaaaaaaaa');
    expect(env.WXPAY_USE_SANDBOX).toBe(true);
    expect(env.WXPAY_NOTIFY_URL).toBe('https://api.qizai.app/api/checkout/callback');
  });

  it('treats WXPAY_USE_SANDBOX=false as production', () => {
    const env = parseEnv({
      NODE_ENV: 'test',
      JWT_SECRET: 'secret',
      WXPAY_USE_SANDBOX: 'false',
    });
    expect(env.WXPAY_USE_SANDBOX).toBe(false);
  });

  it('defaults WXPAY_USE_SANDBOX to false when unset (dev lazy-loaded)', () => {
    const env = parseEnv({ NODE_ENV: 'test', JWT_SECRET: 'secret' });
    expect(env.WXPAY_USE_SANDBOX).toBe(false);
    expect(env.WXPAY_MCH_ID).toBeUndefined();
  });
});

export type { AppEnv };
