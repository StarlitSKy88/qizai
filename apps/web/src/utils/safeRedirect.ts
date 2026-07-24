/**
 * Sanitize a redirect path read from a query string.
 *
 * Rejects:
 *   - protocol-relative URLs (//evil.com) that browsers treat as cross-origin
 *   - backslash variants that some browsers normalize into forward slashes
 *   - any string that is not an in-app absolute path
 *
 * Falls back to `/predict` (the app's primary post-auth destination) when the
 * candidate is missing or unsafe.
 */
export function safeRedirect(raw: string | null, fallback = '/predict'): string {
  if (!raw) return fallback;
  // Reject protocol-relative URLs (//evil.com), backslashes, and external URLs
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return fallback;
  }
  return raw;
}