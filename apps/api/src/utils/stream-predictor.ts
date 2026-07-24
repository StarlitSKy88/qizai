// apps/api/src/utils/stream-predictor.ts
//
// T12 stub. T15 will replace this with the full 3-platform serial orchestrator
// (xhs → dy → wb → final report). For T12-T13 we just emit a single `progress`
// event so the route shell has something to validate.
//
// Signature MUST stay stable across T12→T17:
//   runPredictionStream(env, reportId, title, platforms, emit)
// (T17 will add `userId` as a 3rd positional arg — the orchestrator needs it
// for quota reservation and rate-limit accounting.)

import { sseEvent } from './sse';
import type { AppEnv } from './env';

export async function runPredictionStream(
  env: AppEnv,
  reportId: string,
  title: string,
  platforms: string[],
  emit: (chunk: string) => void,
): Promise<void> {
  // Emit a single progress event as placeholder for T15's multi-stage
  // orchestration. Avoid touching env.DB here — the route already inserted
  // the report row in `streaming` state, and the orchestrator owns the
  // `streaming → done` transition in T15.
  emit(
    sseEvent('progress', {
      report_id: reportId,
      platform: platforms[0] ?? 'xhs',
      completed: 0,
      total: 100,
      title_preview: title.slice(0, 32),
    }),
  );
}
