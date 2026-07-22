import { describe, it, expect } from 'vitest';
import app from '../../src/index';

describe('POST /api/simulate', () => {
  it('returns 200 with report for valid request', async () => {
    const res = await app.request('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: {
          title: '测试内容',
          cover: 'url',
          tags: ['测试'],
        },
        persona_count: 10,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.report).toBeDefined();
    expect(data.report.decision).toMatch(/publish|modify|not_publish|retest/);
  });

  it('returns 400 for missing content', async () => {
    const res = await app.request('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona_count: 10 }),
    });

    expect(res.status).toBe(400);
  });
});
