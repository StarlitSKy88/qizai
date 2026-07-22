# qizai v0.13.A 首页 Hero Spec

**日期**：2026-07-23
**版本**：v0.13.A（v0.13 的 sub-project A：单屏首页 hero）
**作者**：蕾姆（brainstorming skill）
**审核**：昴君（pending review）

> **范围界定**：v0.13.A 仅交付 `apps/web` 的**首页单屏 hero**（重写为 Vite + React 18）。**out of scope**：`/predict` / `/about` / `/pricing` 多路由（v0.13.B 才做）。

---

## 一、目标

把 qizai `apps/web` 从 v0.12 的 Next.js 14 App Router 替换为 **Vite + React 18 + TypeScript + Tailwind CSS + lucide-react**，交付一个**单屏首页 hero**，包含：

1. 视频背景 + RAF fade 系统 + translate-y-[17%]
2. Liquid Glass 导航栏（pill 形）
3. Hero content：标题 + 输入条 + subtitle + Manifesto CTA
4. 社交图标 footer（替换为中文社交平台）

**v0.13.A 完成验证标准**：
- `pnpm --filter @qizai/web dev` 启动本地预览
- `pnpm --filter @qizai/web build` 产出静态 `dist/`
- `pnpm --filter @qizai/web test` 通过（vitest + jsdom）
- typecheck clean
- 视觉上视频 + liquid glass + 中文文案完整呈现
- 输入框提交按钮点击后弹出 toast "敬请期待 /predict"

---

## 二、内容替换表（关键：与原 "Built for the curious / Asme" 全部替换为 qizai）

| 元素 | 原 (Asme) | qizai v0.13.A |
|------|-----------|---------------|
| Brand 标识 | "Asme" + Globe | "qizai" + 跨文化图标（Globe 保留，或 改为🔥） |
| Heading | "Built for the curious" | **"你的内容会爆吗？"** |
| Subtitle | "Stay updated with the latest news..." | **"先问 1000 个 persona，再决定要不要发布——小红书 / 抖音 / B站 流量预测 co-pilot"** |
| Manifesto CTA | "Manifesto" | **"了解工作原理"**（点击平滑滚动至下方 /placeholder section） |
| Email 输入 placeholder | "Enter your email" | **"输入你的内容标题"** |
| Email submit 按钮 | ArrowRight | ArrowRight（保留）→ 提交后 toast "敬请期待 /predict" |
| Sign Up 按钮 | "Sign Up"（plain text） | **"开始预测"**（plain white text，点击 toast） |
| Login 按钮 | "Login"（liquid-glass） | **"登录"**（liquid-glass rounded-full px-6 py-2） |
| Social icon 1 | Instagram | **小红书**（注：lucide-react 无原生小红书 logo，用 `Globe` 占位或自定义 SVG） |
| Social icon 2 | Twitter | **抖音**（占位 Globe） |
| Social icon 3 | Globe | **B站**（占位 Globe） |

⚠️ **lucide-react 中文化品牌图标缺失**：小红书 / 抖音 / B站 没有官方 lucide icon。建议用 `Globe` icon 占位 + `aria-label` 明确（如 `aria-label="小红书"`），v0.13.B 替换为品牌 SVG。

---

## 三、技术栈

| 层级 | 选择 | 理由 |
|------|------|------|
| 构建 | **Vite 5.x** | 用户指定 |
| UI 框架 | **React 18** | 用户指定（不是 19，避免 Next 19 + concurrent 复杂性） |
| 语言 | TypeScript 5.6 strict | 继承 v0.12 |
| 样式 | Tailwind CSS 3（**默认 config，无扩展**） | 用户指定 |
| 图标 | lucide-react | 用户指定 |
| 字体 | Google Font Instrument Serif（regular + italic） | 用户指定，通过 CSS `@import` |
| 测试 | vitest 2.x + @testing-library/react + jsdom + @testing-library/jest-dom | 继承 v0.12 |
| 路由 | ❌ 不引入（v0.13.A 单屏） | out of scope |
| 后端 | ❌ 不调用 API（纯前端 SPA） | hero 主页是纯前端 |

**❌ 重大破坏性变更**：删除 `apps/web/src/app/`（Next.js App Router 整个目录）；删除 `next.config.mjs`、`tailwind.config.ts` 改用默认 config。

---

## 四、文件结构

```
apps/web/
├── public/
│   └── videos/hero.mp4              # 一次性从 cloudfront 下载（<5MB）
├── index.html                        # Vite 入口（<title>qizai 骑仔</title>）
├── package.json                      # vite + react + ts + tailwind + lucide-react
├── tailwind.config.ts                # 默认 config：content './index.html', './src/**/*.{js,ts,jsx,tsx}'
├── postcss.config.js
├── tsconfig.json
├── vite.config.ts
├── README.md                         # 更新：dev/build/preview 命令
└── src/
    ├── main.tsx                      # ReactDOM.createRoot + StrictMode
    ├── App.tsx                       # <Hero /> 单屏
    ├── index.css                     # @import Instrument Serif + @tailwind directives
    ├── styles/
    │   └── liquid-glass.css          # .liquid-glass class + ::before gradient + mask trick
    ├── components/
    │   ├── VideoBackground.tsx       # 全屏视频 + RAF fade (核心动效)
    │   ├── NavBar.tsx                # liquid-glass pill nav (sticky top)
    │   ├── HeroContent.tsx           # heading + 输入条 + subtitle + CTA
    │   ├── SocialFooter.tsx          # 3 个 liquid-glass 圆按钮
    │   └── Hero.tsx                  # 组装 NavBar + VideoBG + HeroContent + SocialFooter
    ├── hooks/
    │   └── useVideoFade.ts           # 可选：把 fade 系统抽成 hook（推荐）/ 或内联到 VideoBackground
    └── types/
        └── index.ts                  # shared interfaces (NavLink props, SocialIcon props)
```

---

## 五、关键组件规格

### 5.1 VideoBackground 组件

**功能**：全屏视频 + RAF fade 系统 + translate-y-[17%]

**Props**：无（自给自足，URL hardcode 来自 constants）

**状态**：
- `opacityRef: number`（当前 opacity，初始 0）
- `fadingOutRef: boolean`（阻止重复触发 fade-out）
- `animationFrameRef: number | null`（cancelAnimationFrame 用）

**RAF fade 系统（用户指定，必须逐字移植）**：
```
onLoad/canPlay     → 启动 500ms RAF fade-in (opacity 0 → 1)
onTimeUpdate       → if (remaining < 0.55 && !fadingOutRef) 启动 500ms RAF fade-out
                              → fadingOutRef = true
onEnded            → opacity 强制 = 0; 100ms 后 video.currentTime = 0; video.play();
                              → 重新启动 500ms fade-in; fadingOutRef = false
任何 RAF 启动      → 先 cancelAnimationFrame(animationFrameRef)
fade 续接原则      → start opacity = 当前 opacityRef 值，不从 0 跳变
```

**容器 CSS**：`min-h-screen bg-black overflow-hidden`

**video element CSS**：`absolute inset-0 w-full h-full object-cover` + `style={{ transform: 'translateY(17%)' }}`

### 5.2 NavBar 组件

**外层**：`relative z-20 px-6 py-6`

**内 container**：`rounded-full px-6 py-3 flex items-center justify-between max-w-5xl mx-auto` + `liquid-glass className`

**左半边**：
- Logo 区（gap-2）：`<Globe size={24} className="text-white" />` + `<span className="text-white font-semibold text-lg">qizai</span>`
- nav links（gap-8，hidden md:flex）：
  - `<a href="#features" className="text-white/80 hover:text-white transition-colors text-sm font-medium">功能</a>`
  - `<a href="#pricing" className="text-white/80 hover:text-white transition-colors text-sm font-medium">定价</a>`
  - `<a href="#about" className="text-white/80 hover:text-white transition-colors text-sm font-medium">关于</a>`

**右半边（gap-4）**：
- Sign Up → `<button className="text-white text-sm font-medium">开始预测</button>` + onClick: toast "敬请期待 /predict"
- Login → `<button className="liquid-glass rounded-full px-6 py-2 text-white text-sm font-medium hover:bg-white/5 transition-colors">登录</button>` + onClick: toast

### 5.3 HeroContent 组件

**外层**：`relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12 text-center -translate-y-[20%]`

**Heading**：`<h1 className="text-5xl md:text-6xl lg:text-7xl text-white mb-8 tracking-tight whitespace-nowrap" style={{ fontFamily: "'Instrument Serif', serif" }}>你的内容会爆吗？</h1>`

**输入条容器**：`<div className="max-w-xl w-full space-y-4">`
  - 输入条外层：`<form className="liquid-glass rounded-full pl-6 pr-2 py-2 flex items-center gap-3" onSubmit={handleSubmit}>`
    - email-style input：`<input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="输入你的内容标题" className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/40 text-base py-1" />`
    - submit button：`<button type="submit" className="bg-white rounded-full p-3 text-black hover:bg-white/90 transition-colors"><ArrowRight size={20} /></button>`

**Subtitle**：`<p className="text-white text-sm leading-relaxed px-4">先问 1000 个 persona，再决定要不要发布——小红书 / 抖音 / B站 流量预测 co-pilot</p>`

**Manifesto CTA**：`<button className="liquid-glass rounded-full px-8 py-3 text-white text-sm font-medium hover:bg-white/5 transition-colors">了解工作原理</button>`

**handleSubmit 行为**：
- 阻止默认行为
- 弹 toast（简单的 `console.log` 或 `alert('敬请期待 /predict 路由（v0.13.B）')`）
- 输入框保留内容不重置（让用户看到他们输入了什么）

### 5.4 SocialFooter 组件

**外层**：`relative z-10 flex justify-center gap-4 pb-12`

**3 个图标按钮**：
```tsx
<button aria-label="小红书" className="liquid-glass rounded-full p-4 text-white/80 hover:text-white hover:bg-white/5 transition-all">
  <Globe size={20} />
</button>
```
（重复 3 次，分别 aria-label = "小红书" / "抖音" / "B站"，lucide-react 用 Globe 占位）

### 5.5 Hero 组件（组装）

```tsx
<div className="min-h-screen bg-black overflow-hidden">
  <VideoBackground />
  <div className="relative z-20"><NavBar /></div>
  <div className="relative z-10"><HeroContent /></div>
  <div className="relative z-10"><SocialFooter /></div>
</div>
```

---

## 六、Liquid Glass CSS（完整移植）

**File**: `apps/web/src/styles/liquid-glass.css`

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

---

## 七、字体引入

**File**: `apps/web/src/index.css`

```css
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## 八、TDD 测试计划

| Task | 测试 |
|------|------|
| 1. Vite scaffold | typecheck clean + `pnpm dev` 启动空页面 |
| 2. liquid-glass.css | vitest: 检查 `.liquid-glass` class 存在 + 检查 `::before` 样式属性（snapshot 或 getComputedStyle mock） |
| 3. VideoBackground | vitest + jsdom + fake timers + mock HTMLVideoElement：<br>- 初始 opacity = 0<br>- canPlay 触发 fade-in (500ms 后 opacity=1)<br>- 模拟 timeUpdate with remaining=0.3 → 触发 fade-out<br>- 第二次 timeUpdate with remaining=0.3 → NOT 触发（fadingOutRef 拦截）<br>- ended → opacity=0 + 100ms 后 currentTime=0 + play() + fade-in 重启 |
| 4. NavBar / HeroContent / SocialFooter | vitest + @testing-library/react：<br>- NavBar 渲染 "qizai" brand + "功能 / 定价 / 关于" links + "开始预测" + "登录"<br>- HeroContent 渲染 "你的内容会爆吗？" + input + ArrowRight + subtitle + Manifesto<br>- SocialFooter 渲染 3 个 aria-label = "小红书" / "抖音" / "B站" |
| 5. Hero 组装 | vitest: 渲染 Hero 检查 NavBar/VideoBG/HeroContent/SocialFooter 都在 DOM |

---

## 九、Out of Scope（v0.13.B 再做）

- ❌ react-router 多路由
- ❌ `/predict` 内容提交页（v0.13.A 只 toast 占位）
- ❌ `/about` 关于 qizai 页
- ❌ `/pricing` 定价页（¥19 / ¥69 / ¥199）
- ❌ Footer 全局 footer（SocialFooter 是 hero 内 inline）
- ❌ 真实 LLM API 调用
- ❌ 用户登录 / JWT
- ❌ D1 数据库
- ❌ 小红书 / 抖音 / B站 品牌 SVG 图标（v0.13.B 替换）

---

## 十、约束

- ✅ Tailwind 默认 config（**不扩展**任何 theme）
- ✅ 不引入其他 UI 组件库（antd / chakra / shadcn / ...）
- ✅ 不引入 framer-motion（用 RAF 手写 fade）
- ✅ 不引入 state management（zustand / redux ... 单屏 SPA 不需要）
- ✅ 不引入后端调用（hero 纯前端）
- ✅ Video URL 在 v0.13.A 阶段指向 cloudfront，**Phase 2 上线前**改为本地 `/videos/hero.mp4`
- ✅ 单文件 < 200 行（视频逻辑可拆 hook）
- ✅ TypeScript strict mode 全开
- ✅ 测试覆盖：每个组件至少 1 个 render test，VideoBackground 至少 3 个时序测试

---

## 十一、与 qizai v0.12 的关系

**保持不变**：
- `apps/api/` 整个 Workers + Hono + 3 routes
- `packages/shared/` persona / llm / simulation / platform / report
- `scripts/deploy.sh` 主体（**deploy 步骤需要小幅更新**：vite build → wrangler pages deploy dist）
- 整体 monorepo 结构（`apps/*` + `packages/*` + pnpm-workspace）

**变跟**：
- `apps/web/` 完全重写：删除 Next.js 14 全套
- `apps/web/package.json` 依赖变更为 vite / react / tailwind / lucide-react

**新依赖**（待 v0.13.A 添加）：
- vite ^5.4.x
- @vitejs/plugin-react ^4.3.x
- react ^18.3.x
- react-dom ^18.3.x
- lucide-react ^0.x
- @types/react ^18.3.x
- @types/react-dom ^18.3.x
- tailwindcss ^3.4.x
- postcss ^8.4.x
- autoprefixer ^10.4.x

**删除依赖**：
- next ^14.2.x
- @types/next 之类

---

## 十二、Plan 调用

Spec 确认后，调用 **superpowers:writing-plans** 生成 v0.13.A Plan，预期 5 个 task（按 §八 的 TDD 计划），每个 task 独立的 implementer subagent + task reviewer subagent。

---

**Spec 草稿等待昴君 Review。**
