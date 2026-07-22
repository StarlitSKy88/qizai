import type { Report, Evidence } from './types';
import type { ContentData } from '../platform/types';
import type { SimulationResult } from '../simulation/engine';
import { decideRecommendation } from './decision';
import { buildEvidence } from './evidence';
import { checkReportSafety } from './guards';

// 中立标记（用于标记已剥离的 negation 上下文）
const NEG_MARK = 'NEG';

/**
 * 中文 sentiment 启发式（修复双重计数）：
 *   - "差" / "negative" / "不好" / "不赞" / "不赞同" 一律归为 negative
 *   - "好" / "赞" / "positive" 在 non-negation 上下文中归为 positive
 *   - 其他默认 neutral
 *
 * 实现：先把否定短语（"不[好赞]"/"别[好赞]"/"非[好赞]"）替换成一个独占的
 * NEG_MARK 哨兵，然后在剥离后的文本上判断 positive 关键字。如果存在 NEG_MARK
 * 且文本原本含 positive 标记，则归为 negative（避免"不好"/"不赞"被同时
 * 计入 positive 和 negative）。
 */
function classifyReaction(reaction: string): 'positive' | 'negative' | 'neutral' {
  const text = reaction;

  const hasNegativeKeyword =
    text.includes('negative') ||
    text.includes('差') ||
    /不[好赞]/.test(text) ||
    /别[好赞]/.test(text) ||
    /非[好赞]/.test(text);

  if (hasNegativeKeyword) {
    return 'negative';
  }

  const stripped = text
    .replace(/不[好赞]/g, NEG_MARK)
    .replace(/别[好赞]/g, NEG_MARK)
    .replace(/非[好赞]/g, NEG_MARK);

  const hasPositiveKeyword =
    !stripped.includes(NEG_MARK) &&
    (text.includes('positive') || text.includes('好') || text.includes('赞'));

  if (hasPositiveKeyword) {
    return 'positive';
  }

  return 'neutral';
}

export class ReportGenerator {
  generate(content: ContentData, result: SimulationResult): Report {
    const sampleSize = result.outputs.length;

    let positiveCount = 0;
    let negativeCount = 0;
    for (const o of result.outputs) {
      const cls = classifyReaction(o.reaction);
      if (cls === 'positive') positiveCount++;
      else if (cls === 'negative') negativeCount++;
    }
    const neutralCount = sampleSize - positiveCount - negativeCount;

    const positiveRatio = sampleSize === 0 ? 0 : positiveCount / sampleSize;
    const negativeRatio = sampleSize === 0 ? 0 : negativeCount / sampleSize;
    const neutralRatio = sampleSize === 0 ? 0 : neutralCount / sampleSize;

    const decision = decideRecommendation({
      positiveRatio,
      negativeRatio,
      diversity: result.diversity,
      manualInterventionRequired: result.manualInterventionRequired,
    });

    const recommendations = this.buildRecommendations(decision, positiveRatio, result.diversity);

    const evidence: Evidence[] = [
      buildEvidence('positive_ratio', positiveRatio, sampleSize),
      buildEvidence('negative_ratio', negativeRatio, sampleSize),
      buildEvidence('diversity', result.diversity, sampleSize),
    ];

    const allText = JSON.stringify({ recommendations, evidence });
    const safety = checkReportSafety(allText);
    if (!safety.safe) {
      console.warn(`Report guard violations: ${safety.violations.join(', ')}`);
    }

    return {
      decision,
      metrics: {
        positive_ratio: positiveRatio,
        negative_ratio: negativeRatio,
        neutral_ratio: neutralRatio,
        virality_score: 0.5,
        diversity: result.diversity,
      },
      recommendations,
      evidence,
      generated_at: Date.now(),
    };
  }

  private buildRecommendations(decision: string, positiveRatio: number, diversity: number): string[] {
    if (decision === 'publish') {
      return ['内容表现良好，可以发布', '建议保留当前标题与封面'];
    }
    if (decision === 'modify') {
      return ['建议调整标题增加吸引力', '尝试添加 2-3 个热门标签'];
    }
    if (decision === 'not_publish') {
      return ['当前内容互动预测偏低，建议重新选题', '参考同类爆款内容的标题模式'];
    }
    return ['多样性不足，建议人工调整 prompt 后重新模拟'];
  }
}
