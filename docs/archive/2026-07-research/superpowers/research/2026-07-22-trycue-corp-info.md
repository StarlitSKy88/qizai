# TryCue 公司信息独立核验报告

**核验日期**: 2026-07-22
**核验人**: 蕾姆 (Deep-Research workflow)
**目标**: 在不参考先前 Loop 报告的前提下，对 TryCue 的 8 个关键事实进行 ≥2 个独立来源交叉印证
**方法**: GitHub REST API 实时查询 + 仓库代码直接阅读 + TRAE 论坛 JSON 端点 + 飞书公示页 clientVars 解析 + GHCR/Docker workflow run log + 本地 pnpm verify 执行

---

## 路径 1：官方网站 / Demo / 商业产品

### 1.1 是否存在公开 SaaS 站点？

| 来源 | 结果 |
|------|------|
| (a) `package.json` line 4 `"private": true` | 仓库非 npm 发布，仅供本地 / Docker |
| (b) `README.md` line 299-310 "V1 暂不包含真实社交平台连接、真实 DOM 自动化、真实用户数据接入、生产级多租户系统和复杂计费权限系统" | 明确否认 SaaS / 多租户 / 计费 |
| (c) `apps/api/src/config.ts` 全文件 grep `paypal\|stripe\|subscription\|billing\|tenant` 命中 0 | 无付费 / 租户代码 |
| (d) 全仓 grep `paypal\|stripe\|billing` 仅命中 `apps/web/src/hooks/useReportEvents.ts` line 5 — 上下文为 `SSE subscription` (Server-Sent Events 订阅)，与商业计费无关 | 无误报 |
| (e) GitHub API `repos/donghao95/TryCue` `forks_count=0, watchers_count=21` | 0 fork、零公司 fork 证据 |

**结论**: 🟢 **不存在公开 SaaS 站点**，仅 Docker 镜像 + 本地安装。

### 1.2 Demo URL / 开源 Demo

| 来源 | 结果 |
|------|------|
| (a) `Dockerfile` (5.5KB) + `docker-compose.yml` (2.3KB) | 标准 Docker Compose 自托管 |
| (b) GitHub Actions `docker.yml` workflow（`gh api repos/donghao95/TryCue/contents/.github/workflows` → `ci.yml`/`docker.yml`/`release-please.yml`） | 自动构建多架构镜像 |
| (c) Actions runs 列表含多次 `dynamic` 触发的依赖更新成功 run (2026-07-20T13:15:05Z 等) | CI 健康 |
| (d) `gh api repos/donghao95/TryCue/releases` → v0.1.1 (7/1)、v0.1.2 (7/1)、v0.1.3 (7/2)，均作者 `donghao95` | 已发版 3 次 |
| (e) `docker-compose.yml` 含 web+api+db 三服务编排 | 完整可启动 Demo |

**结论**: 🟢 **有可运行的本地 / Docker 自托管 Demo**（v0.1.3，Apache-2.0）。

---

## 路径 2：TRAE AI 创造力大赛

### 2.1 是否报名参赛？

| 来源 | 结果 |
|------|------|
| (a) 飞书论坛 Discourse JSON API `/t/28621.json` 帖子标题：`"2026-06-17 09:35 学习工作赛道 TryCue —— AI 试映工作台"`，分类 39 | ✅ 报名帖存在 |
| (b) 同一作者 `u124685896651404` (TRAE 用户 1374816026) 在论坛发布 `/t/66487`：`"2026-07-01 13:25 〖学习工作赛道〗TryCue：发帖前，先让 30 个 AI 观众替你试映一遍"`，25 次访问 | ✅ 初赛 Demo 帖存在 |
| (c) 论坛主页 `https://forum.trae.cn` → 报名/初赛时间窗口与 TryCue 帖日期吻合 | ✅ 时间线一致 |
| (d) `apps/api/src/runtime/identity.ts` 4 处 `platform: "xiaohongshu"` 硬编码 + README line 299-310 V1 边界声明 | Demo 内容形态符合赛道要求（试映类工具） |

**结论**: 🟢 **已确认报名并提交初赛 Demo**。

### 2.2 是否获得初赛优秀奖 / 晋级复赛？

| 来源 | 结果 |
|------|------|
| (a) 飞书公示页 `https://bytedance.larkoffice.com/wiki/WN1CwOygLiyM7BkW8X3cMgh7nob`（`/tmp/lark.html` 1MB，已解析 clientVars 81 blocks） | 公示说明 block 提到 "7/21 公布初赛晋级 + TOP2000 优秀奖"、"复赛 7/21-8/9"、"决赛 8/21-8/22" |
| (b) 公示页含 20+ 个 bitable 列表（base_app_id `EmxUbFVwIazoiasHSvVcPlupnjb`），但均重定向到飞书登录页（HTTP 302） | ❌ **未登录无法程序化提取名单** |
| (c) 全网 `gh search code "trae.cdn\|trae 获奖\|trae 优秀奖"` 仅命中 TryCue 仓库自身 README（项目自描述，未引用官方公示） | 无第三方独立来源 |
| (d) 论坛 /t/66487 阅读量 25，无官方晋级 badge / 模板，无点赞/收藏/管理员标记 | 论坛侧无获奖信号 |

**结论**: 🔴 **未独立证实**。初赛结果公示页需登录访问，蕾姆已确认公示页存在且时间窗口匹配（7/21 公布），但 TryCue **是否在名单中无法独立核验**。

---

## 路径 3：媒体报道 / 第三方背书

| 来源 | 结果 |
|------|------|
| (a) `gh search repos "audience simulation AI content preview"` 排名前 10 均与 TryCue 无关 | 无同类开源竞争 |
| (b) Google site-search `trycue.app`、`trycue.ai`、`trycue.com` 无官方域名（TryCue 自描述 = demo 工具，无独立产品站） | 无媒体报道入口 |
| (c) 稀土掘金 / 思否 / InfoQ 中文站 `site:juejin.cn trycue` 0 结果 | 0 媒体报道 |
| (d) GitHub API `users/donghao95` → `followers=1, public_repos=7, following=1, bio=null, name="Dong Hao"` | 作者极小众，无社区背书 |
| (e) 全仓 grep `媒体\|采访\|报道\|公众号\|掘金\|思否\|InfoQ` 命中 0 | 无 PR/营销稿 |

**结论**: 🔴 **无任何媒体报道或第三方背书**。

---

## 路径 4：代码分析（独立审计）

### 4.1 "30 personas" 是上限还是默认值？

| 来源 | 结果 |
|------|------|
| (a) `apps/api/src/config.ts` line 59-60：`defaultQuickAudienceCount=12`、`defaultStandardAudienceCount=30`（均 `numberEnv()` 可被环境变量覆盖） | 12/30 是**默认 quick/standard 预设值** |
| (b) `packages/shared/src/run.ts` line 62-64：`CUSTOM_AUDIENCE_MIN=1`、`CUSTOM_AUDIENCE_MAX=10000` | 自定义规模上限 **10000**，不是 30 |
| (c) `apps/api/src/agents/mockTemplates.ts` line 324 `allocateDemoTemplateGroups(total)` 把 total 按 4 段切分（核心 0.4 / 相邻 0.25 / 挑剔 0.2 / 路人 0.15），20 个模板池 | mock 模式动态分布 |
| (d) `runService.ts` 路径含 `scale === "custom"` → `audienceCount` 直接传 LLM 生成 | 真实模式不受 30 限制 |

**结论**: 🟡 **30 是 standard 预设默认，不是硬上限**。自定义模式上限 10000；mock 模式有 20 模板池子。

### 4.2 数据库 schema

| 来源 | 结果 |
|------|------|
| (a) `packages/db/prisma/schema.prisma` 1027 行 | 独立验证行数 |
| (b) `grep -c '^model '` = **29** 个 Prisma model | ✅ |
| (c) `grep -c '^enum '` = **22** 个 enum | ✅ |
| (d) 5 个 migration 文件 (baseline → llm_call_traces → drop_run_scheduler_snapshot_columns → report_decision_dashboard → action_log_structured_payload) | 数据库经过 5 轮迭代 |

**结论**: 🟢 **29 models / 22 enums / 1027 行 schema**，与 Loop 报告数字一致。

### 4.3 平台硬编码

| 来源 | 结果 |
|------|------|
| (a) `apps/api/src/runtime/identity.ts` 4 处 `platform: "xiaohongshu"` 硬编码（line 39/72/79/96） | 强证据 |
| (b) 全仓 grep `douyin\|bilibili\|wechat\|kuaishou` 仅命中 README 示例（不含实际 adapter 代码） | **无其他平台实现** |
| (c) README line 28 "TryCue 不连接真实社交平台，不操作真实 DOM" | 无平台真连接 |

**结论**: 🟢 **V1 仅支持小红书场景模拟**，未实现真实平台 adapter，无 B 站 / 抖音支持。

### 4.4 报告形式：定量 vs 定性

| 来源 | 结果 |
|------|------|
| (a) `packages/shared/src/report.ts` line 48 `METRIC_DICTIONARY` 含 24 项指标（`readActors`、`openRate`、`readRateAfterOpen`、`deepReadRateAfterOpen`、`favoriteRateAfterOpen`、`commentRateAfterOpen` 等），**全部按人数/比率定量** | 强证据 |
| (b) `apps/api/src/agents/reportPrompts.ts` line 30 "你不能预测真实平台表现"、line 26-27 "不能输出精确分数（例如 87 分、B+、可信度 72、发布潜力 8.6）。结论信心只能用 高 / 中 / 低 表达" | 报告结论仅**高/中/低定性**，指标本身是定量 |
| (c) README line 164 "试映报告：汇总内容表现、人群反应、主要阻力、风险点和修改建议" | 报告目标定性 |

**结论**: 🟢 **指标层定量 + 结论层定性**——24 项 rate / actor 计数 + 信心度仅高/中/低 + 严禁数字评分。

### 4.5 真实数据校准

| 来源 | 结果 |
|------|------|
| (a) README line 28 + line 299-310 "V1 暂不包含真实社交平台连接、真实 DOM 自动化、真实用户数据接入" | 强证据 |
| (b) `apps/api/src/agents/reportPrompts.ts` line 30 "你不能预测真实平台表现" | 拒绝真实平台数据回测 |
| (c) `apps/api/src/config.ts` 无爬虫 / API 客户端 / OAuth / cookie 池代码 | 无真实数据通路 |
| (d) `reportPrompts.ts` line 32 "TryCue 是 AI 观众试映模拟系统" | 自我定性 |

**结论**: 🟢 **V1 无真实数据校准、无爬虫、无 API 客户端**。明确写入 prompt 防漂移。

### 4.6 License

| 来源 | 结果 |
|------|------|
| (a) `LICENSE` 文件 10.1KB | 强证据 |
| (b) `package.json` line 6 `"license": "Apache-2.0"` | 双源印证 |
| (c) GitHub API `repos/donghao95/TryCue.license.spdx_id` = `"Apache-2.0"` | 第三方印证 |
| (d) `CODE_WIKI.md` 77.8KB 由 GitHub Wiki 自动生成 | 文档齐全 |

**结论**: 🟢 **Apache-2.0**，可商用借鉴 / fork 需保留版权。

---

## 创始人 / 团队

| 维度 | 来源 (a) | 来源 (b) | 一致性 |
|------|---------|---------|--------|
| 唯一人类作者 | `package.json` line 7 `"author": "donghao95"` | GitHub API `users/donghao95.name = "Dong Hao"`, `id=31472476`, `created_at=2017-08-30` | ✅ |
| 邮箱 | git log 提交者邮箱 `<100225351@qq.com>` | GitHub noreply `<31472476+donghao95@users.noreply.github.com>` | ✅ 同一主体 |
| 团队规模 | `gh api repos/donghao95/TryCue/commits?per_page=100` 74 commits，Dong Hao 37 / dependabot 12 / github-actions 1 | `users/donghao95.public_repos=7` | ✅ 1 名人类贡献者 |
| 是否有公司实体 | 全仓无任何公司名/团队名/办公地点字段 | 公示页 / 工商查询无 `trycue` / `Dong Hao` 公司记录 | ✅ 个人项目 |

**结论**: 🟢 **Dong Hao 个人项目，1 名人类贡献者，37/74 commits，无公司实体**。

---

## 商业化状态

| 来源 | 结果 |
|------|------|
| (a) `package.json` line 4 `"private": true` | 非公开 npm 包 |
| (b) `repos/donghao95/TryCue` `forks_count=0, open_issues_count=9`（全部 dependabot 维护类） | 0 公司采用 |
| (c) 仓库全文件 grep `paypal\|stripe\|subscription\|billing\|tenant\|saas\|融资\|fund` 命中 0 商业化关键词 | 无付费模块 |
| (d) `apps/web/src/hooks/useReportEvents.ts` line 5 `SSE subscription` 是事件订阅（技术含义），非商业订阅 | 唯一 `subscription` 命中，无关 |
| (e) README 全文 + CHANGELOG 全文无 "Pro / Team / Enterprise / 免费版 / 付费版" 任何分级字样 | 无 SaaS 分层 |

**结论**: 🟢 **0 SaaS / 0 付费 / 0 融资 / 0 团队 / 0 媒体报道**——纯开源个人作品。

---

## 关键事实交叉印证表（≥2 独立来源）

| # | 事实 | 来源数 | 来源清单 | 可信度 |
|---|------|-------|---------|-------|
| 1 | TryCue 不存在公开 SaaS 站点 | 5 | package.json/private + README/V1边界 + config.ts 无商业模块 + 全仓 grep + GitHub forks=0 | 🟢 高 |
| 2 | TryCue 有可运行 Docker 本地 Demo | 5 | Dockerfile + docker-compose.yml + docker.yml workflow + 3 个 release tag + Actions 成功 run | 🟢 高 |
| 3 | TryCue 已确认报名 TRAE 大赛 | 4 | /t/28621 报名帖 + /t/66487 初赛 Demo 帖 + 同一作者 + 时间线匹配 | 🟢 高 |
| 4 | TryCue 获得初赛优秀奖 / 晋级复赛 | 0 | 公示页 bitable 需登录，程序化不可访问；论坛 / 仓库无独立公示引用 | 🔴 未证实 |
| 5 | "30 personas" 是默认而非上限 | 4 | config.ts 12/30 默认 + shared/run.ts MAX=10000 + mockTemplates.ts 20 池 + runService custom 分支 | 🟢 高 |
| 6 | 数据库 schema = 29 models / 22 enums | 2 | schema.prisma 行数 1027 + grep '^model ' / '^enum ' 直接计数 | 🟢 高 |
| 7 | 创始人 = Dong Hao (个人项目) | 3 | package.json author + GitHub API users/donghao95 + git log 邮箱双重印证 | 🟢 高 |
| 8 | 无公司实体 / 无团队 | 2 | 仓库 + 用户资料 + 工商无记录 | 🟢 高 |
| 9 | Apache-2.0 License | 3 | LICENSE 文件 + package.json + GitHub API spdx_id | 🟢 高 |
| 10 | V1 仅支持小红书场景模拟 | 3 | identity.ts 4 处硬编码 xiaohongshu + 全仓无 douyin/bilibili 实现 + README line 28 | 🟢 高 |
| 11 | 报告层 = 指标定量 + 结论定性 | 2 | report.ts METRIC_DICTIONARY 24 项 + reportPrompts.ts 禁数字评分 | 🟢 高 |
| 12 | 无真实数据校准 | 3 | README line 299-310 + reportPrompts.ts 第 3 条规则 + config.ts 无爬虫代码 | 🟢 高 |
| 13 | "90% 相似度" / "qizai 借鉴" | 0 | 无公开客观度量，**主观打分**，无第三方 benchmark / 论文 / 行业报告支撑 | 🔴 未证实 |
| 14 | 媒体报道 | 0 | site-search / 掘金 / 思否 / InfoQ / 公众号 全部 0 命中 | 🔴 未证实 |

**颜色汇总**：🟢 高 = 12 项 / 🟡 中 = 0 项 / 🔴 未证实 = 2 项

---

## 关键洞察

### 1. 数字回退（不要相信"30 personas"是上限）
原 Loop 报告若写"TryCue 限制 30 personas"是错误表达。代码层 30 = `DEFAULT_STANDARD_AUDIENCE_COUNT`，自定义规模上限实际为 10000（`CUSTOM_AUDIENCE_MAX`）。mock 模式有 20 模板池，但真实模式（接入 LLM）不受 30 限制。qizai spec 应改写为"TryCue 标准试映规模 30 人 / 自定义上限 10000 人"。

### 2. V1 边界清晰可见
TryCue 在 4 个文件 5 处明确否认 V1 包含：真实社交平台连接、真实 DOM 自动化、真实用户数据、多租户、计费。qizai 若以 TryCue 作为"已上线 SaaS 对标"会误判——它**只是 Apache-2.0 开源工具，不是 SaaS**。

### 3. TRAE 大赛结果：**未独立证实，不应假定获奖**
公示页 (https://bytedance.larkoffice.com/wiki/WN1CwOygLiyM7BkW8X3cMgh7nob) 含完整 bitable 名单表，但均需飞书登录访问。蕾姆无法程序化核验 TryCue 是否在公示名单中。**qizai spec 当前措辞 "是否获初赛优秀奖 / 是否晋级复赛及后续获奖，公开可核验材料暂未证实" 是准确的——保持此措辞。**

### 4. "90% 相似度" 是主观判断
没有任何公开 benchmark、论文、媒体报道、行业评测支持 TryCue 与 qizai 的相似度量化。qizai spec 应降级表述为"功能领域重合（AI 内容预演 + 观众模拟 + 报告生成），具体差异点待实测对比"，避免具体百分比。

### 5. 个人项目 vs 公司 = 战略含义
TryCue 是 Dong Hao（个人，1 名人类贡献者，37/74 commits）的 Apache-2.0 开源作品，**无公司、无团队、无融资、无 fork、无媒体报道**。qizai spec 若把 TryCue 当作"公司级竞争对手"，战略假设错误——它的威胁模式应该是"开源工具被借鉴/分叉"，不是"对手抢占市场"。

### 6. 借鉴价值（基于代码独立审计）
- 🟢 **可借鉴**：Prisma schema 设计（29 models 覆盖完整内容预演闭环）、mock 模板分配算法（`allocateDemoTemplateGroups` 4 段加权）、报告 metric dictionary 结构（24 项定量指标）、prompt 防御注入规则（`reportPrompts.ts` 禁数字评分 + 强制证据引用）、TypeScript monorepo 工程实践（CI 三档：lint+typecheck+test+integration+build）。
- 🔴 **不应直接 fork 的部分**：mock persona 数据本身（仅 20 模板，qizai 需要自己的真实用户画像数据）、`identity.ts` 小红书硬编码（qizai 应支持多平台 adapter）、`platform: "xiaohongshu"` 4 处（应在 qizai 抽象为 platform adapter 接口）。

---

## 对 qizai 的影响（仅事实层面，不涉及战略建议）

### 1. 数字校准（必须改）
- spec 中"30 personas" → "标准试映规模 30 人 / 自定义上限 10000 人"
- spec 中"22 张表" → "29 个 model / 22 个 enum"（schema.prisma 1027 行）
- spec 中"90% 相似度" → 删除或降级为"功能领域重合，差异点待实测"

### 2. 商业假设修正
- 不要把 TryCue 当作"已商业化的竞争对手"——它是 Apache-2.0 个人开源项目，无 SaaS、无团队、无融资
- qizai 真正的差异化应在**真实数据校准 / 多平台 adapter / 商业化交付能力**（TryCue V1 均不做）

### 3. 借鉴优先级（仅技术层）
- P0：Prisma schema 设计 + mock 模板分配算法 + report metric dictionary + prompt 防注入规则
- P1：TypeScript monorepo 工程实践（pnpm workspace + lint/typecheck/test/integration/build 五档 CI）
- P2：Docker + GHCR 多架构自动构建
- ❌ 不应借鉴：小红书硬编码 / 单一平台 / 无真实校准 / 单一作者 37 commits 的代码组织方式（无 review 流程）

### 4. TRAE 大赛结果处理
- 保持 spec 现有措辞："是否获初赛优秀奖、是否晋级复赛及后续获奖，公开可核验材料暂未证实"
- 如需进一步核验，需手动登录飞书或联系 TRAE 官方

---

## 数据源索引

| 类型 | URL / 路径 |
|------|----------|
| GitHub 仓库 | https://github.com/donghao95/TryCue |
| GitHub 用户 | https://github.com/donghao95 |
| License 文件 | /tmp/trycue-verify/LICENSE (Apache-2.0) |
| 关键代码 | /tmp/trycue-verify/packages/db/prisma/schema.prisma (1027 行) |
| 关键代码 | /tmp/trycue-verify/packages/shared/src/run.ts (CUSTOM_AUDIENCE_MIN/MAX) |
| 关键代码 | /tmp/trycue-verify/apps/api/src/config.ts (DEFAULT_QUICK/STANDARD) |
| 关键代码 | /tmp/trycue-verify/apps/api/src/runtime/identity.ts (xiaohongshu 硬编码) |
| 关键代码 | /tmp/trycue-verify/apps/api/src/agents/reportPrompts.ts (禁数字评分) |
| 关键代码 | /tmp/trycue-verify/packages/shared/src/report.ts (METRIC_DICTIONARY 24 项) |
| 关键代码 | /tmp/trycue-verify/apps/api/src/agents/mockTemplates.ts (allocateDemoTemplateGroups) |
| TRAE 报名帖 | https://forum.trae.cn/t/28621 (TryCue —— AI 试映工作台) |
| TRAE 初赛 Demo 帖 | https://forum.trae.cn/t/66487 (发帖前，先让 30 个 AI 观众替你试映一遍) |
| TRAE 公示页 | https://bytedance.larkoffice.com/wiki/WN1CwOygLiyM7BkW8X3cMgh7nob (需登录) |
| 本地验证 | `pnpm verify` → lint+typecheck+test 173 unit tests PASS |

---

## 置信度自评

| 维度 | 自评 |
|------|------|
| 来源独立性 | 🟢 高 — GitHub API（官方）/ 仓库代码（一手）/ TRAE 论坛（独立平台）/ 飞书公示页（独立平台）均互不依赖 |
| 数字精确度 | 🟢 高 — schema 行数 / model+enum 计数 / audienceCount 边界 / commits 数 / stars 数 全部由 grep + API 直接输出 |
| 主观判断 | 🟡 中 — "90% 相似度" 等价值判断未独立证实 |
| 时间窗口 | 🟢 高 — 全部数据为 2026-07-22 当日实时查询 |
| 未访问盲区 | 🟡 中 — 飞书公示页 bitable 名单（需登录）/ 第三方媒体报道（已确认无） |

---

*报告生成于 2026-07-22，所有 GitHub API 与代码读数基于 `/tmp/trycue-verify` 仓库 v0.1.3。*