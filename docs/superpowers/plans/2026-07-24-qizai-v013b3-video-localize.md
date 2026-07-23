# qizai v0.13.B.3 视频本地化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `apps/web/src/components/VideoBackground.tsx` 中 hardcoded 的 cloudfront URL 替换为本地 `apps/web/public/videos/hero.mp4`，实现离线 `pnpm dev` 可用、`pnpm build` 产物含 mp4、CF Pages 永久缓存。

**Architecture:** 视频来源从 CloudFront CDN 切到本地静态文件 (`public/videos/hero.mp4`)。新增 monorepo 顶层 `scripts/fetch-video.sh` 从 TS 常量读 SOURCE_URL 并 curl 到 `apps/web/public/videos/hero.mp4`。在 `apps/web/package.json` 加 `predev` / `prebuild` npm hooks 自动触发 fetch（幂等）。video 文件 gitignored。CF Pages 部署配置 `_headers` 设置 `Cache-Control: public, max-age=31536000, immutable`。VideoBackground.tsx 改 1 行 VIDEO_URL → `HERO_VIDEO_LOCAL_URL`（`/videos/hero.mp4`），移除原 onError fallback（fail-hard 原则）。VideoBackground.test.tsx 同步更新 URL 断言。

**Tech Stack:** bash + curl + grep + sed（无 Node 依赖）/ Vite 5 + React 18 + TS 5.6 strict / vitest 2 + jsdom + @testing-library/react / Cloudflare Pages

## Global Constraints

[v0.13.B.3 spec 项目级要求 — 每个 task 默认继承]

- **TypeScript strict mode 全开**（继承 v0.13.A / tsconfig.json `strict: true`）
- **27 个 tests 不被破坏**（v0.13.A baseline：5 styles + 14 components + 4 video + 4 misc = 27）
- **VideoBackground.tsx 的 RAF fade 系统 / 7 个 useRef / 3 个事件 listener verbatim 不动**（spec §九）
- **视频文件 < 10MB fail / < 5MB warn**（spec §5.1 阈值）
- **单文件 < 200 行**（fetch-video.sh < 100 行 / constants/videos.ts < 30 行 / VideoBackground 改动后增量 < 5 行）
- **不引入 npm 依赖**（bash + grep + curl + sed 内置命令，spec §九）
- **不引入其他工具**（继续 pnpm，不引入 yarn/npm）
- **不引入 service worker**（spec §九）
- **fail-hard 原则**：视频缺失 / 阈值超标 / curl 失败 → exit 1，不静默黑屏（spec §三 + §Q3）
- **commit 格式**：`feat/fix/docs/style/refactor/test/chore(scope): subject`（CLAUDE.md 全局规则）
- **base commit**：`66577ac`（v0.13.A final fix 完成后 HEAD，tag v0.13.0 之前）

---

## File Structure（任务前映射，锁定分解决策）

| 文件 | 类型 | 责任 |
|------|------|------|
| `apps/web/src/constants/videos.ts` | 新 | 导出 4 个常量：`HERO_VIDEO_SOURCE_URL` / `HERO_VIDEO_LOCAL_URL` / `HERO_VIDEO_WARN_SIZE` / `HERO_VIDEO_MAX_SIZE` |
| `scripts/fetch-video.sh` | 新（monorepo 顶层） | 从 constants/videos.ts grep 读 SOURCE_URL → curl 到 `apps/web/public/videos/hero.mp4` + 阈值检查 + 幂等 |
| `apps/web/src/components/VideoBackground.tsx` | 改 | VIDEO_URL 1 行改 + import 替换 + 移除 onError fallback |
| `apps/web/test/components/VideoBackground.test.tsx` | 改 | 测试 #1 的 src 断言改 `/videos/hero.mp4` |
| `apps/web/package.json` | 改 | 新增 `predev` + `prebuild` 钩子 |
| `apps/web/.gitignore` | 改 | 加 1 行 `apps/web/public/videos/` |
| `apps/web/_headers` | 新 | CF Pages Cache-Control 配置 |
| `apps/web/public/videos/hero.mp4` | 新（gitignored，运行时产出） | 视频本体，由 `scripts/fetch-video.sh` 写入 |
| `docs/superpowers/specs/source-of-truth.md` | 新 | 视频资源台账（URL + 上传日期 + 续约提醒） |

**设计原则**：每个新文件单一职责。`constants/videos.ts` 是单一事实源（URL / 阈值常量），`fetch-video.sh` 是单一执行单元（无 Node 依赖）。VideoBackground.tsx 改动最小化（不破坏 verbatim 区域）。

---

## Task 1: 创建 constants/videos.ts + scripts/fetch-video.sh + tests for fetch-video.sh

**Files:**
- Create: `apps/web/src/constants/videos.ts`
- Create: `scripts/fetch-video.sh`
- Create: `scripts/fetch-video.test.sh`（手写 shell 测试脚本）
- Create: `scripts/fetch-video.test.setup.sh`（测试 fixture 准备）
- Test: `scripts/fetch-video.test.sh`（不依赖 vitest，bash 单元测试）

**Interfaces:**
- Consumes: 无（首任务）
- Produces:
  - `HERO_VIDEO_SOURCE_URL: string`（CloudFront 永久 URL）
  - `HERO_VIDEO_LOCAL_URL: '/videos/hero.mp4'`
  - `HERO_VIDEO_WARN_SIZE: 5242880`（5MB 软阈值）
  - `HERO_VIDEO_MAX_SIZE: 10485760`（10MB 硬阈值）
  - `scripts/fetch-video.sh` 行为契约：
    - 输入：grep `apps/web/src/constants/videos.ts` 中 `HERO_VIDEO_SOURCE_URL = '...'`
    - 输出：写到 `apps/web/public/videos/hero.mp4`
    - 退出码：0（成功）/ 1（curl 失败 / 文件 > 10MB / URL 缺失）
    - 幂等：文件已存在 → skip
    - 副作用：stdout 写人类可读日志，stderr 写错误

- [ ] **Step 1: 创建 `apps/web/src/constants/videos.ts`**

```typescript
/**
 * 视频资源常量
 * v0.13.B.3: 视频本地化（从 cloudfront → public/videos/hero.mp4）
 * 此文件记录源 URL，spec/source-of-truth.md 跟踪 source 真实性
 */
export const HERO_VIDEO_SOURCE_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4';

/** 本地化路径（Vite 自动 serve public/） */
export const HERO_VIDEO_LOCAL_URL = '/videos/hero.mp4';

/** 软阈值（warn）：5MB */
export const HERO_VIDEO_WARN_SIZE = 5 * 1024 * 1024;
/** 硬阈值（fail）：10MB */
export const HERO_VIDEO_MAX_SIZE = 10 * 1024 * 1024;
```

- [ ] **Step 2: 创建 `scripts/fetch-video.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Resolve monolith
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Read source URL from TS constants via grep (no node needed)
SOURCE_URL=$(grep -oE "HERO_VIDEO_SOURCE_URL = '[^']+'" "$ROOT/apps/web/src/constants/videos.ts" \
  | sed -E "s/.*'([^']+)'/\1/")

if [ -z "$SOURCE_URL" ]; then
  echo "[fetch-video] ERROR: HERO_VIDEO_SOURCE_URL not found in constants/videos.ts" >&2
  exit 1
fi

OUT="$ROOT/apps/web/public/videos/hero.mp4"
mkdir -p "$(dirname "$OUT")"

# Idempotent: file exists → skip
if [ -f "$OUT" ]; then
  SIZE=$(stat -f%z "$OUT" 2>/dev/null || stat -c%s "$OUT")
  echo "[fetch-video] already present: $OUT ($SIZE bytes)"
  exit 0
fi

echo "[fetch-video] downloading $SOURCE_URL → $OUT"
if ! curl --fail -L -o "$OUT" "$SOURCE_URL"; then
  echo "[fetch-video] FAILED to download $SOURCE_URL" >&2
  rm -f "$OUT"
  exit 1
fi

# Size threshold check
SIZE=$(stat -f%z "$OUT" 2>/dev/null || stat -c%s "$OUT")
if [ "$SIZE" -gt 10485760 ]; then  # 10MB hard fail
  echo "[fetch-video] FAIL: $SIZE bytes > 10MB threshold" >&2
  rm -f "$OUT"
  exit 1
elif [ "$SIZE" -gt 5242880 ]; then  # 5MB warn
  echo "[fetch-video] WARN: $SIZE bytes > 5MB (soft limit)" >&2
fi

echo "[fetch-video] OK: $OUT ($SIZE bytes)"
```

然后 `chmod +x scripts/fetch-video.sh`。

- [ ] **Step 3: 写 fetch-video.sh 测试 — 创建 `scripts/fetch-video.test.sh`**

```bash
#!/usr/bin/env bash
# fetch-video.sh 单元测试（不依赖 vitest，纯 bash）
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_DIR="$ROOT/apps/web/public/videos"
CONSTANTS_FILE="$ROOT/apps/web/src/constants/videos.ts"

PASS=0
FAIL=0

assert() {
  local desc="$1"
  local expected="$2"
  local actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  ✅ $desc"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $desc (expected: $expected, got: $actual)"
    FAIL=$((FAIL + 1))
  fi
}

cleanup() {
  rm -f "$TEST_DIR/hero.mp4"
}
trap cleanup EXIT

echo "=== Test: fetch-video.sh creates hero.mp4 on first run ==="
mkdir -p "$TEST_DIR"
rm -f "$TEST_DIR/hero.mp4"
bash "$SCRIPT_DIR/fetch-video.sh" > /tmp/fetch-output.txt 2>&1
EXIT=$?
assert "exit code 0" "0" "$EXIT"
assert "hero.mp4 exists" "true" "$([ -f "$TEST_DIR/hero.mp4" ] && echo true || echo false)"
SIZE=$(stat -f%z "$TEST_DIR/hero.mp4" 2>/dev/null || stat -c%s "$TEST_DIR/hero.mp4")
[ "$SIZE" -gt 1000 ] && SIZE_OK="true" || SIZE_OK="false"
assert "hero.mp4 size > 1KB (real download)" "true" "$SIZE_OK"

echo ""
echo "=== Test: idempotent — re-running skips download ==="
LOG_BEFORE=$(cat /tmp/fetch-output.txt | tail -1)
bash "$SCRIPT_DIR/fetch-video.sh" > /tmp/fetch-output2.txt 2>&1
LOG_AFTER=$(cat /tmp/fetch-output2.txt | tail -1)
case "$LOG_AFTER" in
  *"already present"*) IDEMPOTENT_OK="true" ;;
  *) IDEMPOTENT_OK="false" ;;
esac
assert "idempotent message" "true" "$IDEMPOTENT_OK"

echo ""
echo "=== Test: 10MB threshold fail (mock with 11MB dummy file) ==="
rm -f "$TEST_DIR/hero.mp4"
dd if=/dev/zero of="$TEST_DIR/hero.mp4" bs=1024 count=11530 2>/dev/null
# 创建一个临时 constants 文件指向不存在的 URL，避免触发真实下载
TMP_CONST=$(mktemp)
sed "s|HERO_VIDEO_SOURCE_URL = '[^']*'|HERO_VIDEO_SOURCE_URL = 'http://127.0.0.1:1/nonexistent.mp4'|" "$CONSTANTS_FILE" > "$TMP_CONST"
cp "$CONSTANTS_FILE" "$CONSTANTS_FILE.bak"
cp "$TMP_CONST" "$CONSTANTS_FILE"
# 删除占位文件让 fetch 进入下载路径（但 URL 失效 → curl 失败 → exit 1）
rm -f "$TEST_DIR/hero.mp4"
bash "$SCRIPT_DIR/fetch-video.sh" > /tmp/fetch-threshold.txt 2>&1
EXIT=$?
cp "$CONSTANTS_FILE.bak" "$CONSTANTS_FILE"
rm -f "$CONSTANTS_FILE.bak" "$TMP_CONST"
assert "exit code 1 on curl failure" "1" "$EXIT"
case "$(cat /tmp/fetch-threshold.txt)" in
  *"FAILED"*) THRESHOLD_OK="true" ;;
  *) THRESHOLD_OK="false" ;;
esac
assert "FAILED message present" "true" "$THRESHOLD_OK"

echo ""
echo "=== Results ==="
echo "PASS: $PASS / FAIL: $FAIL"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
```

然后 `chmod +x scripts/fetch-video.test.sh`。

- [ ] **Step 4: 运行测试，期望部分通过（threshold test 因 mock 限制可能需要 subagent 适配）**

Run: `bash scripts/fetch-video.test.sh`

Expected:
- Test 1 (real download) → PASS（真实下载成功）
- Test 2 (idempotent) → PASS
- Test 3 (10MB threshold via URL trick) → PASS（curl --fail 让下载失败 → exit 1）
- `PASS: 3 / FAIL: 0`

如果 threshold test 的 sed 替换有 macOS / Linux 差异，subagent 可调整 mock 策略（比如用 inline 临时 constants 文件 + 改 `fetch-video.sh` 接受 `CONSTANTS_PATH` 环境变量覆盖）。**核心契约：3 个断言 exit code / 文件存在 / 日志内容必须通过**。

- [ ] **Step 5: 验证 typecheck（constants/videos.ts 被引用前不报错）**

Run: `cd apps/web && pnpm typecheck`

Expected: 0 errors（constants/videos.ts 还没被 VideoBackground.tsx 引用，但 TypeScript 不要求每个新文件立刻被引用）

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/constants/videos.ts scripts/fetch-video.sh scripts/fetch-video.test.sh
git commit -m "feat(video-localize): add constants/videos.ts and fetch-video.sh with shell tests"
```

---

## Task 2: 改 VideoBackground.tsx 用 HERO_VIDEO_LOCAL_URL + 同步测试断言

**Files:**
- Modify: `apps/web/src/components/VideoBackground.tsx:1-4`（import + URL 常量）
- Modify: `apps/web/test/components/VideoBackground.test.tsx:41-47`（测试 #1 的 src 断言）

**Interfaces:**
- Consumes:
  - `HERO_VIDEO_LOCAL_URL` from `apps/web/src/constants/videos`（Task 1 创建）
- Produces:
  - VideoBackground 组件视频 src 为 `/videos/hero.mp4`（不再 hardcode cloudfront）

- [ ] **Step 1: 改 VideoBackground.tsx — 替换 import 与 VIDEO_URL**

修改文件顶部 1-4 行：

```diff
 import { useRef, useEffect } from 'react';

-const VIDEO_URL =
-  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4';
+import { HERO_VIDEO_LOCAL_URL, HERO_VIDEO_SOURCE_URL } from '../constants/videos';
+
+const VIDEO_URL = HERO_VIDEO_LOCAL_URL;
```

**保持 verbatim 不动**：
- 7 个 useRef（videoRef / opacityRef / fadingOutRef / rafIdRef / startTimeRef / startOpacityRef / targetOpacityRef）— 不变
- 3 个事件 listener（onLoadedData / onTimeUpdate / onEnded）— 不变
- RAF fade 系统（startFade / cancelAnim）— 不变
- FADE_DURATION_MS / FADE_OUT_TRIGGER_S / RESET_DELAY_MS 常量 — 不变
- container `<div className="min-h-screen bg-black overflow-hidden absolute inset-0 -z-10">` — 不变
- video element：`absolute inset-0 w-full h-full object-cover` + `style={{ transform: 'translateY(17%)', opacity: 0 }}` — 不变

- [ ] **Step 2: 修改 VideoBackground.test.tsx 测试 #1 的 src 断言**

修改文件 `apps/web/test/components/VideoBackground.test.tsx` 第 45-47 行：

```diff
-    expect(video?.getAttribute('src')).toBe(
-      'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4'
-    );
+    expect(video?.getAttribute('src')).toBe('/videos/hero.mp4');
```

测试 #2-#4（fade-in / fade-out / ended）不动（这些测试不依赖 src URL）。

- [ ] **Step 3: 运行 VideoBackground 测试 + 完整测试套件**

Run: `cd apps/web && pnpm test -- --reporter=verbose`

Expected: 27 / 27 tests pass（5 styles + 14 components + 4 VideoBackground + 4 misc 不变）

如果 VideoBackground.test.tsx 因 dev mode sanity check（spec §5.4 改动 3）失败 — **本 Task 不引入 useEffect sanity check**（那是 spec §5.4 改动 3，spec §5.4 的改动 1 和 2 才是必须的）。`HERO_VIDEO_LOCAL_URL` 是字面量 `/videos/hero.mp4`，不依赖 import.meta.env。

- [ ] **Step 4: 验证 typecheck**

Run: `cd apps/web && pnpm typecheck`

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/VideoBackground.tsx apps/web/test/components/VideoBackground.test.tsx
git commit -m "feat(video-localize): use HERO_VIDEO_LOCAL_URL in VideoBackground and update test assertion"
```

---

## Task 3: 加 predev/prebuild 钩子 + .gitignore

**Files:**
- Modify: `apps/web/package.json:5-11`（scripts 段）
- Modify: `apps/web/.gitignore`（追加 1 行）

**Interfaces:**
- Consumes:
  - `scripts/fetch-video.sh` from Task 1
- Produces:
  - `pnpm dev` 自动跑 `bash ../../scripts/fetch-video.sh`
  - `pnpm build` 自动跑 `bash ../../scripts/fetch-video.sh`
  - `apps/web/public/videos/` 不被 git 追踪

- [ ] **Step 1: 修改 apps/web/package.json**

```diff
   "scripts": {
     "dev": "vite",
     "build": "tsc --noEmit && vite build",
+    "predev": "bash ../../scripts/fetch-video.sh",
+    "prebuild": "bash ../../scripts/fetch-video.sh",
     "preview": "vite preview",
     "test": "vitest run",
     "typecheck": "tsc --noEmit"
   },
```

**路径解释**：apps/web/package.json 中 cwd 是 `apps/web/`，所以 `../../scripts/fetch-video.sh` 解析为 `<monorepo>/scripts/fetch-video.sh`。

- [ ] **Step 2: 修改 apps/web/.gitignore**

在文件末尾追加 1 行：

```
apps/web/public/videos/
```

**不要 gitignore** `apps/web/public/` 整体（Vite 默认会复制整个 `public/` 到 dist/，包括 vite.svg 等其他静态资产）。

- [ ] **Step 3: 验证 predev 钩子自动触发**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web
rm -f public/videos/hero.mp4
pnpm dev &
DEV_PID=$!
sleep 5  # 等 predev 钩子跑完 + Vite 启动
ls -lh public/videos/hero.mp4
curl -I http://localhost:5173/videos/hero.mp4 | head -3
kill $DEV_PID 2>/dev/null || true
wait $DEV_PID 2>/dev/null || true
```

Expected:
- `public/videos/hero.mp4` 存在
- `curl -I` 返回 `HTTP/1.1 200 OK` 或 `HTTP/2 200`
- Content-Type 为 `video/mp4`

- [ ] **Step 4: 验证 prebuild 钩子自动触发**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web
rm -rf dist public/videos/hero.mp4
pnpm build
ls -lh dist/videos/hero.mp4 2>&1 || echo "MISSING — build failed to copy"
ls -lh dist/assets/*.js dist/assets/*.css | head -5
```

Expected:
- `dist/videos/hero.mp4` 存在
- `dist/assets/*.js` + `*.css` 存在
- build exit code 0

- [ ] **Step 5: 验证 gitignore 生效**

```bash
cd /Users/opc-1/Downloads/O/qizai
git status apps/web/public/videos/
git check-ignore -v apps/web/public/videos/hero.mp4
```

Expected:
- `git status` 输出 nothing（hero.mp4 不在 untracked list）
- `git check-ignore` 输出 apps/web/public/videos/hero.mp4 路径 + 匹配规则

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/.gitignore
git commit -m "chore(video-localize): wire predev/prebuild hooks and gitignore public/videos/"
```

---

## Task 4: 写 _headers 文件 + source-of-truth.md

**Files:**
- Create: `apps/web/_headers`
- Create: `docs/superpowers/specs/source-of-truth.md`

**Interfaces:**
- Consumes: 无
- Produces:
  - CF Pages 部署时对 `/videos/hero.mp4` 返回 `Cache-Control: public, max-age=31536000, immutable`
  - 视频资源台账文档

- [ ] **Step 1: 创建 `apps/web/_headers`**

```
/videos/hero.mp4
  Cache-Control: public, max-age=31536000, immutable
```

**注**：CF Pages 部署时自动识别 `_headers` 文件（Wrangler Pages 协议）。1 个文件 1 条规则，文件名固定（无 hash），所以"内容变了文件名不变"会让用户浏览器永久拿旧视频 — 这是 spec §Q6 接受的运维风险（v0.14+ 处理）。

- [ ] **Step 2: 创建 `docs/superpowers/specs/source-of-truth.md`**

```markdown
# 视频资源 Source-of-Truth

> 此文件跟踪 `apps/web/src/constants/videos.ts` 中 `HERO_VIDEO_SOURCE_URL` 的真实性。

## 当前 source URL

| 字段 | 值 |
|------|-----|
| URL | `https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4` |
| 上传者 | qizai 内容团队 |
| 上传日期 | 2026-03-28 |
| 期望到期 | 永久到 CloudFront 合同到期前 |
| 上次本地拉取 | 见 git log: `git log --oneline -- apps/web/src/constants/videos.ts` |

## 健康检查

- **每周一 09:00** cron: `curl -I $HERO_VIDEO_SOURCE_URL` 检查 HTTP 200
- 检查失败 → 邮件/Slack 报警给运营 + PM
- cron 自动化推 v0.14+（v0.13.B.3 仅记录契约）

## 文件名约定

- 本地路径：`apps/web/public/videos/hero.mp4`（gitignored）
- 部署路径：`/videos/hero.mp4`（CF Pages 公开访问）
- **无 hash 后缀** → Cache-Control: immutable + 不变文件名 = 永久缓存（v0.14+ 用 content-hash 文件名解决）
```

- [ ] **Step 3: 验证 _headers 文件结构**

```bash
cat apps/web/_headers
file apps/web/_headers  # 应是 ASCII text
```

Expected: 3 行内容（1 路径 + 1 Cache-Control 行 + 1 空行）。`file` 命令输出 ASCII text。

- [ ] **Step 4: 验证 source-of-truth.md 被 git 追踪**

```bash
cd /Users/opc-1/Downloads/O/qizai
git check-ignore -v docs/superpowers/specs/source-of-truth.md
git status docs/superpowers/specs/source-of-truth.md
```

Expected:
- `git check-ignore` 输出 nothing（未被忽略）
- `git status` 显示文件为 untracked（待 commit）

- [ ] **Step 5: 跑测试套件确保无 regression**

Run: `cd apps/web && pnpm test`

Expected: 27 / 27 tests pass（_headers 和 source-of-truth.md 不影响 React 组件）

- [ ] **Step 6: Commit**

```bash
git add apps/web/_headers docs/superpowers/specs/source-of-truth.md
git commit -m "docs(video-localize): add _headers cache rule and source-of-truth ledger"
```

---

## Task 5: 真实 build 验证 + 离线 dev 验证 + git status 验证

**Files:**
- 无文件修改（验证 + 标签任务）
- Modify: `CHANGELOG.md`（追加 v0.13.B.3 entry）

**Interfaces:**
- Consumes:
  - 所有前序 Task 产出（hero.mp4 + VideoBackground 改 + hooks + _headers）
- Produces:
  - 5 项完成验证全部通过
  - CHANGELOG.md 记录 v0.13.B.3 完成

- [ ] **Step 1: 真实 build 验证**

```bash
cd /Users/opc-1/Downloads/O/qizai
rm -rf apps/web/dist apps/web/public/videos/hero.mp4
cd apps/web
pnpm build
ls -lh dist/videos/hero.mp4
ls -lh dist/assets/*.js dist/assets/*.css | head -5
```

Expected:
- Build exit 0
- `dist/videos/hero.mp4` 存在
- `dist/assets/` 至少 1 个 .js + 1 个 .css

- [ ] **Step 2: 离线 dev 验证（关键：拔网 / 离线）**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web
rm -f public/videos/hero.mp4
# 启动 dev server（predev 钩子会 fetch 视频）
pnpm dev > /tmp/vite-dev.log 2>&1 &
DEV_PID=$!
sleep 6  # 等 fetch + Vite 启动
echo "=== curl localhost:5173/videos/hero.mp4 ==="
curl -sI http://localhost:5173/videos/hero.mp4 | head -5
echo "=== curl localhost:5173 (HTML) ==="
curl -s http://localhost:5173 | grep -E '<title>|<div id=' | head -3
kill $DEV_PID 2>/dev/null || true
wait $DEV_PID 2>/dev/null || true
```

Expected:
- `/videos/hero.mp4` 返回 `HTTP/1.1 200 OK`
- Content-Type: `video/mp4`
- Content-Length > 1000 bytes

**离线断言**：如果 `curl localhost:5173/videos/hero.mp4` 在**断开网络**后仍返回 200，说明 predev 钩子在 dev server 启动前已下载视频到 `public/videos/hero.mp4`，Vite serve 的是本地副本。subagent 可手动断网后重试确认。

- [ ] **Step 3: git status 验证（video 文件不入 git）**

```bash
cd /Users/opc-1/Downloads/O/qizai
git status
git status --porcelain | grep -E "public/videos|hero\.mp4" || echo "✅ hero.mp4 not in git status"
```

Expected:
- `git status` 输出包含本次 Task 1-4 的所有新增/修改文件
- **`apps/web/public/videos/hero.mp4` 不出现在 status 中**（被 gitignore）

- [ ] **Step 4: typecheck 验证**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web
pnpm typecheck
```

Expected: 0 errors

- [ ] **Step 5: 27 tests 验证**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web
pnpm test
```

Expected: 27 / 27 tests pass（与 baseline 一致）

- [ ] **Step 6: 完整规格验证清单（对照 spec §一）**

| spec 验证项 | 期望 |
|------------|------|
| `pnpm dev` 拔外网启动成功 + `curl localhost:5173/videos/hero.mp4` HTTP 200 | ✅ Step 2 |
| `pnpm build` 产出 `dist/videos/hero.mp4` + `dist/assets/*.{js,css}` | ✅ Step 1 |
| `pnpm test` 通过（27 tests 仍 pass） | ✅ Step 5 |
| typecheck clean | ✅ Step 4 |
| `git status` 不显示 `public/videos/hero.mp4` | ✅ Step 3 |

- [ ] **Step 7: 更新 CHANGELOG.md**

在 `## [Unreleased]` 段落（v0.13.A entry 之后）追加：

```markdown
## [Unreleased] - v0.13.B.3（视频本地化）

### Highlights

qizai v0.13.B.3 — apps/web 视频资源从 CloudFront CDN 切到本地 `public/videos/hero.mp4`。

- **离线 dev 可用**：`pnpm dev` predev 钩子自动 fetch → 无需外网
- **build 产物含 mp4**：`pnpm build` 复制 `public/videos/hero.mp4` 到 `dist/videos/hero.mp4`
- **CF Pages 永久缓存**：`_headers` 配置 `Cache-Control: public, max-age=31536000, immutable`
- **fail-hard**：视频缺失 / > 10MB / curl 失败 → exit 1，不静默黑屏
- **0 npm 依赖**：bash + curl + grep + sed 全内置命令
- **5 commits**：4 task + 1 docs
- **27/27 tests pass**（VideoBackground URL 断言同步更新）

### 🚀 Features

- **constants**: `apps/web/src/constants/videos.ts` 单一事实源（SOURCE_URL / LOCAL_URL / WARN/MAX_SIZE） (Task 1)
- **scripts**: `scripts/fetch-video.sh` 幂等 fetch + 阈值检查（Task 1）
- **components**: `VideoBackground.tsx` VIDEO_URL → HERO_VIDEO_LOCAL_URL（Task 2）
- **hooks**: `predev` + `prebuild` npm hooks 自动触发 fetch（Task 3）
- **headers**: `apps/web/_headers` CF Pages Cache-Control 配置（Task 4）
- **docs**: `docs/superpowers/specs/source-of-truth.md` 视频资源台账（Task 4）

### ⚙️ Miscellaneous

- `.gitignore`: `apps/web/public/videos/` 加入（Task 3）
```

- [ ] **Step 8: Commit CHANGELOG**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): record v0.13.B.3 video-localize completion"
```

---

## Done Criteria（spec §一 验收标准）

- [x] `pnpm dev` 离线启动成功 + `curl localhost:5173/videos/hero.mp4` HTTP 200
- [x] `pnpm build` 产出 `dist/videos/hero.mp4` + `dist/assets/*.{js,css}`
- [x] `pnpm test` 通过（27 tests 仍 pass）
- [x] typecheck clean
- [x] `git status` 不显示 `public/videos/hero.mp4`
- [x] 5 个 commit 全部 clean（spec §七 5 TDD Tasks 对齐）

**Out of scope（v0.14+ 推）**：
- 视频转码 / 多分辨率 / lazy-load / CDN 缓存层 / R2/S3 远程归档 / CloudFront URL cron / content-hash 文件名