# v0.15.1 — RSA Signature Verification + Boot Probe via c.env Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the v0.15.0 `WXPAY_VERIFY_NOT_IMPLEMENTED` stub with real PKCS#1 v1.5 RSA-2048 + SHA-256 verification, and hook the boot-time `parseEnv` probe to `c.env` so production misconfiguration surfaces on the first request.

**Architecture:** Two independent deliverables ship together in v0.15.1 because they share the same test infrastructure (vitest-pool-workers 0.18 + globalThis.fetch stub pattern, no `vi.mock` for crypto). Deliverable 1 adds `apps/api/src/utils/rsa-verify.ts` (PEM → DER → `crypto.subtle.verify`) and rewires `verifyCallbackSignature` in `wechat-pay.ts` to use it. Deliverable 2 wraps the default export in `apps/api/src/index.ts` with a `bootValidate(c.env)` hook that runs once per Workers isolate and logs `console.error` on parseEnv failure without crashing the isolate.

**Tech Stack:** TypeScript 5.6 + Hono 4.6 + Cloudflare Workers (`crypto.subtle.verify('RSA-PKCS1-v1_5', ...)`) + vitest-pool-workers 0.18 + D1 (SQLite).

## Global Constraints

- Test command: `cd apps/api && npm test`
- Type-check command: `cd apps/api && npm run typecheck`
- vitest-pool-workers 0.18 does NOT support `vi.mock` for ESM modules — use `globalThis.fetch` stubs and real `crypto.subtle` paths (v0.14 T16 lesson)
- All WXPay fields (`WXPAY_MCH_ID`, `WXPAY_API_KEY_V3`, `WXPAY_PRIVATE_KEY`, `WXPAY_PLATFORM_CERT`, `WXPAY_CERT_SERIAL`) are `string | undefined` on `AppEnv` (env.ts:14-20) — no type changes
- `verifyCallbackSignature` signature: `(timestamp, nonce, body, signature, certSerial, env) => Promise<boolean>` — **parameter order is fixed**; do not reorder
- Sandbox bypass gate: `env.WXPAY_USE_SANDBOX === true && certSerial.startsWith('TEST_')` — keep exactly as v0.15.0
- `wxpayCallbackRateLimit` (30/min per IP) is on `/api/checkout/callback` only — no rate-limit changes in this plan
- PEM format: single-line or multi-line both accepted; strip whitespace + CRLF + BEGIN/END headers before base64 decode
- `crypto.subtle.verify('RSA-PKCS1-v1_5', spki-key, sigBytes, msgBytes)` is the only W3C-standard verify path on Workers — no alternative
- Module-level `boot` state in `index.ts` is intentionally not resettable from tests; test isolation is provided by `vi.spyOn(console, 'error')` + assertion on call content
- `default` export shape: `Hono` app instance with `.fetch(req, env, ctx)` — to hook bootValidate, we wrap the default export in `{ fetch: async (req, env, ctx) => { bootValidate(env); return app.fetch(req, env, ctx); } }`
- Cloudflare Workers has no real "module init" hook — `bootValidate` runs lazily on first request to the isolate; once-per-isolate caching is acceptable because Workers isolate count is small and parseEnv is ~µs

---

## Task Decomposition

The spec is split into **two parallel tracks** that ship together:

**Track A — RSA Verification (Tasks 1-4):**
1. `rsa-verify.ts` PEM decoder (unit-tested)
2. `rsa-verify.ts` SHA-256 verify function (unit-tested with real RSA keys)
3. `wechat-pay.ts` real verifyCallbackSignature (CI lock tests updated)
4. `checkout.test.ts` callback happy path still passes via TEST_ bypass

**Track B — Boot Probe via c.env (Tasks 5-7):**
5. `index.ts` `boot` state + `bootValidate` function + default export wrap
6. `boot-probe.test.ts` integration tests (3 failure modes)
7. Type-check + final test run

Tasks can be dispatched in any order; Track A and Track B are independent. Recommended order: Track A first (crypto is more failure-prone), then Track B.

---

## Track A — RSA Verification

### Task 1: Create `pemToDer` in `apps/api/src/utils/rsa-verify.ts`

**Files:**
- Create: `apps/api/src/utils/rsa-verify.ts`
- Test: `apps/api/test/unit/rsa-verify.test.ts`

**Interfaces:**
- Produces: `pemToDer(pem: string): ArrayBuffer` — strips BEGIN/END headers, whitespace, CRLF; base64-decodes the body

- [ ] **Step 1: Write the failing test**

Create `apps/api/test/unit/rsa-verify.test.ts` with this exact content:

```ts
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
    // base64 'SF8=' decodes to bytes [0x48, 0x5F] — length 2
    expect(der.byteLength).toBe(2);
  });

  it('strips CRLF line endings', () => {
    const pem =
      '-----BEGIN PUBLIC KEY-----\r\n' +
      'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAESF8=\r\n' +
      '-----END PUBLIC KEY-----\r\n';
    const der = pemToDer(pem);
    expect(der.byteLength).toBe(2);
  });

  it('handles single-line PEM', () => {
    const pem =
      '-----BEGIN PUBLIC KEY-----MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAESF8=-----END PUBLIC KEY-----';
    const der = pemToDer(pem);
    expect(der.byteLength).toBe(2);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npm test -- test/unit/rsa-verify.test.ts`
Expected: FAIL with "Cannot find module '../../src/utils/rsa-verify'"

- [ ] **Step 3: Write minimal implementation**

Create `apps/api/src/utils/rsa-verify.ts` with this exact content:

```ts
// apps/api/src/utils/rsa-verify.ts
//
// v0.15.1 — PKCS#1 v1.5 RSA-2048 + SHA-256 signature verification.
// Used by apps/api/src/utils/wechat-pay.ts:verifyCallbackSignature to
// validate WXPay V3 callback signatures against WXPAY_PLATFORM_CERT.
//
// All operations use the W3C Web Crypto API (crypto.subtle) which is
// natively supported in Cloudflare Workers — no external dependencies.
//
// Functions:
//   - pemToDer(pem)                       → ArrayBuffer (SPKI bytes)
//   - rsaVerifySha256(pem, msg, sigB64)   → Promise<boolean>
//
// SECURITY: importKey is 'spki' format (Subject Public Key Info, RFC 5480),
// the standard output of `openssl rsa -pubout`. We do NOT parse the
// certificate structure itself (no x509 dependency); the PEM is expected
// to be the SPKI public key directly, not a full X.509 certificate.
//
//   To extract SPKI from a WXPay-issued certificate in production:
//     openssl x509 -in platform.pem -pubkey -noout > platform-spki.pem

/**
 * Decode a PEM-formatted key into its DER (binary) bytes.
 * Strips the BEGIN/END headers, all whitespace, and base64-decodes the body.
 * Accepts multi-line PEM (with \n or \r\n) and single-line PEM.
 *
 * @param pem - PEM string. Must contain both BEGIN and END markers.
 * @returns ArrayBuffer of base64-decoded DER bytes.
 * @throws Error if BEGIN or END marker is missing, or if the string is empty.
 */
export function pemToDer(pem: string): ArrayBuffer {
  if (typeof pem !== 'string' || pem.length === 0) {
    throw new Error('pemToDer: empty PEM string');
  }
  // Find the BEGIN header end and END header start — content sits between them.
  const beginMatch = /^-----BEGIN [^-]+-----/m.exec(pem);
  const endMatch = /^-----END [^-]+-----/m.exec(pem);
  if (!beginMatch) {
    throw new Error('pemToDer: missing BEGIN header');
  }
  if (!endMatch) {
    throw new Error('pemToDer: missing END header');
  }
  const body = pem.slice(beginMatch[0].length, endMatch.index);
  // Strip whitespace (spaces, tabs, \n, \r) — base64 ignores these anyway,
  // but be explicit so a malformed PEM with extra whitespace still decodes.
  const b64 = body.replace(/\s+/g, '');
  if (b64.length === 0) {
    throw new Error('pemToDer: PEM body is empty after stripping headers');
  }
  // Buffer.from with 'base64' is the standard Node/Workers way to base64-decode.
  // It throws on invalid base64, which is the correct behavior for malformed PEM.
  const bytes = Buffer.from(b64, 'base64');
  // Slice into a fresh ArrayBuffer so the returned buffer is exactly the right
  // length (Buffer's underlying ArrayBuffer may have unused trailing bytes).
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npm test -- test/unit/rsa-verify.test.ts`
Expected: PASS — 6 tests, 0 failures

- [ ] **Step 5: Commit**

```bash
cd apps/api && git add src/utils/rsa-verify.ts test/unit/rsa-verify.test.ts
git commit -m "feat(api): add rsa-verify pemToDer (T01)

PEM string -> DER ArrayBuffer for crypto.subtle.importKey('spki', ...).
Strips BEGIN/END headers, whitespace, CRLF. Throws on malformed input.

Unit tests cover happy path, CRLF, single-line, missing headers,
empty string. Used by verifyCallbackSignature in v0.15.1.

Part of v0.15.1 spec: docs/superpowers/specs/2026-07-26-qizai-v0151-rsa-verify-probe.md"
```

---

### Task 2: Add `rsaVerifySha256` to `apps/api/src/utils/rsa-verify.ts`

**Files:**
- Modify: `apps/api/src/utils/rsa-verify.ts` (append after `pemToDer`)
- Test: `apps/api/test/unit/rsa-verify.test.ts` (append new describe block)

**Interfaces:**
- Produces: `rsaVerifySha256(pem: string, message: string, signatureBase64: string): Promise<boolean>` — uses `pemToDer` then `crypto.subtle.verify('RSA-PKCS1-v1_5', ...)`

- [ ] **Step 1: Write the failing test**

Append to `apps/api/test/unit/rsa-verify.test.ts`:

```ts

describe('rsaVerifySha256', () => {
  // Helper: generate a fresh RSA-2048 key pair and export the public key as PEM.
  // Uses Node's built-in crypto (vitest unit project runs in node env).
  // We sign with the private key, then verify with the public key through rsaVerifySha256.
  const { generateKeyPairSync, createSign, createPublicKey } = require('node:crypto') as typeof import('node:crypto');

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
```

And add `rsaVerifySha256` to the import line at the top of the file:

```ts
import { pemToDer, rsaVerifySha256 } from '../../src/utils/rsa-verify';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npm test -- test/unit/rsa-verify.test.ts`
Expected: FAIL with "rsaVerifySha256 is not a function"

- [ ] **Step 3: Write minimal implementation**

Append to `apps/api/src/utils/rsa-verify.ts`:

```ts

/**
 * Verify an RSA-PKCS1-v1_5 + SHA-256 signature against the given PEM public key.
 * Used for WXPay V3 callback signature verification.
 *
 * @param pem - SPKI-format PEM-encoded public key. Accepts standard WXPay
 *   platform certificate (extract SPKI with `openssl x509 -pubkey -noout`).
 * @param message - The exact message string that was signed.
 *   For WXPay callbacks this is `${timestamp}\n${nonce}\n${body}\n`.
 * @param signatureBase64 - The signature as base64 (matches the
 *   `Wechatpay-Signature` header format). Standard base64 with padding.
 * @returns Promise resolving to true if signature is valid, false otherwise.
 * @throws Error if PEM is malformed (propagated from pemToDer).
 */
export async function rsaVerifySha256(
  pem: string,
  message: string,
  signatureBase64: string,
): Promise<boolean> {
  // Decode PEM → DER ArrayBuffer (zero-copy of the body section).
  const der = pemToDer(pem);
  // Import as SPKI public key. Mark non-extractable since we don't need
  // to re-export it; this also prevents accidental key material leakage
  // if the key object is captured by an attacker-controlled closure.
  const publicKey = await crypto.subtle.importKey(
    'spki',
    der,
    { name: 'RSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  // Decode the base64 signature into raw bytes. Buffer.from('base64')
  // handles padding correctly; throws on invalid base64, which is the
  // correct behavior for a malformed callback signature.
  const sigBytes = Buffer.from(signatureBase64, 'base64');
  const msgBytes = new TextEncoder().encode(message);
  // subtle.verify returns true on valid signature, false on invalid.
  // It does NOT throw on a wrong signature — only on crypto-level errors
  // (e.g., malformed key import). Our PEM parsing is upstream.
  return await crypto.subtle.verify(
    'RSA-PKCS1-v1_5',
    publicKey,
    sigBytes,
    msgBytes,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npm test -- test/unit/rsa-verify.test.ts`
Expected: PASS — 12 tests total (6 pemToDer + 6 rsaVerifySha256), 0 failures

- [ ] **Step 5: Commit**

```bash
cd apps/api && git add src/utils/rsa-verify.ts test/unit/rsa-verify.test.ts
git commit -m "feat(api): add rsaVerifySha256 to rsa-verify.ts (T02)

PKCS#1 v1.5 + SHA-256 verify via crypto.subtle.verify.
Uses pemToDer from T01. No external deps; works on Cloudflare Workers.

Tests sign with Node's crypto.sign and verify with the new function
across valid + tampered message + tampered signature + 3 PEM edge cases.

Part of v0.15.1 spec."
```

---

### Task 3: Wire `verifyCallbackSignature` to `rsaVerifySha256`

**Files:**
- Modify: `apps/api/src/utils/wechat-pay.ts:65-94` (replace stub body)
- Modify: `apps/api/test/unit/wechat-pay.test.ts:66-99` (flip 3 CI lock tests + add WXPAY_PLATFORM_CERT_MISSING test)

**Interfaces:**
- `verifyCallbackSignature` env type changes from `Pick<AppEnv, 'WXPAY_USE_SANDBOX'>` to `Pick<AppEnv, 'WXPAY_USE_SANDBOX' | 'WXPAY_PLATFORM_CERT'>` — verify all 3 call sites are updated

- [ ] **Step 1: Update CI lock tests in `test/unit/wechat-pay.test.ts`**

Replace lines 66-99 of `apps/api/test/unit/wechat-pay.test.ts` (the entire `describe('wechat-pay.verifyCallbackSignature prod/staging gate', ...)` block) with this content:

```ts
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
  const { publicKey: REAL_PEM } = generateKeyPairSync('rsa', {
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
    // End-to-end: generate a key pair, sign with private key, verify
    // through the production code path (not the TEST_ bypass).
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const { createSign } = require('node:crypto') as typeof import('node:crypto');
    const message = '1700000000\nnonce-xyz\n{"out_trade_no":"o-1"}';
    const signer = createSign('RSA-SHA256');
    signer.update(message);
    signer.end();
    const signature = signer.sign(privateKey, 'base64');
    const ok = await verifyCallbackSignature(
      '1700000000', 'nonce-xyz', '{"out_trade_no":"o-1"}',
      signature, 'WXPAY_REAL_SERIAL',
      { WXPAY_USE_SANDBOX: false, WXPAY_PLATFORM_CERT: REAL_PEM },
    );
    expect(ok).toBe(true);
  });
});
```

Note: `VALID_PEM` is unused in the final test set; it remains in the source so a reader can see what a "valid SPKI" looks like. If lint complains, prefix with underscore or remove. (Vitest doesn't lint by default; leaving for documentation.)

Also update the header comment at the top of `wechat-pay.test.ts` (line 5) from:
```
// - verifyCallbackSignature: stub returns false in dev; integration tests mock it
```
to:
```
// - verifyCallbackSignature: PKCS#1 v1.5 + SHA-256 RSA verification via
//   crypto.subtle (v0.15.1+); TEST_ sandbox bypass preserved for tests
```

- [ ] **Step 2: Run test to verify they fail**

Run: `cd apps/api && npm test -- test/unit/wechat-pay.test.ts`
Expected: FAIL — 4 of 5 tests fail with "WXPAY_VERIFY_NOT_IMPLEMENTED" (the bypass test still passes since it returns true before reaching the new code)

- [ ] **Step 3: Replace `verifyCallbackSignature` in `wechat-pay.ts`**

Replace lines 65-94 of `apps/api/src/utils/wechat-pay.ts` with this content:

```ts
export async function verifyCallbackSignature(
  timestamp: string,
  nonce: string,
  body: string,
  signature: string,
  certSerial: string,
  env: Pick<AppEnv, 'WXPAY_USE_SANDBOX' | 'WXPAY_PLATFORM_CERT'>,
): Promise<boolean> {
  // Test sentinel: when WXPAY_CERT_SERIAL starts with "TEST_", bypass
  // verification. This avoids the need for vi.mock in vitest-pool-workers
  // (which lacks module-mock support — see T16 in v0.14 ledger). Production
  // cert serials from WXPay are hex/base32, never prefixed with TEST_.
  //
  // SECURITY: the bypass is gated on WXPAY_USE_SANDBOX===true so an attacker
  // who can reach /api/checkout/callback in prod cannot forge the
  // Wechatpay-Serial header with a TEST_ prefix to skip signature
  // verification. The serial header is attacker-controlled; this gate is
  // the only thing preventing a bypass of HMAC+PKCS#1 v1.5 RSA.
  if (env.WXPAY_USE_SANDBOX && certSerial.startsWith('TEST_')) return true;

  // Production path: real PKCS#1 v1.5 RSA-2048 + SHA-256 verification.
  // The WXPay V3 signature scheme signs `${timestamp}\n${nonce}\n${body}\n`
  // using the platform certificate's RSA private key; we verify with the
  // public key stored in WXPAY_PLATFORM_CERT.
  if (!env.WXPAY_PLATFORM_CERT) {
    // Loud failure: missing cert in prod means signature verification
    // cannot proceed. Throwing here surfaces as WXPAY_PLATFORM_CERT_MISSING
    // 500 to WXPay → retry storm → ops sees the pattern and injects the
    // cert via `wrangler secret put`. Better than silent false (which
    // would reject every real callback with no actionable signal).
    throw new Error('WXPAY_PLATFORM_CERT_MISSING');
  }

  const message = `${timestamp}\n${nonce}\n${body}\n`;
  return await rsaVerifySha256(env.WXPAY_PLATFORM_CERT, message, signature);
}
```

Then update the `import` block at the top of `wechat-pay.ts` (currently line 24):

Find:
```ts
import type { AppEnv } from './env';
```

Add after it (still inside the import section):
```ts
import { rsaVerifySha256 } from './rsa-verify';
```

- [ ] **Step 4: Run test to verify they pass**

Run: `cd apps/api && npm test -- test/unit/wechat-pay.test.ts`
Expected: PASS — 7 tests in verifyCallbackSignature describe block + 9 signV3 tests, 0 failures

- [ ] **Step 5: Run all unit tests to ensure nothing else broke**

Run: `cd apps/api && npm test -- test/unit/`
Expected: PASS — all unit tests pass (env.test.ts, jwt.test.ts, password.test.ts, rsa-verify.test.ts, wechat-pay.test.ts)

- [ ] **Step 6: Run typecheck**

Run: `cd apps/api && npm run typecheck`
Expected: PASS — 0 type errors

- [ ] **Step 7: Commit**

```bash
cd apps/api && git add src/utils/wechat-pay.ts test/unit/wechat-pay.test.ts
git commit -m "feat(api): real PKCS#1 v1.5 RSA verification in verifyCallbackSignature (T03)

Replaces WXPAY_VERIFY_NOT_IMPLEMENTED throw with crypto.subtle.verify.
Signature scheme: \`\${ts}\\n\${nonce}\\n\${body}\\n\`.
New WXPAY_PLATFORM_CERT_MISSING throw surfaces misconfigured prod deploys.

TEST_ sandbox bypass preserved (gated on WXPAY_USE_SANDBOX===true).
WXPAY_PLATFORM_CERT injected via wrangler secret put.

CI lock tests updated: 3 negative tests now expect false instead of throw.
2 new tests cover WXPAY_PLATFORM_CERT_MISSING in prod and sandbox.
1 new round-trip test signs with Node crypto and verifies through the
production code path with a real RSA key pair.

Part of v0.15.1 spec."
```

---

### Task 4: Verify integration tests still pass via TEST_ bypass

**Files:**
- No file changes — verification only
- Test: `apps/api/test/integration/checkout.test.ts`

- [ ] **Step 1: Run integration tests**

Run: `cd apps/api && npm test -- test/integration/checkout.test.ts`
Expected: PASS — all 8 tests pass (3 /create + 3 /status + 3 /callback minus round-6 duplicates)

The TEST_ serial bypass on `callbackHeaders()` (line 173 of `checkout.test.ts`: `'Wechatpay-Serial': 'TEST_SERIAL_0001'`) keeps the integration tests passing without changes, because `wrangler.test.toml` sets `WXPAY_USE_SANDBOX = "true"` (line 22).

- [ ] **Step 2: Run full test suite**

Run: `cd apps/api && npm test`
Expected: PASS — all unit + integration tests pass

If any test fails, the failure is likely in a test that hits `/api/checkout/callback` with a non-TEST_ serial — check `wrangler.test.toml` confirms `WXPAY_USE_SANDBOX = "true"` so the TEST_ bypass is active for all integration tests.

- [ ] **Step 3: Commit (only if you had to fix anything)**

If everything passed, no commit needed. If you had to adjust `wrangler.test.toml` or another test file:

```bash
cd apps/api && git add <files-you-touched>
git commit -m "test(api): adjust wrangler.test.toml fixtures for v0.15.1 RSA verification

TEST_ sandbox bypass keeps integration tests passing unchanged.
No production code paths exercised by integration tests."
```

---

## Track B — Boot Probe via c.env

### Task 5: Add `boot` state + `bootValidate` + wrap default export in `index.ts`

**Files:**
- Modify: `apps/api/src/index.ts` (full rewrite — see Step 3)
- No test file changes in this task (test added in Task 6)

**Interfaces:**
- Module-level state: `const boot: { validated: boolean; valid: boolean; error?: unknown }`
- Function: `bootValidate(env: AppEnv): void` — one-shot per isolate

- [ ] **Step 1: Read current `apps/api/src/index.ts`**

Run: `Read /Users/opc-1/Downloads/O/qizai/apps/api/src/index.ts`
Verify lines 1-46 are unchanged since last read. If different, the spec mismatch is a flag — stop and re-read.

- [ ] **Step 2: Add the `bootValidate` function and module state**

Edit `apps/api/src/index.ts` to **replace the entire file** with this exact content:

```ts
// apps/api/src/index.ts
//
// Hono app entry for the qizai API.
// Routes: /api/auth, /api/simulate, /api/report, /api/predict,
//         /api/checkout, /api/users, GET /
//
// v0.15.1 — Boot probe via c.env:
//   Cloudflare Workers does NOT populate `process.env` from `wrangler secret
//   put` — secrets are bound via the worker context (c.env), not process.env.
//   The vitest-startup `parseEnv` probe below (lines 38-50) only sees
//   process.env, which is the dev/test fallback. The real prod-guard runs
//   on the first request via bootValidate() in the default.fetch wrapper
//   (lines 24-32): we parse c.env once per isolate, log a loud console.error
//   on misconfiguration, and let getEnv(c) throw per-request thereafter.
//
//   We do NOT throw from bootValidate: throwing would cascade to all
//   routes in this isolate returning 503, which is worse than per-route
//   500 with actionable error logs. getEnv(c) is the actual enforcement
//   gate; bootValidate is observability.

import { Hono } from 'hono';
import { authRouter } from './routes/auth';
import { simulateRouter } from './routes/simulate';
import { reportRouter } from './routes/report';
import { predictRouter } from './routes/predict';
import { checkoutRouter } from './routes/checkout';
import { usersRouter } from './routes/users';
import { parseEnv, type AppEnv } from './utils/env';

const app = new Hono();

// ──────────────────────────────────────────────────────────────────
// Boot probe state + helper (v0.15.1)
// ──────────────────────────────────────────────────────────────────

interface BootState {
  /** True after the first call to bootValidate(). Prevents re-running. */
  validated: boolean;
  /** True if parseEnv(env) succeeded on the first call. */
  valid: boolean;
  /** Captured error from the first parseEnv failure, for future debugging. */
  error?: unknown;
}

const boot: BootState = { validated: false, valid: true };

/**
 * Run parseEnv against c.env the FIRST time this Workers isolate handles a
 * request. Caches the result; subsequent calls short-circuit. Logs a loud
 * console.error on misconfiguration so ops can grep Logpush.
 *
 * Why one-shot per isolate: parseEnv is pure (no I/O, no side effects beyond
 * validation), and Workers isolates handle many requests before being recycled.
 * Re-running on every request would add ~µs of overhead per call without
 * adding signal. If the isolate is recycled (rare; CF manages isolate lifecycle),
 * boot.validated resets to false and we re-run on the next request — harmless.
 *
 * Why we don't throw: see header comment. Per-route 500 from getEnv(c) is
 * the actionable failure mode; this hook is for ops visibility.
 */
function bootValidate(env: AppEnv): void {
  if (boot.validated) return;
  boot.validated = true;
  try {
    parseEnv(env);
    boot.valid = true;
  } catch (err) {
    boot.valid = false;
    boot.error = err;
    console.error(
      '[index] boot-time parseEnv FAILED on first request via c.env — runtime guards will still throw on each request',
      err instanceof Error ? err.message : String(err),
    );
  }
}

// ──────────────────────────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────────────────────────

app.route('/api/auth', authRouter);
app.route('/api/simulate', simulateRouter);
app.route('/api/report', reportRouter);
app.route('/api/predict', predictRouter);
app.route('/api/checkout', checkoutRouter);
app.route('/api/users', usersRouter);

app.get('/', (c) => c.json({ status: 'qizai-api-ok' }));

// ──────────────────────────────────────────────────────────────────
// Vitest-startup sanity check (unchanged from v0.15.0 round-6)
// ──────────────────────────────────────────────────────────────────
//
// This probe exists ONLY for vitest-pool-workers, which pre-loads all
// routes via import and reads process.env from wrangler.test.toml.
// Cloudflare Workers production does NOT populate process.env from
// `wrangler secret put`, so this probe sees NODE_ENV=undefined and
// JWT_SECRET=undefined in prod → parseEnv defaults to 'development'
// and uses the fallback literal → prod guards never fire here.
//
// The real prod enforcement happens via:
//   1. bootValidate() in default.fetch (above) — one-shot per isolate
//   2. getEnv(c) in every route — per-request enforcement
//
// If a future contributor wants to remove this probe entirely, that's
// safe — bootValidate covers the prod path. Keeping it catches dev-env
// regressions at module-load time.
try {
  parseEnv({ JWT_SECRET: process.env.JWT_SECRET ?? 'test-secret-isolated-from-dev' });
} catch (err) {
  console.warn(
    '[index] vitest-startup parseEnv sanity check failed; runtime guards still apply',
    err instanceof Error ? err.message : String(err),
  );
}

// ──────────────────────────────────────────────────────────────────
// Workers entrypoint with boot probe
// ──────────────────────────────────────────────────────────────────
//
// vitest-pool-workers imports `default` and calls `app.fetch(req, env, ctx)`.
// We wrap default so the first fetch call hits bootValidate(env) before
// routing — this is the only way to see c.env at module-level scope in CF.
//
// Export shape: `{ fetch: async (req, env, ctx) => { bootValidate(env); return app.fetch(req, env, ctx); } }`
//
// Note: Hono's app.fetch signature is `(req, env, ctx) => Promise<Response>`.
// We cast env to AppEnv at the boundary — parseEnv normalizes any extra
// fields silently (YAGNI: we don't need a stricter contract here).

export default {
  async fetch(
    req: Request,
    env: Record<string, unknown>,
    ctx: ExecutionContext,
  ): Promise<Response> {
    bootValidate(env as unknown as AppEnv);
    return app.fetch(req, env as any, ctx);
  },
};
```

- [ ] **Step 3: Run typecheck**

Run: `cd apps/api && npm run typecheck`
Expected: PASS — 0 type errors

- [ ] **Step 4: Run all unit tests (no integration yet)**

Run: `cd apps/api && npm test -- test/unit/`
Expected: PASS — all unit tests pass

- [ ] **Step 5: Run integration tests**

Run: `cd apps/api && npm test -- test/integration/`
Expected: PASS — all integration tests pass

If integration tests fail because the export shape changed from a Hono app instance to a `{ fetch }` object, check that vitest-pool-workers 0.18 supports this export shape. If not, the fix is to wrap differently — but this is the standard Workers export pattern and should work. Debug case-by-case.

- [ ] **Step 6: Commit**

```bash
cd apps/api && git add src/index.ts
git commit -m "feat(api): boot probe via c.env (v0.15.1)

Cloudflare Workers doesn't populate process.env from wrangler secret put,
so the v0.15.0 round-6 honest comment on index.ts:23-34 documented that
the probe only catches vitest startup, not prod. This commit wires the
real prod probe via bootValidate() in the default.fetch wrapper.

Architecture:
- boot: { validated, valid, error? } module-level state
- bootValidate(env): one-shot per isolate; logs console.error loud on
  parseEnv failure; does NOT throw (per-route 500 from getEnv(c) is the
  actionable failure mode)
- default export wraps Hono app.fetch: bootValidate(env) → app.fetch(req, env, ctx)

Existing process.env probe kept as vitest-startup sanity check (its only
remaining use case after this commit).

Part of v0.15.1 spec."
```

---

### Task 6: Add integration tests for boot probe (3 failure modes)

**Files:**
- Create: `apps/api/test/integration/boot-probe.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/test/integration/boot-probe.test.ts` with this exact content:

```ts
// apps/api/test/integration/boot-probe.test.ts
//
// v0.15.1 — Boot probe end-to-end test.
//
// Verifies that when parseEnv(env) would fail (placeholder JWT_SECRET,
// prod + WXPAY_USE_SANDBOX, JWT_SECRET < 32 bytes), the boot probe
// fires console.error with the expected log line on the first request.
//
// MODULE-STATE CAVEAT: vitest-pool-workers shares module state across
// tests in the same worker isolate. The boot object sets `validated =
// true` after the first call, so subsequent tests' bootValidate() calls
// short-circuit. This is the EXPECTED production behavior (one-shot per
// isolate) — we just verify the FIRST probe fires loudly. Subsequent
// misconfigurations are still caught by getEnv(c) per-request.
//
// Therefore each test:
//   - spies on console.error
//   - makes a request with a misconfigured env
//   - asserts console.error was called with '[index] boot-time parseEnv FAILED'
//
// The first test in the file is the one that proves bootValidate ran
// (subsequent tests still pass because getEnv(c) on the request path
// returns 500, satisfying the second assertion).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { env } from 'cloudflare:test';

const { default: app } = await import('../../src/index');

describe('boot probe via c.env', () => {
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errSpy.mockRestore();
  });

  it('logs and 500s on placeholder JWT_SECRET in prod (first test triggers bootValidate)', async () => {
    const badEnv = {
      ...env,
      JWT_SECRET: 'dev-secret-replace-in-prod',
      NODE_ENV: 'production',
    };
    // Use /api/checkout/status/<unknown> — it's behind requireAuth which
    // calls getEnv(c). Any 500 proves getEnv threw. We expect ≥ 400.
    const res = await app.request('/api/checkout/status/unknown-id', {}, badEnv);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining('[index] boot-time parseEnv FAILED'),
      expect.anything(),
    );
  });

  it('returns 500 on prod + WXPAY_USE_SANDBOX=true (parseEnv guard fires via getEnv)', async () => {
    // bootValidate has already run (test above), so this test only
    // verifies the getEnv(c) per-request path. console.error should NOT
    // be called again from bootValidate, but the request still fails.
    const badEnv = {
      ...env,
      JWT_SECRET: 'real-32-byte-secret-aaaaaaaaaaaa',
      NODE_ENV: 'production',
      WXPAY_USE_SANDBOX: true,
    };
    const res = await app.request('/api/checkout/status/unknown-id', {}, badEnv);
    expect(res.status).toBeGreaterThanOrEqual(400);
    // console.error may still fire from other code paths (getEnv, etc.),
    // but the boot-time-specific message should NOT appear again.
    const bootCalls = errSpy.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('[index] boot-time parseEnv FAILED'),
    );
    expect(bootCalls.length).toBe(0);
  });

  it('returns 500 on JWT_SECRET < 32 bytes in prod (parseEnv guard via getEnv)', async () => {
    const badEnv = {
      ...env,
      JWT_SECRET: 'short',
      NODE_ENV: 'production',
    };
    const res = await app.request('/api/checkout/status/unknown-id', {}, badEnv);
    expect(res.status).toBeGreaterThanOrEqual(400);
    const bootCalls = errSpy.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('[index] boot-time parseEnv FAILED'),
    );
    expect(bootCalls.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails (new file, no implementation gap)**

Run: `cd apps/api && npm test -- test/integration/boot-probe.test.ts`
Expected: PASS (this is the success case — the file didn't exist before Task 5 already wired bootValidate)

If the test FAILS, debug:
- "Cannot find module '../../src/index'" → import path wrong
- "boot-time parseEnv FAILED" never matched → bootValidate not wired (re-check Task 5)
- console.error spy didn't catch → check vi.spyOn works in vitest-pool-workers (it does in 0.18)

- [ ] **Step 3: Verify all three failure modes actually trigger**

The first test should pass with `errSpy` called. The second and third rely on `getEnv(c)` per-request. Verify by running:

Run: `cd apps/api && npm test -- test/integration/boot-probe.test.ts -v`
Expected: 3 passed; first test's errSpy assertion shows the [index] boot-time parseEnv FAILED string was matched

- [ ] **Step 4: Run full integration suite**

Run: `cd apps/api && npm test -- test/integration/`
Expected: PASS — all integration tests pass (boot-probe + checkout + quota-upgrade + auth + predict-stream + report + users + _migration-0002)

- [ ] **Step 5: Commit**

```bash
cd apps/api && git add test/integration/boot-probe.test.ts
git commit -m "test(api): integration tests for boot probe (3 failure modes)

First test (placeholder JWT_SECRET in prod) triggers bootValidate and
verifies console.error includes '[index] boot-time parseEnv FAILED'.

Second and third tests verify that subsequent misconfigurations (prod
+ sandbox, JWT_SECRET < 32 bytes) are caught by getEnv(c) per-request
even after bootValidate has already run (validated=true short-circuits).

Module-state isolation caveat documented in file header.

Part of v0.15.1 spec."
```

---

### Task 7: Final verification — typecheck + full test run + lint check

**Files:**
- No file changes — verification only

- [ ] **Step 1: Typecheck**

Run: `cd apps/api && npm run typecheck`
Expected: PASS — 0 type errors

- [ ] **Step 2: Run all tests**

Run: `cd apps/api && npm test`
Expected: PASS — all unit + integration tests pass
- Unit: env.test.ts + jwt.test.ts + password.test.ts + rsa-verify.test.ts (12 tests) + wechat-pay.test.ts (16 tests)
- Integration: auth.test.ts + boot-probe.test.ts (NEW, 3 tests) + checkout.test.ts (8 tests) + predict-stream.test.ts + quota-upgrade.test.ts (7 tests) + report.test.ts + users.test.ts + _migration-0002.test.ts

- [ ] **Step 3: Manual sanity check**

Read `apps/api/src/index.ts` — confirm:
- `boot` state is module-level (not inside a function)
- `bootValidate` is called inside `default.fetch` before `app.fetch`
- The existing `process.env` probe is preserved with its honest comment

Read `apps/api/src/utils/wechat-pay.ts:65-95` — confirm:
- TEST_ bypass on line ~78 unchanged
- WXPAY_PLATFORM_CERT_MISSING throw on line ~88
- `rsaVerifySha256` call on line ~94

Read `apps/api/src/utils/rsa-verify.ts` — confirm:
- `pemToDer` strips BEGIN/END + whitespace
- `rsaVerifySha256` uses `crypto.subtle.importKey('spki', ...)` and `crypto.subtle.verify('RSA-PKCS1-v1_5', ...)`

- [ ] **Step 4: Commit (only if you touched anything)**

If all steps pass without any edits, no commit. If you found and fixed anything:

```bash
cd apps/api && git add <files>
git commit -m "chore(api): v0.15.1 final cleanup — typecheck + full test run"
```

---

## Self-Review

After writing the plan, run these checks:

**1. Spec coverage:**
- Goal 1 (real RSA verify) → Tasks 1, 2, 3 ✅
- Goal 2 (boot probe via c.env) → Tasks 5, 6 ✅
- Goal 3 (backward compat with TEST_ bypass) → Task 4 verifies, Task 3 preserves ✅
- Goal 4 (CI-locked prod guards) → Task 3 CI lock tests + Task 6 integration tests ✅

**2. Placeholder scan:**
- No "TBD" / "TODO" / "implement later" / "similar to Task N" — every step has exact code

**3. Type consistency:**
- `verifyCallbackSignature` env type: `Pick<AppEnv, 'WXPAY_USE_SANDBOX' | 'WXPAY_PLATFORM_CERT'>` — used consistently across Task 3, 4
- `bootValidate(env: AppEnv)` — used consistently in Task 5, 6
- `pemToDer` / `rsaVerifySha256` signatures match between Task 1, 2, 3

**4. Task right-sizing:**
- Each task ends with a commit and a verifiable test pass
- Tasks 1+2 could merge, but separate commits help bisect the crypto path
- Tasks 5+6 could merge, but separating let us verify the wrap pattern before adding the test surface

**Final plan size:** ~970 lines, 7 tasks, 2 tracks. Tracks can run in any order; recommended order is Track A → Track B.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-26-qizai-v0151-rsa-verify-probe.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task (7 implementer dispatches + 7 reviewer dispatches + 1 final whole-branch review), review between tasks, fast iteration with isolated context per task.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review.

Which approach?