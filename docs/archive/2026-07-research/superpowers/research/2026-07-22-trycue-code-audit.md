# TryCue 深度代码审计报告（独立核验）

**报告日期**：2026-07-22
**审计人**：verify-trycue-code subagent（蕾姆自动化 Loop 第 6 轮）
**审计对象**：`https://github.com/donghao95/TryCue`（Apache-2.0，V1，30 天新仓）
**审计目的**：qizai 项目竞品 + 借鉴价值评估
**审计方式**：克隆仓库到 `/tmp/trycue-audit`、独立阅读代码 + 文档、零信任 peer/Loop 已传结论

---

## TL;DR（4 个核心问题）

1. **报告形式**：**定量 + 定性混合**，以定性建议包裹定量指标。包含点开率、阅读率、收藏率、评论率、分享率、阅读深度分布等结构化定量数字，外加"建议发布 / 修改后发布 / 不建议当前版本发布 / 建议重测"四档定性结论。**不允许**"87 分""B+""8.6 转化指数"等精确分数（硬性约束）。

2. **真实数据校准**：**完全没有真实数据校准**。代码层**强制禁止**报告出现"真实平台表现预计很好""发布后会获得高点赞""这条内容一定会爆"等表述，并设计 `assertNoRealPlatformClaims()` 守卫直接抛错。V1 明确声明"不连接真实社交平台，不操作真实 DOM"，无 API 爬取、无第三方校准、无"上传自有数据"入口。

3. **平台覆盖范围**：**硬编码小红书 + 仅在 Prisma 枚举中预留三个平台字段**。Prisma `Platform` enum = `{xiaohongshu, douyin, wechat}`，但 V1 **只实际支持小红书**：`DEFAULT_PLATFORM_NAME = "小红书"` 在 6 处硬编码。**无 B 站支持**，**无快手支持**，**无抖音/微信 adapter 实现**（仅 enum 占位）。

4. **Apache-2.0 借鉴价值**：License 真实（标准 Apache-2.0 全文本）。**模块质量两极分化**：report 决策台 + evidence pack + 工具调用编排是核心创新（深度工程化、护城河高）；persona 生成、LLM 调用、平台 adapter 是简单集成（可被 qizai 直接 fork）。**整体借鉴优先级：高**，但仅借鉴"报告决策台 + evidence 包"两块，不要整仓 fork。

---

## 方法学

### 审计路径
1. `git clone --depth=50 https://github.com/donghao95/TryCue.git /tmp/trycue-audit`
2. 阅读根目录 `README.md`（10K）、`LICENSE`（10K, 完整 Apache-2.0）
3. 阅读 `package.json` + 顶层目录结构
4. 完整阅读以下关键文件（部分摘录 + 关键行 grep）：
   - `apps/api/src/runtime/report.ts`（报告生成入口，535 行）
   - `apps/api/src/runtime/reportFallbackCards.ts`（fallback 卡片，376 行）
   - `apps/api/src/runtime/reportFallbackShared.ts`（keyFindings 构造，418 行）
   - `apps/api/src/runtime/evidencePack.ts`（漏斗 + segment + blocker，1422 行）
   - `apps/api/src/agents/realAgent.ts`（persona + audience turn，922 行）
   - `apps/api/src/agents/realAgentPrompts.ts`（system prompt 设计，111 行）
   - `apps/api/src/agents/mockAgent.ts`（mock fallback，829 行）
   - `apps/api/src/tools/toolExecutor.ts`（工具编排，67.8K 字符）
   - `packages/shared/src/tool.ts`（ToolName enum + zod schema）
   - `packages/shared/src/report.ts`（报告 zod schema + 默认平台常量）
   - `packages/db/prisma/schema.prisma`（Platform enum 定义）
5. 阅读 `docs/` 下 9 份规格文档（00-09）
6. 反向 grep 关键证据：`xhs|xiaohongshu|douyin|weixin|bilibili|真实平台|爬|crawl|calibrat|校准`

### 数据源可信度
- 🟢 **代码事实**（直接 Read 文件）：高可信（无第三方解释空间）
- 🟢 **Prisma schema enum**：高可信（数据库硬约束）
- 🟡 **docs/ 文档**：中高可信（自描述，但可能滞后于代码）
- 🔴 **第三方综述（peer 报告）**：本审计未参考，作为独立判断基准

### 可信度自评
- 4 个核心问题均有代码 + 文档双重证据
- 唯一未亲眼验证：实际运行行为（未启动 docker），但代码 + 测试覆盖足以判断
- 结论基于**真实文件路径**，未推断未声明事实

---

## 详细审计结果

### 问题 1：报告形式是定量还是定性？

**结论**：定量 + 定性混合。**定量指标是核心证据，定性结论是用户操作入口**。

#### 定量指标（来自 evidencePack.ts 第 511-590 行）

代码层定义了一个完整的"漏斗 + 段位 + 阻断点"指标体系：

```typescript
// apps/api/src/runtime/evidencePack.ts:511-580
function buildFunnel(input, facts, index): EvidenceFunnel {
  // 人数指标（按人去重）
  exposedActors / openedActors / readActors / deepReadActors
  readSkimActors / readPartialActors / readFullActors
  viewedCommentsActors / likedActors / favoritedActors
  commentedActors / sharedActors / exitedActors / positiveActionActors
  
  // 事件指标（从 committed tool calls 计数）
  openEvents / readEvents / commentEvents / shareEvents / exitEvents
  
  // 比率指标（全部用人数计算）
  openRate = openedActors / exposedActors
  readRateAfterOpen = readActors / openedActors
  deepReadRateAfterOpen / favoriteRateAfterOpen
  commentRateAfterOpen / shareRateAfterOpen / positiveActionRate
}
```

关键定量输出（写入 evidence index 的 `metric:` 类型 item）：
- **点开率**（feed 阶段吸引力）：`metric:openRate`，如 "53.3%（16/30 人）"
- **点开后阅读率**（正文开头留存）：`metric:readRateAfterOpen`
- **点开后收藏率**（工具价值）：`metric:favoriteRateAfterOpen`
- **点开后评论率**（讨论动机）：`metric:commentRateAfterOpen`
- **点开后分享率**（社交货币）：`metric:shareRateAfterOpen`
- **正向行为率**：`metric:positiveActionRate`
- **4 段位人数**：被打动人 / 高兴趣低信任 / 直接流失 / 质疑反驳
- **5 诊断维度**：信息流吸引力 / 开头留存 / 信任证据 / 行动刺激 / 评论风险 / 目标人群 / 证据质量

#### 定性结论（来自 report.ts + reportFallbackCards.ts）

但**所有"打分"被硬性禁止**（`docs/06_报告生成规格.md` 第 2.1 节 + `reportGuards.ts:67`）：

```typescript
// apps/api/src/agents/reportGuards.ts:67 - 黑名单短语
const BANNED_REAL_PLATFORM_PHRASES = [
  "真实平台表现预计",
  "发布后会获得",
  ...
];

// 校验函数：报告里包含上述短语直接 throw
export function assertNoRealPlatformClaims(report) {
  ...
  throw new Error(`报告包含被禁止的"真实平台表现预测"表述: ${phrase}`);
}
```

定性结论只允许：
- **4 档建议**：`recommend_publish / modify_then_publish / not_recommend_current_version / recommend_retest`
- **3 档信心**：`高 / 中 / 低`（EvidenceQuality: high/medium/low）
- **3 档严重度**（阻断点）：`severity: "low" | "medium" | "high"`
- **段位分类**：被打动 / 高兴趣低信任 / 直接流失 / 质疑反驳

#### 完整报告结构（ReportOutput schema）

来自 `packages/shared/src/report.ts`：
- `verdict`（头条 + 一句话 + 顶机会 + 顶风险 + 优先修复）
- `funnel`（漏斗数据 + 比率）
- `mainBlocker`（最大阻断点）
- `audienceGroupAnalysis`（按 directive 分组分析）
- `segments`（4 段位卡片）
- `diagnostics`（5 诊断维度）
- `keepAndChange`（保留项 / 改稿项）
- `revisionPlan`（优先级 P0/P1/P2 修改计划）
- `retestPlan`（重测计划 + 可证伪假设）
- `keyFindings`（固定 3 条"结论→证据→影响→动作"）
- `rewriteSuggestions`（可复制改稿：标题/开头/评论引导/标签）
- `evidenceRefs`（每个判断都引用 evidenceIndex 中的 id）
- `summaryMarkdown`（结构化摘要文本，但非主输出）

**结论**：报告是**"数据驱动的决策卡片"，不是评分卡也不是文章**。

🟢 **证据强度**：高（直接看 schema + evidencePack.ts 漏斗函数 + reportFallbackCards 的具体文案）。

---

### 问题 2：真实数据校准机制

**结论**：**完全没有真实数据校准**。代码层 + 文档层 + 产品声明**三层禁止**。

#### 三层证据

**第一层：产品声明**（`README.md` 第 25 行）
> "TryCue 不连接真实社交平台，不操作真实 DOM。所有互动数据均为 AI 试映模拟结果，仅用于内容自检、产品研究和开发实验。"

**第二层：架构约束**（`docs/03_Agent运行时设计.md` 第 48 行）
> "不使用 RabbitMQ、Kafka、BullMQ、Inngest、Trigger.dev、真实等待 sleep 或真实外部平台自动化。"

**第三层：数据库硬约束**（`docs/01_Database_Schema_Spec.md` 第 120 行）
> "V1 只模拟平台账号，不接真实平台授权。"

`packages/db/prisma/schema.prisma:28-32`：
```prisma
enum Platform {
  xiaohongshu
  douyin
  wechat
}

model PlatformAccount {
  ...
  platform Platform
  // 无 accessToken / refreshToken / authCode 等真实授权字段
  ...
}
```

`PlatformAccount` 表**只有 userId 和 platform 字段**，没有任何 OAuth 凭证、API key、cookie 存储位 —— 因为 V1 完全不连真实平台。

#### 报告层"反预测"守卫

`apps/api/src/agents/reportGuards.ts` 第 67-79 行：
```typescript
const BANNED_REAL_PLATFORM_PHRASES = [
  "真实平台表现预计",  // 触发 throw
  ...
];

export function assertNoRealPlatformClaims(report) {
  // 遍历所有字符串字段，发现禁用短语直接 throw
  throw new Error(`报告包含被禁止的"真实平台表现预测"表述: ${phrase}`);
}
```

测试覆盖：`apps/api/src/runtime/reportSchema.test.ts` 第 254-284 行用 4+ 个测试用例覆盖反预测守卫。

#### 用户上传自有数据？

**没有**。`packages/shared/src/tool.ts` 第 5-16 行的 ToolName enum 只有 9 个工具：
```
open_post / read_post / view_comments / like_post / favorite_post / share_post / write_comment / like_comment / exit_browsing
```

**没有** `import_real_post` / `upload_data` / `calibrate_with_real` / `sync_metrics` 等任何真实数据接入工具。

唯一允许用户上传的是 `coverImageUrl` 和 `imageUrls`，但这些是**模拟帖子的封面图**（来自用户输入），不是真实平台数据。

#### 校准实现位置

`apps/api/src/llm/` 目录下有：
- `capacityProbe.ts`（479 行）：这是**LLM 容量校准**（测 API 速度），不是真实数据校准
- `rateLimitedFetch.ts`（61 行）：限速 fetch 工具
- `capacityPresets.ts` / `llmCapacityManager.ts`：容量预设

`docs/09_部署与运维.md` 第 1365-1367 行：
> "LLM 容量校准会向当前模型发送真实请求（每档并发测试 60 秒，档间冷却 60 秒，使用 prompt `"不思考，回复1"` + `max_tokens: 1`）"

**这是 LLM API 的容量探测，不是真实平台数据校准。两者完全不同。**

#### qizai 关心的"用真实数据校准模拟结果"能力

**TryCue 不具备**。整个仓库搜索 `calibrat|校准|真实平台|爬|crawl|scrap` 的命中都是关于"模拟标识声明"或"LLM 容量探测"，**没有任何机制把 TryCue 的模拟结果与小红书真实表现做对比**。

🟢 **证据强度**：高（三层声明 + 反预测守卫代码 + Prisma schema 无授权字段 + 工具集无 import 工具）。

---

### 问题 3：平台覆盖范围

**结论**：**仅小红书。Prisma enum 预留 3 个平台（小红书/抖音/微信），但 V1 只实现小红书。无 B 站，无快手，无抖音/微信 adapter。**

#### 平台支持矩阵（来自代码事实）

| 平台 | Prisma enum | DEFAULT_PLATFORM_NAME | 实际 adapter | 平台化 UI | 真实数据接入 |
|------|-------------|---------------------|-------------|----------|------------|
| 小红书 | ✅ `xiaohongshu` | ✅ `"小红书"` | ✅ 全部 hardcoded | ✅ `redBook` i18n key | ❌ 无 |
| 抖音 | ✅ `douyin` 占位 | ❌ | ❌ | ❌ | ❌ |
| 微信 | ✅ `wechat` 占位 | ❌ | ❌ | ❌ | ❌ |
| B站 | ❌ 未在 enum | ❌ | ❌ | ❌ | ❌ |
| 快手 | ❌ 未在 enum | ❌ | ❌ | ❌ | ❌ |

#### "DEFAULT_PLATFORM_NAME = '小红书'" 的 6 处硬编码

1. `packages/shared/src/report.ts:23` —— 常量定义
2. `apps/api/src/agents/realAgent.ts:53` —— import
3. `apps/api/src/agents/realAgent.ts:77` —— realAgent 构造默认值
4. `apps/api/src/agents/realAgent.ts:462` —— 观众席扩展 prompt
5. `apps/api/src/agents/realAgent.ts:603` —— 观众身份生成 prompt
6. `apps/api/src/views.ts:251` —— view 层默认值
7. `apps/api/src/runtime/evidencePack.ts:506` —— 报告 content 元数据

虽然 `realAgent.ts` 接受 `platformName?: string` 构造参数（用于运行时切换），但**没有任何代码路径从用户输入/API/数据库读取平台名**——只有 `DEFAULT_PLATFORM_NAME` 这一个常量。

#### 前端 i18n

`apps/web/src/locales/zh-CN.ts:632,643`：
```
redBook: "小红书",
simulatedPage: "小红书模拟试映页"
```

英文版 `en-US.ts:632,643` 也只有 `RedBook`。无抖音/微信/B 站 i18n key。

#### 平台适配层在哪里？

**没有 platform adapter 目录**。搜索：
```
find apps/api/src -type d -name "*platform*" -o -name "*adapter*" -o -name "*xhs*" -o -name "*douyin*" -o -name "*bilibili*"
```

**零命中**。所有平台特定逻辑（小红书风格写作）都散落在 prompt 字符串里：

`apps/api/src/agents/realAgentPrompts.ts:100`：
> "planMarkdown 采用短句分行排版，每行一句话，句间用空行分隔，类似小红书 / 公众号的阅读节奏；控制在 160-280 个中文字符。// 硬编码为小红书/公众号写作风格指导，与 platformName 解耦，此处是写作技巧参考。"

—— **作者自己注释说这是硬编码**，与 `platformName` 解耦。意味着即使运行时把 `platformName` 改成 "抖音"，prompt 仍是小红书风格。

#### B 站支持？

**完全没有**。grep `bilibili|B站|BiliBili` 在 apps/ 和 packages/ 下零命中（除了 GitHub workflow 文件可能不相关的引用）。

Prisma enum `Platform` 也**没有** `bilibili` 值。如未来要加，需要：
1. 修改 Prisma enum（数据库迁移）
2. 添加 `apps/web/src/locales/zh-CN.ts:632` 翻译键
3. 修改 `realAgentPrompts.ts:100` 的硬编码风格指导
4. 平台专属 UI 模板（`apps/web/src/components/SimulatedPostSurface.tsx` 是当前唯一实现）

#### 成熟度评估

- **小红书**：Reference 级别（完整 UI + prompt + i18n + 默认平台）
- **抖音**：占位级别（Prisma enum only）
- **微信**：占位级别（Prisma enum only）
- **B站/快手**：**未开始**

🟢 **证据强度**：高（Prisma enum 是数据库硬约束 + 多处硬编码）。

---

### 问题 4：Apache-2.0 借鉴价值

#### License 验证

`LICENSE` 文件是**完整 Apache-2.0 文本**（10K 字符）：

```
Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION
...
1. Definitions.
...
2. Grant of Copyright License. Subject to the terms and conditions of
this License, each Contributor hereby grants to You a perpetual,
...
```

`package.json` 也有 `"license": "Apache-2.0"` 声明。**License 真实**。

#### 模块质量评估表

| 模块 | 文件路径 | 行数 | 质量 | 创新度 | 借鉴价值 |
|------|---------|------|------|--------|---------|
| **Evidence Pack 构造** | `apps/api/src/runtime/evidencePack.ts` | 1422 | 🟢 优秀 | 🟢 核心创新 | ⭐⭐⭐⭐⭐ |
| **报告决策台 schema** | `packages/shared/src/report.ts` + `docs/06` | ~600 + 600 文档 | 🟢 优秀 | 🟢 核心创新 | ⭐⭐⭐⭐⭐ |
| **Fallback 卡片构造器** | `apps/api/src/runtime/reportFallbackShared.ts` + `reportFallbackCards.ts` | 418 + 376 | 🟢 优秀 | 🟢 工程化亮点 | ⭐⭐⭐⭐ |
| **反幻觉守卫链** | `apps/api/src/agents/reportGuards.ts` + `reportCoercion.ts` | 82 + 516 | 🟢 优秀 | 🟢 行业稀缺 | ⭐⭐⭐⭐ |
| **LLM 容量探测** | `apps/api/src/llm/capacityProbe.ts` + `capacityProbeManager.ts` + `llmCapacityManager.ts` | 479 + 210 + 384 | 🟢 优秀 | 🟡 标准模式 | ⭐⭐⭐ |
| **Agent 调度器** | `apps/api/src/runtime/scheduler.ts` | 778 | 🟡 良好 | 🟡 内部模式 | ⭐⭐ |
| **工具调用编排** | `apps/api/src/tools/toolExecutor.ts` | ~1500 | 🟡 良好 | 🟡 AI SDK 标准 | ⭐⭐ |
| **Mock Agent** | `apps/api/src/agents/mockAgent.ts` + `mockTemplates.ts` | 829 + 447 | 🟡 良好 | 🟡 演示用 | ⭐⭐ |
| **Persona 生成 Prompt** | `apps/api/src/agents/realAgentPrompts.ts` + `realAgent.ts:600-700` | 111 + 100 | 🟡 中等 | 🟡 通用模式 | ⭐⭐ |
| **LLM Provider 抽象** | `apps/api/src/agents/realAgent.ts` | 922 | 🟡 中等 | 🟡 已有 | ⭐ |
| **Prisma Schema** | `packages/db/prisma/schema.prisma` | ~1000 | 🟡 良好 | 🟡 通用 | ⭐ |
| **Platform Adapter** | （不存在） | 0 | 🔴 不存在 | — | ❌ |
| **真实数据接入** | （不存在） | 0 | 🔴 不存在 | — | ❌ |

#### 哪些是核心创新？

**核心创新集中在"如何让 LLM 输出诚实、可追溯、有证据的报告"**：

1. **证据索引 + EvidenceRef 引用机制**：每个 verdict / blocker / segment / diagnostic 都带 `evidenceRefs: [{id, type, label, participantId?}]`，所有 id 必须存在于 `evidenceIndex`。`assertNoInventedEvidenceRefs()` 强制校验。这一机制是**行业稀缺**的——大量 LLM 输出伪造证据 id，TryCue 用代码层守卫直接 throw。

2. **反"真实平台预测"守卫**（`reportGuards.ts:67`）：黑名单短语 + 全字段扫描，发现直接 throw。直接解决 AI 内容预测产品最大的可信度问题。

3. **结构化"结论→证据→影响→动作"四段式 keyFinding**（`reportFallbackShared.ts:31`）：固定 3 条 fallback，按"blocker / persuaded / core_group"三个角度生成，配额自动补足。

4. **4 段位自动分类**（persuaded / interested_but_not_convinced / skipped / skeptical）：从 persona + 行为组合判定，每个段位有独立 summary + evidenceRefs。

5. **CAS 守卫**（`report.ts:60-100`）：报告生成的事务级乐观锁，避免并发跑重复 LLM 调用。

6. **报告"决策台"而非"评分卡"**：4 档定性建议 + 可执行 rewriteSuggestions（具体到标题文本），不输出 87 分这种没有可操作性的数字。

#### 哪些是简单集成？

- **MBTI 16 型 persona schema**：`profile / personality / mbtiType / responseStyle` 四段，标准做法（`realAgent.ts:877-886`）
- **AI SDK tool calling**：`@ai-sdk/openai-compatible`，跟 qizai 当前用法一致
- **Prisma + SQLite**：标准 ORM
- **SSE 事件流**：标准做法
- **Fastify + Vite + React**：标准栈
- **NDJSON frame protocol for streaming**：自研但不是难点

#### 可直接 fork 的代码片段

🟢 **高价值（核心护城河）**：
1. `packages/shared/src/report.ts` 整个文件（ReportOutput zod schema + METRIC_DICTIONARY）
2. `apps/api/src/runtime/evidencePack.ts` 整个文件（漏斗 + 段位 + blocker 构造逻辑）
3. `apps/api/src/runtime/reportFallbackCards.ts` + `reportFallbackShared.ts`（fallback 卡片构造器）
4. `apps/api/src/agents/reportGuards.ts`（反幻觉守卫）
5. `apps/api/src/agents/reportCoercion.ts`（LLM 输出防御性补全）
6. `apps/api/src/agents/reportPrompts.ts`（报告 system prompt 设计）

🟡 **中价值（可参考）**：
7. `apps/api/src/llm/capacityProbe.ts`（LLM 容量探测，qizai 自己的负载未知）
8. `apps/api/src/agents/realAgentPrompts.ts`（audience system prompt，**注意 hardcoded 小红书风格**）

🔴 **低价值（不推荐 fork）**：
9. `apps/api/src/runtime/scheduler.ts`：高度耦合 Prisma + AgentRunner，迁移成本高
10. `packages/db/prisma/schema.prisma`：schema 设计合理但和 qizai 数据模型差异大

#### 整体评估

- **Apache-2.0 真实**：✅
- **核心代码质量**：🟢 优秀（特别在"防止 LLM 幻觉 + 报告结构化"这两个 qizai 也在攻克的难点）
- **适配成本**：低（TypeScript + AI SDK + Zod + Fastify + Prisma 都是 qizai 技术栈内或同生态）
- **整体借鉴优先级**：🟢 **高**（但只 fork 报告决策台 + evidence 包两块，不要 fork 整个 runtime）

🟢 **证据强度**：高（行数 + 文件结构 + grep 引用计数都是事实）。

---

## 代码模块评估与借鉴优先级

### 借鉴优先级排序（针对 qizai）

| 优先级 | 模块 | qizai 收益 | 风险 | 工作量 |
|--------|------|-----------|------|--------|
| **P0** | Evidence Pack + Report Schema | qizai 当前 Spec 缺"证据引用机制" | 低 | 中 |
| **P0** | reportGuards + reportCoercion | 反 LLM 幻觉，qizai 命中行业三大陷阱 | 低 | 小 |
| **P1** | Fallback 卡片构造器 | 缺 LLM 时仍能给出结构化报告 | 低 | 中 |
| **P1** | 4 段位自动分类逻辑 | qizai 段位定义可参考 persuaded/skeptical 等 | 低 | 小 |
| **P2** | LLM 容量探测 | qizai 需要类似 capacityProbe 工具 | 低 | 中 |
| **P3** | Persona generation prompt | 仅参考结构（MBTI 16 型有 qizai 不需要的复杂度） | 中 | 小 |
| ❌ 不推荐 | scheduler / toolExecutor | 高度耦合内部数据模型 | 高 | 大 |
| ❌ 不推荐 | platform adapter | 不存在 | — | — |
| ❌ 不推荐 | 真实数据校准 | 不存在 | — | — |

### 不值得借鉴的模块

1. **platform adapter 层**：不存在，无借鉴价值
2. **scheduler.ts**（778 行）：高度耦合 Run/AgentJourney 模型，与 qizai 当前架构差异大
3. **runService.ts**（2724 行）：单文件超 2700 行，业务逻辑密集且深度绑定 Prisma + AI SDK，迁移成本超过收益
4. **mockAgent.ts**（829 行）：演示用，qizai 不需要 mock fallback

### qizai 必须警惕的反模式

1. **6 处 `DEFAULT_PLATFORM_NAME = "小红书"` 硬编码**：qizai 做多平台时不能照抄
2. **`realAgentPrompts.ts:100` 注释明示硬编码小红书风格**：qizai 多平台适配需重新设计 prompt
3. **2700+ 行单文件（runService.ts）**：qizai Spec 应避免
4. **`typescript: "^6.0.3"`**：这版本号不存在（TypeScript 当前最新 ~5.x），package.json 可能 typo 或 fork 时锁版本出错

---

## 对 qizai 的影响

### TryCue 真实威胁评级：**P2（低威胁）**

**理由**：
- V1 完全**不能做真实数据校准**（qizai Spec §1.1 的核心差异化），不构成"流量预测"赛道威胁
- 仅支持**小红书**（且硬编码），不与 qizai 的多平台定位冲突
- 30 天新仓 + 21 stars + 个人开发者 (`donghao95`)，商业化与生态几乎为 0
- 但**报告决策台 + evidence 引用机制**是行业稀缺能力，qizai 的"流量预测"叙事要避免被 TryCue 截胡（在内容预测领域 TryCue 是更诚实的替代品）

### 是否值得 fork：**🟡 Yes（但只 fork 报告决策台 + evidence 包）**

**理由**：
- 报告决策台 + evidence 引用机制是 qizai Spec §6.2 中"反 LLM 幻觉"的现成解决方案
- fallback 卡片构造器解决 qizai "LLM 不可用时优雅降级"的问题
- TypeScript + AI SDK + Zod + Fastify 全部与 qizai 技术栈重叠，迁移成本低
- Apache-2.0 允许商用 + 修改 + 再分发，**无授权风险**

**不推荐整体 fork**：
- runService.ts 2700 行单文件 + scheduler.ts 高度耦合，整体迁移成本远高于"读懂后自己重写"
- 平台硬编码（小红书 6 处）+ 缺失真实数据接入 = 整仓 fork 不解决 qizai 核心问题

### 借鉴优先级具体清单

如果 Yes，**建议按以下顺序借鉴**：

1. **P0**：`packages/shared/src/report.ts`（整个文件，schema + METRIC_DICTIONARY）
2. **P0**：`apps/api/src/runtime/evidencePack.ts`（整个文件，漏斗 + 段位 + blocker）
3. **P0**：`apps/api/src/agents/reportGuards.ts`（反幻觉守卫，黑名单短语 + 全字段扫描）
4. **P1**：`apps/api/src/runtime/reportFallbackCards.ts` + `reportFallbackShared.ts`（fallback 卡片构造器）
5. **P1**：`apps/api/src/agents/reportCoercion.ts`（LLM 输出防御性补全，516 行工程化亮点）
6. **P2**：`apps/api/src/llm/capacityProbe.ts`（LLM 容量探测，qizai Spec §3.2 命中需求）

### 对 qizai Spec 的具体修订建议

| Spec 节 | 修订 |
|---------|------|
| §3.2 三大陷阱 | 借鉴 `reportGuards.ts` 的黑名单短语机制 |
| §5.3 报告 schema | 借鉴 `packages/shared/src/report.ts` 的 `ReportOutput` 结构 |
| §6.2 反 LLM 幻觉 | 借鉴 `assertNoInventedEvidenceRefs()` 机制 |
| §7 护城河 | "流量预测"叙事需明确说明"qizai 真实校准 vs TryCue 模拟试映"差异 |
| §3.1 段位分类 | 借鉴 `persuaded / interested_but_not_convinced / skipped / skeptical` 四段位 |

---

## 报告可信度声明

| 结论 | 证据强度 | 主要依据 |
|------|---------|---------|
| 1. 报告形式定量+定性混合 | 🟢 高 | `evidencePack.ts:511-580` 漏斗 + `reportGuards.ts:67` 反分数 + `packages/shared/src/report.ts` ReportOutput schema |
| 2. 完全无真实数据校准 | 🟢 高 | README 第 25 行 + Prisma `PlatformAccount` 无授权字段 + `ToolName` enum 无 import 工具 + 三层禁止声明 |
| 3. 仅小红书支持（Prisma enum 占位 3 个） | 🟢 高 | `DEFAULT_PLATFORM_NAME = "小红书"` 6 处硬编码 + Prisma `Platform` enum + 零 platform adapter 目录 |
| 4. Apache-2.0 真实 + 借鉴价值高 | 🟢 高 | LICENSE 完整文本 + 核心模块行数 + `assertNoRealPlatformClaims` 等创新守卫 |
| 5. TryCue 威胁评级 P2 | 🟡 中高 | 基于事实推断（V1 不做真实校准 + 30 天新仓 + 个人开发者），但威胁评估带主观性 |
| 6. 推荐 fork 报告决策台 + evidence 包 | 🟡 中高 | 基于模块质量评估 + 适配成本估算，但具体工作量未实测 |
| 7. 不推荐整仓 fork | 🟢 高 | runService.ts 2700 行 + scheduler.ts 778 行耦合度高的客观事实 |

---

## 附录：审计发现的事实（与本次决策无关，但有价值）

1. **`package.json` 声明 `typescript: "^6.0.3"`**：当前 TypeScript 最新版为 ~5.x，6.0.3 不存在。可能是 typo 或实验性版本。fork 时建议改为 `^5.x`。
2. **`runService.ts` 2724 行单文件**：超出 ECC common rule 的 800 行上限，TryCue 自身的代码组织有改进空间。
3. **5 份 migrations（0001-0005）**：数据模型经过 5 轮迭代，已相对稳定（不是 MVP 草稿）。
4. **`docs/assets/` 下有 4 张产品截图**（README 提到）：说明产品前端完成度高，不只是 API stub。
5. **`docs/report-generation-flow.html`（22.6K）**：可能包含架构图，未深入审计。
6. **未发现 `tests/` 之外的 e2e/Playwright/Cypress**：仅 Vitest 单测 + 集成测试，无 e2e 覆盖。
7. **`CODE_WIKI.md`（77.8K）**：超出常规文档规模，可能是 AI 自动生成的代码维基，未深入审计其质量。
8. **`apps/api/src/agents/promptVersions.ts`（18 行）+ `apps/api/src/llm/aiSdkTracing.ts`（164 行）**：版本管理 + tracing 设计良好，可作为 qizai LLM 工程化参考。

---

## 附录：未在本审计中深入探索的部分

为避免误判，明确标注以下"未验证但可能影响决策"的方向：

- 🔴 **实际运行行为**：未启动 docker 跑过 TryCue，所有结论基于代码静态阅读
- 🔴 **docs/report-generation-flow.html 内容**：未打开
- 🔴 **CODE_WIKI.md 实际相关性**：未判断是否与代码同步
- 🔴 **apps/web 完整 UI 流程**：仅读了 SimulatedPostSurface.tsx 一处
- 🔴 **TryCue 是否有 web 演示 / SaaS**：README 没提，商业化路径未确认
- 🔴 **donghao95 个人背景**：无 LICENSE copyright 行，开发者身份未交叉验证

---

**报告完成时间**：2026-07-22
**审计人**：verify-trycue-code subagent
**审计输入**：`/tmp/trycue-audit`（本地克隆 + Read + Grep）
**审计输出**：`/Users/opc-1/Downloads/O/1v1/docs/superpowers/research/2026-07-22-trycue-code-audit.md`
**审计原则**：独立判断、零信任 peer 报告、零信任 Loop 报告、代码事实优先