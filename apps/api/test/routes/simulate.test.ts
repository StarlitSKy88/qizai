import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import app from '../../src/index';

describe('POST /api/simulate', () => {
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

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

  it('uses c.env (with process.env fallback) when c.env is undefined', async () => {
    // 验证：当 c.env 未注入（本地 Node 测试），fallback 到 process.env 仍可工作。
    // 这是 Cloudflare Workers 安全要求（process.env 在 Workers 中不安全）的友好回退。
    process.env.NODE_ENV = 'test';

    const res = await app.request('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: {
          title: 'Fallback env test',
          cover: 'url',
          tags: [],
        },
        persona_count: 5,
      }),
    });

    // Node 测试环境中 c.env 为 undefined，路由应 fallback 到 process.env.NODE_ENV='test'
    expect(res.status).toBe(200);
  });
});
