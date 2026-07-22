import { describe, it, expect, vi } from 'vitest';
import { ReportGenerator } from '../../src/report/generator';
import type { SimulationResult } from '../../src/simulation/engine';
import type { ContentData } from '../../src/platform/types';

const mockContent: ContentData = {
  title: '三招教你选对洗面奶',
  cover: 'image-url',
  tags: ['美妆', '护肤'],
};

function makeResult(opts: {
  reactions: string[];
  diversity?: number;
  manual?: boolean;
}): SimulationResult {
  return {
    outputs: opts.reactions.map((r, i) => ({
      personaId: `p-${i}`,
      reaction: r,
      boosted: false,
      weight: 1.0,
    })),
    diversity: opts.diversity ?? 0.7,
    boostedCount: 0,
    manualInterventionRequired: opts.manual ?? false,
  };
}

describe('ReportGenerator', () => {
  it('returns publish when positive_ratio >= 60% and diversity high', () => {
    const generator = new ReportGenerator();
    const result = makeResult({
      reactions: Array.from({ length: 100 }, (_, i) =>
        i < 70 ? 'positive 好赞' : i < 85 ? 'neutral' : 'negative'
      ),
      diversity: 0.65,
    });

    const report = generator.generate(mockContent, result);

    expect(report.decision).toBe('publish');
    expect(report.metrics.positive_ratio).toBe(0.7);
  });

  it('returns not_publish when diversity < 0.20', () => {
    const generator = new ReportGenerator();
    const result = makeResult({
      reactions: Array.from({ length: 100 }, () => 'positive 好'),
      diversity: 0.10,
    });

    const report = generator.generate(mockContent, result);

    expect(report.decision).toBe('not_publish');
  });

  it('attaches evidence to each metric', () => {
    const generator = new ReportGenerator();
    const result = makeResult({
      reactions: Array.from({ length: 100 }, () => 'neutral'),
      diversity: 0.5,
    });

    const report = generator.generate(mockContent, result);

    expect(report.evidence.length).toBe(3);
    expect(report.evidence[0]).toHaveProperty('source');
    expect(report.evidence[0]).toHaveProperty('description');
    expect(report.evidence[0].confidence).toBe(0.1); // 100/1000
  });
});
