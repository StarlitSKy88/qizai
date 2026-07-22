import type { Persona } from '../persona/types';

export interface LLMProvider {
  complete(prompt: string, persona: Persona): Promise<string>;
  getModel(): string;
}

export interface LLMRouterConfig {
  alibabaKey: string;
  fireworksKey: string;
  deepseekKey: string;
}
