const FORBIDDEN_PHRASES = [
  '87 分',
  '90 分',
  '95 分',
  '100 分',
  '完美',
  '绝对',
  '100%',
];

export function checkReportSafety(text: string): { safe: boolean; violations: string[] } {
  const violations: string[] = [];

  for (const phrase of FORBIDDEN_PHRASES) {
    if (text.includes(phrase)) {
      violations.push(phrase);
    }
  }

  return { safe: violations.length === 0, violations };
}
