import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, consumeSse } from '../../src/api/client';

/**
 * Helper: build a fake ReadableStreamDefaultReader whose `read()` returns
 * the provided chunks in order, then `{ done: true }`. Each chunk is a
 * Uint8Array (TextEncoder-encoded SSE bytes) so the decoder inside
 * consumeSse sees what real fetch would deliver.
 */
function makeSseReader(chunks: string[]) {
  const encoded = chunks.map((s) => new TextEncoder().encode(s));
  const calls = { count: 0 };
  const reader = {
    read: vi.fn(async () => {
      const i = calls.count++;
      if (i < encoded.length) {
        return { done: false, value: encoded[i] };
      }
      return { done: true, value: undefined };
    }),
  };
  return reader as unknown as ReadableStreamDefaultReader<Uint8Array>;
}

describe('apiFetch', () => {
  beforeEach(() => {
    // test/setup.ts installs a polyfilled localStorage and clears it
    // before each test, so any leftover JWT from earlier suites is gone.
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('attaches Bearer token when present in localStorage', async () => {
    localStorage.setItem('qizai_jwt', 'token-abc');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));

    await apiFetch('/api/predict/stream', { method: 'POST' });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [path, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/predict/stream');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Authorization']).toBe('Bearer token-abc');
  });

  it('omits Authorization when no token in localStorage', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));

    await apiFetch('/api/foo');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
    expect(headers['Content-Type']).toBe('application/json');
  });
});

describe('consumeSse', () => {
  it('parses start event from stream', async () => {
    const reader = makeSseReader([
      'event: start\ndata: {"report_id":"r1"}\n\n',
    ]);
    const onEvent = vi.fn();

    await consumeSse(reader, onEvent);

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({
      type: 'start',
      data: { report_id: 'r1' },
    });
  });

  it('parses complete event with JSON data', async () => {
    const reader = makeSseReader([
      'event: complete\ndata: {"report_id":"r-final","ok":true}\n\n',
    ]);
    const onEvent = vi.fn();

    await consumeSse(reader, onEvent);

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({
      type: 'complete',
      data: { report_id: 'r-final', ok: true },
    });
  });

  it('calls onEvent for each event block', async () => {
    // Three events delivered across two chunks; the second chunk picks up
    // mid-block to also exercise the buffer flush.
    const reader = makeSseReader([
      'event: start\ndata: {"report_id":"r1"}\n\nevent: progress\ndata: {"p":50}\n',
      '\nevent: complete\ndata: {"report_id":"r1"}\n\n',
    ]);
    const onEvent = vi.fn();

    await consumeSse(reader, onEvent);

    expect(onEvent).toHaveBeenCalledTimes(3);
    expect(onEvent.mock.calls[0][0]).toEqual({
      type: 'start',
      data: { report_id: 'r1' },
    });
    expect(onEvent.mock.calls[1][0]).toEqual({
      type: 'progress',
      data: { p: 50 },
    });
    expect(onEvent.mock.calls[2][0]).toEqual({
      type: 'complete',
      data: { report_id: 'r1' },
    });
  });
});