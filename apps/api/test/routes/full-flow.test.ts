import { describe, it, expect } from 'vitest';
import app from '../../src/index';

describe('Integration: POST /api/simulate full flow', () => {
  it('completes end-to-end with mock LLM', async () => {
    process.env.NODE_ENV = 'test';

    const start = Date.now();

    const res = await app.request('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: {
          title: '三招教你选对洗面奶',
          cover: 'image-url',
          tags: ['美妆', '护肤'],
        },
        persona_count: 50,
      }),
    });

    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.report).toBeDefined();
    expect(data.report.decision).toMatch(/publish|modify|not_publish|retest/);
    expect(data.simulation.persona_count).toBe(50);
    expect(data.simulation.diversity).toBeGreaterThanOrEqual(0);
    expect(data.simulation.diversity).toBeLessThanOrEqual(1);
    expect(elapsed).toBeLessThan(60000);
  });

  it('rejects request with missing content', async () => {
    process.env.NODE_ENV = 'test';

    const res = await app.request('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona_count: 50 }),
    });

    expect(res.status).toBe(400);
  });

  it('GET / returns health check', async () => {
    const res = await app.request('/');

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('qizai-api-ok');
  });
});
