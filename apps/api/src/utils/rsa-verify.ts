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
  const endMatch = /-----END [^-]+-----/.exec(pem);
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
