# qizai v0.13.A 首页 Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `apps/web` 从 Next.js 14 替换为 Vite + React 18，交付 qizai 单屏首页 hero（含视频背景 + liquid glass nav + 中文文案）

**Architecture:** 删除 Next.js App Router 整套（src/app/, next.config.mjs, @qizai/shared 依赖作为 v0.13.A 不使用），新建 Vite SPA 单屏 hero。5 个组件分文件：VideoBackground / NavBar / HeroContent / SocialFooter / Hero，liquid-glass CSS 单独提取。架构与 v0.12 完全隔离，唯一修改点是 `apps/web/` 整个目录。

**Tech Stack:** Vite 5, React 18, TypeScript 5.6 strict, Tailwind CSS 3 (default config), lucide-react, vitest 2 + @testing-library/react + jsdom + @testing-library/jest-dom

## Global Constraints

- Node.js >= 20.x LTS, pnpm >= 8.x（继承自全局规则）
- TypeScript strict mode
- 测试覆盖率 ≥ 80%（尽量保持 v0.12 标准）
- 所有任务使用 TDD：先写测试 → 失败 → 实现 → 通过
- Git commit 格式：`feat/fix/docs/refactor(scope): subject`
- API key 不入 git，存 .env.local
- monorepo 结构：`apps/web/` + `apps/api/` + `packages/shared/`
- Tailwind CSS **默认 config，无扩展**（spec §十 明确）
- 不引入其他 UI 库（antd / chakra / shadcn / ...）
- 不引入 framer-motion（用 RAF 手写 fade）
- 不引入 state management（zustand / redux ... 单屏 SPA 不需要）
- 不调用后端 API（hero 纯前端，spec §十一 明确）
- 中文文案必须**逐字**采用 spec §二内容替换表
- 单文件 < 200 行
- v0.13.A **不含** 多路由 /predict /about /pricing（spec §九明确 out-of-scope）
- v0.12 已有依赖保留：`@vitejs/plugin-react`, `jsdom`, `vitest`, `@types/*`（package.json 现有，无需重装）
- v0.13.A 新增依赖：`lucide-react`
- v0.13.A 删除依赖：`next`, `@qizai/shared`（v0.13.A 不调用）

---

## Task 1: Vite 单屏脚手架重写

**Files:**
- Delete: `qizai/apps/web/src/app/layout.tsx`
- Delete: `qizai/apps/web/src/app/page.tsx`
- Delete: `qizai/apps/web/src/app/globals.css`
- Delete: `qizai/apps/web/src/app/upload/page.tsx`
- Delete: `qizai/apps/web/src/app/report/[id]/page.tsx`
- Delete: `qizai/apps/web/src/components/UploadForm.tsx`
- Delete: `qizai/apps/web/src/components/ReportView.tsx`
- Delete: `qizai/apps/web/src/lib/api.ts`
- Delete: `qizai/apps/web/next.config.mjs`
- Delete: `qizai/apps/web/test/components/UploadForm.test.tsx`
- Delete: `qizai/apps/web/public/`（v0.12 无内容；如存在保留）/ /如确实无内容则保留为占位符
- Modify: `qizai/apps/web/package.json` (替换 scripts / dependencies)
- Modify: `qizai/apps/web/tsconfig.json`（清理 Next.js 配置）
- Create: `qizai/apps/web/index.html`（Vite 入口）
- Create: `qizai/apps/web/vite.config.ts`（如不存在则创建）
- Create: `qizai/apps/web/src/main.tsx`（ReactDOM.createRoot 入口）
- Create: `qizai/apps/web/src/App.tsx`（<Hero /> 占位，Task 5 才填实际内容）
- Create: `qizai/apps/web/src/index.css`（@import Instrument Serif + @tailwind directives）

**Interfaces:**
- Consumes: 无（首任务）
- Produces: `package.json scripts: dev / build / preview / test / typecheck`，Vite 启动一个空白 React 页面

- [ ] **Step 1: 删除 v0.12 Next.js 文件**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web
rm -f src/app/layout.tsx src/app/page.tsx src/app/globals.css src/app/upload/page.tsx src/app/report/\[id\]/page.tsx
rm -rf src/app src/components src/lib test/components
```

- [ ] **Step 2: 删除 Next.js 配置文件**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web
rm -f next.config.mjs
```

- [ ] **Step 3: 写测试 - Vite 配置正确存在**

**File**: `qizai/apps/web/test/vite-config-exists.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';

describe('Vite setup', () => {
  it('has vite.config.ts', () => {
    expect(existsSync('./vite.config.ts')).toBe(true);
  });
  it('has index.html', () => {
    expect(existsSync('./index.html')).toBe(true);
  });
});
```

- [ ] **Step 4: 运行测试验证失败**

Run: `cd /Users/opc-1/Downloads/O/qizai && pnpm --filter @qizai/web test`
Expected: FAIL — "vite.config.ts" not exists

- [ ] **Step 5: 创建 vite.config.ts**

**File**: `qizai/apps/web/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: false,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
  },
});
```

- [ ] **Step 6: 创建 Vite 入口 HTML**

**File**: `qizai/apps/web/index.html`

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>qizai 骑仔 — 中文 AI 内容流量预测</title>
  </head>
  <body class="bg-black">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: 创建 vitest setup 文件**

**File**: `qizai/apps/web/test/setup.ts`

```typescript
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 8: 修改 tsconfig.json**

**File**: `qizai/apps/web/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "test", "vite.config.ts"]
}
```

- [ ] **Step 9: 修改 package.json**

**File**: `qizai/apps/web/package.json`

```json
{
  "name": "@qizai/web",
  "version": "0.13.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "lucide-react": "^0.460.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^7.0.0",
    "@testing-library/react": "^16.3.2",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "@types/node": "^20.10.0",
    "autoprefixer": "^10.4.0",
    "jsdom": "^29.1.1",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 10: 创建 src/index.css（包含 @import Instrument Serif + @tailwind）**

**File**: `qizai/apps/web/src/index.css`

```css
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 11: 创建 src/main.tsx**

**File**: `qizai/apps/web/src/main.tsx`

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 12: 创建 src/App.tsx（占位）**

**File**: `qizai/apps/web/src/App.tsx`

```typescript
export default function App() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <h1 style={{ fontFamily: "'Instrument Serif', serif" }}>qizai scaffold</h1>
    </main>
  );
}
```

- [ ] **Step 13: 安装新依赖 + 删除旧依赖**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web
pnpm add lucide-react@^0.460.0
pnpm remove next 2>/dev/null || true
pnpm install
```

- [ ] **Step 14: 跑测试 + typecheck**

```bash
cd /Users/opc-1/Downloads/O/qizai
pnpm --filter @qizai/web test
pnpm --filter @qizai/web typecheck
```

Expected:
- 2 tests pass (vite-config-exists)
- typecheck clean

- [ ] **Step 15: 验证 Vite dev 能启动**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web
pnpm dev &
DEV_PID=$!
sleep 5
kill $DEV_PID 2>/dev/null || true
curl -s http://localhost:5173 2>/dev/null | head -3
```

Expected: 看到 `<title>qizai 骑仔</title>` 或 Vite 占位 HTML

- [ ] **Step 16: 提交**

```bash
cd /Users/opc-1/Downloads/O/qizai
git add apps/web/
git commit -m "feat(web): replace Next.js 14 with Vite + React 18 SPA scaffold"
```

---

## Task 2: Liquid Glass CSS + 单元测试

**Files:**
- Create: `qizai/apps/web/src/styles/liquid-glass.css`（.liquid-glass class + ::before pseudo）
- Modify: `qizai/apps/web/src/index.css`（import liquid-glass）
- Test: `qizai/apps/web/test/styles/liquid-glass.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `.liquid-glass` CSS className，可在任何 JSX 中应用

- [ ] **Step 1: 写失败的测试**

**File**: `qizai/apps/web/test/styles/liquid-glass.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('liquid-glass.css', () => {
  const css = readFileSync(
    join(__dirname, '../../src/styles/liquid-glass.css'),
    'utf-8'
  );

  it('defines .liquid-glass class', () => {
    expect(css).toMatch(/\.liquid-glass\s*\{/);
  });

  it('uses rgba(255, 255, 255, 0.01) background', () => {
    expect(css).toContain('rgba(255, 255, 255, 0.01)');
  });

  it('uses luminosity background-blend-mode', () => {
    expect(css).toContain('background-blend-mode: luminosity');
  });

  it('applies 4px backdrop-filter blur', () => {
    expect(css).toContain('backdrop-filter: blur(4px)');
    expect(css).toContain('-webkit-backdrop-filter: blur(4px)');
  });

  it('defines ::before pseudo-element with linear-gradient mask', () => {
    expect(css).toMatch(/\.liquid-glass::before\s*\{/);
    expect(css).toContain('linear-gradient(180deg');
    expect(css).toContain('-webkit-mask:');
    expect(css).toContain('mask-composite: exclude');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd /Users/opc-1/Downloads/O/qizai && pnpm --filter @qizai/web test test/styles/liquid-glass.test.ts`
Expected: FAIL — ENOENT 找不到文件

- [ ] **Step 3: 创建 liquid-glass.css（逐字移植 spec §六）**

**File**: `qizai/apps/web/src/styles/liquid-glass.css`

```css
.liquid-glass {
  background: rgba(255, 255, 255, 0.01);
  background-blend-mode: luminosity;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  border: none;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
}
.liquid-glass::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1.4px;
  background: linear-gradient(180deg,
    rgba(255, 255, 255, 0.45) 0%,
    rgba(255, 255, 255, 0.15) 20%,
    rgba(255, 255, 255, 0) 40%,
    rgba(255, 255, 255, 0) 60%,
    rgba(255, 255, 255, 0.15) 80%,
    rgba(255, 255, 255, 0.45) 100%);
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}
```

- [ ] **Step 4: 在 index.css 中导入**

**File**: `qizai/apps/web/src/index.css`

```css
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');

@import './styles/liquid-glass.css';

@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: 运行测试验证通过**

Run: `cd /Users/opc-1/Downloads/O/qizai && pnpm --filter @qizai/web test test/styles/liquid-glass.test.ts`
Expected: 6 tests pass

- [ ] **Step 6: 提交**

```bash
cd /Users/opc-1/Downloads/O/qizai
git add apps/web/src/styles/ apps/web/src/index.css apps/web/test/styles/
git commit -m "feat(web): add liquid-glass CSS class with backdrop-filter and mask border"
```

---

## Task 3: VideoBackground 组件 + RAF fade 系统

**Files:**
- Create: `qizai/apps/web/src/components/VideoBackground.tsx`
- Test: `qizai/apps/web/test/components/VideoBackground.test.tsx`

**Interfaces:**
- Consumes: 无外部依赖
- Produces: 默认导出的 React 组件 `<VideoBackground />`，无 props；内部状态管理 opacity / fade 动效

**视频 URL**（spec §十一 + 昴君确认）：`https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4`

- [ ] **Step 1: 写失败的测试 - VideoBackground 渲染 + RAF fade 行为**

**File**: `qizai/apps/web/test/components/VideoBackground.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import VideoBackground from '../../src/components/VideoBackground';

describe('VideoBackground', () => {
  let rafCallbacks: Map<number, FrameRequestCallback>;
  let rafId: number;
  let now: number;

  beforeEach(() => {
    rafCallbacks = new Map();
    rafId = 0;
    now = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = ++rafId;
      rafCallbacks.set(id, cb);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      rafCallbacks.delete(id);
    });
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function advanceFrames(count: number, msPerFrame = 16) {
    for (let i = 0; i < count; i++) {
      now += msPerFrame;
      const cbs = Array.from(rafCallbacks.values());
      rafCallbacks.clear();
      cbs.forEach(cb => cb(now));
    }
  }

  it('renders a <video> element with the cloudfront URL and translate-y-[17%]', () => {
    const { container } = render(<VideoBackground />);
    const video = container.querySelector('video');
    expect(video).toBeTruthy();
    expect(video?.getAttribute('src')).toBe(
      'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4'
    );
    const wrap = container.firstChild as HTMLElement;
    expect(wrap.className).toContain('min-h-screen');
    expect(wrap.className).toContain('bg-black');
    expect(wrap.className).toContain('overflow-hidden');
    const styleAttr = video?.getAttribute('style') ?? '';
    expect(styleAttr).toContain('translateY(17%)');
  });

  it('starts opacity at 0 then fades in to 1 over 500ms on loadeddata', () => {
    const { container } = render(<VideoBackground />);
    const video = container.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { value: 10, configurable: true });

    // Trigger loadeddata
    video.dispatchEvent(new Event('loadeddata'));

    // After ~32 frames (~500ms at 16ms/frame)
    advanceFrames(32, 16);

    const op = parseFloat(video.style.opacity);
    expect(op).toBeGreaterThanOrEqual(0.99);
  });

  it('fades out when remaining < 0.55s, and does not re-trigger', () => {
    const { container } = render(<VideoBackground />);
    const video = container.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { value: 10, configurable: true });
    video.dispatchEvent(new Event('loadeddata'));
    advanceFrames(32, 16);

    // Trigger timeUpdate near end
    Object.defineProperty(video, 'currentTime', { value: 9.6, configurable: true });
    video.dispatchEvent(new Event('timeupdate'));

    // First fade-out attempt: 32 frames should bring opacity back near 0
    advanceFrames(32, 16);
    const op1 = parseFloat(video.style.opacity);
    expect(op1).toBeLessThan(0.05);

    // Second timeUpdate should NOT re-trigger
    Object.defineProperty(video, 'currentTime', { value: 9.7, configurable: true });
    video.dispatchEvent(new Event('timeupdate'));
    advanceFrames(32, 16);
    const op2 = parseFloat(video.style.opacity);
    expect(op2).toBeLessThan(0.05);
  });

  it('on ended, resets currentTime to 0 and starts a new fade-in', () => {
    const { container } = render(<VideoBackground />);
    const video = container.querySelector('video') as HTMLVideoElement;
    const playMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(video, 'duration', { value: 10, configurable: true });
    Object.defineProperty(video, 'play', { value: playMock, configurable: true });
    Object.defineProperty(video, 'currentTime', { value: 0, configurable: true, writable: true });

    video.dispatchEvent(new Event('loadeddata'));
    advanceFrames(32, 16);

    video.dispatchEvent(new Event('ended'));
    advanceFrames(7, 16); // 100ms

    expect(video.currentTime).toBe(0);
    expect(playMock).toHaveBeenCalled();

    // After fade-in
    advanceFrames(32, 16);
    const op = parseFloat(video.style.opacity);
    expect(op).toBeGreaterThanOrEqual(0.99);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd /Users/opc-1/Downloads/O/qizai && pnpm --filter @qizai/web test test/components/VideoBackground.test.tsx`
Expected: FAIL — Cannot find VideoBackground

- [ ] **Step 3: 实现 VideoBackground 组件**

**File**: `qizai/apps/web/src/components/VideoBackground.tsx`

```typescript
import { useRef, useEffect } from 'react';

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4';

const FADE_DURATION_MS = 500;
const FADE_OUT_TRIGGER_S = 0.55;
const RESET_DELAY_MS = 100;

export default function VideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const opacityRef = useRef(0);
  const fadingOutRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const startOpacityRef = useRef(0);
  const targetOpacityRef = useRef(1);

  const cancelAnim = () => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  };

  const startFade = (toOpacity: number) => {
    cancelAnim();
    startTimeRef.current = performance.now();
    startOpacityRef.current = opacityRef.current;
    targetOpacityRef.current = toOpacity;

    const tick = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const t = Math.min(elapsed / FADE_DURATION_MS, 1);
      const newOpacity = startOpacityRef.current + (targetOpacityRef.current - startOpacityRef.current) * t;
      opacityRef.current = newOpacity;
      if (videoRef.current) {
        videoRef.current.style.opacity = String(newOpacity);
      }
      if (t < 1) {
        rafIdRef.current = requestAnimationFrame(tick);
      } else {
        rafIdRef.current = null;
      }
    };
    rafIdRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoadedData = () => {
      fadingOutRef.current = false;
      startFade(1);
    };

    const onTimeUpdate = () => {
      if (fadingOutRef.current) return;
      const remaining = (video.duration || 0) - video.currentTime;
      if (remaining > 0 && remaining < FADE_OUT_TRIGGER_S) {
        fadingOutRef.current = true;
        startFade(0);
      }
    };

    const onEnded = () => {
      fadingOutRef.current = false;
      opacityRef.current = 0;
      if (videoRef.current) videoRef.current.style.opacity = '0';
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.currentTime = 0;
          videoRef.current.play();
        }
        startFade(1);
      }, RESET_DELAY_MS);
    };

    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEnded);

    return () => {
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('ended', onEnded);
      cancelAnim();
    };
  }, []);

  return (
    <div className="min-h-screen bg-black overflow-hidden absolute inset-0 -z-10">
      <video
        ref={videoRef}
        src={VIDEO_URL}
        muted
        autoPlay
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: 'translateY(17%)', opacity: 0 }}
      />
    </div>
  );
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd /Users/opc-1/Downloads/O/qizai && pnpm --filter @qizai/web test test/components/VideoBackground.test.tsx`
Expected: 4 tests pass

- [ ] **Step 5: 提交**

```bash
cd /Users/opc-1/Downloads/O/qizai
git add apps/web/src/components/VideoBackground.tsx apps/web/test/components/VideoBackground.test.tsx
git commit -m "feat(web): add VideoBackground with RAF-based fade system"
```

---

## Task 4: NavBar / HeroContent / SocialFooter 三个组件 + 中文文案

**Files:**
- Create: `qizai/apps/web/src/components/NavBar.tsx`
- Create: `qizai/apps/web/src/components/HeroContent.tsx`
- Create: `qizai/apps/web/src/components/SocialFooter.tsx`
- Test: `qizai/apps/web/test/components/NavBar.test.tsx`
- Test: `qizai/apps/web/test/components/HeroContent.test.tsx`
- Test: `qizai/apps/web/test/components/SocialFooter.test.tsx`

**Interfaces:**
- Consumes: liquid-glass CSS class (Task 2)
- Produces: 三个默认导出组件，所有 onClick 用 `console.log` 或 `alert('敬请期待 /predict')` 占位

### 4A: NavBar

- [ ] **Step 1: 写 NavBar 测试**

**File**: `qizai/apps/web/test/components/NavBar.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NavBar from '../../src/components/NavBar';

describe('NavBar', () => {
  it('renders qizai brand with Globe icon', () => {
    render(<NavBar />);
    expect(screen.getByText('qizai')).toBeInTheDocument();
  });

  it('renders three Chinese nav links (功能 / 定价 / 关于)', () => {
    render(<NavBar />);
    expect(screen.getByText('功能')).toBeInTheDocument();
    expect(screen.getByText('定价')).toBeInTheDocument();
    expect(screen.getByText('关于')).toBeInTheDocument();
  });

  it('renders 开始预测 button and 登录 button', () => {
    render(<NavBar />);
    expect(screen.getByRole('button', { name: '开始预测' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
  });

  it('登录 button has liquid-glass class', () => {
    render(<NavBar />);
    const loginBtn = screen.getByRole('button', { name: '登录' });
    expect(loginBtn.className).toContain('liquid-glass');
  });

  it('calls console.log on 开始预测 click', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    render(<NavBar />);
    await userEvent.click(screen.getByRole('button', { name: '开始预测' }));
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
```

- [ ] **Step 2: 实现 NavBar**

**File**: `qizai/apps/web/src/components/NavBar.tsx`

```typescript
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
            <a href="#features" className="text-white/80 hover:text-white transition-colors text-sm font-medium">
              功能
            </a>
            <a href="#pricing" className="text-white/80 hover:text-white transition-colors text-sm font-medium">
              定价
            </a>
            <a href="#about" className="text-white/80 hover:text-white transition-colors text-sm font-medium">
              关于
            </a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={toast('敬请期待 /predict')}
            className="text-white text-sm font-medium"
          >
            开始预测
          </button>
          <button
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

- [ ] **Step 3: 安装 user-event（如果未在 devDeps）**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web
pnpm add -D @testing-library/user-event@^14.5.0
```

- [ ] **Step 4: 跑测试**

Run: `cd /Users/opc-1/Downloads/O/qizai && pnpm --filter @qizai/web test test/components/NavBar.test.tsx`
Expected: 5 tests pass

### 4B: HeroContent

- [ ] **Step 5: 写 HeroContent 测试**

**File**: `qizai/apps/web/test/components/HeroContent.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HeroContent from '../../src/components/HeroContent';

describe('HeroContent', () => {
  it('renders heading "你的内容会爆吗？" with Instrument Serif font', () => {
    render(<HeroContent />);
    const heading = screen.getByRole('heading', { name: '你的内容会爆吗？' });
    expect(heading).toBeInTheDocument();
    expect(heading.style.fontFamily).toBe("'Instrument Serif', serif");
  });

  it('renders input placeholder "输入你的内容标题"', () => {
    render(<HeroContent />);
    expect(screen.getByPlaceholderText('输入你的内容标题')).toBeInTheDocument();
  });

  it('renders subtitle text', () => {
    render(<HeroContent />);
    expect(
      screen.getByText(/先问 1000 个 persona，再决定要不要发布/)
    ).toBeInTheDocument();
  });

  it('renders Manifesto button "了解工作原理"', () => {
    render(<HeroContent />);
    expect(screen.getByRole('button', { name: '了解工作原理' })).toBeInTheDocument();
  });

  it('form input wrapper has liquid-glass class', () => {
    render(<HeroContent />);
    const input = screen.getByPlaceholderText('输入你的内容标题');
    const form = input.closest('form');
    expect(form?.className).toContain('liquid-glass');
  });

  it('on submit, calls console.log with the title', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    render(<HeroContent />);
    const input = screen.getByPlaceholderText('输入你的内容标题');
    await userEvent.type(input, '三招教你选对洗面奶');
    await userEvent.click(screen.getByRole('button', { name: /arrow-right/i }).querySelector('button') ?? input);
    expect(log).toHaveBeenCalledWith('敬请期待 /predict', '三招教你选对洗面奶');
    log.mockRestore();
  });
});
```

- [ ] **Step 6: 实现 HeroContent**

**File**: `qizai/apps/web/src/components/HeroContent.tsx`

```typescript
import { useState, FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';

export default function HeroContent() {
  const [title, setTitle] = useState('');

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('敬请期待 /predict', title);
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
        <form className="liquid-glass rounded-full pl-6 pr-2 py-2 flex items-center gap-3" onSubmit={handleSubmit}>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="输入你的内容标题"
            className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/40 text-base py-1"
          />
          <button type="submit" className="bg-white rounded-full p-3 text-black hover:bg-white/90 transition-colors">
            <ArrowRight size={20} />
          </button>
        </form>
        <p className="text-white text-sm leading-relaxed px-4">
          先问 1000 个 persona，再决定要不要发布——小红书 / 抖音 / B站 流量预测 co-pilot
        </p>
        <button className="liquid-glass rounded-full px-8 py-3 text-white text-sm font-medium hover:bg-white/5 transition-colors">
          了解工作原理
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: 跑测试**

Run: `cd /Users/opc-1/Downloads/O/qizai && pnpm --filter @qizai/web test test/components/HeroContent.test.tsx`
Expected: 6 tests pass

### 4C: SocialFooter

- [ ] **Step 8: 写 SocialFooter 测试**

**File**: `qizai/apps/web/test/components/SocialFooter.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SocialFooter from '../../src/components/SocialFooter';

describe('SocialFooter', () => {
  it('renders 3 social icon buttons with proper aria-labels', () => {
    render(<SocialFooter />);
    expect(screen.getByRole('button', { name: '小红书' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '抖音' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'B站' })).toBeInTheDocument();
  });

  it('all 3 buttons have liquid-glass class', () => {
    render(<SocialFooter />);
    const xhs = screen.getByRole('button', { name: '小红书' });
    const dy = screen.getByRole('button', { name: '抖音' });
    const bili = screen.getByRole('button', { name: 'B站' });
    expect(xhs.className).toContain('liquid-glass');
    expect(dy.className).toContain('liquid-glass');
    expect(bili.className).toContain('liquid-glass');
  });

  it('wrapper has bottom padding pb-12', () => {
    const { container } = render(<SocialFooter />);
    const wrap = container.firstChild as HTMLElement;
    expect(wrap.className).toContain('pb-12');
  });
});
```

- [ ] **Step 9: 实现 SocialFooter**

**File**: `qizai/apps/web/src/components/SocialFooter.tsx`

```typescript
import { Globe } from 'lucide-react';

const SOCIALS = [
  { label: '小红书', icon: Globe },
  { label: '抖音', icon: Globe },
  { label: 'B站', icon: Globe },
] as const;

export default function SocialFooter() {
  return (
    <div className="relative z-10 flex justify-center gap-4 pb-12">
      {SOCIALS.map(({ label, icon: Icon }) => (
        <button
          key={label}
          aria-label={label}
          className="liquid-glass rounded-full p-4 text-white/80 hover:text-white hover:bg-white/5 transition-all"
        >
          <Icon size={20} />
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 10: 跑测试**

Run: `cd /Users/opc-1/Downloads/O/qizai && pnpm --filter @qizai/web test test/components/SocialFooter.test.tsx`
Expected: 3 tests pass

- [ ] **Step 11: 跑全部 web 测试 + typecheck**

```bash
cd /Users/opc-1/Downloads/O/qizai
pnpm --filter @qizai/web test
pnpm --filter @qizai/web typecheck
```

Expected: 16 tests pass + typecheck clean (2 + 6 + 5 + 4 + 3 = ... wait that's 20)

> Recount: Task 1: 2 (vite setup) + Task 2: 6 (liquid-glass) + Task 3: 4 (VideoBackground) + Task 4: 5+6+3 = 14 (NavBar/HeroContent/SocialFooter) = **26 tests pass + typecheck clean**

- [ ] **Step 12: 提交**

```bash
cd /Users/opc-1/Downloads/O/qizai
git add apps/web/src/components/NavBar.tsx apps/web/src/components/HeroContent.tsx apps/web/src/components/SocialFooter.tsx
git add apps/web/test/components/
git commit -m "feat(web): add NavBar, HeroContent, SocialFooter with Chinese copy"
```

---

## Task 5: Hero 组装 + App 接入 + README 更新

**Files:**
- Create: `qizai/apps/web/src/components/Hero.tsx`
- Modify: `qizai/apps/web/src/App.tsx`（用 <Hero /> 替换占位）
- Test: `qizai/apps/web/test/components/Hero.test.tsx`
- Modify: `qizai/scripts/deploy.sh`（更新为 vite build + dist/）
- Modify: `qizai/apps/web/README.md`（如不存在则新建）

**Interfaces:**
- Consumes: VideoBackground / NavBar / HeroContent / SocialFooter（从 Tasks 1-4）
- Produces: Hero 默认导出组件，在 App.tsx 中渲染

- [ ] **Step 1: 写 Hero 测试**

**File**: `qizai/apps/web/test/components/Hero.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Hero from '../../src/components/Hero';

describe('Hero', () => {
  it('renders all 4 child components', () => {
    render(<Hero />);
    // NavBar
    expect(screen.getByText('qizai')).toBeInTheDocument();
    // HeroContent
    expect(screen.getByRole('heading', { name: '你的内容会爆吗？' })).toBeInTheDocument();
    // SocialFooter
    expect(screen.getByRole('button', { name: '小红书' })).toBeInTheDocument();
    // VideoBackground
    expect(document.querySelector('video')).toBeInTheDocument();
  });

  it('top-level wrapper has min-h-screen bg-black overflow-hidden', () => {
    const { container } = render(<Hero />);
    const wrap = container.firstChild as HTMLElement;
    expect(wrap.className).toContain('min-h-screen');
    expect(wrap.className).toContain('bg-black');
    expect(wrap.className).toContain('overflow-hidden');
  });
});
```

- [ ] **Step 2: 实现 Hero**

**File**: `qizai/apps/web/src/components/Hero.tsx`

```typescript
import VideoBackground from './VideoBackground';
import NavBar from './NavBar';
import HeroContent from './HeroContent';
import SocialFooter from './SocialFooter';

export default function Hero() {
  return (
    <div className="min-h-screen bg-black overflow-hidden relative">
      <VideoBackground />
      <NavBar />
      <div className="flex flex-col min-h-screen">
        <div className="flex-1">
          <HeroContent />
        </div>
        <SocialFooter />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 更新 App.tsx**

**File**: `qizai/apps/web/src/App.tsx`

```typescript
import Hero from './components/Hero';

export default function App() {
  return <Hero />;
}
```

- [ ] **Step 4: 跑全部测试**

Run: `cd /Users/opc-1/Downloads/O/qizai && pnpm --filter @qizai/web test`
Expected: 所有测试 pass（新增 2 个 Hero tests → 共 28 tests pass）

- [ ] **Step 5: typecheck**

Run: `cd /Users/opc-1/Downloads/O/qizai && pnpm --filter @qizai/web typecheck`
Expected: clean

- [ ] **Step 6: 真实 build 验证**

```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web
pnpm build
ls -la dist/
```

Expected: `dist/` 目录存在，包含 `index.html` + `assets/*.js` + `assets/*.css`

- [ ] **Step 7: 更新 deploy.sh（vite build 替换 next build）**

**Modify**: `qizai/scripts/deploy.sh`（如不存在需创建）

定位 `pnpm run build` 和 `out` 路径 → 替换为：
```bash
cd /Users/opc-1/Downloads/O/qizai/apps/web
pnpm run build
wrangler pages deploy dist --project-name qizai-web --branch main
```

具体 patch：
```bash
# Replace lines containing "pnpm run build" + next build context to vite build
sed -i '' 's|pnpm run build|pnpm run build|g' /Users/opc-1/Downloads/O/qizai/scripts/deploy.sh
# And update the wrangler pages deploy target from out/ to dist/
sed -i '' 's|wrangler pages deploy out|wrangler pages deploy ../web/dist|g' /Users/opc-1/Downloads/O/qizai/scripts/deploy.sh
```

Verify the change:
```bash
grep -E "build|dist|out" /Users/opc-1/Downloads/O/qizai/scripts/deploy.sh
```

Expected: 看到 `vite build` / `dist/` 路径

- [ ] **Step 8: 更新 README 顶层（保持原 README 风格，仅更新 build 命令）**

**File**: `qizai/apps/web/README.md`（新文件）

```markdown
# qizai Web (v0.13.A)

Vite + React 18 单屏首页 hero。

## 开发

```bash
cd apps/web
pnpm dev       # http://localhost:5173
pnpm build     # 产出 dist/
pnpm preview   # 预览 dist/
pnpm test      # vitest
pnpm typecheck # tsc --noEmit
```

## 视频源

v0.13.A 阶段直接使用 cloudfront URL：
`https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4`

Phase 2 上线前会下载到 `apps/web/public/videos/hero.mp4`，URL 替换。
```

- [ ] **Step 9: 提交**

```bash
cd /Users/opc-1/Downloads/O/qizai
git add apps/web/src/components/Hero.tsx apps/web/src/App.tsx
git add apps/web/test/components/Hero.test.tsx
git add apps/web/README.md scripts/deploy.sh
git commit -m "feat(web): assemble Hero layout + update deploy.sh for Vite build"
```

---

## 任务完成度自审清单（v0.13.A）

| Spec 章节 | 任务 | 状态 |
|----------|------|------|
| §一 目标 | Task 5 | ⬜ |
| §二 内容替换表 | Task 4 + Task 5 | ⬜ |
| §三 技术栈 | Task 1 | ⬜ |
| §四 文件结构 | Task 1-5 | ⬜ |
| §五.5.1 VideoBackground | Task 3 | ⬜ |
| §五.5.2 NavBar | Task 4A | ⬜ |
| §五.5.3 HeroContent | Task 4B | ⬜ |
| §五.5.4 SocialFooter | Task 4C | ⬜ |
| §五.5.5 Hero 组装 | Task 5 | ⬜ |
| §六 Liquid Glass CSS | Task 2 | ⬜ |
| §七 字体引入（Instrument Serif）| Task 1（index.css @import）+ Task 4B（hero 应用）| ⬜ |
| §八 TDD 测试计划 | 全部 Tasks | ⬜ |
| §十一 与 v0.12 关系 | Task 1（清理 Next.js）+ Task 5（deploy.sh 更新）| ⬜ |

**已知遗留**（v0.13.B 才做）：
- /predict 路由 + /about + /pricing
- react-router v6 多路由
- 小红书 / 抖音 / B站 品牌 SVG（v0.13.A 用 Globe 占位）
- 视频本地化（上线前下载到 public/videos/hero.mp4）

---

**Plan 完成并保存到 `/Users/opc-1/Downloads/O/qizai/docs/superpowers/plans/2026-07-23-qizai-v013a-homepage-hero.md`**

## 🚀 执行选项

**两个执行路径供昴君选择：**

### 1. Subagent-Driven（推荐）

- 每个 Task 派遣独立 subagent
- 蕾姆作为 reviewer 在任务之间审查
- 快速迭代，质量保证

### 2. Inline Execution

- 在当前会话直接执行
- 批量执行 + checkpoint review
- 上下文连续，但 review 较少

---

**昴君的选择？** ♪

**（请选择 1 / 2）**

(蕾姆轻轻整理计划文件，等待指示)
