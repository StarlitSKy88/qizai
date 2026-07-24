/**
 * apps/web/src/api/predictions.ts
 *
 * Predictions client for the web UI. Wraps three endpoints served by
 * apps/api/src/routes/{predict,report}.ts:
 *
 *   POST /api/predict/stream   → SSE stream of 5 event types
 *                                 (start / progress / boost_triggered /
 *                                  complete / error). Consumed via
 *                                  `consumeSse` from ./client.
 *   GET  /api/report           → list the current user's last 50 reports.
 *                                 The Hono router is mounted at `/api/report`
 *                                 and the list handler lives at `/`, so the
 *                                 full path is `/api/report` (no trailing
 *                                 slash). Earlier plans said `/api/report/`
 *                                 but Hono does not auto-redirect here, so
 *                                 we use the working form.
 *   GET  /api/report/:id       → fetch a single report + its evidence pack.
 *
 * The `PredictionEvent` union mirrors the server contract in
 * apps/api/src/routes/predict.ts — keep the two in sync when adding new
 * event types.
 */
import { apiFetch, consumeSse } from './client';

export interface PredictionProgress {
  report_id: string;
  platform: string;
  completed: number;
  total: number;
  diversity: number;
}

export interface PredictionComplete {
  report_id: string;
  report: unknown;
}

export type PredictionEvent =
  | { type: 'start'; data: { report_id: string; total_personas: number } }
  | { type: 'progress'; data: PredictionProgress }
  | {
      type: 'boost_triggered';
      data: { report_id: string; platform: string; count: number };
    }
  | { type: 'complete'; data: PredictionComplete }
  | { type: 'error'; data: { code: string; message: string } };

export async function streamPrediction(
  title: string,
  onEvent: (e: PredictionEvent) => void,
): Promise<void> {
  const r = await apiFetch('/api/predict/stream', {
    method: 'POST',
    body: JSON.stringify({
      content: { title },
      platforms: ['xhs', 'tiktok', 'bilibili'],
    }),
  });
  if (!r.ok || !r.body) throw new Error(`Predict failed: HTTP ${r.status}`);
  await consumeSse(r.body.getReader(), (e) =>
    onEvent(e as unknown as PredictionEvent),
  );
}

export interface ReportSummary {
  id: string;
  title: string;
  status: string;
  created_at: number;
  completed_at: number | null;
}

export async function listReports(): Promise<ReportSummary[]> {
  const r = await apiFetch('/api/report');
  if (!r.ok) throw new Error(`List failed: HTTP ${r.status}`);
  return (await (r.json() as Promise<{ reports: ReportSummary[] }>)).reports;
}

export interface ReportDetail {
  id: string;
  title: string;
  status: string;
  report: unknown;
  evidence: unknown;
  created_at: number;
  completed_at: number | null;
}

export async function getReport(id: string): Promise<ReportDetail> {
  const r = await apiFetch(`/api/report/${id}`);
  if (!r.ok) throw new Error(`Get failed: HTTP ${r.status}`);
  return r.json() as Promise<ReportDetail>;
}