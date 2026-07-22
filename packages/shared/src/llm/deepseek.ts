import type { LLMProvider } from './types';
import type { Persona } from '../persona/types';

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
const MODEL = 'deepseek-v4-flash';

export class DeepSeekProvider implements LLMProvider {
  constructor(private apiKey: string) {}

  getModel(): string {
    return MODEL;
  }

  async complete(prompt: string, persona: Persona): Promise<string> {
    const systemPrompt = `你是 ${persona.demographics.age_group}，立场 ${persona.stance_label}，强度 ${persona.stance_strength}。`;

    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0]?.message.content ?? '';
  }
}
