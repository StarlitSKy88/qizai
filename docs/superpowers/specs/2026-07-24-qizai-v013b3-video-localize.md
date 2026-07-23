# qizai v0.13.B.3 视频本地化 Spec

**日期**：2026-07-24
**版本**：v0.13.B.3（v0.13 的 sub-project B.3：视频本地化）
**作者**：蕾姆（brainstorming skill + PM 视角）
**审核**：昴君（pending review）
**Spec Baseline**：v0.13.A spec §十一 + §四 + §九 + brainstorm §1 架构已批准 + 7 项 PM 默认已采纳

> **范围界定**：v0.13.B.3 仅交付 `apps/web/public/videos/hero.mp4` 本地化 + 离线 `pnpm dev` 可用 + build 产物含 mp4。**Out of scope**：视频转码 / 多分辨率 / lazy-load / CDN 缓存层 / 全局 Footer / 真实 LLM / JWT / D1。

---

## 一、目标

把 `apps/web/src/components/VideoBackground.tsx` 中 hardcoded 的 cloudfront URL 替换为本地 `apps/web/public/videos/hero.mp4`：

1. `pnpm dev` 启动时视频已就位（**离线可用**）
2. `pnpm build` 产物 `dist/videos/hero.mp4` 含视频
3. `apps/web/public/videos/hero.mp4` **不入 git**
4. 视频缺失时 fail-fast（不静默黑屏）
5. CF Pages `Cache-Control: max-age=31536000, immutable`（1 年）

**v0.13.B.3 完成验证标准**：
- `pnpm dev` 拔外网启动成功 + `curl localhost:5173/videos/hero.mp4` HTTP 200
- `pnpm build` 产出 `dist/videos/hero.mp4` + `dist/assets/*.{js,css}`
- `pnpm test` 通过（27 tests 仍 pass）
- typecheck clean
- `git status` 不显示 `public/videos/hero.mp4`

---

## 二、内容替换表

| 元素 | v0.13.A | v0.13.B.3 |
|------|---------|-----------|
| VideoBackground.tsx 中 VIDEO_URL 常量 | `'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4'` | `'/videos/hero.mp4'`（本地相对路径） |
| Video element src | cloudfront URL | `'/videos/hero.mp4'` |
| Fallback chain | 无 | **无**（fail-hard 原则） |
| predev / prebuild 钩子 | 无 | 自动跑 `scripts/fetch-video.sh` |
| `apps/web/public/videos/` git status | N/A | gitignored |
| CF Pages Cache-Control | 默认 14400s | `max-age=31536000, immutable` |
| Source-of-truth 文档 | N/A | `docs/superpowers/specs/source-of-truth.md` |

---

## 三、技术栈

| 层级 | 选择 | 理由 |
|------|------|------|
| 视频来源 | 本地 `public/videos/hero.mp4` | Vite 自动 serve `public/` |
| 自动 fetch 工具 | `curl` in `scripts/fetch-video.sh` | 已 linux/macOS 自带，无 Node 依赖 |
| Source URL 存储 | `apps/web/src/constants/videos.ts` TS 常量 | TypeScript 编译期可查 |
| hero.mp4 阈值 | **25MB fail** / 5MB warn（**v0.13.B.3 修订**：原 10MB，因真实 CloudFront 视频 20MB 调整） | 移动端秒播 + 不挤占带宽（保留 5MB 安全冗余） |
| Cache-Control | `public, max-age=31536000, immutable` | 1 年 + 永久缓存，文件名不变前提下 |
| 失败行为 | fail-hard（exit 1） | 让问题显形，不静默黑屏 |

**❌ 重大破坏性变更**：无。仅替换 URL 常量 + 加 scripts + gitignore 1 行。

---

## 四、文件结构

```
qizai/
├── docs/
│   └── superpowers/
│       └── specs/
│           ├── 2026-07-24-qizai-v013b3-video-localize.md   ← 本 spec
│           └── source-of-truth.md                          ← 新：记录 cloudfront 视频源 URL + sha256 + 字节大小 + 更新日期 + 续约提醒
├── scripts/                                                ← monorepo 顶层
│   └── fetch-video.sh                                      ← 新：从 constants 读 SOURCE_URL，curl 到 public/videos/hero.mp4
└── apps/web/
    ├── src/
    │   ├── components/VideoBackground.tsx                  ← 改：VIDEO_URL 改 '/videos/hero.mp4'
    │   └── constants/                                       ← 新目录
    │       └── videos.ts                                    ← 新：export const HERO_VIDEO_SOURCE_URL = 'cloudfront URL'
    ├── public/
    │   └── videos/
    │       └── hero.mp4                                     ← gitignore，运行后产出
    ├── package.json                                         ← 改：加 predev + prebuild 钩子
    ├── .gitignore 增加 1 行：apps/web/public/videos/
    └── public/
        ├── videos/
        │   └── hero.mp4                                     ← gitignore，运行后产出
        └── _headers                                         ← 新：CF Pages Cache-Control 配置（置于 public/ 下，Vite build 自动 copy 到 dist/）
```

---

## 五、关键组件规格

### 5.1 `scripts/fetch-video.sh`（新）

**功能**：从常量读 `HERO_VIDEO_SOURCE_URL`，curl 到 `apps/web/public/videos/hero.mp4`。

**伪代码（shell）**：

```bash
#!/usr/bin/env bash
set -euo pipefail

# Resolve monolith
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Read source URL from TS constants via grep (no node needed)
SOURCE_URL=$(grep -oE "HERO_VIDEO_SOURCE_URL = '[^']+'" "$ROOT/apps/web/src/constants/videos.ts" \
  | sed -E "s/.*'([^']+)'/\1/")
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
if [ "$SIZE" -gt 26214400 ]; then  # 25MB (v0.13.B.3 修订：原 10MB)
  echo "[fetch-video] FAIL: $SIZE bytes > 25MB threshold" >&2
  rm -f "$OUT"
  exit 1
elif [ "$SIZE" -gt 5242880 ]; then  # 5MB
  echo "[fetch-video] WARN: $SIZE bytes > 5MB (soft limit)" >&2
fi

echo "[fetch-video] OK: $OUT ($SIZE bytes)"
```

**幂等行为**：文件已存在 → skip（避免重复下载）。

**fail-fast 行为**：
- curl 失败 / HTTP 非 200 → exit 1
- mp4 文件 > **25MB** → exit 1（v0.13.B.3 修订：原 10MB，真实视频 20MB）
- mp4 文件 > 5MB → warn-only（软阈值）

**来源读取**：用 `grep` + `sed` 从 TS 常量文件读（避免 Node 依赖）。

**注**：原 spec 设计阈值 10MB（移动端秒播 + 不挤带宽），但实际 CloudFront 源视频为 20MB，硬卡 10MB 会让 dev/build 永久 fail-fast。Task 1 implementer 实测触发后，由 user（昴君）批准修订为 25MB（保留 5MB 安全冗余）。详见 §十二 ADR。

### 5.2 `apps/web/package.json` 钩子（改）

```diff
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
+   "predev": "bash ../../scripts/fetch-video.sh",
+   "prebuild": "bash ../../scripts/fetch-video.sh",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
```

**注**：路径 `../../scripts/fetch-video.sh` 因为 `apps/web/package.json` 中 cwd 是 `apps/web/`。

### 5.3 `apps/web/src/constants/videos.ts`（新）

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
/** 硬阈值（fail）：25MB（v0.13.B.3 修订：原 10MB，真实视频 20MB） */
export const HERO_VIDEO_MAX_SIZE = 25 * 1024 * 1024;
```

### 5.4 `apps/web/src/components/VideoBackground.tsx`（改）

**改动 1**：import 改
```diff
- const VIDEO_URL = 'https://d8j0ntlcm91z4.cloudfront.net/....hero.mp4';
+ import { HERO_VIDEO_LOCAL_URL, HERO_VIDEO_SOURCE_URL } from '../constants/videos';
+ const VIDEO_URL = HERO_VIDEO_LOCAL_URL;
```

**改动 2**：移除原有 onError fallback（**fail-hard 原则**）

**保留**：RAF fade 系统 / translateY(17%) / 7 个 useRef / 3 个事件 listener 全部 verbatim 不动。

**改动 3**：增加 dev-only sanity check
```typescript
// VideoBackground.tsx 顶部
useEffect(() => {
  if (import.meta.env.DEV && !VIDEO_URL.startsWith('/')) {
    console.warn(
      '[VideoBackground] dev mode expects local path, got:', VIDEO_URL
    );
  }
}, []);
```

### 5.5 `apps/web/public/_headers`（新，CF Pages 配置）

> ⚠️ **v0.13.B.3 路径修订**：原 spec 设计 `apps/web/_headers`（与 _redirects 同层），但 Vite build 只 copy `public/*` 到 `dist/`，导致 _headers 无法到达 CF Pages 发布根。Task 4 implementer 部署验证发现后，commit `bfcd4a6` 将 `_headers` 移入 `public/_headers`，与 Vite 静态资源流水线对齐。详见 §十二 ADR。

```
/videos/hero.mp4
  Cache-Control: public, max-age=31536000, immutable
```

**作用**：CF Pages 部署后，浏览器永久缓存 `videos/hero.mp4`。文件名不变（不带 hash），所以"内容变了但文件名不变"是运营上的风险（§Q6 v0.14+ 处理）。

**部署路径**：`apps/web/public/_headers` → Vite build copy → `dist/_headers` → CF Pages 识别并应用。

### 5.6 `apps/web/.gitignore`（改）

```diff
+ apps/web/public/videos/
```

**注**：`apps/web/public/` 是 Vite 静态资源根目录，需保留 `vite.svg` 等其它文件。**只 gitignore videos/ 子目录**。

### 5.7 `docs/superpowers/specs/source-of-truth.md`（新）

> Source-of-Truth Ledger — 视频资产来源 / 完整性 / 续约 / 真实状态

```markdown
# 视频资源 Source-of-Truth

> 此文件跟踪 `apps/web/src/constants/videos.ts` 中 HERO_VIDEO_SOURCE_URL 的真实性

## 当前 source URL

| 字段 | 值 |
|------|-----|
| URL | https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4 |
| 上传者 | qizai 内容团队 |
| 上传日期 | 2026-03-28 |
| 期望到期 | (永久到 cloudfront 合同到期前) |
| 上次本地拉取 | (commit 引用) |

## 健康检查

- **每周一 09:00** cron: `curl -I $HERO_VIDEO_SOURCE_URL` 检查 HTTP 200
- 检查失败 → 邮件/Slack 报警给运营 + PM
```

---

## 六、测试计划

| Task | 验证 |
|------|------|
| 1. fetch-video.sh 创建 | 跑 `bash scripts/fetch-video.sh` 直接成功，hero.mp4 出现 |
| 2. 幂等行为 | 删掉后重跑 → 再次成功；存在时跑 → 不重复下载（看日志） |
| 3. URL 错误时 fail-fast | 修改常量 URL 为无效 → 跑 → exit 1 + stderr 错误信息 |
| 4. **25MB** 阈值 | 临时构造 26MB 文件 → fail；6MB 文件 → warn only（v0.13.B.3 修订：原 10MB/11MB） |
| 5. VideoBackground.tsx 改动 | 编译通过；typecheck clean；现有 27 tests 仍全 pass |
| 6. predev 钩子 | `rm -f public/videos/hero.mp4 && pnpm dev` → 自动下载 → Vite 启动成功 |
| 7. pnpm build 产物 | `pnpm --filter @qizai/web build` → `dist/videos/hero.mp4` 存在 |
| 8. 离线 dev | 拔网线（断网卡或 system proxy off）→ `pnpm dev` → 视频可播 |
| 9. _headers 文件存在 | CF Pages 控制台 `/_headers` 生效验证（manual smoke） |
| 10. gitignore | 跑后 `git status` 不显示 `public/videos/hero.mp4` |
| 11. typecheck | `pnpm --filter @qizai/web typecheck` clean |
| 12. 27 tests pass | `pnpm --filter @qizai/web test` 27 passed / 0 failed |

---

## 七、TDD 计划（推荐 5 个 Task）

按 superpowers 规范每个 Task 独立 deliverable：

1. **Task 1 — constants/videos.ts + scripts/fetch-video.sh + tests for fetch-video.sh**
   - 拉测试用例：用 vitest 跑脚本（spawn child process）验证 fail-fast / idempotent / 阈值
   - TDD 红→绿

2. **Task 2 — VideoBackground.tsx URL 替换（minimal diff）**
   - 改 VIDEO_URL 为 HERO_VIDEO_LOCAL_URL
   - 27 tests 仍 pass

3. **Task 3 — predev/prebuild 钩子 + .gitignore**
   - 改 apps/web/package.json + .gitignore 1 行
   - 验证 pnpm dev/build 自动跑脚本

4. **Task 4 — _headers 文件 + source-of-truth.md**
   - 写 apps/web/public/_headers（CF Pages 配置；v0.13.B.3 修订：原 `apps/web/_headers`）
   - 写 docs/superpowers/specs/source-of-truth.md
   - 跑 27 tests 仍 pass

5. **Task 5 — 真实 build 验证 + 离线 dev 验证 + git status 验证**
   - 跑 `pnpm build` → 检查 `dist/videos/hero.mp4` 存在
   - 跑 `pnpm dev` → 检查 `curl localhost:5173/videos/hero.mp4` HTTP 200
   - 跑 `git status` → 检查 `public/videos/hero.mp4` 不在
   - Final reviewer 走 turn

---

## 八、Out of Scope（推到 v0.14+）

- ❌ 视频转码（H.264 → WebM / AV1）
- ❌ 多分辨率自适应（720p / 1080p / 4K）
- ❌ 视频懒加载（已 Vite default `autoPreload: false` 关闭）
- ❌ CDN 缓存层（仅依赖 CF Pages 边缘节点）
- ❌ R2 / S3 远程归档（Q7 推到 v0.14）
- ❌ 视频运营自动化 pipeline（Q4 推到 v0.14）
- ❌ Cloudfront URL 健康检查 cron（spec §source-of-truth 记下，推 v0.14）
- ❌ 全局 Footer / LLM / JWT / D1（v0.13.B scope 已 reject）

---

## 九、约束

- ✅ VideoBackground.tsx 的 RAF fade 系统 / 7 个 useRef / 3 个事件 verbatim 不动
- ✅ 27 tests 不被破坏
- ✅ 视频文件 < **25MB**（threshold fail，v0.13.B.3 修订：原 10MB）
- ✅ 视频文件 < 5MB（threshold warn）
- ✅ 单文件 < 200 行（fetch-video.sh < 100 行 / constants/videos.ts < 30 行 / VideoBackground 改动后增量 < 5 行）
- ✅ 不引入其他工具（yarn / npm / pnpm 之外的包管理器依然 pnpm）
- ✅ 不引入 npm 依赖（用 bash + grep + curl 内置命令）
- ✅ 不引入 service worker
- ✅ TypeScript strict mode 全开

---

## 十、与 qizai v0.13.A / v0.12 的关系

**保持不变**：
- `apps/api/` 整个 Workers + Hono + 3 routes（v0.12）
- `packages/shared/` persona / llm / simulation / platform / report（v0.12）
- `apps/web/src/components/VideoBackground.tsx` 的 RAF fade 系统 / translateY(17%) 等核心逻辑
- `scripts/deploy.sh`（v0.13.A 已落地）

**变更**：
- `apps/web/src/components/VideoBackground.tsx`：VIDEO_URL 1 行改
- `apps/web/package.json`：加 predev + prebuild 钩子（2 行）
- `apps/web/.gitignore`：加 1 行
- 新增：`scripts/fetch-video.sh`（约 50 行）
- 新增：`apps/web/src/constants/videos.ts`（约 15 行）
- 新增：`apps/web/public/_headers`（CF Pages 配置，约 3 行；v0.13.B.3 修订：原 `apps/web/_headers`）
- 新增：`docs/superpowers/specs/source-of-truth.md`（约 30 行）

**新依赖**：无（bash + curl 内置 / grep + sed 内置）。

---

## 十一、Plan 调用

Spec 确认后，调用 **superpowers:writing-plans** 生成 v0.13.B.3 Plan，预期 5 个 Task（如 §七）。
每个 Task 独立的 implementer subagent + task reviewer subagent。

---

## 十二、ADR（Architecture Decision Records）

> 本 spec 在实施过程中识别出 2 处 spec-vs-reality 偏离，已由 user（昴君）批准修订，记录如下。

### ADR-001: HERO_VIDEO_MAX_SIZE 阈值 10MB → 25MB

**日期**：2026-07-24
**状态**：✅ 已批准并实施（commit `c79d122`）
**决策者**：昴君

**背景**：
- 原 spec §Q5 设计阈值 10MB（硬 fail）+ 5MB（软 warn），意图保证移动端秒播和不挤带宽
- Task 1 implementer 实测 fetch-video.sh：真实 CloudFront 源视频为 20,064,148 bytes（~19.1MB）
- 10MB 硬阈值会让 dev/build 永久 fail-fast（exit 1）

**选项**：
| 选项 | 描述 | 采纳 |
|------|------|------|
| (a) 下载 + 转码到 < 10MB | ffmpeg 转 H.264 baseline / 720p，一次性手工操作 | ❌ |
| (b) **调整 spec 阈值到 25MB** | HERO_VIDEO_MAX_SIZE 改 26214400（保留 5MB 安全冗余） | ✅ |
| (c) 截取短视频时长 | 取前 N 秒，但损害视觉体验 | ❌ |

**决定**：选项 (b) — spec 阈值 25MB，spec §Q5/§三/§5.1/§5.3/§九/§六 同步更新，代码 constants/videos.ts + scripts/fetch-video.sh 同步调整。

**后续（v0.14+）**：
- 若做 H.264 baseline 转码（v0.14+ 推），可恢复 10MB 阈值
- ADR 注释已 inline 在 `apps/web/src/constants/videos.ts` 头部

---

### ADR-002: `_headers` 路径 `apps/web/_headers` → `apps/web/public/_headers`

**日期**：2026-07-24
**状态**：✅ 已批准并实施（commit `bfcd4a6`）
**决策者**：蕾姆（自主决定，按全权授权 + spec deviation justified）

**背景**：
- 原 spec §5.5 设计 `_headers` 在 `apps/web/_headers`（与 `_redirects` 同层，"CF Pages 配置（与 _redirects 同层）"）
- Task 4 implementer 写完 _headers 后，Task 5 实测 build：`ls apps/web/dist/` 显示无 `_headers` — Vite build 不 copy `apps/web/` 根目录的非 public/ 文件到 dist/
- 若不修复，CF Pages 部署后 `Cache-Control` 永远不会生效，spec §一.5 验收标准永久 fail

**选项**：
| 选项 | 描述 | 采纳 |
|------|------|------|
| (a) **移到 `public/_headers`** | Vite 自动 copy 到 `dist/_headers`，CF Pages 识别 | ✅ |
| (b) 改 deploy.sh 加 cp | `cp apps/web/_headers dist/_headers` 部署前 copy | ❌ |
| (c) Vite 自定义 plugin | 在 vite.config.ts 加 copy plugin | ❌ |

**决定**：选项 (a) — 移入 `public/_headers`，符合 Vite + CF Pages idiom（静态资源放 public/）。`.gitignore` 规则 `apps/web/public/videos/` 仅 ignore 子目录，`public/_headers` 正常 tracked。

**Spec 偏离**：
- spec §四 / §5.5 / §十 路径文字需同步更新（本 commit 处理）
- spec 设计意图（CF Pages 永久缓存）100% 保持不变

**审计追踪**：
- Task 4 reviewer flag: "wrangler Pages 部署时 `_headers` 必须到达 publish root" ⚠️ Cross-task concern
- Task 5 implementer pre-fix step 处理：git mv + atomic commit
- final reviewer 裁定：acceptable — justification deployment correctness

---

**Spec retro-edit 已完成，与代码完全对齐。**
