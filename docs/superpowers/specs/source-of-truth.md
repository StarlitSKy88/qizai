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
