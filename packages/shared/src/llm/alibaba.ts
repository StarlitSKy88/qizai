import type { LLMProvider } from './types';
import type { Persona } from '../persona/types';

const ALIBABA_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1';
const MODEL = 'qwen3.5-flash';

export class AlibabaProvider implements LLMProvider {
  constructor(private apiKey: string) {}

  getModel(): string {
    return MODEL;
  }

  async complete(prompt: string, persona: Persona): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(persona);

    const response = await fetch(`${ALIBABA_BASE_URL}/services/aigc/text-generation/generation`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        input: {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
        },
        parameters: {
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 150,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Alibaba API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
      output: { text: string };
    };
    return data.output.text;
  }

  private buildSystemPrompt(persona: Persona): string {
    return `你是 ${persona.demographics.age_group}（${persona.demographics.age}岁，${persona.demographics.city}，${persona.demographics.occupation}）。
你的立场：${persona.stance_label}（强度：${persona.stance_strength}）
你的语言风格：${persona.language}
请基于你的 persona，给出真实反应。`;
  }
}
