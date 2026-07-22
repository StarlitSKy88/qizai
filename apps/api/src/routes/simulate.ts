import { Hono } from 'hono';
import { PersonaBuilder } from '@qizai/shared/persona/builder';
import { SimulationEngine } from '@qizai/shared/simulation/engine';
import { ReportGenerator } from '@qizai/shared/report/generator';
import { LLMRouter } from '@qizai/shared/llm/router';

export const simulateRouter = new Hono();

simulateRouter.post('/', async (c) => {
  const body = await c.req.json();
  const { content, persona_count = 1000 } = body;

  if (!content || !content.title) {
    return c.json({ error: 'Missing content' }, 400);
  }

  const builder = new PersonaBuilder();
  const personas = builder.buildBalanced({ topic: content.title, count: persona_count });

  // Cloudflare Workers 中必须通过 c.env 访问环境变量；process.env 在 Workers 中不安全。
  // 本地 Node 测试环境 c.env 可能未注入，故显式 fallback 到 process.env 以维持向后兼容。
  const env = c.env as {
    NODE_ENV?: string;
    ALIBABA_BAILIAN_API_KEY?: string;
    FIREWORKS_API_KEY?: string;
    DEEPSEEK_API_KEY?: string;
  };
  const nodeEnv = env?.NODE_ENV ?? (typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined);
  const isTest = nodeEnv === 'test';
  const router = isTest
    ? createMockRouter()
    : new LLMRouter({
        alibabaKey: env?.ALIBABA_BAILIAN_API_KEY ?? '',
        fireworksKey: env?.FIREWORKS_API_KEY ?? '',
        deepseekKey: env?.DEEPSEEK_API_KEY ?? '',
      });

  const engine = new SimulationEngine({
    router,
    concurrency: 100,
    diversityThreshold: 0.40,
  });
  const simulationResult = await engine.simulate(content.title, personas);

  const reportGenerator = new ReportGenerator();
  const report = reportGenerator.generate(content, simulationResult);

  return c.json({
    report,
    simulation: {
      persona_count,
      diversity: simulationResult.diversity,
      boosted_count: simulationResult.boostedCount,
      manual_intervention: simulationResult.manualInterventionRequired,
    },
  });
});

function createMockRouter() {
  return {
    complete: async (_prompt: string, persona: any) => {
      await new Promise(r => setTimeout(r, 5));
      return `${persona.stance_label} reaction`;
    },
  } as any;
}
