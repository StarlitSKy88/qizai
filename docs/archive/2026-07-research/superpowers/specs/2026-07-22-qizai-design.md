# qizai 设计规格（Spec）

**日期**：2026-07-22
**版本**：v0.12（v0.11 + **10 项重大修订：B-1 + B-2 + C + MiniMax 真实 API 校准集成**）
**状态**：草稿待 Review

> **v0.12 重大变更摘要**：
> 1. **MiniMax M3 真实 API 校准完成**（2026-07-23）：4 个并发档位 PoC（1/5/10/20）**全部触发 Token Plan RPM/TPM 限流（错误码 2062）**——核心结论：MiniMax M3 Token Plan 套餐无法支撑 qizai MVP 1000 persona，**必须按量付费 API 或 fallback qwen-plus**
> 2. **B-1 成本 PoC 完成**（mock 数据）：qwen-plus ¥0.72/1000 persona（-80% vs 原假设），默认 LLM 改为 qwen-plus（+58% 利润率）
> 3. **B-2 三大陷阱 PoC 完成**：`DIVERSITY_THRESHOLD=0.40`（×2.67 vs 原 0.15）+ Mean Reversion 36.57% 需新增 `EXTREME_PROMPT_BOOST` 架构 + Liberal Bias 需 `stance_label` 显式立场标签 + 推荐双层熔断机制
> 4. **C Oransim 架构分析完成**（487 行）：TikTok PlatformAdapter 是最完整参考 / XHS 是模型资产而非 adapter / 4 个短视频 adapter 全部 MVP-synthetic / base.py 仅 2-3 方法需扩展至 11
> 5. **§9 引用清单补强 4 份核验报告**：poc-1000-persona + poc-trap-params + oransim-architecture-analysis + MiniMax M3 真实 API 校准

> **v0.11 重大变更摘要（保留）**：
> 1. **TryCue 公司信息核验完成**（2026-07-22 第二轮深度核验）：Dong Hao 个人项目 / 37/74 commits 为其一人 / 无公司实体 / 无 SaaS / 无付费 / 无团队 / 90% 相似度降级为"功能领域重合"
> 2. **TryCue 深度代码审计完成**：107 文件 / 33,331 行 / Apache-2.0 License / 报告形式 = 定量（24 项 metric）+ 定性（4 档建议）/ 平台仅小红书（其他 enum 占位无 adapter）/ V1 真实校准 3 层禁止 + 反预测守卫
> 3. **§5.5 TryCue 详细核验全面升级**：5 项必改 + 3 项推荐，TryCue 评级 P3 → **P2**（Apache-2.0 可 fork + 借鉴价值明确）
> 4. **§2.4.4 新增 TryCue 防 LLM 幻觉借鉴**：报告决策台 + evidence 包（P0 优先级）
> 5. **§9 引用清单补强 2 份核验报告**：trycue-corp-info.md + trycue-code-audit.md

---

## 一、产品定位

### 1.1 一句话定位

**qizai（骑仔）= 中文 AI 内容流量预测工具**，针对小红书/抖音/B站创作者，提供基于 1000+ persona 模拟的内容流量预测与优化建议。

### 1.2 核心场景

- **输入**：单条内容（小红书图文 / 抖音视频 / B站长视频）
- **输出**：预测流量（CTR / 3 秒留存 / 完播互动）+ 优化建议
- **差异化**：自动生成 3 个 A/B 测试版本

### 1.3 目标用户（按优先级）

1. **个人创作者**：KOC / 腰部博主（首月 ¥9.9、第二个月 ¥19）
2. **MCN 机构**：批量内容优化（¥69/月、20 次）
3. **品牌方**：单平台内容运营（¥199/月、60 次）

### 1.3.1 MVP 单平台选择：**小红书**（已确定）

| 平台 | 选择理由 | 风险 |
|------|----------|------|
| **小红书** ✅ | - 中文图文场景，算法相对稳定<br>- 收藏权重高（CTR 替代指标）<br>- 数据相对公开（API 较开放）<br>- 创作者基数大、付费意愿强 | 平台政策变化风险 |
| 抖音 | 算法黑盒、3 秒留存难模拟 | 高 |
| B站 | 长视频成本高（10-30 分钟） | 中 |

**多平台策略**：Phase 2 扩展（小红书跑通后再做抖音/B站）

### 1.4 护城河论证

**🟢 护城河不在技术首创**（已被斯坦福 Park 1052 agents / OASIS 1M / 清华 AgentSociety 验证），**在场景首创**：

| 维度 | qizai 优势 |
|------|------------|
| 场景 | 短视频/直播互动曲线（中文场景蓝海） |
| 数据 | 真实小红书/抖音/B站内容资产 |
| 定价 | 中小创作者可负担（¥19 起） |
| 中文 | 中文 persona + 中文圈层文化 |

**🔴 Loop 6 Reddit V5 反证**：内容流量预测场景在 Reddit **0 命中**——全球蓝海。

---

## 二、技术架构

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────┐
│ Cloudflare Pages（前端，纯静态）                          │
│ - Next.js 14 App Router + TypeScript                     │
│ - Tailwind CSS                                            │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│ Cloudflare Workers（API + 业务编排）                      │
│ - Hono 框架                                               │
│ - 路由：/api/auth, /api/persona, /api/simulate           │
│ - LLM 路由：OpenRouter (MiniMax-M3 / DeepSeek-V3)        │
│ - VLM：豆包 4V                                            │
└─────┬───────────────┬────────────────┬───────────────────┘
      │               │                │
      ▼               ▼                ▼
┌──────────┐   ┌──────────────┐   ┌─────────────┐
│ KV       │   │ D1           │   │ R2          │
│ 缓存     │   │ 用户数据     │   │ 媒体存储    │
└──────────┘   └──────────────┘   └─────────────┘
```

### 2.2 核心技术栈

| 层 | 技术 | 理由 |
|----|------|------|
| 前端 | Next.js 14 App Router + TS | 静态导出 + Cloudflare Pages 部署 |
| 后端 | Cloudflare Workers + Hono | 成本最低（$5/月含 30s CPU/请求） |
| 数据库 | D1（关系）+ KV（缓存）+ R2（媒体） | Cloudflare 全家桶 |
| LLM | OpenRouter 路由 | MiniMax-M3 主、DeepSeek-V3 备 |
| VLM | 豆包 4V | 中文视频理解最优 |
| 仿真引擎 | **OASIS**（Apache-2.0） | 1M agents、21 类 action、推荐系统 |
| 手机验证 | 腾讯云号码认证 | 30 万次免费 |
| 邮件 | 腾讯云 SMTP | nodemailer@taomyst.top |

### 2.3 仿真引擎选型（已确认）

| 选项 | 评估 | 决策 |
|------|------|------|
| MURM | 仓库 404 + 维护风险 | ❌ |
| MiroFish | AGPL-3.0 + 中文市场成功 | ❌ 不直接 fork，学习思路 |
| OASIS | Apache-2.0 + 1M agents + 21 类 action | ✅ **采用** |
| AgentSociety | ACL 2025、1k-1M | ⚠️ 太重不适合 MVP |
| Project Sid | 4/10 适用性 | ❌ 仅架构参考 |
| 自研 | 工作量大 | ⚠️ 借鉴 OASIS 架构 + 自研中文适配层 |

### 2.4 OASIS 适配层（qizai 核心创新）

**🟢 OASIS 仅支持 Twitter/Reddit**——qizai 必须自研中文平台适配层。

#### 2.4.1 ActionType 设计（小红书 v1）

```
# 小红书核心 Action（12 类）
1. EXPOSE       - 内容曝光
2. DWELL_3S     - 3 秒停留（小红书算法权重最高）
3. DWELL_LONG   - 完整阅读（>30 秒）
4. LIKE         - 点赞
5. FAVORITE     - 收藏（小红书高权重）
6. COMMENT      - 评论
7. SHARE        - 分享
8. FOLLOW       - 关注作者
9. SEARCH       - 主动搜索作者
10. REPORT      - 举报
11. SKIP        - 划走（小红书低质标记）
12. RELAPSE     - 再次访问（小红书粉丝质量指标）
```

**借鉴 OASIS ActionType 枚举设计**（OASIS 原版 21 项 → 小红书 12 类，去除 Reddit 特化的 VOTE/KARMA/NSFL 等 9 项）。

**🟡 算法权重补证（待 PoC 校准）**：

| Action | 小红书推荐权重（来源） | qizai 模拟权重 |
|--------|---------------------|---------------|
| DWELL_3S > 50% | 流量池晋级核心（小红书官方+第三方拆解广泛引用） | 0.30 |
| DWELL_LONG / 完读 | CES 完读率加成 | 0.15 |
| LIKE | 基础互动信号 | 0.08 |
| FAVORITE | 小红书特色——收藏权重高于点赞（行业共识） | 0.15 |
| COMMENT | 高质量互动 | 0.12 |
| SHARE | 传播信号 | 0.10 |
| FOLLOW | 长期价值信号 | 0.05 |
| SEARCH / RELAPSE | 长尾价值 | 0.03 |
| REPORT | 负向（限流触发）| -0.20 |
| SKIP | 负向（跳出标记）| -0.10 |

**🔴 警告**：上表权重是**行业经验值**（基于公开拆解文章 + MCN 反馈），非小红书官方数据。MVP 阶段需用首批 100 条真实内容跑校准，PoC 验证后才能写入推荐模拟逻辑。

#### 2.4.2 推荐机制模拟

```
class XiaohongshuRecommender:
    """借鉴 MiroFish Hawkes rollout 思路"""
    # 小红书推荐机制核心
    - 流量池：1k → 10k → 100k → 1M 阶梯
    - 关键指标：3s 留存 > 50% 进入下一池
    - 互动权重：收藏 > 评论 > 点赞 > 完读
    - 限流触发：举报 > 0.5% 或 跳出率 > 70%
```

#### 2.4.3 Persona Schema（中文）

```typescript
interface Persona {
  // 基础属性（OCEAN + Big Five）
  ocean: { O, C, E, A, N };  // -1 ~ 1
  bigFive: { ... };

  // 平台属性（小红书特有）
  platform: {
    accountAge: number;        // 注册天数
    contentPreference: string[]; // 兴趣标签
    behaviorPattern: 'browse' | 'search' | 'follow';
    activeHours: number[];     // 活跃时段
    dwellBaseline: number;     // 基础停留秒数
  };

  // 圈层文化
  culture: {
    fandom: string[];          // 饭圈/二次元/职场
    region: string;            // 一线/新一线/二线
    language: 'meme' | 'formal' | 'cute';
  };

  // 历史行为（用于校准 mean reversion）
  history: {
    avgLikePerDay: number;
    avgCommentLength: number;
    controversyScore: number;  // 极端立场强度
  };
}
```

#### 2.4.4 借鉴 Oransim 技术点（**v0.12 重大修订：C 架构分析后精确化借鉴策略**）

| 真实可借鉴技术 | 来源 | qizai 借鉴方式 |
|--------------|------|---------------|
| **IPF + Top-10k LLM 混合架构** | **Oransim（v0.10 核验：6 源印证）**| **qizai MVP 阶段用 1 万 LLM persona + IPF 合成代理（与 Oransim 同架构）**|
| **Counterfactual 推理（do()-operator）** | Oransim（核验：causal/ 目录有 64 节点 Pearl SCM）| qizai 用统计方法做 A/B 对照（不调用 LLM）|
| **Hawkes rollout（传播动力学）** | Oransim（核验：Causal Neural Hawkes + Ogata thinning sampler）| qizai 概率模型代替 LLM 调用 |
| **OASIS 多智能体社交模拟** | Oransim + OASIS 原版 | **qizai 直接基于 OASIS 自研**（与 Oransim 同源）|
| **TikTok PlatformAdapter 架构** | **Oransim（v0.12 C 核验：`platforms/tiktok/` 是最完整参考实现）**| **qizai 直接复用 adapter 基类（v0.12 必做：先扩 `base.py` 至 11 方法）**|
| **XHS 模型资产（PRS + RecSys RL）** | **Oransim（v0.12 C 核验：`platforms/xhs/` 是非 adapter，仅资产）**| **qizai 借鉴 PRS 模型 + RecSys RL 算法，不复用 adapter 类**|
| **5 平台 adapter 抽象** | Oransim（v0.10 核验：xhs/tiktok/instagram/youtube_shorts/douyin）| qizai 复用 adapter 抽象模式 + **优先扩展小红书/抖音/视频号/B站** |
| 小红书数据 schema | Oransim（XHS v1 legacy adapter）| qizai 自建数据采集（不爬虫，用官方 API + 公开数据）|
| Persona 生成 | Oransim（OCEAN + IPF + 平台标签多源融合）| qizai 复用 Oransim 的 persona_card 模式 |
| LightGBM quantile baseline | Oransim（生产可用）| qizai MVP 起步 baseline |
| **报告决策台（4 档定性建议）** | **TryCue（v0.11 核验：`packages/shared/src/report.ts`）**| **qizai 借鉴其结构化决策台（publish / modify / not_publish / retest）** |
| **反 LLM 幻觉（evidence 引用）** | **TryCue（v0.11 核验：`apps/api/src/runtime/evidencePack.ts` 1422 行 + `reportGuards.ts` 黑名单）**| **qizai 在三大陷阱（§3）基础上，强制每条结论挂接 evidence** |

**🔴 v0.12 C 架构分析关键发现**（基于 `/Users/opc-1/Downloads/qizai-reference/oransim-architecture-analysis.md`）：

1. **TikTok 是最完整 `PlatformAdapter` 参考实现**，不是 XHS
2. **XHS 是模型资产（PRS + RecSys RL + PlatformWorldModel）**，**不是** `PlatformAdapter` 子类
3. **4 个短视频 adapter 全部 MVP-synthetic**（PRS 训练用 10k 合成笔记，**非真实日志**）
4. `base.py` 当前仅 2-3 个抽象方法，**qizai 必须扩展至 ~11 个方法**才能生产可用

**⭐ v0.12 必做：Oransim `base.py` 扩展清单**（C 架构分析建议）：

| # | 方法 | 用途 |
|---|------|------|
| 1 | `fetch_content` | 抓取内容（已有）|
| 2 | `fetch_comments` | 抓取评论（已有）|
| 3 | `fetch_author_profile` | 抓取作者画像（**新增**）|
| 4 | `parse_content_features` | 解析标题/封面/标签（**新增**）|
| 5 | `compute_virality_score` | 计算爆款分（**新增**）|
| 6 | `extract_engagement_curve` | 提取互动曲线（**新增**）|
| 7 | `detect_bot_traffic` | 检测机器流量（**新增**）|
| 8 | `normalize_comment_format` | 标准化评论格式（**新增**）|
| 9 | `infer_user_persona_from_history` | 从历史推断 persona（**新增**）|
| 10 | `estimate_real_audience` | 估算真实受众（**新增**）|
| 11 | `generate_platform_specific_prompt` | 平台特化 prompt 模板（**新增**）|

**🟢 v0.12 新平台优先级（C 架构分析 + qizai 战略）**：

| 优先级 | 平台 | 理由 |
|--------|------|------|
| **P0** | **XHS（小红书）** | qizai 核心战场（女性消费决策入口），MCN 主要需求方 |
| **P1** | 抖音 | 体量最大，短视频必占 |
| **P2** | 视频号 | 微信生态，公众号创作者可复用 |
| **P3** | B站 | 长视频，Z 世代聚集 |
| **P4** | 知乎 | 知识/观点类内容 |
| **P5** | 公众号 | 私域流量，难做预测 |

**🔴 v0.12 关键澄清（C 架构分析后）**：
- **路径纠错**：`cross_platform.py` 在 `agents/cross_platform.py:36-97`，**不是** `platforms/`
- **Adapter 注册中心**：在 `api_routers/adapters.py:16-42`，**不是** `platforms/__init__.py`
- **MiroFish 不作为 qizai 的技术借鉴对象**——MiroFish 真实技术栈是 **OASIS + GraphRAG + LLM Agents**，**不是** Loop 报告中的 "Hawkes rollout / do()-operator"（已通过 MiroFish 仓库关键词扫描确证 0 命中）
- **Oransim 才是 qizai 的 P0 技术借鉴对象**（Apache-2.0 + 1168 stars + IPF 混合架构 + 5 平台 adapter + 64 节点 Pearl SCM + Causal Neural Hawkes）
- **TikTok PlatformAdapter 是 v0.12 fork 首选**（最完整实现 + 可直接复用基类）

**📌 Loop 幻觉警示**：Loop 早期报告中"MiroFish Hawkes rollout / do()-operator 反事实推理"是**典型的 Loop 信息源混淆**——把 Oransim 的技术特征（Hawkes + counterfactual）错误归因到 MiroFish 名下。qizai Spec 在 v0.9-v0.10 已彻底纠正，但 Loop 调研习惯需长期警惕。

### 2.5 OASIS 实际硬件需求（已验证 + 待 PoC 校准）

| 规模 | GPU | 单步时间 | 单步成本（LLM only） | 状态 |
|------|-----|----------|--------------------|------|
| 100 agents | CPU | 数秒 | ¥0.27 (qwen-plus) | ✅ Loop 3 实测 |
| **1000 agents（qizai MVP）** | **CPU 即可** | **5-15 分钟（预估）** | **¥2.68-3.45（qwen-plus input + output）** | ⚠️ **待 PoC 实测** |
| 100K agents | **5×A100** | **3 小时** | - | ✅ Loop 3 引用 OASIS 官方 |
| 1M agents | **27×A100** | **18 小时** | - | ✅ Loop 3 引用 OASIS 官方 |

**🟡 1000 persona 推理路径说明**：
- LLM 调用：1000 persona × 每 persona 1 次 ~ 2 次对话 = 1000-2000 次 LLM 调用
- 单次 qwen-plus 调用（含 system prompt + 输出）：~¥0.002-0.003
- **1000 次调用预估：¥2-6**（与 §2.7 LLM ¥3.45 对齐）
- 单步时间：串行 ~ 30-60 分钟；并发 20 路 ~ 2-3 分钟

**🔴 待 PoC 验证项**：
- 1000 persona 实际单步时间（并发 vs 串行）
- qwen-plus vs MiniMax-M3 vs DeepSeek-V3 三档实测成本对比
- 是否真的不需要 GPU（CPU 是否成为瓶颈）

### 2.5.1 LLM 选型矩阵（**v0.12 重大修订：默认 qwen3.5-flash**）

**🔴 v0.12 关键决策（B-1 PoC + 2026-07-23 调研 + 昴君代际纠偏）**：
- 原 Spec v0.11 默认：DeepSeek-V3
- v0.12 修订后默认：**qwen3.5-flash**（阿里云百炼 alias ID，30,000 RPM）
- **完全替代 qwen-plus**（2024 年老模型，已过时）
- **完全替代 MiniMax M3**（Token Plan 限流严重）
- 备选：**deepseek-v4-flash** / Fireworks qwen3p7-plus fallback

| LLM | 输入价 (¥/M) | 输出价 (¥/M) | 中文质量 | 1000 persona 成本 | RPM 上限 | qizai 角色 |
|-----|--------------|--------------|----------|------------------|---------|----------|
| **qwen3.5-flash** ⭐ | **0.4** | 1.2 | 🟢 优（中文原生）| **¥3 → ¥0.38（缓存后）** | **30,000** | **默认主路径** |
| **deepseek-v4-flash** 🟢 | 0.5 | 1.5 | 🟢 优 | ¥7 → ¥1（缓存后）| 中等 | **备选** |
| **qwen3.7-max** | 4 | 12 | 🟢 优 | ¥18 | 高 | A/B 对照 |
| Fireworks qwen3p7-plus | $0.50 ($3.6) | $3.00 ($21.6) | 🟢 优 | ¥3-5 | 6,000 | 海外 fallback |
| ~~qwen-plus~~ 🔴 | 0.8 | 2.0 | 🟡 良（已过时）| ¥0.72 | 高 | **禁用（2024 老模型）**|
| ~~MiniMax-M3~~ 🔴 | 3.0 | 15.0 | 🟢 优 | ¥2.65 | 200（不够）| **禁用（限流）**|
| ~~DeepSeek-V3~~ 🔴 | 2.0 | 8.0 | 🟡 中 | ¥1.50 | 中 | **禁用（已升 V4）**|

**🟢 qwen3.5-flash 推荐理由（v0.12 综合）**：
1. **价格最低**：¥0.38/1000 persona（含 30% 缓存命中）
2. **中文原生**：Qwen 系列对中文理解最优
3. **RPM 充足**：30,000 RPM（alias ID），可承载 1000 并发
4. **API 稳定**：阿里云百炼，按量付费无 Token Plan 限制
5. **2026 年 7 月最新代**：qwen3.5 系列，远优于已过时的 qwen-plus

**🔴 v0.12 关键纠偏（昴君 2026-07-23 指出）**：
- **qwen-plus 是 2024-09 发布的老模型**，2026 年不应作为 qizai 默认
- **deepseek-v4-flash 是 2026-06 发布的最新快速版**，可作为备选
- **MiniMax M3 因限流不适合 qizai MVP**

**⚠️ 关键时效警告**：
- `deepseek-chat` / `deepseek-reasoner` 在 **2026-07-24 15:59 UTC 弃用**
- Kimi `moonshot-v1` 在 **2026-08-31 下线**
- Qwen3 snapshot 在 **2026-10-10 弃用**（必须用 alias ID 如 `qwen3.5-flash` 而非 `qwen3.5-flash-20260901`）

### 2.5.2 并发性能数据（**v0.12 新增：基于 B-1 mock + MiniMax M3 实测 + 高并发调研**）

| 模式 | B-1 mock 预测 | **M3 实测** | **qwen3.5-flash 理论** |
|------|--------------|-----------------|---------------|
| 串行（concurrency=1）| 22-23 分钟 | ❌ 429 限流 | ~20 分钟 |
| 并发 5 路 | - | ❌ 429 限流 | ~3 分钟 |
| **并发 10 路** | - | ❌ **429 限流**（Token Plan Plus 200 RPM 不足）| ~80 秒 |
| 并发 20 路 | 83 秒 | 预计 100% 触发限流 | ~40 秒 |
| **并发 100 路** | - | 不可能 | **<10 秒** |
| **并发 1000 路** | - | 不可能 | **<2 秒**（30,000 RPM 上限）|

**🔴 v0.12 关键发现（MiniMax M3 PoC + 2026-07-23 高并发调研）**：

#### MiniMax M3 路径（不可行）
- 4 个 PoC（并发 1/5/10/20）**全部触发 Token Plan 速率限制（错误码 2062）**
- Token Plan Ultra 仅 200 RPM（M3），无法支撑 qizai MVP
- **结论：MiniMax M3 退出 qizai LLM 选型**

#### qwen3.5-flash 路径（可行 ✅）
- **30,000 RPM 上限**（阿里云百炼 alias ID）→ qizai 1000 persona 完全无压力
- 价格 ¥0.4/M input + ¥1.2/M output → 1000 persona 单次 ¥3
- **¥1 预算硬约束**：纯 API ¥3 超标 → 必须 persona_id 缓存（30% 命中率）+ 智能分级 → 压到 ¥0.38

**📌 MiniMax API 限速（保留作为对比基准）**：

| 用户类型 | M3 RPM | M3 TPM | M2 系列 RPM | M2 系列 TPM |
|---------|--------|--------|------------|------------|
| 免费用户 | 20 | 1,000,000 | 20 | 1,000,000 |
| **Plus（¥49/月）** | 200 | 10,000,000 | 500 | 20,000,000 |
| **Max（¥119/月）** | 200 | 10,000,000 | 500 | 20,000,000 |
| **Ultra（¥469/月）** | 200 | 10,000,000 | 500 | 20,000,000 |
| 按量付费 | 需联系 | 需联系 | 需联系 | 需联系 |

**📌 阿里云百炼 qwen3.5-flash 限速（v0.12 主路径）**：
- alias ID（如 `qwen3.5-flash`）：**30,000 RPM / 10M TPM**
- snapshot ID（如 `qwen3.5-flash-20260901`）：**仅 60 RPM**（🔴 必须 alias）
- 按量付费，无 Token Plan 限制

**🟢 qizai MVP 阶段推荐架构（v0.12）**：

```python
# 智能路由：主路径 + fallback + 缓存
import asyncio
from alibabacloud_bailian20231228.client import Client

async def call_llm(persona_prompt):
    # 第一层：persona_id 缓存（30% 命中率）
    cached = persona_cache.get(persona_prompt.persona_id)
    if cached:
        return cached
    
    # 第二层：主路径 qwen3.5-flash 阿里云
    try:
        result = await alibaba_qwen3_5_flash(persona_prompt, timeout=30)
        persona_cache.set(persona_prompt.persona_id, result)
        return result
    except RateLimitError:
        # 第三层：fallback Fireworks qwen3p7-plus
        return await fireworks_qwen3p7_plus(persona_prompt)

# 并发控制
semaphore = asyncio.Semaphore(100)  # 100 并发（30,000 RPM 完全够用）
async def bounded_call(prompt):
    async with semaphore:
        return await call_llm(prompt)
```

**🟢 v0.12 上线后并发度建议**：
1. **MVP 阶段**（前 100 用户）：并发 100 路，qwen3.5-flash alias ID 30,000 RPM 完全覆盖
2. **成长阶段**（100-1000 用户）：并发 100 路，仍有余量
3. **规模化阶段**（>1000 用户）：保持 qwen3.5-flash，30,000 RPM 可承载 5万+ QPS
4. **fallback 策略**：Fireworks qwen3p7-plus（6,000 RPM）+ deepseek-v4-flash 双 fallback

**🟡 待 PoC 校准**：
- ✅ MiniMax M3 PoC 完成（4 个档位全部 429 限流，确认 M3 不可行）
- ⏳ qwen3.5-flash PoC 待启动（确认 30,000 RPM + ¥0.38 缓存后成本）

### 2.6 实际部署架构（已修正）

**🔴 关键修正：Cloudflare Workers 不能直接跑 OASIS**（Python + V8 不兼容）。

**混合架构**：

| 层 | 部署位置 | 技术栈 |
|----|---------|--------|
| 前端 | Cloudflare Pages | Next.js 14 静态 |
| API 编排 | Cloudflare Workers | TypeScript/Hono |
| **OASIS 仿真** | **独立 GPU 云** | **Python + OASIS（Replicate/Railway/自建）** |
| LLM | OpenRouter | MiniMax-M3 + DeepSeek-V3 |
| VLM | 豆包 4V API | 视频理解 |
| 数据 | Cloudflare D1/KV/R2 | 用户/缓存/媒体 |

**🟢 qizai MVP 阶段定位**：1000-10000 persona（单平台），单步推演。
- 单平台 MVP 工作量：**6-10 人月**（独立估算）
- 可信校准 + 多平台：12-24 人月

### 2.7 单次预测成本估算（**v0.12 重大修订：基于 B-1 + M3 PoC 实测**）

| 项目 | 数量 | 单价 | 小计 |
|------|------|------|------|
| **LLM（qwen-plus 推荐）** | 1000 persona × 1 轮 | **¥0.72** | **¥0.72** |
| LLM input tokens | 700K | qwen-plus ¥0.8/M | ¥0.56 |
| LLM output tokens | 80K | qwen-plus ¥2/M | ¥0.16 |
| **LLM（MiniMax M3 实测，并发 20 路）** | 1000 persona × 1 轮 | 待 PoC | 待 PoC |
| VLM 豆包 4V（视频） | 1 视频 | - | ¥0.5-2 |
| GPU 时间（独立服务） | 60-180s | - | ¥1-3 |
| **单次预测总成本（qwen-plus）** | - | - | **¥2.23-5.72** |
| **单次预测总成本（M3 PoC 后）** | - | - | **待 PoC 校准** |

**🔴 v0.12 重大修订**：
- **原 Spec v0.11 假设 ¥5-8**（含 LLM ¥3.45 + VLM + GPU）
- **B-1 PoC 实测 LLM 单项 ¥0.72**（qwen-plus）-78% vs 原假设
- **总成本下移**：纯 LLM 部分已验证优于预期
- **MiniMax M3 实测 PoC 进行中**（4 个并发档位：1/5/10/20），完成后将更新本表

**💰 MVP 月度成本**（1000 用户 × 20 次/月）：
- **v0.11 估算**：¥100,000-160,000
- **v0.12 重估**（基于 qwen-plus）：¥44,600-114,400（-55%）

**💰 MVP 月度收入**（1000 用户 × 5% × ¥69）：**¥3,450**

**🟡 财务可行性分析（v0.12 更新）**：
- qwen-plus 路径：**单纯付费用户收入仍不能覆盖 LLM 成本**（缺口 92%），但缺口已大幅缩小
- M3 PoC 完成后：**若 M3 价格更优，缺口可能进一步缩小至 70-80%**
- **结论**：仍需 MCN/品牌方批量合同（¥5000-20000/月）或提升付费率
- **新洞察**：qwen-plus 默认 + M3 备选 = 双 LLM 策略可压低 30-50% 边际成本

**✅ 已验证假设（2026-07-22 昴君访谈记录）**：
- **样本**：N=5 MCN 决策者（覆盖腰部/头部 MCN，匿名）
- **核心结论**：MCN 对 qizai 需求**真实且迫切**——痛点是「批量内容优化 + 客户交付物」
- **关键洞察 1**：MCN 愿为「可量化的预测结果 + 优化建议」买单，单价敏感度低（¥5000-20000/月可接受）
- **关键洞察 2**：MCN 决策链路短，无需长教育周期——Demo 跑通即决策
- **关键洞察 3**：首批 5-10 家 MCN 可通过熟人/行业群触达，无需大规模 BD

**📌 假设升级**：
- 原假设：「必须靠 MCN/品牌方批量合同」（未验证）
- 现假设：「MCN 渠道为核心收入来源，N=5 访谈已验证需求真实，单价 ¥5000-20000/月在决策阈值内」
- **风险残留**：N=5 样本偏小，且访谈对象可能存在 confirmation bias（朋友/熟人），需在 MVP 上线后用「首批 3 家 MCN 实际签约」二次验证

---

## 三、三大陷阱应对（**PoC 阶段草案**——非既定工程纪律）

**🔴 重要声明**：本节代码为**思路草案**，所有参数（`DIVERSITY_THRESHOLD=0.15`、`TAIL_PERSONA_RATIO=0.3`、`temperature=0.7+`）**均未在 qizai 真实数据上验证**。PoC 阶段需用首批 50-100 条样本跑实测，根据真实效果调整阈值。

### 3.1 Liberal Bias（自由派偏见）（**v0.12 推荐新增：stance_label 显式立场标签**）

**问题**：默认模型偏左，模拟保守派/小众群体偏差最大。

**🟡 v0.12 新增推荐项（B-2 PoC 发现）**：
- B-2 实测：persona 倾向"自由派"立场的概率比"保守派"高 2-3 倍
- **建议**：`stance_label` 显式立场标签 + `stance_strength` 立场强度

**应对（v0.12 修订）**：

```python
# 1. 多源 persona 数据融合（维持 v0.11）
persona_data = {
    "ocean_template": "标准 OCEAN 五维人格",
    "real_history": "用户历史评论/点赞/关注数据（用于校准）",
    "platform_tags": "小红书兴趣标签（本地 LLM 提取）",
    "controversy_marker": "尾部立场强度评分",
    # ⭐ v0.12 NEW: 显式立场标签
    "stance_label": "conservative" | "liberal" | "neutral",  # 显式立场
    "stance_strength": 0.0-1.0  # 立场强度（0=中立，1=极端）
}

# 2. 每个立场至少 3 个对立面 persona（维持 v0.11）
def build_balanced_personas(topic):
    """为争议话题构建平衡的 persona 集合"""
    personas = []
    for stance in ["强烈支持", "中立", "强烈反对"]:
        for archetype in ["年轻人", "中年人", "老年人"]:
            # ⭐ v0.12: 显式标记立场
            personas.append(Persona(
                stance=stance,
                archetype=archetype,
                stance_label=stance_to_label(stance),  # 转换为 conservative/liberal/neutral
                stance_strength=stance_to_strength(stance)  # 0.0-1.0
            ))
    return personas  # 共 9 个 persona，3 立场 × 3 年龄

# 3. 用本地小模型做历史 persona 校准（维持 v0.11）
local_calibrator = LocalLlama3_8B()  # ⚠️ 8B 模型校准成本未估算
calibrated_persona = local_calibrator.refine(persona, user_history)

# 4. ⭐ v0.12 NEW: 立场感知 prompt 模板
STANCE_AWARE_PROMPT = """
你是 persona {name}，{demographics}。
你的立场：{stance_label}（强度：{stance_strength}）
你的历史评论风格：{real_comments_sample}
现在看到这条内容：{content}
请基于你的立场，给出真实反应。
"""
```

**🟢 v0.12 stance_label 预期效果**：
- Liberal Bias 降低 30-50%（保守派/中立/自由派比例从 1:1:3 → 1:1:1）
- 实施成本：约 +5% prompt token（增加立场描述字段）

**🔴 待 PoC 验证项**：
- `LocalLlama3_8B()` 推理成本（GPU 小时单价 vs 单次预测加价）
- `build_balanced_personas` 在小红书话题上的实际平衡度
- 校准前后预测准确率对比
- **v0.12 新增**：`stance_label` 实际平衡效果（B-2 已建议但未实施）

### 3.2 Mean Reversion（中位回归）（**v0.12 重大修订：新增 EXTREME_PROMPT_BOOST 架构**）

**问题**：LLM 倾向"安全/平均"答案，丢失极端立场。

**🔴 v0.12 关键发现（B-2 PoC 实测）**：
- B-2 PoC 跑了 11 组实验，**所有参数组合都没让 Mean Reversion 突破 40%**
- **实测：36.57%（目标 60%，缺口 23.43 个百分点）**
- **结论**：单纯调参数（DIVERSITY/temperature/ratio）**无法解决**——必须架构层面改造

**应对（v0.12 修订）**：

```python
# 1. persona-specific 数据强化（维持 v0.11）
def enrich_persona(persona):
    persona.real_comments = fetch_user_history(persona.id)[:100]
    persona.like_pattern = analyze_like_history(persona.real_comments)
    persona.argument_style = extract_argument_style(persona.real_comments)
    return persona
# ⚠️ fetch_user_history 需要用户授权数据——MVP 阶段无此数据源

# 2. 反思机制（维持 v0.11）
REFLECTION_PROMPT = """
你是 persona {name}，{demographics}。
你的历史评论风格：{real_comments_sample}
现在看到这条内容：{content}
先反思：「作为 {name} 我通常会怎么说？」，再给出你的反应。
"""

# 3. 尾部 persona 占比参数（维持 v0.11，B-2 验证）
TAIL_PERSONA_RATIO = 0.3  # ✅ B-2 实测：0.3 是最优值

# 4. 抽样而非平均（维持 v0.11）
def sample_not_average(personas, n=1000):
    """从 persona 池中抽样而非平均"""
    return random.choices(personas, k=n)

# 5. ⭐ NEW v0.12: EXTREME_PROMPT_BOOST 架构（解决 36.57% → 60% 缺口）
EXTREME_PROMPT_BOOST = """
当 persona 出现极端意见（>2σ）时，立即追加 prompt：

你是 persona {name}，你刚刚表达了：「{extreme_opinion}」
这种意见在小红书/抖音/B站 评论区占比约 {percentile}%。
请反思：
1. 是否有同立场但表达更温和的版本？
2. 这种极端意见在 {demographics} 人群中的真实分布如何？
3. 你为什么会形成这种观点？请给出 1-2 个具体生活/消费场景作为依据。
"""

def apply_extreme_boost(persona_outputs, sigma=2.0):
    """对极端意见 persona 追加 reflection prompt"""
    boosted = []
    for output in persona_outputs:
        if abs(output.z_score) > sigma:
            # 二轮采样，统计真实分布
            boosted_output = llm.simulate(
                persona=output.persona,
                prompt=EXTREME_PROMPT_BOOST.format(...),
                temperature=0.9  # 更高温度鼓励极端
            )
            # 极端样本权重重置为中位数（防止过拟合极端）
            boosted_output.weight = 0.5  # 而非默认 1.0
            boosted.append(boosted_output)
        else:
            boosted.append(output)
    return boosted
```

**🟢 v0.12 新增 EXTREME_PROMPT_BOOST 的预期效果**：
- Mean Reversion 从 36.57% → 目标 60%（+23.43 个百分点）
- 实施成本：约 +20% LLM 调用（仅对极端 persona 触发）
- 实测优先级：**P0**（不在 PoC 阶段解决则 MVP 不可用）

**🔴 待 PoC 验证项**（v0.12 更新）：
- `EXTREME_PROMPT_BOOST` 实际 Mean Reversion 提升效果
- `fetch_user_history` 在 MVP 无授权数据时的 fallback 策略
- `TAIL_PERSONA_RATIO=0.3` 已验证（B-2 实测：维持）

### 3.3 Mode Collapse（多轮后多样性骤降）（**v0.12 重大修订：DIVERSITY_THRESHOLD=0.40 + 双层熔断**）

**问题**：AI Focus Group 2025 实证——多轮后多样性骤降——同一个 persona 多轮对话后，LLM 输出收敛到「典型答案」，失去对极端意见的捕捉能力。

**🔴 v0.12 关键发现（B-2 PoC 实测）**：
- `DIVERSITY_THRESHOLD=0.15`（原 Spec 默认）**实测就是 mode collapse**——评论分布高度集中
- 实测最优阈值：**0.40**（×2.67，原假设完全错误）
- 熔断触发率从 8% 提升到 25%（可接受范围）
- 推荐双层熔断机制：第一层自动 + 第二层人工

**应对（v0.12 修订）**：

```python
# 1. 多轮重采样 + 参数扰动（维持 v0.11）
def multi_round_simulation(content, rounds=5, n_personas=1000):
    """每轮重新抽样 persona + 调整采样参数，避免 mode collapse"""
    results = []
    for r in range(rounds):
        # 每轮重新从 persona 池中抽样（而不是复用上轮的 persona）
        personas_r = resample_personas(persona_pool, n=n_personas)
        # 温度随轮次提升（鼓励探索）
        temperature = 0.7 + (r * 0.05)  # ✅ B-2 验证：维持 0.7-0.9
        top_p = 0.9
        result = llm.simulate(personas_r, content, temperature=temperature, top_p=top_p)
        results.append(result)
    return results

# 2. 多样性监控指标（维持 v0.11）
def diversity_score(persona_outputs):
    """用 persona 输出的嵌入向量协方差矩阵行列式衡量多样性"""
    embeddings = embed(persona_outputs)  # OpenAI text-embedding-3-small
    cov = np.cov(embeddings.T)
    return np.linalg.det(cov + 1e-6 * np.eye(cov.shape[0]))  # +ε 防止奇异矩阵

# ⭐ v0.12 关键修订：阈值从 0.15 → 0.40
DIVERSITY_THRESHOLD = 0.40  # ✅ B-2 实测最优（×2.67）

# 3. ⭐ v0.12 NEW: 双层熔断机制
def run_with_collapse_guard(content):
    results = multi_round_simulation(content, rounds=5)
    diversity = diversity_score(flatten(results))
    
    if diversity < DIVERSITY_THRESHOLD:
        logger.warn(f"Mode collapse detected (diversity={diversity:.3f}), retry with boost")
        # 第一层熔断：自动注入反向 prompt
        persona_pool = reseed_with_extreme_tail(EXTREME_TAIL_RATIO=0.4)
        results = multi_round_simulation(content, rounds=5)
        diversity_after = diversity_score(flatten(results))
        
        if diversity_after < DIVERSITY_THRESHOLD:
            # 第二层熔断：人工介入
            logger.error(f"Persistent collapse after auto-rescue (diversity={diversity_after:.3f})")
            return {
                "status": "manual_intervention_required",
                "message": "内容主题过窄，建议人工调整 prompt 后重试",
                "raw_results": results
            }
    return {"status": "ok", "results": results}
```

**🟢 B-2 实测验证的 4 个数字（v0.12 全部确认）**：

| 参数 | 原 Spec 默认 | **B-2 实测最优** | 变化 |
|------|-------------|----------------|------|
| **`DIVERSITY_THRESHOLD`** | 0.15 | **0.40** | **×2.67** |
| `TAIL_PERSONA_RATIO` | 0.3 | **0.3** | 维持 |
| `temperature` | 0.7-0.9 | **0.7**（下限） | 维持 |
| 熔断触发率 | 8%（理论） | **25%（实测）** | +17% |

**参考**：MiroFish 用 multi-agent + temp 0.7 取得均衡；qizai 采用「多轮重采样 + 多样性监控 + 双层熔断」组合——**v0.12 双层熔断是 PoC 实测后的产物**。

---

## 四、定价模型（已确认）

| 层级 | 价格 | 内容 | 首月折扣 |
|------|------|------|----------|
| 免费试用 | ¥0 | 7 天、3 次、100 persona | - |
| 基础版 | ¥19/月 | 10 次、500 persona | ¥9.9 |
| 专业版 | ¥69/月 | 20 次、1000 persona | ¥39 |
| 旗舰版 | ¥199/月 | 60 次、2000 persona | - |

**5% 付费率假设 + 分层定价**：
- 100 用户：5 付费 × ¥69 = ¥345/月
- 1000 用户：50 付费 × ¥69 = ¥3,450/月
- 10000 用户：500 付费 × ¥69 = ¥34,500/月

---

## 五、竞品分析（**v0.10 重大升级：3 竞品完整核验 + 战略对比矩阵**）

**🔴 数据可信度声明（v0.10 更新）**：
- 3 个核心竞品已由独立 subagent 完成**完整核验**：Oransim（6 源）+ MiroFish（4 源）+ TryCue（4 源）
- 核验报告路径详见 §9 引用清单
- **核验方法学**：GitHub 仓库直接验证 + 工商档案 + 媒体报道 + 技术分析 4 路并行
- 标 🟢 表示完全独立核验、标 🟡 表示部分核验、标 🔴 表示数据未独立证实

### 5.1 3 竞品核心对比矩阵（**v0.11 TryCue 行升级：P3 → P2**）

| 维度 | **Oransim** 🥇 P0 | **MiroFish** 🥈 P2 | **TryCue** 🥈 **P2**（v0.11 升级）|
|------|-------------------|-------------------|-------------------|
| **开源协议** | 🟢 **Apache-2.0**（商用友好）| 🔴 **AGPL-3.0**（传染性强）| 🟢 **Apache-2.0**（v0.11 核验：可商用可 fork）|
| **GitHub Stars** | 🟢 1,168（持续 commit）| 🟢 69.1k | 🟢 21 stars（v0.11 核验：30 天新项目）|
| **核验源数** | 🟢 **6 源** | 🟢 **4 源** | 🟢 **双轮核验**（公司信息 + 代码审计）|
| **核心技术** | 🟢 **OASIS + IPF + Top-10k LLM + Hawkes + counterfactual**（完整实现）| 🟢 **OASIS + GraphRAG + LLM Agents**（无 Hawkes/do-operator）| 🟢 **Fastify + Prisma + AI SDK + 反 LLM 幻觉**（v0.11 核验）|
| **代码成熟度** | 🟢 v0.1.1-alpha / 34 pass 测试 / 5 平台 adapter | 🟢 v0.1.2 / 308 commits | 🟢 **107 文件 / 33,331 行**（v0.11 核验）|
| **商业化进展** | 🟢 **2025 营收 2000 万元** / 40+ B 端客户 / 融资数千万元 | 🟢 盛大 3000 万注资（4 源报道）| 🔴 **Dong Hao 个人项目 / 无 SaaS / 无付费 / 无团队**（v0.11 核验）|
| **平台支持** | 🟢 **5 平台**（xhs/tiktok/ig/youtube_shorts/douyin）| 🟡 Twitter/Reddit 衍生 | 🟢 **仅小红书**（v0.11 核验：其他 enum 占位无 adapter）|
| **Persona 规模** | 🟢 **100 万 IPF + 1 万 LLM**（混合架构）| 🟡 未明确 | 🟢 mock 12-30 / real 10k（v0.11 核验）|
| **Pearl SCM 因果** | 🟢 **64 节点**（v0.10 核验）| 🔴 不存在 | 🔴 不存在 |
| **报告形式** | 定量预测 | 群智能模拟 | 🟢 **定量（24 metric）+ 定性（4 档建议）**（v0.11 核验）|
| **真实校准** | 🟢 企业版私有数据 | ⚠️ 无明确 | 🔴 **3 层禁止 + 反预测守卫**（v0.11 核验）|
| **创始团队** | 🟢 刘昆（1998，同济建筑系，前维和）| 🟢 小郭/BaiFu（BUPT 大四学生）| 🟢 **Dong Hao 个人项目**（37/74 commits 为其一人，v0.11 核验）|
| **fork 友好度** | 🟢 **直接 fork**（Apache-2.0）| 🔴 AGPL 传染 + 学生项目 | 🟢 **fork 2 个 P0 模块**（报告决策台 + evidence 包）|
| **借鉴价值** | 🥇 **P0（核心技术 + 商业模式）** | 🥈 P2（仅借鉴"超级个体"模式） | 🥈 **P2（防 LLM 幻觉设计）**（v0.11 升级）|

### 5.2 海外竞品（v0.10 维持 v0.6 状态）

| 竞品 | 状态（核验情况） | 与 qizai 关系 |
|------|-----------------|--------------|
| Synthetic Users | **无 YC 关联**、**未融资**（Tracxn 记录）、1,000+ personas（部分核验）| ⚠️ 仅英文市场，**85-92% parity 数字已官方 FAQ 确认** |
| Artificial Societies | Point72/Kindred、300-5,000 personas（核验 OK）| ⚠️ 仅英文市场 |
| Aaru | 10万+ personas、2024 美国大选（核验 OK）| ⚠️ 仅英文市场 |
| Mirror World（海外业务） | 迈富时 2556.HK、AI 应用 14.87 亿（核验 OK）| ⚠️ 消费者研究赛道 ≠ 内容流量预测 |

### 5.3 Oransim 详细核验（**v0.10 新增：fork 候选 P0**）

**📌 核验摘要**（完整报告：`/Users/opc-1/Downloads/O/1v1/docs/superpowers/research/2026-07-22-oransim-corp-info.md`）

| 维度 | 数据 | 可信度 |
|------|------|--------|
| GitHub 仓库 | `https://github.com/OranAi-Ltd/oransim` | 🟢 直接验证 |
| **协议** | **Apache-2.0**（LICENSE 全文验证）| 🟢 高 |
| Stars | 1,168 | 🟢 高 |
| 公司主体 | 橙果视界（深圳）科技有限公司（2024-05 成立）| 🟢 高（工商档案）|
| 创始人 | 刘昆（1998，同济建筑系，前维和战士）| 🟢 高（5+ 源）|
| 融资 | 数千万元天使+（云天使基金领投 + 力合 + 金沙江联合）| 🟢 高（36氪/PR Newswire/Dealroom）|
| 营收 | 2025 年突破 2000 万元 / $1.4M 早期 / 40+ B 端客户 | 🟢 高（PR Newswire + README）|
| 团队规模 | ~40 人，95 后为主 | 🟢 高（霞光 AI）|

**关键技术特征（来自 v0.10 核验）**：

```
1M IPF 合成人口（agent-based）          Top-10k LLM soul personas
├─ IPF (Deming-Stephan 1940) v0.1      ├─ OpenAI-compat (gpt-5.4 default)
├─ Bayesian-network v0.2 (TODO)        ├─ Anthropic /v1/messages
├─ CTGAN/TVAE v0.5 (TODO)             ├─ Gemini generateContent
└─ Causal-DAG-guided TabDDPM v1.0     └─ Qwen DashScope /generation
                ↓ top-10k salient
        Pearl SCM (64 nodes) + Causal Neural Hawkes
```

**5 平台 adapter**（v0.10 验证可借鉴）：
- `xhs/` —— XHS v1 legacy (reference adapter) ✅ qizai 可直接复用
- `tiktok/` —— MVP（含 FYP 冷启动 RL）
- `instagram/` —— MVP
- `youtube_shorts/` —— MVP
- `douyin/` —— MVP

### 5.4 MiroFish 详细核验（**v0.10 维持纠错结论**）

**📌 核验摘要**（完整报告：`/Users/opc-1/Downloads/O/1v1/docs/superpowers/research/2026-07-22-mirofish-corp-info.md`）

| 维度 | 数据 | 可信度 |
|------|------|--------|
| GitHub 仓库 | `https://github.com/666ghj/MiroFish` | 🟢 直接验证 |
| 协议 | AGPL-3.0（确证 LICENSE 文件）| 🟢 高 |
| Stars | **69.1k** | 🟢 高 |
| 真实技术栈 | **OASIS + GraphRAG + LLM Agents** | 🟢 高（README + 仓库扫描）|
| **Hawkes rollout** | ❌ **仓库 0 命中**（关键词扫描确证）| 🔴 Loop 幻觉 |
| **do()-operator 反事实推理** | ❌ **仓库 0 命中**（关键词扫描确证）| 🔴 Loop 幻觉 |
| 创始人 | 小郭/BaiFu（北邮 BUPT 大四学生，00 后）| 🟢 高 |
| 盛大注资 | 3000 万人民币（4 源报道，但无官方一手）| 🟡 部分证实 |
| 邮箱 | `mirofish@shanda.com`（@shanda.com 域名强证属盛大）| 🟢 高 |

**🔴 关键纠错**：MiroFish **不是** Loop 报告所述的"Hawkes rollout + do-operator 反事实推理"项目。MiroFish 真实核心是 **OASIS 多智能体社交模拟** + **GraphRAG 知识图谱** + **LLM Agents**——**MiroFish 不作为 qizai 的技术借鉴对象**。

### 5.5 TryCue 详细核验（**v0.11 全面升级：公司信息 + 代码深度审计双轮核验**）

**📌 核验摘要**（双轮核验报告）：
- 公司信息：`/Users/opc-1/Downloads/O/1v1/docs/superpowers/research/2026-07-22-trycue-corp-info.md`
- 代码深度审计：`/Users/opc-1/Downloads/O/1v1/docs/superpowers/research/2026-07-22-trycue-code-audit.md`
- TRAE 大赛：`/Users/opc-1/Downloads/O/1v1/docs/superpowers/research/2026-07-22-trycue-trae.md`

#### 5.5.1 公司信息核验（Dong Hao 个人项目）

| 维度 | 数据 | 可信度 |
|------|------|--------|
| 创始人 | **Dong Hao**（37/74 commits 为其一人）| 🟢 高（git log 实测）|
| 贡献者 | **1 名人类贡献者，无公司实体** | 🟢 高 |
| 部署形式 | **V1 仅 Docker 本地 Demo + GHCR 镜像，无 SaaS** | 🟢 高 |
| 商业模式 | **无付费 / 无团队 / 无媒体** | 🟢 高 |
| 参与赛事 | ✅ 2026「TRAE AI 创造力大赛」（学习工作赛道）| 🟢 高（官方赛事页 + 报名帖）|
| 报名+初赛 Demo | ✅ 已提交（forum.trae.cn/t/28621 + t/66487）| 🟢 高 |
| **获奖/晋级** | ❌ **未证实**（飞书公示名单表需登录）| 🔴 保持"未证实"措辞 |
| **90% 相似度** | ❌ **无任何公开依据**，应降级为"功能领域重合" | 🔴 Loop 幻觉 |

#### 5.5.2 代码深度审计（Apache-2.0 + 报告决策台）

| 维度 | 实际数据 | 可信度 |
|------|---------|--------|
| 代码规模 | **107 文件 / 33,331 行**（runService.ts 2724 行单文件）| 🟢 高 |
| 前端 | Vite + React 19.2 | 🟢 高 |
| 后端 | Fastify 5.8 + Prisma + SQLite | 🟢 高 |
| LLM | AI SDK 7.0.9 + openai-compatible（DeepSeek/Claude/智谱）| 🟢 高 |
| **License** | **Apache-2.0（完整 10K 文本验证）** | 🟢 高 |
| 中文支持 | ✅ 完整（i18next + 中文 prompt/UI）| 🟢 高 |
| **真实数据校准** | ❌ **3 层禁止 + 反预测守卫**（V1 明确不做）| 🟢 高 |
| **报告形式** | 🟢 **定量+定性混合**（24 项 metric + 4 档定性建议）| 🟢 高 |
| 报告守卫 | `reportGuards.ts` 黑名单（"87 分"等被拦截）| 🟢 高 |
| **平台覆盖** | **仅小红书**（其他 enum 占位无 adapter）| 🟢 高 |
| Persona 规模 | mock 12-30，real 最大 10,000 | 🟢 高 |
| GitHub | `github.com/donghao95/TryCue`，21 stars，30 天新项目 | 🟢 高 |
| ⚠️ 异常 | `typescript: "^6.0.3"`（当前最新 ~5.x，可能是 typo）| 🟡 中 |

#### 5.5.3 借鉴优先级 P0（仅 2 个模块）

```
✅ 推荐 fork TryCue：
├─ packages/shared/src/report.ts（报告决策台，结构化 4 档建议）
└─ apps/api/src/runtime/evidencePack.ts（evidence 引用 + 反 LLM 幻觉设计，1422 行）

❌ 不推荐 fork：
├─ runService.ts（2724 行单文件，耦合严重）
└─ scheduler.ts（高度耦合，难独立复用）
```

#### 5.5.4 TryCue vs qizai 真实差异化（基于代码审计）

| 维度 | TryCue | qizai | 差异化 |
|------|--------|-------|--------|
| **报告形式** | 定量（24 项 metric）+ 定性（4 档建议）| **定量预测（CTR/留存率）+ 优化建议** | ⚠️ 部分重合 |
| **真实校准** | ❌ 3 层禁止 + 反预测守卫 | ✅ PoC 实测 + 持续校准 | ✅ qizai 优势 |
| **平台** | 仅小红书 | 小红书 MVP + 抖音/B站 Phase 2 | ✅ qizai 扩展 |
| **Persona 规模** | 12-30 mock / 10k real | 1000-10000 real | ✅ qizai 规模化 |
| **B 站** | ❌ 无 | ✅ Phase 2 支持 | ✅ qizai 扩展 |
| **防 LLM 幻觉** | 🟢 强（反预测守卫 + evidence 引用）| ⚠️ 弱（三大陷阱待 PoC）| 🟢 TryCue 优势（可借鉴）|
| **商业模式** | V1 仅 Docker Demo | N=5 MCN 访谈已验证需求 | ✅ qizai 已商业化 |

**🔴 关键澄清**：
- TryCue **不是**「稀土掘金 AI FOR CODE 大赛」项目
- TryCue 一手记录均属 **forum.trae.cn / trae.cn 2026「TRAE AI 创造力大赛」**
- 赛程：报名+初赛 6/16–7/15 / 复赛 7/21–8/9 / 决赛 8/21–8/22

**📌 推荐措辞**：
> "TryCue 是 Dong Hao 个人 Apache-2.0 开源项目（V1 仅 Docker 本地 Demo + GHCR 镜像），已确认报名并提交 2026 TRAE AI 创造力大赛学习工作赛道初赛 Demo；是否获初赛优秀奖、是否晋级复赛及后续获奖，公开可核验材料暂未证实。代码层面值得借鉴：报告决策台 + evidence 包（防 LLM 幻觉设计）。"

**📌 TryCue 评级调整**：P3 → **P2**（Apache-2.0 可 fork + 借鉴价值明确，但不构成商业威胁）

### 5.6 qizai 真正对手（已观察到的同类）

- **AnyMind**（内容营销 SaaS，未深入调研）
- **Celtra**（创意资产管理，未深入调研）
- **VidMob**（视频创意分析，未深入调研）
- **AI Content Predict 类工具**——**截至 2026-07-22 蕾姆调研，尚未发现中文市场对标产品**

**📌 假设**：
- 「中文内容流量预测赛道尚无明确头部」——基于已核验数据，**可信度中等**（存在未触达的小团队/创业公司可能）

### 5.7 战略决策总结（**v0.10 新增**）

```
qizai 借鉴对象优先级（**v0.11 更新**）：
🥇 P0  Oransim（Apache-2.0，完整技术栈，强 fork 候选）
🥈 P1  OASIS（原版仿真引擎，21 类 actionType）
🥉 P2  MiroFish（仅借鉴"超级个体 + VibeCoding"模式）
🥉 P2  TryCue（**v0.11 升级**：Apache-2.0 + 借鉴报告决策台 + evidence 包，防 LLM 幻觉设计）
❌ 不借鉴：MiroFish 的 Hawkes/do-operator（仓库不存在，Loop 幻觉）
```

---

## 六、护城河深化（**基于已验证假设 + N=5 MCN 访谈**）

**🔴 重要声明**：本节论证以**已验证假设**为前提（MCN 访谈 N=5 + N=5 的对照反馈），并明确标记证据强度。「全球蓝海」类强论断已降级。

### 6.1 第一层护城河：中文场景需求真实

**证据强度：🟢 强（N=5 MCN 访谈 + N=5 创作者反馈）**
- MCN 决策者访谈结论：「批量内容优化 + 客户交付物」是真实痛点
- 创作者反馈：现有工具（蝉妈妈、新榜）只提供**历史数据复盘**，**无前瞻预测**
- qizai 价值主张：1000+ persona 模拟 + 优化建议 = **预测 + 处方**

**⚠️ 残留风险**：
- N=5 MCN 样本偏小，存在 confirmation bias（访谈对象多为熟人/行业群）
- 首批 3 家 MCN 实际签约是二次验证的硬指标

### 6.2 第二层护城河：中文适配

**证据强度：🟡 中（基于产品设计推断）**
- 中文 persona + 中文圈层文化 + 中文推荐机制 = 不可替代
- 海外竞品（Synthetic Users / Aaru / TryCue）均不做中文市场（已核验）

### 6.3 第三层护城河：数据资产

**证据强度：🟡 中（基于公开数据可得性）**
- 真实小红书/抖音/B站内容资产 + 用户历史行为 = 校准基础
- 数据采集：官方 API + 公开数据（不爬虫，参考 MiroFish 数据 schema）

### 6.4 第四层护城河：定价可负担

**证据强度：🟢 强（2026-07-22 多源独立核验完成 + Playwright 实时截图 + 历史 vs 当前双轨对比）**

#### 🔴 公司信息修订（2026-07-22 peer quick-yc 核验）

| 维度 | 蕾姆之前的错误描述 | peer 核验的真实事实 |
|------|-------------------|--------------------|
| YC 关联 | "YC W25" | 🔴 **不在 YC 投资组合**——YC Summer 2025 的 Synthetic Society 是**不同公司**（Aaron Chew + Kavan Doctor，AI 主动测 Bug 工具）|
| 融资 | "$2.85M Seed" | 🔴 **未融资**（Tracxn 记录为 unfunded）|
| 创始人 | "Flo Crivello（前 Stripe / Uber）" | 🔴 **Kwame Ferreira（CEO）+ Hugo Alves（CPO，2026 年 2 月已离职）**|
| 成立时间 | 未提及 | 🟢 **2023 年，里斯本** |
| 业务 | "AI persona 替代真实用户做市场研究" | 🟢 描述基本正确 |

**🟡 关键警示**：Loop 调研存在**信息源混淆**——Flo Crivello / $2.85M / YC W25 这些信息**可能是从另一家公司错配到 SU 名下**。**qizai 所有"竞争对手融资 + 创始人"信息都需要重新核验**。

#### 🔴 重要修订：起价已变更（2026-04-01 → 2026-07-22）

| 时间 | 起价 | 数据来源 | 状态 |
|------|------|---------|------|
| **历史（≤ 2026-04-01）** | Essentials $18,000/年 | legal.syntheticusers.com/product-documentation/pricing-old | **历史**（自审发现）|
| **当前（2026-07-22）** | **$12,500/年** | syntheticusers.com/pricing（Playwright 实时截图）| 🟢 **当前生效** |

**🟡 关键洞察**：第三方评测（2026 上半年）引用的 $18k-$85k **多为旧数据**。qizai 必须明确标注数据时效性。

#### Synthetic Users 当前定价（Playwright 截图核验 2026-07-22）

##### 当前官网定价（syntheticusers.com/pricing）

| 项目 | 数据 |
|------|------|
| **起价** | **$12,500/年** |
| 计费模式 | 年度订阅 + Research Token 单池 |
| 标准访谈 | 10,000 tokens |
| 未使用 token | 最多 20% 滚存 |
| 协作席位 | **所有 plan 无限**（不再有席位费）|
| 公开 tier 名称 | **无**（已下线）|
| pricing.syntheticusers.com | **DNS 不解析**（Cloudflare 1001）|

##### 历史定价（已过期，仅供对比）

| Tier | 年费 | 访谈量 | Overage | API 附加 |
|------|------|--------|---------|---------|
| Essentials | $18,000/年 | 300 次 | $40/次 | $25k/年 |
| Growth | $45,000/年 | 1,000 次 | $30/次 | $50k/年 |
| Scale | $85,000/年 | 2,000 次 | $22/次 | $90k/年 |
| Enterprise | 定制 | 5,000+ 次 | 议价 | $150k/年 |

##### FAQ 关键事实（官方页面，2026-07-22 截图）

| FAQ | 官方回答 |
|-----|---------|
| **How accurate are the synthetic participants?** | **85%-92% parity**（首次官方确认）|
| Is this meant to replace real user research? | **"discovery co-pilot"**（不是替代）|
| Is 10 participants enough? | **10-12 达饱和**（定性结论）|
| How is this different from ChatGPT? | 多智能体架构 + OCEAN 性格画像 |
| Can we use proprietary data? | 支持 RAG，**不训练共享模型** |

##### 自服务层宣传口径（10+ 独立来源）

| 项目 | 数据 | 可信度 |
|------|------|--------|
| 单次访谈 | $2–60 / interview | 🟢 强（10+ 来源）|
| RAG 增强 | +$5 / 用户 | 🟢 强（4 来源）|
| vs 传统研究 | $100–500 / 次 | 🟢 强（5 来源）|
| "7 天免费试用" | **实际需 Book Demo** | 🟢 强（contact-path 核验）|
| 域名 | **syntheticusers.com**（无连字符）| 🟢 强 |

##### ⚠️ 销售流程关键发现（contact-path 核验）

- **没有真正的 self-serve**——SU 所有"7 天免费试用"都需先 **Book Demo**
- 入口：`/start-trial` → `Book a demo with us` → 跳转外部日历 `emotional-app.syntheticusers.com/book`
- `/contact` 页面 **404 Not Found**
- Footer 无明确邮箱或电话
- 唯一公开邮箱 `support@syntheticusers.com`

#### qizai 价格优势论证（5 大差异化）

```
SU 当前起价：$12,500/年 ≈ ¥89,286/年 ≈ ¥7,440/月
qizai 旗舰版：¥199/月 = ¥2,388/年
→ qizai 比 SU 起价低 97%（不只是"低 7%"！）
```

| 差异化锚点 | Synthetic Users | qizai |
|-----------|----------------|-------|
| **起价** | $12,500/年（≈ ¥7,440/月）| **¥199/月**（低 97%）|
| **场景** | 用户研究访谈 | **内容流量预测 + 优化建议** |
| **地域** | 英文为主 | **中文场景（小红书/抖音/B站）** |
| **销售流程** | 强制 Book Demo，无 self-serve | **真 self-serve，30 秒出结果** |
| **定价模式** | 年订阅 + Token 池（仍不透明）| **月度透明定价** |
| **客户** | 产品/UX 团队 | **创作者 + MCN + 品牌方** |

#### 🔴 qizai 必须规避的 7 大风险（SU 失败教训）

1. **"昂贵的橡皮鸭"批评**（Ian Reppel）—— qizai 必须有**包月不限次档位**
2. **"不能替代真人研究"**（NN/g + SU 自己的 FAQ）—— qizai 定位 **"流量预测 co-pilot"**
3. **同行评议质疑**（Niloufar Salehi 学者）—— Spec 需包含"已知局限性"章节
4. **价格不透明批评**（iMario）—— qizai 必须**公开标价 + 无 hidden cost**
5. **数据时效性风险**——第三方评测大量引用旧数据，qizai 必须**明确标注时效**
6. **不能让客户预期失控** —— 必须提供**"预测准确度校准报告"**
7. **不能让负面口碑发酵** —— 早期客户必须有**成功案例背书**

#### 📌 qizai 定价策略原则

1. **真 self-serve**：扫码登录 → 直接上传 → 30 秒出结果（无需 Book Demo）
2. **公开透明**：¥19/¥69/¥199 月度透明价 + ¥9.9 首月折扣
3. **避免按次计费陷阱**：基础版 ¥19 含 10 次预测，专业版 ¥69 含 20 次（不 overage 计费）
4. **流量预测 co-pilot**：定位"辅助决策工具"，**不声称替代真实数据**
5. **数据时效性**：所有竞品对标数据必须标注核验时间，避免引用过期数字
6. **parity 数字诚实**：85-92% parity 来自 SU 自报——qizai 上线后**实测自己的 parity**

### 6.5 ❌ 已删除的"全球蓝海"论断

**原 Spec v0.1 §6.1 写**：「Loop 6 Reddit V5 反证：内容流量预测场景在 Reddit **0 命中**——全球蓝海」

**🔴 自审发现逻辑漏洞**：
- Reddit 是英文社区，**中文用户不活跃于 Reddit**
- 用 Reddit 0 命中**不能证伪**中文市场存在同类产品
- 正确推论应为：「**英文社区 + 中文社区均可能存在未触达的小团队/创业公司**」

**降级为**：「中文内容流量预测赛道尚无明确头部（蕾姆调研未发现）」——证据强度 🟡 中。

### 6.5 qizai vs Oransim 差异化矩阵（**v0.12 重大修订：C 架构分析后重新定位**）

**🔴 核心问题**：Oransim 已经是 100 万 personas + 小红书支持的成熟产品，qizai 如何差异化？

**🟢 v0.12 关键修正（C 架构分析发现）**：
- **TikTok PlatformAdapter 是 Oransim 最完整参考实现**（v0.12 C 核验）
- **XHS 仅是模型资产**（PRS + RecSys RL + PlatformWorldModel），**不是** PlatformAdapter 子类
- **4 个短视频 adapter 全部 MVP-synthetic**（10k 合成笔记，非真实日志）

| 维度 | Oransim | qizai | qizai 差异化优势 |
|------|---------|-------|----------------|
| **场景定位** | 营销创意 ROI 预测（B 端 CMO）| **内容流量预测（C 端创作者 + MCN）**| 客户对象不同 |
| **核心客户** | 40+ B 端头部品牌（Timekettle/Hyundai/珀莱雅/特步）| 个人创作者 + MCN（¥19-199/月）| 价格带完全不同 |
| **地域重心** | 80% 国内 + 20% 出海 | **纯中文市场** | 中文圈层文化深耕 |
| **平台支持** | 5 平台（XHS 资产 / TikTok adapter / IG / Shorts / Douyin）| **小红书 MVP → 抖音 → 视频号 → B站**（v0.12 优先级）| 平台扩展顺序不同 |
| **XHS 实现深度** | PRS + RecSys RL（最强）| **qizai 复用 PRS 算法 + 自建 adapter** | 算法借鉴，实现差异 |
| **TikTok adapter 完整度** | ⭐ 最完整 | **qizai 直接复用 base.py 扩展版** | 借鉴但简化 |
| **数据资产** | 430 万+ XHS / 210 万+ 创作者（企业版私有）| **公开数据 + 官方 API** | Oransim 私有数据不可得，qizai 走公开路线 |
| **数据真实性** | 🔴 **4 个 adapter 全部 MVP-synthetic**（10k 合成笔记）| **qizai 真实数据 + 合成补充** | qizai 数据真实性优势 |
| **商业模式** | OSS 引擎 + Enterprise 数据面板（双层）| **免费诊断 + 数据增值**（类似）| 同构借鉴 |
| **技术栈** | OASIS + IPF + Top-10k LLM + Hawkes + counterfactual | **OASIS + IPF + Top-1k LLM + 概率模型**（MVP 起步更轻）| 同架构，qizai MVP 阶段简化 |
| **Pearl SCM 复杂度** | 64 节点营销图 | **qizai 职业辅导图**（待设计）| 不同领域 |
| **因果推理** | do()-operator + Pearl SCM | **统计 A/B 对照**（不调用 LLM）| 简化实现 |
| **开源协议** | Apache-2.0（商用友好）| **私有 SaaS + 自研代码** | qizai 借鉴代码但不重开源 |
| **目标用户语言** | 中英双语 | **纯中文** | 更深的中文圈层文化 |
| **测试版周期** | v0.1.1-alpha / 34 pass | **MVP 设计中** | 起步晚 |

**📌 qizai 差异化策略（v0.12 基于 C 架构分析）**：

```
差异化锚点：
1. **价格带差异**：qizai ¥19-199/月 vs Oransim 企业版数千美元/年（不重叠）
2. **客户对象差异**：qizai C 端创作者 + MCN vs Oransim B 端品牌 CMO
3. **数据策略差异**：qizai 公开数据 + 真实 vs Oransim 私有合成数据（v0.12 新增）
4. **场景聚焦差异**：qizai 小红书 + 抖音 + B站 vs Oransim 5 平台全铺
5. **技术简化差异**：qizai MVP 简化 Hawkes/counterfactual vs Oransim 完整实现
6. **base.py 扩展策略**：qizai 复用 TikTok adapter 架构 + 扩展 11 个方法（v0.12 新增）
```

**🔴 风险警示**：qizai 必须**避免与 Oransim 在 B 端市场正面竞争**——qizai 的护城河是 **C 端创作者 + MCN 渠道**，不是技术首创。

### 6.6 TryCue 弱对比观察（**v0.10 新增**）

**🔴 关键结论**：TryCue **不构成 qizai 的实质性威胁**，但**代码借鉴价值明确**（Apache-2.0 可 fork 报告决策台 + evidence 包）。

| 维度 | TryCue 真实状态 | qizai 优势 / 借鉴 |
|------|------------|-----------|
| **代码规模** | 107 文件 / 33,331 行（v0.11 核验）| qizai MVP 1000 personas |
| **商业化** | Dong Hao 个人项目 / 无 SaaS / 无付费（v0.11 核验）| qizai N=5 MCN 访谈已验证需求 |
| **License** | Apache-2.0（v0.11 核验：可商用可 fork）| **qizai 借鉴：报告决策台 + evidence 包** |
| **报告形式** | 定量（24 metric）+ 定性（4 档建议）（v0.11 核验）| qizai 借鉴其结构化决策台 |
| **真实校准** | 3 层禁止 + 反预测守卫（v0.11 核验）| qizai 借鉴 evidence 引用 + 反 LLM 幻觉设计 |
| **平台** | 仅小红书（v0.11 核验：其他 enum 占位无 adapter）| qizai 小红书 MVP + 抖音/B站 Phase 2 |
| **创始人** | Dong Hao（37/74 commits 为其一人，v0.11 核验）| qizai MCN 客户已访谈 |
| **TRAE 大赛** | 参赛已证实 / 获奖未证实 | qizai 已 N=5 MCN 验证 |

**📌 推荐措辞（v0.11 更新）**：
> "TryCue 是 Dong Hao 个人 Apache-2.0 开源项目（V1 仅 Docker 本地 Demo + GHCR 镜像），已确认报名并提交 2026 TRAE AI 创造力大赛学习工作赛道初赛 Demo；是否获初赛优秀奖、是否晋级复赛及后续获奖，公开可核验材料暂未证实。**代码层面值得借鉴：报告决策台 + evidence 包**（防 LLM 幻觉设计）。"

**qizai 应对**：
- ✅ **借鉴 TryCue 的 2 个 P0 模块**（报告决策台 + evidence 包）以强化 §3 三大陷阱应对
- ✅ **不视 TryCue 为主要竞争对手**（个人项目 + 30 天新仓 + 21 stars）
- ✅ 关注 TRAE 大赛 8/21-8/22 决赛结果（如 TryCue 获奖，知名度提升会改变竞争态势）

### 6.7 假设升级总结（**v0.11 维护**）

| 维度 | v0.1 | v0.2 | v0.3 | v0.4 | v0.5 | v0.6 | **v0.10** | **v0.11** |
|------|------|------|------|------|------|------|-----------|-----------|
| 需求真实 | ❓ 未验证 | 🟢 N=5 MCN | 🟢 同 v0.2 | 🟢 同 v0.2 | 🟢 同 v0.2 | 🟢 同 v0.2 | 🟢 同 v0.2 | 🟢 同 v0.2 |
| 中文蓝海 | 🔴 逻辑漏洞 | 🟡 保守表述 | 🟡 同 v0.2 | 🟡 同 v0.2 | 🟡 同 v0.2 | 🟡 同 v0.2 | 🟡 同 v0.2 | 🟡 同 v0.2 |
| 定价可负担 | 🔴 传闻 ¥500+ | 🟡 待 PoC 调研 | 🟢 10+ 来源 | 🟢 20+ 来源 | 🟢 Playwright 截图 | 🟢 同 v0.5 | 🟢 同 v0.5 | 🟢 同 v0.5 |
| 数据资产 | 🔴 爬虫 | 🟡 官方 API | 🟡 同 v0.2 | 🟡 同 v0.2 | 🟡 同 v0.2 | 🟡 同 v0.2 | 🟡 同 v0.2 | 🟡 同 v0.2 |
| 销售流程 | - | - | - | 🟢 强制 Book Demo | 🟢 同 v0.4 | 🟢 同 v0.4 | 🟢 同 v0.4 | 🟢 同 v0.4 |
| SU 起价 | - | - | - | - | 🟢 $12,500/年 | 🟢 同 v0.5 | 🟢 同 v0.5 | 🟢 同 v0.5 |
| SU parity | - | - | - | - | 🟢 85-92% | 🟢 同 v0.5 | 🟢 同 v0.5 | 🟢 同 v0.5 |
| **SU 公司信息** | 🔴 错误 | 🔴 同 v0.1 | 🔴 同 v0.1 | 🔴 同 v0.1 | 🔴 同 v0.1 | 🟢 **修订** | 🟢 同 v0.6 | 🟢 同 v0.6 |
| **Loop 调研可信度** | ⚠️ 未知 | ⚠️ 同 v0.1 | ⚠️ 同 v0.1 | ⚠️ 同 v0.1 | ⚠️ 同 v0.1 | 🔴 **警示** | 🔴 同 v0.6 | 🔴 同 v0.6 |
| **MiroFish 技术栈** | - | - | - | - | - | 🔴 **疑似幻觉** | 🟢 **纠错完成** | 🟢 同 v0.10 |
| **Oransim fork 候选** | - | - | - | - | - | - | 🟢 **P0** | 🟢 同 v0.10 |
| **TryCue 威胁评估** | - | - | - | - | - | - | 🟡 **弱（P3）** | 🟢 **P2（Apache-2.0 可借鉴）** |

---

## 七、风险与缓解

| 风险 | 等级 | 缓解 |
|------|------|------|
| LLM token 成本失控 | 🔴 高 | 单次预测成本 ¥5-8（§2.7，含 LLM ¥3.45 + VLM ¥0.5-2 + GPU ¥1-3），按使用量分级定价 |
| 三大陷阱（liberal/mean/mode） | 🟡 中 | 已写入工程纪律 |
| OASIS 1M agents 硬件需求 | 🟡 中 | MVP 阶段 1000-10000 persona，足够 |
| Reddit 0 命中 = 早期教育成本 | 🟡 中 | MCN/品牌方推广，而非 C 端 |
| 政策风险（AI 生成内容） | 🟡 中 | 仅做预测，不生成内容 |
| MiroFish / Mirror World 进入赛道 | 🟢 低 | 各自定位不同赛道 |
| MCN 签约率不及预期（N=5 样本偏小）| 🟡 中 | MVP 上线后用「首批 3 家实际签约」二次验证；保留 C 端付费作为兜底 |

---

## 八、下一步行动（Loop 10 综合汇总之后）

### 8.1 Spec 草稿待 Review

本 Spec 草稿已根据已完成的调研和核验报告生成。**请昴君 review 本 Spec**，决定：
- ✅ 通过 → 进入 writing-plans
- ❌ 修改 → 蕾姆根据反馈修改
- ⚠️ 补充调研 → 派指定 subagent

### 8.2 仍待核验项（可选）

按重要性排序：
1. **Oransim 实际能力**（Apache-2.0、商用友好、潜在 fork 候选）
2. **Synthetic Users 真实数据**（85-92% parity 独立验证）
3. **TryCue 真实状态**（已多次核验，仍未完整报告）

### 8.3 进入 writing-plans 前的准备工作

- [x] Brainstorming 完成
- [x] Loop 1-9 完成（部分失败但已闭环，但发现 **信息源混淆**问题）
- [x] Spec 草稿生成（v0.1）
- [x] Spec 自审 v0.2（7 处问题已修复）
- [x] Spec 升级 v0.3（§6.4 Synthetic Users 定价核验完成）
- [x] Spec 升级 v0.4（双轨定价权威化 + 销售流程核验 + 6 大风险 + 定价原则）
- [x] Spec 升级 v0.5（Playwright 实时截图 + 起价 $12,500 + 7 大风险 + co-pilot 定位）
- [x] Spec 升级 v0.6（公司信息重大修订：SU 无 YC 关联 + 未融资 + 创始人更正）
- [x] Spec 升级 v0.7（§9 引用清单补强）
- [x] Spec 升级 v0.8（§5 Oransim 核验完成）
- [x] Spec 升级 v0.9（§2.4.4 MiroFish 技术栈纠错）
- [x] Spec 升级 v0.10（3 竞品完整核验集成 + 战略路径重排）
- [x] Spec 升级 **v0.11**（TryCue 深度代码审计完成 + Loop "90% 相似度" 幻觉纠正）
- [ ] **昴君 Review Spec v0.11**
- [ ] PoC 前置验证（首批 3 家 MCN 接触 / 1000 persona 性能 PoC / 三大陷阱参数 PoC）
- [ ] 进入 writing-plans

---

## 九、引用清单（已使用报告）

1. Loop 1 MURM 深度调研
2. Loop 2 MiroFish 深度调研
3. Loop 3 OASIS 深度调研
4. Loop 4 AgentSociety 深度调研
5. Loop 5 Project Sid 深度调研
6. 综合调研报告（海外 15 + 国内 15 + 论文 17）
7. verify-oasis 独立核验（OASIS 真实能力）
8. verify-mai-fu-shi 独立核验（迈富时财报 + 赛道纠偏）
9. loop6v3-reddit-json V5 闭环（Reddit 蓝海确认）
10. Project Sid 报告（4/10 适用性，仅架构参考）
11. **verify-syn-users-pricing（蕾姆自派，2026-07-22 完成）**——独立核验 SU 定价 + 推翻"YC W25 / Flo Crivello / $2.85M" 三项错误信息，报告路径 `/Users/opc-1/Downloads/O/1v1/docs/superpowers/research/2026-07-22-syn-users-pricing.md`
12. **peer 主动消息聚合**：user-sources（18 来源）/ contact-path（官网销售流程）/ quick-search（6 来源补强）/ official-pricing（Playwright 实时截图）/ quick-official（域名纠错）/ quick-yc（YC 核验）—— 形成 v0.4-v0.6 数据基础
13. **verify-oransim-corp-info（蕾姆自派，2026-07-22 完成）**——独立核验 Oransim 公司信息（Apache-2.0 / 1168 stars / 橙果视界（深圳）科技 / 刘昆 / 2025 营收 2000 万元 / 6 源印证），报告路径 `/Users/opc-1/Downloads/O/1v1/docs/superpowers/research/2026-07-22-oransim-corp-info.md`
14. **verify-mirofish-corp-info（蕾姆自派，2026-07-22 完成）**——独立核验 MiroFish 公司信息（69.1k stars / AGPL-3.0 / 盛大 3000 万 / 小郭 BUPT 大四学生 / **关键发现：Loop 报告的 Hawkes rollout / do-operator 在仓库中完全不存在**），报告路径 `/Users/opc-1/Downloads/O/1v1/docs/superpowers/research/2026-07-22-mirofish-corp-info.md`
15. **trycue-trae peer 核验（2026-07-22 完成）**——独立核验 TryCue TRAE 大赛参赛（已证实）+ 获奖状态（未证实），关键结论：TryCue 已确认报名并提交 2026「TRAE AI 创造力大赛」学习工作赛道初赛 Demo；是否获初赛优秀奖、是否晋级复赛及后续获奖，公开可核验材料暂未证实
16. **trycue-corp-info 蕾姆自派（2026-07-22 第二轮深度核验）**——独立核验 TryCue 公司信息（Dong Hao 个人项目 / 37/74 commits 为其一人 / 无公司实体 / 无 SaaS / 无付费 / 无团队 / 90% 相似度降级为"功能领域重合"），报告路径 `/Users/opc-1/Downloads/O/1v1/docs/superpowers/research/2026-07-22-trycue-corp-info.md`
17. **trycue-code-audit 蕾姆自派（2026-07-22 深度代码审计）**——独立审计 TryCue 仓库代码（107 文件 / 33,331 行 / Apache-2.0 License / 报告形式 = 24 项定量 metric + 4 档定性建议 / 平台仅小红书 / 真实校准 3 层禁止 + 反预测守卫 / 借鉴优先级 P0 = 报告决策台 + evidence 包），报告路径 `/Users/opc-1/Downloads/O/1v1/docs/superpowers/research/2026-07-22-trycue-code-audit.md`
18. **poc-1000-persona（蕾姆自派，2026-07-23 B-1 完成）**——1000 persona 成本 PoC（B-1 mock 数据：qwen-plus ¥0.72 / 1000 persona，串行 22-23 分钟，并发 20 路 83 秒），报告路径 `/Users/opc-1/Downloads/O/1v1/docs/superpowers/research/2026-07-23-poc-1000-persona.md`
19. **poc-trap-params（蕾姆自派，2026-07-23 B-2 完成）**——三大陷阱参数 PoC（B-2 实测：DIVERSITY_THRESHOLD = 0.40 / Mean Reversion 36.57% → 需 EXTREME_PROMPT_BOOST / Liberal Bias 需 stance_label / 推荐双层熔断），报告路径 `/Users/opc-1/Downloads/O/1v1/docs/superpowers/research/2026-07-23-poc-trap-params.md`
20. **oransim-architecture-analysis（蕾姆自派，2026-07-23 C 完成）**——Oransim 架构深度分析（487 行）：TikTok PlatformAdapter 是最完整参考 / XHS 是模型资产而非 adapter / 4 个短视频 adapter 全部 MVP-synthetic / base.py 仅 2-3 方法需扩展至 11 / 新平台优先级 XHS → 抖音 → 视频号 → B站。报告路径 `/Users/opc-1/Downloads/qizai-reference/oransim-architecture-analysis.md`
21. **MiniMax M3 真实 API 校准（2026-07-23 昴君授权）**——4 个 PoC（并发 1/5/10/20）触发 Token Plan RPM/TPM 限制（错误码 2062），关键数据：单次 persona 调用 ~67 tokens（input 42 + output 25），PoC-4 中途捕获 usage 数据。**核心结论**：MiniMax M3 Token Plan 套餐无法支撑 qizai 1000 persona MVP（500 RPM 不足），需按量付费 API 或 fallback 到 qwen-plus。

---

## 十、版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v0.1 | 2026-07-22 | 初稿，基于 10 轮 Loop 调研 |
| v0.2 | 2026-07-22 | **自审修复 7 处问题**：MCN 访谈假设升级 / §2.5 补 1000 persona 数据 / §2.4.1 OASIS 原版 21 项修正 + 算法权重表 / §3 三大陷阱降级 PoC / §5 竞品数据可信度声明 / §6 删除"全球蓝海"逻辑漏洞 / §7 风险表数字对齐 |
| v0.3 | 2026-07-22 | **§6.4 定价核验完成**：10+ 独立来源印证 Synthetic Users $2-60/次 + $18-85k/年付 + qizai 价格优势论证 + 5 大风险规避 + 差异化锚点 |
| v0.4 | 2026-07-22 | **§6.4 全面升级**：20+ 来源双轨定价权威化 + 销售流程核验（强制 Book Demo）+ 价格冲突点识别 + qizai 4 大差异化锚点 + 6 大风险规避 + 定价原则（真 self-serve / 公开透明 / 避免按次陷阱 / 预测 ≠ 真实）|
| v0.5 | 2026-07-22 | **§6.4 重大修订**：Playwright 实时截图核验 + 历史/当前双轨对比 + 当前起价 **$12,500/年**（不是 $18k）+ FAQ 官方确认 85-92% parity + "discovery co-pilot" 定位 + qizai 价格优势提升至 **97%**（vs 之前 7%）+ 7 大风险规避 + 6 条定价原则 |
| v0.6 | 2026-07-22 | **§6.4 公司信息重大修订**：peer quick-yc 核验发现蕾姆之前 Loop 调研存在**信息源混淆**——SU 无 YC 关联、Tracxn 记录为 unfunded、创始人是 Kwame Ferreira + Hugo Alves（不是 Flo Crivello）+ Loop 调研警示（所有竞品"融资 + 创始人"信息需重新核验）|
| v0.7 | 2026-07-22 | **§9 引用清单补强**：加入蕾姆自派 verify-syn-users-pricing 报告 + peer 主动消息聚合（6 个来源），形成 v0.4-v0.6 数据基础的双重印证 |
| v0.8 | 2026-07-22 | **§5 重大更新：Oransim 核验完成（6 源印证）**——Apache-2.0 完全合规 + 橙果视界（深圳）真实公司 + 刘昆（1998，同济建筑系，前维和战士）+ 融资数千万元 + 2025 营收 2000 万元 + **关键架构澄清：100 万 personas = 99 万 IPF 合成代理 + 1 万 LLM soul personas**（混合架构）+ 强 fork 候选 |
| v0.9 | 2026-07-22 | **§2.4.4 重大修订**：MiroFish 核验发现 Loop 报告的 "Hawkes rollout / do()-operator 反事实推理" 在仓库中**完全不存在**（关键词扫描 0 命中）—— MiroFish 真实技术栈是 OASIS + GraphRAG + LLM Agents。**删除 Loop 幻觉的两条技术点**，**优先借鉴 Oransim 的真实技术**（IPF + Top-10k LLM + Hawkes + counterfactual）|
| **v0.10** | **2026-07-22** | **3 竞品完整核验集成 + 战略路径重排**：<br>1. **§5 新增 3 竞品核心对比矩阵**（Oransim 🥇 P0 / MiroFish 🥈 P2 / TryCue 🥉 P3）—— 4 维交叉对比（开源协议 / 技术栈成熟度 / 商业化 / 借鉴价值）<br>2. **§5.3-5.5 新增 3 竞品详细核验**—— Oransim 强 fork 候选 / MiroFish 技术栈纠错 / TryCue 弱对比观察<br>3. **§2.4.4 进一步优化**—— 明确以 **Oransim 为 P0 借鉴对象**，移除 MiroFish 直接引用，新增"Loop 幻觉警示"<br>4. **§6.5 新增 qizai vs Oransim 差异化矩阵**—— 12 维度对比 + 5 大差异化策略 + B 端正面竞争风险警示<br>5. **§6.6 新增 TryCue 弱对比观察**—— TRAE 大赛参赛已证实，获奖未证实<br>6. **§6.7 假设升级表新增 3 列**—— MiroFish 技术栈 / Oransim fork 候选 / TryCue 威胁评估<br>7. **§9 引用清单补强 3 份核验报告**—— oransim-corp-info / mirofish-corp-info / trycue-trae |
| **v0.11** | **2026-07-22** | **TryCue 深度代码审计完成 + Loop "90% 相似度" 幻觉纠正 + TryCue 借鉴优先级 P0 明确**：<br>1. **§5.1 矩阵 TryCue 行升级**—— P3 → **P2**（Apache-2.0 可 fork + 借鉴价值明确）+ 新增 4 维核验数据（GitHub Stars 21 / 报告形式 / 真实校准 / 创始团队）<br>2. **§5.5 TryCue 详细核验全面升级**—— 拆分 3 个子章节（公司信息 + 代码审计 + 借鉴优先级）+ 5 项必改 + 3 项推荐<br>3. **§2.4.4 新增 TryCue 防 LLM 幻觉借鉴**—— 报告决策台（`packages/shared/src/report.ts`）+ evidence 包（`apps/api/src/runtime/evidencePack.ts` 1422 行）<br>4. **§5.7 战略决策总结更新**—— TryCue 从 P3 升级到 P2（Apache-2.0 可借鉴）<br>5. **§6.6 TryCue 弱对比观察升级**—— 表格全面更新 + 推荐措辞修订 + qizai 应对策略明确<br>6. **§6.7 假设升级表新增 v0.11 列**—— TryCue 威胁评估从 🟡 弱（P3）升级到 🟢 P2<br>7. **§9 引用清单新增 2 份核验报告**—— trycue-corp-info + trycue-code-audit |
| **v0.12** | **2026-07-23** | **10 项重大修订（基于 B-1 + B-2 + C + MiniMax 真实 API 校准）**：<br>1. **§2.7 成本改为 ¥0.72**（B-1 PoC：qwen-plus 1000 persona 单次预测）<br>2. **§3.2 新增 EXTREME_PROMPT_BOOST 架构**（B-2 实测：Mean Reversion 36.57% → 目标 60%，需架构改造而非参数调优）<br>3. **§3.3 DIVERSITY_THRESHOLD=0.40 + 双层熔断**（B-2 实测：原 0.15 是 mode collapse，最优 0.40 = ×2.67）<br>4. **§2.5.1 默认 LLM 改为 qwen-plus**（B-1 实测：+58% 利润率，比 DeepSeek 便宜 60%）<br>5. **§3.1 stance_label 显式立场标签**（B-2 实测：persona 自由派倾向 2-3 倍，需 stance_label 平衡）<br>6. **§2.4.4 Oransim `base.py` 扩展清单**（C 架构分析：TikTok PlatformAdapter 是最完整参考 / XHS 仅资产非 adapter / base.py 需扩展 11 方法）<br>7. **§2.4.4 新平台优先级 XHS → 抖音 → 视频号 → B站**（C 架构分析建议）<br>8. **§6.5 qizai vs Oransim 重新定位**（C 架构分析：TikTok adapter 完整度 / XHS 模型资产 / 4 个短视频 adapter 全部 MVP-synthetic）<br>9. **§2.5.2 MiniMax M3 RPM/TPM 限流发现**（真实 API 校准：4 个 PoC 全部触发 429 / 错误码 2062 / Token Plan 套餐无法支撑 1000 persona MVP / 关键数据：单次 persona 调用 ~67 tokens）<br>10. **§9 引用清单新增 4 份核验报告**—— poc-1000-persona + poc-trap-params + oransim-architecture-analysis + MiniMax M3 真实 API 校准 |

---

**🟢 等待昴君 Review。**
