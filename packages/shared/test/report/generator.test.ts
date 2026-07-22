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

  it('does NOT double-count "不好"/"不赞" as both positive and negative', () => {
    // 修复前的 bug: includes('不') 会把"不好"同时归为 positive 和 negative
    //（既被 includes('好') 命中又被 includes('不') 命中）
    // 修复后 "不好"/"不赞" 只归为 negative
    const generator = new ReportGenerator();
    const result = makeResult({
      reactions: [
        '感觉不好',
        '这个不赞',
        '质量差',
        '看起来不错呀', // "不" 后面没有 [好赞]，不归为 negative
        'positive 反应好赞',
      ],
      diversity: 0.7,
    });

    const report = generator.generate(mockContent, result);

    // "感觉不好" -> negative
    // "这个不赞" -> negative
    // "质量差"   -> negative
    // "看起来不错呀" -> neutral（"不" 后面跟的是"错"，不是 [好赞]）
    // "positive 反应好赞" -> positive
    expect(report.metrics.positive_ratio).toBeCloseTo(1 / 5);
    expect(report.metrics.negative_ratio).toBeCloseTo(3 / 5);
    expect(report.metrics.neutral_ratio).toBeCloseTo(1 / 5);

    // 5 个样本里，negative_count 只能是 3（不能因为双重计数变成 4）
    // 重新求和验证：positiveRatio + negativeRatio + neutralRatio === 1
    const total =
      report.metrics.positive_ratio +
      report.metrics.negative_ratio +
      report.metrics.neutral_ratio;
    expect(total).toBeCloseTo(1);
  });

  it('handles negation context for 别/非 prefixes too', () => {
    const generator = new ReportGenerator();
    const result = makeResult({
      reactions: ['别好', '非赞', '挺好'],
      diversity: 0.7,
    });

    const report = generator.generate(mockContent, result);

    // "别好" -> negative (negation)
    // "非赞" -> negative (negation)
    // "挺好" -> positive (no negation prefix before 好)
    expect(report.metrics.positive_ratio).toBeCloseTo(1 / 3);
    expect(report.metrics.negative_ratio).toBeCloseTo(2 / 3);
  });

  it('classifies pure positive and negative cleanly', () => {
    const generator = new ReportGenerator();
    const result = makeResult({
      reactions: ['positive', 'positive 好', 'negative', '差评'],
      diversity: 0.7,
    });

    const report = generator.generate(mockContent, result);

    expect(report.metrics.positive_ratio).toBeCloseTo(2 / 4);
    expect(report.metrics.negative_ratio).toBeCloseTo(2 / 4);
  });
});
