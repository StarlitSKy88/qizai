// apps/api/src/utils/stream-predictor.ts
//
// T15 — serial 3-platform orchestrator. Replaces the T12-T13 stub.
//
// Per platform (serial, per ADR-008):
//   1. Build 100 balanced personas via PersonaBuilder
//   2. Run SimulationEngine (which calls LLMRouter → 1st batch + optional boost)
//   3. Emit SSE `progress` event with {report_id, platform, completed, total, diversity}
//   4. If result.boostedCount > 0, emit SSE `boost_triggered` event
//
// After all platforms:
//   5. Run ReportGenerator on the final platform's result to produce the final report
//   6. UPDATE D1 reports row: status='done' + report_json + evidence_pack + diversity
//      + boosted_count + completed_at  (only when env.DB is bound)
//   7. Emit SSE `complete` event with {report_id, report}
//
// Signature (T17): userSub threaded through as the 2nd positional arg so the
// orchestrator can increment quota_used on the users row after a successful
// `complete`:
//   runPredictionStream(env, userSub, reportId, title, platforms, emit)

import { PersonaBuilder } from '@qizai/shared/persona/builder';
import { SimulationEngine } from '@qizai/shared/simulation/engine';
import type { SimulationResult } from '@qizai/shared/simulation/engine';
import { ReportGenerator } from '@qizai/shared/report/generator';
import { LLMRouter } from '@qizai/shared/llm/router';
import { sseEvent } from './sse';
import type { AppEnv } from './env';

const PERSONAS_PER_PLATFORM = 100;

interface PlatformRun {
  platform: string;
  result: SimulationResult;
}

export async function runPredictionStream(
  env: AppEnv,
  userSub: string,
  reportId: string,
  title: string,
  platforms: string[],
  emit: (chunk: string) => void,
): Promise<void> {
  const router = new LLMRouter({
    alibabaKey: env.ALIBABA_BAILIAN_API_KEY ?? '',
    fireworksKey: env.FIREWORKS_API_KEY ?? '',
    deepseekKey: env.DEEPSEEK_API_KEY ?? '',
  });
  const generator = new ReportGenerator();
  const personaBuilder = new PersonaBuilder();
  const runs: PlatformRun[] = [];
  let totalBoosted = 0;

  for (const platform of platforms) {
    const personas = personaBuilder.buildBalanced({
      topic: title,
      count: PERSONAS_PER_PLATFORM,
    });
    const engine = new SimulationEngine({
      router,
      concurrency: 100,
      diversityThreshold: 0.40,
    });
    const result = await engine.simulate(title, personas);
    runs.push({ platform, result });
    totalBoosted += result.boostedCount;

    emit(
      sseEvent('progress', {
        report_id: reportId,
        platform,
        completed: PERSONAS_PER_PLATFORM,
        total: PERSONAS_PER_PLATFORM,
        diversity: result.diversity,
      }),
    );

    if (result.boostedCount > 0) {
      emit(
        sseEvent('boost_triggered', {
          report_id: reportId,
          platform,
          count: result.boostedCount,
        }),
      );
    }
  }

  // Empty-platform guard: emit complete immediately with a stub report and
  // skip the D1 UPDATE so the route never hangs waiting for a non-existent
  // final result. The route already inserted the `streaming` row; the safest
  // transition is to leave it untouched rather than overwrite with garbage.
  if (runs.length === 0) {
    emit(
      sseEvent('complete', {
        report_id: reportId,
        report: null,
      }),
    );
    return;
  }

  // ReportGenerator.generate(content, result) takes a single SimulationResult.
  // We feed it the final platform's result; multi-platform aggregation (e.g.
  // cross-platform evidence) is a future task. Diversity for the D1 row is
  // averaged across all platforms so the summary reflects the whole sweep.
  const finalRun = runs[runs.length - 1];
  const report = generator.generate(
    { title, cover: '', tags: [] },
    finalRun.result,
  );
  const diversity = avg(runs.map((r) => r.result.diversity));

  if (env.DB) {
    await env.DB
      .prepare(
        `UPDATE reports
         SET status='done',
             report_json=?,
             evidence_pack=?,
             diversity=?,
             boosted_count=?,
             completed_at=?
         WHERE id=?`,
      )
      .bind(
        JSON.stringify(report),
        JSON.stringify(report.evidence ?? {}),
        diversity,
        totalBoosted,
        Math.floor(Date.now() / 1000),
        reportId,
      )
      .run();
  }

  emit(
    sseEvent('complete', {
      report_id: reportId,
      report,
    }),
  );

  // T17: charge the user's quota only on a real completion (a report was
  // generated and the D1 row was updated). The empty-platform guard above
  // returns early, so no quota is charged for an empty sweep.
  if (env.DB) {
    await env.DB
      .prepare(`UPDATE users SET quota_used = quota_used + 1 WHERE id = ?`)
      .bind(userSub)
      .run();
  }
}

function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}