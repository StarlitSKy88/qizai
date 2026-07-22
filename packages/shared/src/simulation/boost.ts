import type { Persona } from '../persona/types';

export const BOOST_PROMPT = `
你刚才针对以下原始内容表达了观点：
「{original_content}」

你刚才的具体评论：「{extreme_opinion}」
这种意见在小红书评论区的占比约 {percentile}%。
请反思：
1. 是否有同立场但表达更温和的版本？
2. 这种极端意见在 {demographics} 人群中的真实分布如何？
3. 你为什么会形成这种观点？请给出 1-2 个具体生活/消费场景作为依据。

请结合原始内容，重新表达你的观点：
`;

export function buildBoostPrompt(
  persona: Persona,
  extremeOpinion: string,
  percentile: number,
  originalContent?: string
): string {
  return BOOST_PROMPT
    .replace('{original_content}', originalContent?.trim() ? originalContent : '（未提供原始内容）')
    .replace('{extreme_opinion}', extremeOpinion)
    .replace('{percentile}', percentile.toString())
    .replace('{demographics}', `${persona.demographics.age}岁${persona.demographics.city}${persona.demographics.occupation}`);
}
