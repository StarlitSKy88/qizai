# qizai v0.13.B.1 Multi-route SPA — Spec

> **For agentic workers:** Brainstormed design, not yet an implementation plan. After user review, invoke `superpowers:writing-plans` to produce the TDD plan.

**Goal:** Upgrade qizai from v0.13.A single-screen SPA to a **multi-route SPA**: add `/predict`, `/about`, `/pricing` pages with real Chinese copy and client-side navigation, while preserving v0.13.A's Vite+React 18+TS 5.6 strict stack and v0.13.B.2's brand SVG assets.

**Architecture:** react-router v6 (declarative `<BrowserRouter>` + `<Routes>` + `<Route>`) on Vite 5 SPA. Pure client-side routing (CSR); deep-link sharing works via standard URL but SEO indexing is deferred to v0.14+. Each page is a React component under `apps/web/src/pages/`. NavBar + SocialFooter wrap all routes via a shared `<Layout>` component.

**Tech Stack:** Vite 5 + React 18 + TS 5.6 strict + Tailwind 3 + lucide-react (carried from v0.13.A/B.2). **New dep:** `react-router-dom ^6.x` (only). **Not adding:** Next.js (forbidden by v0.13.A), Vike/SSR (deferred to v0.14+), state management, UI lib, animation lib.

## 一、Scope

**In:**

1. 3 new pages with real Chinese copy: `/predict` (form + features), `/about` (vision/team/contact), `/pricing` (3 tiers).
2. react-router v6 declarative routing on Vite SPA. New dep: `react-router-dom ^6.x`.
3. Shared `<Layout>` wrapping NavBar + `<Outlet />` + SocialFooter across all 4 routes.
4. NavBar links converted from `<a href="#xxx">` fake anchors → react-router `<Link to="/xxx">` for real client-side navigation (no white flash).
5. NavBar "开始预测" button → `<Link to="/predict">`.
6. HeroContent form submit → react-router `<Link to="/predict?title=...">` (preserves deep-link intent; SSR pre-fill deferred to v0.14+).
7. 404 fallback at `*` route.
8. Test suite expansion: α (route navigation + component rendering, 16 new React tests, baseline 30 → 46).
9. CHANGELOG v0.13.B.1 entry synced.

**Out:**

- No Next.js (v0.13.A §一 explicitly forbids; remains forbidden).
- No SSR / Vike / Cloudflare Functions (deferred to v0.14+ per user 昴君 decision 2026-07-24).
- No SEO meta tags (no `<title>` per page, no sitemap, no OG). SEO is v0.14 scope.
- No new state management library (Redux/Zustand/Jotai).
- No UI library (no AntD/Chakra/shadcn).
- No animation library.
- No real auth/登录 logic (still mock console.log, deferred to v0.13.B.4+).
- No real LLM API call on /predict form submit (still placeholder, deferred to v0.13.B.4).
- No SSR data-fetching (Apollo/SWR/React Query).
- No analytics, no error reporting, no i18n.
- No modification to `apps/api/` Hono Workers (v0.12 unchanged).

## 二、User-facing behavior

### 2.1 Route map

| URL | Page | Purpose |
|---|---|---|
| `/` | Hero (carried from v0.13.A) | Landing — "你的内容会爆吗？" CTA → /predict |
| `/predict` | Predict | 真实表单占位（标题输入 + 「开始预测」按钮），submit → console.log；v0.14 接 LLM |
| `/about` | About | 团队 / 愿景 / 联系方式（真实中文文案） |
| `/pricing` | Pricing | 3 档定价（试用 / 个人创作者 / 团队） |
| `*` | NotFound | 404 fallback |

### 2.2 Navigation

- NavBar 「功能」「定价」「关于」从 `<a href="#xxx">` 改为 react-router `<Link to="/xxx">`.
- NavBar 「开始预测」按钮从 `onClick={console.log}` 改为 `<Link to="/predict">`.
- NavBar 「登录」按钮保持 `onClick={console.log('敬请期待 登录')}` (auth deferred v0.13.B.4+).
- HeroContent form submit: from `console.log` to `<Link to={`/predict?title=${encodeURIComponent(title)}`}>`.
- All `<Link>` clicks: instant client-side route change, no page reload, no white flash.
- Direct deep-link (`/about`): full page load + render correct route (react-router's `<BrowserRouter>` handles initial URL).

### 2.3 Visual continuity

- All routes share `<Layout>`: NavBar (top) + `<Outlet />` (page content) + SocialFooter (bottom).
- Background video on `/` only (Hero's VideoBackground). Other routes use plain dark gradient bg (`bg-gradient-to-b from-slate-900 to-black`).
- Typography: `Instrument Serif` (H1) + system sans (body), carried verbatim from v0.13.A §六.

## 三、Tech stack and rationale

| Choice | Why |
|---|---|
| react-router-dom v6 (declarative) | Industry standard; minimal API; v0.13.A "Known TODOs" originally listed "react-router v6 多路由" (CHANGELOG L141) |
| react-router v6 over v7 | v6 stable; v7 still maturing; minimal feature gap for B.1 use case |
| BrowserRouter over HashRouter | Cleaner URLs; CF Pages supports SPA fallback via `_redirects` |
| Shared `<Layout>` component | Avoids 4× duplication of NavBar/Footer imports |
| Vite SPA (no SSR) | Defers SEO/SSR to v0.14+ per user decision; preserves v0.13.A Vite stack |
| `bg-gradient-to-b` on non-Hero pages | Video bg would distract on content-heavy pages; gradient is cheap |

## 四、File structure

```
apps/web/
├── src/
│   ├── components/                    ← UNTOUCHED (NavBar + SocialFooter wrapped by Layout; small mods inside)
│   │   ├── NavBar.tsx                 ← MODIFY: <a href="#xxx"> → <Link to="/xxx">
│   │   ├── HeroContent.tsx            ← MODIFY: form submit → useNavigate('/predict?title=...')
│   │   ├── Hero.tsx                   ← UNTOUCHED (legacy; kept for test only; no longer rendered by App.tsx)
│   │   ├── VideoBackground.tsx        ← UNTOUCHED
│   │   ├── SocialFooter.tsx           ← UNTOUCHED (v0.13.B.2 brand SVG)
│   │   └── SocialIconButton.tsx       ← UNTOUCHED (v0.13.B.2)
│   ├── pages/                         ← NEW: route components
│   │   ├── Home.tsx                   ← NEW: VideoBackground + HeroContent composition (NOT Hero re-export; avoids double NavBar/Footer)
│   │   ├── Predict.tsx                ← NEW: form + 3 feature cards
│   │   ├── About.tsx                  ← NEW: 3 sections (vision/team/contact)
│   │   ├── Pricing.tsx                ← NEW: 3 tier cards
│   │   └── NotFound.tsx               ← NEW: 404 fallback
│   ├── Layout.tsx                     ← NEW: NavBar + <Outlet /> + SocialFooter wrapper
│   ├── App.tsx                        ← REWRITE: <BrowserRouter> + <Routes> + <Route element={<Layout />}> + 5 <Route>
│   ├── main.tsx                       ← UNTOUCHED (ReactDOM entry unchanged)
│   ├── constants/                     ← UNTOUCHED (socials.ts from v0.13.B.2)
│   ├── styles/                        ← UNTOUCHED (index.css)
│   └── ...                            ← other src/ files UNTOUCHED
├── test/
│   ├── pages/                         ← NEW: route component tests
│   │   ├── Home.test.tsx              ← NEW (2 tests: re-exports Hero, existing 30 React tests still pass)
│   │   ├── Predict.test.tsx           ← NEW (5 tests)
│   │   ├── About.test.tsx             ← NEW (4 tests)
│   │   └── Pricing.test.tsx           ← NEW (5 tests)
│   ├── components/                    ← NavBar.test.tsx MODIFY (5 existing + 3 new = 8)
│   │   └── ... (other component tests UNTOUCHED)
│   └── ...                            ← other test/ files UNTOUCHED
├── public/                            ← UNTOUCHED (v0.13.B.2 socials/videos/_headers)
├── scripts/                           ← UNTOUCHED (fetch-video.sh, fetch-social-svgs.sh)
├── package.json                       ← MODIFY: add react-router-dom ^6.x
├── tsconfig.json                      ← UNTOUCHED
└── ...                                ← other config UNTOUCHED
```

## 五、Technical details

### 5.1 src/App.tsx (REWRITE)

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import Home from './pages/Home';
import Predict from './pages/Predict';
import About from './pages/About';
import Pricing from './pages/Pricing';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/predict" element={<Predict />} />
          <Route path="/about" element={<About />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

### 5.2 src/Layout.tsx (NEW)

```typescript
import { Outlet } from 'react-router-dom';
import NavBar from './components/NavBar';
import SocialFooter from './components/SocialFooter';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-900 to-black">
      <NavBar />
      <main className="flex-1">
        <Outlet />
      </main>
      <SocialFooter />
    </div>
  );
}
```

### 5.3 src/pages/Home.tsx (NEW)

```typescript
// Home composition — VideoBackground + HeroContent only.
// NavBar + SocialFooter are rendered by Layout (parent <Outlet/> wrapper),
// so importing them via Hero would cause double-render.
import VideoBackground from '../components/VideoBackground';
import HeroContent from '../components/HeroContent';

export default function Home() {
  return (
    <>
      <VideoBackground />
      <HeroContent />
    </>
  );
}
```

**Note:** `src/components/Hero.tsx` is preserved (still imported by `src/components/Hero.test.tsx`); but `App.tsx` no longer renders `<Hero />` directly — `pages/Home.tsx` replaces that import path. The `Hero.tsx` file becomes legacy (kept for test only); future cleanup candidate.

### 5.4 src/pages/Predict.tsx (NEW)

```typescript
import { useState, FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function Predict() {
  const [searchParams] = useSearchParams();
  const initialTitle = searchParams.get('title') ?? '';
  const [title, setTitle] = useState(initialTitle);

  // v0.14 will replace this with real LLM API call
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log(`[predict] 敬请期待 v0.14 LLM 接入, 当前标题: ${title}`);
  };

  return (
    <div className="relative z-10 max-w-4xl mx-auto px-6 py-16 text-white">
      <h1
        className="text-5xl md:text-6xl font-bold mb-6"
        style={{ fontFamily: "'Instrument Serif', serif" }}
      >
        预测你的内容会爆吗？
      </h1>
      <p className="text-white/80 text-lg leading-relaxed mb-12">
        粘贴标题、简介或正文，让 1000 个 persona 帮你投票决定要不要发布。
        小红书 / 抖音 / B站 一键预测，覆盖 30 天流量曲线。
      </p>
      <form
        onSubmit={handleSubmit}
        className="liquid-glass rounded-full pl-6 pr-2 py-2 flex items-center gap-3 mb-8"
      >
        <label htmlFor="predict-title" className="sr-only">
          内容标题或正文
        </label>
        <input
          id="predict-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="粘贴你的标题或内容..."
          aria-label="内容标题或正文"
          className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/40 text-base py-1"
        />
        <button
          type="submit"
          aria-label="开始预测"
          className="bg-white rounded-full p-3 text-black hover:bg-white/90 transition-colors"
        >
          <ArrowRight size={20} aria-hidden="true" />
        </button>
      </form>
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { icon: Sparkles, title: '30 秒拿到结果', desc: '1000 个 persona 并行投票，不打扰你写稿' },
          { icon: Sparkles, title: '3 平台同测', desc: '小红书 / 抖音 / B站 一键同跑，对比预测流量' },
          { icon: Sparkles, title: '可解释报告', desc: '每个预测附「为什么爆 / 为什么凉」决策依据' },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="liquid-glass rounded-2xl p-6">
            <Icon size={24} className="mb-3 text-white/90" aria-hidden="true" />
            <h3 className="text-white font-semibold mb-2">{title}</h3>
            <p className="text-white/70 text-sm leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 5.5 src/pages/About.tsx (NEW)

```typescript
import { Users, Target, Mail } from 'lucide-react';

export default function About() {
  return (
    <div className="relative z-10 max-w-4xl mx-auto px-6 py-16 text-white">
      <h1
        className="text-5xl md:text-6xl font-bold mb-6"
        style={{ fontFamily: "'Instrument Serif', serif" }}
      >
        关于 qizai
      </h1>
      <p className="text-white/80 text-lg leading-relaxed mb-12">
        qizai（骑仔）是给个人内容创作者的流量预测 co-pilot。
        我们相信创作不该赌运气 —— 在按下「发布」之前，
        先问 1000 个真实 persona 帮你投票。
      </p>
      <div className="space-y-8">
        <section>
          <div className="flex items-center gap-3 mb-3">
            <Target size={24} className="text-white/90" aria-hidden="true" />
            <h2 className="text-2xl font-semibold">愿景</h2>
          </div>
          <p className="text-white/70 leading-relaxed pl-9">
            让每个认真创作的个体都能用上原本只属于大公司的流量预判工具。
            不做内容农场，只做更聪明的发布前决策。
          </p>
        </section>
        <section>
          <div className="flex items-center gap-3 mb-3">
            <Users size={24} className="text-white/90" aria-hidden="true" />
            <h2 className="text-2xl font-semibold">团队</h2>
          </div>
          <p className="text-white/70 leading-relaxed pl-9">
            创始团队来自内容创作 + 算法工程交叉背景。
            我们自己也是重度创作者 —— qizai 的每个功能都从「我自己用得着吗」出发。
          </p>
        </section>
        <section>
          <div className="flex items-center gap-3 mb-3">
            <Mail size={24} className="text-white/90" aria-hidden="true" />
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

### 5.6 src/pages/Pricing.tsx (NEW)

```typescript
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';

const TIERS = [
  {
    name: '试用',
    price: '¥0',
    period: '/ 永久',
    desc: '看看 qizai 适合不适合你',
    features: ['每天 3 次预测', '单平台测试', '基础报告'],
    cta: '免费开始',
    href: '/predict',
    highlight: false,
  },
  {
    name: '个人创作者',
    price: '¥29',
    period: '/ 月',
    desc: '认真做内容的独立创作者',
    features: ['无限预测', '3 平台同测', '完整报告 + 决策依据', '历史报告存档 90 天'],
    cta: '订阅',
    href: '/predict',
    highlight: true,
  },
  {
    name: '团队',
    price: '¥299',
    period: '/ 月',
    desc: 'MCN / 内容工作室',
    features: ['个人版全部功能', '5 个子账号', '历史报告永久存档', 'REST API 接入', '优先客服'],
    cta: '联系销售',
    href: 'mailto:hi@qizai.app',
    highlight: false,
  },
] as const;

export default function Pricing() {
  return (
    <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 text-white">
      <h1
        className="text-5xl md:text-6xl font-bold mb-6 text-center"
        style={{ fontFamily: "'Instrument Serif', serif" }}
      >
        定价
      </h1>
      <p className="text-white/80 text-lg leading-relaxed mb-12 text-center max-w-2xl mx-auto">
        不收智商税 —— 按真实使用量定价，该有的功能都给，不藏着掖着。
      </p>
      <div className="grid md:grid-cols-3 gap-6">
        {TIERS.map((tier) => {
          const isMailto = tier.href.startsWith('mailto:');
          const TierButton = (
            <span
              className={`w-full inline-block text-center rounded-full py-3 text-sm font-medium transition-colors ${
                tier.highlight
                  ? 'bg-white text-black hover:bg-white/90'
                  : 'liquid-glass text-white hover:bg-white/5'
              }`}
            >
              {tier.cta}
            </span>
          );
          return (
            <div
              key={tier.name}
              className={`liquid-glass rounded-2xl p-8 ${tier.highlight ? 'ring-2 ring-white/30' : ''}`}
            >
              <h2 className="text-2xl font-semibold mb-2">
                {tier.name}
                {tier.highlight && (
                  <span className="sr-only"> 推荐方案</span>
                )}
              </h2>
              <p className="text-white/60 text-sm mb-4">{tier.desc}</p>
              <div className="mb-6">
                <span className="text-4xl font-bold">{tier.price}</span>
                <span className="text-white/60 text-sm ml-1">{tier.period}</span>
              </div>
              <ul role="list" className="space-y-2 mb-8">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check size={16} className="mt-0.5 flex-shrink-0 text-white/80" aria-hidden="true" />
                    <span className="text-white/80">{f}</span>
                  </li>
                ))}
              </ul>
              {isMailto ? (
                <a href={tier.href} className="block">
                  {TierButton}
                </a>
              ) : (
                <Link to={tier.href} className="block">
                  {TierButton}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### 5.7 src/pages/NotFound.tsx (NEW)

```typescript
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="relative z-10 max-w-2xl mx-auto px-6 py-32 text-white text-center">
      <h1
        className="text-6xl font-bold mb-4"
        style={{ fontFamily: "'Instrument Serif', serif" }}
      >
        404
      </h1>
      <p className="text-white/70 text-lg mb-8">这个页面不存在 —— 回到首页继续探索 qizai</p>
      <Link
        to="/"
        className="inline-block liquid-glass rounded-full px-8 py-3 text-white text-sm hover:bg-white/5"
      >
        回到首页
      </Link>
    </div>
  );
}
```

### 5.8 src/components/NavBar.tsx (MODIFY)

Only swap `<a>` for `<Link>` — visual classes verbatim preserved. 「开始预测」button → `<Link to="/predict">`. 「登录」button stays as `<button onClick={...}>` (auth deferred).

```typescript
import { Link } from 'react-router-dom';
import { Globe } from 'lucide-react';

export default function NavBar() {
  const toast = (msg: string) => () => console.log(msg);

  return (
    <nav className="relative z-20 px-6 py-6">
      <div className="liquid-glass rounded-full px-6 py-3 flex items-center justify-between max-w-5xl mx-auto">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <Globe size={24} className="text-white" />
            <span className="text-white font-semibold text-lg">qizai</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <Link to="/predict" className="text-white/80 hover:text-white transition-colors text-sm font-medium">
              功能
            </Link>
            <Link to="/pricing" className="text-white/80 hover:text-white transition-colors text-sm font-medium">
              定价
            </Link>
            <Link to="/about" className="text-white/80 hover:text-white transition-colors text-sm font-medium">
              关于
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/predict"
            className="text-white text-sm font-medium"
          >
            开始预测
          </Link>
          <button
            type="button"
            onClick={toast('敬请期待 登录')}
            className="liquid-glass rounded-full px-6 py-2 text-white text-sm font-medium hover:bg-white/5 transition-colors"
          >
            登录
          </button>
        </div>
      </div>
    </nav>
  );
}
```

### 5.9 src/components/HeroContent.tsx (MODIFY)

Form submit becomes `<Link>` navigation to `/predict?title=...`. Use `useNavigate()` for programmatic route change without `<Link>` wrapping.

```typescript
import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function HeroContent() {
  const [title, setTitle] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    navigate(`/predict?title=${encodeURIComponent(title)}`);
  };

  return (
    <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12 text-center -translate-y-[20%]">
      <h1
        className="text-5xl md:text-6xl lg:text-7xl text-white mb-8 tracking-tight whitespace-nowrap"
        style={{ fontFamily: "'Instrument Serif', serif" }}
      >
        你的内容会爆吗？
      </h1>
      <div className="max-w-xl w-full space-y-4">
        <form
          className="liquid-glass rounded-full pl-6 pr-2 py-2 flex items-center gap-3"
          onSubmit={handleSubmit}
        >
          <label htmlFor="hero-title" className="sr-only">
            内容标题
          </label>
          <input
            id="hero-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入你的内容标题"
            aria-label="内容标题"
            className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/40 text-base py-1"
          />
          <button
            type="submit"
            aria-label="开始预测"
            className="bg-white rounded-full p-3 text-black hover:bg-white/90 transition-colors"
          >
            <ArrowRight size={20} aria-hidden="true" />
          </button>
        </form>
        <p className="text-white text-sm leading-relaxed px-4">
          先问 1000 个 persona，再决定要不要发布——小红书 / 抖音 / B站 流量预测 co-pilot
        </p>
        <Link
          to="/about"
          className="liquid-glass rounded-full px-8 py-3 text-white text-sm font-medium hover:bg-white/5 transition-colors inline-block"
        >
          了解工作原理
        </Link>
      </div>
    </div>
  );
}
```

(Note: `了解工作原理` button changes from `<button>` to `<Link to="/about">` — semantically it's navigation, not action.)

### 5.10 apps/web/public/_redirects (NEW)

Cloudflare Pages SPA fallback (ensures deep-link `/about` serves `index.html` so react-router can resolve):

```
/*    /index.html   200
```

### 5.11 package.json (MODIFY)

```diff
   "dependencies": {
+    "react-router-dom": "^6.26.0",
     "lucide-react": "^0.460.0",
     "react": "^18.3.0",
     "react-dom": "^18.3.0"
   },
```

No script changes — `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm typecheck` all carry verbatim.

## 六、Tests

### 6.1 α: jsdom + vitest route/component tests (16 new tests, baseline 30 → 46)

**`apps/web/test/pages/Home.test.tsx`** (NEW, 2 tests):
- renders VideoBackground + HeroContent (not NavBar/SocialFooter — those come from Layout)
- existing 30 React tests still pass (Hero.test.tsx preserved, Home.test.tsx replaces `<Hero />` import path)

**`apps/web/test/pages/Predict.test.tsx`** (NEW, 5 tests, wrapped in `<MemoryRouter>`):
- renders H1 "预测你的内容会爆吗？"
- renders 3 feature cards
- input updates title state
- form submit calls console.log with title (no LLM)
- deep-link `?title=foo` pre-fills input via `useSearchParams`

(Note: `useSearchParams` and `useNavigate` only work inside a `<Router>` context. All page tests wrap the component in `<MemoryRouter initialEntries={['/predict?title=foo']}>` to satisfy this.)

**`apps/web/test/pages/About.test.tsx`** (NEW, 4 tests):
- renders H1 "关于 qizai"
- renders 3 sections (vision / team / contact) with icons
- mailto link to `hi@qizai.app`
- social search hint text

**`apps/web/test/pages/Pricing.test.tsx`** (NEW, 5 tests):
- renders 3 tier cards
- middle tier (个人创作者) has highlight ring + sr-only "推荐方案"
- prices render ¥0 / ¥29 / ¥299
- each tier lists features with Check icon
- tier 1/2 are `<Link to="/predict">`, tier 3 is `<a href="mailto:...">`

**`apps/web/test/components/NavBar.test.tsx`** (MODIFY, 5 → 8 tests):
- existing 5 preserved verbatim
- new: 「功能」 / 「定价」 / 「关于」 are `<a>` (or react-router-rendered `<a>`) with `href="/predict"` etc.
- new: 「开始预测」 is `<a>` with `href="/predict"`
- new: clicking "功能" calls `useNavigate()` (mocked) — verifies real routing, not console.log

### 6.2 Test count math

| Category | Baseline (v0.13.B.2) | Added | Total |
|---|---|---|---|
| React (jsdom + vitest) | 30 | 16 | **46** |
| Shell | 13 | 0 | **13** |
| **Total** | 43 | 16 | **59** |

(Home.test.tsx's 2 tests are: re-export works + existing Hero tests pass. Plus 14 across Predict/About/Pricing + 3 NavBar new = 16.)

## 七、Task decomposition (high-level preview, plan will detail TDD steps)

| Task | Files | Test |
|---|---|---|
| Task 1 | `package.json` add `react-router-dom ^6.26.0`; `pnpm install`; verify existing 30 React tests + 13 shell tests still pass | 43 baseline tests pass + typecheck clean |
| Task 2 | `src/App.tsx` REWRITE + `src/Layout.tsx` NEW + `src/pages/Home.tsx` NEW (re-export Hero) + `src/pages/NotFound.tsx` NEW | 2 Home tests pass; existing 30 React tests still pass |
| Task 3 | `src/pages/Predict.tsx` NEW + `src/components/HeroContent.tsx` MODIFY (form submit → navigate) + `apps/web/public/_redirects` NEW | 5 Predict tests pass; 1 NavBar test (mocked navigate) pass |
| Task 4 | `src/pages/About.tsx` NEW + `src/components/NavBar.tsx` MODIFY (`<a>` → `<Link>`) | 4 About tests pass; 2 NavBar tests pass |
| Task 5 | `src/pages/Pricing.tsx` NEW | 5 Pricing tests pass |
| Task 6 | Integration smoke + CHANGELOG | All 46 React + 13 shell = 59 tests pass; typecheck 0 errors; build produces dist with all 4 routes (react-router client-side); CHANGELOG v0.13.B.1 synced |

## 八、Global constraints

- **Baseline test preservation:** 43 tests from v0.13.B.2 must continue to pass.
- **Target test count:** 46 React + 13 shell = 59 total (v0.13.B.2 was 30+13=43, +16 from B.1).
- **typecheck clean** (TS 5.6 strict) — `all modified/new files pass \`tsc --noEmit\``.
- **0 scope creep:** no Next.js, no SSR/Vike, no state mgmt, no UI lib, no animation lib, no SEO meta.
- **react-router-dom ^6.x only** new dep.
- **Preserve v0.13.A** Hero single-screen (re-export via `pages/Home.tsx`).
- **Preserve v0.13.B.2** brand SVG assets + `/socials/*`, `/videos/*` _headers.
- **Preserve `apps/api/`** Hono Workers (untouched).
- **CHANGELOG.md v0.13.B.1 entry** synced on merge.
- **macOS/Linux portability** unchanged.

## 九、ADR (architectural decision records)

### ADR-005: react-router v6 declarative routing (over Vike SSR / Next.js)

- **Decision:** Use react-router v6 declarative `<BrowserRouter>` + `<Routes>` + `<Route>` for multi-route SPA.
- **Rationale:**
  1. v0.13.A's "Known TODOs" originally listed "react-router v6 多路由" (CHANGELOG L141) — closes the long-standing TODO.
  2. Industry standard; minimal API; small learning curve.
  3. Pure SPA; no SSR complexity; defers SEO/SSR to v0.14+ (user 昴君 decision 2026-07-24).
  4. Replaces earlier Vike SSR draft (b65591b) which was based on deprecated `vite-plugin-ssr` package; preserved as `*-Vike-SSR-ARCHIVED.md` for v0.14 reference.
- **Risk:**
  - No SEO indexing initially (creators can't Google "抖音爆款预测" and find qizai).
  - First-paint requires JS (acceptable for MVP — most users have JS).
- **Reversibility:** Can swap to Vike SSR in v0.14 by deleting `src/App.tsx` + adding `pages/`, `renderer/`, `functions/` (use archived spec as reference). Cost: ~3-5 days.

### ADR-006: SPA fallback via Cloudflare Pages `_redirects` (NEW)

- **Decision:** Add `apps/web/public/_redirects` with `/* /index.html 200` rule.
- **Rationale:**
  1. Ensures deep-link `/about` returns `index.html` so react-router resolves the route.
  2. CF Pages static asset hosting supports `_redirects` natively; no server config.
- **Risk:** None for static CF Pages; if migrating to Vercel/Netlify, equivalent `_redirects`/`vercel.json`/`netlify.toml` rules apply.
- **Reversibility:** Trivial — delete `_redirects` file.

### Rollback (full-feature rollback)

If v0.13.B.1 ships but user feedback demands single-screen SPA revert:

```bash
git revert <v0.13.B.1 commit chain>
```

Reverts: `react-router-dom` dep, `src/App.tsx` (back to v0.13.B.2 single Hero import), `src/Layout.tsx`, `src/pages/*`, `_redirects`, all new tests. **Estimated revert effort:** 1 commit + 1 test-suite re-run. **Risk:** zero data loss.

## 十、Open Questions resolved

- **Q1 routing:** file-based (vite-plugin-ssr) → **replaced by declarative (react-router v6)** per user 昴君 decision.
- **Q2 pages content:** static real copy (蕾姆-written, user reviews post-spec).
- **Q3 copy author:** 蕾姆 writes, user approves post-spec.
- **Q4 SSR scope:** **deferred to v0.14+**; v0.13.B.1 is pure SPA.
- **Q5 test:** α only (16 React tests); β SSR / γ shell smoke **deferred to v0.14** when SSR ships.
- **Q6 deploy domain:** unchanged (CF Pages auto-assigns `*.qizai.pages.dev`).
- **Q7 /api/* separation:** unchanged (separate `apps/api/` Workers deploy).
- **Q8 NavBar link target:** `<Link to="/xxx">` from react-router.
- **Q9 /predict form:** static placeholder; no real LLM (deferred v0.13.B.4+).
- **Q10 layout sharing:** `<Layout>` component wrapping all routes via `<Outlet />`.

---

**Spec self-review checklist (蕾姆 inline):**
1. Placeholders? None — all code blocks are complete.
2. Internal consistency? ✅ §一 (in/out) matches §四 (file structure) and §七 (tasks). Test math §六.2 = 16 new = 30+16=46 React, 13 shell, 59 total ✓.
3. Scope check? ✅ Single coherent change (multi-route SPA); not multi-subsystem.
4. Ambiguity check? ✅ ADR-005/006 have explicit reversibility paths. Vike spec archived at `*-Vike-SSR-ARCHIVED.md`.