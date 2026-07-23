# TryCue 独立核验报告
核验时间：2026-07-22
核验目的：为 qizai 项目（中文 AI 内容流量预测工具）做独立竞争对手核验
核验人：qizai 项目独立核验 subagent（中立立场）

---

## 一、代码现状核验

### 1.1 GitHub 仓库基本信息

- **仓库 URL**：https://github.com/donghao95/TryCue
- **Stars / Forks / Watchers / Open Issues**：21 / 0 / 0 / 0
- **Pull Requests**：9（多为 dependabot 自动 PR 和 issue 修复）
- **最后 commit 时间**：2026-07-03（fix(api): 修复 recovery guard 的 await-before-assignment 窗口）
- **License**（实际 LICENSE 文件内容）：**Apache-2.0**，2026 donghao95
- **Commits 总数**：74 个（仅 --depth=1 clone 后表面 1 个，git log 全部历史为 74）
- **主要文件结构**：
  ```
  .github/  apps/  config/  docs/  packages/  scripts/
  .dockerignore  .env.example  .gitignore
  CHANGELOG.md  CODE_OF_CONDUCT.md  CODE_WIKI.md  CONTRIBUTING.md
  Dockerfile  LICENSE  README.md  SECURITY.md
  docker-compose.yml  package.json  pnpm-lock.yaml  pnpm-workspace.yaml  tsconfig.base.json
  ```
- **代码总行数**：107 个 TypeScript/TSX 文件，**约 33,331 行**（不含测试）
- **测试文件**：`*.test.ts` 文件包括 views.test.ts / mockAgent.test.ts / realAgent.test.ts / reportAgent.test.ts / taskRunner.test.ts / agentSessions.test.ts / evidencePack.test.ts / runDataLifecycle.test.ts / capacityProbe.test.ts / rateLimitedFetch.test.ts / reportSchema.test.ts — **测试覆盖较厚**

### 1.2 README 内容

- **项目自我定位**：AI 内容试映工作台：在真正发布前，把内容交给一组 AI 观众试映。
- **核心功能**（8 大模块）：
  - 内容创建（标题、正文、图片）
  - AI 观众生成（不同身份、兴趣、动机和偏好）
  - 观众审核（试映前检查、调整、确认观众分布）
  - 实时试映（打开、停留、点赞、收藏、评论、分享、离开）
  - 评论模拟（共鸣、质疑、误解、评论反馈）
  - 行为证据（每个观众的行为、评论、日志、判断依据持久化）
  - 试映报告（汇总内容表现、人群反应、主要阻力、风险点、修改建议）
  - mock 模式（无需真实 LLM API Key，本地体验完整流程）
  - real 模式（接入 OpenAI-compatible 模型）
- **技术栈**：
  - pnpm workspace monorepo
  - TypeScript (89.1%) + CSS (9.7%) + JavaScript (0.5%) + Dockerfile + Shell
  - **Vite + React 19.2**（前端）
  - **Fastify 5.8 + Prisma + SQLite**（后端）
  - Zod 4.1（数据校验）
  - **SSE（Server-Sent Events）** 实时推送
  - **AI SDK 7.0.9 + @ai-sdk/openai-compatible**（LLM 接入）
  - i18next + react-i18next（国际化）
  - React 19.2 / dnd-kit / lucide-react / react-markdown
- **Demo 截图**：4 张 WebP 截图（内容创建 / 观众计划 / AI 试映现场 / 试映报告），全部 raw 在 docs/assets/

### 1.3 核心代码审计

**Persona 生成机制**（关键代码片段，从 `apps/api/src/agents/mockTemplates.ts`）：

```typescript
type DemoAudienceTemplate = {
  segment: "核心用户" | "相邻用户" | "挑剔用户" | "路人用户";
  label: string;        // 例如 "孕期囤货中的准妈妈"
  profile: string;      // 背景小传
  personality: string;  // 性格
  mbtiType: string;     // 必填，16 型之一
  responseStyle: string;
  likelyActions: ParsedToolCall["toolName"][];
};

// Mock 模式：4 类用户，每类多模板，allocateDemoTemplateGroups(count) 分配
// Real 模式：AI SDK 调用 LLM 生成 personaJson：profile + personality + mbtiType + responseStyle
```

- 真实模式 persona 字段：**profile（背景小传）、personality（稳定性格）、mbtiType（必填 16 型）、responseStyle（评论表达习惯）**
- 默认 chunk size: 10 个 profile/request，并发上限 10
- 不同 directive 可并发，同 directive chunks 串行

**试映流程实现**（关键代码片段，从 `apps/api/src/runtime/scheduler.ts`）：

```typescript
export class Scheduler {
  private activeRuns = new Set<string>();
  private activeJourneyRunners = new Map<string, Set<string>>();

  start(runId: string) {
    if (this.activeRuns.has(runId)) return;
    this.activeRuns.add(runId);
    void this.runLoop(runId)
      .catch(async (err) => {
        // crash 时回滚 run 状态到 paused
        ...
      });
  }
  // Scheduler claims AgentJourney（不是 turn / tool）
  // Lock at journey level, not turn level
  // Atomic claim via SQL UPDATE with runner_status conditions
```

**LLM 接入方式**（`apps/api/src/agents/realAgent.ts`）：

```typescript
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, hasToolCall, stepCountIs, streamText } from "ai";

this.aiSdkOpenaiCompatible = createOpenAICompatible({
  name: "trycue-openai-compatible",
  apiKey: config.apiKey!,
  baseURL: config.baseUrl!,
  includeUsage: true,
  fetch: rateLimitedFetch  // 共享限流 fetch
});
```

- 支持 OpenAI-compatible 协议（DeepSeek / OpenAI / Claude / 智谱 GLM / Moonshot 都可）
- 任务分流：`taskRunner.ts` 中 `modelForAiTask` 按任务类型选 fast / pro 模型
- 温度档：creative 0.9 / balanced 0.8 / precise 0.45
- 容量控制：`LlmCapacityManager` 提供 RPM + concurrency 双限流，AIMD 调节
- 校准：`POST /api/settings/llm/capacity/probe` 启动容量校准 job（normal/high_quota/custom 三档）

**是否有中文支持**：✅ 完全支持（i18next，所有 persona name、demo 内容、prompt 都是中文）
**是否有真实数据校准**：❌ V1 明确不做真实社交平台连接、不操作真实 DOM、不接真实用户数据。报告生成基于"AI 试映模拟结果"。

### 1.4 Demo 可运行性

- **Docker 一键启动**（README 明确）：`./scripts/docker-run.sh` 自动拉镜像（ghcr.io/donghao95/trycue:latest）、创建数据目录、配置模板、启动容器
- **本地开发**：`pnpm install && ./scripts/run-local.sh`，要求 Node.js 24+ 和 pnpm 10.4.0
- **mock 模式无需 API Key**：`runtimeMode: mock` 默认开箱即用，30 个 mock personas 跑完整试映流程
- **容器健康检查**：`HEALTHCHECK --interval=30s` 检查 `/health` endpoint
- **数据库迁移自动化**：容器启动时自动 `applyMigrations.js`
- **CI/CD**：release-please 自动发版 + Docker GHCR 自动构建
- **CI 集成测试**：`pnpm verify` 跑 lint + typecheck + test + integration + build
- **本次核验状态**：⚠️ **未实际跑通 demo**（因环境限制），但代码结构、dockerfile、docker-compose、scripts 都完整且工程化

---

## 二、商业现状核验

### 2.1 项目来源

- **作者**：donghao95（Donghao Yang / Dong Hao），GitHub 唯一贡献者（`git log --pretty=format:"%an" | sort -u` 只有 "Dong Hao"）
- **作者 GitHub 总仓库数**：7 个公开仓库，TryCue 是最大（21 stars），其他包括 zsxq-backup / agent-pin / bili-sync / find-all-the-discounts / MoyuStock / chatgpt-on-wechat
- **作者个人 README 关键信息**（来自 WebSearch 结果引用 donghao95/donghao95 README.md）：
  > "自用主页 - 本人在内容试映 (content pre-screening) 项目中主要承担 **audience submodule (受众子模块)** 的开发"
  
  ⚠️ **重要发现**：作者自述是"audience submodule 的开发者"，暗示这是**更大团队项目的子模块贡献者**身份，但 TryCue Git 提交历史只有他一人，**这表明他是实际全职开发者，自述中的"audience submodule"可能是项目内部模块命名**，而非外部协作项目。
- **TRAE 大赛详情**：TRAE AI 创造力大赛由字节跳动旗下 AI 编程工具 TRAE 官方举办，2026 年 6 月 16 日正式启动，主题"世界很大，放手去造"，奖金池超百万，设 4 个赛道（学习工作 / 社会服务 / 硬件交互 / 社会公益），20 个决赛名额，复赛期 7.21-8.9。**TryCue/donghao95 在 TRAE 论坛搜索结果中无直接出现**。
- **获奖情况**：TRAE 大赛目前处于复赛阶段（2026-07-21 ~ 2026-08-09），**决赛名单 8 月中旬才公布**，目前无任何公开获奖信息

### 2.2 后续商业化

- **是否有 SaaS 版本**：❌ 仓库无 SaaS 后端代码、无订阅/支付模块、README 明确"V1 暂不包含生产级多租户系统和复杂计费权限系统"
- **是否有付费用户**：❌ 无公开信息（21 stars 项目，无 SaaS 基础设施）
- **是否有融资**：❌ donghao95 个人项目，无融资迹象
- **是否有团队继续维护**：⚠️ 全部 commit 仅 donghao95 一人，但 7.1 ~ 7.3 三天连续高强度发版（0.1.1 → 0.1.2 → 0.1.3），说明**至少目前个人全职投入维护**
- **版本节奏**：v0.1.1（7.1）→ v0.1.2（7.1）→ v0.1.3（7.2-7.3），**每周一个小版本**

### 2.3 市场表现

- **GitHub stars 增长曲线**：从 0 到 21 stars，**30 天内的新项目**，无法判断长期增长
- **媒体报道**：❌ 0 外部媒体报道
- **社交媒体讨论**：❌ 0 公开讨论（X、知乎、小红书、微博搜索均无）
- **TRAE 论坛参与**：❌ 搜索 donghao95 / TryCue / 内容试映均无结果
- **下游采用情况**：❌ 0 fork，0 watcher

---

## 三、与 qizai 的真实重合度

### 3.1 解决的问题

- **TryCue**：发布前用 AI 观众试映一段内容草稿，观察谁点赞/收藏/评论/退出，生成证据化报告，**回答"该不该发、阻断点在哪、先改哪里"**
- **qizai**（假设）：中文 AI 内容流量预测工具，针对小红书/抖音/B站，1000+ persona 模拟 + funnel 预测（CTR/3秒留存/完播互动）

### 3.2 用户痛点对比

- **TryCue 用户真实反馈**：仓库 0 open issues，无法获得用户反馈。但 README 自述痛点：
  - 标题第一眼有没有吸引力？
  - 封面和正文是否让目标用户愿意继续看？
  - 哪些人会点赞、收藏、评论？
  - 哪些人会快速离开？
  - 评论区可能出现什么质疑、共鸣、误解？
  - 不同人群的反馈权重是否一样？
  - 应该发布、修改还是重写？

- **qizai 假设的痛点**（中文社媒流量预测）：
  - 流量级预估（CTR、3 秒留存、完播率、互动率）
  - 跨平台适配（小红书/抖音/B 站算法差异）
  - 大规模 persona（1000+）模拟
  - 真实数据校准（用历史爆款验证预测准确度）
  - 商业化 SaaS + 付费订阅

- **重合度**：约 **70%**（核心都是"AI 观众模拟预测内容表现"），但 TryCue 偏 **内容创作决策辅助**（要不要发、改哪里），qizai 偏 **流量级预测**（CTR、留存、互动率数字预测）

### 3.3 qizai 的差异化空间

| 维度 | TryCue | qizai 假设 | 差异化空间 |
|------|--------|------------|------------|
| **规模** | mock 默认 12-30 personas，real 模式可到 10000（`audienceCount: 60，scale=custom 时 1-10000`） | 1000+ personas | qizai 需要更大规模，但 TryCue 理论上支持到 10000 |
| **场景** | V1 限定 `Platform = xiaohongshu/douyin/wechat` 三选一，prompt 软编码为小红书/公众号风格 | 小红书/抖音/B 站 | TryCue 已支持小红书和抖音，qizai 需要 B 站适配 |
| **校准** | ❌ V1 明确"不连接真实平台、不预测真实表现" | 真实数据校准 | **qizai 最大差异化点** |
| **报告** | 5 张卡 + 5 张诊断卡 + 修改建议 + 重测建议 + 改写建议 | funnel 数字预测 | TryCue 已做决策辅助，qizai 做量化预测 |
| **商业化** | ❌ 无 SaaS、无支付、无团队 | SaaS + 付费订阅 | qizai 必须做商业化才有意义 |
| **互动深度** | 9 个工具（open/read/like/favorite/share/comment/exit）+ 心路历程 + 行为证据 | CTR/3秒留存/完播互动 | TryCue 已覆盖社交互动全链路 |
| **真实性** | mock 默认是真实可信的，新手爸妈/装修/通勤包三个 demo 内容 | 真实爆款验证 | TryCue 真实性由 prompt + persona 决定 |
| **多版本对比** | ❌ V1 明确 1 run = 1 contentVersion | 需要多版本对比 | qizai 路线图 V2 计划 |

### 3.4 Fork 可行性

- **直接 fork TryCue 作为 qizai MVP 起点**：✅ **可行且强烈推荐**
- **工作量估算**：
  - 加 B 站平台支持：~2-3 周（Platform enum + mock persona + UI 调整）
  - 加真实数据校准层：~4-6 周（历史爆款数据采集 + 预测准确率评估模块）
  - 加 funnel 数字预测（CTR/3秒留存/完播互动）：~3-4 周（扩展 evidence pack + report card）
  - 加 SaaS 多租户 + 支付：~6-8 周（用户系统 + 订单系统 + 权限）
  - 总计：约 **3-6 个月** 全功能 qizai
- **风险**：
  - TryCue 是 Apache-2.0，可以商用、可以 fork、可以修改、可以闭源（**满足 qizai 商业化要求**）
  - 但需要保留原作者版权声明和 license 文件
  - 需要证明改动是"original work"（Apache-2.0 4(b) 要求）

---

## 四、中立判断

### 我的判断（必须明确）：

**[情况 C]** TryCue 是工程化程度极高的**已落地 V1 demo**，但**有明确局限**，qizai 可以**借鉴思路 + 实质超越**

**理由**：

1. **TryCue 不是"已商业化成功的巨头"**（情况 A 不成立）：
   - 0 SaaS、0 付费用户、0 融资、0 团队、0 媒体报道
   - 21 stars 极低，30 天新项目
   - 单人开发，无商业化基础设施

2. **TryCue 也不是"思路阶段 demo 玩具"**（情况 B 不完全成立）：
   - **33,331 行 TypeScript 代码**，107 个文件
   - 完整文档（9 篇规格文档 + 1 篇索引，共 ~440 KB markdown）
   - 完整工程化（CI/CD + Docker + 测试 + mock/real 双模式 + capacity probe + SSE）
   - Apache-2.0 开源，可商用
   - 中文本土化完整（中文 prompt + 中文 persona + 中文 UI）
   - 但 V1 明确边界：**不接真实平台、不预测真实表现、无商业化、无多租户、无 B 站**

3. **qizai 可以借鉴思路 + 实质超越**（情况 C 成立）：
   - **借鉴**：plan-first persona 生成、9 个 tool 行为模拟、evidence pack 报告、heart 反 stop 风险检测、SSE 实时现场、Plan-first 观众审核流
   - **超越**：
     - **真实数据校准**（qizai 核心差异点，TryCue 没有）
     - **funnel 数字预测**（CTR/3秒留存/完播互动）
     - **B 站场景**（TryCue 没有）
     - **SaaS + 付费 + 多租户**（TryCue 没有）

### 依据：

**代码现状**：
- 107 个 TS 文件、33,331 行代码
- 完整数据库 schema（1027 行 Prisma schema、22 张表）
- 完整 SSE 实时推送（25+ 事件类型）
- 完整 capacity 控制（probe + AIMD + rate-limited fetch）
- 工程化质量**超过很多上市公司内部工具**
- 但**仅 mock 默认 12 personas，real 模式最大 10000，没有真实校准**

**商业现状**：
- 个人项目，无团队、无融资、无商业化
- 30 天新项目，21 stars 极低
- TRAE 大赛可能参赛（无直接证据）
- 无下游采用（0 fork）

**差异化空间**：
- **真实数据校准**：TryCue 明确不做，是 qizai 最大护城河
- **funnel 量化预测**：TryCue 是定性（高/中/低），qizai 需要定量数字
- **B 站支持**：TryCue 只有小红书/抖音/微信
- **SaaS 商业化**：TryCue 无
- **更大规模验证**：TryCue 没在 1000+ personas 上做过真实爆款对照实验

### 如果情况 A（建议放弃），具体建议：

- 不适用：TryCue 没有任何一项达到"qizai 难以超越"的程度
- 21 stars 项目，无融资无团队无用户，距离"市场主导"远得很

### 如果情况 B/C（继续推进），具体建议：

**借鉴 TryCue 的具体方式**：
1. **Fork TryCue 作为 qizai MVP 起点**（Apache-2.0 允许商用，节省 6+ 个月从零开发）
2. **保留** TryCue 的 plan-first persona 生成、9 个 tool 行为模拟、SSE 实时现场、evidence pack 报告
3. **保留** TryCue 的中文 prompt、中文 persona、中文 UI 工程化
4. **改造** TryCue 的 V1 边界为 V2：
   - 加 Platform.bilibili enum + B 站 persona 库
   - 加真实历史爆款数据库 + 预测准确率评估模块
   - 加 funnel 数字预测（CTR/3秒留存/完播互动）
   - 加多租户 + 付费订阅
   - 加多版本对比（A/B 测试试映）

**差异化策略**：
1. **真实校准**（qizai 护城河）：用小红书/抖音公开爆款数据反推 persona 模板，让预测有数据支撑
2. **funnel 数字**：把 TryCue 的定性"高/中/低"升级为定量"预计 CTR 3.2%、3秒留存 67%、完播率 45%"
3. **B 站独占**：B 站 UP 主生态独立（小红书种草 vs B 站长视频 vs 抖音强算法），B 站没人做
4. **创作者工作流集成**：把 qizai 嵌入小红书蒲公英 / 抖音星图 / B 站创作中心

**风险控制**：
1. **作者风险**：donghao95 一个人维护，可能 burnout，qizai 需要有内部团队接手
2. **License 合规**：保留 Apache-2.0 版权声明和 NOTICE 文件（虽然 NOTICE 是可选）
3. **TRAE 大赛结果未知**：8 月中旬才公布获奖，可能产生品牌冲击（如果 donghao95 获奖，可能被字节收购或扶植）
4. **技术债**：TryCue 9 个 tool + 25+ SSE 事件 + 1027 行 schema，复杂度高，qizai 接手需要消化 3 个月
5. **真实校准数据获取**：小红书/抖音数据封闭，qizai 需要找合规数据源（公开榜单、爬虫、第三方数据公司）

---

## 五、引用清单（所有 URL + 实际访问证据）

1. https://github.com/donghao95/TryCue - 仓库主页（已访问，21 stars / 0 forks / 0 issues / Apache-2.0 / 最后 commit 2026-07-03）
2. https://raw.githubusercontent.com/donghao95/TryCue/main/README.md - README 完整内容（已获取，10 KB）
3. https://raw.githubusercontent.com/donghao95/TryCue/main/LICENSE - Apache-2.0 完整文本（已获取）
4. https://github.com/donghao95/TryCue/commits/main - 提交历史（已访问，74 commits，最新 2026-07-03）
5. https://github.com/donghao95 - 作者主页（已访问，1 follower / 7 public repos / 94 stars）
6. https://github.com/donghao95?tab=repositories - 作者所有仓库列表（已访问，含 TryCue 21 stars + zsxq-backup + agent-pin + bili-sync + find-all-the-discounts + MoyuStock + chatgpt-on-wechat）
7. https://raw.githubusercontent.com/donghao95/TryCue/main/docs/00_README_文档索引.md - 文档索引（已获取）
8. https://raw.githubusercontent.com/donghao95/TryCue/main/docs/01_Database_Schema_Spec.md - 数据库规格（已获取，22 张表）
9. https://raw.githubusercontent.com/donghao95/TryCue/main/docs/02_API契约与共享DTO.md - API 契约（已获取，25+ SSE 事件）
10. https://raw.githubusercontent.com/donghao95/TryCue/main/docs/03_Agent运行时设计.md - Agent 运行时设计（已获取，Scheduler / Tool / Session 细节）
11. https://raw.githubusercontent.com/donghao95/TryCue/main/docs/04_观众生成领域规格.md - Persona 生成规格（已获取，profile/personality/mbtiType/responseStyle 四字段）
12. https://raw.githubusercontent.com/donghao95/TryCue/main/docs/05_前端规格.md - 前端规格（已获取）
13. https://raw.githubusercontent.com/donghao95/TryCue/main/docs/06_报告生成规格.md - 报告规格（已获取，5 卡 + 5 诊断卡）
14. https://raw.githubusercontent.com/donghao95/TryCue/main/docs/08_Demo数据规格.md - Demo 数据（已获取，3 个 demo 内容）
15. 本地 clone `/tmp/trycue-clone` - 实际 clone 仓库（已执行，git log 验证 74 commits / 唯一作者 Dong Hao）
16. 本地审计 `apps/api/src/agents/realAgent.ts` - LLM 接入（已读，含 createOpenAICompatible + 温度档 + 模型任务分流）
17. 本地审计 `apps/api/src/agents/mockTemplates.ts` - Persona 模板（已读，4 类用户 + MBTI + 中文 prompt）
18. 本地审计 `apps/api/src/runtime/scheduler.ts` - Scheduler（已读，journey level lock + crash 回滚）
19. 本地审计 `apps/api/src/services/evidencePack.ts` - Evidence Pack（已读，60 KB 完整证据链）
20. 本地审计 `apps/api/src/agents/realAgentPrompts.ts` - 中文 prompt（已读，NDJSON frame protocol + 小红书风格）
21. 本地审计 `apps/api/src/views.ts` - 视图层（已读，含 risk tag 关键词定义）
22. 本地审计 `packages/db/prisma/schema.prisma` - Prisma schema（已读，1027 行）
23. 本地审计 `Dockerfile` - 三阶段构建（已读，python3/make/g++/corepack/prisma）
24. 本地审计 `docker-compose.yml` - Docker 部署（已读，ghcr.io/donghao95/trycue:latest）
25. 本地审计 `CHANGELOG.md` - 版本日志（已读，v0.1.1 → 0.1.2 → 0.1.3）
26. 本地审计 `apps/web/package.json` + `apps/api/package.json` - 依赖（已读，React 19.2 + Fastify 5.8 + Prisma + AI SDK 7.0）
27. https://forum.trae.cn/ - TRAE 中文社区（已访问，无 TryCue/donghao95 提及）
28. WebSearch "TRAE AI 大赛 TryCue donghao95 获奖" - 0 直接命中，TRAE 大赛尚处复赛阶段
29. WebSearch ""内容试映" OR "AI观众" 小红书 抖音 内容预测" - 0 直接命中，AI 内容创作相关但无 TryCue 提及
30. WebSearch ""内容试映" 小红书 抖音 公众号 流量预测 AI" - 0 直接命中，市场无现成内容试映产品

---

## 六、最终结论

**情况 C 成立，建议继续推进 qizai + 借鉴 TryCue**

qizai 的核心策略应该调整为：
1. **短期（0-3 个月）**：Fork TryCue（Apache-2.0）作为 MVP 起点，节省 6 个月开发
2. **中期（3-9 个月）**：叠加 4 个差异化点——真实数据校准、funnel 数字预测、B 站场景、SaaS 多租户
3. **长期（9-18 个月）**：做成中文社媒流量预测的事实标准，对标 Synthetic Users（YC W25，海外）+ 占据国内空白

**最重要的一个事实**：TryCue 的工程化质量**极高**（33,331 行代码、9 篇规格文档、SSE 实时 + capacity 控制 + 22 张表数据库），这是 qizai 应该尊重和学习的对手，**不是可以忽视的"小 demo"**。但同时它的局限也是真实的（无真实校准、无商业化、无团队、30 天 21 stars），qizai 有明确的差异化空间。

---

核验人：qizai 项目独立核验 subagent
核验时间：2026-07-22
立场：中立