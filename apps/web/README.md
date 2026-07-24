# qizai Web (v0.14)

Vite + React 18 + React Router 6 应用首页 hero + 多路由（注册/登录/预测/报告/历史）。

## 开发

```bash
cd apps/web
pnpm dev       # http://localhost:5173
pnpm build     # 产出 dist/
pnpm preview   # 预览 dist/
pnpm test      # vitest unit/integration
pnpm typecheck # tsc --noEmit
pnpm e2e       # playwright（自动启动 vite，5 个 spec 在 apps/web/e2e/）
pnpm e2e:ui    # playwright 自带 UI 调试器

### E2E Tests (Playwright)

First-time setup (downloads ~280MB chromium binary):

```
pnpm e2e:install
```

Run all e2e specs:

```
pnpm e2e
```
```

## 视频源

v0.13.A 阶段直接使用 cloudfront URL：
`https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4`

Phase 2 上线前会下载到 `apps/web/public/videos/hero.mp4`，URL 替换。
