/**
 * apps/web/src/api/client.ts
 *
 * Thin fetch wrapper + SSE stream consumer used by the web UI to talk to
 * the qizai Hono API (apps/api). Centralises two concerns the rest of the
 * front-end should not have to re-implement per page:
 *
 *   1. `apiFetch`  — attach `Authorization: Bearer <jwt>` from localStorage
 *      so every authenticated request Just Works without callers reaching
 *      into storage directly.
 *
 *   2. `consumeSse` — read a `ReadableStreamDefaultReader<Uint8Array>` and
 *      emit one event per SSE block (`\n\n` separator). Each event carries
 *      `{ type, data }` where `data` is JSON-parsed if possible, else the
 *      raw string (this matches the EventSource contract consumers expect).
 *
 * Token storage key (`qizai_jwt`) is the same one `api/auth.ts` (T25) will
 * write to; keep the two in sync when changing the schema.
 */

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = localStorage.getItem('qizai_jwt');
  return fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
}

export async function consumeSse(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (e: { type: string; data: any }) => void,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const lines = block.split('\n');
      let type = 'message';
      let data = '';
      for (const line of lines) {
        if (line.startsWith('event:')) type = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (data) onEvent({ type, data: safeParseJson(data) });
    }
  }
}

function safeParseJson(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}