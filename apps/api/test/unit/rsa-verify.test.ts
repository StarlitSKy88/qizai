// apps/api/test/unit/rsa-verify.test.ts
//
// Unit tests for apps/api/src/utils/rsa-verify.ts
// T01 — pemToDer: PEM string → DER bytes for crypto.subtle.importKey('spki', ...)

import { describe, it, expect } from 'vitest';
import { pemToDer } from '../../src/utils/rsa-verify';

describe('pemToDer', () => {
  it('decodes a multi-line PEM with newlines', () => {
    const pem =
      '-----BEGIN PUBLIC KEY-----\n' +
      'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAESF8=\n' +
      '-----END PUBLIC KEY-----';
    const der = pemToDer(pem);
    // MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAESF8= decodes to 29 bytes (SPKI header + 2 content bytes)
    expect(der.byteLength).toBe(29);
  });

  it('strips CRLF line endings', () => {
    const pem =
      '-----BEGIN PUBLIC KEY-----\r\n' +
      'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAESF8=\r\n' +
      '-----END PUBLIC KEY-----\r\n';
    const der = pemToDer(pem);
    expect(der.byteLength).toBe(29);
  });

  it('handles single-line PEM', () => {
    const pem =
      '-----BEGIN PUBLIC KEY-----MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAESF8=-----END PUBLIC KEY-----';
    const der = pemToDer(pem);
    expect(der.byteLength).toBe(29);
  });

  it('throws when BEGIN header is missing', () => {
    const pem = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAESF8=';
    expect(() => pemToDer(pem)).toThrow(/BEGIN.*header/i);
  });

  it('throws when END header is missing', () => {
    const pem = '-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAESF8=';
    expect(() => pemToDer(pem)).toThrow(/END.*header/i);
  });

  it('throws on empty string', () => {
    expect(() => pemToDer('')).toThrow(/empty/i);
  });
});
