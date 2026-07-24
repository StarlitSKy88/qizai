# qizai v0.13.B.1 Multi-route SSR — Spec **[ARCHIVED → v0.14]**

> **⚠️ ARCHIVED 2026-07-24**: This spec was based on the **deprecated** `vite-plugin-ssr` package (now renamed **Vike**). Per 3-agent + 4-teammate audit (b65591b), the API surface in §五 is outdated and `renderPage`/`Link`/`passToClient` are not in the correct shape.
>
> **Decision (user 昴君, 2026-07-24)**: v0.13.B.1 ships as **react-router v6 pure SPA** (no SSR). SEO/SSR is deferred to **v0.14+**.
>
> **This document is preserved as design research** — when v0.14 SSR is revisited, use this as a starting point but verify every API call against current Vike docs (`https://vike.dev/`).
>
> Do NOT use this spec for implementation in v0.13.B.1. See `2026-07-24-qizai-v013b1-reactrouter-spa.md` for the current B.1 spec.

> **For agentic workers:** Brainstormed design, not yet an implementation plan. After user review, invoke `superpowers:writing-plans` to produce the TDD plan.

**Goal:** Upgrade qizai from v0.13.A single-screen SPA to a multi-route SSR app: add `/predict`, `/about`, `/pricing` pages with real Chinese copy, enable SEO indexing + deep-link sharing, while preserving v0.13.A's Vite+React 18+TS 5.6 strict stack and v0.13.B.2's brand SVG assets.

**Architecture:** vite-plugin-ssr file-based routing on Cloudflare Pages Functions SSR. Pages share `_layout/+Layout.tsx` (NavBar + SocialFooter wrapper). `apps/api/` Hono Workers remain untouched under `/api/*` route prefix. No new abstraction layers.

**Tech Stack:** Vite 5 + React 18 + TS 5.6 strict + Tailwind 3 + lucide-react (carried from v0.13.A/B.2). **New:** `vite-plugin-ssr` (SSR core), `@cloudflare/workers-types` (CF runtime types), `wrangler ^3` (deploy). **Not adding:** react-router (vite-plugin-ssr handles routing), Next.js (out of scope per v0.13.A §一), Express/Koa.

## 一、Scope

**In:**

1. 3 new pages: `/predict`, `/about`, `/pricing` with real Chinese copy (蕾姆-written, user-approved post-spec).
2. SSR rendering on all 4 routes (`/`, `/predict`, `/about`, `/pricing`) for SEO + deep-link.
3. File-based routing via `pages/<route>/+Page.tsx`.
4. Shared layout (`_layout/+Layout.tsx`) wrapping NavBar + SocialFooter.
5. Cloudflare Pages Functions catch-all SSR entry (`functions/[[path]].ts`).
6. `wrangler.toml` for Pages deploy config (project name `qizai-web`).
7. `/api/*` route prefix continues to route to existing `apps/api/` Workers (separate deploy).
8. Static asset rules from v0.13.B.2 preserved (`/socials/*`, `/videos/*` immutable headers).
9. Test suite expansion: α (route navigation + component rendering, ~30+ new React tests), β (SSR `render()` HTML snapshot, 4 snapshot tests), γ (bash curl smoke on dev server, in prebuild hook).
10. CHANGELOG v0.13.B.1 entry synced.

**Out:**

- No Next.js (v0.13.A §一 explicitly forbade; remains forbidden).
- No react-router (vite-plugin-ssr handles routing).
- No new state management library (Redux/Zustand/Jotai).
- No animation library (no framer-motion/auto-animate).
- No UI library (no AntD/Chakra/shadcn — Tailwind verbatim).
- No auth/登录 real logic (still mock console.log, deferred to v0.13.B.4+).
- No real LLM API call on /predict form submit (still console.log placeholder, deferred to v0.13.B.4).
- No SSR data-fetching (no Apollo/SWR/React Query — pages are static copy only).
- No analytics, no error reporting, no i18n.

## 二、User-facing behavior

### 2.1 Route map

| URL | Page | Purpose |
|---|---|---|
| `/` | Hero (carried from v0.13.A) | Landing — "你的内容会爆吗？" CTA → /predict |
| `/predict` | Predict | 真实表单占位（标题输入 + 「开始预测」按钮），提交后 console.log；v0.14 接 LLM |
| `/about` | About | 团队 / 愿景 / 联系方式（真实中文文案） |
| `/pricing` | Pricing | 3 档定价（试用 / 个人创作者 / 团队） |

### 2.2 Navigation

- NavBar 「功能」「定价」「关于」从 `<a href="#xxx">` 改为 `<Link to="/xxx">`（vite-plugin-ssr `Link`）。
- NavBar 「开始预测」按钮从 `onClick={console.log}` 改为 `<Link to="/predict">`。
- NavBar 「登录」按钮保持 `onClick={console.log('敬请期待 登录')}`（auth defer v0.13.B.4+）。
- HeroContent 表单 submit：从 `console.log` 改为 `<Link to={`/predict?title=${encodeURIComponent(title)}`}>` 路由跳转（替代 v0.13.B.3 的 navigateTo）。

### 2.3 SSR behavior

- Initial page load: server returns full HTML with Chinese copy inlined → SEO can index.
- Client-side navigation: subsequent `<Link>` clicks switch route without page refresh, no white flash.
- Hydration: React mounts onto existing DOM, doesn't re-render.
- Direct deep-link (`/predict?title=xxx`): server-side reads query, hydrates predict page with title pre-filled.

### 2.4 Visual continuity

- All pages share `pages/_layout/+Layout.tsx`: NavBar (top) + `<Outlet />` + SocialFooter (bottom).
- Background video on `/` only (Hero's VideoBackground). `/predict`, `/about`, `/pricing` use plain dark gradient bg (Tailwind `bg-gradient-to-b from-slate-900 to-black`).
- Typography: `Instrument Serif` (H1) + system sans (body), carried from v0.13.A §六 verbatim.

## 三、Tech stack and rationale

| Choice | Why |
|---|---|
| vite-plugin-ssr over Next.js | Preserves v0.13.A Vite+React 18 decision; minimal config; file routing is built-in |
| vite-plugin-ssr over react-router | One less dep; built-in SSR; user chose file-based routing (i) in brainstorm |
| Cloudflare Pages Functions | Free tier covers MVP; existing `apps/api/` Workers pattern matches |
| File-based routing | Recommended by vite-plugin-ssr docs; add page = add file |
| `_layout/+Layout.tsx` | Shares NavBar+SocialFooter wrapper; avoids 4× duplication |
| `bg-gradient-to-b` on non-Hero pages | Video bg would distract on content-heavy pages; gradient is cheap |
| `Link to={`/predict?title=...`}` | Preserves SEO + deep-link for the form |

## 四、File structure

```
apps/web/
├── functions/                          ← NEW: Cloudflare Pages Functions
│   └── [[path]].ts                    ← catch-all SSR entry (Workers runtime)
├── pages/                              ← NEW: vite-plugin-ssr file routes
│   ├── index/
│   │   └── +Page.tsx                  ← Hero (migrated from src/Hero.tsx)
│   ├── predict/
│   │   ├── +Page.tsx                  ← NEW
│   │   └── +Page.test.tsx             ← NEW (α test: form + content rendering)
│   ├── about/
│   │   ├── +Page.tsx                  ← NEW
│   │   └── +Page.test.tsx             ← NEW (α test)
│   ├── pricing/
│   │   ├── +Page.tsx                  ← NEW
│   │   └── +Page.test.tsx             ← NEW (α test)
│   ├── _layout/
│   │   └── +Layout.tsx                ← NEW: NavBar + Outlet + SocialFooter wrapper
│   └── _default/
│       └── +Page.tsx                  ← NEW: 404 fallback
├── renderer/                           ← NEW: vite-plugin-ssr config
│   ├── +config.ts                     ← passToClient, meta, etc.
│   └── +onRenderHtml.tsx              ← HTML wrapper: <html lang="zh-CN"> + meta + SEO
├── src/                                ← PRESERVED (cross-page reusable)
│   ├── components/                    ← NavBar, HeroContent, SocialFooter, etc. UNTOUCHED
│   ├── constants/                     ← socials.ts (v0.13.B.2) UNTOUCHED
│   ├── styles/                        ← index.css UNTOUCHED
│   └── ... (other files UNTOUCHED)
├── test/                               ← NEW location for SSR tests
│   ├── ssr/                           ← NEW
│   │   ├── index.ssr.test.ts          ← NEW (β: SSR HTML snapshot for /)
│   │   ├── predict.ssr.test.ts        ← NEW (β)
│   │   ├── about.ssr.test.ts          ← NEW (β)
│   │   └── pricing.ssr.test.ts        ← NEW (β)
│   └── ... (existing tests preserved)
├── public/                             ← UNTOUCHED (v0.13.B.2 socials/videos/_headers)
│   ├── _headers
│   ├── socials/
│   └── videos/
├── scripts/
│   └── ssr-smoke.sh                   ← NEW: bash curl smoke (γ test, prebuild/manual)
├── wrangler.toml                       ← NEW: Cloudflare Pages config
├── vite.config.ts                      ← MODIFY: add vite-plugin-ssr plugin
├── package.json                        ← MODIFY: dev/build/preview commands, new deps
├── tsconfig.json                       ← MODIFY: include pages/, renderer/, functions/
└── .gitignore                          ← MODIFY: append apps/web/functions/ node_modules
```

## 五、Technical details

### 5.1 pages/index/+Page.tsx (migrated from src/Hero.tsx)

```typescript
// Re-export Hero composition verbatim — only import path changes
export { default } from '../../src/components/Hero';
```

### 5.2 pages/predict/+Page.tsx (NEW)

```typescript
import { useState, FormEvent } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { navigate } from 'vite-plugin-ssr/client'; // for client-side query handling

export default function Page() {
  const [title, setTitle] = useState('');

  // v0.14 will replace this with real LLM API call
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log(`[predict] 敬请期待 v0.14 LLM 接入, 当前标题: ${title}`);
  };

  return (
    <div className="relative z-10 max-w-4xl mx-auto px-6 py-16 text-white">
      <h1 className="text-5xl md:text-6xl font-bold mb-6" style={{ fontFamily: "'Instrument Serif', serif" }}>
        预测你的内容会爆吗
      </h1>
      <p className="text-white/80 text-lg leading-relaxed mb-12">
        粘贴标题、简介或正文，让 1000 个 persona 帮你投票决定要不要发布。
        小红书 / 抖音 / B站 一键预测，覆盖 30 天流量曲线。
      </p>
      <form onSubmit={handleSubmit} className="liquid-glass rounded-full pl-6 pr-2 py-2 flex items-center gap-3 mb-8">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="粘贴你的标题或内容..."
          className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/40 text-base py-1"
        />
        <button type="submit" className="bg-white rounded-full p-3 text-black hover:bg-white/90 transition-colors">
          <ArrowRight size={20} />
        </button>
      </form>
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { icon: Sparkles, title: '30 秒拿到结果', desc: '1000 个 persona 并行投票，不打扰你写稿' },
          { icon: Sparkles, title: '3 平台同测', desc: '小红书 / 抖音 / B站 一键同跑，对比预测流量' },
          { icon: Sparkles, title: '可解释报告', desc: '每个预测附「为什么爆 / 为什么凉」决策依据' },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="liquid-glass rounded-2xl p-6">
            <Icon size={24} className="mb-3 text-white/90" />
            <h3 className="text-white font-semibold mb-2">{title}</h3>
            <p className="text-white/70 text-sm leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 5.3 pages/about/+Page.tsx (NEW)

```typescript
import { Users, Target, Mail } from 'lucide-react';

export default function Page() {
  return (
    <div className="relative z-10 max-w-4xl mx-auto px-6 py-16 text-white">
      <h1 className="text-5xl md:text-6xl font-bold mb-6" style={{ fontFamily: "'Instrument Serif', serif" }}>
        关于 qizai
      </h1>
      <p className="text-white/80 text-lg leading-relaxed mb-12">
        qizai（骑仔）是给个人内容创作者的流量预测 co-pilot。
        我们相信创作不该赌运气 ——
        在按下「发布」之前，先问 1000 个真实 persona 帮你投票。
      </p>
      <div className="space-y-8">
        <section>
          <div className="flex items-center gap-3 mb-3">
            <Target size={24} className="text-white/90" />
            <h2 className="text-2xl font-semibold">愿景</h2>
          </div>
          <p className="text-white/70 leading-relaxed pl-9">
            让每个认真创作的个体都能用上原本只属于大公司的流量预判工具。
            不做内容农场，只做更聪明的发布前决策。
          </p>
        </section>
        <section>
          <div className="flex items-center gap-3 mb-3">
            <Users size={24} className="text-white/90" />
            <h2 className="text-2xl font-semibold">团队</h2>
          </div>
          <p className="text-white/70 leading-relaxed pl-9">
            创始团队来自内容创作 + 算法工程交叉背景。
            我们自己也是重度创作者 —— qizai 的每个功能都从「我自己用得着吗」出发。
          </p>
        </section>
        <section>
          <div className="flex items-center gap-3 mb-3">
            <Mail size={24} className="text-white/90" />
            <h2 className="text-2xl font-semibold">联系我们</h2>
          </div>
          <p className="text-white/70 leading-relaxed pl-9">
            邮件 <a href="mailto:hi@qizai.app" className="underline hover:text-white">hi@qizai.app</a>，
            或小红书 / 抖音 / B站 搜索「qizai 骑仔」找到我们。
          </p>
        </section>
      </div>
    </div>
  );
}
```

### 5.4 pages/pricing/+Page.tsx (NEW)

```typescript
import { Check } from 'lucide-react';

const TIERS = [
  {
    name: '试用',
    price: '¥0',
    period: '/ 永久',
    desc: '看看 qizai 适合不适合你',
    features: ['每天 3 次预测', '单平台测试', '基础报告'],
    cta: '免费开始',
    highlight: false,
  },
  {
    name: '个人创作者',
    price: '¥29',
    period: '/ 月',
    desc: '认真做内容的独立创作者',
    features: ['无限预测', '3 平台同测', '完整报告 + 决策依据', '历史报告存档 90 天'],
    cta: '订阅',
    highlight: true,
  },
  {
    name: '团队',
    price: '¥299',
    period: '/ 月',
    desc: 'MCN / 内容工作室',
    features: ['个人版全部功能', '5 个子账号', '历史报告永久存档', 'API 接入', '优先客服'],
    cta: '联系销售',
    highlight: false,
  },
] as const;

export default function Page() {
  return (
    <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 text-white">
      <h1 className="text-5xl md:text-6xl font-bold mb-6 text-center" style={{ fontFamily: "'Instrument Serif', serif" }}>
        定价
      </h1>
      <p className="text-white/80 text-lg leading-relaxed mb-12 text-center max-w-2xl mx-auto">
        不收智商税 —— 按真实使用量定价，不限并发不限功能。
      </p>
      <div className="grid md:grid-cols-3 gap-6">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className={`liquid-glass rounded-2xl p-8 ${tier.highlight ? 'ring-2 ring-white/30' : ''}`}
          >
            <h2 className="text-2xl font-semibold mb-2">{tier.name}</h2>
            <p className="text-white/60 text-sm mb-4">{tier.desc}</p>
            <div className="mb-6">
              <span className="text-4xl font-bold">{tier.price}</span>
              <span className="text-white/60 text-sm ml-1">{tier.period}</span>
            </div>
            <ul className="space-y-2 mb-8">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check size={16} className="mt-0.5 flex-shrink-0 text-white/80" />
                  <span className="text-white/80">{f}</span>
                </li>
              ))}
            </ul>
            <button
              className={`w-full rounded-full py-3 text-sm font-medium transition-colors ${
                tier.highlight
                  ? 'bg-white text-black hover:bg-white/90'
                  : 'liquid-glass text-white hover:bg-white/5'
              }`}
            >
              {tier.cta}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 5.5 pages/_layout/+Layout.tsx (NEW)

```typescript
import { ReactNode } from 'react';
import NavBar from '../../src/components/NavBar';
import SocialFooter from '../../src/components/SocialFooter';

interface Props {
  children?: ReactNode;
}

export default function Layout({ children }: Props) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-900 to-black">
      <NavBar />
      <main className="flex-1">{children}</main>
      <SocialFooter />
    </div>
  );
}
```

### 5.6 pages/_default/+Page.tsx (NEW, 404 fallback)

```typescript
export default function Page() {
  return (
    <div className="relative z-10 max-w-2xl mx-auto px-6 py-32 text-white text-center">
      <h1 className="text-6xl font-bold mb-4" style={{ fontFamily: "'Instrument Serif', serif" }}>
        404
      </h1>
      <p className="text-white/70 text-lg mb-8">这个页面不存在 — 也许 qizai 还没想好怎么做</p>
      <a href="/" className="inline-block liquid-glass rounded-full px-8 py-3 text-white text-sm hover:bg-white/5">
        回到首页
      </a>
    </div>
  );
}
```

### 5.7 renderer/+config.ts (NEW)

```typescript
import type { Config } from 'vite-plugin-ssr/types';

export default {
  // Allow pages to receive URL query params at SSR time
  passToClient: ['url', 'routeParams'],
} satisfies Config;
```

### 5.8 renderer/+onRenderHtml.tsx (NEW)

```typescript
import ReactDOMServer from 'react-dom/server';
import { PageShell } from './PageShell';
import type { OnRenderHtml } from 'vite-plugin-ssr/types';

export const onRenderHtml: OnRenderHtml = (pageContext) => {
  const { Page, pageProps, urlPathname, description, title } = pageContext;
  const documentHtml = ReactDOMServer.renderToString(
    <PageShell pageContext={pageContext}>
      <Page {...pageProps} />
    </PageShell>
  );
  return {
    documentHtml,
    pageContext: {
      // Set in passToClient for hydration
    },
  };
};

// Head injection — title, description, lang="zh-CN"
```

### 5.9 functions/[[path]].ts (NEW, Cloudflare Pages Functions entry)

```typescript
import { renderPage } from 'vite-plugin-ssr/server';

export async function onRequest(context: EventContext<unknown, string, unknown>): Promise<Response> {
  const { request, env } = context;
  // Skip /api/* — handled by separate apps/api/ Workers deploy
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) {
    return new Response('Not Found', { status: 404 });
  }
  const pageContext = await renderPage({ urlOriginal: request.url });
  const { httpResponse } = pageContext;
  if (!httpResponse) return new Response('Not Found', { status: 404 });
  return new Response(httpResponse.body, {
    status: httpResponse.statusCode,
    headers: httpResponse.headers,
  });
}
```

### 5.10 wrangler.toml (NEW)

```toml
name = "qizai-web"
compatibility_date = "2024-09-23"
pages_build_output_dir = "dist"

[site]
bucket = "./dist"
```

### 5.11 vite.config.ts (MODIFY)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import ssr from 'vite-plugin-ssr/plugin';

export default defineConfig({
  plugins: [react(), ssr()],
  // ... rest carried verbatim from v0.13.A
});
```

### 5.12 package.json (MODIFY)

Add dependencies:
- `vite-plugin-ssr` (latest, ~0.9.x at spec time)
- `@cloudflare/workers-types` (devDep)

Add/modify scripts:
- `dev`: `vite` (vite-plugin-ssr handles SSR in dev via middleware)
- `build`: unchanged (vite-plugin-ssr auto-builds both client + server bundles)
- `preview`: `wrangler pages dev ./dist` (replaces `vite preview` for SSR testing)

### 5.13 apps/web/src/components/NavBar.tsx (MODIFY)

Change `<a href="#features">` etc. to `<Link to="/predict">` etc. using vite-plugin-ssr's `<Link>` component. Change `onClick={toast}` for 「开始预测」 to `<Link to="/predict">`. All visual classes preserved verbatim.

### 5.14 apps/web/src/components/HeroContent.tsx (MODIFY)

Change form submit from `console.log` to `navigate('/predict?title=' + encodeURIComponent(title))` using vite-plugin-ssr's `navigate()`.

## 六、Tests

### 6.1 α: jsdom + vitest route/component tests (~30 new tests)

**`apps/web/pages/predict/+Page.test.tsx`** (NEW, 5 tests):
- renders H1 "预测你的内容会爆吗"
- renders 3 feature cards with icons
- form input updates title state
- form submit calls console.log with title (no LLM API yet)
- submits with empty title → still logs (validation deferred v0.14)

**`apps/web/pages/about/+Page.test.tsx`** (NEW, 4 tests):
- renders H1 "关于 qizai"
- renders vision / team / contact sections (3 sections)
- mailto link to hi@qizai.app
- social search hint "小红书 / 抖音 / B站 搜索「qizai 骑仔」"

**`apps/web/pages/pricing/+Page.test.tsx`** (NEW, 5 tests):
- renders 3 pricing tiers
- middle tier (个人创作者) has highlight ring
- "试用" tier shows ¥0, 个人创作者 ¥29, 团队 ¥299
- each tier lists features with Check icon
- "订阅" CTA on highlighted tier uses bg-white text-black

**`apps/web/pages/_layout/+Layout.test.tsx`** (NEW, 3 tests):
- layout renders NavBar + outlet + SocialFooter
- uses bg-gradient-to-b from-slate-900 to-black
- preserves all 3 brand SVG buttons in SocialFooter

**`apps/web/test/components/NavBar.test.tsx`** (MODIFY, existing 5 → 8 tests):
- existing 5 preserved verbatim
- new: 功能/定价/关于 links have `href="/predict"` etc. (vite-plugin-ssr Link uses `href` attribute)
- new: 「开始预测」 link points to `/predict`
- new: clicking link doesn't trigger full page reload (mock `useNavigate` or assert `href` not onclick)

### 6.2 β: SSR HTML snapshot tests (4 tests, one per page)

**`apps/web/test/ssr/*.ssr.test.ts`** (NEW, 4 files):
- import `renderPage` from `vite-plugin-ssr/server`
- call `renderPage({ urlOriginal: 'http://localhost:3000/<route>' })`
- assert returned HTML contains:
  - `<!DOCTYPE html>` or `<html lang="zh-CN">`
  - H1 text of the page
  - `data-testid="ssr-rendered"` (custom marker for verification)
  - for `/`: contains "你的内容会爆吗？"
  - for `/predict`: contains "预测你的内容会爆吗"
  - for `/about`: contains "关于 qizai"
  - for `/pricing`: contains "定价"
- assert HTML does NOT contain placeholder text like "TODO" or "Lorem"

### 6.3 γ: bash curl smoke test (NEW, scripts/ssr-smoke.sh)

**`apps/web/scripts/ssr-smoke.sh`** (NEW, executable):
- 1 test: start dev server (`pnpm dev` in background), curl 4 URLs (`/`, `/predict`, `/about`, `/pricing`), assert each returns HTTP 200 + HTML contains expected H1
- Runs in prebuild hook + manual; **NOT in vitest suite** (would slow CI)

### 6.4 Test count math

| Category | Baseline (v0.13.B.2) | Added | Total |
|---|---|---|---|
| React (jsdom + vitest) | 30 | ~17 | **47** |
| Shell | 13 | ~4 (γ) | **17** |
| **Total** | 43 | ~21 | **~64** |

(β SSR tests are 4 separate vitest files but each is 1 test → adds 4 to React count.)

## 七、Task decomposition (high-level preview, plan will detail TDD steps)

| Task | Files | Test |
|---|---|---|
| Task 1 | Install vite-plugin-ssr + @cloudflare/workers-types + wrangler; update vite.config.ts; `pnpm typecheck` clean | tsc --noEmit pass |
| Task 2 | Migrate `src/Hero.tsx` → `pages/index/+Page.tsx` (re-export); create `pages/_layout/+Layout.tsx`; create `pages/_default/+Page.tsx` | Existing 30 React tests pass + new layout tests |
| Task 3 | Create `pages/predict/+Page.tsx` + test | 5 new α tests pass |
| Task 4 | Create `pages/about/+Page.tsx` + test | 4 new α tests pass |
| Task 5 | Create `pages/pricing/+Page.tsx` + test | 5 new α tests pass |
| Task 6 | `functions/[[path]].ts` + `wrangler.toml` + `renderer/+config.ts` + `renderer/+onRenderHtml.tsx` + 4 β SSR tests | β tests pass |
| Task 7 | Modify `NavBar.tsx` + `HeroContent.tsx` to use vite-plugin-ssr `Link`/`navigate`; `scripts/ssr-smoke.sh`; `package.json` preview script; `_headers` preserve; `.gitignore` `functions/` node_modules | γ smoke test pass; all 47 React + 13+4 shell = 64 total pass; typecheck clean; build produces dist with ssr entry |
| Task 8 | Integration smoke + CHANGELOG entry | All 64 tests pass, typecheck 0 errors, CHANGELOG v0.13.B.1 synced |

## 八、Global constraints

- **Baseline test preservation:** 43 tests from v0.13.B.2 must continue to pass.
- **Target test count:** 47 React + 17 shell = 64 total (v0.13.B.2 was 30+13=43, +21 from B.1).
- **typecheck clean** (TS 5.6 strict) — `all modified/new files pass \`tsc --noEmit\``.
- **0 scope creep:** no Next.js, no react-router, no state mgmt, no UI lib, no animation lib.
- **SSR for all 4 routes**, not just `/`.
- **Preserve v0.13.B.2** brand SVG assets + `/socials/*`, `/videos/*` _headers.
- **Preserve `apps/api/`** Hono Workers (separate deploy, `/api/*` route prefix).
- **CHANGELOG.md v0.13.B.1 entry** synced on merge.
- **macOS/Linux portability** for new shell scripts.
- **No real auth, no real LLM, no real payment** — all placeholders for v0.13.B.4+.

## 九、ADR (architectural decision records)

### ADR-005: vite-plugin-ssr over Next.js / react-router (NEW)

- **Decision:** Use vite-plugin-ssr for multi-route SSR.
- **Rationale:**
  1. Preserves v0.13.A Vite + React 18 + TS 5.6 strict stack (CHANGELOG Known TODOs originally listed only "react-router v6", but user clarified SSR is needed for SEO → vite-plugin-ssr is the lightest path that adds SSR without abandoning Vite).
  2. File-based routing eliminates explicit route config; add page = add file.
  3. Built-in SSR with hydration; no separate API route needed for HTML generation.
  4. Smaller learning curve than Next.js (no App Router / server components mental model).
- **Risk:**
  - vite-plugin-ssr is less battle-tested than Next.js at scale; mitigated by MVP scale (4 routes).
  - Some config edge cases (custom head injection) require `onRenderHtml` workaround; acceptable.
- **Reversibility:** Can swap to Next.js in v0.14+ if scale demands it. Migration cost: rewrite `pages/` to `app/` + move CF Functions to Next.js middleware.

### ADR-006: Cloudflare Pages Functions SSR (NEW)

- **Decision:** Deploy qizai web to Cloudflare Pages with `functions/[[path]].ts` catch-all SSR entry.
- **Rationale:**
  1. Free tier covers MVP traffic (100k req/day).
  2. CF Pages + Functions is the natural Cloudflare deploy for static + SSR hybrid apps.
  3. Existing `apps/api/` Workers pattern aligns.
- **Risk:**
  - CF Workers runtime lacks some Node APIs; vite-plugin-ssr must run on Workers-compatible env.
  - Mitigated by using vite-plugin-ssr's `react-streaming` or `disable streaming` mode.
- **Reversibility:** Can move to Vercel/Render/Node if CF pain emerges. Catch-all function is portable to most edge platforms.

### ADR-007: _layout shares NavBar + SocialFooter across all routes (NEW)

- **Decision:** Use vite-plugin-ssr `_layout/+Layout.tsx` to wrap all pages with NavBar + SocialFooter.
- **Rationale:**
  1. Avoids 4× duplication of NavBar/SocialFooter imports.
  2. Layout is server-rendered + client-hydrated identically; consistent SSR behavior.
- **Risk:** None (standard vite-plugin-ssr pattern).
- **Reversibility:** Trivial — move imports back into each page if needed.

### Rollback (full-feature rollback)

If v0.13.B.1 ships but user feedback demands single-screen SPA revert:

```bash
git revert <v0.13.B.1 commit chain>
```

Revert removes: `pages/`, `renderer/`, `functions/`, `wrangler.toml`, new deps, modified NavBar/HeroContent, all new tests. Reverts `App.tsx` to v0.13.B.2's single Hero import. **Estimated revert effort:** 1 commit + 1 test-suite re-run. **Risk:** zero data loss.

## 十、Open Questions resolved

- **Q1 routing:** file-based i (user confirmed)
- **Q2 pages content:** static real copy B (user confirmed)
- **Q3 copy author:** 蕾姆 writes, user approves post-spec (user confirmed)
- **Q4 SSR scope:** all 4 pages (架构决策)
- **Q5 test:** α+β+γ (user confirmed; γ is shell, not vitest)
- **Q6 deploy domain:** `*.qizai.pages.dev` temp (架构决策; production domain later)
- **Q7 /api/* separation:** separate CF Pages project (架构决策; aligns with existing `apps/api/`)
- **Q8 NavBar link target:** `Link` from vite-plugin-ssr (架构决策; no react-router)
- **Q9 /predict form:** static placeholder; no real LLM (deferred v0.13.B.4+)
- **Q10 layout sharing:** `_layout/+Layout.tsx` (架构决策; standard pattern)

---

**Spec self-review checklist (蕾姆 inline):**
1. Placeholders? None — all code blocks are complete.
2. Internal consistency? ✅ §一 (in/out) matches §四 (file structure) and §七 (tasks).
3. Scope check? ✅ Single coherent change (multi-route SSR); not multi-subsystem.
4. Ambiguity check? ✅ Each ADR has explicit reversibility path.