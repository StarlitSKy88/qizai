export function diversityScore(personas: Array<{ stance_label: string }>): number {
  const counts = { conservative: 0, liberal: 0, neutral: 0 };

  personas.forEach(p => {
    counts[p.stance_label as keyof typeof counts]++;
  });

  const total = personas.length;
  const entropy = -Object.values(counts).reduce((sum, c) => {
    if (c === 0) return sum;
    const p = c / total;
    return sum + p * Math.log2(p);
  }, 0);

  // 最大熵 = log2(3) ≈ 1.585
  const score = entropy / Math.log2(3);
  // 确保返回有效的非负数（处理 -0 的情况）
  return score === 0 ? 0 : score;
}

export function shouldTriggerBoost(text: string, mean: number, std: number): boolean {
  if (std === 0) return false;
  const zScore = Math.abs((text.length - mean) / std);
  // z-score > 2.0 (使用 >= 2 - epsilon 处理浮点精度问题)
  return zScore >= 2.0 - 1e-10;
}
