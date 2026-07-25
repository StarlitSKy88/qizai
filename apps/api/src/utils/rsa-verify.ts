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

// Maximum PEM size we'll accept. RSA-2048 SPKI keys are ~450 bytes
// PEM-encoded; X.509 certificates are ~1.5 KB. 8 KB is a generous cap
// that still defends against memory-exhaustion via attacker-supplied
// huge strings. The callback handler is rate-limited at 30/min so this
// is defense-in-depth, not the primary throttle.
const MAX_PEM_BYTES = 8 * 1024;

// Strict base64 alphabet (RFC 4648, standard encoding with padding).
// We validate BEFORE decoding because Buffer.from(..., 'base64') SILENTLY
// strips any non-alphabet chars — wrong PEM would yield wrong bytes
// without throwing, causing RSA verify to fail on every signature with
// no actionable error.
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Decode a PEM-formatted key into its DER (binary) bytes.
 * Strips the BEGIN/END headers, all whitespace, and base64-decodes the body.
 * Accepts multi-line PEM (with \n or \r\n) and single-line PEM.
 *
 * Strict validation:
 *   - PEM length must be ≤ 8 KB (DoS defense)
 *   - Must contain both BEGIN and END markers with the SAME label
 *   - BEGIN must appear before END
 *   - Body must be valid base64 (no silent alphabet stripping)
 *
 * @param pem - PEM string. Must contain both BEGIN and END markers.
 * @returns ArrayBuffer of base64-decoded DER bytes.
 * @throws Error if PEM is malformed.
 */
export function pemToDer(pem: string): ArrayBuffer {
  if (typeof pem !== 'string') {
    throw new Error('pemToDer: input must be a string');
  }
  if (pem.trim().length === 0) {
    throw new Error('pemToDer: empty PEM string');
  }
  if (pem.length > MAX_PEM_BYTES) {
    throw new Error(`pemToDer: PEM exceeds ${MAX_PEM_BYTES} byte limit`);
  }

  // Use a single regex that captures the label between BEGIN ... and
  // -----END <label>-----, requiring matching labels and ordering. This
  // prevents bytes before BEGIN or after END from being included in the
  // slice, and prevents mismatched BEGIN/END pairs (e.g. PRIVATE followed
  // by PUBLIC) from being silently accepted.
  // Body capture uses [\s\S]*? (any char incl. newlines, non-greedy) so
  // that corrupted base64 (e.g. @ $ ! characters) still matches — the
  // actual base64 validation happens in the BASE64_RE check below.
  const pemRe =
    /^-----BEGIN ([A-Z0-9 ]+)-----\s*([\s\S]*?)\s*-----END \1-----$/;
  const m = pemRe.exec(pem);
  if (!m) {
    // Distinguish "missing BEGIN" from "missing END" for actionable errors.
    if (!/-----BEGIN/.test(pem)) {
      throw new Error('pemToDer: missing BEGIN header');
    }
    if (!/-----END/.test(pem)) {
      throw new Error('pemToDer: missing END header');
    }
    throw new Error('pemToDer: BEGIN/END headers present but malformed (mismatched labels or wrong order)');
  }

  const body = m[2].replace(/\s+/g, '');
  if (body.length === 0) {
    throw new Error('pemToDer: PEM body is empty after stripping headers');
  }
  if (!BASE64_RE.test(body)) {
    // Buffer.from silently strips invalid chars — we MUST validate first
    // so a corrupted PEM throws loudly instead of yielding wrong bytes
    // that pass through crypto.subtle.importKey and fail every verify.
    throw new Error('pemToDer: PEM body contains non-base64 characters');
  }
  const bytes = Buffer.from(body, 'base64');
  if (bytes.byteLength === 0) {
    throw new Error('pemToDer: base64 body decoded to zero bytes');
  }
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
