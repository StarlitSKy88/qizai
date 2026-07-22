import type { Report, Evidence } from './types';
import type { ContentData } from '../platform/types';
import type { SimulationResult } from '../simulation/engine';
import { decideRecommendation } from './decision';
import { buildEvidence } from './evidence';
import { checkReportSafety } from './guards';

export class ReportGenerator {
  generate(content: ContentData, result: SimulationResult): Report {
    const sampleSize = result.outputs.length;

    const positiveCount = result.outputs.filter(o =>
      o.reaction.includes('positive') || o.reaction.includes('好') || o.reaction.includes('赞')
    ).length;
    const negativeCount = result.outputs.filter(o =>
      o.reaction.includes('negative') || o.reaction.includes('差') || o.reaction.includes('不')
    ).length;
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
