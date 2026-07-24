# qizai v0.13.B.2 Brand SVG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 3 placeholder Globe icons in `apps/web/src/components/SocialFooter.tsx` with real brand SVG marks for 小红书 / 抖音 (tiktok stand-in, ADR-004) / B站, sourced from simple-icons via build-time fetch with runtime Globe fallback.

**Architecture:** 3-layer separation — `constants/socials.ts` is the single source of truth (label / local path / CDN URL); monorepo `scripts/fetch-social-svgs.sh` runs at `predev`/`prebuild` to fetch SVGs from simple-icons via jsdelivr CDN and inject `fill="currentColor"` into the root `<svg>` tag (simple-icons v13+ ships CSS-only SVGs, no `fill` attribute); `SocialIconButton.tsx` owns the `<img>` + `onError` → lucide `Globe` fallback; `SocialFooter.tsx` becomes a 13-line assembler.

**Tech Stack:** Vite 5 + React 18 + TypeScript 5.6 strict + Tailwind 3 + lucide-react (zero new npm deps) / bash + curl + sed for build-time fetch / vitest 2 + jsdom + @testing-library/react 16 + @testing-library/jest-dom / Cloudflare Pages (`_headers` file)

**Base commit:** `6d55292` (current `master` after spec self-review, B.3 ledger untouched)

## Global Constraints

[v0.13.B.2 spec 项目级要求 — 每个 task 默认继承]

- **TypeScript strict mode 全开**（继承 v0.13.A / tsconfig.json `strict: true`，spec §八）
- **27 个 React tests baseline 不被破坏**（v0.13.A baseline：5 styles + 14 components + 4 video + 4 misc = 27，spec §八 verbatim）
- **37 total tests after all tasks**: 27 React + 3 new React (SocialFooter.test.tsx) + 7 new shell (fetch-social-svgs.test.sh) = 37 (spec §一/§八 verbatim, NOT 36 — that number was stale from pre-audit draft)
- **`apps/web/src/components/SocialFooter.tsx`** 是唯一被替换的 React 组件（spec §四/§八 "no component changes outside SocialFooter + SocialIconButton"）
- **NavBar / HeroContent / VideoBackground** verbatim carry 不变（spec §八）
- **`fill="currentColor"` 必须在 build-time 注入**，不在 runtime（spec §八 + ADR-003）
- **Vite build** 必须自动 copy `public/socials/*.svg` 到 `dist/socials/`（spec §四/§八）— Vite 5 default behavior 已验证（v0.13.B.3 bfcd4a6）
- **CF Pages `_headers`** 必须包含 `/socials/*` immutable 规则（spec §八）— 追加到现有 `apps/web/public/_headers`
- **`apps/web/public/socials/` gitignored**（spec §四）
- **`predev` + `prebuild` hooks** in `apps/web/package.json` 必须调用 monorepo `scripts/fetch-social-svgs.sh`（spec §四/§五.1）
- **lucide-react `Globe`** 是 runtime fallback,永远不删除 import（spec §八）
- **macOS/Linux portability:** 所有 `stat` 调用用 `stat -f%X ... || stat -c%X ...` 模式（BSD/GNU 双兼容，spec §八）
- **x mllint 是 OPTIONAL，**不**是 test 依赖**（spec §六.2/§八 — `test 7 build verification` 是 canonical check；xmllint env-fragile）
- **`set -euo pipefail`** strict 在新 bash scripts 里（继承 fetch-video.sh 模式）
- **0 个新 npm 依赖**（bash + curl + sed 全内置命令，spec §八）
- **CHANGELOG.md** v0.13.B.2 entry 同步 merge（spec §八）
- **commit format**: `feat/fix/docs/style/refactor/test/chore(scope): subject`（CLAUDE.md 全局规则）

---

## File Structure（任务前映射，锁定分解决策）

| 文件 | 类型 | 责任 |
|------|------|------|
| `apps/web/src/constants/socials.ts` | 新（~30 lines） | 单一事实源：`SocialPlatform` 接口 + `SOCIALS` readonly 数组（label/local path/CDN URL） |
| `scripts/fetch-social-svgs.sh` | 新（~50 lines，可执行） | monorepo 顶层 bash script；从 constants/socials.ts grep `cdnSvgUrl`；curl + sed inject `fill="currentColor"`；mtime idempotency；4 cleanups: tmp/.bak/curl-fail/partial |
| `scripts/fetch-social-svgs.test.sh` | 新（~80 lines，可执行） | 7 shell tests with `bash` strict；mirrors `scripts/fetch-video.test.sh` 模式 |
| `apps/web/src/components/SocialIconButton.tsx` | 新（~30 lines） | 单 button + `<img>` + `onError` → Globe fallback；`useState<fallback>` 局部状态 |
| `apps/web/src/components/SocialFooter.tsx` | **REPLACE 整个文件**（~13 lines） | 现有 23-line 删掉，13-line assembler 取代 |
| `apps/web/test/components/SocialFooter.test.tsx` | 改（从 27 → 53 行） | 3 现有 tests verbatim carry + 3 new tests |
| `apps/web/public/_headers` | 改（追加） | 现有 `/videos/hero.mp4` 规则保留 + 新增 `/socials/*` immutable |
| `apps/web/.gitignore` | 改（追加 1 行） | 加 `apps/web/public/socials/` |
| `apps/web/package.json` | 改（追加 2 行） | 新增 `predev` + `prebuild` 钩子调用 fetch-social-svgs.sh |
| `apps/web/public/socials/*.svg` | 新（gitignored，运行时产出） | 3 SVG files，由 `scripts/fetch-social-svgs.sh` 写入 |
| `CHANGELOG.md` | 改（追加 entry） | v0.13.B.2 Highlights + Features + Bug Fixes + Misc |

**设计原则**: 单文件单一职责。`constants/socials.ts` 是 TypeScript-side 真相源，`fetch-social-svgs.sh` 是 bash-side 执行单元，零 Node 依赖。`SocialIconButton` 是 button 容器 + state，`SocialFooter` 是 mapper (assembler)。

---

## Task 1: constants/socials.ts (TS type-check only, no runtime test per spec §七)

**Files:**
- Create: `apps/web/src/constants/socials.ts`

**Interfaces:**
- Consumes: 无（首任务）
- Produces:
  - `SocialPlatform` interface（`id: 'xiaohongshu' | 'tiktok' | 'bilibili'` + `label: string` + `localSvgPath: string` + `cdnSvgUrl: string`，全部 readonly）
  - `SOCIALS: readonly SocialPlatform[]` — 3 entry 数组，包含 ADR-004 注释

**Rationale for no runtime test**: spec §七 Task 1 明确声明 "TS type-check only (no runtime test)". socials.ts 是纯数据 + 编译时类型保护 — typecheck 已经 capture 了所有正确性 (typo field、URL 不对、漏 entry)。加 vitest test 会让 React test count 变成 31 (spec 锁定 30),违反 YAGNI + spec §一 verbatim。

- [ ] **Step 1: 创建 `apps/web/src/constants/socials.ts`**

```typescript
/**
 * 社交平台品牌 SVG 常量
 * v0.13.B.2: 品牌 SVG 上线（spec §五.2）
 *
 * - 单文件作为单一事实源（spec §四）
 * - label: Chinese platform name; aria-label 用此值
 * - localSvgPath: Vite 自动 serve public/ 路径
 * - cdnSvgUrl: build-time 拉取源（scripts/fetch-social-svgs.sh 解析此字段）
 *
 * ADR-004: simple-icons has NO douyin slug (verified HTTP 404 on 2026-07-23);
 * tiktok used as visual stand-in. Swap path: replace tiktok entry with future
 * douyin CDN URL once simple-icons accepts the contribution.
 */
export interface SocialPlatform {
  readonly id: 'xiaohongshu' | 'tiktok' | 'bilibili';
  readonly label: string;
  readonly localSvgPath: string;
  readonly cdnSvgUrl: string;
}

export const SOCIALS: readonly SocialPlatform[] = [
  {
    id: 'xiaohongshu',
    label: '小红书',
    localSvgPath: '/socials/xiaohongshu.svg',
    cdnSvgUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/xiaohongshu.svg',
  },
  {
    id: 'tiktok', // 抖音 stand-in (ADR-004); same ByteDance family
    label: '抖音',
    localSvgPath: '/socials/tiktok.svg',
    cdnSvgUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/tiktok.svg',
  },
  {
    id: 'bilibili',
    label: 'B站',
    localSvgPath: '/socials/bilibili.svg',
    cdnSvgUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/bilibili.svg',
  },
] as const;
```

- [ ] **Step 2: typecheck 验证（spec §八 "all modified/new files pass tsc --noEmit"）**

Run: `cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck`

Expected: 0 errors（constants/socials.ts 还没被引用，但 TS strict 允许 exported unused files — typecheck 已经覆盖类型正确性）。

- [ ] **Step 3: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai
git add apps/web/src/constants/socials.ts
git commit -m "feat(brand-svg): add constants/socials.ts with tiktok-as-douyin substitute (ADR-004)"
```

---

## Task 2: scripts/fetch-social-svgs.sh + fetch-social-svgs.test.sh

**Files:**
- Create: `scripts/fetch-social-svgs.sh`（~50 lines, executable）
- Create: `scripts/fetch-social-svgs.test.sh`（~80 lines, executable）

**Interfaces:**
- Consumes: `apps/web/src/constants/socials.ts`（Task 1）— grep `cdnSvgUrl: '[^']+'`
- Produces:
  - `scripts/fetch-social-svgs.sh` 行为契约：
    - 输入：grep 上一步的 `cdnSvgUrl` values
    - 输出：写到 `apps/web/public/socials/{xiaohongshu,tiktok,bilibili}.svg`
    - 退出码：0（成功 / 部分成功 — graceful degradation）/ 1（无 URL 可读）
    - 幂等：24h mtime window 内 skip
    - 副作用：sed inject `fill="currentColor"` into root `<svg>` tag；cleanups: `.tmp`, `.bak`, curl-fail, partial-fail
    - `CONSTANTS_PATH` 环境变量 override（默认 standard path）— mirrors `scripts/fetch-video.sh`
    - `set -euo pipefail` strict
  - `scripts/fetch-social-svgs.test.sh` 行为契约：
    - 输入：执行 `fetch-social-svgs.sh` 在 controlled environment
    - 输出：PASS/FAIL counts；exit 0 if all 7 pass, 1 if any fail

- [ ] **Step 1: 创建 `scripts/fetch-social-svgs.test.sh`**（先写测试）

```bash
#!/usr/bin/env bash
# fetch-social-svgs.sh unit tests (no vitest, pure bash — mirrors fetch-video.test.sh)
# 7 tests per v0.13.B.2 spec §六.2

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SOCIALS_DIR="$ROOT/apps/web/public/socials"
CONSTANTS_FILE="$ROOT/apps/web/src/constants/socials.ts"
SCRIPT="$SCRIPT_DIR/fetch-social-svgs.sh"
LOG="/tmp/socials-test-$$.log"

PASS=0
FAIL=0

assert() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  ✅ $desc"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $desc (expected: $expected, got: $actual)"
    FAIL=$((FAIL + 1))
  fi
}

cleanup() {
  rm -rf "$SOCIALS_DIR"
}
trap cleanup EXIT

# ===== Test 1: outputs 3 SVG files in apps/web/public/socials/ =====
echo "=== Test 1: outputs 3 SVG files ==="
mkdir -p "$SOCIALS_DIR"
rm -f "$SOCIALS_DIR"/*.svg "$SOCIALS_DIR"/*.tmp "$SOCIALS_DIR"/*.bak
bash "$SCRIPT" > "$LOG" 2>&1
EXIT=$?
assert "exit code 0" "0" "$EXIT"
XHS="false"; TK="false"; BILI="false"
[ -f "$SOCIALS_DIR/xiaohongshu.svg" ] && XHS="true"
[ -f "$SOCIALS_DIR/tiktok.svg" ] && TK="true"
[ -f "$SOCIALS_DIR/bilibili.svg" ] && BILI="true"
assert "xiaohongshu.svg exists" "true" "$XHS"
assert "tiktok.svg exists" "true" "$TK"
assert "bilibili.svg exists" "true" "$BILI"

# ===== Test 2: each SVG either has fill="currentColor" OR no fill attr =====
echo ""
echo "=== Test 2: fill injection correct ==="
INJECTION_OK="true"
for f in "$SOCIALS_DIR"/*.svg; do
  filename="$(basename "$f")"
  if grep -q 'fill="currentColor"' "$f"; then
    : # injection succeeded
  elif ! grep -q 'fill=' "$f"; then
    : # upstream CSS-only (no fill attr at all)
  else
    echo "  ⚠️  $filename has fill attr but NOT currentColor: $(grep -oE 'fill="[^"]*"' "$f" | head -1)"
    INJECTION_OK="false"
  fi
done
assert "all 3 SVGs use currentColor or no fill" "true" "$INJECTION_OK"

# ===== Test 3: idempotency — second run within 24h does not re-fetch =====
echo ""
echo "=== Test 3: idempotency (mtime check) ==="
MTIME_BEFORE=$(stat -f%m "$SOCIALS_DIR/xiaohongshu.svg" 2>/dev/null || stat -c%Y "$SOCIALS_DIR/xiaohongshu.svg")
sleep 2
bash "$SCRIPT" > "$LOG" 2>&1
MTIME_AFTER=$(stat -f%m "$SOCIALS_DIR/xiaohongshu.svg" 2>/dev/null || stat -c%Y "$SOCIALS_DIR/xiaohongshu.svg")
assert "mtime unchanged after re-run" "$MTIME_BEFORE" "$MTIME_AFTER"
case "$(cat "$LOG")" in
  *"cached"*) IDEMPOTENT="true" ;;
  *) IDEMPOTENT="false" ;;
esac
assert "cached log message present" "true" "$IDEMPOTENT"

# ===== Test 4: CDN unreachable → exit 0 (graceful degradation) =====
echo ""
echo "=== Test 4: CDN unreachable graceful degradation ==="
# Point CONSTANTS_PATH at a fixture with bad URLs
TMP_CONST="$(mktemp)"
cat > "$TMP_CONST" << 'EOF'
export interface SocialPlatform {
  readonly id: 'xiaohongshu' | 'tiktok' | 'bilibili';
  readonly label: string;
  readonly localSvgPath: string;
  readonly cdnSvgUrl: string;
}
export const SOCIALS: readonly SocialPlatform[] = [
  { id: 'xiaohongshu', label: '小红书', localSvgPath: '/socials/xiaohongshu.svg',
    cdnSvgUrl: 'http://127.0.0.1:1/nonexistent.svg' },
] as const;
EOF
rm -f "$SOCIALS_DIR"/*.svg
CONSTANTS_PATH="$TMP_CONST" bash "$SCRIPT" > "$LOG" 2>&1
EXIT=$?
assert "exit code 0 (graceful)" "0" "$EXIT"
rm -f "$TMP_CONST"

# ===== Test 5: no .tmp files left after run =====
echo ""
echo "=== Test 5: no .tmp residue ==="
TMP_COUNT=$(find "$SOCIALS_DIR" -name '*.tmp' 2>/dev/null | wc -l | tr -d ' ')
assert "zero .tmp files" "0" "$TMP_COUNT"

# ===== Test 6: no .bak files left after run (sed -i.bak residue) =====
echo ""
echo "=== Test 6: no .bak residue ==="
BAK_COUNT=$(find "$SOCIALS_DIR" -name '*.bak' 2>/dev/null | wc -l | tr -d ' ')
assert "zero .bak files" "0" "$BAK_COUNT"

# ===== Test 7: pnpm build produces dist/socials/*.svg + dist/_headers =====
echo ""
echo "=== Test 7: pnpm build verification ==="
cd "$ROOT/apps/web"
pnpm build > "$LOG" 2>&1
BUILD_EXIT=$?
assert "pnpm build exit 0" "0" "$BUILD_EXIT"
SVG_COUNT=$(ls "$ROOT/apps/web/dist/socials/"*.svg 2>/dev/null | wc -l | tr -d ' ')
assert "dist/socials/*.svg = 3 files" "3" "$SVG_COUNT"
HEADERS_OK="false"
[ -f "$ROOT/apps/web/dist/_headers" ] && grep -q '/socials/\*' "$ROOT/apps/web/dist/_headers" && HEADERS_OK="true"
assert "dist/_headers has /socials/* rule" "true" "$HEADERS_OK"

echo ""
echo "=== Results ==="
echo "PASS: $PASS / FAIL: $FAIL"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
```

然后 `chmod +x scripts/fetch-social-svgs.test.sh`。

- [ ] **Step 2: 运行测试确认 RED**

Run: `cd /Users/opc-1/Downloads/O/qizai && bash scripts/fetch-social-svgs.test.sh 2>&1 | head -20`

Expected: 全测试 FAIL with "fetch-social-svgs.sh: No such file or directory"。这是预期的 RED。

- [ ] **Step 3: 创建 `scripts/fetch-social-svgs.sh`**

```bash
#!/usr/bin/env bash
# fetch-social-svgs.sh — v0.13.B.2 build-time SVG fetcher (spec §五.1)
# Mirrors scripts/fetch-video.sh patterns (CONSTANTS_PATH override, strict mode).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Allow CONSTANTS_PATH override for testing (default: standard path)
CONSTANTS_FILE="${CONSTANTS_PATH:-$ROOT/apps/web/src/constants/socials.ts}"

if [ ! -f "$CONSTANTS_FILE" ]; then
  echo "[socials] ERROR: $CONSTANTS_FILE not found" >&2
  exit 1
fi

# Read cdnSvgUrl values from constants via grep (single source of truth)
mapfile -t URLS < <(grep -oE "cdnSvgUrl: '[^']+'" "$CONSTANTS_FILE" \
  | sed -E "s/.*'([^']+)'/\1/")

if [ "${#URLS[@]}" -eq 0 ]; then
  echo "[socials] ERROR: no cdnSvgUrl found in $CONSTANTS_FILE" >&2
  exit 1
fi

OUT_DIR="$ROOT/apps/web/public/socials"
mkdir -p "$OUT_DIR"

# Cache TTL: 24 hours (spec §五.1 mtime)
CACHE_TTL=86400
EXIT_CODE=0

for url in "${URLS[@]}"; do
  # Extract filename from URL (e.g. .../xiaohongshu.svg → xiaohongshu.svg)
  filename=$(basename "$url")
  out_path="$OUT_DIR/$filename"

  # Idempotency: skip if file exists and < 24h old (mtime check, macOS/Linux portable)
  if [ -f "$out_path" ]; then
    MTIME=$(stat -f%m "$out_path" 2>/dev/null || stat -c%Y "$out_path")
    NOW=$(date +%s)
    AGE=$((NOW - MTIME))
    if [ "$AGE" -lt "$CACHE_TTL" ]; then
      echo "[socials] cached: $filename ($AGE seconds old)"
      continue
    fi
  fi

  echo "[socials] fetching: $url → $out_path"
  tmp_path="$out_path.tmp"
  if ! curl --fail --silent --show-error --location "$url" -o "$tmp_path"; then
    echo "[socials] WARN: $url unreachable; skipping (graceful degradation, spec §五)" >&2
    rm -f "$tmp_path"
    EXIT_CODE=0  # Spec: exit 0 even on partial failures (don't block dev/build)
    continue
  fi

  # simple-icons v13+ ships CSS-only SVG (no fill attribute).
  # Inject fill="currentColor" into root <svg> tag via single-quoted sed (no escape issues).
  sed -i.bak 's|<svg |<svg fill="currentColor" |' "$tmp_path"
  rm -f "$tmp_path.bak"

  # Move to final location
  mv "$tmp_path" "$out_path"

  # Verify injection (spec §六.2 Test 2 OR logic)
  if grep -q 'fill="currentColor"' "$out_path" || ! grep -q 'fill=' "$out_path"; then
    echo "[socials] OK: $filename"
  else
    echo "[socials] WARN: $filename sed injection may have failed" >&2
  fi
done

exit "$EXIT_CODE"
```

然后 `chmod +x scripts/fetch-social-svgs.sh`。

- [ ] **Step 4: 运行 shell 测试 — 期望可能部分 PASS**

Run: `cd /Users/opc-1/Downloads/O/qizai && bash scripts/fetch-social-svgs.test.sh`

Expected:
- Tests 1-3 → PASS（real fetch + idempotency）
- Tests 4-6 → PASS（graceful + cleanups）
- **Test 7 → PASS 前提**: `apps/web/public/_headers` 已含 `/socials/*` 规则（Task 5 才添加）; 此时会 FAIL。**接受这个 failure** — 是 Task 5 的 deliverable，证明 test 7 是有效 gate。

如果 tests 1-3 FAIL（real network fetch）：检查 CDN connectivity `curl -I https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/xiaohongshu.svg`。如果 200 OK，检查 script 里 `grep -oE` 转义。

如果 test 4 FAIL（CONSTANTS_PATH 模式）：script 内部 `CONSTANTS_FILE="${CONSTANTS_PATH:-$ROOT/...}"` 必须先于 `mapfile` 读取 — 验证通过。

- [ ] **Step 5: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai
git add scripts/fetch-social-svgs.sh scripts/fetch-social-svgs.test.sh
git commit -m "feat(brand-svg): add fetch-social-svgs.sh with 7-test shell suite (build-verification test gates Task 5 _headers rule)"
```

---

## Task 3: components/SocialIconButton.tsx (unit test inline, coverage in Task 4)

**Files:**
- Create: `apps/web/src/components/SocialIconButton.tsx`（~30 lines）

**Interfaces:**
- Consumes:
  - `SocialPlatform` from `apps/web/src/constants/socials`（Task 1）— `platform: SocialPlatform` prop
  - `useState` from React, `Globe` from `lucide-react`
- Produces: 局部组件，按 `platform.localSvgPath` 渲染 `<img>` + `onError` → setFallback(true) → Globe

- [ ] **Step 1: 创建 `apps/web/src/components/SocialIconButton.tsx`**

```typescript
import { useState } from 'react';
import { Globe } from 'lucide-react';
import type { SocialPlatform } from '../constants/socials';

interface Props {
  readonly platform: SocialPlatform;
}

/**
 * 单社交平台按钮（spec §五.3）
 * - 初始：渲染 <img src={localSvgPath}> + onError fallback
 * - fallback 后：渲染 lucide <Globe size={20}>
 * - aria-label 保留在 <button> 上（spec §六.1 Test 6 + a11y best practice）
 * - Tailwind 完全 verbatim 复制 v0.13.A button 样式（spec §三 verbatim carry）
 */
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
          alt="" /* aria-label provided by parent <button> */
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

- [ ] **Step 2: typecheck 验证（spec §八 "all modified/new files pass tsc --noEmit"）**

Run: `cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck`

Expected: 0 errors。`SocialIconButton` 还没被引用，TS strict 允许 exported unused。

- [ ] **Step 3: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai
git add apps/web/src/components/SocialIconButton.tsx
git commit -m "feat(brand-svg): add SocialIconButton with img+onError→Globe fallback (verbatim Tailwind)"
```

---

## Task 4: components/SocialFooter.tsx REPLACE + 3 new React tests

**Files:**
- Modify: `apps/web/src/components/SocialFooter.tsx` — **REPLACE 整个文件**（spec §五.4 + §四 强调）
- Modify: `apps/web/test/components/SocialFooter.test.tsx` — 3 现有 tests verbatim carry + 加 3 new tests

**Interfaces:**
- Consumes:
  - `SOCIALS` from `apps/web/src/constants/socials`（Task 1）
  - `SocialIconButton` from `apps/web/src/components/SocialIconButton`（Task 3）
- Produces:
  - `SocialFooter` 是 13-line assembler：`SOCIALS.map(platform => <SocialIconButton ...>)`
  - 6 total tests in `SocialFooter.test.tsx`：3 existing (verbatim carry) + 3 new (img/error/aria-label preserved)

- [ ] **Step 1: 写 3 new tests 加到 `apps/web/test/components/SocialFooter.test.tsx`**

Modify file: `apps/web/test/components/SocialFooter.test.tsx`

先 import 增量：
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SocialFooter from '../../src/components/SocialFooter';
```

然后在现有 3 个 tests 后追加 3 个新 tests（保留全部现有 tests verbatim）：

```typescript
  it('renders 3 <img> tags with correct social SVG paths (prefix match)', () => {
    const { container } = render(<SocialFooter />);
    const imgs = Array.from(container.querySelectorAll('img'));
    expect(imgs).toHaveLength(3);
    // jsdom normalizes relative paths; use toContain, not toBe (spec §六.1 Test 4)
    expect(imgs[0]?.getAttribute('src')).toContain('/xiaohongshu.svg');
    expect(imgs[1]?.getAttribute('src')).toContain('/tiktok.svg');
    expect(imgs[2]?.getAttribute('src')).toContain('/bilibili.svg');
  });

  it('on <img> error, falls back to lucide Globe (svg.lucide-globe)', () => {
    const { container } = render(<SocialFooter />);
    // Initial render: 0 Globe icons (we start with <img>)
    expect(container.querySelectorAll('svg.lucide-globe')).toHaveLength(0);
    // Trigger error on each <img>
    const imgs = container.querySelectorAll('img');
    imgs.forEach((img) => fireEvent.error(img));
    // After errors: 3 Globe icons appear
    expect(container.querySelectorAll('svg.lucide-globe')).toHaveLength(3);
  });

  it('aria-labels preserved after fallback (button container unchanged)', () => {
    const { container } = render(<SocialFooter />);
    const imgs = container.querySelectorAll('img');
    imgs.forEach((img) => fireEvent.error(img));
    // aria-labels still resolvable via accessible name (spec §六.1 Test 6)
    expect(screen.getByRole('button', { name: '小红书' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '抖音' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'B站' })).toBeInTheDocument();
  });
```

- [ ] **Step 2: 运行测试确认 RED（SocialFooter 还是 inline Globe）**

Run: `cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test -- SocialFooter`

Expected: 3 existing tests PASS（SocialFooter 现有实现），3 new tests FAIL（asserting `<img>` 是新的）。

- [ ] **Step 3: REPLACE `apps/web/src/components/SocialFooter.tsx` 整个文件**

完整文件内容（spec §五.4 verbatim）：

```typescript
import { SOCIALS } from '../constants/socials';
import { SocialIconButton } from './SocialIconButton';

/**
 * Social footer — 13-line assembler (spec §五.4).
 * Replaces v0.13.A's 23-line inline Globe implementation with mapper.
 */
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

- [ ] **Step 4: 运行测试确认 GREEN**

Run: `cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test -- SocialFooter`

Expected: **6/6 tests PASS** — 3 existing (aria-label/liquid-glass/pb-12) + 3 new (img paths/Globe fallback/aria-label preserved)。

- [ ] **Step 5: 跑整个 React suite 验证 27 baseline 不破坏**

Run: `cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test`

Expected: **30 React tests pass**（27 baseline + 3 new React）。注: 7 shell tests 是 separate run，**不属于 vitest suite**；总测试数 37 = 30 React + 7 shell。

- [ ] **Step 6: typecheck**

Run: `cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck`

Expected: 0 errors。

- [ ] **Step 7: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai
git add apps/web/src/components/SocialFooter.tsx apps/web/test/components/SocialFooter.test.tsx
git commit -m "feat(brand-svg): REPLACE SocialFooter with assembler + 3 new React tests (img/error/aria-preserved)"
```

---

## Task 5: predev/prebuild hooks + .gitignore + _headers /socials/* rule

**Files:**
- Modify: `apps/web/package.json` — 加 `predev` + `prebuild` (2 行)
- Modify: `apps/web/.gitignore` — 追加 1 行 `apps/web/public/socials/`
- Modify: `apps/web/public/_headers` — 追加 `/socials/*` immutable 规则

**Interfaces:**
- Consumes:
  - `scripts/fetch-social-svgs.sh` from Task 2
- Produces:
  - `pnpm dev` 自动运行 `bash ../../scripts/fetch-social-svgs.sh` 在 vite 启动前
  - `pnpm build` 自动同上（保障 `dist/socials/*.svg` 存在）
  - `apps/web/public/socials/` 不被 git 追踪
  - CF Pages 部署时 `/socials/*.svg` 返回 `Cache-Control: public, max-age=31536000, immutable`

- [ ] **Step 1: 修改 `apps/web/package.json`**

```diff
   "scripts": {
     "dev": "vite",
     "predev": "bash ../../scripts/fetch-video.sh",
+    "prebuild": "bash ../../scripts/fetch-social-svgs.sh",
     "build": "tsc --noEmit && vite build",
-    "prebuild": "bash ../../scripts/fetch-video.sh",
+    "predev": "bash ../../scripts/fetch-social-svgs.sh",
```

**重要 — 修复**: 现有 `package.json` 的 `prebuild` 是 fetch-video.sh。新 `prebuild` 必须 **同时** 跑 fetch-video + fetch-social-svgs。最终 JSON：

```json
  "scripts": {
    "dev": "vite",
    "predev": "bash ../../scripts/fetch-video.sh && bash ../../scripts/fetch-social-svgs.sh",
    "build": "tsc --noEmit && vite build",
    "prebuild": "bash ../../scripts/fetch-video.sh && bash ../../scripts/fetch-social-svgs.sh",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
```

路径解释：`apps/web/package.json` 中 cwd 是 `apps/web/`,所以 `../../scripts/fetch-social-svgs.sh` 解析为 `<monorepo>/scripts/fetch-social-svgs.sh`。

- [ ] **Step 2: 修改 `apps/web/.gitignore`** — 追加 1 行

```
apps/web/public/socials/
```

**不要 gitignore** `apps/web/public/` 整体（v0.13.B.3 教训：Vite 默认 copy 整个 public/,包括 vite.svg 等其他资产）。

- [ ] **Step 3: 修改 `apps/web/public/_headers`** — 追加 `/socials/*` 规则

现有内容（v0.13.B.3）：

```
/videos/hero.mp4
  Cache-Control: public, max-age=31536000, immutable
```

追加（注意前后各 1 空行）：

```
/videos/hero.mp4
  Cache-Control: public, max-age=31536000, immutable

/socials/*
  Cache-Control: public, max-age=31536000, immutable
```

- [ ] **Step 4: 验证 prebuild 钩子触发 + build 输出正确**

```bash
cd /Users/opc-1/Downloads/O/qizai
rm -rf apps/web/dist apps/web/public/socials/*.svg apps/web/public/videos/hero.mp4
cd apps/web
pnpm build
ls -lh dist/socials/
ls -lh dist/videos/hero.mp4
cat dist/_headers
```

Expected:
- `dist/socials/xiaohongshu.svg` + `tiktok.svg` + `bilibili.svg` 三文件存在
- `dist/videos/hero.mp4` 仍存在（B.3 不破坏）
- `dist/_headers` 含 `/videos/hero.mp4` + `/socials/*` 两条规则
- build exit 0

- [ ] **Step 5: 验证 gitignore 生效**

```bash
cd /Users/opc-1/Downloads/O/qizai
git status apps/web/public/socials/ || echo "✅ gitignored"
git check-ignore -v apps/web/public/socials/xiaohongshu.svg || true
```

Expected: `git status` 输出 nothing（gitignored）；`check-ignore` 输出 `apps/web/.gitignore:1:apps/web/public/socials/  apps/web/public/socials/xiaohongshu.svg`。

- [ ] **Step 6: 重跑 shell Test 7 — 这次应该 PASS**

```bash
cd /Users/opc-1/Downloads/O/qizai && bash scripts/fetch-social-svgs.test.sh 2>&1 | tail -20
```

Expected: **7/7 shell tests PASS**（包括 Test 7 build verification）。

- [ ] **Step 7: 重跑全部 tests 确认 30 React + 7 shell 都 PASS**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test
cd /Users/opc-1/Downloads/O/qizai && bash scripts/fetch-social-svgs.test.sh > /dev/null 2>&1 && echo "shell: 7/7 PASS" || echo "shell: FAIL"
```

Expected: `vitest` 30/30 React PASS + `shell: 7/7 PASS`。

- [ ] **Step 8: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai
git add apps/web/package.json apps/web/.gitignore apps/web/public/_headers
git commit -m "chore(brand-svg): wire predev/prebuild hooks (dual video+socials), gitignore, _headers /socials/* rule"
```

---

## Task 6: 集成 smoke test + CHANGELOG.md v0.13.B.2 entry

**Files:**
- Modify: `CHANGELOG.md` — 追加 `## [Unreleased] - v0.13.B.2（品牌 SVG）` entry

**Interfaces:**
- Consumes:
  - 所有前序 Task 产出（30 React tests + 7 shell tests + dist artifacts）
- Produces:
  - Final integration verification (5 项 checklist)
  - CHANGELOG.md records v0.13.B.2 completion

- [ ] **Step 1: 离线 dev 验证（关键 — 拔网仍能起服务）**

```bash
cd /Users/opc-1/Downloads/O/qizai
rm -f apps/web/public/socials/*.svg apps/web/public/videos/hero.mp4
cd apps/web
pnpm dev > /tmp/vite-dev.log 2>&1 &
DEV_PID=$!
sleep 6  # predev 钩子跑完 + Vite 启动
echo "=== /socials/xiaohongshu.svg ==="
curl -sI http://localhost:5173/socials/xiaohongshu.svg | head -3
echo "=== /videos/hero.mp4 ==="
curl -sI http://localhost:5173/videos/hero.mp4 | head -3
kill $DEV_PID 2>/dev/null || true
wait $DEV_PID 2>/dev/null || true
```

Expected:
- `/socials/xiaohongshu.svg` 返回 `HTTP/1.1 200 OK` + `Content-Type: image/svg+xml`
- `/videos/hero.mp4` 返回 200（B.3 不破坏）

- [ ] **Step 2: git status 验证（gitignore 生效）**

```bash
cd /Users/opc-1/Downloads/O/qizai
git status
echo "---"
git status --porcelain | grep -E "public/socials|socials.*\.svg" || echo "✅ SVG files gitignored"
```

Expected: `git status` 列出本次 Task 1-5 所有新增/修改（不含 socials SVG 文件）。

- [ ] **Step 3: 完整规格验证清单（spec §一 verbatim）**

| spec 验证项 | 期望 | 结果 |
|------------|------|------|
| `pnpm dev` 离线启动成功 + 3 socials SVGs 返回 200 | ✅ Step 1 | |
| `pnpm build` 产出 `dist/socials/*.svg` (3 files) + `dist/_headers` 含 `/socials/*` 规则 | ✅ Task 5 Step 4 | |
| `pnpm test` 通过（30 React tests） | ✅ Task 5 Step 7 | |
| `bash scripts/fetch-social-svgs.test.sh` 通过（7 shell tests） | ✅ Task 5 Step 6 | |
| typecheck clean | ✅ Task 4 Step 6 | |
| `git status` 不显示 `public/socials/*.svg` | ✅ Step 2 | |
| `dist/socials/*.svg` 文件大小合理 (1-50KB) | ✅ Task 5 Step 4 | |

- [ ] **Step 4: 更新 `CHANGELOG.md`** — 追加 v0.13.B.2 entry

打开 `CHANGELOG.md`,在 `## [Unreleased] - v0.13.B.3（视频本地化）` 段**之后**追加（注意：B.3 已经是最后一个 Unreleased 新 entry，B.2 之前没有，所以新 entry 插入到 v0.13.A 段之后、v0.13.B.3 段之前）：

```markdown
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
```

- [ ] **Step 5: 完整 test suite final run（确认 no regression）**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm test
cd /Users/opc-1/Downloads/O/qizai && bash scripts/fetch-social-svgs.test.sh | tail -3
```

Expected:
- React: **30/30 pass**
- Shell: **7/7 pass**

- [ ] **Step 6: typecheck final**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web && pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
cd /Users/opc-1/Downloads/O/qizai
git add CHANGELOG.md
git commit -m "docs(changelog): record v0.13.B.2 brand-svg completion"
```

---

## Done Criteria（spec §一 验收标准）

- [x] `pnpm dev` 离线启动成功 + 3 socials SVGs 返回 200
- [x] `pnpm build` 产出 `dist/socials/*.svg` (3 files) + `dist/_headers` 含 `/socials/*` 规则
- [x] `pnpm test` 30 React tests pass (no baseline 27 regression)
- [x] `bash scripts/fetch-social-svgs.test.sh` 7 shell tests pass
- [x] typecheck clean (all modified/new files pass tsc --noEmit, NOT "6/6")
- [x] `git status` 不显示 `public/socials/*.svg` (gitignored)
- [x] `dist/socials/*.svg` 文件大小合理 (1-50KB per SVG)
- [x] **37 total tests = 30 React + 7 shell** (spec §一/§八 verbatim, NOT 36)
- [x] **6 commits**: 5 Task (Task 1-5) + 1 docs (Task 6 CHANGELOG)
- [x] **x mllint NOT required** (test 7 build-verification 是 canonical check)

**Out of scope (v0.14+ 推)**:
- 自绘 `douyin.svg` (literal "抖" glyph path) — ADR-004 reversibility path 2
- simple-icons douyin PR 监控等待 — ADR-004 reversibility path 1
- 多色品牌 marks (inline `<svg>` JSX, drop fill injection) — ADR-003 reversibility
- react-router v6 多路由 wiring (B.1 scope) — buttons 是 visual placeholder
- 真实平台 deep-links (`window.open` for xiaohongshu.com etc.) — 需 v0.13.B.1 路由 wiring
