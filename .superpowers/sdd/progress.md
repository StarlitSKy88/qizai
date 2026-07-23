# qizai v0.13.B.3 Subagent-Driven Progress (2026-07-24)

**Plan**: docs/superpowers/plans/2026-07-24-qizai-v013b3-video-localize.md
**Base commit**: 66577ac
**Mode**: Subagent-Driven (per-task implementer + reviewer)

| # | Task | Status | Commits | Review |
|---|------|--------|---------|--------|
| 1 | constants + fetch-video.sh + shell tests | ✅ complete | 2a85753 + c79d122 (threshold fix) | Spec ✅ / Quality Approved |

## v0.13.B.3 Final Stats (running)

- **2 commits** so far (1 Task + 1 threshold fix)
- **6/6 shell tests pass** (fetch-video.test.sh)
- **27/27 vitest pass** (Task 1 untouched components)
- **typecheck clean** (Task 1 fix verified)

## Threshold amendment (ADR)

- Spec §Q5 原 10MB 硬阈值 → 真实 CloudFront 视频 20MB → 修订为 25MB
- ADR-style comment in constants/videos.ts header
- v0.14+ 转码后恢复原阈值

## Minor findings (rolled to final review)

- M1: brief `setup.sh` fixture omitted → inline `mktemp` accepted (simpler)
- M2: test script `set -uo pipefail` (no `-e`) → rationale: assert needs to continue on failure
- M3: macOS BSD sed `sed -E` works; Linux/GNU untested but POSIX-portable
- M4: ADR "决策者: 昴君" + commit auto-generated → audit trail
- M5: `HERO_VIDEO_WARN_SIZE` / `HERO_VIDEO_LOCAL_URL` exported but unused until Task 2 → keep (Task 2 consumes)

| 2 | VideoBackground.tsx URL 替换 | ✅ complete | 6cd31a1 | Spec ✅ / Quality Approved |

## Task 2 stats (running)

- 1 commit, 2 files (VideoBackground.tsx +2/-2, test +1/-3)
- 27/27 vitest pass, 0 typecheck errors
- verbatim 7 useRef / 3 listeners / RAF fade unchanged
- HERO_VIDEO_SOURCE_URL imported but unused (tsconfig allows; spec-mandated)

## Task 2 minor findings (rolled to final review)

- M6: test #1 名称 "renders <video> element with the cloudfront URL and translate-y-[17%]" stale after assertion change → non-blocking, brief limited diff to src assertion
- M7: HERO_VIDEO_SOURCE_URL 未引用 → tsconfig 允许，但若启用 noUnusedLocals 会 flag

| 3 | predev/prebuild hooks + .gitignore | ✅ complete | 1a3c551 | Spec ✅ / Quality Approved |

## Task 3 stats (running)

- 1 commit, 2 files (package.json +2, .gitignore +1)
- predev auto-fetches 19MB video on `pnpm dev`
- prebuild auto-fetches + copies to dist/videos/hero.mp4
- gitignore rule matches `apps/web/public/videos/`

## Task 3 minor findings (rolled to final review)

- M8: Implementer report gitignore check-ignore output truncated (no specific rule shown) — behavior verified independently
- M9: apps/web/public/ has no vite.svg — spec §五.5.6 note about preserving vite.svg is preventive only
- M10: Task 5 should re-verify build produces dist/assets/*.js + *.css (not just implementer self-claim)

| 4 | _headers + source-of-truth.md | ✅ complete | 8146281 | Spec ✅ / Quality Approved |

## Task 4 stats (running)

- 1 commit, 2 new files (_headers 3 lines + source-of-truth.md 25 lines)
- 27/27 vitest pass
- _headers is ASCII text, Cache-Control: public, max-age=31536000, immutable
- source-of-truth.md tracks upload date / renewal / health check cron / filename convention

## ⚠️ CRITICAL cross-task issue (must fix in Task 5 or pre-Task-5)

**Issue**: `_headers` lives at `apps/web/_headers` (source root, NOT inside public/). Vite build does NOT copy non-public/ files into dist/. Verified: `ls apps/web/dist/` shows only `assets/`, `videos/`, `index.html` — NO `_headers`. CF Pages deploy won't apply Cache-Control without `_headers` at publish root.

**Fix path options** (Task 5 will resolve):
1. Add `_headers` → `public/_headers` (Vite copies public/ wholesale). Requires moving file from `apps/web/_headers` to `apps/web/public/_headers`. Note: `.gitignore` rule `apps/web/public/videos/` only ignores subdirectory, so `apps/web/public/_headers` would be tracked.
2. Modify deploy.sh to `cp apps/web/_headers dist/_headers` before `wrangler pages deploy`.
3. Modify vite.config.ts with a custom plugin to copy `_headers` to dist/.

**Recommendation**: Option 1 (move to public/_headers) is simplest, idiomatic CF Pages + Vite pattern, and avoids deploy script coupling. **Decide in Task 5 before final review.**

## Task 4 minor findings (rolled to final review)

- M11: _headers reported as "3 lines" by implementer but wc -l reports 2 (cosmetic only; trailing LF correct for CF Pages)
- M12: source-of-truth.md adds "文件名约定" section beyond spec §5.7 skeleton — spec-aligned (documents immutable cache risk from §Q6), acceptable expansion
