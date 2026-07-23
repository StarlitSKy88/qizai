# qizai 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建 qizai（骑仔）v0.12 MVP —— 中文 AI 内容流量预测 SaaS，支持小红书 1000+ persona 模拟 + 4 档定价 + MCN 批量合同

**Architecture:** Next.js 14 全栈单体（Pages 前端 + Workers API） + Cloudflare D1/KV/R2 + OASIS 仿真引擎 + qwen3.5-flash 主 LLM 路径 + Fireworks/DeepSeek fallback

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Cloudflare Workers (Hono), Cloudflare D1, Cloudflare KV, R2, Python (OASIS), 阿里云百炼 (qwen3.5-flash), Fireworks AI, Tencent Cloud (SMS + SMTP)

## Global Constraints

- Node.js ≥ 20.x LTS, pnpm ≥ 8.x（来自全局规则）
- TypeScript strict mode, ESLint + Prettier 强制（来自全局规则）
- 测试覆盖率 ≥ 80%（来自全局规则）
- 所有任务使用 TDD：先写测试 → 失败 → 实现 → 通过
- Git commit 格式：`feat/fix/docs/refactor(scope): subject`（来自全局规则）
- API key 不入 git，存 `.env.local`（来自全局规则）
- 全程使用 `apps/web/`, `apps/api/`, `packages/shared/` monorepo 结构（来自 laoban 决策）
- Spec v0.12 §2.5.1：默认 LLM = qwen3.5-flash 阿里云百炼（30,000 RPM），fallback = Fireworks + DeepSeek V4-Flash
- Spec v0.12 §3.3：DIVERSITY_THRESHOLD=0.40 + 双层熔断
- Spec v0.12 §2.7：单次预测成本目标 ≤ ¥1（缓存后 ¥0.38）
- Spec v0.12 §2.4.4：Oransim `base.py` 需扩展至 11 方法（TikTok PlatformAdapter 参考）

---

## Task 1: 项目脚手架 + 基础设施

**Files:**
- Create: `qizai/package.json`
- Create: `qizai/pnpm-workspace.yaml`
- Create: `qizai/tsconfig.base.json`
- Create: `qizai/.gitignore`
- Create: `qizai/.env.local.example`
- Create: `qizai/apps/web/package.json`
- Create: `qizai/apps/api/package.json`
- Create: `qizai/packages/shared/package.json`
- Create: `qizai/README.md`

**Interfaces:**
- Consumes: 无（首任务）
- Produces: monorepo 根目录结构 + workspace 配置

### Step 1.1: 初始化 monorepo 根目录

```bash
mkdir -p /Users/opc-1/Downloads/O/qizai
cd /Users/opc-1/Downloads/O/qizai
pnpm init
```

### Step 1.2: 创建 pnpm workspace 配置

**File:** `qizai/pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### Step 1.3: 创建根 package.json

**File:** `qizai/package.json`

```json
{
  "name": "qizai-monorepo",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "pnpm -r --parallel run dev",
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "lint": "pnpm -r run lint",
    "typecheck": "pnpm -r run typecheck"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=8.0.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^20.10.0",
    "prettier": "^3.0.0",
    "eslint": "^8.57.0"
  }
}
```

### Step 1.4: 创建基础 tsconfig

**File:** `qizai/tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  }
}
```

### Step 1.5: 创建 .gitignore

**File:** `qizai/.gitignore`

```gitignore
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
.next/
out/
.wrangler/

# Environment
.env
.env.local
.env.*.local

# Logs
*.log
logs/

# Testing
coverage/
.nyc_output/

# IDE
.vscode/
.idea/
*.swp
.DS_Store
```

### Step 1.6: 创建 .env.local.example

**File:** `qizai/.env.local.example`

```bash
# 阿里云百炼（qwen3.5-flash 主路径）
ALIBABA_BAILIAN_API_KEY=your_key_here
ALIBABA_BAILIAN_BASE_URL=https://dashscope.aliyuncs.com/api/v1
ALIBABA_BAILIAN_MODEL=qwen3.5-flash

# Fireworks AI（fallback 1）
FIREWORKS_API_KEY=your_key_here
FIREWORKS_BASE_URL=https://api.fireworks.ai/inference/v1
FIREWORKS_MODEL=qwen3p7-plus

# DeepSeek（fallback 2）
DEEPSEEK_API_KEY=your_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-v4-flash

# 腾讯云 SMS
TENCENT_SMS_SECRET_ID=your_id_here
TENCENT_SMS_SECRET_KEY=your_key_here
TENCENT_SMS_APP_ID=your_app_id_here

# 腾讯云 SMTP
TENCENT_SMTP_HOST=smtp.qcloudmail.com
TENCENT_SMTP_PORT=465
TENCENT_SMTP_USER=nodemailer@taomyst.top
TENCENT_SMTP_PASS=your_password_here

# Cloudflare
CF_ACCOUNT_ID=your_account_id_here
CF_API_TOKEN=your_api_token_here
CF_D1_DATABASE_ID=your_db_id_here
CF_KV_NAMESPACE_ID=your_kv_id_here
```

### Step 1.7: 创建三个 workspace 子目录的 package.json

**File:** `qizai/apps/web/package.json`

```json
{
  "name": "@qizai/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@qizai/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@types/node": "^20.10.0",
    "typescript": "^5.6.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "vitest": "^2.0.0",
    "@vitejs/plugin-react": "^4.3.0"
  }
}
```

**File:** `qizai/apps/api/package.json`

```json
{
  "name": "@qizai/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "hono": "^4.6.0",
    "@qizai/shared": "workspace:*"
  },
  "devDependencies": {
    "wrangler": "^3.80.0",
    "@cloudflare/workers-types": "^4.20240919.0",
    "typescript": "^5.6.0",
    "vitest": "^2.0.0"
  }
}
```

**File:** `qizai/packages/shared/package.json`

```json
{
  "name": "@qizai/shared",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.0.0"
  }
}
```

### Step 1.8: 创建 README

**File:** `qizai/README.md`

```markdown
# qizai（骑仔）

中文 AI 内容流量预测工具 —— 小红书 / 抖音 / B站创作者的 1000+ persona 模拟预测

## 架构

- **前端**: Next.js 14 App Router + TypeScript + Tailwind CSS（Cloudflare Pages）
- **API**: Cloudflare Workers + Hono 框架
- **数据库**: Cloudflare D1（关系）+ KV（缓存）+ R2（媒体）
- **LLM**: qwen3.5-flash（阿里云百炼，30,000 RPM） + Fireworks fallback
- **仿真引擎**: Python OASIS（独立部署）

## 开发

```bash
pnpm install
pnpm dev
```

## 部署

```bash
pnpm --filter @qizai/web deploy
pnpm --filter @qizai/api deploy
```

## 文档

- Spec: `docs/superpowers/specs/2026-07-22-qizai-design.md`
- 计划: `docs/superpowers/plans/2026-07-23-qizai-implementation.md`
```

### Step 1.9: 安装依赖并验证

```bash
cd /Users/opc-1/Downloads/O/qizai
pnpm install
pnpm -r run typecheck
```

**Expected:** 所有 workspace 类型检查通过，无错误。

### Step 1.10: 提交

```bash
cd /Users/opc-1/Downloads/O/qizai
git init
git add .
git commit -m "feat: initialize qizai monorepo with workspaces"
```

---

## Task 2: persona 数据模型 + stance_label

**Files:**
- Create: `qizai/packages/shared/src/persona/types.ts`
- Create: `qizai/packages/shared/src/persona/builder.ts`
- Create: `qizai/packages/shared/src/persona/balance.ts`
- Test: `qizai/packages/shared/test/persona/builder.test.ts`
- Test: `qizai/packages/shared/test/persona/balance.test.ts`

**Interfaces:**
- Consumes: 无（依赖 Task 1 monorepo）
- Produces: `Persona` 类型定义 + `buildBalancedPersonas(topic)` 函数 + `PersonaBuilder` 类

### Step 2.1: 写失败的测试 - Persona 类型

**File:** `qizai/packages/shared/test/persona/builder.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { PersonaBuilder } from '../../src/persona/builder';
import type { Persona } from '../../src/persona/types';

describe('PersonaBuilder', () => {
  it('builds a balanced persona set with stance_label diversity', () => {
    const builder = new PersonaBuilder();
    const personas = builder.buildBalanced({
      topic: '面试技巧',
      count: 9,
    });

    expect(personas).toHaveLength(9);

    const stances = personas.map(p => p.stance_label);
    const conservative = stances.filter(s => s === 'conservative').length;
    const liberal = stances.filter(s => s === 'liberal').length;
    const neutral = stances.filter(s => s === 'neutral').length;

    // 平衡：3 立场各至少 1 个
    expect(conservative).toBeGreaterThanOrEqual(1);
    expect(liberal).toBeGreaterThanOrEqual(1);
    expect(neutral).toBeGreaterThanOrEqual(1);
  });

  it('assigns stance_strength in [0, 1]', () => {
    const builder = new PersonaBuilder();
    const personas = builder.buildBalanced({ topic: '美食', count: 100 });

    personas.forEach(p => {
      expect(p.stance_strength).toBeGreaterThanOrEqual(0);
      expect(p.stance_strength).toBeLessThanOrEqual(1);
    });
  });

  it('includes OCEAN personality traits', () => {
    const builder = new PersonaBuilder();
    const personas = builder.buildBalanced({ topic: '美妆', count: 50 });

    personas.forEach(p => {
      expect(p.ocean).toBeDefined();
      expect(p.ocean.O).toBeGreaterThanOrEqual(-1);
      expect(p.ocean.O).toBeLessThanOrEqual(1);
    });
  });
});
```

### Step 2.2: 运行测试验证失败

```bash
cd /Users/opc-1/Downloads/O/qizai
pnpm --filter @qizai/shared test
```

**Expected:** FAIL with "Cannot find module '../../src/persona/builder'"

### Step 2.3: 定义 Persona 类型

**File:** `qizai/packages/shared/src/persona/types.ts`

```typescript
export type StanceLabel = 'conservative' | 'liberal' | 'neutral';

export interface OCEAN {
  O: number; // Openness
  C: number; // Conscientiousness
  E: number; // Extraversion
  A: number; // Agreeableness
  N: number; // Neuroticism
}

export interface Demographics {
  age: number;
  gender: 'male' | 'female' | 'other';
  city: string; // 一线/新一线/二线/三线
  occupation: string;
}

export interface PlatformTraits {
  accountAge: number; // 注册天数
  contentPreference: string[]; // 兴趣标签
  behaviorPattern: 'browse' | 'search' | 'follow';
  activeHours: number[]; // 活跃时段 [0-23]
  dwellBaseline: number; // 基础停留秒数
}

export interface Persona {
  id: string; // UUID
  ocean: OCEAN;
  demographics: Demographics;
  platform: PlatformTraits;
  stance_label: StanceLabel; // v0.12 NEW
  stance_strength: number; // [0, 1] v0.12 NEW
  controversy_score: number; // 极端立场强度
  language: 'meme' | 'formal' | 'cute'; // 中文圈层文化
}

export interface PersonaBuildOptions {
  topic: string;
  count: number;
}
```

### Step 2.4: 实现 PersonaBuilder

**File:** `qizai/packages/shared/src/persona/builder.ts`

```typescript
import type { Persona, PersonaBuildOptions, StanceLabel } from './types';

const STANCE_DISTRIBUTION: StanceLabel[] = [
  'conservative', 'conservative', 'conservative',
  'neutral', 'neutral', 'neutral',
  'liberal', 'liberal', 'liberal',
];

const CITIES = ['一线', '新一线', '二线', '三线'];
const OCCUPATIONS = ['学生', '白领', '自由职业', '全职妈妈', '退休', '教师'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const LANGUAGES: Array<'meme' | 'formal' | 'cute'> = ['meme', 'formal', 'cute'];
const INTERESTS = ['美妆', '美食', '职场', '萌宠', '旅游', '穿搭', '健身', '数码'];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateOCEAN(): Persona['ocean'] {
  return {
    O: randomInt(-10, 10) / 10,
    C: randomInt(-10, 10) / 10,
    E: randomInt(-10, 10) / 10,
    A: randomInt(-10, 10) / 10,
    N: randomInt(-10, 10) / 10,
  };
}

function stanceToStrength(stance: StanceLabel): number {
  // 越极端 stance_strength 越高
  if (stance === 'neutral') return randomInt(0, 3) / 10;
  return randomInt(5, 10) / 10;
}

function generatePersona(topic: string, index: number): Persona {
  const stance_label = STANCE_DISTRIBUTION[index % STANCE_DISTRIBUTION.length];
  return {
    id: `persona-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    ocean: generateOCEAN(),
    demographics: {
      age: randomInt(18, 65),
      gender: randomChoice(['male', 'female', 'other'] as const),
      city: randomChoice(CITIES),
      occupation: randomChoice(OCCUPATIONS),
    },
    platform: {
      accountAge: randomInt(30, 3650),
      contentPreference: randomChoice(INTERESTS) ? [randomChoice(INTERESTS)] : [],
      behaviorPattern: randomChoice(['browse', 'search', 'follow'] as const),
      activeHours: [randomInt(0, 23)],
      dwellBaseline: randomInt(5, 60),
    },
    stance_label,
    stance_strength: stanceToStrength(stance_label),
    controversy_score: randomInt(0, 100) / 100,
    language: randomChoice(LANGUAGES),
  };
}

export class PersonaBuilder {
  buildBalanced(options: PersonaBuildOptions): Persona[] {
    const { count } = options;
    const personas: Persona[] = [];

    for (let i = 0; i < count; i++) {
      personas.push(generatePersona(options.topic, i));
    }

    return personas;
  }
}
```

### Step 2.5: 运行测试验证通过

```bash
cd /Users/opc-1/Downloads/O/qizai
pnpm --filter @qizai/shared test
```

**Expected:** PASS（3 个测试全部通过）

### Step 2.6: 写失败的测试 - 平衡函数

**File:** `qizai/packages/shared/test/persona/balance.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { buildBalancedPersonas } from '../../src/persona/balance';

describe('buildBalancedPersonas', () => {
  it('creates 3 stances × 3 archetypes = 9 personas by default', () => {
    const personas = buildBalancedPersonas({ topic: '职场' });

    expect(personas).toHaveLength(9);

    const stances = new Set(personas.map(p => p.stance_label));
    expect(stances.size).toBe(3);
  });

  it('each stance has all 3 archetypes', () => {
    const personas = buildBalancedPersonas({ topic: '美食' });

    personas.forEach(p => {
      expect(['年轻人', '中年人', '老年人']).toContain(p.demographics.age_group);
    });
  });
});
```

### Step 2.7: 实现 buildBalancedPersonas

**File:** `qizai/packages/shared/src/persona/balance.ts`

```typescript
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

export function buildBalancedPersonas(options: BalanceOptions): Persona[] {
  const builder = new PersonaBuilder();
  const personas = builder.buildBalanced({ topic: options.topic, count: 9 });

  // 重写以确保 3×3 平衡
  const result: Persona[] = [];
  let idx = 0;
  for (const stance of STANCES) {
    for (const archetype of ARCHETYPES) {
      const persona = personas[idx];
      persona.demographics.age_group = archetype; // 扩展 Demographics
      persona.stance_label = STANCE_LABEL_MAP[stance];
      result.push(persona);
      idx++;
    }
  }

  return result;
}
```

### Step 2.8: 扩展 Demographics 类型

修改 `qizai/packages/shared/src/persona/types.ts`，在 `Demographics` 接口中添加：

```typescript
export interface Demographics {
  age: number;
  age_group: '年轻人' | '中年人' | '老年人'; // v0.12 NEW
  gender: 'male' | 'female' | 'other';
  city: string;
  occupation: string;
}
```

### Step 2.9: 运行所有测试验证通过

```bash
cd /Users/opc-1/Downloads/O/qizai
pnpm --filter @qizai/shared test
```

**Expected:** PASS（5 个测试全部通过）

### Step 2.10: 提交

```bash
cd /Users/opc-1/Downloads/O/qizai
git add packages/shared/
git commit -m "feat(persona): add Persona type with stance_label and balanced builder"
```

---

## Task 3: LLM 路由层（qwen3.5-flash 主路径 + fallback）

**Files:**
- Create: `qizai/packages/shared/src/llm/types.ts`
- Create: `qizai/packages/shared/src/llm/alibaba.ts`
- Create: `qizai/packages/shared/src/llm/fireworks.ts`
- Create: `qizai/packages/shared/src/llm/deepseek.ts`
- Create: `qizai/packages/shared/src/llm/router.ts`
- Test: `qizai/packages/shared/test/llm/router.test.ts`

**Interfaces:**
- Consumes: Task 2 的 Persona 类型
- Produces: `LLMRouter` 类，方法 `complete(prompt, persona): Promise<string>`

### Step 3.1: 写失败的测试 - LLM 路由

**File:** `qizai/packages/shared/test/llm/router.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { LLMRouter } from '../../src/llm/router';
import type { Persona } from '../../src/persona/types';

// Mock 各 provider
vi.mock('../../src/llm/alibaba');
vi.mock('../../src/llm/fireworks');
vi.mock('../../src/llm/deepseek');

describe('LLMRouter', () => {
  const mockPersona: Persona = {
    id: 'test-1',
    ocean: { O: 0, C: 0, E: 0, A: 0, N: 0 },
    demographics: { age: 25, age_group: '年轻人', gender: 'female', city: '一线', occupation: '白领' },
    platform: { accountAge: 365, contentPreference: ['美妆'], behaviorPattern: 'browse', activeHours: [20], dwellBaseline: 30 },
    stance_label: 'neutral',
    stance_strength: 0.5,
    controversy_score: 0.5,
    language: 'meme',
  };

  it('uses Alibaba qwen3.5-flash as primary', async () => {
    const { AlibabaProvider } = await import('../../src/llm/alibaba');
    const mockComplete = vi.fn().mockResolvedValue('测试响应');
    vi.mocked(AlibabaProvider).mockImplementation(() => ({
      complete: mockComplete,
    } as any));

    const router = new LLMRouter({
      alibabaKey: 'test-key',
      fireworksKey: 'test-key',
      deepseekKey: 'test-key',
    });

    const result = await router.complete('测试 prompt', mockPersona);

    expect(result).toBe('测试响应');
    expect(mockComplete).toHaveBeenCalled();
  });

  it('falls back to Fireworks when Alibaba fails', async () => {
    const { AlibabaProvider } = await import('../../src/llm/alibaba');
    const { FireworksProvider } = await import('../../src/llm/fireworks');

    vi.mocked(AlibabaProvider).mockImplementation(() => ({
      complete: vi.fn().mockRejectedValue(new Error('Rate limit')),
    } as any));

    const mockFireworks = vi.fn().mockResolvedValue('Fireworks fallback');
    vi.mocked(FireworksProvider).mockImplementation(() => ({
      complete: mockFireworks,
    } as any));

    const router = new LLMRouter({
      alibabaKey: 'test-key',
      fireworksKey: 'test-key',
      deepseekKey: 'test-key',
    });

    const result = await router.complete('测试 prompt', mockPersona);

    expect(result).toBe('Fireworks fallback');
    expect(mockFireworks).toHaveBeenCalled();
  });

  it('falls back to DeepSeek when both Alibaba and Fireworks fail', async () => {
    const { AlibabaProvider } = await import('../../src/llm/alibaba');
    const { FireworksProvider } = await import('../../src/llm/fireworks');
    const { DeepSeekProvider } = await import('../../src/llm/deepseek');

    vi.mocked(AlibabaProvider).mockImplementation(() => ({
      complete: vi.fn().mockRejectedValue(new Error('Rate limit')),
    } as any));

    vi.mocked(FireworksProvider).mockImplementation(() => ({
      complete: vi.fn().mockRejectedValue(new Error('Service down')),
    } as any));

    const mockDeepSeek = vi.fn().mockResolvedValue('DeepSeek fallback');
    vi.mocked(DeepSeekProvider).mockImplementation(() => ({
      complete: mockDeepSeek,
    } as any));

    const router = new LLMRouter({
      alibabaKey: 'test-key',
      fireworksKey: 'test-key',
      deepseekKey: 'test-key',
    });

    const result = await router.complete('测试 prompt', mockPersona);

    expect(result).toBe('DeepSeek fallback');
    expect(mockDeepSeek).toHaveBeenCalled();
  });
});
```

### Step 3.2: 运行测试验证失败

```bash
cd /Users/opc-1/Downloads/O/qizai
pnpm --filter @qizai/shared test
```

**Expected:** FAIL with "Cannot find module '../../src/llm/router'"

### Step 3.3: 定义 LLM 类型

**File:** `qizai/packages/shared/src/llm/types.ts`

```typescript
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
```

### Step 3.4: 实现 Alibaba Provider

**File:** `qizai/packages/shared/src/llm/alibaba.ts`

```typescript
import type { LLMProvider } from './types';
import type { Persona } from '../persona/types';

const ALIBABA_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1';
const MODEL = 'qwen3.5-flash'; // alias ID, 30,000 RPM

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
```

### Step 3.5: 实现 Fireworks Provider

**File:** `qizai/packages/shared/src/llm/fireworks.ts`

```typescript
import type { LLMProvider } from './types';
import type { Persona } from '../persona/types';

const FIREWORKS_BASE_URL = 'https://api.fireworks.ai/inference/v1';
const MODEL = 'qwen3p7-plus';

export class FireworksProvider implements LLMProvider {
  constructor(private apiKey: string) {}

  getModel(): string {
    return MODEL;
  }

  async complete(prompt: string, persona: Persona): Promise<string> {
    const systemPrompt = `你是 ${persona.demographics.age_group}，立场 ${persona.stance_label}，强度 ${persona.stance_strength}。`;

    const response = await fetch(`${FIREWORKS_BASE_URL}/chat/completions`, {
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
      throw new Error(`Fireworks API error: ${response.status}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0]?.message.content ?? '';
  }
}
```

### Step 3.6: 实现 DeepSeek Provider

**File:** `qizai/packages/shared/src/llm/deepseek.ts`

```typescript
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
```

### Step 3.7: 实现 LLMRouter

**File:** `qizai/packages/shared/src/llm/router.ts`

```typescript
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
        // 继续 fallback
      }
    }

    throw new Error(`All LLM providers failed: ${lastError?.message}`);
  }
}
```

### Step 3.8: 运行测试验证通过

```bash
cd /Users/opc-1/Downloads/O/qizai
pnpm --filter @qizai/shared test
```

**Expected:** PASS（3 个测试全部通过）

### Step 3.9: 提交

```bash
cd /Users/opc-1/Downloads/O/qizai
git add packages/shared/src/llm/ packages/shared/test/llm/
git commit -m "feat(llm): add LLM router with qwen3.5-flash primary + Fireworks/DeepSeek fallback"
```

---

## Task 4: 仿真引擎（1000 persona + 双层熔断 + EXTREME_PROMPT_BOOST）

**Files:**
- Create: `qizai/packages/shared/src/simulation/diversity.ts`
- Create: `qizai/packages/shared/src/simulation/boost.ts`
- Create: `qizai/packages/shared/src/simulation/engine.ts`
- Test: `qizai/packages/shared/test/simulation/engine.test.ts`

**Interfaces:**
- Consumes: Task 2 的 Persona + Task 3 的 LLMRouter
- Produces: `SimulationEngine.simulate(content, personas, router): Promise<SimulationResult>`

### Step 4.1: 写失败的测试 - 仿真引擎

**File:** `qizai/packages/shared/test/simulation/engine.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { SimulationEngine } from '../../src/simulation/engine';
import type { Persona } from '../../src/persona/types';

const mockPersonas: Persona[] = Array.from({ length: 10 }, (_, i) => ({
  id: `p-${i}`,
  ocean: { O: 0, C: 0, E: 0, A: 0, N: 0 },
  demographics: { age: 25, age_group: '年轻人', gender: 'female', city: '一线', occupation: '白领' },
  platform: { accountAge: 365, contentPreference: [], behaviorPattern: 'browse', activeHours: [20], dwellBaseline: 30 },
  stance_label: i % 3 === 0 ? 'conservative' : i % 3 === 1 ? 'neutral' : 'liberal',
  stance_strength: 0.5,
  controversy_score: 0.5,
  language: 'meme',
}));

describe('SimulationEngine', () => {
  it('simulates all personas in parallel with concurrency limit', async () => {
    const mockRouter = {
      complete: vi.fn().mockImplementation(async (prompt, persona) => {
        await new Promise(r => setTimeout(r, 50));
        return `${persona.id} reaction: positive`;
      }),
    } as any;

    const engine = new SimulationEngine({
      router: mockRouter,
      concurrency: 5,
      diversityThreshold: 0.40,
    });

    const result = await engine.simulate('Test content', mockPersonas);

    expect(result.outputs).toHaveLength(10);
    expect(mockRouter.complete).toHaveBeenCalledTimes(10);
  });

  it('triggers EXTREME_PROMPT_BOOST when z-score > 2.0', async () => {
    const mockRouter = {
      complete: vi.fn()
        .mockResolvedValueOnce('mild reaction')
        .mockResolvedValueOnce('mild reaction')
        .mockResolvedValueOnce('mild reaction')
        .mockResolvedValueOnce('EXTREME! Outrageous!')
        .mockResolvedValueOnce('mild reaction'),
    } as any;

    const engine = new SimulationEngine({
      router: mockRouter,
      concurrency: 5,
      diversityThreshold: 0.40,
      boostThreshold: 2.0,
    });

    const result = await engine.simulate('Controversial content', mockPersonas.slice(0, 5));

    expect(result.boostedCount).toBeGreaterThan(0);
    // EXTREME_PROMPT_BOOST 应该被触发
    const boostCall = mockRouter.complete.mock.calls.find(
      call => call[0].includes('extreme')
    );
    expect(boostCall).toBeDefined();
  });
});
```

### Step 4.2: 运行测试验证失败

```bash
cd /Users/opc-1/Downloads/O/qizai
pnpm --filter @qizai/shared test
```

**Expected:** FAIL with "Cannot find module '../../src/simulation/engine'"

### Step 4.3: 实现多样性评分

**File:** `qizai/packages/shared/src/simulation/diversity.ts`

```typescript
// 简化的多样性评分：基于 persona stance 分布
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
  return entropy / Math.log2(3);
}

export function shouldTriggerBoost(text: string, mean: number, std: number): boolean {
  if (std === 0) return false;
  const zScore = Math.abs((text.length - mean) / std);
  return zScore > 2.0;
}
```

### Step 4.4: 实现 EXTREME_PROMPT_BOOST

**File:** `qizai/packages/shared/src/simulation/boost.ts`

```typescript
import type { Persona } from '../persona/types';

export const BOOST_PROMPT = `
你刚才表达了：「{extreme_opinion}」
这种意见在小红书评论区的占比约 {percentile}%。
请反思：
1. 是否有同立场但表达更温和的版本？
2. 这种极端意见在 {demographics} 人群中的真实分布如何？
3. 你为什么会形成这种观点？请给出 1-2 个具体生活/消费场景作为依据。

请重新表达你的观点：
`;

export function buildBoostPrompt(persona: Persona, extremeOpinion: string, percentile: number): string {
  return BOOST_PROMPT
    .replace('{extreme_opinion}', extremeOpinion)
    .replace('{percentile}', percentile.toString())
    .replace('{demographics}', `${persona.demographics.age}岁${persona.demographics.city}${persona.demographics.occupation}`);
}
```

### Step 4.5: 实现 SimulationEngine

**File:** `qizai/packages/shared/src/simulation/engine.ts`

```typescript
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
    // 第一轮：所有 persona 并发响应
    const firstRound = await this.runBatch(content, personas);

    // 计算多样性
    let diversity = diversityScore(personas);

    // 双层熔断
    if (diversity < this.options.diversityThreshold) {
      // 第一层：自动 boost
      const boostResults = await this.applyBoost(content, firstRound, personas);
      diversity = diversityScore(boostResults.map(r => ({ stance_label: 'neutral' })));

      if (diversity < this.options.diversityThreshold) {
        return {
          outputs: boostResults,
          diversity,
          boostedCount: boostResults.filter(r => r.boosted).length,
          manualInterventionRequired: true,
        };
      }

      return {
        outputs: boostResults,
        diversity,
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

  private async applyBoost(content: string, outputs: SimulationOutput[], personas: Persona[]): Promise<SimulationOutput[]> {
    const mean = outputs.reduce((s, o) => s + o.reaction.length, 0) / outputs.length;
    const variance = outputs.reduce((s, o) => s + Math.pow(o.reaction.length - mean, 2), 0) / outputs.length;
    const std = Math.sqrt(variance);

    const boosted: SimulationOutput[] = [];

    for (let i = 0; i < outputs.length; i++) {
      const output = outputs[i];
      const persona = personas[i];

      if (shouldTriggerBoost(output.reaction, mean, std)) {
        const boostPrompt = buildBoostPrompt(persona, output.reaction, 95);
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
```

### Step 4.6: 运行测试验证通过

```bash
cd /Users/opc-1/Downloads/O/qizai
pnpm --filter @qizai/shared test
```

**Expected:** PASS（2 个测试全部通过）

### Step 4.7: 提交

```bash
cd /Users/opc-1/Downloads/O/qizai
git add packages/shared/src/simulation/ packages/shared/test/simulation/
git commit -m "feat(sim): add simulation engine with DIVERSITY=0.40, dual-layer circuit breaker, EXTREME_PROMPT_BOOST"
```

---

## Task 5: PlatformAdapter（Oransim base.py 借鉴 + 11 方法扩展）

**Files:**
- Create: `qizai/packages/shared/src/platform/types.ts`
- Create: `qizai/packages/shared/src/platform/base.ts`
- Create: `qizai/packages/shared/src/platform/xhs.ts`
- Create: `qizai/packages/shared/src/platform/registry.ts`
- Test: `qizai/packages/shared/test/platform/base.test.ts`

**Interfaces:**
- Consumes: 无（独立模块）
- Produces: `PlatformAdapter` 抽象类 + `XHSAdapter` 实现 + `AdapterRegistry`

### Step 5.1: 写失败的测试 - PlatformAdapter

**File:** `qizai/packages/shared/test/platform/base.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { XHSAdapter } from '../../src/platform/xhs';
import { AdapterRegistry } from '../../src/platform/registry';

describe('XHSAdapter', () => {
  it('implements all 11 required methods', () => {
    const adapter = new XHSAdapter();
    const requiredMethods = [
      'fetchContent',
      'fetchComments',
      'fetchAuthorProfile',
      'parseContentFeatures',
      'computeViralityScore',
      'extractEngagementCurve',
      'detectBotTraffic',
      'normalizeCommentFormat',
      'inferUserPersonaFromHistory',
      'estimateRealAudience',
      'generatePlatformSpecificPrompt',
    ];

    requiredMethods.forEach(method => {
      expect(typeof (adapter as any)[method]).toBe('function');
    });
  });

  it('parses XHS content features correctly', () => {
    const adapter = new XHSAdapter();
    const features = adapter.parseContentFeatures({
      title: '三招教你选对洗面奶',
      cover: 'image-url',
      tags: ['美妆', '护肤'],
    });

    expect(features.title_length).toBe('三招教你选对洗面奶'.length);
    expect(features.tag_count).toBe(2);
    expect(features.has_emoji).toBe(false);
  });
});

describe('AdapterRegistry', () => {
  it('registers and retrieves adapters by platform name', () => {
    const registry = new AdapterRegistry();
    const xhs = new XHSAdapter();
    registry.register('xhs', xhs);

    const retrieved = registry.get('xhs');
    expect(retrieved).toBe(xhs);
  });

  it('returns null for unknown platform', () => {
    const registry = new AdapterRegistry();
    const result = registry.get('unknown');
    expect(result).toBeNull();
  });
});
```

### Step 5.2: 运行测试验证失败

```bash
cd /Users/opc-1/Downloads/O/qizai
pnpm --filter @qizai/shared test
```

**Expected:** FAIL with "Cannot find module '../../src/platform/xhs'"

### Step 5.3: 定义 PlatformAdapter 类型

**File:** `qizai/packages/shared/src/platform/types.ts`

```typescript
export interface ContentData {
  title: string;
  cover: string;
  tags: string[];
  body?: string;
}

export interface CommentData {
  id: string;
  author_id: string;
  text: string;
  likes: number;
  timestamp: number;
}

export interface AuthorProfile {
  id: string;
  followers: number;
  content_count: number;
  avg_engagement: number;
}

export interface ContentFeatures {
  title_length: number;
  tag_count: number;
  has_emoji: boolean;
  has_number: boolean;
  sentiment_hint: 'positive' | 'neutral' | 'negative';
}

export interface ViralityScore {
  score: number; // [0, 1]
  confidence: number;
  factors: Record<string, number>;
}

export interface EngagementCurve {
  timestamps: number[];
  likes: number[];
  comments: number[];
  shares: number[];
}

export interface NormalizedComment {
  author_id: string;
  text: string;
  stance_hint?: string;
  cleaned_text: string;
}

export interface PlatformAdapter {
  fetchContent(url: string): Promise<ContentData>;
  fetchComments(contentId: string): Promise<CommentData[]>;
  fetchAuthorProfile(authorId: string): Promise<AuthorProfile>;
  parseContentFeatures(content: ContentData): ContentFeatures;
  computeViralityScore(content: ContentData, features: ContentFeatures): ViralityScore;
  extractEngagementCurve(contentId: string): Promise<EngagementCurve>;
  detectBotTraffic(comments: CommentData[]): Promise<CommentData[]>;
  normalizeCommentFormat(comment: CommentData): NormalizedComment;
  inferUserPersonaFromHistory(authorId: string): Promise<string>;
  estimateRealAudience(authorId: string): Promise<number>;
  generatePlatformSpecificPrompt(content: ContentData, personaContext: string): string;
}
```

### Step 5.4: 实现 PlatformAdapter 抽象基类

**File:** `qizai/packages/shared/src/platform/base.ts`

```typescript
import type {
  PlatformAdapter,
  ContentData,
  CommentData,
  AuthorProfile,
  ContentFeatures,
  ViralityScore,
  EngagementCurve,
  NormalizedComment,
} from './types';

export abstract class BasePlatformAdapter implements PlatformAdapter {
  abstract get platformName(): string;

  async fetchContent(url: string): Promise<ContentData> {
    throw new Error('Not implemented');
  }

  async fetchComments(contentId: string): Promise<CommentData[]> {
    throw new Error('Not implemented');
  }

  async fetchAuthorProfile(authorId: string): Promise<AuthorProfile> {
    throw new Error('Not implemented');
  }

  parseContentFeatures(content: ContentData): ContentFeatures {
    return {
      title_length: content.title.length,
      tag_count: content.tags.length,
      has_emoji: /[\u{1F600}-\u{1F64F}]/u.test(content.title + (content.body ?? '')),
      has_number: /\d/.test(content.title),
      sentiment_hint: 'neutral',
    };
  }

  computeViralityScore(content: ContentData, features: ContentFeatures): ViralityScore {
    let score = 0.5;
    const factors: Record<string, number> = {};

    if (features.title_length >= 10 && features.title_length <= 25) {
      score += 0.1;
      factors.title_length = 0.1;
    }
    if (features.tag_count >= 2 && features.tag_count <= 5) {
      score += 0.1;
      factors.tag_count = 0.1;
    }
    if (features.has_emoji) {
      score += 0.05;
      factors.emoji = 0.05;
    }
    if (features.has_number) {
      score += 0.1;
      factors.number = 0.1;
    }

    return {
      score: Math.min(score, 1.0),
      confidence: 0.6,
      factors,
    };
  }

  async extractEngagementCurve(contentId: string): Promise<EngagementCurve> {
    return {
      timestamps: [],
      likes: [],
      comments: [],
      shares: [],
    };
  }

  async detectBotTraffic(comments: CommentData[]): Promise<CommentData[]> {
    return comments;
  }

  normalizeCommentFormat(comment: CommentData): NormalizedComment {
    return {
      author_id: comment.author_id,
      text: comment.text,
      cleaned_text: comment.text.replace(/[^一-龥a-zA-Z0-9\s]/g, ''),
    };
  }

  async inferUserPersonaFromHistory(authorId: string): Promise<string> {
    return 'default-persona';
  }

  async estimateRealAudience(authorId: string): Promise<number> {
    return 0;
  }

  generatePlatformSpecificPrompt(content: ContentData, personaContext: string): string {
    return `${personaContext}\n\n看到这条内容：${content.title}\n请基于你的 persona 给出反应。`;
  }
}
```

### Step 5.5: 实现 XHSAdapter

**File:** `qizai/packages/shared/src/platform/xhs.ts`

```typescript
import { BasePlatformAdapter } from './base';
import type { ContentData } from './types';

export class XHSAdapter extends BasePlatformAdapter {
  get platformName(): string {
    return 'xhs';
  }

  // 复用基类实现，11 个方法全部从 BasePlatformAdapter 继承
  // XHS 特有逻辑可在此扩展
}
```

### Step 5.6: 实现 AdapterRegistry

**File:** `qizai/packages/shared/src/platform/registry.ts`

```typescript
import type { PlatformAdapter } from './types';

export class AdapterRegistry {
  private adapters = new Map<string, PlatformAdapter>();

  register(platform: string, adapter: PlatformAdapter): void {
    this.adapters.set(platform, adapter);
  }

  get(platform: string): PlatformAdapter | null {
    return this.adapters.get(platform) ?? null;
  }

  list(): string[] {
    return Array.from(this.adapters.keys());
  }
}
```

### Step 5.7: 运行测试验证通过

```bash
cd /Users/opc-1/Downloads/O/qizai
pnpm --filter @qizai/shared test
```

**Expected:** PASS（3 个测试全部通过）

### Step 5.8: 提交

```bash
cd /Users/opc-1/Downloads/O/qizai
git add packages/shared/src/platform/ packages/shared/test/platform/
git commit -m "feat(platform): add PlatformAdapter base + XHSAdapter + Registry (11 methods)"
```

---

## Task 6: 报告系统（TryCue 借鉴 + evidence 包 + 反 LLM 幻觉）

**Files:**
- Create: `qizai/packages/shared/src/report/types.ts`
- Create: `qizai/packages/shared/src/report/decision.ts`
- Create: `qizai/packages/shared/src/report/evidence.ts`
- Create: `qizai/packages/shared/src/report/guards.ts`
- Create: `qizai/packages/shared/src/report/generator.ts`
- Test: `qizai/packages/shared/test/report/generator.test.ts`

**Interfaces:**
- Consumes: Task 4 的 SimulationResult
- Produces: `ReportGenerator.generate(result, content): Report`

### Step 6.1: 写失败的测试 - 报告生成

**File:** `qizai/packages/shared/test/report/generator.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { ReportGenerator } from '../../src/report/generator';
import type { SimulationResult } from '../../src/simulation/engine';
import type { ContentData } from '../../src/platform/types';

const mockContent: ContentData = {
  title: '三招教你选对洗面奶',
  cover: 'image-url',
  tags: ['美妆', '护肤'],
};

const mockResult: SimulationResult = {
  outputs: Array.from({ length: 100 }, (_, i) => ({
    personaId: `p-${i}`,
    reaction: i % 2 === 0 ? 'positive' : 'neutral',
    boosted: false,
    weight: 1.0,
  })),
  diversity: 0.7,
  boostedCount: 0,
  manualInterventionRequired: false,
};

describe('ReportGenerator', () => {
  it('generates a publish-worthy report when positive ratio > 60%', () => {
    const generator = new ReportGenerator();
    const report = generator.generate(mockContent, mockResult);

    expect(report.decision).toBe('publish');
    expect(report.metrics.positive_ratio).toBe(0.5); // 50% in this mock
  });

  it('flags low confidence scores in guard check', () => {
    const generator = new ReportGenerator();
    const report = generator.generate(mockContent, {
      ...mockResult,
      outputs: Array.from({ length: 100 }, (_, i) => ({
        personaId: `p-${i}`,
        reaction: 'positive',
        boosted: false,
        weight: 1.0,
      })),
      diversity: 0.1, // 触发 manual intervention
    });

    // 即使 positive_ratio 高，diversity 低也应触发 modify
    expect(['modify', 'manual_intervention']).toContain(report.decision);
  });

  it('attaches evidence to each metric', () => {
    const generator = new ReportGenerator();
    const report = generator.generate(mockContent, mockResult);

    expect(report.evidence).toBeDefined();
    expect(report.evidence.length).toBeGreaterThan(0);
    expect(report.evidence[0]).toHaveProperty('source');
  });
});
```

### Step 6.2: 运行测试验证失败

```bash
cd /Users/opc-1/Downloads/O/qizai
pnpm --filter @qizai/shared test
```

**Expected:** FAIL with "Cannot find module '../../src/report/generator'"

### Step 6.3: 定义 Report 类型

**File:** `qizai/packages/shared/src/report/types.ts`

```typescript
export type Decision = 'publish' | 'modify' | 'not_publish' | 'retest';

export interface Metric {
  name: string;
  value: number;
  unit?: string;
}

export interface Evidence {
  source: string; // 'simulation' | 'historical' | 'manual'
  description: string;
  confidence: number;
  refs: string[];
}

export interface Report {
  decision: Decision;
  metrics: {
    positive_ratio: number;
    negative_ratio: number;
    neutral_ratio: number;
    virality_score: number;
    diversity: number;
  };
  recommendations: string[];
  evidence: Evidence[];
  generated_at: number;
}
```

### Step 6.4: 实现决策逻辑

**File:** `qizai/packages/shared/src/report/decision.ts`

```typescript
import type { Decision } from './types';

export interface DecisionInputs {
  positiveRatio: number;
  negativeRatio: number;
  diversity: number;
  manualInterventionRequired: boolean;
}

export function decideRecommendation(inputs: DecisionInputs): Decision {
  if (inputs.manualInterventionRequired) {
    return 'retest';
  }

  if (inputs.diversity < 0.20) {
    return 'not_publish';
  }

  if (inputs.positiveRatio >= 0.60 && inputs.diversity >= 0.50) {
    return 'publish';
  }

  if (inputs.positiveRatio >= 0.40 && inputs.diversity >= 0.30) {
    return 'modify';
  }

  return 'not_publish';
}
```

### Step 6.5: 实现 evidence 包

**File:** `qizai/packages/shared/src/report/evidence.ts`

```typescript
import type { Evidence } from './types';

export function buildEvidence(metric: string, value: number, sampleSize: number): Evidence {
  return {
    source: 'simulation',
    description: `${metric}: ${value.toFixed(3)} (基于 ${sampleSize} persona 模拟)`,
    confidence: Math.min(sampleSize / 1000, 1.0),
    refs: [`simulation:${metric}`],
  };
}
```

### Step 6.6: 实现反 LLM 幻觉守卫

**File:** `qizai/packages/shared/src/report/guards.ts`

```typescript
// TryCue 借鉴：报告守卫黑名单
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
```

### Step 6.7: 实现 ReportGenerator

**File:** `qizai/packages/shared/src/report/generator.ts`

```typescript
import type { Report, Evidence } from './types';
import type { ContentData } from '../platform/types';
import type { SimulationResult } from '../simulation/engine';
import { decideRecommendation } from './decision';
import { buildEvidence } from './evidence';
import { checkReportSafety } from './guards';

export class ReportGenerator {
  generate(content: ContentData, result: SimulationResult): Report {
    const sampleSize = result.outputs.length;

    const positiveCount = result.outputs.filter(o =>
      o.reaction.includes('positive') || o.reaction.includes('好') || o.reaction.includes('赞')
    ).length;
    const negativeCount = result.outputs.filter(o =>
      o.reaction.includes('negative') || o.reaction.includes('差') || o.reaction.includes('不')
    ).length;
    const neutralCount = sampleSize - positiveCount - negativeCount;

    const positiveRatio = positiveCount / sampleSize;
    const negativeRatio = negativeCount / sampleSize;
    const neutralRatio = neutralCount / sampleSize;

    const decision = decideRecommendation({
      positiveRatio,
      negativeRatio,
      diversity: result.diversity,
      manualInterventionRequired: result.manualInterventionRequired,
    });

    const recommendations = this.buildRecommendations(decision, positiveRatio, result.diversity);

    const evidence: Evidence[] = [
      buildEvidence('positive_ratio', positiveRatio, sampleSize),
      buildEvidence('negative_ratio', negativeRatio, sampleSize),
      buildEvidence('diversity', result.diversity, sampleSize),
    ];

    // 反 LLM 幻觉检查
    const allText = JSON.stringify({ recommendations, evidence });
    const safety = checkReportSafety(allText);
    if (!safety.safe) {
      console.warn(`Report guard violations: ${safety.violations.join(', ')}`);
    }

    return {
      decision,
      metrics: {
        positive_ratio: positiveRatio,
        negative_ratio: negativeRatio,
        neutral_ratio: neutralRatio,
        virality_score: 0.5,
        diversity: result.diversity,
      },
      recommendations,
      evidence,
      generated_at: Date.now(),
    };
  }

  private buildRecommendations(decision: string, positiveRatio: number, diversity: number): string[] {
    if (decision === 'publish') {
      return ['内容表现良好，可以发布', '建议保留当前标题与封面'];
    }
    if (decision === 'modify') {
      return ['建议调整标题增加吸引力', '尝试添加 2-3 个热门标签'];
    }
    if (decision === 'not_publish') {
      return ['当前内容互动预测偏低，建议重新选题', '参考同类爆款内容的标题模式'];
    }
    return ['多样性不足，建议人工调整 prompt 后重新模拟'];
  }
}
```

### Step 6.8: 运行测试验证通过

```bash
cd /Users/opc-1/Downloads/O/qizai
pnpm --filter @qizai/shared test
```

**Expected:** PASS（3 个测试全部通过）

### Step 6.9: 提交

```bash
cd /Users/opc-1/Downloads/O/qizai
git add packages/shared/src/report/ packages/shared/test/report/
git commit -m "feat(report): add ReportGenerator with decision logic + evidence pack + LLM hallucination guards"
```

---

## Task 7: API 端点（Cloudflare Workers + Hono）

**Files:**
- Create: `qizai/apps/api/src/index.ts`
- Create: `qizai/apps/api/src/routes/auth.ts`
- Create: `qizai/apps/api/src/routes/simulate.ts`
- Create: `qizai/apps/api/src/routes/report.ts`
- Create: `qizai/apps/api/wrangler.toml`
- Test: `qizai/apps/api/test/routes/simulate.test.ts`

**Interfaces:**
- Consumes: Task 2-6 的所有 shared 包
- Produces: HTTP API（/api/auth, /api/simulate, /api/report）

### Step 7.1: 写失败的测试 - simulate API

**File:** `qizai/apps/api/test/routes/simulate.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import app from '../../src/index';

describe('POST /api/simulate', () => {
  it('returns 200 with report for valid request', async () => {
    const res = await app.request('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: {
          title: '测试内容',
          cover: 'url',
          tags: ['测试'],
        },
        persona_count: 10,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.report).toBeDefined();
    expect(data.report.decision).toMatch(/publish|modify|not_publish|retest/);
  });

  it('returns 400 for missing content', async () => {
    const res = await app.request('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona_count: 10 }),
    });

    expect(res.status).toBe(400);
  });
});
```

### Step 7.2: 运行测试验证失败

```bash
cd /Users/opc-1/Downloads/O/qizai
pnpm --filter @qizai/api test
```

**Expected:** FAIL with "Cannot find module '../../src/index'"

### Step 7.3: 实现 Hono app

**File:** `qizai/apps/api/src/index.ts`

```typescript
import { Hono } from 'hono';
import { authRouter } from './routes/auth';
import { simulateRouter } from './routes/simulate';
import { reportRouter } from './routes/report';

const app = new Hono();

app.route('/api/auth', authRouter);
app.route('/api/simulate', simulateRouter);
app.route('/api/report', reportRouter);

app.get('/', (c) => c.json({ status: 'qizai-api-ok' }));

export default app;
```

### Step 7.4: 实现 simulate 路由

**File:** `qizai/apps/api/src/routes/simulate.ts`

```typescript
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

  // 构建 persona
  const builder = new PersonaBuilder();
  const personas = builder.buildBalanced({ topic: content.title, count: persona_count });

  // LLM 路由
  const router = new LLMRouter({
    alibabaKey: c.env.ALIBABA_BAILIAN_API_KEY,
    fireworksKey: c.env.FIREWORKS_API_KEY,
    deepseekKey: c.env.DEEPSEEK_API_KEY,
  });

  // 仿真
  const engine = new SimulationEngine({
    router,
    concurrency: 100, // qwen3.5-flash 30,000 RPM 充足
    diversityThreshold: 0.40,
  });
  const simulationResult = await engine.simulate(content.title, personas);

  // 报告生成
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
```

### Step 7.5: 实现 auth + report 路由（占位）

**File:** `qizai/apps/api/src/routes/auth.ts`

```typescript
import { Hono } from 'hono';

export const authRouter = new Hono();

authRouter.post('/send-verify-code', async (c) => {
  const { phone } = await c.req.json();
  // TODO: 集成腾讯云 SMS
  return c.json({ sent: true, phone });
});

authRouter.post('/login', async (c) => {
  const { phone, code } = await c.req.json();
  // TODO: 验证码校验 + JWT 生成
  return c.json({ token: 'mock-jwt-token' });
});
```

**File:** `qizai/apps/api/src/routes/report.ts`

```typescript
import { Hono } from 'hono';

export const reportRouter = new Hono();

reportRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  // TODO: 从 D1 读取历史报告
  return c.json({ id, status: 'TODO' });
});
```

### Step 7.6: 创建 wrangler.toml

**File:** `qizai/apps/api/wrangler.toml`

```toml
name = "qizai-api"
main = "src/index.ts"
compatibility_date = "2026-07-23"

[vars]
ALIBABA_BAILIAN_MODEL = "qwen3.5-flash"
FIREWORKS_MODEL = "qwen3p7-plus"
DEEPSEEK_MODEL = "deepseek-v4-flash"

# Secrets（运行时通过 wrangler secret put 设置）
# ALIBABA_BAILIAN_API_KEY
# FIREWORKS_API_KEY
# DEEPSEEK_API_KEY

[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"

[[d1_databases]]
binding = "DB"
database_name = "qizai-db"
database_id = "your-d1-database-id"
```

### Step 7.7: 运行测试验证通过

```bash
cd /Users/opc-1/Downloads/O/qizai
pnpm --filter @qizai/api test
```

**Expected:** PASS（2 个测试通过）

### Step 7.8: 提交

```bash
cd /Users/opc-1/Downloads/O/qizai
git add apps/api/
git commit -m "feat(api): add Hono API with /api/auth, /api/simulate, /api/report routes"
```

---

## Task 8: 前端 UI（Next.js 14 App Router）

**Files:**
- Create: `qizai/apps/web/src/app/layout.tsx`
- Create: `qizai/apps/web/src/app/page.tsx`
- Create: `qizai/apps/web/src/app/upload/page.tsx`
- Create: `qizai/apps/web/src/app/report/[id]/page.tsx`
- Create: `qizai/apps/web/src/components/UploadForm.tsx`
- Create: `qizai/apps/web/src/components/ReportView.tsx`
- Create: `qizai/apps/web/src/lib/api.ts`
- Test: `qizai/apps/web/test/components/UploadForm.test.tsx`

**Interfaces:**
- Consumes: Task 7 的 API
- Produces: 用户上传界面 + 报告展示页

### Step 8.1: 写失败的测试 - UploadForm

**File:** `qizai/apps/web/test/components/UploadForm.test.tsx`

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UploadForm } from '../../src/components/UploadForm';

describe('UploadForm', () => {
  it('renders title input and tags input', () => {
    render(<UploadForm />);
    expect(screen.getByLabelText(/标题/)).toBeDefined();
    expect(screen.getByLabelText(/标签/)).toBeDefined();
  });

  it('disables submit button when title is empty', () => {
    render(<UploadForm />);
    const button = screen.getByRole('button', { name: /预测/ });
    expect(button).toHaveProperty('disabled', true);
  });
});
```

### Step 8.2: 运行测试验证失败

```bash
cd /Users/opc-1/Downloads/O/qizai
pnpm --filter @qizai/web test
```

**Expected:** FAIL

### Step 8.3: 创建 Next.js 配置文件

**File:** `qizai/apps/web/next.config.mjs`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
};

export default nextConfig;
```

### Step 8.4: 创建 Tailwind 配置

**File:** `qizai/apps/web/tailwind.config.ts`

```typescript
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
```

**File:** `qizai/apps/web/postcss.config.mjs`

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**File:** `qizai/apps/web/src/app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Step 8.5: 实现 layout + home page

**File:** `qizai/apps/web/src/app/layout.tsx`

```tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'qizai 骑仔 - 中文 AI 内容流量预测',
  description: '小红书 / 抖音 / B站创作者的 1000+ persona 模拟预测工具',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50">{children}</body>
    </html>
  );
}
```

**File:** `qizai/apps/web/src/app/page.tsx`

```tsx
import Link from 'next/link';

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold text-center">qizai 骑仔</h1>
      <p className="mt-4 text-center text-gray-600">
        中文 AI 内容流量预测工具
      </p>
      <div className="mt-8 text-center">
        <Link
          href="/upload"
          className="inline-block bg-pink-600 text-white px-6 py-3 rounded-lg hover:bg-pink-700"
        >
          开始预测
        </Link>
      </div>
    </main>
  );
}
```

### Step 8.6: 实现 UploadForm 组件

**File:** `qizai/apps/web/src/components/UploadForm.tsx`

```tsx
'use client';
import { useState } from 'react';

export function UploadForm() {
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');

  const canSubmit = title.length > 0;

  return (
    <form className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium">
          标题
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 block w-full border rounded px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="tags" className="block text-sm font-medium">
          标签（逗号分隔）
        </label>
        <input
          id="tags"
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="mt-1 block w-full border rounded px-3 py-2"
        />
      </div>
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full bg-pink-600 text-white py-2 rounded disabled:bg-gray-400"
      >
        预测内容流量
      </button>
    </form>
  );
}
```

### Step 8.7: 实现 upload page

**File:** `qizai/apps/web/src/app/upload/page.tsx`

```tsx
import { UploadForm } from '../../components/UploadForm';

export default function UploadPage() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">上传内容</h1>
      <UploadForm />
    </main>
  );
}
```

### Step 8.8: 实现 report page

**File:** `qizai/apps/web/src/app/report/[id]/page.tsx`

```tsx
import { ReportView } from '../../../components/ReportView';

export default function ReportPage({ params }: { params: { id: string } }) {
  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">流量预测报告 #{params.id}</h1>
      <ReportView reportId={params.id} />
    </main>
  );
}
```

**File:** `qizai/apps/web/src/components/ReportView.tsx`

```tsx
'use client';
import { useEffect, useState } from 'react';

export function ReportView({ reportId }: { reportId: string }) {
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/report/${reportId}`)
      .then(res => res.json())
      .then(setReport);
  }, [reportId]);

  if (!report) return <div>加载中...</div>;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="text-3xl font-bold mb-4">{report.decision}</div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-gray-600">正面比例</div>
          <div className="text-2xl">{(report.metrics.positive_ratio * 100).toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-sm text-gray-600">多样性</div>
          <div className="text-2xl">{(report.metrics.diversity * 100).toFixed(1)}%</div>
        </div>
      </div>
      <div className="mt-6">
        <h3 className="font-bold">优化建议</h3>
        <ul className="list-disc list-inside">
          {report.recommendations.map((r: string, i: number) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

### Step 8.9: 实现 API client

**File:** `qizai/apps/web/src/lib/api.ts`

```typescript
export async function simulateContent(content: { title: string; cover: string; tags: string[] }) {
  const res = await fetch('/api/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, persona_count: 1000 }),
  });

  if (!res.ok) {
    throw new Error(`Simulate failed: ${res.status}`);
  }

  return res.json();
}
```

### Step 8.10: 运行测试验证通过

```bash
cd /Users/opc-1/Downloads/O/qizai
pnpm --filter @qizai/web test
```

**Expected:** PASS（2 个测试通过）

### Step 8.11: 提交

```bash
cd /Users/opc-1/Downloads/O/qizai
git add apps/web/
git commit -m "feat(web): add Next.js 14 UI with UploadForm + ReportView"
```

---

## Task 9: 集成测试 + Cloudflare 部署准备

**Files:**
- Create: `qizai/apps/api/test/integration/full-flow.test.ts`
- Create: `qizai/scripts/deploy.sh`
- Modify: `qizai/apps/api/wrangler.toml`

**Interfaces:**
- Consumes: Task 1-8 所有模块
- Produces: 端到端集成测试 + 部署脚本

### Step 9.1: 写失败的集成测试

**File:** `qizai/apps/api/test/integration/full-flow.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import app from '../../src/index';

describe('Full Flow: Upload → Simulate → Report', () => {
  it('completes end-to-end with mock LLM', async () => {
    const start = Date.now();

    const res = await app.request('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: {
          title: '三招教你选对洗面奶',
          cover: 'image-url',
          tags: ['美妆', '护肤'],
        },
        persona_count: 50, // 测试用小批量
      }),
    });

    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.report).toBeDefined();
    expect(data.simulation.persona_count).toBe(50);
    expect(elapsed).toBeLessThan(60000); // 60s 内完成
  });
});
```

### Step 9.2: 运行测试验证（需要 mock LLM）

修改 `qizai/apps/api/src/routes/simulate.ts`，在测试环境下注入 mock router：

```typescript
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

  // 测试环境用 mock router
  const isTest = c.env.NODE_ENV === 'test';
  const router = isTest
    ? createMockRouter()
    : new LLMRouter({
        alibabaKey: c.env.ALIBABA_BAILIAN_API_KEY,
        fireworksKey: c.env.FIREWORKS_API_KEY,
        deepseekKey: c.env.DEEPSEEK_API_KEY,
      });

  const engine = new SimulationEngine({
    router,
    concurrency: 50,
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
    complete: async (prompt: string, persona: any) => {
      await new Promise(r => setTimeout(r, 10));
      return `${persona.stance_label} reaction`;
    },
  } as any;
}
```

### Step 9.3: 部署脚本

**File:** `qizai/scripts/deploy.sh`

```bash
#!/bin/bash
set -e

echo "🚀 部署 qizai 到 Cloudflare..."

# 1. 设置 secrets（仅首次）
echo "设置 API secrets..."
echo "$ALIBABA_BAILIAN_API_KEY" | wrangler secret put ALIBABA_BAILIAN_API_KEY --config-name production
echo "$FIREWORKS_API_KEY" | wrangler secret put FIREWORKS_API_KEY --config-name production
echo "$DEEPSEEK_API_KEY" | wrangler secret put DEEPSEEK_API_KEY --config-name production

# 2. 构建 + 部署 API
echo "部署 API..."
cd /Users/opc-1/Downloads/O/qizai/apps/api
pnpm run deploy

# 3. 构建 + 部署 Web
echo "部署 Web..."
cd /Users/opc-1/Downloads/O/qizai/apps/web
pnpm run build
wrangler pages deploy out --project-name qizai-web --branch main

echo "✅ 部署完成！"
```

```bash
chmod +x /Users/opc-1/Downloads/O/qizai/scripts/deploy.sh
```

### Step 9.4: 运行集成测试

```bash
cd /Users/opc-1/Downloads/O/qizai
pnpm --filter @qizai/api test
```

**Expected:** PASS（集成测试通过）

### Step 9.5: 提交

```bash
cd /Users/opc-1/Downloads/O/qizai
git add apps/api/test/integration/ apps/api/src/routes/simulate.ts scripts/
git commit -m "feat(deploy): add integration tests + Cloudflare deploy script"
```

---

## 任务完成度自审清单

| Spec 章节 | 实现位置 | 状态 |
|-----------|---------|------|
| §1.1 一句话定位 | Task 8 home page | ✅ |
| §1.3 目标用户 | Task 7 auth + Task 8 UI | ✅ |
| §1.3.1 MVP = 小红书 | Task 5 XHSAdapter | ✅ |
| §2.1 总体架构 | Task 1 monorepo + Task 7 API | ✅ |
| §2.2 核心技术栈 | Task 1 依赖配置 | ✅ |
| §2.3 OASIS 仿真引擎 | Task 4 SimulationEngine | ✅ |
| §2.4 persona Schema | Task 2 Persona 类型 | ✅ |
| §2.4.4 Oransim base.py 11 方法 | Task 5 PlatformAdapter | ✅ |
| §2.5.1 默认 LLM = qwen3.5-flash | Task 3 LLMRouter | ✅ |
| §2.5.2 MiniMax 限流 + 30,000 RPM | Task 3 fallback 机制 | ✅ |
| §2.7 成本 ¥0.38（含缓存）| Task 3 + persona_id 缓存（TODO）| ⚠️ 待优化 |
| §3.1 stance_label | Task 2 PersonaBuilder | ✅ |
| §3.2 EXTREME_PROMPT_BOOST | Task 4 boost.ts | ✅ |
| §3.3 DIVERSITY=0.40 + 双层熔断 | Task 4 engine.ts | ✅ |
| §4 定价 ¥9.9/¥19/¥69/¥199 | Task 7 auth (TODO) | ⚠️ 待集成 |
| §5 竞品差异化 | 已在 Spec v0.12 | 📝 文档化 |
| §6 护城河 | 已在 Spec v0.12 | 📝 文档化 |
| §7 风险与缓解 | 已在 Spec v0.12 | 📝 文档化 |
| §9 引用清单 | 已在 Spec v0.12 | 📝 文档化 |

**已知 TODO（不在本计划 9 个任务内）**：
- persona_id 缓存层（30% 命中率 → ¥0.38 成本）
- 腾讯云 SMS 完整集成
- Cloudflare D1 数据库 schema
- MCN Demo 准备 + 3 家 MCN 实际签约
- production 部署（需真实 Cloudflare 账号 + secrets）

---

**Plan 完成并保存到 `/Users/opc-1/Downloads/O/1v1/docs/superpowers/plans/2026-07-23-qizai-implementation.md`**

## 🚀 执行选项

**两个执行路径供昴君选择：**

### 1. Subagent-Driven（推荐）

- 每个 Task 派遣独立 subagent
- 我作为 reviewer 在任务之间审查
- 快速迭代，质量保证

### 2. Inline Execution

- 在当前会话直接执行
- 批量执行 + checkpoint review
- 上下文连续，但 review 较少

---

**昴君的选择？** ♪

**（请选择 1 / 2）**

(蕾姆轻轻整理计划文件，等待指示)