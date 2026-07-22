# Changelog

All notable changes to qizai will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.12.0] - 2026-07-23

### Highlights

qizai v0.12 MVP — 中文 AI 内容流量预测工具首个完整可运行版本。

- **9 个 Plan Tasks 全部完成**（Subagent-Driven mode）
- **16 commits**：12 个 feat + 4 个 fix（含 whole-branch review 触发的 final-fix wave）
- **31/31 tests pass**，3 workspaces typecheck clean
- **Spec v0.12 核心目标全覆盖**：
  - §2.4.3 Persona Schema（含 stance_label）
  - §2.5.1 默认 LLM = qwen3.5-flash（阿里云百炼，30,000 RPM）
  - §2.4.4 Oransim 11 方法 PlatformAdapter
  - §3.1 stance_label（Liberal Bias 缓解）
  - §3.2 EXTREME_PROMPT_BOOST
  - §3.3 DIVERSITY=0.40 + 双层熔断

### 🚀 Features

- **monorepo**：初始化 `apps/web` + `apps/api` + `packages/shared` workspaces (`b83b62d`)
- **persona**：Persona type + OCEAN + stance_label + balanced builder (`fabedd1`)
- **llm**：LLM router with qwen3.5-flash + Fireworks/DeepSeek fallback chain (`6fdae16`)
- **simulation**：Simulation engine with DIVERSITY=0.40 + dual-layer circuit breaker + EXTREME_PROMPT_BOOST (`b2f6f11`)
- **platform**：PlatformAdapter 基类（11 方法）+ XHSAdapter + AdapterRegistry (`68a5f1d`)
- **report**：ReportGenerator with decision logic + evidence pack + LLM hallucination guards (`76de859`)
- **api**：Hono API on Cloudflare Workers（`/api/auth`, `/api/simulate`, `/api/report`）(`d1d354f`)
- **web**：Next.js 14 App Router UI with UploadForm + ReportView (`9830f50`)
- **deploy**：integration tests + Cloudflare deploy script (`b5538db`)

### 🐛 Bug Fixes

- **persona**：`buildBalancedPersonas` 修复 mutation violation，改用 immutable spread pattern (`112b130`)
- **api**：vitest.config.ts 改用相对路径（跨平台可移植）(`cbd63ae`)
- **api**：`process.env.NODE_ENV` → `c.env.NODE_ENV`（Cloudflare Workers 安全）(`51efce9`)
- **simulation**：`SimulationOptions.boostThreshold` 接通到 `shouldTriggerBoost`（原是 dead field）(`2a24103`)
- **simulation**：EXTREME_PROMPT_BOOST 现在透传原始 content（Spec §3.2 对齐）(`4c5f0b8`)
- **report**：中文 sentiment heuristic 修复双重计数（negation context 优先）(`e90382e`)

### ⚙️ Miscellaneous

- `.superpowers/` SDD scratch 加入 `.gitignore`（`c65a440`）

### Architecture

```
qizai/
├── apps/
│   ├── web/        # Next.js 14 App Router + Tailwind
│   └── api/        # Cloudflare Workers + Hono
├── packages/
│   └── shared/     # persona / llm / simulation / platform / report
├── docs/           # Spec + Plan + Research reports
└── scripts/
    └── deploy.sh   # Cloudflare deploy
```

### Known TODOs（out of v0.12 scope）

- persona_id 缓存层（30% 命中率 → ¥0.38 成本目标）
- 腾讯云 SMS 完整集成（当前 auth 是 mock）
- Cloudflare D1 数据库 schema（用户 + 历史报告）
- MCN Demo 准备 + 首批 3 家 MCN 实际签约
- 生产部署（需真实 Cloudflare 账号 + secrets）

### Dependencies

- Next.js 14 App Router
- Hono 4.x
- Cloudflare Workers + D1/KV/R2
- qwen3.5-flash（阿里云百炼）
- Fireworks qwen3p7-plus / DeepSeek v4-flash fallback
- TypeScript 5.6 strict mode
- vitest 2.x

[0.12.0]: https://github.com/qq38785/qizai/releases/tag/v0.12.0
