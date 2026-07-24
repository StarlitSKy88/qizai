# qizai v0.13.B.1 Multi-route SPA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade qizai from v0.13.A single-screen SPA to a 4-route SPA (`/` `/predict` `/about` `/pricing` + 404 fallback) using react-router v6 declarative routing on the existing Vite 5 + React 18 stack.

**Architecture:** react-router-dom v6 declarative `<BrowserRouter>` + `<Routes>` + nested `<Route element={<Layout />}>` on the existing Vite 5 SPA. Each page is a React component under `apps/web/src/pages/`. NavBar + SocialFooter wrap all routes via a shared `<Layout>` component using `<Outlet />`. Pure client-side routing (CSR); Cloudflare Pages SPA fallback via `_redirects` ensures deep-link `/about` returns `index.html`.

**Tech Stack:** Vite 5 + React 18 + TS 5.6 strict + Tailwind 3 + lucide-react (carried verbatim from v0.13.A/B.2). **New dep:** `react-router-dom ^6.26.0`. **Not adding:** Next.js, Vike/SSR, state management, UI lib, animation lib, SEO meta (all out of scope per spec §一).

## Global Constraints

These constraints apply to EVERY task. Copy values verbatim:

- **TypeScript:** 5.6 strict mode. All modified/new files MUST pass `pnpm typecheck` (`tsc --noEmit`) with zero errors.
- **Test framework:** vitest 2.x + @testing-library/react + jest-dom + @testing-library/user-event ^14.5. jsdom environment. Config in `apps/web/vitest.config.ts` with `setupFiles: ['./test/setup.ts']`.
- **Run command from monorepo root:** `cd /Users/opc-1/Downloads/O/qizai && pnpm -F web <cmd>` (or `cd apps/web && pnpm <cmd>`). Working directory matters for `pnpm test` (run from `apps/web/`).
- **Lint:** `pnpm -F web lint` must pass (PreCommit hook will block merges otherwise). v0.13.B.2 did not enforce lint; B.1 adds it as a verification step at every task.
- **New dep ceiling:** `react-router-dom ^6.26.0` ONLY. No other npm dep additions.
- **No scope creep:** No Next.js, no Vike/SSR, no state mgmt, no UI lib, no animation lib, no SEO `<title>`/meta/OG/sitemap, no real auth, no real LLM API call.
- **Typography:** `Instrument Serif` for H1 headings (inline `style={{ fontFamily: "'Instrument Serif', serif" }}`); system sans for body. Verbatim from v0.13.A §六.
- **Punctuation style:** 全站破折号统一 `——` 紧排（无空格，v0.13.A 风格）。例：`创作不该赌运气——在按下「发布」之前`。
- **Marketing copy bans:** NEVER write quantitative claims that v0.14 LLM cannot back. Specifically banned: 「30 天流量曲线」「30 秒拿到结果」.
- **CTA 文案:** 「了解工作原理」is BANNED (no `/how-it-works` route exists). Use 「关于我们」→ `<Link to="/about">`.
- **MemoryRouter wrap rule (B.1 new):** Tests rendering components that use `useSearchParams`, `useNavigate`, or `<Link>` MUST wrap in `<MemoryRouter initialEntries={['/route?qs=...']}>` (imported from `react-router-dom`). Tests for VideoBackground / SocialFooter / LiquidGlass do NOT need wrapping.
- **Stub-then-real pattern:** When registering a new route in `App.tsx`, the page component MUST exist as a stub BEFORE `App.tsx` references it (otherwise typecheck fails). Real implementation replaces stub in a later task.
- **Test MODIFY rule:** When §五.8 NavBar / §五.9 HeroContent tests are MODIFIED, keep the same `it()` slots (don't add/remove `it()` count). Rewrite assertion values only (e.g., `getByRole('button', ...)` → `getByRole('link', ...)`). Wrap test file in `<MemoryRouter>` or `vi.mock('react-router-dom', ...)` to satisfy router hooks.
- **Git commits:** Conventional Commits format. Each task ends with one commit. Atomic commits (one task = one commit boundary).
- **CHANGELOG:** v0.13.B.1 entry inserted between v0.13.A and v0.13.B.2 (alphabetical order). Done in T31.
- **macOS/Linux portability:** Use `stat -f%m ... || stat -c%m ...` pattern when needed. Reuse v0.13.B.2 scripts (do NOT modify `scripts/fetch-video.sh` or `scripts/fetch-social-svgs.sh`).
- **`apps/api/` UNTOUCHED:** Hono Workers in `apps/api/` are out of scope. Do not edit.
- **Visual continuity:** Background video on `/` only (Hero's VideoBackground). Other routes use `bg-gradient-to-b from-slate-900 to-black` (on Layout root).
- **Test count math:** Baseline 30 React + 13 shell = 43 (v0.13.B.2 verified at commit `5736b37`). Final target: 49 React + 13 shell = 62 (delta = +19 new `it()`; 4 existing `it()` slots MODIFIED with same count).

---

## File Structure (locked-in decomposition)

**Create:**
```
apps/web/public/_redirects                                  # CF Pages SPA fallback (T04)
apps/web/src/Layout.tsx                                     # NavBar + Outlet + SocialFooter wrapper (T05)
apps/web/src/pages/Home.tsx                                 # VideoBackground + HeroContent composition (T08a stub, T09 real)
apps/web/src/pages/NotFound.tsx                             # 404 fallback (T06)
apps/web/src/pages/About.tsx                                # 3 sections (vision/team/contact) (T21a)
apps/web/src/pages/Predict.tsx                              # form + 3 feature cards (T24)
apps/web/src/pages/Pricing.tsx                              # 3 tier cards (T28)
apps/web/test/pages/Home.test.tsx                           # 2 tests (T10)
apps/web/test/pages/NotFound.test.tsx                       # 1 test (T07)
apps/web/test/pages/About.test.tsx                          # 4 tests (T23)
apps/web/test/pages/Predict.test.tsx                        # 5 tests (T26)
apps/web/test/pages/Pricing.test.tsx                        # 5 tests (T30)
```

**Modify:**
```
apps/web/package.json                                       # +react-router-dom (T01)
apps/web/src/App.tsx                                        # REWRITE 4 times: T08b, T21b, T25, T29
apps/web/src/components/NavBar.tsx                          # 4 sub-changes: T12 (import), T13-T15 (3 Links), T16 (no source change)
apps/web/src/components/HeroContent.tsx                     # 3 sub-changes: T17 (import), T18 (navigate), T19 (CTA)
apps/web/test/components/NavBar.test.tsx                    # MODIFY in T16: 5→8 tests, wrap MemoryRouter
apps/web/test/components/HeroContent.test.tsx               # MODIFY in T20: 2 MODIFIED + 4 verbatim, wrap MemoryRouter
CHANGELOG.md                                                # INSERT v0.13.B.1 entry in T31
```

**Untouched (carry verbatim from v0.13.A/B.2):**
```
apps/web/src/components/Hero.tsx                            # legacy, kept for Hero.test.tsx only
apps/web/src/components/VideoBackground.tsx
apps/web/src/components/SocialFooter.tsx
apps/web/src/components/SocialIconButton.tsx
apps/web/src/components/LiquidGlass.tsx                     # if exists; component not used in pages
apps/web/src/main.tsx
apps/web/src/constants/socials.ts                           # v0.13.B.2
apps/web/src/constants/videos.ts                            # v0.13.B.3
apps/web/src/styles/index.css                               # Tailwind + LiquidGlass verbatim
apps/web/public/videos/hero.mp4                             # v0.13.B.3 fetch artifact
apps/web/public/socials/{xiaohongshu,tiktok,bilibili}.svg   # v0.13.B.2 fetch artifact
apps/web/public/_headers                                    # v0.13.B.2/B.3 CF Pages cache rules
apps/web/vitest.config.ts
apps/web/tsconfig.json
apps/web/vite.config.ts
scripts/fetch-video.sh                                      # v0.13.B.3
scripts/fetch-social-svgs.sh                                # v0.13.B.2
scripts/fetch-video.test.sh                                 # v0.13.B.3
scripts/fetch-social-svgs.test.sh                           # v0.13.B.2
apps/api/                                                   # Hono Workers — out of scope
```

## Interfaces (locked-in cross-task contracts)

- **`src/App.tsx`** exports `default function App(): JSX.Element`. Wraps `<BrowserRouter><Routes><Route element={<Layout />}><Route path="/" element={<Home />} /><Route path="/predict" element={<Predict />} /><Route path="/about" element={<About />} /><Route path="/pricing" element={<Pricing />} /><Route path="*" element={<NotFound />} /></Route></Routes></BrowserRouter>`.
- **`src/Layout.tsx`** exports `default function Layout(): JSX.Element`. Wraps `<div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-900 to-black"><NavBar /><main className="flex-1"><Outlet /></main><SocialFooter /></div>`.
- **`src/pages/Home.tsx`** exports `default function Home(): JSX.Element`. Returns `<><VideoBackground /><HeroContent /></>` (no NavBar/Footer; Layout owns those).
- **`src/pages/NotFound.tsx`** exports `default function NotFound(): JSX.Element`. H1 "404" + subtitle + `<Link to="/">回到首页</Link>`.
- **`src/pages/About.tsx`** exports `default function About(): JSX.Element`. H1 "关于 qizai" + 3 sections (愿景/团队/联系我们) + mailto `hi@qizai.app`.
- **`src/pages/Predict.tsx`** exports `default function Predict(): JSX.Element`. Uses `useSearchParams` to read `?title=foo`, `<form>` with `<label htmlFor="predict-title">`, submit calls `console.log('[predict] 敬请期待 v0.14 LLM 接入, 当前标题: ' + title)`. NO "30 天流量曲线" / NO "30 秒拿到结果" copy.
- **`src/pages/Pricing.tsx`** exports `default function Pricing(): JSX.Element`. Exports internal `const TIERS = [...] as const` with 3 tiers ¥0/¥29/¥299, tier 2 (个人创作者) `highlight: true`, tier 2 CTA = "开始体验", tier 3 CTA = "联系销售" → `mailto:hi@qizai.app`.
- **`src/components/NavBar.tsx`** MODIFY in place. 3 internal `<a>` → `<Link to="/predict|pricing|about">`. 「开始预测」 `<button onClick>` → `<Link to="/predict">`. 「登录」 stays as `<button onClick={toast('敬请期待 登录')}>`.
- **`src/components/HeroContent.tsx`** MODIFY in place. `handleSubmit` from `console.log` → `navigate(`/predict?title=${encodeURIComponent(title)}`)`. 「了解工作原理」 `<button>` → `<Link to="/about">关于我们</Link>`.
- **Test wrapper:** `<MemoryRouter initialEntries={['/predict?title=foo']}>` from `react-router-dom`.

---

## Task Index (34 atomic tasks)

| Layer | Tasks | Purpose |
|---|---|---|
| 0 | T01-T03 | Dependency + baseline smoke |
| 1 | T04-T08b | Routing skeleton + 404 (5.5 tasks with stubs) |
| 2 | T09-T11 | Home composition + smoke |
| 3 | T12-T16 | NavBar → Link migration (5 sub-tasks) |
| 4 | T17-T20 | HeroContent → useNavigate migration (4 sub-tasks) |
| 5 | T21a-T23 | About page (with route stub-then-real) |
| 6 | T24-T27 | Predict page (with deep-link curl smoke) |
| 7 | T28-T30 | Pricing page |
| 8 | T31-T33 | CHANGELOG + whole-branch verification + opus review |

---
## Layer 0: Dependency + Baseline Smoke (T01-T03)

### Task T01: Add react-router-dom dependency

**Files:**
- Modify: `apps/web/package.json` (add 1 line to `dependencies`)

**Interfaces:**
- Consumes: `react`, `react-dom`, `lucide-react` (existing deps)
- Produces: `react-router-dom ^6.26.0` available for `pnpm install` to resolve

- [ ] **Step 1: Add react-router-dom to package.json**

Open `apps/web/package.json`. Locate the `dependencies` block (around line 50-60, after `lucide-react`). Add one line:

```json
  "dependencies": {
    "react-router-dom": "^6.26.0",
    "lucide-react": "^0.460.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
```

(Alphabetical order: `react-router-dom` comes before `lucide-react` because `r` < `l`? No — `l` < `r`. So `lucide-react` stays first. Place `react-router-dom` between `react-dom` and end. Actually since order doesn't matter for npm, just add it on its own line right after `react-dom`.)

```json
  "dependencies": {
    "lucide-react": "^0.460.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.26.0"
  },
```

- [ ] **Step 2: Run pnpm install**

Run from monorepo root:
```bash
pnpm install
```

Expected: exit 0. Output mentions "Done in Xs" with `react-router-dom` resolved.

- [ ] **Step 3: Verify install via grep**

```bash
ls apps/web/node_modules/react-router-dom/package.json && grep '"version"' apps/web/node_modules/react-router-dom/package.json | head -1
```

Expected: first command exits 0 (file exists). Second prints version line, e.g. `"version": "6.26.x"`.

- [ ] **Step 4: Verify git diff scope**

```bash
cd /Users/opc-1/Downloads/O/qizai && git diff apps/web/package.json
```

Expected: diff shows ONLY one line added (the `"react-router-dom": "^6.26.0",` line). No other changes. `pnpm-lock.yaml` may have changes — that's expected (pnpm updates lockfile).

- [ ] **Step 5: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai && git add apps/web/package.json pnpm-lock.yaml && git commit -m "feat(web): add react-router-dom ^6.26.0 dependency

Closes v0.13.A Known TODO 'react-router v6 多路由' (CHANGELOG L141).
ADR-005: declarative routing over Vike SSR / Next.js.

Files: apps/web/package.json (+1 line)
Verification: pnpm install exit 0; pnpm-lock.yaml updated; no other source changes."
```

---

### Task T02: Verify baseline 43 tests pass + typecheck + build + lint

**Files:**
- Modify: (none — verification-only task)

**Interfaces:**
- Consumes: `react-router-dom` from T01; baseline tests from v0.13.B.2 (30 React + 13 shell = 43)
- Produces: confidence baseline is green before adding more code

- [ ] **Step 1: Run all tests**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run
```

Expected: all tests pass. Output ends with `Test Files  7 passed (7)` and `Tests  30 passed (30)` (jsdom + vitest).

- [ ] **Step 2: Run shell tests**

```bash
cd /Users/opc-1/Downloads/O/qizai && bash scripts/fetch-social-svgs.test.sh && bash scripts/fetch-video.test.sh
```

Expected: both scripts print "All tests passed" or equivalent. Total: 7 (socials) + 6 (video) = 13 shell tests.

- [ ] **Step 3: Run typecheck**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck
```

Expected: exit 0. Zero TypeScript errors.

- [ ] **Step 4: Run build**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm build
```

Expected: exit 0. `dist/` contains `index.html`, `assets/`, `socials/`, `videos/`, `_headers`.

- [ ] **Step 5: Run lint (PreCommit-equivalent gate)**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm lint
```

Expected: exit 0. Zero lint errors. (If `pnpm lint` script doesn't exist in `apps/web/package.json`, add it now: `"lint": "eslint . --ext ts,tsx --max-warnings 0"`. v0.13.B.2 added `lint-staged` config but no actual script — T02 may need to add the script. If adding, append to `scripts` in `apps/web/package.json`.)

- [ ] **Step 6: Record baseline numbers in commit body (no commit needed)**

This is a verification-only task. No code change. Confirm all 4 commands above printed green output. Proceed to T03.

---

### Task T03: Smoke test pnpm dev server (curl baseline)

**Files:**
- Modify: (none — verification-only task)

**Interfaces:**
- Consumes: dev server on `localhost:5173`
- Produces: confidence that current v0.13.A single-screen SPA serves over dev server before adding routing

- [ ] **Step 1: Start dev server in background**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm dev &
DEV_PID=$!
echo "DEV_PID=$DEV_PID"
sleep 8
```

Expected: process starts. "DEV_PID" is printed. Sleep 8s gives Vite time to bundle.

- [ ] **Step 2: Curl root URL**

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:5173/
```

Expected: `HTTP 200`.

- [ ] **Step 3: Verify H1 renders**

```bash
curl -s http://localhost:5173/ | grep -c "你的内容会爆吗"
```

Expected: `1` (or higher if substring appears multiple times).

- [ ] **Step 4: Kill dev server**

```bash
kill $DEV_PID 2>/dev/null
sleep 2
ps aux | grep -E "vite|node.*dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
```

Expected: no `vite` or `pnpm dev` processes remain.

- [ ] **Step 5: No commit needed**

This is verification only. The baseline dev server smoke confirms T01-T02 didn't break anything. Proceed to T04.

---

## Layer 1: Routing Skeleton + 404 (T04-T08b)

### Task T04: Add Cloudflare Pages _redirects for SPA fallback

**Files:**
- Create: `apps/web/public/_redirects`

**Interfaces:**
- Consumes: CF Pages static asset hosting (v0.13.B.2 _headers already in `apps/web/public/_headers`)
- Produces: CF Pages serves `index.html` for any deep-link (`/about`, `/predict`, `/pricing`)

- [ ] **Step 1: Create _redirects file**

```bash
cat > /Users/opc-1/Downloads/O/qizai/apps/web/public/_redirects << 'EOF'
/*    /index.html   200
EOF
```

(The format is: `<source pattern>  <target>  <status code>`. Status 200 means serve `index.html` directly without HTTP redirect. Cloudflare Pages convention. Tabs separate fields.)

- [ ] **Step 2: Verify file content**

```bash
cat /Users/opc-1/Downloads/O/qizai/apps/web/public/_redirects
```

Expected: prints `/*    /index.html   200` (exact string; spaces are literal, not tabs).

- [ ] **Step 3: Run pnpm build to verify dist/_redirects is produced**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm build
```

Expected: exit 0. Then:

```bash
ls /Users/opc-1/Downloads/O/qizai/apps/web/dist/_redirects && cat /Users/opc-1/Downloads/O/qizai/apps/web/dist/_redirects
```

Expected: file exists in `dist/` with same content as source. Vite copies `public/*` to `dist/*` verbatim.

- [ ] **Step 4: Verify baseline tests still green**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run
```

Expected: 30 React tests pass (no change). Baseline 43 tests total still green.

- [ ] **Step 5: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai && git add apps/web/public/_redirects && git commit -m "feat(web): add _redirects for CF Pages SPA fallback

ADR-006: ensures deep-link /about /predict /pricing serves index.html
so react-router can resolve the route. CF Pages _headers (v0.13.B.2)
coexists; _headers applies to /socials/* /videos/* cache, _redirects
applies to SPA fallback. Both are static asset rules.

Files: apps/web/public/_redirects (NEW, 1 line)
Verification: pnpm build produces dist/_redirects with same content; baseline 30 React tests still green."
```

---

### Task T05: Create Layout component (NavBar + Outlet + SocialFooter wrapper)

**Files:**
- Create: `apps/web/src/Layout.tsx`

**Interfaces:**
- Consumes: `NavBar` from `../components/NavBar`, `SocialFooter` from `../components/SocialFooter`, `Outlet` from `react-router-dom`
- Produces: `<Layout>` component that all routes render inside

- [ ] **Step 1: Create Layout.tsx**

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

- [ ] **Step 2: Verify typecheck**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Verify baseline tests still green**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run
```

Expected: 30 React tests pass. (Layout is not yet imported by App.tsx so no test sees it.)

- [ ] **Step 4: Verify content**

```bash
grep -c "Outlet" /Users/opc-1/Downloads/O/qizai/apps/web/src/Layout.tsx
grep -c "NavBar" /Users/opc-1/Downloads/O/qizai/apps/web/src/Layout.tsx
grep -c "SocialFooter" /Users/opc-1/Downloads/O/qizai/apps/web/src/Layout.tsx
```

Expected: each prints `1` (Outlet once, NavBar once, SocialFooter once).

- [ ] **Step 5: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai && git add apps/web/src/Layout.tsx && git commit -m "feat(web): add Layout component (NavBar + Outlet + SocialFooter)

Wraps all 4 routes via nested <Route element={<Layout />}> in App.tsx.
Outlet renders the matched child route's element.

Files: apps/web/src/Layout.tsx (NEW, 13 lines)
Verification: typecheck 0; baseline 30 React tests still green; Layout
not yet used by App.tsx (next task T08b wires it up)."
```

---

### Task T06: Create NotFound page (404 fallback)

**Files:**
- Create: `apps/web/src/pages/NotFound.tsx`

**Interfaces:**
- Consumes: `<Link>` from `react-router-dom`
- Produces: `<NotFound>` component rendered at `path="*"`

- [ ] **Step 1: Create NotFound.tsx**

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
      <p className="text-white/70 text-lg mb-8">这个页面不存在——回到首页继续探索 qizai</p>
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

(Em-dash is `——` NO space, v0.13.A style. Per Global Constraints.)

- [ ] **Step 2: Verify typecheck**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Verify content greps**

```bash
grep -c "^404$\|<h1[^>]*>404\|>404<" /Users/opc-1/Downloads/O/qizai/apps/web/src/pages/NotFound.tsx
grep -c "回到首页" /Users/opc-1/Downloads/O/qizai/apps/web/src/pages/NotFound.tsx
grep -c '<Link to="/"' /Users/opc-1/Downloads/O/qizai/apps/web/src/pages/NotFound.tsx
```

Expected: `1` `2` `1` (H1 "404" appears once, "回到首页" appears twice — once in subtitle, once in link text, `<Link to="/"` appears once).

- [ ] **Step 4: Verify baseline tests still green**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run
```

Expected: 30 React tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai && git add apps/web/src/pages/NotFound.tsx && git commit -m "feat(web): add NotFound page (404 fallback)

H1 '404' + subtitle '这个页面不存在——回到首页继续探索 qizai'
+ <Link to='/'>回到首页</Link>. Will be wired to <Route path='*'>
in App.tsx (T08b).

Files: apps/web/src/pages/NotFound.tsx (NEW, 18 lines)
Verification: typecheck 0; baseline 30 React tests still green; NotFound
not yet imported by App.tsx (T07 adds test, T08b wires to route)."
```

---

### Task T07: Write NotFound test (1 test)

**Files:**
- Create: `apps/web/test/pages/NotFound.test.tsx`

**Interfaces:**
- Consumes: `<NotFound>` from `apps/web/src/pages/NotFound` (T06)
- Produces: 1 test verifying H1 "404" renders

- [ ] **Step 1: Create NotFound.test.tsx**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFound from '../../src/pages/NotFound';

describe('NotFound', () => {
  it('renders H1 "404"', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: '404' })).toBeInTheDocument();
  });
});
```

(Use `MemoryRouter` because `<Link to="/">` inside NotFound needs Router context.)

- [ ] **Step 2: Run new test in isolation**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run test/pages/NotFound.test.tsx
```

Expected: 1/1 passed.

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run
```

Expected: 30 baseline + 1 new = 31 React tests pass.

- [ ] **Step 4: Run typecheck**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai && git add apps/web/test/pages/NotFound.test.tsx && git commit -m "test(web): add NotFound.test.tsx (1 test, H1 renders)

TDD RED→GREEN: H1 '404' renders. Uses MemoryRouter wrap (NotFound
contains <Link to='/'>).

Files: apps/web/test/pages/NotFound.test.tsx (NEW, 18 lines)
Verification: pnpm test --run test/pages/NotFound.test.tsx = 1/1;
baseline 30 + 1 new = 31 React tests pass; typecheck 0."
```

---

### Task T08a: Create Home.tsx stub (TODO placeholder)

**Files:**
- Create: `apps/web/src/pages/Home.tsx` (STUB only)

**Interfaces:**
- Consumes: (none — empty stub)
- Produces: minimal component so App.tsx (T08b) can import without typecheck error

- [ ] **Step 1: Create Home.tsx stub**

```typescript
// STUB: replaced by T09 with real composition (VideoBackground + HeroContent).
// This stub exists only to let App.tsx (T08b) compile while iterating on
// routing skeleton without yet touching pages.
export default function Home() {
  return <div>TODO: real Home</div>;
}
```

- [ ] **Step 2: Verify typecheck**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Verify baseline tests still green**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run
```

Expected: 31 React tests pass (30 baseline + 1 NotFound from T07). Home stub not yet used.

- [ ] **Step 4: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai && git add apps/web/src/pages/Home.tsx && git commit -m "feat(web): add Home page stub (placeholder for App.tsx wiring)

Stub returns <div>TODO: real Home</div>. T09 replaces with real
<VideoBackground /> + <HeroContent /> composition. Stub exists only
to keep App.tsx (T08b) typecheck-clean.

Files: apps/web/src/pages/Home.tsx (NEW, 6 lines)
Verification: typecheck 0; baseline 31 React tests still green."
```

---

### Task T08b: Rewrite App.tsx with BrowserRouter + Routes + Layout

**Files:**
- Modify: `apps/web/src/App.tsx` (REWRITE)

**Interfaces:**
- Consumes: `<BrowserRouter>`, `<Routes>`, `<Route>` from `react-router-dom`; `<Layout>` from `./Layout` (T05); `<Home>` from `./pages/Home` stub (T08a); `<NotFound>` from `./pages/NotFound` (T06)
- Produces: v0.13.A single-screen SPA replaced with `<BrowserRouter><Routes><Route element={<Layout />}><Route path='/' element={<Home stub>} /><Route path='*' element={<NotFound>} /></Route></Routes></BrowserRouter>`

- [ ] **Step 1: Rewrite App.tsx**

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import Home from './pages/Home';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

(NOTE: Predict / About / Pricing routes NOT yet registered — they will be added in T21b / T25 / T29 respectively when their stub→real flow completes. This task is the minimum to wire routing skeleton + 404.)

- [ ] **Step 2: Verify typecheck**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run
```

Expected: 31 React tests pass (baseline + NotFound). Hero.test.tsx still passes because Hero.tsx is preserved as a legacy file imported by Hero.test.tsx directly, NOT through App.tsx.

- [ ] **Step 4: Smoke test via dev server**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm dev &
DEV_PID=$!
sleep 8

# Root should serve Home stub
curl -s http://localhost:5173/ | grep -c "TODO: real Home"
# Expected: 1

# Non-existent path should serve NotFound (via _redirects → index.html → react-router)
curl -s http://localhost:5173/nonexistent | grep -c "404"
# Expected: 1

# Login link click target /predict should ALSO serve NotFound (route not registered yet)
curl -s http://localhost:5173/predict | grep -c "404"
# Expected: 1 (acceptable: predict route will be registered in T25)

kill $DEV_PID 2>/dev/null
sleep 2
ps aux | grep -E "vite|node.*dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
```

Expected: 3 greps each return ≥ 1. `/` shows stub, `/nonexistent` and `/predict` show 404.

- [ ] **Step 5: Verify build still works**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm build
```

Expected: exit 0. `dist/_redirects` exists (from T04). `dist/index.html` exists.

- [ ] **Step 6: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai && git add apps/web/src/App.tsx && git commit -m "feat(web): rewrite App.tsx with BrowserRouter + Routes + Layout

Replaces v0.13.A single <Hero /> direct import with declarative
react-router v6 routing. <Layout> wraps NavBar + Outlet + SocialFooter
around all routes. / and * registered; /predict /about /pricing added
in T21b/T25/T29 after their stub→real cycles.

Files: apps/web/src/App.tsx (REWRITE, 18 lines; was 1 line)
Verification: typecheck 0; baseline 31 React tests pass (Hero.test.tsx
preserved via direct import of legacy Hero.tsx); pnpm dev curl /
returns 'TODO: real Home'; curl /nonexistent returns '404' via _redirects
SPA fallback; pnpm build exit 0."
```

---

## Layer 2: Home Real Composition (T09-T11)

### Task T09: Replace Home.tsx stub with real composition

**Files:**
- Modify: `apps/web/src/pages/Home.tsx` (replace stub from T08a)

**Interfaces:**
- Consumes: `<VideoBackground>` and `<HeroContent>` from `../components/`
- Produces: `<Home>` renders VideoBackground + HeroContent directly (no NavBar/Footer; Layout owns those)

- [ ] **Step 1: Rewrite Home.tsx**

```typescript
// Home composition — VideoBackground + HeroContent only.
// NavBar + SocialFooter are rendered by Layout (parent <Outlet /> wrapper),
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

- [ ] **Step 2: Verify typecheck**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Verify content greps**

```bash
grep -c "VideoBackground" /Users/opc-1/Downloads/O/qizai/apps/web/src/pages/Home.tsx
grep -c "HeroContent" /Users/opc-1/Downloads/O/qizai/apps/web/src/pages/Home.tsx
grep "TODO: real Home" /Users/opc-1/Downloads/O/qizai/apps/web/src/pages/Home.tsx
```

Expected: 1, 1, and the third command should print nothing (stub removed).

- [ ] **Step 4: Run baseline tests**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run
```

Expected: 31 React tests pass. Hero.test.tsx still works (tests `<Hero />` directly, not via App.tsx).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/Home.tsx && git commit -m "feat(web): replace Home stub with VideoBackground + HeroContent composition

Replaces T08a placeholder with real layout. Critically does NOT
re-export Hero (which would double-render NavBar/Footer because
Layout already renders those via <Outlet />).

Files: apps/web/src/pages/Home.tsx (MODIFY, ~13 lines; was 6)
Verification: typecheck 0; baseline 31 React tests pass; Hero.test.tsx
preserved via direct Hero.tsx import."
```

---

### Task T10: Write Home test (2 tests: renders VideoBackground + HeroContent, no NavBar/Footer)

**Files:**
- Create: `apps/web/test/pages/Home.test.tsx`

**Interfaces:**
- Consumes: `<Home>` from `apps/web/src/pages/Home` (T09); `<MemoryRouter>` from `react-router-dom` (Home is rendered inside Layout which needs Router)
- Produces: 2 tests verifying (a) renders VideoBackground + HeroContent; (b) does NOT render NavBar/Footer

- [ ] **Step 1: Create Home.test.tsx**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from '../../src/pages/Home';

describe('Home', () => {
  it('renders VideoBackground (video element) and HeroContent (H1)', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: '你的内容会爆吗？' })).toBeInTheDocument();
    expect(document.querySelector('video')).toBeInTheDocument();
  });

  it('does NOT render NavBar (<nav>) or SocialFooter (<footer>) — those come from Layout', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(document.querySelector('nav')).not.toBeInTheDocument();
    expect(document.querySelector('footer')).not.toBeInTheDocument();
  });
});
```

(The second test is the **regression guard** for double-render: if someone later adds `import NavBar from '../components/NavBar'` to Home.tsx, this test fails. This is the whole point of T10.)

- [ ] **Step 2: Run new test in isolation**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run test/pages/Home.test.tsx
```

Expected: 2/2 passed.

- [ ] **Step 3: Run full suite**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run
```

Expected: 31 baseline + 2 new = 33 React tests pass.

- [ ] **Step 4: Run typecheck + lint**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck && pnpm lint
```

Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai && git add apps/web/test/pages/Home.test.tsx && git commit -m "test(web): add Home.test.tsx (2 tests, double-render regression guard)

TDD: (1) renders H1 '你的内容会爆吗？' + <video>; (2) does NOT render
<nav> or <footer> (those come from Layout, not Home). Test 2 is the
regression guard against accidental NavBar/Footer re-import in Home.

Files: apps/web/test/pages/Home.test.tsx (NEW, 33 lines)
Verification: pnpm test --run = 33 React tests pass (31 baseline + 2 new);
typecheck 0; lint 0."
```

---

### Task T11: Smoke test dev server shows real Home (H1 + video)

**Files:**
- Modify: (none — verification-only task)

**Interfaces:**
- Consumes: dev server with real Home wired to `/` route
- Produces: confidence that curl returns real H1 text and `<video>` tag

- [ ] **Step 1: Start dev server**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm dev &
DEV_PID=$!
sleep 8
```

- [ ] **Step 2: Curl root and verify H1 + video**

```bash
curl -s http://localhost:5173/ | grep -c "你的内容会爆吗"
curl -s http://localhost:5173/ | grep -c "<video"
```

Expected: each prints ≥ 1. (Note: SPA renders client-side, but Vite SSR-renders index.html with `<div id="root">`; React mounts in browser. The curl will see the index.html shell; to see rendered content, would need playwright. So this curl verifies the SHELL is correct, not full render. For full render verification, see T32 step 4.)

- [ ] **Step 3: Verify index.html references assets**

```bash
curl -s http://localhost:5173/ | grep -c "/src/main.tsx"
```

Expected: 1 (Vite dev injects main.tsx script).

- [ ] **Step 4: Kill dev server**

```bash
kill $DEV_PID 2>/dev/null
sleep 2
ps aux | grep -E "vite|node.*dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
```

- [ ] **Step 5: No commit needed**

This is verification only. Proceed to T12.

---

## Layer 3: NavBar → Link Migration (T12-T16)

### Task T12: Add `import { Link }` to NavBar.tsx (no usage yet)

**Files:**
- Modify: `apps/web/src/components/NavBar.tsx` (add 1 import line)

**Interfaces:**
- Consumes: `react-router-dom` `Link` named export
- Produces: `<Link>` available in NavBar.tsx scope (but not yet used)

- [ ] **Step 1: Add import**

Open `apps/web/src/components/NavBar.tsx`. Locate the top of the file (around line 1). Add one import:

```typescript
import { Link } from 'react-router-dom';
```

(The existing import for `Globe` from `lucide-react` stays. Insert this new import in alphabetical order or right after existing imports.)

Final top of file should look like:
```typescript
import { Link } from 'react-router-dom';
import { Globe } from 'lucide-react';

export default function NavBar() {
  // ... existing JSX unchanged for now
```

(Do NOT modify the JSX yet. Just add the import.)

- [ ] **Step 2: Verify typecheck**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Verify baseline tests still green**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run
```

Expected: 33 React tests pass. NavBar.test.tsx still passes (no JSX change yet).

- [ ] **Step 4: Verify import grep**

```bash
grep -c "import { Link }" /Users/opc-1/Downloads/O/qizai/apps/web/src/components/NavBar.tsx
```

Expected: 1.

- [ ] **Step 5: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai && git add apps/web/src/components/NavBar.tsx && git commit -m "refactor(web): import Link from react-router-dom in NavBar (no usage yet)

T12: atomic first step in NavBar → Link migration. Adds import only;
JSX unchanged. T13/T14/T15 swap <a> elements one by one in next tasks.

Files: apps/web/src/components/NavBar.tsx (+1 line import)
Verification: typecheck 0; baseline 33 React tests pass; NavBar JSX
unchanged (still has <a href> elements that will be swapped in T13-T15)."
```

---

### Task T13: NavBar 「功能」<a href> → <Link to>

**Files:**
- Modify: `apps/web/src/components/NavBar.tsx` (1 line change)

**Interfaces:**
- Consumes: `<Link>` from T12
- Produces: `<a href="#features">功能</a>` → `<Link to="/predict">功能</Link>`

- [ ] **Step 1: Find and replace**

In `apps/web/src/components/NavBar.tsx`, find the line:
```jsx
<a href="#features" className="text-white/80 hover:text-white transition-colors text-sm font-medium">
  功能
</a>
```

Replace with:
```jsx
<Link to="/predict" className="text-white/80 hover:text-white transition-colors text-sm font-medium">
  功能
</Link>
```

(Classnames verbatim preserved. Only the tag and href change.)

- [ ] **Step 2: Verify typecheck**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Verify baseline tests still green**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run
```

Expected: 33 React tests pass. (NavBar.test.tsx tests 「功能」 by TEXT not role — `getByText('功能')` matches both `<a>` and `<Link>` (which renders as `<a>` under the hood). So existing test still passes.)

- [ ] **Step 4: Verify tag swap**

```bash
grep -c '<Link to="/predict"' /Users/opc-1/Downloads/O/qizai/apps/web/src/components/NavBar.tsx
grep -c 'href="#features"' /Users/opc-1/Downloads/O/qizai/apps/web/src/components/NavBar.tsx
```

Expected: first prints `1` (one Link to /predict after this task; will be 2 after T15 adds 「开始预测」). Second prints `0` (no more #features anchor).

- [ ] **Step 5: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai && git add apps/web/src/components/NavBar.tsx && git commit -m "refactor(web): NavBar 功能 <a href='#features'> → <Link to='/predict'>

T13: atomic first <a>→<Link> swap. Classnames verbatim. Routing target
/predict will be registered in T25 (currently 404 → NotFound; expected).

Files: apps/web/src/components/NavBar.tsx (1 line: tag + href swap)
Verification: typecheck 0; baseline 33 React tests pass; NavBar.test.tsx
matches by text not role (existing assertion still valid)."
```

---

### Task T14: NavBar 「定价」+「关于」<a href> → <Link to>

**Files:**
- Modify: `apps/web/src/components/NavBar.tsx` (2 line changes)

**Interfaces:**
- Consumes: `<Link>` from T12
- Produces: `<a href="#pricing">定价</a>` → `<Link to="/pricing">定价</Link>`; `<a href="#about">关于</a>` → `<Link to="/about">关于</Link>`

- [ ] **Step 1: Replace 「定价」**

Find:
```jsx
<a href="#pricing" className="text-white/80 hover:text-white transition-colors text-sm font-medium">
  定价
</a>
```

Replace with:
```jsx
<Link to="/pricing" className="text-white/80 hover:text-white transition-colors text-sm font-medium">
  定价
</Link>
```

- [ ] **Step 2: Replace 「关于」**

Find:
```jsx
<a href="#about" className="text-white/80 hover:text-white transition-colors text-sm font-medium">
  关于
</a>
```

Replace with:
```jsx
<Link to="/about" className="text-white/80 hover:text-white transition-colors text-sm font-medium">
  关于
</Link>
```

- [ ] **Step 3: Verify typecheck**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 4: Verify baseline tests still green**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run
```

Expected: 33 React tests pass.

- [ ] **Step 5: Verify tag swaps**

```bash
grep -c '<Link to="/pricing"' /Users/opc-1/Downloads/O/qizai/apps/web/src/components/NavBar.tsx
grep -c '<Link to="/about"' /Users/opc-1/Downloads/O/qizai/apps/web/src/components/NavBar.tsx
grep -c 'href="#' /Users/opc-1/Downloads/O/qizai/apps/web/src/components/NavBar.tsx
```

Expected: 1, 1, 0 (no remaining `href="#"` anchors).

- [ ] **Step 6: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai && git add apps/web/src/components/NavBar.tsx && git commit -m "refactor(web): NavBar 定价+关于 <a href='#'> → <Link to='/pricing|about'>

T14: atomic second <a>→<Link> swap (both at once since they're
adjacent siblings). Routing targets /pricing and /about will be
registered in T29 and T21b respectively.

Files: apps/web/src/components/NavBar.tsx (2 lines: tag + href swap)
Verification: typecheck 0; baseline 33 React tests pass; no remaining
href='#' anchors in NavBar."
```

---

### Task T15: NavBar 「开始预测」<button onClick> → <Link to>

**Files:**
- Modify: `apps/web/src/components/NavBar.tsx` (3 line changes: open tag + close tag + inner text)

**Interfaces:**
- Consumes: `<Link>` from T12
- Produces: `<button onClick={toast('敬请期待 预测')}>开始预测</button>` → `<Link to="/predict">开始预测</Link>`

- [ ] **Step 1: Find and replace block**

Find this block (in the right side of NavBar):
```jsx
<button
  onClick={toast('敬请期待 预测')}
  className="text-white text-sm font-medium"
>
  开始预测
</button>
```

Replace with:
```jsx
<Link
  to="/predict"
  className="text-white text-sm font-medium"
>
  开始预测
</Link>
```

- [ ] **Step 2: Verify typecheck**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Verify baseline tests — expect 1 test to FAIL**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run test/components/NavBar.test.tsx
```

Expected: **NavBar.test.tsx has a test asserting `getByRole('button', { name: '开始预测' })`** — this test will FAIL because 「开始预测」 is now `<Link>` (renders as `<a>`), not `<button>`. Test output shows 1 failure. This is **EXPECTED RED state** — T16 will fix the assertion.

The failure is the signal that T16 is needed. Do NOT fix it in this task; the atomic-task boundary requires the failure to be visible in git history before T16 fixes it.

- [ ] **Step 4: Verify the failing test message**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run test/components/NavBar.test.tsx 2>&1 | grep -E "Unable to find|TestingLibraryElementError"
```

Expected: output contains "Unable to find a button with the text" or similar — confirms the test sees `button` role missing.

- [ ] **Step 5: Verify tag swaps**

```bash
grep -c '<Link to="/predict"' /Users/opc-1/Downloads/O/qizai/apps/web/src/components/NavBar.tsx
grep -c "onClick={toast('敬请期待 预测')}" /Users/opc-1/Downloads/O/qizai/apps/web/src/components/NavBar.tsx
```

Expected: 2 (now 2 `<Link to="/predict">` in NavBar: 「功能」+「开始预测」), 0 (button removed).

- [ ] **Step 6: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai && git add apps/web/src/components/NavBar.tsx && git commit -m "refactor(web): NavBar 开始预测 <button onClick> → <Link to='/predict'>

T15: atomic final <button>→<Link> swap. Removes console.log toast
handler for predict (real navigation now). NavBar.test.tsx test
expecting 'button' role for '开始预测' will FAIL after this commit —
expected RED state; T16 fixes the assertion.

Files: apps/web/src/components/NavBar.tsx (3 lines: button→Link block)
Verification: typecheck 0; NavBar.test.tsx has 1 expected failure
(getByRole('button', {name: '开始预测'})→ element not found);
baseline 33 React tests drop to 32 temporarily; T16 restores to 33+3=36."
```

---

### Task T16: Modify NavBar.test.tsx (5 → 8 tests, wrap MemoryRouter)

**Files:**
- Modify: `apps/web/test/components/NavBar.test.tsx`

**Interfaces:**
- Consumes: `<NavBar>` (now with 4 `<Link>` elements)
- Produces: 8 tests total (3 verbatim preserved + 2 MODIFIED + 3 NEW); wraps in `<MemoryRouter>` so `<Link>` renders correctly

- [ ] **Step 1: Read existing NavBar.test.tsx**

```bash
cat /Users/opc-1/Downloads/O/qizai/apps/web/test/components/NavBar.test.tsx
```

Expected: 5 existing tests. Note their names + assertions exactly. (The file already exists from v0.13.A; do NOT delete it, MODIFY in place.)

- [ ] **Step 2: Replace file content with new 8-test version**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// Mock react-router-dom's useNavigate so we can assert navigation calls
// without setting up a full Routes context.
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import NavBar from '../../src/components/NavBar';

beforeEach(() => {
  mockNavigate.mockClear();
});

const renderNavBar = () =>
  render(
    <MemoryRouter>
      <NavBar />
    </MemoryRouter>,
  );

describe('NavBar', () => {
  // 3 verbatim preserved from v0.13.A
  it('renders qizai brand text', () => {
    renderNavBar();
    expect(screen.getByText('qizai')).toBeInTheDocument();
  });

  it('renders 3 Chinese nav links (功能 / 定价 / 关于)', () => {
    renderNavBar();
    expect(screen.getByText('功能')).toBeInTheDocument();
    expect(screen.getByText('定价')).toBeInTheDocument();
    expect(screen.getByText('关于')).toBeInTheDocument();
  });

  it('renders 登录 button with liquid-glass class', () => {
    renderNavBar();
    const loginBtn = screen.getByRole('button', { name: '登录' });
    expect(loginBtn).toBeInTheDocument();
    expect(loginBtn.className).toContain('liquid-glass');
  });

  // 2 MODIFIED — was <button>, now <Link>
  it('renders 开始预测 as <a> link to /predict (was <button>)', () => {
    renderNavBar();
    const link = screen.getByRole('link', { name: '开始预测' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/predict');
  });

  it('clicking 开始预测 calls useNavigate("/predict") (was console.log)', async () => {
    const user = userEvent.setup();
    renderNavBar();
    await user.click(screen.getByRole('link', { name: '开始预测' }));
    expect(mockNavigate).toHaveBeenCalledWith('/predict');
  });

  // 3 NEW
  it('renders 功能 / 定价 / 关于 as <a> links with correct hrefs', () => {
    renderNavBar();
    expect(screen.getByRole('link', { name: '功能' })).toHaveAttribute('href', '/predict');
    expect(screen.getByRole('link', { name: '定价' })).toHaveAttribute('href', '/pricing');
    expect(screen.getByRole('link', { name: '关于' })).toHaveAttribute('href', '/about');
  });

  it('clicking 功能 calls useNavigate("/predict")', async () => {
    const user = userEvent.setup();
    renderNavBar();
    await user.click(screen.getByRole('link', { name: '功能' }));
    expect(mockNavigate).toHaveBeenCalledWith('/predict');
  });

  it('clicking 定价 calls useNavigate("/pricing")', async () => {
    const user = userEvent.setup();
    renderNavBar();
    await user.click(screen.getByRole('link', { name: '定价' }));
    expect(mockNavigate).toHaveBeenCalledWith('/pricing');
  });
});
```

(Notes:
- `vi.mock('react-router-dom', ...)` replaces `useNavigate` with a spy while keeping `<Link>`, `<MemoryRouter>`, etc. real.
- `beforeEach` clears the spy between tests.
- `renderNavBar` helper wraps `<MemoryRouter>` (required because `<Link>` needs Router context).
- 3 verbatim preserved match v0.13.A test names where possible.
- The `<Link>` mock is NOT needed because react-router's `<Link>` renders as `<a>` natively — no further stubbing required.)

- [ ] **Step 3: Run NavBar test in isolation**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run test/components/NavBar.test.tsx
```

Expected: 8/8 passed.

- [ ] **Step 4: Run full suite**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run
```

Expected: 33 baseline (30 + 1 NotFound + 2 Home) + 3 NEW NavBar tests = **36 React tests pass**. (The 2 MODIFIED NavBar tests are NOT counted as new — they replace existing `it()` slots. Same for 2 MODIFIED HeroContent tests in T20.)

- [ ] **Step 5: Run typecheck + lint**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck && pnpm lint
```

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai && git add apps/web/test/components/NavBar.test.tsx && git commit -m "test(web): rewrite NavBar.test.tsx for Link model (5→8 tests, MemoryRouter)

T16: closes T15 RED state. 3 verbatim preserved (brand / 3 links / login
liquid-glass). 2 MODIFIED (开始预测: button→link + console.log→navigate
mock). 3 NEW (verify hrefs + verify navigate calls for 功能/定价).

MemoryRouter wrap satisfies <Link> Router context requirement
(Global Constraint). vi.mock('react-router-dom') stubs useNavigate to
spy fn while keeping <Link> real.

Files: apps/web/test/components/NavBar.test.tsx (REWRITE, 87 lines; was ~40)
Verification: pnpm test --run = 36 React tests pass (30 baseline + 1
NotFound + 2 Home + 8 NavBar); typecheck 0; lint 0."
```

---

## Layer 4: HeroContent → useNavigate Migration (T17-T20)

### Task T17: Add `import { useNavigate }` to HeroContent.tsx (no usage yet)

**Files:**
- Modify: `apps/web/src/components/HeroContent.tsx` (add 1 import + 1 hook call)

**Interfaces:**
- Consumes: `useNavigate` from `react-router-dom`
- Produces: `navigate` available in HeroContent scope (but not yet called)

- [ ] **Step 1: Add import + hook call**

Open `apps/web/src/components/HeroContent.tsx`. Modify the import line:

From:
```typescript
import { useState, FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
```

To:
```typescript
import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
```

Inside `HeroContent()` function body (after `const [title, setTitle] = useState('');`), add:

```typescript
  const navigate = useNavigate();
```

- [ ] **Step 2: Verify typecheck**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Verify baseline tests still green**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run
```

Expected: 36 React tests pass. (HeroContent.test.tsx still passes because the existing test calls `console.log` from `handleSubmit`, not navigate — both can coexist. We'll change handleSubmit in T18.)

- [ ] **Step 4: Verify grep**

```bash
grep -c "import { useNavigate }" /Users/opc-1/Downloads/O/qizai/apps/web/src/components/HeroContent.tsx
grep -c "const navigate = useNavigate()" /Users/opc-1/Downloads/O/qizai/apps/web/src/components/HeroContent.tsx
```

Expected: 1, 1.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/HeroContent.tsx && git commit -m "refactor(web): import useNavigate in HeroContent (no usage yet)

T17: atomic first step in HeroContent → useNavigate migration. Adds
import + hook call. T18 swaps handleSubmit body. T19 swaps CTA button.

Files: apps/web/src/components/HeroContent.tsx (+2 lines: import + hook)
Verification: typecheck 0; baseline 36 React tests pass; HeroContent
JSX unchanged (handleSubmit still calls console.log; CTA still button)."
```

---

### Task T18: HeroContent handleSubmit: console.log → navigate

**Files:**
- Modify: `apps/web/src/components/HeroContent.tsx` (1 line in handleSubmit)

**Interfaces:**
- Consumes: `navigate` from T17; `title` state from existing useState
- Produces: form submit navigates to `/predict?title=${encodeURIComponent(title)}` instead of console.log

- [ ] **Step 1: Find and replace handleSubmit body**

Find:
```typescript
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log(`[predict] 敬请期待 v0.14 LLM 接入, 当前标题: ${title}`);
  };
```

Replace with:
```typescript
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    navigate(`/predict?title=${encodeURIComponent(title)}`);
  };
```

- [ ] **Step 2: Verify typecheck**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck
```

Expected: exit 0. (Note: This change may cause HeroContent.test.tsx to FAIL because the test asserts `console.log` was called. We'll fix the test in T20.)

- [ ] **Step 3: Run tests — expect 1 test to FAIL**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run test/components/HeroContent.test.tsx
```

Expected: **1 test FAILS** (the one asserting `console.log` was called with the title). This is expected RED state — T20 fixes the assertion. Other 5 HeroContent tests should still pass.

- [ ] **Step 4: Verify grep**

```bash
grep -c "navigate(\`/predict" /Users/opc-1/Downloads/O/qizai/apps/web/src/components/HeroContent.tsx
grep -c "console.log" /Users/opc-1/Downloads/O/qizai/apps/web/src/components/HeroContent.tsx
```

Expected: 1 (navigate called once), 0 (console.log in handleSubmit removed).

- [ ] **Step 5: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai && git add apps/web/src/components/HeroContent.tsx && git commit -m "refactor(web): HeroContent handleSubmit → navigate('/predict?title=...')

T18: atomic handleSubmit body swap. Form submission now navigates with
deep-link query param. Predict page (T24) will read ?title= via
useSearchParams for pre-fill.

HeroContent.test.tsx test asserting console.log call will FAIL —
expected RED state; T20 fixes the assertion.

Files: apps/web/src/components/HeroContent.tsx (1 line in handleSubmit)
Verification: typecheck 0; HeroContent.test.tsx has 1 expected failure;
baseline 36 React tests drop to 35 temporarily; T20 restores to 36."
```

---

### Task T19: HeroContent CTA 「了解工作原理」 → 「关于我们」 Link

**Files:**
- Modify: `apps/web/src/components/HeroContent.tsx` (import Link + replace button block)

**Interfaces:**
- Consumes: `<Link>` from `react-router-dom`
- Produces: `<button onClick={toast(...)}>了解工作原理</button>` → `<Link to="/about">关于我们</Link>`

- [ ] **Step 1: Update import**

From:
```typescript
import { useNavigate } from 'react-router-dom';
```

To:
```typescript
import { Link, useNavigate } from 'react-router-dom';
```

- [ ] **Step 2: Find and replace CTA block**

Find:
```jsx
<button
  onClick={toast('敬请期待 工作原理')}
  className="liquid-glass rounded-full px-8 py-3 text-white text-sm font-medium hover:bg-white/5 transition-colors"
>
  了解工作原理
</button>
```

Replace with:
```jsx
<Link
  to="/about"
  className="liquid-glass rounded-full px-8 py-3 text-white text-sm font-medium hover:bg-white/5 transition-colors inline-block"
>
  关于我们
</Link>
```

(Classnames verbatim preserved + add `inline-block` so Link displays same as button. CTA 文案 changed per Global Constraint — no `/how-it-works` route exists.)

- [ ] **Step 3: Verify typecheck**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 4: Verify grep**

```bash
grep -c "关于我们" /Users/opc-1/Downloads/O/qizai/apps/web/src/components/HeroContent.tsx
grep -c "了解工作原理" /Users/opc-1/Downloads/O/qizai/apps/web/src/components/HeroContent.tsx
grep -c '<Link to="/about"' /Users/opc-1/Downloads/O/qizai/apps/web/src/components/HeroContent.tsx
```

Expected: 1, 0, 1.

- [ ] **Step 5: Run tests — expect 1 more failure**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run test/components/HeroContent.test.tsx
```

Expected: 2 tests FAIL (one from T18 console.log assertion, one from CTA button→link). T20 fixes both.

- [ ] **Step 6: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai && git add apps/web/src/components/HeroContent.tsx && git commit -m "refactor(web): HeroContent CTA 了解工作原理 → 关于我们 Link

T19: atomic CTA button→Link swap. Removes console.log toast handler
for 工作原理 (real navigation now). CTA 文案 changed from '了解工作原理'
to '关于我们' per Global Constraint — no /how-it-works route exists;
/about content is vision/team/contact, 文案 must match.

HeroContent.test.tsx test asserting '了解工作原理' button will FAIL —
expected RED state; T20 fixes both T18 and T19 assertions.

Files: apps/web/src/components/HeroContent.tsx (import + button→Link block)
Verification: typecheck 0; HeroContent.test.tsx has 2 expected failures;
baseline 36 React tests drop to 34 temporarily; T20 restores to 36."
```

---

### Task T20: Modify HeroContent.test.tsx (2 MODIFIED + 4 verbatim, wrap MemoryRouter)

**Files:**
- Modify: `apps/web/test/components/HeroContent.test.tsx`

**Interfaces:**
- Consumes: `<HeroContent>` (now with `useNavigate` + Link CTA)
- Produces: 6 tests (4 verbatim preserved + 2 MODIFIED); wraps in `<MemoryRouter>` to satisfy `useNavigate` Router context

- [ ] **Step 1: Read existing HeroContent.test.tsx**

```bash
cat /Users/opc-1/Downloads/O/qizai/apps/web/test/components/HeroContent.test.tsx
```

Expected: 6 existing tests. Identify the 2 that need modification:
- Test asserting form submit calls console.log → must assert `useNavigate` mock called
- Test asserting 「了解工作原理」 button → must assert 「关于我们」 link

- [ ] **Step 2: Replace file content**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import HeroContent from '../../src/components/HeroContent';

beforeEach(() => {
  mockNavigate.mockClear();
});

const renderHeroContent = () =>
  render(
    <MemoryRouter>
      <HeroContent />
    </MemoryRouter>,
  );

describe('HeroContent', () => {
  // 4 verbatim preserved from v0.13.A
  it('renders H1 "你的内容会爆吗？"', () => {
    renderHeroContent();
    expect(screen.getByRole('heading', { level: 1, name: '你的内容会爆吗？' })).toBeInTheDocument();
  });

  it('input updates title state', async () => {
    const user = userEvent.setup();
    renderHeroContent();
    const input = screen.getByLabelText('内容标题');
    await user.type(input, '三招教你选对洗面奶');
    expect(input).toHaveValue('三招教你选对洗面奶');
  });

  it('renders H1 with Instrument Serif font family', () => {
    renderHeroContent();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.style.fontFamily).toContain('Instrument Serif');
  });

  it('renders brand subtitle text "先问 1000 个 persona"', () => {
    renderHeroContent();
    expect(screen.getByText(/先问 1000 个 persona/)).toBeInTheDocument();
  });

  // 2 MODIFIED
  it('renders CTA as <a> link "关于我们" to /about (was 了解工作原理 button)', () => {
    renderHeroContent();
    const link = screen.getByRole('link', { name: '关于我们' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/about');
  });

  it('form submit calls useNavigate("/predict?title=...") (was console.log)', async () => {
    const user = userEvent.setup();
    renderHeroContent();
    const input = screen.getByLabelText('内容标题');
    await user.type(input, '三招教你选对洗面奶');
    // Submit form by pressing Enter on input
    await user.keyboard('{Enter}');
    expect(mockNavigate).toHaveBeenCalledWith('/predict?title=' + encodeURIComponent('三招教你选对洗面奶'));
  });
});
```

- [ ] **Step 3: Run HeroContent test in isolation**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run test/components/HeroContent.test.tsx
```

Expected: 6/6 passed.

- [ ] **Step 4: Run full suite**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run
```

Expected: 36 React tests pass (no change in count; 2 MODIFIED tests replace 2 existing slots). 

- [ ] **Step 5: Run typecheck + lint**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck && pnpm lint
```

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai && git add apps/web/test/components/HeroContent.test.tsx && git commit -m "test(web): rewrite HeroContent.test.tsx for navigate model (6 tests, MemoryRouter)

T20: closes T18+T19 RED states. 4 verbatim preserved (H1, input updates,
H1 font, subtitle). 2 MODIFIED (CTA button→link '关于我们'; form submit
console.log→useNavigate mock).

MemoryRouter wrap satisfies useNavigate Router context. vi.mock stubs
useNavigate to spy fn while keeping <Link> real.

Files: apps/web/test/components/HeroContent.test.tsx (REWRITE, 72 lines)
Verification: pnpm test --run = 36 React tests pass (no count change;
2 MODIFIED slots replace 2 existing); typecheck 0; lint 0."
```

---

## Layer 5: About Page (T21a-T23)

### Task T21a: Create About.tsx (stub-then-real step 1: file exists)

**Files:**
- Create: `apps/web/src/pages/About.tsx`

**Interfaces:**
- Consumes: `lucide-react` icons (Users, Target, Mail)
- Produces: full About page (vision/team/contact sections); file exists so App.tsx (T21b) can reference it

- [ ] **Step 1: Create About.tsx**

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
        我们相信创作不该赌运气——在按下「发布」之前，
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
            我们自己也是重度创作者——qizai 的每个功能都从「我自己用得着吗」出发。
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

- [ ] **Step 2: Verify typecheck**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Verify content greps**

```bash
grep -c "愿景" /Users/opc-1/Downloads/O/qizai/apps/web/src/pages/About.tsx
grep -c "团队" /Users/opc-1/Downloads/O/qizai/apps/web/src/pages/About.tsx
grep -c "联系我们" /Users/opc-1/Downloads/O/qizai/apps/web/src/pages/About.tsx
grep -c "mailto:hi@qizai.app" /Users/opc-1/Downloads/O/qizai/apps/web/src/pages/About.tsx
```

Expected: 1, 1, 1, 1.

- [ ] **Step 4: Verify baseline tests still green**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run
```

Expected: 36 React tests pass. (About.tsx not yet imported by App.tsx.)

- [ ] **Step 5: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai && git add apps/web/src/pages/About.tsx && git commit -m "feat(web): add About page (3 sections: vision/team/contact)

H1 '关于 qizai' + subtitle + 3 sections (愿景/团队/联系我们) with icons
+ mailto hi@qizai.app. Em-dash 紧排 per Global Constraint.

Files: apps/web/src/pages/About.tsx (NEW, 48 lines)
Verification: typecheck 0; baseline 36 React tests pass; About not yet
registered in App.tsx (T21b adds the route)."
```

---

### Task T21b: Register /about route in App.tsx

**Files:**
- Modify: `apps/web/src/App.tsx` (add 1 import + 1 route)

**Interfaces:**
- Consumes: `<About>` from T21a
- Produces: `<Route path="/about" element={<About />} />` registered

- [ ] **Step 1: Update App.tsx**

From:
```typescript
import Home from './pages/Home';
import NotFound from './pages/NotFound';
```

To:
```typescript
import Home from './pages/Home';
import About from './pages/About';
import NotFound from './pages/NotFound';
```

Add the route line between `path="/"` and `path="*"`:
```jsx
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
```

- [ ] **Step 2: Verify typecheck**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Run baseline tests still green**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run
```

Expected: 36 React tests pass.

- [ ] **Step 4: Smoke test /about via dev server**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm dev &
DEV_PID=$!
sleep 8

curl -s http://localhost:5173/about | grep -c "关于 qizai"
# Expected: 1 (in the index.html shell — Vite injects main.tsx which mounts React)

kill $DEV_PID 2>/dev/null
sleep 2
ps aux | grep -E "vite|node.*dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
```

Expected: grep returns ≥ 1. (Full React mount requires playwright; curl verifies shell.)

- [ ] **Step 5: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai && git add apps/web/src/App.tsx && git commit -m "feat(web): register /about route in App.tsx

T21b: atomic route registration. Stub-then-real pattern completed:
About.tsx existed (T21a), now App.tsx imports + routes it.

Files: apps/web/src/App.tsx (+2 lines: import + Route)
Verification: typecheck 0; baseline 36 React tests pass; curl /about
returns '关于 qizai' in index.html shell."
```

---

### Task T23: Write About.test.tsx (4 tests)

**Files:**
- Create: `apps/web/test/pages/About.test.tsx`

**Interfaces:**
- Consumes: `<About>` from `apps/web/src/pages/About` (T21a)
- Produces: 4 tests verifying H1 / 3 sections / mailto / social hint

- [ ] **Step 1: Create About.test.tsx**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import About from '../../src/pages/About';

describe('About', () => {
  it('renders H1 "关于 qizai"', () => {
    render(
      <MemoryRouter>
        <About />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: '关于 qizai' })).toBeInTheDocument();
  });

  it('renders 3 sections (愿景 / 团队 / 联系我们) with icons', () => {
    render(
      <MemoryRouter>
        <About />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 2, name: '愿景' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '团队' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '联系我们' })).toBeInTheDocument();
  });

  it('renders mailto link to hi@qizai.app', () => {
    render(
      <MemoryRouter>
        <About />
      </MemoryRouter>,
    );
    const mailto = screen.getByRole('link', { name: 'hi@qizai.app' });
    expect(mailto).toHaveAttribute('href', 'mailto:hi@qizai.app');
  });

  it('renders social search hint "qizai 骑仔"', () => {
    render(
      <MemoryRouter>
        <About />
      </MemoryRouter>,
    );
    expect(screen.getByText(/qizai 骑仔/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run new test in isolation**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run test/pages/About.test.tsx
```

Expected: 4/4 passed.

- [ ] **Step 3: Run full suite**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run
```

Expected: 36 baseline + 4 new = **40 React tests pass**.

- [ ] **Step 4: Run typecheck + lint**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck && pnpm lint
```

Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai && git add apps/web/test/pages/About.test.tsx && git commit -m "test(web): add About.test.tsx (4 tests: H1 / 3 sections / mailto / social hint)

TDD: verifies H1 '关于 qizai', 3 section H2s, mailto link, and
'qizai 骑仔' search hint.

Files: apps/web/test/pages/About.test.tsx (NEW, 50 lines)
Verification: pnpm test --run = 40 React tests pass (36 baseline + 4 new);
typecheck 0; lint 0."
```

---

## Layer 6: Predict Page (T24-T27)

### Task T24: Create Predict.tsx

**Files:**
- Create: `apps/web/src/pages/Predict.tsx`

**Interfaces:**
- Consumes: `useState`, `FormEvent` from `react`; `useSearchParams` from `react-router-dom`; `ArrowRight`, `Sparkles` from `lucide-react`
- Produces: full Predict page (H1, subtitle, form, 3 feature cards); file exists so App.tsx (T25) can reference it

- [ ] **Step 1: Create Predict.tsx**

```typescript
import { useState, FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
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
        小红书 / 抖音 / B站 一键预测，给你可执行的发布建议。
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
          { icon: Sparkles, title: '几分钟拿到投票', desc: '1000 个 persona 并行投票，不打扰你写稿' },
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

(Critical: NO 「30 天流量曲线」 / NO 「30 秒拿到结果」 copy. Only 「几分钟拿到投票」 — accurate to v0.14 LLM timing uncertainty.)

- [ ] **Step 2: Verify typecheck**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Verify banned copy grep**

```bash
grep -c "30 天流量曲线\|30 天曲线\|30 秒拿到结果" /Users/opc-1/Downloads/O/qizai/apps/web/src/pages/Predict.tsx
```

Expected: 0 (zero matches).

- [ ] **Step 4: Verify baseline tests still green**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run
```

Expected: 40 React tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai && git add apps/web/src/pages/Predict.tsx && git commit -m "feat(web): add Predict page (form + 3 feature cards)

H1 '预测你的内容会爆吗？' + subtitle (NO '30 天流量曲线' / NO '30 秒'
per Global Constraint) + form with useSearchParams pre-fill from
?title= + 3 feature cards (几分钟拿到投票 / 3 平台同测 / 可解释报告).

Files: apps/web/src/pages/Predict.tsx (NEW, 60 lines)
Verification: typecheck 0; baseline 40 React tests pass; banned copy
grep = 0; Predict not yet routed (T25)."
```

---

### Task T25: Register /predict route in App.tsx

**Files:**
- Modify: `apps/web/src/App.tsx` (add 1 import + 1 route)

**Interfaces:**
- Consumes: `<Predict>` from T24
- Produces: `<Route path="/predict" element={<Predict />} />` registered

- [ ] **Step 1: Update App.tsx**

From:
```typescript
import Home from './pages/Home';
import About from './pages/About';
import NotFound from './pages/NotFound';
```

To:
```typescript
import Home from './pages/Home';
import About from './pages/About';
import Predict from './pages/Predict';
import NotFound from './pages/NotFound';
```

Add the route line (alphabetical order):
```jsx
          <Route path="/" element={<Home />} />
          <Route path="/predict" element={<Predict />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
```

- [ ] **Step 2: Verify typecheck**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Run tests**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run
```

Expected: 40 React tests pass.

- [ ] **Step 4: Smoke test /predict**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm dev &
DEV_PID=$!
sleep 8

curl -s http://localhost:5173/predict | grep -c "预测你的内容会爆吗"
# Expected: 1

kill $DEV_PID 2>/dev/null
sleep 2
ps aux | grep -E "vite|node.*dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
```

- [ ] **Step 5: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai && git add apps/web/src/App.tsx && git commit -m "feat(web): register /predict route in App.tsx

T25: atomic route registration. Stub-then-real completed: Predict.tsx
existed (T24), now App.tsx imports + routes it.

Files: apps/web/src/App.tsx (+2 lines: import + Route)
Verification: typecheck 0; baseline 40 React tests pass; curl /predict
returns '预测你的内容会爆吗' in shell."
```

---

### Task T26: Write Predict.test.tsx (5 tests, MemoryRouter + deep-link pre-fill)

**Files:**
- Create: `apps/web/test/pages/Predict.test.tsx`

**Interfaces:**
- Consumes: `<Predict>` from T24; `<MemoryRouter>` from `react-router-dom`
- Produces: 5 tests verifying H1 / 3 feature cards / input updates / submit console.log / deep-link pre-fill on mount

- [ ] **Step 1: Create Predict.test.tsx**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Predict from '../../src/pages/Predict';

describe('Predict', () => {
  it('renders H1 "预测你的内容会爆吗？"', () => {
    render(
      <MemoryRouter initialEntries={['/predict']}>
        <Predict />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: '预测你的内容会爆吗？' })).toBeInTheDocument();
  });

  it('renders 3 feature cards with Sparkles icon', () => {
    render(
      <MemoryRouter initialEntries={['/predict']}>
        <Predict />
      </MemoryRouter>,
    );
    expect(screen.getByText('几分钟拿到投票')).toBeInTheDocument();
    expect(screen.getByText('3 平台同测')).toBeInTheDocument();
    expect(screen.getByText('可解释报告')).toBeInTheDocument();
  });

  it('input updates title state', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/predict']}>
        <Predict />
      </MemoryRouter>,
    );
    const input = screen.getByLabelText('内容标题或正文');
    await user.type(input, '三招教你选对洗面奶');
    expect(input).toHaveValue('三招教你选对洗面奶');
  });

  it('form submit calls console.log with title (no LLM yet)', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/predict']}>
        <Predict />
      </MemoryRouter>,
    );
    const input = screen.getByLabelText('内容标题或正文');
    await user.type(input, '三招教你选对洗面奶');
    await user.click(screen.getByRole('button', { name: '开始预测' }));
    expect(consoleSpy).toHaveBeenCalledWith(
      '[predict] 敬请期待 v0.14 LLM 接入, 当前标题: 三招教你选对洗面奶',
    );
    consoleSpy.mockRestore();
  });

  it('deep-link ?title=foo pre-fills input on initial mount via useSearchParams', () => {
    render(
      <MemoryRouter initialEntries={['/predict?title=hello']}>
        <Predict />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText('内容标题或正文')).toHaveValue('hello');
  });
});
```

(Notes:
- Need to import `vi` from vitest: add `import { describe, it, expect, vi } from 'vitest';` to top of file.
- Deep-link pre-fill test asserts ONLY mount-time value (per React pattern); does NOT re-render with different URL.
- Predict page uses `useSearchParams` not `useNavigate`, so no need to mock `useNavigate` here.)

Add to top:
```typescript
import { describe, it, expect, vi } from 'vitest';
```

Replace existing `import { describe, it, expect } from 'vitest';` line.

- [ ] **Step 2: Run new test in isolation**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run test/pages/Predict.test.tsx
```

Expected: 5/5 passed.

- [ ] **Step 3: Run full suite**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run
```

Expected: 40 baseline + 5 new = **45 React tests pass**.

- [ ] **Step 4: Run typecheck + lint**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck && pnpm lint
```

Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai && git add apps/web/test/pages/Predict.test.tsx && git commit -m "test(web): add Predict.test.tsx (5 tests, MemoryRouter + deep-link pre-fill)

TDD: H1 / 3 feature cards / input updates / form submit console.log /
deep-link ?title=foo pre-fill. MemoryRouter wrap with initialEntries
satisfies useSearchParams Router context.

Files: apps/web/test/pages/Predict.test.tsx (NEW, 78 lines)
Verification: pnpm test --run = 45 React tests pass (40 baseline + 5 new);
typecheck 0; lint 0."
```

---

### Task T27: Smoke test deep-link curl (?title=hello)

**Files:**
- Modify: (none — verification-only task)

**Interfaces:**
- Consumes: dev server with /predict wired + Predict.tsx using useSearchParams
- Produces: confidence that curl with deep-link returns correct shell

- [ ] **Step 1: Start dev server**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm dev &
DEV_PID=$!
sleep 8
```

- [ ] **Step 2: Curl /predict (no query)**

```bash
curl -s http://localhost:5173/predict | grep -c "predict-title"
```

Expected: 1 (input id present in shell).

- [ ] **Step 3: Curl /predict?title=hello**

```bash
curl -s 'http://localhost:5173/predict?title=hello' | grep -c "predict-title"
```

Expected: 1.

- [ ] **Step 4: Verify pre-fill via playwright (optional, may skip if no playwright infra)**

If playwright MCP is available, navigate to `http://localhost:5173/predict?title=hello` and assert input value = "hello". Otherwise skip this step (curl verifies shell only).

- [ ] **Step 5: Kill dev server**

```bash
kill $DEV_PID 2>/dev/null
sleep 2
ps aux | grep -E "vite|node.*dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
```

- [ ] **Step 6: No commit needed**

Verification only. Proceed to T28.

---

## Layer 7: Pricing Page (T28-T30)

### Task T28: Create Pricing.tsx (3 tiers ¥0/¥29/¥299)

**Files:**
- Create: `apps/web/src/pages/Pricing.tsx`

**Interfaces:**
- Consumes: `<Link>` from `react-router-dom`; `<Check>` from `lucide-react`
- Produces: full Pricing page with TIERS const array (3 tiers ¥0/¥29/¥299, tier 2 highlight + 「开始体验」CTA, tier 3 mailto); file exists so App.tsx (T29) can reference it

- [ ] **Step 1: Create Pricing.tsx**

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
    features: ['无限预测', '3 平台同测', '完整报告 + 决策依据', '历史报告存档 90 天（即将上线）'],
    cta: '开始体验',
    href: '/predict',
    highlight: true,
  },
  {
    name: '团队',
    price: '¥299',
    period: '/ 月',
    desc: 'MCN / 内容工作室',
    features: ['个人版全部功能', '5 个子账号', '历史报告永久存档（即将上线）', 'REST API 接入（即将上线）', '优先客服'],
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
        不收智商税——按真实使用量定价，该有的功能都给，不藏着掖着。
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

- [ ] **Step 2: Verify typecheck**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Verify pricing + CTA greps**

```bash
grep -c "price: '¥0'" /Users/opc-1/Downloads/O/qizai/apps/web/src/pages/Pricing.tsx
grep -c "price: '¥29'" /Users/opc-1/Downloads/O/qizai/apps/web/src/pages/Pricing.tsx
grep -c "price: '¥299'" /Users/opc-1/Downloads/O/qizai/apps/web/src/pages/Pricing.tsx
grep -c "cta: '开始体验'" /Users/opc-1/Downloads/O/qizai/apps/web/src/pages/Pricing.tsx
grep -c "cta: '订阅'" /Users/opc-1/Downloads/O/qizai/apps/web/src/pages/Pricing.tsx
```

Expected: 1, 1, 1, 1, 0 (no standalone "订阅" CTA).

- [ ] **Step 4: Verify banned pricing copy grep**

```bash
grep -c "¥19\|¥69\|¥199" /Users/opc-1/Downloads/O/qizai/apps/web/src/pages/Pricing.tsx
```

Expected: 0 (no v0.13.A placeholder prices per ADR-007).

- [ ] **Step 5: Verify baseline tests still green**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run
```

Expected: 45 React tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai && git add apps/web/src/pages/Pricing.tsx && git commit -m "feat(web): add Pricing page (3 tiers ¥0/¥29/¥299 per ADR-007)

TIERS const array (as const) with: 试用 ¥0 (免费开始) / 个人创作者
¥29 (开始体验, highlight) / 团队 ¥299 (联系销售 mailto). Replaces
v0.13.A placeholder ¥19/¥69/¥199 per ADR-007. '即将上线' tags on
archive/REST API features (D1 schema in v0.14 backlog).

Files: apps/web/src/pages/Pricing.tsx (NEW, 95 lines)
Verification: typecheck 0; baseline 45 React tests pass; ¥0/¥29/¥299
grep = 1 each; banned copy grep = 0; Pricing not yet routed (T29)."
```

---

### Task T29: Register /pricing route in App.tsx

**Files:**
- Modify: `apps/web/src/App.tsx` (add 1 import + 1 route)

**Interfaces:**
- Consumes: `<Pricing>` from T28
- Produces: `<Route path="/pricing" element={<Pricing />} />` registered

- [ ] **Step 1: Update App.tsx**

From:
```typescript
import Home from './pages/Home';
import About from './pages/About';
import Predict from './pages/Predict';
import NotFound from './pages/NotFound';
```

To:
```typescript
import Home from './pages/Home';
import About from './pages/About';
import Predict from './pages/Predict';
import Pricing from './pages/Pricing';
import NotFound from './pages/NotFound';
```

Add the route line (alphabetical order):
```jsx
          <Route path="/" element={<Home />} />
          <Route path="/predict" element={<Predict />} />
          <Route path="/about" element={<About />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="*" element={<NotFound />} />
```

- [ ] **Step 2: Verify typecheck**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Run tests**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run
```

Expected: 45 React tests pass.

- [ ] **Step 4: Smoke test /pricing**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm dev &
DEV_PID=$!
sleep 8

curl -s http://localhost:5173/pricing | grep -c "定价"
# Expected: 1

kill $DEV_PID 2>/dev/null
sleep 2
ps aux | grep -E "vite|node.*dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
```

- [ ] **Step 5: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai && git add apps/web/src/App.tsx && git commit -m "feat(web): register /pricing route in App.tsx

T29: atomic route registration. Stub-then-real completed: Pricing.tsx
existed (T28), now App.tsx imports + routes it. All 4 main routes
(/ /predict /about /pricing) + 404 fallback now registered.

Files: apps/web/src/App.tsx (+2 lines: import + Route)
Verification: typecheck 0; baseline 45 React tests pass; curl /pricing
returns '定价' in shell."
```

---

### Task T30: Write Pricing.test.tsx (5 tests, MemoryRouter)

**Files:**
- Create: `apps/web/test/pages/Pricing.test.tsx`

**Interfaces:**
- Consumes: `<Pricing>` from T28; `<MemoryRouter>` from `react-router-dom`
- Produces: 5 tests verifying 3 cards / highlight ring + sr-only / prices / features / Link vs mailto

- [ ] **Step 1: Create Pricing.test.tsx**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Pricing from '../../src/pages/Pricing';

describe('Pricing', () => {
  it('renders 3 tier cards (试用 / 个人创作者 / 团队)', () => {
    render(
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 2, name: /试用/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /个人创作者/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /团队/ })).toBeInTheDocument();
  });

  it('middle tier (个人创作者) has highlight ring + sr-only "推荐方案"', () => {
    render(
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>,
    );
    // sr-only element exists
    expect(screen.getByText('推荐方案', { selector: 'span' })).toBeInTheDocument();
    // highlight ring class on tier 2 card
    const tier2Card = screen.getByRole('heading', { level: 2, name: /个人创作者/ }).closest('div');
    expect(tier2Card?.className).toContain('ring-2');
  });

  it('renders prices ¥0 / ¥29 / ¥299', () => {
    render(
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>,
    );
    expect(screen.getByText('¥0')).toBeInTheDocument();
    expect(screen.getByText('¥29')).toBeInTheDocument();
    expect(screen.getByText('¥299')).toBeInTheDocument();
  });

  it('each tier lists features with Check icon', () => {
    render(
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>,
    );
    // Sample check from each tier (not exhaustive — 3+5+3 = 11 total)
    expect(screen.getByText('每天 3 次预测')).toBeInTheDocument();
    expect(screen.getByText('无限预测')).toBeInTheDocument();
    expect(screen.getByText('5 个子账号')).toBeInTheDocument();
    // Check icons present (aria-hidden so use querySelector)
    const checkIcons = document.querySelectorAll('svg.lucide-check');
    expect(checkIcons.length).toBeGreaterThan(5);
  });

  it('tier 1/2 CTA is Link to /predict; tier 3 CTA is mailto link', () => {
    render(
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>,
    );
    // Tier 1: 免费开始 → /predict
    expect(screen.getByRole('link', { name: '免费开始' })).toHaveAttribute('href', '/predict');
    // Tier 2: 开始体验 → /predict
    expect(screen.getByRole('link', { name: '开始体验' })).toHaveAttribute('href', '/predict');
    // Tier 3: 联系销售 → mailto
    expect(screen.getByRole('link', { name: '联系销售' })).toHaveAttribute('href', 'mailto:hi@qizai.app');
  });
});
```

- [ ] **Step 2: Run new test in isolation**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run test/pages/Pricing.test.tsx
```

Expected: 5/5 passed.

- [ ] **Step 3: Run full suite**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run
```

Expected: 45 baseline + 5 new = **50 React tests pass**.

Wait — expected was 49. Let me recount: 30 baseline + 1 NotFound + 2 Home + 3 NavBar new (8 total NavBar - 5 baseline = 3 NEW) + 4 About + 5 Predict + 5 Pricing = 30 + 1 + 2 + 3 + 4 + 5 + 5 = **50**. But spec says 49.

Reconcile: spec §六.2 says `30 + 19 = 49`. Let me re-tally `+19` per spec §六.1: Home 2 + Predict 5 + About 4 + Pricing 5 + NavBar new 3 = 19. Plus 4 MODIFIED (NavBar 2 + HeroContent 2, same it() slots). Total `it()` count = baseline 30 + new 19 = 49. We have 30 baseline + 1 NotFound + 2 Home + 3 NavBar new + 4 About + 5 Predict + 5 Pricing = **50**. **Discrepancy: spec missed NotFound.test.tsx (1 test) in the +19 count.**

**Resolution**: The actual count is 50, not 49. Update spec accordingly OR accept this task's reality. **For plan purposes, document actual count = 50** and update CHANGELOG entry in T31.

- [ ] **Step 4: Run typecheck + lint**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck && pnpm lint
```

Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai && git add apps/web/test/pages/Pricing.test.tsx && git commit -m "test(web): add Pricing.test.tsx (5 tests, MemoryRouter)

TDD: 3 tier cards / middle tier highlight + sr-only '推荐方案' / prices
¥0/¥29/¥299 / features with Check icons / Link vs mailto routing.

Files: apps/web/test/pages/Pricing.test.tsx (NEW, 78 lines)
Verification: pnpm test --run = 50 React tests pass (45 baseline +
5 new); typecheck 0; lint 0.

NOTE: actual total = 50 React tests, not 49 as spec §六.2 originally
claimed — spec missed NotFound.test.tsx (1 test) in +19 count. CHANGELOG
in T31 will document actual count = 50."
```

---

## Layer 8: Integration + Whole-Branch Review (T31-T33)

### Task T31: Insert v0.13.B.1 entry into CHANGELOG.md (between v0.13.A and v0.13.B.2)

**Files:**
- Modify: `CHANGELOG.md` (insert 12-line block between v0.13.A and v0.13.B.2)

**Interfaces:**
- Consumes: existing CHANGELOG entries (Keep a Changelog format)
- Produces: v0.13.B.1 entry with Added/Changed count = 19 React tests + 4 modified (per actual = 50 total, not 49; spec note resolved)

- [ ] **Step 1: Read CHANGELOG to confirm insert position**

```bash
grep -n "^## \[v0.13" /Users/opc-1/Downloads/O/qizai/CHANGELOG.md
```

Expected: 3 lines (v0.13.A, v0.13.B.1 [missing — that's where we insert], v0.13.B.2).

If `v0.13.B.1` already exists: STOP and report to user — do not modify existing entries.

- [ ] **Step 2: Insert entry between v0.13.A and v0.13.B.2**

Find the section header immediately preceding `v0.13.B.2` (likely `## [v0.13.A] - 2026-07-...` or similar). Determine the v0.13.A version line ending — usually `## [v0.13.B.2] - 2026-07-24`. Insert this block before that line:

```markdown
## [v0.13.B.1] - 2026-07-24

### Added
- react-router v6 multi-route SPA: 4 routes (`/` / `/predict` / `/about` / `/pricing`) + 404 fallback (`*`)
- Pages: `Home` (real VideoBackground+HeroContent composition), `Predict` (form + 3 feature cards), `About` (vision/team/contact), `Pricing` (3 tiers ¥0/¥29/¥299 per ADR-007), `NotFound`
- Components: `Layout` (Outlet wrapper), `NavBar` (Link navigation), `HeroContent` (useNavigate submit)
- Tests: 19 new React tests + 4 modified (same it() slots replaced) → 50 React tests total
- Shell tests: still 13 (predev/prebuild hooks unchanged, _redirects SPA fallback is browser-routing concern not shell-test)

### Changed
- HeroContent.handleSubmit: console.log → `navigate(\`/predict?title=\${encodeURIComponent(title)}\`)` (predict page pre-fills via useSearchParams)
- HeroContent CTA button 「了解工作原理」 → Link 「关于我们」 → `<Link to="/about">`
- NavBar links: 5 buttons → `<Link to="/...">` (功能 `/` / 定价 `/pricing` / 关于 `/about` / 开始预测 `/predict` / logo `/`)
- Pricing tier 2 CTA: 「订阅」 → 「开始体验」
- App.tsx: rewrite to `BrowserRouter` + `Routes` with nested `<Route element={<Layout />}>` wrapper
- Architecture: ADR-005 (react-router v6 declarative), ADR-006 (CF Pages `_redirects` SPA fallback), ADR-007 (pricing ¥0/¥29/¥299)

### Fixed
- (none this release)

### ADR
- [ADR-005: react-router v6 declarative over Vike SSR / Next.js](docs/superpowers/specs/2026-07-24-qizai-v013b1-reactrouter-spa.md)
- [ADR-006: CF Pages `_redirects` SPA fallback for deep-link refresh](docs/superpowers/specs/2026-07-24-qizai-v013b1-reactrouter-spa.md)
- [ADR-007: Pricing tiers ¥0/¥29/¥299 (replaces v0.13.A placeholder)](docs/superpowers/specs/2026-07-24-qizai-v013b1-reactrouter-spa.md)
```

Important: NO `### Fixed` content (no fixes in this release per spec §一 Out). Tier 2 CTA is a Changed (copy updated). Banned copy removed is a Changed, not Fixed.

- [ ] **Step 3: Verify CHANGELOG position + counts**

```bash
grep -n "^## \[v0.13" /Users/opc-1/Downloads/O/qizai/CHANGELOG.md
grep -c "50 React tests" /Users/opc-1/Downloads/O/qizai/CHANGELOG.md
grep -c "了解工作原理" /Users/opc-1/Downloads/O/qizai/CHANGELOG.md
grep -c "30 天流量曲线\|30 秒拿到结果" /Users/opc-1/Downloads/O/qizai/CHANGELOG.md
```

Expected:
- 3 section headers, in order: v0.13.A (or earlier), v0.13.B.1 (NEW), v0.13.B.2
- "50 React tests" appears ≥ 1
- "了解工作原理" appears ≥ 1 (in the Changed note for HeroContent CTA)
- "30 天流量曲线" / "30 秒拿到结果" appears 0 (banned copy never escaped spec)

- [ ] **Step 4: Verify no banned copy slipped in code**

```bash
grep -r "30 天流量曲线\|30 天曲线\|30 秒拿到结果" apps/web/src/ apps/web/test/ apps/web/public/ 2>/dev/null
```

Expected: no output (no matches).

- [ ] **Step 5: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai && git add CHANGELOG.md && git commit -m "docs(changelog): insert v0.13.B.1 entry (react-router v6 SPA)

Added: 4 routes / 5 pages / Layout+NavBar+HeroContent Link migration /
19 new + 4 modified React tests (50 total) / no shell test delta.
Changed: HeroContent navigate + Link CTA / NavBar all-button→Link /
tier 2 CTA 订阅→开始体验 / App.tsx BrowserRouter+Routes rewrite /
ADRs 005/006/007.
No Fixed section (no fixes in this release per spec §一 Out).

Verification: 3 headers in CHANGELOG, v0.13.B.1 between v0.13.A and
v0.13.B.2 (alphabetical order preserved); banned-copy grep across
src/test/public = 0 matches; '了解工作原理' shown once in Changed
note as legacy ref."
```

---

### Task T32: Full-branch verification matrix (all checks pass)

**Files:**
- Modify: (none — verification-only task)

**Interfaces:**
- Consumes: all T01-T31 outputs
- Produces: green evidence across every required verification (62 total tests, typecheck, lint, build, 4 routes curl, grep guards)

- [ ] **Step 1: Run React test suite**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test --run 2>&1 | tail -30
```

Expected: `Tests  X passed (X)` where **X = 50** (30 baseline + 1 NotFound + 2 Home + 3 NavBar new + 4 About + 5 Predict + 5 Pricing).

- [ ] **Step 2: Run shell test suite**

```bash
cd /Users/opc-1/Downloads/O/qizai && bash apps/web/test/shell/fetch-social-svgs.test.sh 2>&1 | tail -20
# or whatever the canonical shell test invocation is
```

Expected: all 13 shell tests pass.

- [ ] **Step 3: Typecheck**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck
```

Expected: exit 0, no errors.

- [ ] **Step 4: Lint**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm lint
```

Expected: exit 0, no warnings.

- [ ] **Step 5: Build (CF Pages target)**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm build
```

Expected: exit 0; `dist/_redirects` exists with `/*  /index.html  200` rule; `dist/index.html` exists; `dist/assets/index-*.js` exists.

- [ ] **Step 6: Verify _redirects in dist**

```bash
cat /Users/opc-1/Downloads/O/qizai/apps/web/dist/_redirects
```

Expected: contains `/*  /index.html  200` (SPA fallback).

- [ ] **Step 7: 4 routes curl smoke**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm dev &
DEV_PID=$!
sleep 8

curl -s -o /dev/null -w "GET / → %{http_code}\n" http://localhost:5173/
curl -s -o /dev/null -w "GET /predict → %{http_code}\n" http://localhost:5173/predict
curl -s -o /dev/null -w "GET /about → %{http_code}\n" http://localhost:5173/about
curl -s -o /dev/null -w "GET /pricing → %{http_code}\n" http://localhost:5173/pricing
curl -s -o /dev/null -w "GET /nonexistent → %{http_code}\n" http://localhost:5173/nonexistent

kill $DEV_PID 2>/dev/null
sleep 2
ps aux | grep -E "vite|node.*dev" | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
```

Expected: all 5 status codes = 200 (Vite dev serves shell for any path; SPA routing is browser-side).

- [ ] **Step 8: 7 grep guards (banned/correctness copy)**

```bash
cd /Users/opc-1/Downloads/O/qizai && {
  echo "=== 1. Banned copy scan (must be 0) ==="
  echo "30 天流量曲线 hits: $(grep -r '30 天流量曲线' apps/web/src/ apps/web/test/ apps/web/public/ 2>/dev/null | wc -l)"
  echo "30 秒拿到结果 hits: $(grep -r '30 秒拿到结果' apps/web/src/ apps/web/test/ apps/web/public/ 2>/dev/null | wc -l)"
  echo "20 秒 hits: $(grep -r '20 秒' apps/web/src/ apps/web/test/ 2>/dev/null | wc -l)"
  echo "了解工作原理 hits (should be 1, in CHANGELOG only): $(grep -r '了解工作原理' apps/web/src/ apps/web/test/ apps/web/public/ 2>/dev/null | wc -l)"
  echo ""
  echo "=== 2. ADR-007 pricing (must be 3) ==="
  echo "¥0 hits: $(grep -r '¥0' apps/web/src/pages/Pricing.tsx | wc -l)"
  echo "¥29 hits: $(grep -r '¥29' apps/web/src/pages/Pricing.tsx | wc -l)"
  echo "¥299 hits: $(grep -r '¥299' apps/web/src/pages/Pricing.tsx | wc -l)"
  echo "Old ¥19/¥69/¥199 hits (must be 0): $(grep -rE '¥19|¥69|¥199' apps/web/src/ 2>/dev/null | wc -l)"
  echo ""
  echo "=== 3. CTA correctness (must have 关于我们, NOT 了解工作原理 in code) ==="
  echo "关于我们 hits in HeroContent: $(grep -c '关于我们' apps/web/src/components/HeroContent.tsx)"
  echo "了解工作原理 hits in HeroContent (must be 0): $(grep -c '了解工作原理' apps/web/src/components/HeroContent.tsx)"
  echo ""
  echo "=== 4. Em-dash 紧排 (must be 用, not 用——) ==="
  echo "—— with no spaces: $(grep -rE '[^ ]——[^ ]' apps/web/src/ 2>/dev/null | wc -l)"
  echo ""
  echo "=== 5. MemoryRouter in router-hook tests ==="
  for f in apps/web/test/components/HeroContent.test.tsx apps/web/test/components/NavBar.test.tsx apps/web/test/pages/About.test.tsx apps/web/test/pages/Predict.test.tsx apps/web/test/pages/Pricing.test.tsx; do
    if [ -f "$f" ]; then
      mr=$(grep -c "MemoryRouter" "$f")
      echo "$f: MemoryRouter count = $mr"
    fi
  done
  echo ""
  echo "=== 6. Stub-then-real pattern ==="
  echo "Home.tsx imports: $(grep -c 'VideoBackground\|HeroContent' apps/web/src/pages/Home.tsx)"
  echo "App.tsx Routes count: $(grep -c 'Route' apps/web/src/App.tsx)"
  echo ""
  echo "=== 7. apps/api/ untouched ==="
  echo "apps/api files modified in this branch:"
  cd /Users/opc-1/Downloads/O/qizai && git diff --name-only $(git merge-base HEAD main 2>/dev/null || git log --oneline | tail -1 | awk '{print $1}') HEAD | grep "^apps/api" | head -5
}
```

Expected output sketch:
- Banned copy: all 0
- ADR-007: 1, 1, 1, 0
- CTA: 1, 0
- Em-dash: ≥ 1 (verifying 紧排 exists), ideally 5+
- MemoryRouter: 1 per file (5 files = 5 hits)
- Home imports: ≥ 1 each for VideoBackground/HeroContent
- App.tsx Routes: 5 (4 main + 404 fallback)
- apps/api: empty (untouched)

- [ ] **Step 9: No commit needed**

Verification only. All T32 verification checks green → T33 ready.

---

### Task T33: Opus whole-branch review (final gate)

**Files:**
- Modify: (none — review-only task)

**Interfaces:**
- Consumes: full branch diff vs base commit (commit before T01)
- Produces: Opus review verdict — approved / changes requested

- [ ] **Step 1: Identify base commit**

```bash
cd /Users/opc-1/Downloads/O/qizai && git log --oneline | tail -20
```

The base commit (before T01) is the commit BEFORE the first v0.13.B.1 commit. Use `git log --reverse | head` to find it, or look for the `ab85937` reference (per spec context: ab85937 is the spec round-2+3 audit final; v0.13.B.2 master HEAD was 5736b37 per progress.md).

For this task, base = the commit at the tip before T01 created any commits. The base is determined by `git merge-base HEAD main` if on a branch, or by `git log --reverse --oneline` on the spec'd tip.

- [ ] **Step 2: Dispatch Opus subagent for full-branch review**

Use the requesting-code-review skill workflow. Provide:
- Full diff (`git diff BASE..HEAD`)
- Spec path: `docs/superpowers/specs/2026-07-24-qizai-v013b1-reactrouter-spa.md`
- Plan path: `docs/superpowers/plans/2026-07-24-qizai-v013b1-multiroute-spa.md` (this file)
- Brief: "5 critical + 5 important patches verified by round-2 audit + 10/10 round-3 verified. Plan has 34 atomic tasks. Expected: 50 React tests pass + 13 shell + typecheck + lint + build + 7 grep guards + 5 routes curl. Review: any critical/important findings vs spec?"

- [ ] **Step 3: Address any Critical/Important findings**

If Opus returns findings:
1. Dispatch ONE fix subagent with the complete findings list
2. Re-run all T32 verification matrix
3. Re-dispatch Opus subagent for re-review

If Opus returns clean (✅ Approved): proceed.

- [ ] **Step 4: Final commit (if any review-fix commits created)**

If any commits were made during fix iterations, ensure final commit message references "review: T33 round-N fixes per Opus" or similar.

- [ ] **Step 5: Final status report**

Print:
- Total commits in branch: N
- All 62 tests pass: ✅ / ❌
- All 7 grep guards green: ✅ / ❌
- All 5 routes serve 200: ✅ / ❌
- Opus verdict: ✅ Approved / ⚠️ Pending re-review
- CHANGELOG entry: ✅ inserted
- Next action: invoke finishing-a-development-branch skill

---

# Self-Review (执行前最后检查)

执行前按 writing-plans skill 的 self-review 验证本计划：

| # | 检查项 | 验证方法 | 状态 |
|---|--------|----------|------|
| 1 | Spec 覆盖：§一 §三 §四 §5.1-5.9 §六 §七 §八 §九 §十 全部对应到 task | Cross-ref：每 spec 章节列出对应 task IDs | ✅ |
| 2 | Placeholder 扫描：无 TBD/TODO/「后续补」/「implement later」 | grep plan: `grep -nE "TBD\|TODO\|待补充\|implement later" plan.md` = 0 | ✅ |
| 3 | Type/signature 一致性：Outlet type、useNavigate 返回、Link to prop、MemoryRouter wrap pattern | grep `<Outlet\b` in plan = Layout.tsx; grep `useNavigate\(\)` in plan = HeroContent; grep `<Link to=` in plan = NavBar+HeroContent+Pricing | ✅ |
| 4 | MemoryRouter wrap 在所有 router-hook 测试中显式声明 | 7 test files (1 baseline NavBar + 5 new HeroContent+Pages + 1 modified NavBar) 都要有 MemoryRouter | ✅ |
| 5 | Stub-then-real 模式在 T08/T21a/T21b 清晰 | grep plan: T08a 创建 stub 后 T08b 注册; T21a 创建 About 后 T21b 注册 | ✅ |
| 6 | Test count math 修正: 实际 50 = 30 + 1 NotFound + 2 Home + 3 NavBar new + 4 About + 5 Predict + 5 Pricing | T26 和 T30 内已自我披露 | ✅ |
| 7 | 所有现行 promise（L272-L332 Marketing / L250-260 CTA ban / L402-410 Copywriting）逐条贯穿 | Global Constraints 列出 19 条 verbatim | ✅ |
| 8 | 全 34 task 都按原子级（~30 LOC diff，2-5min step） | 每个 Step 1-5 是独立动作 | ✅ |
| 9 | Conventional Commit 格式贯穿（feat/fix/refactor/test/docs/chore(scope): subject） | grep plan: 全部 commit message 包含 type(scope): | ✅ |
| 10 | apps/api/ Hono Workers 在 Untouched Files 列出 | ✅ (File Structure section) | ✅ |

**Self-review verdict: PLAN COMPLETE.** 全部 10 项通过。无 placeholder 无 contradiction。

---

# Plan Filename and Save Location

**File**: `docs/superpowers/plans/2026-07-24-qizai-v013b1-multiroute-spa.md` (just saved)
**Spec Base Commit**: `ab85937` (spec round-2+3 audit final)
**Plan Total Tasks**: 34 (含 T08a/T08b + T21a/T21b sub-task splits)
**Expected Final State**:
- 62 tests pass (50 React + 13 shell, +1 from spec baseline due to NotFound re-count audit correction)
- Typecheck clean
- Lint clean (B.1 adds `pnpm lint` to PreCommit gate)
- Build clean (CF Pages dist with `_redirects` SPA fallback)
- CHANGELOG entry inserted v0.13.B.1

---

# Execution Handoff (per writing-plans skill)

**Plan complete and saved. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration with isolated context per implementer. Best for this plan: 34 atomic tasks, each independently testable.

**2. Inline Execution** - Execute tasks in this session using executing-plans skill, batch execution with checkpoints. Faster for very small tasks but mixes contexts.

Which approach?
