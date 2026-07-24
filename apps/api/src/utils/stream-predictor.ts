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
// Robustness (v0.14 review fixes):
//   - SSE heartbeat: a `: heartbeat\n\n` SSE comment is emitted every 25s
//     so the Cloudflare Workers proxy (30s idle timeout) does not drop the
//     stream mid-flight. The interval is cleared in a finally block.
//   - SSE `error` event with code `LLM_DOWN`: if all 3 LLM providers in the
//     router fail for a given platform (engine.simulate throws), we emit
//     `error` and a `status='error'` D1 UPDATE, then return so the route
//     can close the stream cleanly instead of hanging.
//   - H1: post-loop report generation + D1 write wrapped in try/catch so
//     any unexpected throw there no longer leaves the report stuck in
//     `streaming`. The route's own try/catch (C2) still refunds quota on
//     rethrow.
//   - H1: every `emit(...)` is wrapped by `safeEmit` so a closed sink
//     (client cancelled mid-stream) never throws out of this function.
//
// Signature (T17): userSub threaded through as the 2nd positional arg so the
// orchestrator can refund quota via the route's try/catch on failure:
//   runPredictionStream(env, userSub, reportId, title, platforms, emit)

import { PersonaBuilder } from '@qizai/shared/persona/builder';
import { SimulationEngine } from '@qizai/shared/simulation/engine';
import type { SimulationResult } from '@qizai/shared/simulation/engine';
import { ReportGenerator } from '@qizai/shared/report/generator';
import { LLMRouter } from '@qizai/shared/llm/router';
import { sseEvent, sseComment } from './sse';
import type { AppEnv } from './env';

const PERSONAS_PER_PLATFORM = 100;
// CF Workers proxy idle timeout is 30s; emit a comment every 25s so the
// connection is never considered idle. See https://developers.cloudflare.com/workers/configuration/limits/#runtime
const HEARTBEAT_INTERVAL_MS = 25_000;

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

  // H1: every emit goes through `safeEmit` so a closed sink (client
  // cancelled mid-stream) does not turn into an unhandled rejection.
  const safeEmit = (chunk: string): void => {
    try {
      emit(chunk);
    } catch {
      // Sink closed; swallow so we can keep going through the finally
      // block where the heartbeat interval gets cleared.
    }
  };

  // SSE heartbeat: keep the connection alive across the 30s CF proxy
  // timeout. Comments (lines starting with `:`) are ignored by EventSource
  // consumers but reset the proxy's idle timer.
  const heartbeatInterval = setInterval(() => {
    safeEmit(sseComment('heartbeat'));
  }, HEARTBEAT_INTERVAL_MS);

  try {
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

      let result: SimulationResult;
      try {
        result = await engine.simulate(title, personas);
      } catch (err) {
        // All 3 LLM providers failed for this platform. Surface a
        // user-facing SSE error and mark the report row as failed so the
        // user does not see a hanging `streaming` row forever.
        safeEmit(
          sseEvent('error', {
            code: 'LLM_DOWN',
            message: 'AI 临时不可用',
          }),
        );
        if (env.DB) {
          await env.DB
            .prepare(
              `UPDATE reports
               SET status=?, completed_at=?
               WHERE id=?`,
            )
            .bind('error', Math.floor(Date.now() / 1000), reportId)
            .run();
        }
        return;
      }

      runs.push({ platform, result });
      totalBoosted += result.boostedCount;

      safeEmit(
        sseEvent('progress', {
          report_id: reportId,
          platform,
          completed: PERSONAS_PER_PLATFORM,
          total: PERSONAS_PER_PLATFORM,
          diversity: result.diversity,
        }),
      );

      if (result.boostedCount > 0) {
        safeEmit(
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
      safeEmit(
        sseEvent('complete', {
          report_id: reportId,
          report: null,
        }),
      );
      return;
    }

    // H1: report generation can throw if the persona data shape drifts
    // from the generator's expectation. Without this guard a thrown
    // generator would leave the report stuck in `streaming` forever
    // because the D1 UPDATE never runs. Surface a `GENERATION_FAILED`
    // error event and mark the row failed instead.
    let report: ReturnType<ReportGenerator['generate']>;
    try {
      const finalRun = runs[runs.length - 1];
      report = generator.generate(
        { title, cover: '', tags: [] },
        finalRun.result,
      );
    } catch (err) {
      safeEmit(
        sseEvent('error', {
          code: 'GENERATION_FAILED',
          message: '报告生成失败',
        }),
      );
      if (env.DB) {
        await env.DB
          .prepare(
            `UPDATE reports SET status=?, completed_at=? WHERE id=?`,
          )
          .bind('error', Math.floor(Date.now() / 1000), reportId)
          .run();
      }
      return;
    }
    const diversity = avg(runs.map((r) => r.result.diversity));

    // H1: the D1 UPDATE itself can fail (transient D1 error, schema drift,
    // disk full). Wrap it so we do not emit a `complete` event whose data
    // was never persisted — that would let the user click into a report
    // page that then 404s or shows nothing.
    if (env.DB) {
      try {
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
      } catch (err) {
        safeEmit(
          sseEvent('error', {
            code: 'DB_WRITE_FAILED',
            message: '数据库写入失败',
          }),
        );
        await env.DB
          .prepare(
            `UPDATE reports SET status=?, completed_at=? WHERE id=?`,
          )
          .bind('error', Math.floor(Date.now() / 1000), reportId)
          .run();
        return;
      }
    }

    safeEmit(
      sseEvent('complete', {
        report_id: reportId,
        report,
      }),
    );

    // C2: quota is pre-charged in predict.ts before this function runs. Do
    // not charge again here — that would double-count. The empty-platform
    // guard above returns early, so the pre-charge stays; the route's
    // try/catch is responsible for refunding on any unexpected throw.
  } finally {
    clearInterval(heartbeatInterval);
  }
}

function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}