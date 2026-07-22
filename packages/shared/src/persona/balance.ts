import type { Persona } from './types';
import { PersonaBuilder } from './builder';

export interface BalanceOptions {
  topic: string;
}

const STANCES = ['强烈支持', '中立', '强烈反对'] as const;
const ARCHETYPES = ['年轻人', '中年人', '老年人'] as const;

const STANCE_LABEL_MAP = {
  '强烈支持': 'conservative',
  '中立': 'neutral',
  '强烈反对': 'liberal',
} as const;

/**
 * 构建 3 stance × 3 archetype = 9 persona 的平衡矩阵
 * 保证 Liberal Bias 缓解（不同立场均有代表性）
 */
export function buildBalancedPersonas(options: BalanceOptions): Persona[] {
  const builder = new PersonaBuilder();
  const personas = builder.buildBalanced({ topic: options.topic, count: 9 });

  const result: Persona[] = [];
  let idx = 0;
  for (const stance of STANCES) {
    for (const archetype of ARCHETYPES) {
      const persona = personas[idx];
      const updated: Persona = {
        ...persona,
        demographics: {
          ...persona.demographics,
          age_group: archetype,
        },
        stance_label: STANCE_LABEL_MAP[stance],
      };
      result.push(updated);
      idx++;
    }
  }
  return result;
}
