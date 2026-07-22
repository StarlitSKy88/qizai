import { describe, it, expect, vi } from 'vitest';
import { LLMRouter } from '../../src/llm/router';
import type { Persona } from '../../src/persona/types';

vi.mock('../../src/llm/alibaba');
vi.mock('../../src/llm/fireworks');
vi.mock('../../src/llm/deepseek');

const mockPersona: Persona = {
  id: 'test-1',
  ocean: { O: 0, C: 0, E: 0, A: 0, N: 0 },
  demographics: { age: 25, age_group: '年轻人', gender: 'female', city: '一线', occupation: '白领' },
  platform: { accountAge: 365, contentPreference: ['美妆'], behaviorPattern: 'browse', activeHours: [20], dwellBaseline: 30 },
  stance_label: 'neutral',
  stance_strength: 0.5,
  controversy_score: 0.5,
  language: 'meme',
};

describe('LLMRouter', () => {
  it('uses Alibaba qwen3.5-flash as primary', async () => {
    const { AlibabaProvider } = await import('../../src/llm/alibaba');
    const mockComplete = vi.fn().mockResolvedValue('Alibaba response');
    vi.mocked(AlibabaProvider).mockImplementation(() => ({
      complete: mockComplete,
      getModel: () => 'qwen3.5-flash',
    } as any));

    const router = new LLMRouter({ alibabaKey: 'k1', fireworksKey: 'k2', deepseekKey: 'k3' });
    const result = await router.complete('test prompt', mockPersona);

    expect(result).toBe('Alibaba response');
    expect(mockComplete).toHaveBeenCalled();
  });

  it('falls back to Fireworks when Alibaba fails', async () => {
    const { AlibabaProvider } = await import('../../src/llm/alibaba');
    const { FireworksProvider } = await import('../../src/llm/fireworks');

    vi.mocked(AlibabaProvider).mockImplementation(() => ({
      complete: vi.fn().mockRejectedValue(new Error('Rate limit')),
      getModel: () => 'qwen3.5-flash',
    } as any));

    const mockFireworks = vi.fn().mockResolvedValue('Fireworks fallback');
    vi.mocked(FireworksProvider).mockImplementation(() => ({
      complete: mockFireworks,
      getModel: () => 'qwen3p7-plus',
    } as any));

    const router = new LLMRouter({ alibabaKey: 'k1', fireworksKey: 'k2', deepseekKey: 'k3' });
    const result = await router.complete('test prompt', mockPersona);

    expect(result).toBe('Fireworks fallback');
    expect(mockFireworks).toHaveBeenCalled();
  });

  it('falls back to DeepSeek when Alibaba + Fireworks both fail', async () => {
    const { AlibabaProvider } = await import('../../src/llm/alibaba');
    const { FireworksProvider } = await import('../../src/llm/fireworks');
    const { DeepSeekProvider } = await import('../../src/llm/deepseek');

    vi.mocked(AlibabaProvider).mockImplementation(() => ({
      complete: vi.fn().mockRejectedValue(new Error('Rate limit')),
      getModel: () => 'qwen3.5-flash',
    } as any));

    vi.mocked(FireworksProvider).mockImplementation(() => ({
      complete: vi.fn().mockRejectedValue(new Error('Service down')),
      getModel: () => 'qwen3p7-plus',
    } as any));

    const mockDeepSeek = vi.fn().mockResolvedValue('DeepSeek fallback');
    vi.mocked(DeepSeekProvider).mockImplementation(() => ({
      complete: mockDeepSeek,
      getModel: () => 'deepseek-v4-flash',
    } as any));

    const router = new LLMRouter({ alibabaKey: 'k1', fireworksKey: 'k2', deepseekKey: 'k3' });
    const result = await router.complete('test prompt', mockPersona);

    expect(result).toBe('DeepSeek fallback');
    expect(mockDeepSeek).toHaveBeenCalled();
  });
});
