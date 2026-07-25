// apps/api/test/unit/wechat-pay.test.ts
//
// T03: wechat-pay.ts core primitives.
// - signV3: deterministic lowercase hex HMAC-SHA256 (now reads env.WXPAY_API_KEY_V3)
// - verifyCallbackSignature: stub returns false in dev; integration tests mock it
// - unifiedorderNative + queryOrderStatus: not exercised here (require fetch mock
//   in unit; integration tests in T05/T07 cover them with vi.mock)

import { describe, it, expect } from 'vitest';
import { signV3, verifyCallbackSignature } from '../../src/utils/wechat-pay';

const DEV_ENV = { WXPAY_API_KEY_V3: 'test-api-key-32-bytes-long-pad!!', WXPAY_USE_SANDBOX: true };

describe('wechat-pay.signV3', () => {
  it('produces 64-char lowercase hex', async () => {
    const sig = await signV3('POST', '/v3/pay/transactions/native', '{"foo":"bar"}', '1700000000', 'abc123', DEV_ENV);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for same input', async () => {
    const a = await signV3('POST', '/x', '{}', '1', 'n', DEV_ENV);
    const b = await signV3('POST', '/x', '{}', '1', 'n', DEV_ENV);
    expect(a).toBe(b);
  });

  it('differs by method', async () => {
    const base = await signV3('POST', '/x', '{}', '1', 'n', DEV_ENV);
    expect(await signV3('GET', '/x', '{}', '1', 'n', DEV_ENV)).not.toBe(base);
  });

  it('differs by urlPath', async () => {
    const base = await signV3('POST', '/x', '{}', '1', 'n', DEV_ENV);
    expect(await signV3('POST', '/y', '{}', '1', 'n', DEV_ENV)).not.toBe(base);
  });

  it('differs by body', async () => {
    const base = await signV3('POST', '/x', '{}', '1', 'n', DEV_ENV);
    expect(await signV3('POST', '/x', '{"a":1}', '1', 'n', DEV_ENV)).not.toBe(base);
  });

  it('differs by timestamp', async () => {
    const base = await signV3('POST', '/x', '{}', '1', 'n', DEV_ENV);
    expect(await signV3('POST', '/x', '{}', '2', 'n', DEV_ENV)).not.toBe(base);
  });

  it('differs by nonce', async () => {
    const base = await signV3('POST', '/x', '{}', '1', 'n', DEV_ENV);
    expect(await signV3('POST', '/x', '{}', '1', 'm', DEV_ENV)).not.toBe(base);
  });

  it('throws WXPAY_NOT_CONFIGURED when apiKey missing in prod', async () => {
    await expect(
      signV3('POST', '/x', '{}', '1', 'n', { WXPAY_API_KEY_V3: undefined, WXPAY_USE_SANDBOX: false }),
    ).rejects.toThrow('WXPAY_NOT_CONFIGURED');
  });

  it('falls back to 32-zero key when apiKey missing but sandbox enabled', async () => {
    const sig = await signV3('POST', '/x', '{}', '1', 'n', {
      WXPAY_API_KEY_V3: undefined,
      WXPAY_USE_SANDBOX: true,
    });
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('wechat-pay.verifyCallbackSignature prod/staging gate', () => {
  // CI lock: locks the prod bypass gate. If a future contributor removes
  // the env.WXPAY_USE_SANDBOX check (or short-circuits the function back
  // to "always return true"), these tests fail and force a manual review.
  const prodEnv = { WXPAY_USE_SANDBOX: false };
  const sandboxEnv = { WXPAY_USE_SANDBOX: true };

  it('bypasses on TEST_ serial in sandbox (test fixture path)', async () => {
    const ok = await verifyCallbackSignature('t', 'n', 'b', 'sig', 'TEST_anything', sandboxEnv);
    expect(ok).toBe(true);
  });

  it('throws WXPAY_VERIFY_NOT_IMPLEMENTED on TEST_ serial in prod', async () => {
    // v0.15.0: prod path is a stub. We MUST throw loudly so a prod deploy
    // that bypassed the sandbox gate surfaces immediately rather than
    // silently rejecting every real WXPay callback (revenue impact).
    await expect(
      verifyCallbackSignature('t', 'n', 'b', 'sig', 'TEST_anything', prodEnv),
    ).rejects.toThrow('WXPAY_VERIFY_NOT_IMPLEMENTED');
  });

  it('throws WXPAY_VERIFY_NOT_IMPLEMENTED on real serial in prod', async () => {
    await expect(
      verifyCallbackSignature('t', 'n', 'b', 'sig', 'WXPAY_REAL_SERIAL_12345', prodEnv),
    ).rejects.toThrow('WXPAY_VERIFY_NOT_IMPLEMENTED');
  });

  it('throws WXPAY_VERIFY_NOT_IMPLEMENTED on real serial in sandbox', async () => {
    // Real serial in sandbox: still a stub. The bypass only covers TEST_
    // sentinels; production-shape serials need the real RSA verifier.
    await expect(
      verifyCallbackSignature('t', 'n', 'b', 'sig', 'WXPAY_REAL_SERIAL_12345', sandboxEnv),
    ).rejects.toThrow('WXPAY_VERIFY_NOT_IMPLEMENTED');
  });
});