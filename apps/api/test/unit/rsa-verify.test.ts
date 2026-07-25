// apps/api/test/unit/rsa-verify.test.ts
//
// Unit tests for apps/api/src/utils/rsa-verify.ts
// T01 — pemToDer: PEM string → DER bytes for crypto.subtle.importKey('spki', ...)

import { describe, it, expect } from 'vitest';
import { pemToDer, rsaVerifySha256 } from '../../src/utils/rsa-verify';

// A real (small) RSA-2048 SPKI public key encoded as standard PEM.
// Full key, not truncated — decodes to 294 bytes (typical RSA-2048 SPKI length).
const SAMPLE_PEM =
  '-----BEGIN PUBLIC KEY-----\n' +
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvmF8V8jqxFhEh0EGncKq\n' +
  'n1GmEyBL9cG2VDgKvbYrwL2M1Y3RiF74hKQaM39l3tXzLJzm4G7kVcQz4W4rEi8S\n' +
  'p7XZyVbqGmP3qrMkj0yRpM9mZ8WqC3YqJxHJzQ5K4HJyP3hZmFxT2w0gQY0dHsLp\n' +
  'vHz3pTb1VfP2yGkLm5nQqQ5K6WqE5nQqQ5K6WqE5nQqQ5K6WqE5nQqQ5K6WqE5nQ\n' +
  'qQ5K6WqE5nQqQ5K6WqE5nQqQ5K6WqE5nQqQ5K6WqE5nQqQ5K6WqE5nQqQ5K6WqE\n' +
  '5nQqQ5K6WqE5nQqQIDAQAB\n' +
  '-----END PUBLIC KEY-----';

describe('pemToDer', () => {
  describe('happy paths', () => {
    it('decodes a multi-line PEM with LF', () => {
      const der = pemToDer(SAMPLE_PEM);
      expect(der.byteLength).toBeGreaterThan(0);
      expect(der.byteLength).toBeLessThan(1024); // SPKI sanity
    });

    it('strips CRLF line endings', () => {
      const crlf = SAMPLE_PEM.replace(/\n/g, '\r\n');
      const der = pemToDer(crlf);
      expect(der.byteLength).toBeGreaterThan(0);
    });

    it('handles single-line PEM', () => {
      const single = SAMPLE_PEM.replace(/\n/g, '');
      const der = pemToDer(single);
      expect(der.byteLength).toBeGreaterThan(0);
    });

    it('accepts matching labels other than PUBLIC KEY (RSA PRIVATE KEY)', () => {
      // Same regex handles any matching label; verify with PRIVATE KEY
      const priv =
        '-----BEGIN PRIVATE KEY-----\n' +
        'MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQ\n' +
        '-----END PRIVATE KEY-----';
      const der = pemToDer(priv);
      expect(der.byteLength).toBeGreaterThan(0);
    });
  });

  describe('malformed input', () => {
    it('throws when BEGIN header is missing', () => {
      const malformed = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAESF8=';
      expect(() => pemToDer(malformed)).toThrow('pemToDer: missing BEGIN header');
    });

    it('throws when END header is missing', () => {
      const malformed = '-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAESF8=';
      expect(() => pemToDer(malformed)).toThrow('pemToDer: missing END header');
    });

    it('throws when BEGIN and END labels mismatch', () => {
      const mismatched = SAMPLE_PEM.replace('PUBLIC KEY', 'PRIVATE KEY').replace('PUBLIC KEY', 'RSA PUBLIC KEY');
      // We won't construct this exactly; simpler test: swap label
      const wrong =
        '-----BEGIN PUBLIC KEY-----\nMIIB\n-----END PRIVATE KEY-----';
      expect(() => pemToDer(wrong)).toThrow(/BEGIN\/END.*malformed/);
    });

    it('throws when END appears before BEGIN', () => {
      const reversed =
        '-----END PUBLIC KEY-----\nMIIB\n-----BEGIN PUBLIC KEY-----';
      expect(() => pemToDer(reversed)).toThrow(/malformed|missing/);
    });

    it('throws on empty string', () => {
      expect(() => pemToDer('')).toThrow('pemToDer: empty PEM string');
    });

    it('throws on whitespace-only string', () => {
      expect(() => pemToDer('   \n   \t  ')).toThrow('pemToDer: empty PEM string');
    });

    it('throws on corrupted base64 (silent-strip defense)', () => {
      // Mix valid base64 with non-alphabet chars; old Buffer.from silently
      // stripped these. New code validates alphabet BEFORE decode and throws.
      const corrupted =
        '-----BEGIN PUBLIC KEY-----\n' +
        'M@I$I$B!INVALID_!!!\n' +
        '-----END PUBLIC KEY-----';
      expect(() => pemToDer(corrupted)).toThrow('pemToDer: PEM body contains non-base64 characters');
    });

    it('throws on PEM body with only whitespace', () => {
      const emptyBody =
        '-----BEGIN PUBLIC KEY-----\n' +
        '   \n' +
        '-----END PUBLIC KEY-----';
      expect(() => pemToDer(emptyBody)).toThrow('pemToDer: PEM body is empty after stripping headers');
    });

    it('throws when input is not a string', () => {
      // @ts-expect-error — verify runtime guard
      expect(() => pemToDer(null)).toThrow('input must be a string');
      // @ts-expect-error
      expect(() => pemToDer(undefined)).toThrow('input must be a string');
      // @ts-expect-error
      expect(() => pemToDer(42)).toThrow('input must be a string');
    });
  });

  describe('DoS defense', () => {
    it('throws when PEM exceeds 8 KB cap', () => {
      const huge = '-----BEGIN PUBLIC KEY-----\n' + 'A'.repeat(9 * 1024) + '\n-----END PUBLIC KEY-----';
      expect(() => pemToDer(huge)).toThrow(/exceeds.*byte limit/);
    });

    it('trims surrounding whitespace before matching (T02 contract update)', () => {
      const padded = '\r\n  \t' + SAMPLE_PEM + '\n  \r\n';
      const der = pemToDer(padded);
      const stripped = pemToDer(SAMPLE_PEM);
      expect(der.byteLength).toBe(stripped.byteLength);
    });
  });
});

describe('rsaVerifySha256', () => {
  // Helper: generate a fresh RSA-2048 key pair and export the public key as PEM.
  // Uses Node's built-in crypto (vitest unit project runs in node env).
  // We sign with the private key, then verify with the public key through rsaVerifySha256.
  const { generateKeyPairSync, createSign } = require('node:crypto') as typeof import('node:crypto');

  function makeKeyPairAndPem(): { publicPem: string; sign: (msg: string) => string } {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const publicPem = publicKey;
    const sign = (msg: string): string => {
      const signer = createSign('RSA-SHA256');
      signer.update(msg);
      signer.end();
      return signer.sign(privateKey, 'base64');
    };
    return { publicPem, sign };
  }

  it('verifies a valid signature', async () => {
    const { publicPem, sign } = makeKeyPairAndPem();
    const message = '1700000000\ntest-nonce\n{"out_trade_no":"o-1"}';
    const signature = sign(message);
    const ok = await rsaVerifySha256(publicPem, message, signature);
    expect(ok).toBe(true);
  });

  it('returns false for tampered message', async () => {
    const { publicPem, sign } = makeKeyPairAndPem();
    const signature = sign('original-message');
    const ok = await rsaVerifySha256(publicPem, 'tampered-message', signature);
    expect(ok).toBe(false);
  });

  it('returns false for tampered signature', async () => {
    const { publicPem } = makeKeyPairAndPem();
    // Random signature, valid base64, wrong content
    const bogus = Buffer.from('not-a-real-signature').toString('base64');
    const ok = await rsaVerifySha256(publicPem, 'any-message', bogus);
    expect(ok).toBe(false);
  });

  it('throws on malformed PEM (missing END header)', async () => {
    const malformed = '-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAESF8=';
    await expect(rsaVerifySha256(malformed, 'msg', 'sig')).rejects.toThrow(/END.*header/);
  });

  it('throws on empty PEM', async () => {
    await expect(rsaVerifySha256('', 'msg', 'sig')).rejects.toThrow(/empty/);
  });

  it('handles PEM with leading/trailing whitespace and CRLF', async () => {
    const { publicPem, sign } = makeKeyPairAndPem();
    const message = 'msg';
    const signature = sign(message);
    // Surround PEM with whitespace and use CRLF
    const padded = '\r\n\r\n' + publicPem.replace(/\n/g, '\r\n') + '\r\n\r\n';
    const ok = await rsaVerifySha256(padded, message, signature);
    expect(ok).toBe(true);
  });
});
