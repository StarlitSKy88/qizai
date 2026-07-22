import type { Evidence } from './types';

export function buildEvidence(metric: string, value: number, sampleSize: number): Evidence {
  return {
    source: 'simulation',
    description: `${metric}: ${value.toFixed(3)} (基于 ${sampleSize} persona 模拟)`,
    confidence: Math.min(sampleSize / 1000, 1.0),
    refs: [`simulation:${metric}`],
  };
}
