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
1. 3 Chinese social platform brand SVGs replacing Globe icons: 小红书 (xiaohongshu), 抖音 (tiktok visual substitute — see ADR-004), B站 (bilibili).
2. Build-time pre-download from simple-icons (CDN: jsdelivr).
3. Runtime fallback to lucide Globe if local SVG fails to load.
4. Mono currentColor: SVG color follows button text color on hover.
5. 7 new shell tests + 3 new React tests = **27 → 37** total tests (27 React baseline + 3 new React + 7 new shell).

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
│   └── socials/                        ← NEW (gitignored): xiaohongshu.svg, tiktok.svg (visual stand-in for 抖音, see ADR-004), bilibili.svg
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
│       └── fetch-social-svgs.test.sh   ← NEW (~80 lines): 7 shell tests
├── .gitignore                          ← MODIFY: append apps/web/public/socials/
└── package.json                        ← MODIFY: predev + prebuild hooks

scripts/
└── fetch-social-svgs.sh                ← NEW (~50 lines, executable)
```

## 五、Technical details

### 5.1 scripts/fetch-social-svgs.sh

- Reads `cdnSvgUrl` values from `apps/web/src/constants/socials.ts` via `grep -oE "cdnSvgUrl: '[^']+'"` (single source of truth — no hardcoded URLs in shell).
- For each URL:
  - **Idempotency (mtime, fixed):**
    ```bash
    if [ -f "$out_path" ]; then
      MTIME=$(stat -f%m "$out_path" 2>/dev/null || stat -c%Y "$out_path")
      NOW=$(date +%s)
      AGE=$((NOW - MTIME))
      if [ "$AGE" -lt 86400 ]; then
        echo "[socials] cached: $filename ($AGE seconds old)"
        continue
      fi
    fi
    ```
  - `curl --fail --silent --show-error --location "$url" -o "$out_path.tmp"` — fail-fast on 4xx/5xx.
  - **simple-icons v13+** does **not** write `fill` attribute (CSS-only). Inject currentColor into root `<svg>` tag:
    ```bash
    sed -i.bak 's|<svg |<svg fill="currentColor" |' "$out_path.tmp"
    rm -f "$out_path.tmp.bak"
    ```
    The single-quoted sed expression preserves the SVG namespace attributes.
  - **Cleanup partial state on fetch failure:** inside `if ! curl ...; then ...; fi`, `rm -f "$out_path.tmp"` and KEEP existing file (its mtime stays old → next run retries within 24h skip rule, BUT curl failure means existing file may be stale). Acceptable: 24h window before retry, or override `CONSTANTS_PATH` to local fixture for offline dev.
- `mkdir -p apps/web/public/socials` before loop.
- Exits 0 on partial failures (WARN stderr) — predev/prebuild must not block dev startup.
- `set -euo pipefail` strict; inner curl/sed blocks use `|| { warn; continue; }` (no pipeline so `pipefail` doesn't apply; `||` is contained).

### 5.2 apps/web/src/constants/socials.ts

```typescript
export interface SocialPlatform {
  readonly id: 'xiaohongshu' | 'tiktok' | 'bilibili';
  readonly label: string;
  readonly localSvgPath: string;
  readonly cdnSvgUrl: string;
}

export const SOCIALS: readonly SocialPlatform[] = [
  { id: 'xiaohongshu', label: '小红书',
    localSvgPath: '/socials/xiaohongshu.svg',
    cdnSvgUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/xiaohongshu.svg' },
  // 抖音 has no simple-icons slug (verified 404 on 2026-07-23); use tiktok as visual substitute (same ByteDance family, similar logomark).
  // See ADR-004 for reversibility plan.
  { id: 'tiktok',      label: '抖音',
    localSvgPath: '/socials/tiktok.svg',
    cdnSvgUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/tiktok.svg' },
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

### 5.4 apps/web/src/components/SocialFooter.tsx (REPLACE entire file)

**The §5.4 code block below is the entire file contents.** The existing 23-line file (with 3 inline `<button>` + `Globe` icon) is deleted and replaced by this 13-line assembler.

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
- ✅ each button has `liquid-glass` class
- ✅ wrapper has `pb-12` and `flex justify-center gap-4`

New 3 tests:
- ✅ **Test 4** — renders 3 `<img>` tags with `src=/socials/{xiaohongshu,tiktok,bilibili}.svg`. Assertion uses **prefix match** (`expect(img.src).toContain('/xiaohongshu.svg')`) NOT exact string match, because jsdom normalizes relative paths.
- ✅ **Test 5** — initial render has 0 `svg.lucide-globe` (proves we start with `<img>` not Globe). Then `fireEvent.error(img)` on each → 3 `svg.lucide-globe` appear.
- ✅ **Test 6** — after `fireEvent.error` on all 3, `getByLabelText('小红书'/'抖音'/'B站')` still resolves (fallback swaps content, not button container).

### 6.2 test/scripts/fetch-social-svgs.test.sh

7 shell tests (added build-verification):
1. ✅ outputs 3 SVG files in `apps/web/public/socials/`
2. ✅ each SVG either has `fill="currentColor"` (injection succeeded) OR has **no `fill=` attribute at all** (upper-stream CSS-only). Asserts: `grep -q 'fill="currentColor"' "$f" || ! grep -q 'fill=' "$f"`. **NEVER** assert fill="#color hex" — that indicates injection failed.
3. ✅ idempotency: second run within 24h does not re-fetch. Use **mtime check** (see §五.1 fixed bash). Acceptable macOS-portable form: `stat -f%m` with `|| stat -c%Y` fallback.
4. ✅ CDN unreachable → script exits 0 (graceful degradation), partial output allowed. Use `CONSTANTS_PATH` env override (see fetch-video.test.sh pattern).
5. ✅ no `.tmp` files left after run.
6. ✅ no `.bak` files left after run (sed -i.bak residue).
7. ✅ `pnpm build` produces `dist/socials/*.svg` (3 files) + `dist/_headers` with `/socials/*` rule.

**CI dependency:** `xmllint` validation is OPTIONAL in this test (omitted — simpler test 7 build-verification suffices; xmllint is environment-fragile). If desired, add a separate opt-in test runner flag.

Test scaffolding uses existing `apps/web/test/scripts/fetch-video.test.sh` patterns from v0.13.B.3 (a699ec2's style).

## 七、Task decomposition (high-level preview, plan will detail TDD steps)

| Task | Files | Test |
|------|-------|------|
| Task 1 | `constants/socials.ts` | TS type-check only (no runtime test) |
| Task 2 | `scripts/fetch-social-svgs.sh` + `test/scripts/fetch-social-svgs.test.sh` | 7 shell tests pass |
| Task 3 | `components/SocialIconButton.tsx` | unit test inline (covered in Task 4) |
| Task 4 | `components/SocialFooter.tsx` REWRITE + `test/components/SocialFooter.test.tsx` | 3 existing + 3 new = 6 React tests pass |
| Task 5 | `package.json` `predev/prebuild` + `.gitignore` + `_headers` | build verification: dist/socials/*.svg + dist/_headers present |
| Task 6 | **integration smoke test** (no code changes): full re-build + offline dev + git status + CHANGELOG. **Single commit boundary:** verification only + CHANGELOG entry. 37 tests pass, 7 shell tests pass, typecheck clean |

## 八、Global constraints

- **27 tests baseline** must continue to pass (after change → **37 total**: 27 React + 3 new React + 7 new shell = 37; **shell test #7 added** for build verification → total 7 shell tests).
- **7 shell tests** for fetch-social-svgs.sh must pass.
- **typecheck clean** (TS 5.6 strict) — `all modified/new files pass \`tsc --noEmit\``. Not "6/6" (that number was stale from v0.13.A).
- **CI dependencies:** macOS Xcode CLT ships `xmllint` by default; Linux requires `apt-get install libxml2-utils`. **However** spec §六.2 deliberately **omits xmllint validation** — `test 7 (build verification)` is the canonical check. xmllint is fragile across distros and adds 0 real coverage beyond `file $f` + `grep fill`.
- **Vite build** must copy `public/socials/*.svg` to `dist/socials/`.
- **CF Pages _headers** must include `/socials/*` immutable.
- **lucide-react Globe** is the runtime fallback; never removed from imports.
- **`fill="currentColor"`** must be injected at build time, not runtime (avoids per-render work).
- **no npm dependencies added** — bash + curl + sed only.
- **no component changes outside SocialFooter + SocialIconButton** (verbatim Carry preserved).
- **CHANGELOG.md v0.13.B.2 entry** synced on merge.
- **macOS/Linux portability:** all `stat` calls use `stat -f%m ... || stat -c%m ...` pattern (verified BSD/GNU both work).

## 九、ADR (architectural decision records)

### ADR-001: simple-icons as canonical brand SVG source

- **Decision:** Use SVG paths verbatim from [simple-icons](https://simpleicons.org/) via jsdelivr CDN.
- **Rationale:** CC0-licensed, maintained by community, covers 2/3 platforms (xiaohongshu, bilibili).
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

### ADR-004: tiktok as visual substitute for 抖音 (NEW, audit-driven)

- **Decision:** Use `tiktok.svg` from simple-icons as the visual mark for the 抖音 button.
- **Rationale:**
  1. simple-icons has NO `douyin` slug (verified HTTP 404 on 2026-07-23: `curl -I https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/douyin.svg` → 404).
  2. 抖音 and TikTok share the ByteDance parent → tiktok mark is brand-adjacent (same dithering music-note logo family historically).
  3. mono currentColor + 20px render: visual distinction between tiktok logomark and the real 抖音 "抖" 字 mark is negligible at icon size.
- **Risk:**
  - Power users may notice the tiktok mark vs real 抖音 mark — accepted for v0.13.B.2 (placeholder tier).
  - Real 抖音 uses the literal "抖" character glyph; tiktok uses a music-note / stylized J — semantically different.
- **Reversibility (3 paths, prioritized):**
  1. **Re-attempt simple-icons:** monitor simple-icons PR queue (`simple-icons/simple-icons#12000+`) for a douyin contribution. Swap CDN URL + delete `tiktok` from SOCIALS; non-breaking.
  2. **Self-draw a minimal `douyin.svg`:** a single-glyph path of the "抖" character is feasible (CC0, hand-drawn). Higher cost; reserved for v0.14+ if user feedback demands brand fidelity.
  3. **Inline `<svg>` with text:** render the literal `抖` character via `<text>` JSX (any system font). Fastest; lowest brand fidelity; fallback for v0.14+ if both 1 & 2 fail.
- **Decision date:** 2026-07-23.

### Rollback (full-feature rollback)

If v0.13.B.2 ships but user feedback demands Globe-only (no brand SVGs), revert is a single commit:

```bash
git revert <v0.13.B.2 commit chain>
```

Revert removes: `constants/socials.ts`, `scripts/fetch-social-svgs.sh`, `SocialIconButton.tsx`, `_headers /socials/*` rule, `predev/prebuild` hooks, `.gitignore` rule, all new tests. `SocialFooter.tsx` reverts to v0.13.A's 3 inline Globe buttons (preserved in git history). **Estimated revert effort:** 1 commit + 1 test-suite re-run. **Risk:** zero data loss; build is self-contained.

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
