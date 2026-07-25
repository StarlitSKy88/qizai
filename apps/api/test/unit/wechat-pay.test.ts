// apps/api/test/unit/wechat-pay.test.ts
//
// T03: wechat-pay.ts core primitives.
// - signV3: deterministic lowercase hex HMAC-SHA256 (now reads env.WXPAY_API_KEY_V3)
// - verifyCallbackSignature: PKCS#1 v1.5 + SHA-256 RSA verification via
//   crypto.subtle (v0.15.1+); TEST_ sandbox bypass preserved for tests
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

describe('wechat-pay.verifyCallbackSignature', () => {
  // CI lock: v0.15.1 replaces the WXPAY_VERIFY_NOT_IMPLEMENTED stub with
  // real RSA-PKCS1-v1_5 + SHA-256 verification. The TEST_ sandbox bypass
  // is preserved for integration tests; production paths now return false
  // on invalid signature instead of throwing.

  // Real PEM fixture (generated once, valid RSA-2048 SPKI key). We pass this
  // as WXPAY_PLATFORM_CERT so the prod path can attempt verification.
  // In tests where signature is invalid (e.g., tampered), expect false.
  // The actual PEM bytes don't matter for the negative tests below — any
  // valid SPKI will fail verification against a bogus signature, and any
  // invalid PEM is rejected by pemToDer before reaching verify.
  const VALID_PEM = '-----BEGIN PUBLIC KEY-----\n' +
    'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAESF8DqHc2TzZxJ+xX40d7P1V3\n' +
    'cHJqZHJvc2tldHNlY3JldGtleXdpdGhvdXRwYWRkaW5nMTIzNDU2Nzg5MA==\n' +
    '-----END PUBLIC KEY-----';

  // generate a real key pair once and reuse the public key in tests where
  // we want a "real cert" path. Use Node crypto in unit env.
  const { generateKeyPairSync } = require('node:crypto') as typeof import('node:crypto');
  const { publicKey: REAL_PEM, privateKey: REAL_PRIV } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  it('bypasses on TEST_ serial in sandbox (test fixture path)', async () => {
    const ok = await verifyCallbackSignature(
      't', 'n', 'b', 'sig', 'TEST_anything',
      { WXPAY_USE_SANDBOX: true, WXPAY_PLATFORM_CERT: REAL_PEM },
    );
    expect(ok).toBe(true);
  });

  it('returns false on TEST_ serial in prod (no TEST bypass outside sandbox)', async () => {
    const ok = await verifyCallbackSignature(
      't', 'n', 'b', 'sig', 'TEST_anything',
      { WXPAY_USE_SANDBOX: false, WXPAY_PLATFORM_CERT: REAL_PEM },
    );
    expect(ok).toBe(false);
  });

  it('returns false on real serial with invalid signature in prod', async () => {
    const ok = await verifyCallbackSignature(
      't', 'n', 'b', 'invalid-sig-base64',
      'WXPAY_REAL_SERIAL_12345',
      { WXPAY_USE_SANDBOX: false, WXPAY_PLATFORM_CERT: REAL_PEM },
    );
    expect(ok).toBe(false);
  });

  it('returns false on real serial with invalid signature in sandbox', async () => {
    // Sandbox bypass is only for TEST_ serials; real-shape serials still
    // attempt verification, which fails on bogus signature.
    const ok = await verifyCallbackSignature(
      't', 'n', 'b', 'invalid-sig-base64',
      'WXPAY_REAL_SERIAL_12345',
      { WXPAY_USE_SANDBOX: true, WXPAY_PLATFORM_CERT: REAL_PEM },
    );
    expect(ok).toBe(false);
  });

  it('throws WXPAY_PLATFORM_CERT_MISSING when cert is undefined in prod', async () => {
    await expect(
      verifyCallbackSignature(
        't', 'n', 'b', 'sig',
        'WXPAY_REAL_SERIAL',
        { WXPAY_USE_SANDBOX: false }, // no WXPAY_PLATFORM_CERT
      ),
    ).rejects.toThrow('WXPAY_PLATFORM_CERT_MISSING');
  });

  it('throws WXPAY_PLATFORM_CERT_MISSING when cert is undefined in sandbox (real serial)', async () => {
    // Sandbox bypass only applies to TEST_ serials; real-shape serials need
    // the cert. Missing cert should throw loudly, not return false.
    await expect(
      verifyCallbackSignature(
        't', 'n', 'b', 'sig',
        'WXPAY_REAL_SERIAL',
        { WXPAY_USE_SANDBOX: true },
      ),
    ).rejects.toThrow('WXPAY_PLATFORM_CERT_MISSING');
  });

  it('round-trips a valid signature through real RSA keys', async () => {
    // End-to-end: sign with the matching REAL_PRIV and verify through the
    // production code path (not the TEST_ bypass). Must use the SAME key
    // pair — generating a fresh pair here would sign with a private key
    // whose public half doesn't match REAL_PEM, and verify would correctly
    // return false (a key-confusion test in disguise).
    const { createSign } = require('node:crypto') as typeof import('node:crypto');
    const message = '1700000000\nnonce-xyz\n{"out_trade_no":"o-1"}\n';
    const signer = createSign('RSA-SHA256');
    signer.update(message);
    signer.end();
    const signature = signer.sign(REAL_PRIV, 'base64');
    const ok = await verifyCallbackSignature(
      '1700000000', 'nonce-xyz', '{"out_trade_no":"o-1"}',
      signature, 'WXPAY_REAL_SERIAL',
      { WXPAY_USE_SANDBOX: false, WXPAY_PLATFORM_CERT: REAL_PEM },
    );
    expect(ok).toBe(true);
  });
});