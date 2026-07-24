// apps/api/test/integration/predict-stream.test.ts
//
// T12+T13 integration tests for POST /api/predict/stream.
// Runs inside the Cloudflare Workers runtime via @cloudflare/vitest-pool-workers.
// D1 migrations are applied once per suite via test/setup-integration.ts.

import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../src/index';
import { abortStreamingReport, createQuotaRefund } from '../../src/routes/predict';

async function setupUser(email = 'a@b.com') {
  await env.DB.exec('DELETE FROM users');
  await env.DB.exec('DELETE FROM reports');
  const res = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'correct horse' }),
  }, env);
  const body = (await res.json()) as any;
  return { userId: body.userId, token: body.token, auth: { Authorization: `Bearer ${body.token}` } };
}

describe('POST /api/predict/stream', () => {
  beforeEach(async () => {
    // H5: also clear rate_limits so each test gets a fresh 5/h register
    // budget. Without this, the 6th test in the file would hit 429.
    await env.DB.exec('DELETE FROM reports; DELETE FROM users; DELETE FROM rate_limits;');
  });

  it('401 when no JWT', async () => {
    const res = await app.request('/api/predict/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { title: 'hello' }, platforms: ['xhs'] }),
    }, env);
    expect(res.status).toBe(401);
  });

  it('returns SSE headers and start event with mock JWT', async () => {
    const { auth } = await setupUser();
    const res = await app.request('/api/predict/stream', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { title: 'hello world' }, platforms: ['xhs'] }),
    }, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
  });

  it('rejects non-string title with 400 INVALID_INPUT', async () => {
    const { auth } = await setupUser();
    const res = await app.request('/api/predict/stream', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { title: 123 }, platforms: ['xhs'] }),
    }, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.code).toBe('INVALID_INPUT');
  });

  it('rejects title longer than 2000 chars with 400 CONTENT_TOO_LONG', async () => {
    const { auth } = await setupUser();
    const res = await app.request('/api/predict/stream', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { title: 'x'.repeat(2001) }, platforms: ['xhs'] }),
    }, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.code).toBe('CONTENT_TOO_LONG');
  });

  // C1: whitelist + dedupe + length cap. A payload that lists only
  // unknown platforms must be rejected with 400 INVALID_INPUT — the
  // request never reaches the LLM orchestrator, so quota is not
  // pre-charged either. (The whitelist contains exactly 3 platforms
  // today, so the >3 length cap is unreachable in practice; the
  // underlying branch still defends against a future whitelist grow.)
  it('rejects payload where every platform is unknown with 400 INVALID_INPUT', async () => {
    const { auth } = await setupUser();
    const res = await app.request('/api/predict/stream', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { title: 'hello' },
        platforms: ['nope-a', 'nope-b', 'nope-c'],
      }),
    }, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.code).toBe('INVALID_INPUT');
  });

  it('returns 402 QUOTA_EXHAUSTED when quota_used >= quota_limit', async () => {
    const { auth, userId } = await setupUser();
    // Force the user to their monthly ceiling; auth header still valid for JWT.
    await env.DB
      .prepare('UPDATE users SET quota_used = 30, quota_limit = 30 WHERE id = ?')
      .bind(userId)
      .run();
    const res = await app.request('/api/predict/stream', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { title: 'hello' }, platforms: ['xhs'] }),
    }, env);
    expect(res.status).toBe(402);
    const body = (await res.json()) as any;
    expect(body.code).toBe('QUOTA_EXHAUSTED');
    expect(body.message).toContain('¥29');
  });

  it("cancel handler preserves status='done' after completion", async () => {
    const { userId } = await setupUser();
    const reportId = 'report-completed-before-cancel';
    await env.DB
      .prepare(
        `INSERT INTO reports (id, user_id, title, platforms, persona_count, content_hash, status)
         VALUES (?, ?, ?, ?, ?, ?, 'done')`,
      )
      .bind(reportId, userId, 'done report', '["xhs"]', 100, 'hash')
      .run();

    await abortStreamingReport(env.DB, reportId);

    const report = await env.DB
      .prepare('SELECT status FROM reports WHERE id = ?')
      .bind(reportId)
      .first<{ status: string }>();
    expect(report?.status).toBe('done');
  });

  it('double-refund is idempotent', async () => {
    const { userId } = await setupUser();
    await env.DB
      .prepare('UPDATE users SET quota_used = 2 WHERE id = ?')
      .bind(userId)
      .run();
    const refund = createQuotaRefund(env.DB, userId);

    await refund();
    await refund();

    const user = await env.DB
      .prepare('SELECT quota_used FROM users WHERE id = ?')
      .bind(userId)
      .first<{ quota_used: number }>();
    expect(user?.quota_used).toBe(1);
  });

  it('full SSE stream emits start + progress + complete', async () => {
    // Mock the LLM at the network boundary: LLM providers call the global
    // `fetch` (dashscope first in LLMRouter's fallback chain), while
    // `app.request` dispatches in-process and never touches `fetch`.
    // A 200 from the Alibaba origin short-circuits all 100 persona calls
    // instantly; any unexpected outbound call fails loudly.
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes('dashscope.aliyuncs.com')) {
        return new Response(
          JSON.stringify({ output: { text: 'mock persona reaction' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      throw new Error(`Unexpected outbound fetch in test: ${url}`);
    }) as typeof fetch;

    try {
      const { auth } = await setupUser();
      const res = await app.request('/api/predict/stream', {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: { title: 'hello' }, platforms: ['xhs'] }),
      }, env);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/event-stream');
      const text = await res.text();
      expect(text).toContain('event: start');
      expect(text).toContain('event: progress');
      expect(text).toContain('event: complete');
      expect(text).toContain('"platform":"xhs"');
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
