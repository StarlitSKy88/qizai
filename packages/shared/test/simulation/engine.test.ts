import { describe, it, expect, vi } from 'vitest';
import { SimulationEngine } from '../../src/simulation/engine';
import type { Persona } from '../../src/persona/types';

const mockPersonas: Persona[] = Array.from({ length: 10 }, (_, i) => ({
  id: `p-${i}`,
  ocean: { O: 0, C: 0, E: 0, A: 0, N: 0 },
  demographics: { age: 25, age_group: '年轻人', gender: 'female', city: '一线', occupation: '白领' },
  platform: { accountAge: 365, contentPreference: [], behaviorPattern: 'browse', activeHours: [20], dwellBaseline: 30 },
  stance_label: i % 3 === 0 ? 'conservative' : i % 3 === 1 ? 'neutral' : 'liberal',
  stance_strength: 0.5,
  controversy_score: 0.5,
  language: 'meme',
}));

describe('SimulationEngine', () => {
  it('simulates all personas with concurrency limit', async () => {
    const mockRouter = {
      complete: vi.fn().mockImplementation(async (_prompt: string, persona: Persona) => {
        await new Promise(r => setTimeout(r, 10));
        return `${persona.id} reaction: positive`;
      }),
    } as any;

    const engine = new SimulationEngine({
      router: mockRouter,
      concurrency: 5,
      diversityThreshold: 0.40,
    });

    const result = await engine.simulate('Test content', mockPersonas);

    expect(result.outputs).toHaveLength(10);
    expect(mockRouter.complete).toHaveBeenCalledTimes(10);
    expect(result.manualInterventionRequired).toBe(false);
  });

  it('triggers EXTREME_PROMPT_BOOST when output is extreme (z-score > 2)', async () => {
    const extremePersonaId = 'p-4';
    const mockRouter = {
      complete: vi.fn().mockImplementation(async (prompt: string, persona: Persona) => {
        if (prompt.includes('反思')) {
          return 'moderated response after boost';
        }
        if (persona.id === extremePersonaId) {
          return 'x'.repeat(1000001); // 极端长度，确保 z-score > 2.0
        }
        return 'short'; // 短响应，5 chars
      }),
    } as any;

    const engine = new SimulationEngine({
      router: mockRouter,
      concurrency: 5,
      diversityThreshold: 0.99, // 强制触发 boost 路径
    });

    // 使用同一立场的 persona，强制触发 boost 路径（diversity=0 < 0.99）
    const sameStancePersonas = mockPersonas.slice(0, 5).map(p => ({
      ...p,
      stance_label: 'conservative' as const,
    }));

    const result = await engine.simulate('Controversial content', sameStancePersonas);

    // 验证 boost 被触发（检查 router 被调用了包含"反思"的 boost prompt）
    const boostCalls = mockRouter.complete.mock.calls.filter(([prompt]) => prompt.includes('反思'));
    expect(boostCalls.length).toBeGreaterThan(0);
    expect(result.boostedCount).toBeGreaterThan(0);
  });

  it('passes original content into boost prompt when applyBoost triggers', async () => {
    const extremePersonaId = 'p-4';
    const originalContent = 'ORIGINAL_CONTENT_KEYWORD_xyz123';
    const mockRouter = {
      complete: vi.fn().mockImplementation(async (prompt: string, persona: Persona) => {
        if (prompt.includes('反思')) {
          return 'moderated response after boost';
        }
        if (persona.id === extremePersonaId) {
          return 'x'.repeat(1000001); // 极端长度，确保 z-score > 2.0
        }
        return 'short';
      }),
    } as any;

    const engine = new SimulationEngine({
      router: mockRouter,
      concurrency: 5,
      diversityThreshold: 0.99, // 强制触发 boost
    });

    const sameStancePersonas = mockPersonas.slice(0, 5).map(p => ({
      ...p,
      stance_label: 'conservative' as const,
    }));

    await engine.simulate(originalContent, sameStancePersonas);

    // 至少有一次 boost prompt 调用必须包含原始 content 关键字
    const boostCalls = mockRouter.complete.mock.calls.filter(([prompt]) => prompt.includes('反思'));
    expect(boostCalls.length).toBeGreaterThan(0);
    const containsOriginalContent = boostCalls.some(([prompt]) =>
      prompt.includes(originalContent)
    );
    expect(containsOriginalContent).toBe(true);
  });

  it('honours options.boostThreshold — high threshold suppresses boost', async () => {
    // 同一个极端输出在 threshold=10.0（极高）时不应触发 boost
    const extremePersonaId = 'p-4';
    const mockRouter = {
      complete: vi.fn().mockImplementation(async (prompt: string, persona: Persona) => {
        if (prompt.includes('反思')) {
          return 'moderated response after boost';
        }
        if (persona.id === extremePersonaId) {
          return 'x'.repeat(1000001); // 极端长度
        }
        return 'short';
      }),
    } as any;

    const engine = new SimulationEngine({
      router: mockRouter,
      concurrency: 5,
      diversityThreshold: 0.99, // 强制触发 boost 路径
      boostThreshold: 10.0, // 极高阈值，使得 z-score 永远不达
    });

    const sameStancePersonas = mockPersonas.slice(0, 5).map(p => ({
      ...p,
      stance_label: 'conservative' as const,
    }));

    const result = await engine.simulate('Some content', sameStancePersonas);

    // 极高阈值应阻止 boost 触发
    expect(result.boostedCount).toBe(0);
    const boostCalls = mockRouter.complete.mock.calls.filter(([prompt]) => prompt.includes('反思'));
    expect(boostCalls.length).toBe(0);
  });

  it('honours options.boostThreshold — low threshold still triggers boost', async () => {
    // 同一个"普通长度"输出在 threshold=0.1（极低）时应触发 boost
    const mockRouter = {
      complete: vi.fn().mockImplementation(async (prompt: string, _persona: Persona) => {
        if (prompt.includes('反思')) {
          return 'moderated response after boost';
        }
        return 'react-' + 'x'.repeat(15); // 15 字符长度的反应，mean 接近 15，std 接近 0
      }),
    } as any;

    // 计算 z-score: 当所有输出长度都是 ~23 chars 时 std=0，shouldTriggerBoost 返回 false。
    // 因此这里使用稍微不同的长度以让 std > 0
    let callIdx = 0;
    const varyingLengthRouter = {
      complete: vi.fn().mockImplementation(async (prompt: string, _persona: Persona) => {
        if (prompt.includes('反思')) {
          return 'moderated';
        }
        // 创建一个分布: 大部分短回复 + 一个超长回复
        const lengths = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
        const reaction = 'x'.repeat(lengths[callIdx++ % lengths.length]);
        return reaction;
      }),
    };

    const engine = new SimulationEngine({
      router: varyingLengthRouter as any,
      concurrency: 5,
      diversityThreshold: 0.99,
      boostThreshold: 0.1, // 极低阈值, 几乎所有非零 z-score 都触发
    });

    const sameStancePersonas = mockPersonas.slice(0, 5).map(p => ({
      ...p,
      stance_label: 'conservative' as const,
    }));

    const result = await engine.simulate('Some content', sameStancePersonas);

    // 在极低阈值下，应该至少有 boost 被触发
    expect(result.boostedCount).toBeGreaterThan(0);

    // Silence unused
    void mockRouter;
    void callIdx;
  });
});
