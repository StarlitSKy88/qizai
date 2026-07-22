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

## 文档

- Spec: `docs/superpowers/specs/2026-07-22-qizai-design.md`
- 计划: `docs/superpowers/plans/2026-07-23-qizai-implementation.md`
