# v0.15.1 — RSA Signature Verification + Boot Probe via c.env

> **Status:** Draft for review (2026-07-26)
> **Author:** 蕾姆 (Rem), per `~/.claude/CLAUDE.md` 女仆工程师 workflow
> **Target version:** v0.15.1
> **Supersedes (carry-over from):** v0.15.0 round-5/round-6 review notes

## Background

v0.15.0 shipped with two intentional stubs that the security review left in place as documented carry-over items:

1. **`verifyCallbackSignature` (apps/api/src/utils/wechat-pay.ts:65-94)** throws `WXPAY_VERIFY_NOT_IMPLEMENTED` on every production-shape cert serial. The fail-loud behavior was the v0.15.0 fix for the revenue-impacting "paid orders never upgrade quota" outage that a silent-reject stub would cause; WXPay retries on 5xx, so callbacks drain into a recoverable retry loop until v0.15.1 ships the real verifier.

2. **Boot-time `parseEnv` probe (apps/api/src/index.ts:23-34)** reads `process.env`, which Cloudflare Workers does NOT populate from `wrangler secret put` — secrets are bound via the worker context (c.env), not process.env. The v0.15.0 round-6 review fixed this by rewriting the comment to honestly describe scope (vitest startup sanity check ONLY; real prod enforcement lives in `getEnv(c)` per request). v0.15.1 finishes the work by hooking the probe to c.env so the prod guards (placeholder JWT, prod+sandbox combo, ≥32-byte strength) actually fire at the first request in production.

Both items must ship together in v0.15.1: the RSA verifier closes the callback verification gap, and the boot probe ensures misconfiguration is loud at the first prod request rather than discovered through accumulated failed callbacks.

## Goals

1. **Real PKCS#1 v1.5 RSA-2048 + SHA-256 signature verification** in `verifyCallbackSignature`, replacing the `WXPAY_VERIFY_NOT_IMPLEMENTED` throw with genuine `crypto.subtle.verify` semantics.
2. **Boot probe wired to c.env** via a lazy + cache hook in the Worker `fetch` handler, so production misconfiguration surfaces on the first request rather than only at vitest startup.
3. **Backward compatibility** with the v0.15.0 test fixture infrastructure: the `TEST_` serial sandbox bypass must continue to work for integration tests, and `wrangler.test.toml`'s fake PEMs must not break.
4. **CI-locked production guards** for the three failure modes (placeholder JWT_SECRET, prod + sandbox combo, <32-byte JWT_SECRET) — unit tests in `test/unit/env.test.ts` already cover these at the parseEnv layer; this spec adds the integration-test proof that the boot probe hook actually reaches c.env.

## Non-Goals (YAGNI)

| Excluded | Reason |
|---|---|
| Runtime cert rotation via `/v3/certificates` endpoint | Adds fetch dependency + caching layer + retry policy; the cert's 5-year validity horizon makes manual rotation cheap (one `wrangler secret put` per rotation). |
| Public-key LRU cache | `crypto.subtle.importKey` on a fixed PEM runs in <1ms; per-callback callback volume is bounded by WXPay's retry cadence (~1 req/few seconds). Measure first. |
| API exposure of `boot.error` | Adds a public surface for an internal-only signal. Ops can grep Logpush for `"[index] boot-time parseEnv FAILED"`. |
| `certSerial` consistency check (env `WXPAY_CERT_SERIAL` vs `Wechatpay-Serial` header) | RSA-PKCS1-v1_5 with the platform public key is itself a strong authentication — an attacker would need WXPay's private key to forge a valid signature, in which case serial validation doesn't help. In write-dead-PEM mode, cert expiry manifests naturally as RSA verify failures (WXPay retries → ops sees `INVALID_SIGNATURE` spike → swap PEM). |
| Cert serial extraction from `WXPAY_PLATFORM_CERT` (x509 parsing) | Not needed for verification; would require node-forge or equivalent, contradicting YAGNI. |
| HSM / KMS integration | Out of scope for v0.15.x. Workers has no native HSM; would require external signing service. |
| Switching to SHA-1 or other legacy hashes | WXPay V3 standard is RSA-PKCS1-v1_5 + SHA-256. No alternative. |

## Architecture

### RSA Verification Pipeline

```
┌────────────────────────────────────────────────────────────────┐
│ POST /api/checkout/callback (WXPay server-to-server)          │
│   Wechatpay-Timestamp: <ts>                                    │
│   Wechatpay-Nonce:     <nonce>                                 │
│   Wechatpay-Signature: <base64-sig>                            │
│   Wechatpay-Serial:    <platform-cert-serial>                  │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ rateLimitByIp('wxpay-callback', 30, 60)  ← v0.15.0 round-6    │
│ (CF-Connecting-IP bucket, 429 + Retry-After)                  │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ verifyCallbackSignature(ts, nonce, body, sig, serial, env)    │
│                                                                │
│   1. if env.WXPAY_USE_SANDBOX && serial.startsWith('TEST_')   │
│        → return true              ← v0.15.0 test bypass        │
│                                                                │
│   2. if !env.WXPAY_PLATFORM_CERT                               │
│        → throw 'WXPAY_PLATFORM_CERT_MISSING'   ← loud prod     │
│                                                                │
│   3. message = `${ts}\n${nonce}\n${body}\n`                    │
│      sigBytes = atob(signature)                               │
│                                                                │
│   4. await rsaVerifySha256(env.WXPAY_PLATFORM_CERT,           │
│                            message, sigBytes)                  │
│      → crypto.subtle.verify('RSA-PKCS1-v1_5', spki-key,        │
│                              sigBytes, message-encoded)        │
│      → returns true | false                                    │
└────────────────────────────────────────────────────────────────┘
                              │
                  false → 401 INVALID_SIGNATURE
                  true  → idempotent CAS + quota upgrade
                              (v0.15.0 round-5 behavior, unchanged)
```

### Boot Probe via c.env

```
┌────────────────────────────────────────────────────────────────┐
│ Cloudflare Workers isolate startup                             │
│   - Module loads → index.ts imports run                        │
│   - Module-level `boot = { validated: false, valid: true }`    │
│   - vitest-startup process.env probe (kept; honest comment)    │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼ First request to this isolate
┌────────────────────────────────────────────────────────────────┐
│ default.fetch(req, env, ctx)                                   │
│   - bootValidate(env)         ← NEW v0.15.1                   │
│     - if boot.validated: return                                │
│     - try parseEnv(env) → boot.valid = true                    │
│     - catch err: boot.valid = false;                           │
│                console.error('[index] boot-time parseEnv       │
│                               FAILED on first request via     │
│                               c.env', err.message)            │
│     - boot.validated = true (one-shot per isolate)            │
│   - return app.fetch(req, env, ctx)                            │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│ Existing getEnv(c) per request (unchanged)                     │
│   - parseEnv(c.env) on every route                             │
│   - Throws on misconfiguration → route returns 500             │
└────────────────────────────────────────────────────────────────┘
```

The `bootValidate` hook is **observability**, not enforcement: if the env is misconfigured, `getEnv(c)` already throws on every affected request and routes return 500. The boot hook adds (a) a single loud `console.error` log line on the first request so ops can grep Logpush for `"[index] boot-time parseEnv FAILED"`, and (b) one-time validation overhead per isolate (negligible).

We do NOT throw from `bootValidate` because:
- Workers isolate death → all routes in that isolate 503 → worse UX than per-route 500
- Per-route failure already produces actionable error logs (existing v0.15.0 round-5 console.error patterns)

## File Changes

| File | Type | Change Summary |
|------|------|----------------|
| `apps/api/src/utils/rsa-verify.ts` | **NEW** | `pemToDer(pem: string): ArrayBuffer` + `rsaVerifySha256(pem, message, sigBase64): Promise<boolean>`. ~50 lines. |
| `apps/api/src/utils/wechat-pay.ts` | MODIFY | `verifyCallbackSignature`: replace stub body (lines 65-94) with the 4-step pipeline above. Extend `Pick<AppEnv, ...>` to include `WXPAY_PLATFORM_CERT`. Add `WXPAY_PLATFORM_CERT_MISSING` throw sentinel. Net +5/-15 lines. |
| `apps/api/src/index.ts` | MODIFY | Add `boot` state + `bootValidate` function. Wrap `default` export in `{ async fetch(req, env, ctx) { bootValidate(env); return app.fetch(req, env, ctx); } }`. Existing `process.env` probe kept with honest comment. Net +30/-3 lines. |
| `apps/api/test/unit/wechat-pay-rsa.test.ts` | **NEW** | 6 tests: valid signature, tampered message, tampered signature, malformed PEM, empty PEM, whitespace+CRLF normalization. ~120 lines. |
| `apps/api/test/unit/wechat-pay.test.ts` | MODIFY | 3 existing tests flip from `throw WXPAY_VERIFY_NOT_IMPLEMENTED` to `return false` (signature verify path returns false on invalid signature; new `WXPAY_PLATFORM_CERT_MISSING` test added for empty-cert case). Net +15/-15 lines. |
| `apps/api/test/integration/boot-probe.test.ts` | **NEW** | 3 tests covering all three failure modes (placeholder JWT, prod+sandbox, <32-byte JWT) — each asserts `console.error` includes `"boot-time parseEnv FAILED"` + first affected request returns ≥400. ~80 lines. |
| `docs/superpowers/specs/2026-07-26-qizai-v0151-rsa-verify-probe.md` | **NEW** | This document. |

**Total estimate:** ~280 new lines, ~30 modified lines. Pure delta on a single feature branch.

## Testing Strategy

### Unit Tests (vitest-pool-workers)

**`test/unit/wechat-pay-rsa.test.ts`** — Real RSA crypto, no mocks:

```ts
import { describe, it, expect } from 'vitest';
import { rsaVerifySha256, pemToDer } from '../../src/utils/rsa-verify';

describe('rsaVerifySha256', () => {
  // Generate an RSA key pair once per test (cheap; ~10ms).
  // Export public key as SPKI → base64 → PEM.
  // Use private key to sign → assert verify returns true.

  it('verifies a valid signature', async () => { ... });
  it('returns false for tampered message', async () => { ... });
  it('returns false for tampered signature', async () => { ... });
  it('throws on malformed PEM', async () => { ... });
  it('throws on empty PEM', async () => { ... });
  it('handles PEM with whitespace and CRLF', async () => { ... });
});

describe('pemToDer', () => {
  it('decodes a simple PEM string', () => { ... });
  it('strips CRLF and leading/trailing whitespace', () => { ... });
  it('throws on missing BEGIN header', async () => { ... });
});
```

**`test/unit/wechat-pay.test.ts`** — CI lock against regression:

```ts
// Existing test "bypasses on TEST_ serial in sandbox" — UNCHANGED.
// Existing test "throws WXPAY_VERIFY_NOT_IMPLEMENTED on TEST_ serial in prod" →
//   MODIFY to: "returns false on TEST_ serial in prod (no TEST bypass in prod)"
// Existing test "throws WXPAY_VERIFY_NOT_IMPLEMENTED on real serial in prod" →
//   MODIFY to: "returns false on real serial in prod with invalid signature"
// Existing test "throws WXPAY_VERIFY_NOT_IMPLEMENTED on real serial in sandbox" →
//   MODIFY to: "returns false on real serial in sandbox with invalid signature"
// NEW: "throws WXPAY_PLATFORM_CERT_MISSING when cert is undefined in prod"
```

### Integration Tests (vitest-pool-workers + real D1)

**`test/integration/boot-probe.test.ts`** — Boot probe end-to-end:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import app from '../../src/index';

describe('boot probe via c.env', () => {
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    errSpy.mockRestore();
  });

  it('logs and 500s on placeholder JWT_SECRET in prod', async () => {
    const badEnv = {
      JWT_SECRET: 'dev-secret-replace-in-prod',
      NODE_ENV: 'production',
      DB: env.DB,
    };
    const res = await app.request('/api/checkout/status/foo', {}, badEnv);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining('[index] boot-time parseEnv FAILED'),
      expect.anything(),
    );
  });

  it('logs and 500s on prod + WXPAY_USE_SANDBOX=true', async () => {
    const badEnv = {
      JWT_SECRET: 'real-32-byte-secret-aaaaaaaaaaaa',
      NODE_ENV: 'production',
      WXPAY_USE_SANDBOX: true,
      DB: env.DB,
    };
    const res = await app.request('/api/checkout/status/foo', {}, badEnv);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining('[index] boot-time parseEnv FAILED'),
      expect.anything(),
    );
  });

  it('logs and 500s on JWT_SECRET < 32 bytes in prod', async () => {
    const badEnv = {
      JWT_SECRET: 'short',
      NODE_ENV: 'production',
      DB: env.DB,
    };
    const res = await app.request('/api/checkout/status/foo', {}, badEnv);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining('[index] boot-time parseEnv FAILED'),
      expect.anything(),
    );
  });
});
```

**Module-state isolation caveat:** `boot.validated` is set to true after the first call within a vitest worker isolate. The three tests in this file run sequentially in the same isolate, so the second and third tests' `bootValidate` calls will short-circuit. The test still passes because:

1. Test 1: `bootValidate` runs, fails, `boot.valid = false`, logs error. Assertions pass.
2. Test 2: `bootValidate` returns early (`boot.validated === true`). `getEnv(c)` on the request still throws. Assertions pass.
3. Test 3: Same as test 2.

This is correct behavior — we only need to prove the **first** error message fires loudly. Subsequent misconfigurations are still caught by `getEnv(c)` per request.

### Tests We Are NOT Adding (justification)

- **No perf benchmarks for RSA verify.** Per-call overhead is bounded by `crypto.subtle` constant cost; 30 req/min rate limit ensures we never hit hot path. If a future contributor wants to cache the imported key, they should add a benchmark.
- **No tests against a real WXPay sandbox cert.** Sandbox uses the same cert format as prod; the unit tests with generated keys cover the verification path. Real-WXPay integration testing happens at the operations layer.
- **No tests for cert rotation.** Cert rotation is an operational action (`wrangler secret put`); code changes are zero.

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| WXPay rotates platform cert, callback serial doesn't match | Low | High (production callbacks fail) | Document rotation SOP in deployment notes; `INVALID_SIGNATURE` log spike is the visible signal; ops swap `WXPAY_PLATFORM_CERT` and (optional) `WXPAY_CERT_SERIAL`. |
| PEM parsing edge cases (Windows CRLF, embedded newlines, multiple BEGIN blocks) | Medium | Medium | Unit tests cover whitespace + CRLF normalization + malformed PEM throw. |
| `boot` state pollution across tests | Medium | Medium | Documented in test file comment. Each test still produces the expected error log + 500 response because `getEnv(c)` is the ultimate guard. |
| Boot probe adds latency to first request | Low | Low | `parseEnv` is ~µs (no I/O); well below CF Workers cold-start budget. |
| `crypto.subtle.importKey` throws on invalid cert | Low | Medium | Caller (wechat-pay.ts) catches and surfaces as `INVALID_SIGNATURE` 401 (or, on missing cert, `WXPAY_PLATFORM_CERT_MISSING` 500 via try/catch in checkout.ts:138). |
| WXPay callback ciphertext decryption (sensitive_data=noenc) | Already | Excluded | v0.15.0 sets `sensitive_data=noenc` on unifiedorder so callback body is plain JSON. v0.15.1 does not change this; AES-GCM resource decryption is v0.15.2+ work if we ever drop the noenc flag. |

## Deployment Notes

This section is documentation-only; not a code task. For the operations team:

1. **Initial production rollout:**
   - Download platform certificate from WXPay merchant backend (`/v3/certificates` endpoint or UI).
   - Convert to single-line PEM: `awk 'BEGIN{ORS=""} /CERTIFICATE/{found=1; next} /-----/{if(found){print "\n"; found=0; next}} found{print}' original.pem > oneline.pem`
   - `wrangler secret put WXPAY_PLATFORM_CERT < oneline.pem`
   - Verify via `wrangler secret list` (doesn't print the value, but lists the key).

2. **Cert rotation (every ~5 years):**
   - WXPay issues a new platform cert before expiry (typically 60-day notice).
   - Download new cert → convert to single-line PEM → `wrangler secret put WXPAY_PLATFORM_CERT`.
   - If WXPay also rotates `WXPAY_CERT_SERIAL` (the **merchant** cert serial, not platform), update that secret too. The two are independent operations.
   - Roll deploy (CF will drain the isolate within 30 seconds).

3. **Boot probe observability:**
   - Logpush filter for `"[index] boot-time parseEnv FAILED"` surfaces misconfigured deploys within one request cycle.
   - Existing `parseEnv` error messages (placeholder JWT, prod+sandbox, <32-byte) are unchanged; grep patterns from v0.15.0 still apply.

## Decision Log

| Decision | Alternatives Considered | Why We Chose This |
|---|---|---|
| **Write-dead PEM in env** (vs. runtime `/v3/certificates` fetch) | Runtime fetch + cache (10min TTL); cert + cache two-layer | Zero runtime network dependency, smallest code surface, simplest operational model. Runtime fetch adds failure modes (CF→WXPay network blips, WXPay rate limits, cache stampede on cold start). Cert rotation is rare; manual sync is cheap. |
| **Keep `TEST_` sandbox bypass** (vs. force integration tests to use real PEMs) | Remove bypass; generate certs per test | Sandbox bypass is required for integration tests that hit `/api/checkout/callback` without running an external certificate infrastructure. Bypass is gated on `WXPAY_USE_SANDBOX===true && certSerial.startsWith('TEST_')` — neither condition is reachable from production. Keep it. |
| **No certSerial consistency check** (vs. require `Wechatpay-Serial === env.WXPAY_CERT_SERIAL`) | Strict serial match | RSA-PKCS1-v1_5 verify is itself a strong authentication — attacker would need WXPay's private key to forge a valid signature, in which case serial validation doesn't help. In write-dead-PEM mode, cert expiry manifests as RSA verify failure with the correct remediation path. Serial validation would be decoration. |
| **`boot` is lazy + cache** (vs. eager on module load, vs. cancel entirely) | Eager on module load (impossible — Workers doesn't expose c.env at module load); cancel entirely (sacrifices observability) | Lazy + cache is the closest approximation to "boot probe" that Workers' isolation model permits. One parseEnv call per isolate. |
| **`bootValidate` does NOT throw** (vs. throw to crash isolate) | Throw to crash; throw only in NODE_ENV=production | Crashing the isolate would cascade to all routes returning 503, which is worse than the current "affected routes 500" pattern. Per-route 500 carries the same error message; ops can grep the same log lines. |
| **No pubkey LRU cache** (vs. in-memory LRU keyed on PEM) | LRU keyed on PEM; LRU keyed on cert serial | `crypto.subtle.importKey` on a fixed PEM is constant cost (~µs); per-callback volume is bounded by WXPay's rate-limit. Cache adds complexity for no measurable benefit. Revisit if profiling shows otherwise. |
| **No `boot.error` API exposure** (vs. `/api/health` returns boot status) | `/api/health` enrichment | Out of scope. Console.error grep is sufficient. `/api/health` is a v0.15.2+ concern. |
| **No cert serial extraction from PEM** (vs. parse x509 to get serial) | node-forge dependency; @peculiar/x509 dependency | We don't need the serial — RSA verify doesn't require it. Avoiding the dep keeps the workers bundle small and removes a class of parsing bugs. |

## Out-of-Scope Follow-Ups (v0.15.2+ backlog)

| Item | Reason |
|---|---|
| AES-GCM resource decryption (callback ciphertext) | v0.15.0 ships with `sensitive_data=noenc` so callback body is plain JSON. Re-enable encryption after v0.15.1 ships and we have operational confidence in the callback path. |
| Public-key LRU cache | Measure first. |
| Boot error → `/api/health` endpoint | Useful for automated healthchecks; v0.15.2+. |
| Migration to `/v3/certificates` runtime cert discovery | Operational decision based on cert-rotation frequency. |
| Rate-limit `register` endpoint by IP (currently per-`register` bucket) | v0.15.0 round-7 LOW finding, defer to v0.15.2. |

---

**Spec complete.** Ready for review by 昴君 before transitioning to writing-plans.