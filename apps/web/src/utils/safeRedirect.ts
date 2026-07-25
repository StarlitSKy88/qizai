/**
 * Sanitize a redirect path read from a query string.
 *
 * Rejects:
 *   - protocol-relative URLs (//evil.com) that browsers treat as cross-origin
 *   - backslash variants that some browsers normalize into forward slashes
 *   - leading-whitespace payloads (`   /evil.com`) — caught by the
 *     `startsWith('/')` check as a side-effect; this is intentional defense
 *     in depth, not a primary contract
 *   - pseudo-scheme paths (`/javascript:alert(1)`, `/data:`, `/mailto:`) —
 *     react-router@6 treats anything starting with `/` as a path, so they
 *     stay in-app; no scheme detection needed here
 *   - any string that is not an in-app absolute path
 *
 * Falls back to `/predict` (the app's primary post-auth destination) when the
 * candidate is missing or unsafe.
 *
 * SECURITY: `fallback` must be a hardcoded constant. If a future caller passes
 * a user-controlled default, it becomes an injection point — keep this
 * parameter as a hardcoded site-config value only.
 */
export function safeRedirect(raw: string | null, fallback = '/predict'): string {
  if (!raw) return fallback;
  // Defense in depth: reject protocol-relative (//evil.com), backslash
  // variants (which some browsers normalize to '/'), and NUL-byte payloads
  // (which can truncate URL parsing in older browsers / proxies).
  if (
    !raw.startsWith('/') ||
    raw.startsWith('//') ||
    raw.includes('\\') ||
    raw.includes('\0')
  ) {
    return fallback;
  }
  return raw;
}