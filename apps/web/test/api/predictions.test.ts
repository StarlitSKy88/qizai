import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the API client so predictions.ts exercises the real stream/list/get
// wiring (request shape, SSE consumption, error mapping) without opening a
// network socket. `consumeSse` is replaced by a pass-through that calls
// onEvent for each provided event so we can assert on event delivery order
// without standing up a ReadableStream in the test. `apiFetch` returns a
// fake Response whose `.ok`/`.status`/`.body`/`.json()` are configured per
// test, matching the server contract in apps/api/src/routes/{predict,report}.ts.
vi.mock('../../src/api/client', () => ({
  apiFetch: vi.fn(),
  consumeSse: vi.fn(),
}));

import { apiFetch, consumeSse } from '../../src/api/client';
import {
  streamPrediction,
  listReports,
  getReport,
} from '../../src/api/predictions';

const mockedApiFetch = vi.mocked(apiFetch);
const mockedConsumeSse = vi.mocked(consumeSse);

/**
 * Build a minimal Response-like object with the subset of fields
 * predictions.ts reads. We avoid the global `Response` because jsdom 29
 * ships a stripped stub that throws on `.json()` for non-2xx with no
 * body — our 404 test path needs to read `.json()` regardless of status.
 */
function fakeResponse(opts: {
  ok: boolean;
  status?: number;
  body?: unknown;
  withStream?: boolean;
}): Response {
  const { ok, status = ok ? 200 : 400, body = {}, withStream = false } = opts;
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
    // streamPrediction reads `r.body?.getReader()` to hand to consumeSse.
    // The mocked consumeSse in our test never actually calls `.read()`,
    // so a stub reader is enough — we just need the truthy-getReader path
    // to pass the `!r.body` guard.
    ...(withStream
      ? { body: { getReader: vi.fn().mockReturnValue({}) } }
      : {}),
  } as unknown as Response;
}

describe('predictions', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    mockedConsumeSse.mockReset();
  });

  it('streamPrediction emits 5 event types from mock SSE', async () => {
    // Server contract: POST /api/predict/stream with { content: { title },
    // platforms: ['xhs', 'tiktok', 'bilibili'] } and a 200 response whose
    // body is an SSE stream of start / progress / boost_triggered /
    // complete / error events.
    mockedApiFetch.mockResolvedValue(
      fakeResponse({ ok: true, status: 200, withStream: true }),
    );

    // Make the mocked consumeSse fire one of each event so we can assert
    // that streamPrediction forwards them to the caller's onEvent.
    const events = [
      { type: 'start', data: { report_id: 'r1', total_personas: 1000 } },
      {
        type: 'progress',
        data: {
          report_id: 'r1',
          platform: 'xhs',
          completed: 50,
          total: 100,
          diversity: 0.7,
        },
      },
      {
        type: 'boost_triggered',
        data: { report_id: 'r1', platform: 'tiktok', count: 5 },
      },
      { type: 'complete', data: { report_id: 'r1', report: { ok: true } } },
      { type: 'error', data: { code: 'LLM_FAILED', message: 'upstream 502' } },
    ];
    mockedConsumeSse.mockImplementation(async (_reader, onEvent) => {
      for (const e of events) onEvent(e as any);
    });

    const received: any[] = [];
    await streamPrediction('hello world', (e) => received.push(e));

    // 5 event types emitted by the mock stream → 5 callbacks delivered.
    expect(received).toHaveLength(5);
    expect(received.map((e) => e.type)).toEqual([
      'start',
      'progress',
      'boost_triggered',
      'complete',
      'error',
    ]);

    // Request shape must match the server contract in
    // apps/api/src/routes/predict.ts.
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
    const [path, init] = mockedApiFetch.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(path).toBe('/api/predict/stream');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(
      JSON.stringify({
        content: { title: 'hello world' },
        platforms: ['xhs', 'tiktok', 'bilibili'],
      }),
    );
  });

  it('listReports returns array from /api/report', async () => {
    const summaries = [
      {
        id: 'r1',
        title: 'first',
        status: 'completed',
        created_at: 1,
        completed_at: 2,
      },
      {
        id: 'r2',
        title: 'second',
        status: 'running',
        created_at: 3,
        completed_at: null,
      },
    ];
    mockedApiFetch.mockResolvedValue(
      fakeResponse({ ok: true, status: 200, body: { reports: summaries } }),
    );

    const result = await listReports();

    expect(result).toEqual(summaries);
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
    expect(mockedApiFetch.mock.calls[0][0]).toBe('/api/report');
  });

  it('getReport returns full report object', async () => {
    const detail = {
      id: 'r1',
      title: 'first',
      status: 'completed',
      report: { verdict: 'go' },
      evidence: { posts: 12 },
      created_at: 1,
      completed_at: 2,
    };
    mockedApiFetch.mockResolvedValue(
      fakeResponse({ ok: true, status: 200, body: detail }),
    );

    const result = await getReport('r1');

    expect(result).toEqual(detail);
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
    expect(mockedApiFetch.mock.calls[0][0]).toBe('/api/report/r1');
  });

  it('streamPrediction throws on 401', async () => {
    // 401 from /api/predict/stream means the JWT is missing or stale.
    // The auth middleware in apps/api/src/middleware/auth.ts returns
    // { code: 'AUTH_REQUIRED', ... } with status 401. streamPrediction must
    // surface the HTTP status in the error message so the UI can route
    // the user back to /login.
    mockedApiFetch.mockResolvedValue(
      fakeResponse({ ok: false, status: 401 }),
    );

    await expect(
      streamPrediction('hi', () => {}),
    ).rejects.toThrowError(/HTTP 401/);

    // consumeSse must NOT be called when the response is non-ok — otherwise
    // a 401 would attempt to read from a null body.
    expect(mockedConsumeSse).not.toHaveBeenCalled();
  });

  it('getReport throws on 404', async () => {
    // The server's getReport handler returns 404 with { code: 'NOT_FOUND' }
    // when no row exists for that id. getReport must surface the HTTP
    // status in the error message so callers can distinguish a 404 from a
    // 500 or a 403 without parsing message strings.
    mockedApiFetch.mockResolvedValue(
      fakeResponse({ ok: false, status: 404 }),
    );

    await expect(getReport('nope')).rejects.toThrowError(/HTTP 404/);
  });
});