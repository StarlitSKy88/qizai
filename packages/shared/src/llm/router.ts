import type { LLMProvider, LLMRouterConfig } from './types';
import type { Persona } from '../persona/types';
import { AlibabaProvider } from './alibaba';
import { FireworksProvider } from './fireworks';
import { DeepSeekProvider } from './deepseek';

export class LLMRouter {
  private providers: LLMProvider[];

  constructor(config: LLMRouterConfig) {
    this.providers = [
      new AlibabaProvider(config.alibabaKey),
      new FireworksProvider(config.fireworksKey),
      new DeepSeekProvider(config.deepseekKey),
    ];
  }

  async complete(prompt: string, persona: Persona): Promise<string> {
    let lastError: Error | null = null;

    for (const provider of this.providers) {
      try {
        return await provider.complete(prompt, persona);
      } catch (err) {
        lastError = err as Error;
      }
    }

    throw new Error(`All LLM providers failed: ${lastError?.message ?? 'unknown'}`);
  }
}
