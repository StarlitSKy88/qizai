# qizai v0.13.B.2 Brand SVG — Spec

> **For agentic workers:** Brainstormed design, not yet an implementation plan. After user review, invoke `superpowers:writing-plans` to produce the TDD plan.

**Goal:** Replace 3 placeholder Globe icons in `SocialFooter.tsx` with real brand SVG marks for 小红书 / 抖音 / B站, with build-time pre-download + runtime CDN fallback to globe placeholder.

**Architecture:** 3-layer separation:
- `constants/socials.ts` is the single source of truth for platform config (label, local path, CDN URL).
- `scripts/fetch-social-svgs.sh` runs at predev/prebuild to fetch SVGs from simple-icons via jsdelivr and inject `fill="currentColor"`.
- `SocialFooter.tsx` becomes a thin assembler; new `SocialIconButton.tsx` owns the `<img>` + onError → Globe fallback logic.

**Tech Stack:** Vite 5 + React 18 + TypeScript 5.6 strict + Tailwind 3 + lucide-react (unchanged from v0.13.A). Bash + curl + sed for build-time fetch (zero new npm deps).

## 一、Scope

**In:**
1. 3 Chinese social platform brand SVGs replacing Globe icons.
2. Build-time pre-download from simple-icons (CDN: jsdelivr).
3. Runtime CDN fallback to lucide Globe if local SVG fails to load.
4. Mono currentColor: SVG color follows button text color on hover.
5. SHell test (6) + React test (3 new) added, total tests 27 → 33.

**Out:**
- No react-router, no new npm deps, no CSS changes.
- No other component modifications (NavBar / HeroContent / VideoBackground untouched).
- No real backend URLs or platform deep-links (buttons are visual placeholders for v0.13.B.1 wiring).

## 二、User-facing behavior

On the homepage hero, the bottom-center social row renders 3 round liquid-glass buttons. Each button shows the platform's logo (mono color, controlled by `text-white/80`/`hover:text-white` classes inherited from the `<button>`). If a local SVG fails to load (CDN outage, build-time fetch failed), the button falls back to a generic Globe icon and `console.warn` fires so developers notice.

Visual target:

```
        (小红书)   (抖音)   (B站)
        [logo]    [logo]    [logo]      ← 20px, liquid-glass, mono
```

## 三、Tech stack and rationale

| Choice | Why |
|--------|-----|
| Build-time fetch (predev/prebuild) | Mirrors v0.13.B.3 video-localize; offline dev still works after first download. |
| simple-icons via jsdelivr | CC0 brand icons; jsdelivr free edge; no API key. |
| `<img>` + onError (not inline `<svg>`) | Encapsulates per-button fallback state; no need to inline 3 large path strings in JSX. |
| lucide-react Globe fallback | Already in deps; visible placeholder; same icon family. |
| Mono currentColor | Visual weight matches v0.13.A; CSS hover controls icon color; spec §六 神 copy verbatim. |
| Tailwind 3 verbatim (`liquid-glass rounded-full p-4 text-white/80 hover:text-white hover:bg-white/5 transition-all`) | v0.13.A spec §六.1 button style 1:1 carry. |

## 四、File structure

```
apps/web/
├── public/
│   ├── _headers                        ← MODIFY: append /socials/* immutable
│   └── socials/                        ← NEW (gitignored): xiaohongshu.svg, douyin.svg, bilibili.svg
├── src/
│   ├── components/
│   │   ├── SocialFooter.tsx            ← REWRITE (~30 lines): thin assembler
│   │   └── SocialIconButton.tsx        ← NEW (~50 lines): img + onError → Globe
│   └── constants/
│       └── socials.ts                  ← NEW (~30 lines): SOCIALS array
├── test/
│   ├── components/
│   │   └── SocialFooter.test.tsx       ← MODIFY: keep 3 existing + add 3 new (total 6)
│   └── scripts/
│       └── fetch-social-svgs.test.sh   ← NEW (~80 lines): 6 shell tests
├── .gitignore                          ← MODIFY: append apps/web/public/socials/
└── package.json                        ← MODIFY: predev + prebuild hooks

scripts/
└── fetch-social-svgs.sh                ← NEW (~50 lines, executable)
```

## 五、Technical details

### 5.1 scripts/fetch-social-svgs.sh

- Reads `cdfnSvgUrl` values from `apps/web/src/constants/socials.ts` (single source of truth — no hardcoded URLs in shell).
- For each URL:
  - Idempotency: skip if local file exists AND mtime < 1 day (refresh only after 24h).
  - `curl --fail --silent --show-error --location "$url" -o "$out.tmp"` — fail-fast on 4xx/5xx.
  - `sed -i.bak -E 's/fill="#[0-9A-Fa-f]+"/fill="currentColor"/g; s/fill="rgb\([^)]+\)"/fill="currentColor"/g'` — inject mono color.
  - WARN if substitution didn't catch (raw passthrough fallback).
- `mkdir -p apps/web/public/socials` before loop.
- Exits 0 on partial failures (WARN stderr) — predev/prebuild must not block dev startup.
- `set -euo pipefail` strict, except inner `curl` block uses `||` for graceful degradation.

### 5.2 apps/web/src/constants/socials.ts

```typescript
export interface SocialPlatform {
  readonly id: 'xiaohongshu' | 'douyin' | 'bilibili';
  readonly label: string;
  readonly localSvgPath: string;
  readonly cdnSvgUrl: string;
}

export const SOCIALS: readonly SocialPlatform[] = [
  { id: 'xiaohongshu', label: '小红书',
    localSvgPath: '/socials/xiaohongshu.svg',
    cdnSvgUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/xiaohongshu.svg' },
  { id: 'douyin',      label: '抖音',
    localSvgPath: '/socials/douyin.svg',
    cdnSvgUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/douyin.svg' },
  { id: 'bilibili',    label: 'B站',
    localSvgPath: '/socials/bilibili.svg',
    cdnSvgUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/bilibili.svg' },
] as const;
```

### 5.3 apps/web/src/components/SocialIconButton.tsx

```typescript
import { useState } from 'react';
import { Globe } from 'lucide-react';
import type { SocialPlatform } from '../constants/socials';

interface Props {
  readonly platform: SocialPlatform;
}

export function SocialIconButton({ platform }: Props) {
  const [fallback, setFallback] = useState(false);

  return (
    <button
      aria-label={platform.label}
      className="liquid-glass rounded-full p-4 text-white/80 hover:text-white hover:bg-white/5 transition-all"
    >
      {fallback ? (
        <Globe size={20} aria-hidden="true" />
      ) : (
        <img
          src={platform.localSvgPath}
          alt=""                              /* aria-label provided by parent <button> */
          width={20}
          height={20}
          onError={() => {
            console.warn(`[socials] ${platform.id} local SVG failed; falling back to Globe`);
            setFallback(true);
          }}
        />
      )}
    </button>
  );
}
```

### 5.4 apps/web/src/components/SocialFooter.tsx (REWRITE)

```typescript
import { SOCIALS } from '../constants/socials';
import { SocialIconButton } from './SocialIconButton';

export default function SocialFooter() {
  return (
    <div className="relative z-10 flex justify-center gap-4 pb-12">
      {SOCIALS.map((platform) => (
        <SocialIconButton key={platform.id} platform={platform} />
      ))}
    </div>
  );
}
```

### 5.5 apps/web/public/_headers (append)

```
/videos/hero.mp4
  Cache-Control: public, max-age=31536000, immutable

/socials/*
  Cache-Control: public, max-age=31536000, immutable
```

## 六、Tests

### 6.1 test/components/SocialFooter.test.tsx

Existing 3 tests (verbatim carry from v0.13.A):
- ✅ renders 3 buttons with aria-labels 小红书/抖音/B站
- ✅ each button has `liquid-glass rounded-full p-4 ...` class
- ✅ wrapper has `pb-12` and `flex justify-center gap-4`

New 3 tests:
- ✅ renders 3 `<img>` tags with `src=/socials/{xiaohongshu,douyin,bilibili}.svg` (not Globe icons initially)
- ✅ each `<img>` onError → renders Globe SVG (lucide-globe) — uses `fireEvent.error` and `querySelectorAll('svg.lucide-globe')`
- ✅ after fallback, all 3 aria-labels (小红书/抖音/B站) still readable

### 6.2 test/scripts/fetch-social-svgs.test.sh

6 shell tests:
1. ✅ outputs 3 SVG files in `apps/web/public/socials/`
2. ✅ each SVG contains `fill="currentColor"` (mono color override)
3. ✅ idempotency: second run within 24h does not re-fetch (mtime unchanged)
4. ✅ CDN unreachable → script exits 0 (graceful degradation), partial output allowed
5. ✅ no `.tmp` files left after run
6. ✅ each output SVG is valid XML (`xmllint --validate`)

Test scaffolding uses existing `apps/web/test/scripts/fetch-video.test.sh` patterns from v0.13.B.3 (a699ec2's style).

## 七、Task decomposition (high-level preview, plan will detail TDD steps)

| Task | Files | Test |
|------|-------|------|
| Task 1 | `constants/socials.ts` | TS type-check only (no runtime test) |
| Task 2 | `scripts/fetch-social-svgs.sh` + `test/scripts/fetch-social-svgs.test.sh` | 6 shell tests pass |
| Task 3 | `components/SocialIconButton.tsx` | unit test inline (covered in Task 4) |
| Task 4 | `components/SocialFooter.tsx` REWRITE + `test/components/SocialFooter.test.tsx` | 3 existing + 3 new = 6 React tests pass |
| Task 5 | `package.json` `predev/prebuild` + `.gitignore` + `_headers` | build verification: dist/socials/*.svg + dist/_headers present |
| Task 6 | full re-build + offline dev + git status + CHANGELOG | 33 tests pass, 6 shell tests pass, typecheck clean |

## 八、Global constraints

- **27 tests baseline** must continue to pass (after change → 33).
- **6 shell tests** for fetch-social-svgs.sh must pass.
- **6/6 typecheck clean** (TS 5.6 strict).
- **Vite build** must copy `public/socials/*.svg` to `dist/socials/`.
- **CF Pages _headers** must include `/socials/*` immutable.
- **lucide-react Globe** is the runtime fallback; never removed from imports.
- **`fill="currentColor"`** must be injected at build time, not runtime (avoids per-render work).
- **no npm dependencies added** — bash + curl + sed only.
- **no component changes outside SocialFooter + SocialIconButton** (verbatim Carry preserved).
- **CHANGELOG.md v0.13.B.2 entry** synced on merge.

## 九、ADR (architectural decision records)

### ADR-001: simple-icons as canonical brand SVG source

- **Decision:** Use SVG paths verbatim from [simple-icons](https://simpleicons.org/) via jsdelivr CDN.
- **Rationale:** CC0-licensed, maintained by community, covers all 3 platforms (xiaohongshu, douyin, bilibili) since v13+.
- **Risk:** simple-icons may rename / remove platforms; mitigated by 24h cache + CDN fallback.
- **Reversibility:** swap CDN URL + recommit; non-breaking change.

### ADR-002: Build-time fetch + runtime `<img>` fallback

- **Decision:** predev/prebuild fetches once, runtime `<img>` references local path with onError fallback.
- **Rationale:** Mirrors v0.13.B.3 video-localize pattern (consistency); offline dev works; CF Pages asset is self-contained.
- **Risk:** Build-time fetch fails → user site has 3 Globe icons (not visually broken, just placeholder).
- **Reversibility:** fallback is automatic; spec §五 graceful degradation complete.

### ADR-003: `<img>` not inline `<svg>` for brand icons

- **Decision:** Use `<img src="/socials/*.svg">` instead of inline `<svg>` JSX.
- **Rationale:** Encapsulates per-button fallback state cleanly with `<img>` onError. Inline `<svg>` would require inlining 3 large path strings and a fragment-of-conditional rendering that complicates tests.
- **Risk:** `<img>` cannot inherit `fill="currentColor"` from CSS → button hover color requires CSS filter workaround if brand color desired.
- **Workaround (acceptable for mono):** v0.13.B.2 brand icons are mono (white-on-glass), so currentColor injection at build time gives correct hover behavior because SVG `fill="currentColor"` is set in the source file.
- **Reversibility:** v0.14+ can switch to inline JSX if multi-color brand marks are needed.

## 十、Open Questions resolved

- **Q1 source:** simpleicons.org 内嵌路径 (user confirmed)
- **Q2 offline:** 预下载但运行时仍 CDN (user confirmed)
- **Q3 color:** Mono currentColor (user confirmed)
- **Q4 render:** 混合：CDN 失败则 fallback local (user confirmed)
- **Q5 ingestion:** build-time 自动生成 (user confirmed)
- **Q6 degrade:** 静态 fallback：返回 Globe (user confirmed)
- **Q7 size:** 20px lucide 原始 (user confirmed)
- **Q8 tests:** 按需追加 3 测试 (user confirmed)
- **Q9 scope:** 仅 3 个中国平台 (user confirmed)
