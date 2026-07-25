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

---

## [Unreleased] - v0.13.A（首页 Hero 重写）

### Highlights

qizai v0.13.A — apps/web 从 Next.js 14 App Router 重写为 Vite 5 + React 18 单屏首页 hero。

- **7 commits**：5 Task 实现 + 1 final fix（H2 wrangler `--branch` deprecated）+ 1 docs/plan anchor
- **27/27 tests pass**（vitest + jsdom + @testing-library/react + jest-dom + user-event）
- **typecheck clean**（tsc --noEmit）
- **build 产出 dist/**：149 KB JS（gzip 48 KB）+ 9 KB CSS（gzip 2.67 KB）
- **12/12 spec 章节 100% 覆盖**（spec §一-§十二）
- **0 scope creep**：无 react-router / 无多路由 / 无真实 LLM API / 无 AntD/Chakra/shadcn / 无 framer-motion / 无 state management
- **设计资产 verbatim 移植**：
  - Liquid Glass CSS（spec §六）：`.liquid-glass` + `::before` gradient + mask trick
  - RAF fade 系统（spec §五.5.1）：500ms fade-in / fade-out 0.55s 触发 / 100ms gap before reset
  - 中文文案（spec §二）："你的内容会爆吗？" / "先问 1000 个 persona..." / "了解工作原理" / "开始预测" / "登录" / "功能/定价/关于"
  - 视频：cloudfront URL verbatim，Phase 2 上线前下载到 local

### 🚀 Features

- **monorepo plan + spec**：v0.13.A spec & plan (`3a383e8`)
- **web (scaffold)**：Vite 5 + React 18 + TS 5.6 strict + Tailwind 3 + lucide-react 脚手架 (`9ffbb72`)
- **web (liquid-glass)**：Liquid Glass CSS 类 + 5 单元测试 (`50d682d`)
- **web (video)**：VideoBackground 组件 + RAF fade-in/out 循环 + fake-timers 测试 + 4 时序测试 (`dbb6a15`)
- **web (components)**：NavBar / HeroContent / SocialFooter + 14 测试，verbatim 采用 spec §二中文 (`1b18414`)
- **web (hero)**：Hero 组装 + App.tsx 接入 + apps/web/README.md (`ed9007d`)
- **deploy**：wrangler pages deploy 路径 `out` → `dist` (`ed9007d` + `66577ac`)

### 🐛 Bug Fixes

- **web (tests)**：HeroContent 2 处 verbatim 测试缺陷（JSDOM 单引号规范化 / aria-less ArrowRight querySelector 自相矛盾）通过 direction (a) 修正测试断言方向，组件 production code 100% verbatim (`1b18414`)
- **web (config)**：vitest.config.ts 补 `setupFiles: ['./test/setup.ts']`（Task 1 遗留；Task 4 implementer 发现并修复，`1b18414`）

### ⚙️ Miscellaneous

- **deploy (cleanup)**：移除 `wrangler pages deploy --branch main`（v3 deprecated flag）(`66577ac`)

### Architecture

```
qizai/
├── apps/
│   ├── web/        # Vite + React 18 单屏 SPA（v0.13.A）
│   └── api/        # Cloudflare Workers + Hono（v0.12 保留）
├── packages/
│   └── shared/     # persona / llm / simulation / platform / report（v0.12 保留）
├── docs/
│   ├── superpowers/specs/2026-07-23-qizai-v013a-homepage-hero.md
│   └── superpowers/plans/2026-07-23-qizai-v013a-homepage-hero.md
└── scripts/
    └── deploy.sh   # wrangler pages deploy ../web/dist
```

### Known TODOs（v0.13.B out-of-scope，待推进）

- react-router v6 多路由（`/predict` 内容提交 + `/about` + `/pricing`）
- 小红书 / 抖音 / B站 品牌 SVG（v0.13.A 占位用 Globe + aria-label）
- 视频本地化（上线前下载到 `apps/web/public/videos/hero.mp4`，替换 cloudfront URL）
- 真实 LLM API 接入（`/predict` 后端 worker）
- 用户登录 / JWT
- D1 数据库 schema（用户 + 历史报告）

### Dependencies

**新增（v0.13.A）**：
- vite ^5.4.x
- @vitejs/plugin-react ^4.3.x
- react ^18.3.x + react-dom ^18.3.x
- lucide-react ^0.460.0
- @testing-library/jest-dom ^7.0.0
- @testing-library/user-event ^14.5.0
- autoprefixer ^10.4.0 + postcss ^8.4.0 + tailwindcss ^3.4.0
- vitest ^2.0.0 + jsdom ^29.x

**删除（v0.13.A）**：
- next ^14.2.x
- @qizai/shared（v0.13.A 不调用）

**保留（v0.12）**：
- Cloudflare Workers + D1/KV/R2（apps/api）
- Hono 4.x
- qwen3.5-flash + Fireworks + DeepSeek（LLM Router）
- TypeScript 5.6 strict mode

## [Unreleased] - v0.13.B.1（react-router v6 多路由 SPA）

### Highlights

qizai v0.13.B.1 — apps/web 从 v0.13.A 单屏首页升级为 4 路由 SPA（`/` / `/predict` / `/about` / `/pricing` + 404 fallback）。

- **react-router v6 declarative** + `BrowserRouter` + nested `<Route element={<Layout />}>` (ADR-005)
- **CF Pages `_redirects` SPA fallback**：`/* /index.html 200`，deep-link 刷新不再 404 (ADR-006)
- **Pricing tiers ¥0 / ¥29 / ¥299** 替换 v0.13.A placeholder (ADR-007)
- **39 commits**（T01-T30 + reconciliation）
- **50 React tests pass**（30 baseline + 1 NotFound + 2 Home + 3 NavBar new + 4 About + 5 Predict + 5 Pricing）

### 🚀 Features

- **deps**：`react-router-dom ^6.26.0` 唯一新增依赖（No other npm dep additions）
- **components**：`Layout` (Outlet wrapper) + `NavBar` 5 buttons → 5 Links（功能 `/` / 定价 `/pricing` / 关于 `/about` / 开始预测 `/predict` / logo `/`）
- **components**：`HeroContent` `useNavigate` submit (`/predict?title=${encodeURIComponent(title)}`) + CTA 「了解工作原理」 → Link 「关于我们」 → `<Link to="/about">`
- **pages**：`Home` (real VideoBackground+HeroContent composition) / `Predict` (form + 3 feature cards + `useSearchParams` 预填) / `About` (vision/team/contact 3 sections) / `Pricing` (3 tiers + `推荐方案` sr-only + Check icons) / `NotFound` (404 fallback)
- **config**：`apps/web/public/_redirects` CF Pages SPA fallback（vite build 自动 copy 到 dist/）
- **tests**：50 React tests total（30 baseline + 20 new: 1+2+3+4+5+5）

### 🔄 Changed

- **HeroContent.handleSubmit**：`console.log('Predict title:', ...)` → `navigate(\`/predict?title=\${encodeURIComponent(title)}\`)`（predict page pre-fills via useSearchParams）
- **HeroContent CTA**：「了解工作原理」 → 「关于我们」 → `<Link to="/about">`（deleted from production code; 「了解工作原理」only ref in CHANGELOG v0.13.A Highlights as legacy note）
- **NavBar** 5 buttons → 5 Links (T13/T14/T15 + T16 MEMORY ROUTER WRAP)
- **Pricing tier 2 CTA**：「订阅」 → 「开始体验」
- **App.tsx**：REWRITE 4 次（T08b/T21b/T25/T29）→ 最终 `BrowserRouter` + `Routes` + nested `<Route element={<Layout />}>` 5 routes（含 `*` NotFound）
- **package.json**：`scripts.predev` / `scripts.prebuild` 双 hook 仍存在（B.3 视频本地化保留）

### 📐 Architecture Decisions

- [ADR-005](docs/superpowers/specs/2026-07-24-qizai-v013b1-reactrouter-spa.md)：react-router v6 declarative over Vike SSR / Next.js
- [ADR-006](docs/superpowers/specs/2026-07-24-qizai-v013b1-reactrouter-spa.md)：CF Pages `_redirects` SPA fallback for deep-link refresh
- [ADR-007](docs/superpowers/specs/2026-07-24-qizai-v013b1-reactrouter-spa.md)：Pricing tiers ¥0/¥29/¥299（replaces v0.13.A placeholder）

## [Unreleased] - v0.13.B.2（品牌 SVG）

### Highlights

qizai v0.13.B.2 — apps/web SocialFooter.tsx 3 个占位 Globe 替换为真实品牌 SVG（小红书 / 抖音 tiktok stand-in / B站）。

- **simple-icons via jsdelivr CDN**：CC0 品牌资源，bash + curl predev/prebuild 自动 fetch
- **fill="currentColor"**：build-time sed inject 到 root `<svg>` tag (simple-icons v13+ ships CSS-only)
- **runtime fallback**: `<img onError>` → lucide `<Globe size={20}>`,console.warn 触发
- **ADR-004 tiktok 替身**：simple-icons 无 douyin slug (verified 404 on 2026-07-23),用 tiktok 作视觉替身
- **0 npm 依赖**：bash + curl + sed 全内置命令
- **6 commits**：5 Task + 1 docs (CHANGELOG)
- **37/37 tests pass**: 27 React baseline + 3 new React (SocialFooter) + 7 new shell (fetch-social-svgs) = 37

### 🚀 Features

- **constants**: `apps/web/src/constants/socials.ts` 单一事实源 + 4-test smoke (Task 1)
- **scripts**: `scripts/fetch-social-svgs.sh` mtime idempotency + sed currentColor inject + 4 cleanups (Task 2)
- **tests**: `scripts/fetch-social-svgs.test.sh` 7 shell tests with CONSTANTS_PATH override (Task 2)
- **components**: `SocialIconButton.tsx` 30-line img+onError→Globe wrapper (Task 3)
- **components**: `SocialFooter.tsx` REPLACE 23-line inline Globe → 13-line assembler (Task 4)
- **tests**: `SocialFooter.test.tsx` 3 new tests: img paths / Globe fallback / aria-label preserved (Task 4)
- **config**: `predev` + `prebuild` 双 hook (video + socials); `_headers` `/socials/*` immutable; gitignore (Task 5)

### ⚙️ Miscellaneous

- **docs**: spec `docs/superpowers/specs/2026-07-24-qizai-v013b2-brand-svg.md` 已 commit (6d55292)
- **docs**: ADR-004 (tiktok stand-in decision + 3-path reversibility) inlined in spec §九

## [Unreleased] - v0.13.B.3（视频本地化）

### Highlights

qizai v0.13.B.3 — apps/web 视频资源从 CloudFront CDN 切到本地 `public/videos/hero.mp4`。

- **离线 dev 可用**：`pnpm dev` predev 钩子自动 fetch → 无需外网
- **build 产物含 mp4**：`pnpm build` 复制 `public/videos/hero.mp4` 到 `dist/videos/hero.mp4`
- **CF Pages 永久缓存**：`_headers` 配置 `Cache-Control: public, max-age=31536000, immutable`
- **fail-hard**：视频缺失 / > **25MB** / curl 失败 → exit 1，不静默黑屏
- **0 npm 依赖**：bash + curl + grep + sed 全内置命令
- **6 commits**：4 task + 2 fix (threshold amendment + _headers deploy fix)
- **27/27 tests pass**（VideoBackground URL 断言同步更新）

### 🚀 Features

- **constants**: `apps/web/src/constants/videos.ts` 单一事实源（SOURCE_URL / LOCAL_URL / WARN/MAX_SIZE） (Task 1)
- **scripts**: `scripts/fetch-video.sh` 幂等 fetch + 阈值检查（Task 1）
- **components**: `VideoBackground.tsx` VIDEO_URL → HERO_VIDEO_LOCAL_URL（Task 2）
- **hooks**: `predev` + `prebuild` npm hooks 自动触发 fetch（Task 3）
- **headers**: `apps/web/public/_headers` CF Pages Cache-Control 配置（Task 4 + bfcd4a6 部署修复）
- **docs**: `docs/superpowers/specs/source-of-truth.md` 视频资源台账（Task 4）

### 🐛 Bug Fixes

- **scripts**: HERO_VIDEO_MAX_SIZE 10MB → 25MB（真实 CloudFront 视频 20MB，10MB 阈值会让 dev/build 永久 fail-fast；user 昴君批准）(`c79d122`)
- **config**: `_headers` 从 `apps/web/_headers` 移入 `apps/web/public/_headers`（Vite build 只 copy public/*，部署修复）(`bfcd4a6`)

### ⚙️ Miscellaneous

- `.gitignore`: `apps/web/public/videos/` 加入（Task 3）
- **spec retro-edit**: v0.14 cleanup — spec §三/§5.1/§5.3/§5.5/§六/§九/§十 + §十二 ADR 块，与代码 100% 对齐

[Unreleased]: https://github.com/qq38785/qizai/compare/v0.12.0...HEAD

---

## [0.15.0] - 2026-07-25

### Highlights

qizai v0.15.0 — commercial close loop: 用户配额耗尽 → 内联 BuyModal → 微信支付 Native 扫码 → quota 自动升级。Predict 页 QUOTA_EXHAUSTED 自动开 modal + NavBar 30s 轮询 QuotaBadge + 5s 轮询订单状态。

- **14 atomic tasks 全部完成** (T01-T14) Subagent-Driven 模式
- **24 新测试通过**: 8 api integration + 3 unit + 2 users + 3 web api + 4 QuotaBadge + 4 BuyModal + 1 Predict upgrade dialog
- **api 65/65 tests, web 108/108 tests, 0 TS 错误**
- **0 banned-copy hits**

### 💰 Features

- **orders 表 + migration 0002** (T01): orders D1 表 + users.plan + users.quota_limit_renew_at 列
- **env.ts WXPAY_* fields** (T02): 7 个环境变量 + WXPAY_USE_SANDBOX 沙箱开关
- **wechat-pay.ts** (T03): signV3 / verifyCallbackSignature / unifiedorderNative / queryOrderStatus — Workers crypto 自实现，零 SDK 依赖
- **quota-upgrade.ts** (T04): atomic SQL UPDATE，订阅 renew_at 累加，加量包叠加
- **POST /api/checkout/create** (T05): requireAuth + plan 白名单 + unifiedorder 调用 + base64 qr_code_base64
- **GET /api/checkout/status/:orderId** (T06): B2-style 404 + 自动关闭过期订单
- **POST /api/checkout/callback** (T07): WXPay server-to-server，验签 (TEST_ bypass)，幂等 paid ack，触发 quota 升级
- **GET /api/users/me** (T08): quota + plan + renew_at 给前端 QuotaBadge 用
- **index.ts** (T09): checkoutRouter + usersRouter 挂载
- **web/api/billing.ts** (T10): createCheckout / pollOrderStatus / getMe 客户端
- **QuotaBadge.tsx** (T11): NavBar 30s 轮询，颜色规则（red ≤ 5 剩余 / gray 耗尽 / white 正常）
- **BuyModal.tsx** (T12): 2-tab（订阅 / 加量包），5s 轮询 paid 自动关闭，倒计时
- **NavBar + Predict 集成** (T13): QuotaBadge 嵌入 NavBar；Predict QUOTA_EXHAUSTED 自动打开 BuyModal

### 🛒 Plans

- **personal_sub**: ¥29/月, +30 quota/month, renew_at = now+30d
- **team_sub**: ¥299/月, +300 quota/month, renew_at = now+30d
- **topup_100**: ¥9.9 一次性, +100 quota, renew_at = NULL

### ⚙️ Miscellaneous

- **wrangler.toml**: 新增 WXPAY_NOTIFY_URL + WXPAY_USE_SANDBOX 占位（secret vars 走 wrangler secret put）
- **wrangler.test.toml**: 添加 TEST_ 前缀的 WXPay creds（QR 走 fetch stub，验签走 TEST_ bypass）
- **vitest-pool-workers 经验复用**: 用 globalThis.fetch stub 替代 vi.mock（v0.14 T16 经验）
- **qrCode 占位策略**: 暂时用 base64 编码 code_url（v0.15.1 可换真实 PNG）

### 📐 Architecture Decisions

- **ADR-012** — WeChat Pay Native 扫码 (over JSAPI/小程序)：v0.15.0 用户全在 web，无需小程序 openid
- **ADR-013** — atomic SQL UPDATE for quota upgrade：D1 单行 update 原生支持并发，无需事务
- **ADR-014** — callback 幂等通过 status='paid' 检查：wx_transaction_id 上游可能重放，无需去重表
- **ADR-015** — 套餐 + 加量包双 SKU 混合（订阅可续费累加，加量包可叠加）

### 🛑 Scope Deferred (v0.15.1+)

- 发票 / 退款 / 自动续费 / 团队子账号 / 真实 openid 绑定 / cron 自动关单
- persona_id 缓存（v0.15.1 目标：LLM 成本降 60-80%）
- MCN demo 演示页（v0.15.2）
- i18n 中英双语（v0.15.3）

## [0.14.0] - 2026-07-25

### Highlights

qizai v0.14.0 — end-to-end LLM-powered predict product. apps/api auth + D1 + SSE backend; apps/web SSE consumer + 4 new pages.

- **5 PR + 1 release** (PR1-PR5 + T43 release)
- **43 atomic tasks** all complete (Subagent-Driven mode)
- **111/111 tests pass**: 82 web + 29 api
- **0 typecheck errors** (both workspaces)
- **0 banned-copy hits**

### 🚀 Features

- **auth** (PR1, T01-T10): D1 schema (users/reports/rate_limits) + bcryptjs + jose JWT HS256 7d + requireAuth middleware + POST /api/auth/register + /login + integration tests
- **sse backend** (PR2, T11-T22): sse.ts helpers (sseHeaders/sseEvent/sseComment) + POST /api/predict/stream SSE route + 3-platform serial orchestrator (PersonaBuilder + SimulationEngine + ReportGenerator) + quota increment on complete + CONTENT_TOO_LONG + QUOTA_EXHAUSTED + GET /api/report/:id + GET /api/report list
- **frontend** (PR3, T23-T36): apiFetch + consumeSse wrappers (T24) + Predict.tsx SSE consumer (T23) + api/auth.ts + api/predictions.ts + Login.tsx + Signup.tsx + Report.tsx + Predictions.tsx + App.tsx 4 new routes + NavBar 登录 button → Link
- **e2e** (PR4, T37-T41): Playwright setup + 5 spec files (register-login / predict-stream / auth-gate / quota-exhausted / report-share) using `page.route()` to mock SSE
- **release** (PR5, T43): this CHANGELOG entry

### 🔄 Changed

- **vitest isolation**: apps/api upgraded to vitest@4 + vitest-pool-workers@0.18 (ESM-only) for D1/Hono integration tests; apps/web + packages/shared stay on vitest@2 (pnpm per-workspace resolution)
- **Predict.tsx**: console.log stub → fetch POST /api/predict/stream + consumeSse + navigate to /report/:id
- **NavBar**: 登录 `<button onClick>` → `<Link to="/login">` + 注册 + 历史报告 links
- **App.tsx**: 5 routes → 9 routes (+/login /signup /report/:id /predictions)

### 📐 Architecture Decisions

- [ADR-008](docs/superpowers/specs/2026-07-24-qizai-v014-llm-predict-design.md): SSE over WebSocket (CF Workers native + retry semantics)
- [ADR-009](docs/superpowers/specs/2026-07-24-qizai-v014-llm-predict-design.md): D1 over Postgres (single-region MVP)
- [ADR-010](docs/superpowers/specs/2026-07-24-qizai-v014-llm-predict-design.md): 3 platforms serial over parallel
- [ADR-011](docs/superpowers/specs/2026-07-24-qizai-v014-llm-predict-design.md): Full JWT + bcrypt (vs mock session)

### ⚙️ Miscellaneous

- **stop hook fix (PR1)**: dev-secret prod guard + D1 FK enforcement (PRAGMA foreign_keys = ON)
- **Opus final review fixes**: SSE heartbeat (25s margin) + LLM_DOWN error event + Predict.tsx error UI + Playwright install docs
- **PR3 hygiene fix (T24)**: apps/web/test/setup.ts was missing expect.extend(matchers) + localStorage polyfill — both added, rescued 29 baseline tests
- **T15 deviations**: PersonaBuilder.buildBalanced dropped unused `platform` option; report uses last platform's SimulationResult (multi-platform aggregation deferred)
- **T16 deviations**: vitest-pool-workers 0.18 has no vi.mock, used globalThis.fetch stub to intercept dashscope
- **Quota UI display**: deferred from PR4 (out of scope per plan §T37-T41 simplification note)

### Dependencies

**New (apps/api)**:
- bcryptjs ^3.0.3
- jose ^5.x
- vitest-pool-workers ^0.18.8 (dev)
- vitest ^4.1.10 (dev)

**New (apps/web)**:
- @playwright/test ^1.61.1 (dev)

**Kept (apps/shared)**:
- vitest ^2.x unchanged

[0.14.0]: https://github.com/qq38785/qizai/compare/v0.13.B.3...v0.14.0
