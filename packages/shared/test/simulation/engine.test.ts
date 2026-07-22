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
});
