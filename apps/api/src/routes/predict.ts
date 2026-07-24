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

// Whitelist of platforms the LLM orchestrator actually supports. Each entry
// multiplies LLM cost by 100 personas, so without these guards a single
// request could submit `platforms: Array(1000).fill('xhs')` and burn
// 100,000 LLM calls for one quota charge. Keep the list short.
const ALLOWED_PLATFORMS = ['xhs', 'tiktok', 'bilibili'] as const;
const MAX_PLATFORMS = 3;

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

  // C1 hardening: filter raw `platforms` to the whitelist, dedupe, and cap
  // the count. Default to the full whitelist when absent so the marketing
  // copy ("3 平台同测") keeps working.
  const rawPlatforms = (body as { platforms?: unknown }).platforms;
  const platforms: string[] = Array.isArray(rawPlatforms)
    ? Array.from(
        new Set(
          rawPlatforms.filter(
            (p): p is string =>
              typeof p === 'string' &&
              (ALLOWED_PLATFORMS as readonly string[]).includes(p),
          ),
        ),
      )
    : [...ALLOWED_PLATFORMS];
  if (platforms.length === 0) {
    return c.json(
      { code: 'INVALID_INPUT', message: 'platforms 至少包含一个有效平台' },
      400,
    );
  }
  if (platforms.length > MAX_PLATFORMS) {
    return c.json(
      { code: 'INVALID_INPUT', message: `platforms 最多 ${MAX_PLATFORMS} 个` },
      400,
    );
  }

  const user = getUser(c);
  const reportId = `report-${crypto.randomUUID()}`;

  if (!env.DB) {
    return c.json({ code: 'DB_NOT_CONFIGURED', message: 'D1 binding missing' }, 500);
  }

  // C2 hardening: atomic pre-charge. The previous SELECT-then-check-then-
  // increment had a TOCTOU race — two concurrent requests with quota_used=29
  // would both pass the gate and both consume LLM cost. The single
  // conditional UPDATE either moves the counter forward or returns 0
  // changes, which we disambiguate into 401 vs 402 below.
  const quotaResult = await env.DB
    .prepare(
      `UPDATE users
       SET quota_used = quota_used + 1
       WHERE id = ? AND quota_used < quota_limit`,
    )
    .bind(user.sub)
    .run();
  if (quotaResult.meta.changes === 0) {
    // Either the user vanished (JWT stale) or quota was already at the
    // ceiling. One follow-up SELECT distinguishes the two so we return
    // the correct status code.
    const userRow = await env.DB
      .prepare('SELECT quota_used, quota_limit FROM users WHERE id = ?')
      .bind(user.sub)
      .first<{ quota_used: number; quota_limit: number }>();
    if (!userRow) {
      return c.json({ code: 'AUTH_REQUIRED', message: '请先登录' }, 401);
    }
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

      // C2: refund on any unexpected failure from the predictor. The
      // pre-charge above already moved quota_used forward; if the LLM
      // orchestrator blows up we must give the user that slot back so
      // a transient blip does not silently consume their monthly quota.
      try {
        await runPredictionStream(env, user.sub, reportId, title, platforms, (event) => {
          try {
            controller.enqueue(new TextEncoder().encode(event));
          } catch {
            // Sink may be closed (client cancelled); nothing to do.
          }
        });
      } catch (err) {
        if (env.DB) {
          await env.DB
            .prepare(
              'UPDATE users SET quota_used = quota_used - 1 WHERE id = ? AND quota_used > 0',
            )
            .bind(user.sub)
            .run();
        }
        throw err;
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed (e.g. cancel fired); ignore.
        }
      }
    },
    // H2: client disconnected mid-stream. Refund the pre-charge so the
    // user does not silently lose a quota slot to a navigation event,
    // and mark the report aborted so /predictions does not show a hung
    // \`streaming\` row.
    async cancel() {
      if (!env.DB) return;
      try {
        await env.DB
          .prepare(
            'UPDATE reports SET status=?, completed_at=? WHERE id=?',
          )
          .bind('aborted', Math.floor(Date.now() / 1000), reportId)
          .run();
        await env.DB
          .prepare(
            'UPDATE users SET quota_used = quota_used - 1 WHERE id = ? AND quota_used > 0',
          )
          .bind(user.sub)
          .run();
      } catch {
        // Best-effort cleanup; if D1 is unhappy we do not want to mask
        // the original cancellation error.
      }
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
