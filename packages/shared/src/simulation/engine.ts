import type { Persona } from '../persona/types';
import type { LLMRouter } from '../llm/router';
import { diversityScore, shouldTriggerBoost } from './diversity';
import { buildBoostPrompt } from './boost';

export interface SimulationOptions {
  router: LLMRouter;
  concurrency: number;
  diversityThreshold: number;
  boostThreshold?: number;
}

export interface SimulationOutput {
  personaId: string;
  reaction: string;
  boosted: boolean;
  weight: number;
}

export interface SimulationResult {
  outputs: SimulationOutput[];
  diversity: number;
  boostedCount: number;
  manualInterventionRequired: boolean;
}

export class SimulationEngine {
  constructor(private options: SimulationOptions) {}

  async simulate(content: string, personas: Persona[]): Promise<SimulationResult> {
    const firstRound = await this.runBatch(content, personas);
    let diversity = diversityScore(personas);

    if (diversity < this.options.diversityThreshold) {
      const boostResults = await this.applyBoost(content, firstRound, personas);
      const boostDiversity = diversityScore(
        boostResults.map(() => ({ stance_label: 'neutral' }))
      );

      if (boostDiversity < this.options.diversityThreshold) {
        return {
          outputs: boostResults,
          diversity: boostDiversity,
          boostedCount: boostResults.filter(r => r.boosted).length,
          manualInterventionRequired: true,
        };
      }

      return {
        outputs: boostResults,
        diversity: boostDiversity,
        boostedCount: boostResults.filter(r => r.boosted).length,
        manualInterventionRequired: false,
      };
    }

    return {
      outputs: firstRound,
      diversity,
      boostedCount: 0,
      manualInterventionRequired: false,
    };
  }

  private async runBatch(content: string, personas: Persona[]): Promise<SimulationOutput[]> {
    const concurrency = this.options.concurrency;
    const results: SimulationOutput[] = [];

    for (let i = 0; i < personas.length; i += concurrency) {
      const batch = personas.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(p => this.callRouter(content, p))
      );
      results.push(...batchResults);
    }

    return results;
  }

  private async callRouter(content: string, persona: Persona): Promise<SimulationOutput> {
    const reaction = await this.options.router.complete(content, persona);
    return {
      personaId: persona.id,
      reaction,
      boosted: false,
      weight: 1.0,
    };
  }

  private async applyBoost(
    content: string,
    outputs: SimulationOutput[],
    personas: Persona[]
  ): Promise<SimulationOutput[]> {
    const mean = outputs.reduce((s, o) => s + o.reaction.length, 0) / outputs.length;
    const variance = outputs.reduce((s, o) => s + Math.pow(o.reaction.length - mean, 2), 0) / outputs.length;
    const std = Math.sqrt(variance);

    // 让 boostThreshold 配置生效：默认 2.0（z-score），可通过 options.boostThreshold 调整
    const boostThreshold = this.options.boostThreshold ?? 2.0;

    const boosted: SimulationOutput[] = [];

    for (let i = 0; i < outputs.length; i++) {
      const output = outputs[i];
      const persona = personas[i];

      if (shouldTriggerBoost(output.reaction, mean, std, boostThreshold)) {
        const boostPrompt = buildBoostPrompt(persona, output.reaction, 95, content);
        const newReaction = await this.options.router.complete(boostPrompt, persona);
        boosted.push({
          personaId: output.personaId,
          reaction: newReaction,
          boosted: true,
          weight: 0.5,
        });
      } else {
        boosted.push(output);
      }
    }

    return boosted;
  }
}
