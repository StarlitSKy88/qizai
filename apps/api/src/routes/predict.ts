// apps/api/src/routes/predict.ts
//
// T12 SSE predict route shell. Endpoint:
//   POST /api/predict/stream
//     Headers: Authorization: Bearer <jwt>
//     Body: { content: { title: string(1..2000) }, platforms?: string[] }
//
// Behavior (T12 shell, T15 will replace the inner stream body):
//   1. requireAuth (401 on missing/invalid JWT)
//   2. Runtime-validate the body (400 INVALID_INPUT: title must be a
//      1..2000-char string; content/body must be non-null objects)
//   3. Guard env.DB (500 DB_NOT_CONFIGURED when the D1 binding is missing)
//   4. Create reportId, INSERT a `streaming` D1 row
//   5. Emit SSE `start` event, delegate to runPredictionStream stub, close.
//
// The stream-predictor stub only emits a single `progress` event so the tests
// can verify SSE headers without depending on the real LLM orchestrator.

import { Hono } from 'hono';
import { requireAuth, getUser } from '../middleware/auth';
import { sseHeaders, sseEvent } from '../utils/sse';
import { getEnv } from '../utils/env';
import { runPredictionStream } from '../utils/stream-predictor';

export const predictRouter = new Hono();

predictRouter.post('/stream', requireAuth, async (c) => {
  const env = getEnv(c);

  // Runtime validation: parsed JSON is untrusted `unknown`. A bad type
  // assertion here would let `{"content":{"title":123}}` bypass the length
  // check and let a top-level `null` throw on `.content` access.
  const body: unknown = await c.req.json().catch(() => null);
  if (typeof body !== 'object' || body === null) {
    return c.json({ code: 'INVALID_INPUT', message: '请求体必须是 JSON 对象' }, 400);
  }

  const content = (body as { content?: unknown }).content;
  if (typeof content !== 'object' || content === null) {
    return c.json({ code: 'INVALID_INPUT', message: 'content 必须是对象' }, 400);
  }

  const title = (content as { title?: unknown }).title;
  if (typeof title !== 'string' || title.length < 1) {
    return c.json({ code: 'INVALID_INPUT', message: '标题必须是 1-2000 字的文本' }, 400);
  }
  if (title.length > 2000) {
    return c.json({ code: 'CONTENT_TOO_LONG', message: '内容超过 2000 字' }, 400);
  }

  // platforms is optional; keep current default of ['xhs'] when absent/invalid.
  const rawPlatforms = (body as { platforms?: unknown }).platforms;
  const platforms = Array.isArray(rawPlatforms) ? (rawPlatforms as string[]) : ['xhs'];

  const user = getUser(c);
  const reportId = `report-${crypto.randomUUID()}`;

  if (!env.DB) {
    return c.json({ code: 'DB_NOT_CONFIGURED', message: 'D1 binding missing' }, 500);
  }

  // T19: per-user monthly quota gate. Return 402 QUOTA_EXHAUSTED before any
  // LLM work so the upgrade CTA can surface immediately. Skipped when DB is
  // missing (handled by the DB_NOT_CONFIGURED branch above).
  const quotaRow = await env.DB
    .prepare('SELECT quota_used, quota_limit FROM users WHERE id = ?')
    .bind(user.sub)
    .first<{ quota_used: number; quota_limit: number }>();
  if (quotaRow && quotaRow.quota_used >= quotaRow.quota_limit) {
    return c.json(
      { code: 'QUOTA_EXHAUSTED', message: '本月配额已用完，¥29 升级 300 次/月' },
      402,
    );
  }

  await env.DB
    .prepare(
      `INSERT INTO reports (id, user_id, title, platforms, persona_count, content_hash)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      reportId,
      user.sub,
      title,
      JSON.stringify(platforms),
      100,
      await sha256(title + JSON.stringify(platforms)),
    )
    .run();

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        new TextEncoder().encode(
          sseEvent('start', {
            report_id: reportId,
            total_personas: 100 * platforms.length,
          }),
        ),
      );

      await runPredictionStream(env, user.sub, reportId, title, platforms, (event) => {
        controller.enqueue(new TextEncoder().encode(event));
      });

      controller.close();
    },
  });

  return new Response(stream, { headers: sseHeaders() });
});

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
