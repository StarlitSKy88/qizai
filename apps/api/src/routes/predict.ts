// apps/api/src/routes/predict.ts
//
// T12 SSE predict route shell. Endpoint:
//   POST /api/predict/stream
//     Headers: Authorization: Bearer <jwt>
//     Body: { content: { title: string(1..2000) }, platforms?: string[] }
//
// Behavior (T12 shell, T15 will replace the inner stream body):
//   1. requireAuth (401 on missing/invalid JWT)
//   2. Validate title length (400 CONTENT_TOO_LONG otherwise)
//   3. Create reportId, INSERT a `streaming` D1 row
//   4. Emit SSE `start` event, delegate to runPredictionStream stub, close.
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
  const body = (await c.req.json().catch(() => ({}))) as {
    content?: { title?: string };
    platforms?: string[];
  };
  const title = body.content?.title ?? '';
  const platforms = body.platforms ?? ['xhs'];

  if (!title || title.length > 2000) {
    return c.json(
      { code: 'CONTENT_TOO_LONG', message: '内容必须在 1-2000 字' },
      400,
    );
  }

  const user = getUser(c);
  const reportId = `report-${crypto.randomUUID()}`;

  if (env.DB) {
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
  }

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

      await runPredictionStream(env, reportId, title, platforms, (event) => {
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
