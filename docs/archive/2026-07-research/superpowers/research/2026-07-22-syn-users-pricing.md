# Synthetic Users 定价核验报告

**核验日期**：2026-07-22  
**核验人**：verify-syn-users-pricing subagent

> **结论先行**：已独立推翻“¥500+/次”作为固定单次价格的说法。当前官网公开口径是 **US$2–60 / synthetic interview**，不是“每个研究项目固定 ¥500+”。同时，官方法律文档保留了一份标为 `pricing-old`、但页面注明 **2026-04-01 更新**的年度企业套餐：Essentials **US$18,000/年**、Growth **US$45,000/年**、Scale **US$85,000/年**、Enterprise 定制。由于官网当前营销页与该“旧定价”文档的销售口径并不完全一致，应把具体合同价视为需销售确认，而不是把二者机械相加。

## 核验方法与证据等级

- **一级证据**：Synthetic Users 官网、官方法律/产品文档、官方历史文章。
- **二级证据**：G2、行业采购目录及明确注明核验日期的竞争对手比较页。
- **三级证据**：一般工具目录/博客；只用于提示矛盾，不单独作为定价结论。
- 所有网页均于 **2026-07-22** 核验；网页抓取不能证明页面首次发布时间。
- 本报告中的“来源数”按**发布主体**计数，而不是按 URL 数量计数；官网多个页面只算一个官方来源。

## 路径 1：官网

- **状态**：已核验
- **当前公开定价页**：<https://www.syntheticusers.com/pricing>
  - Synthetic Users：**US$2–60 / interview**。
  - 对照项：DIY Recruiting 为 US$30–60 / interview；Recruitment Agency 为 US$80–120 / interview。
  - 官方同时宣称首次洞察用时低于 2 分钟、不需招募与排期、支持迭代追问及 RAG/专有数据增强。
  - 页面当前的购买 CTA 是 **Book demo**，没有公开把 US$2–60 拆成可直接购买的套餐档位。
  - **截图/抓取时间**：2026-07-22；URL 如上。当前执行环境保留的是可复核网页文本，没有生成独立 PNG 截图。

### 官方年度套餐文档

来源：<https://legal.syntheticusers.com/product-documentation/pricing-old>

该 URL 明确含 `pricing-old`，但页面正文又注明 “Last updated April 1st 2026 — aligned with pricing.syntheticusers.com”。因此以下数字属于**强证据但存在版本状态歧义**：适合预算区间判断，不应在未获销售确认前当作当前可签约报价。

| Tier | 价格 / 周期 | 含量与主要功能 | 超额价格 |
|---|---:|---|---:|
| Essentials | US$18,000 / 年 | 300 interviews/年；High-Fidelity Interviews、Prisma Planning、Vision、无限项目、协作席位、平台 API 能力 | US$40/interview |
| Growth | US$45,000 / 年 | 1,000 interviews/年；Essentials + IRIS Research Agents + RAG | US$30/interview |
| Scale | US$85,000 / 年 | 2,000 interviews/年；Growth + SSO、优先吞吐 | US$22/interview |
| Enterprise | 定制 / 年 | 5,000 interviews；自定义基础设施、预留容量、SLA、专属账户团队 | 定制 |

**隐含年包单价**（仅用年费÷含量）：Essentials US$60/interview，Growth US$45/interview，Scale US$42.50/interview；这与当前官网“US$2–60/interview”的上沿相容，但没有解释 US$2 下沿需要怎样的规模或配置。

### API 加购与席位

同一官方文档还列出：

- API Essentials：US$25,000/年（核心端点）
- API Growth：US$50,000/年（RAG 与 LLM Shuffle）
- API Scale：US$90,000/年（Knowledge Graph 与 Prisma）
- API Enterprise：US$150,000/年（SLA 与完整支持）
- 每账户含 5 席；额外席位按年结算：6–100 席 US$75/席/月、101–500 席 US$55/席/月、501+ 席 US$40/席/月。
- 每次 interview 最多 20 个 follow-up questions。

### Enterprise、试用与合同口径

- Enterprise：当前官网 <https://www.syntheticusers.com/start-trial> 写明 bespoke Enterprise plan 需联系，并提供 **Book a call**；Agency 可联系 referral program。
- 当前页面虽名为 “Start Trial”，正文实际上是 **Book a demo with us**，未公开试用天数或免费额度。
- 官方联系方式：**support@syntheticusers.com**；官方服务条款 <https://legal.syntheticusers.com/terms-of-service> 说明费用按 Pricing Terms 计算，月费依据定价条款结算，供应商可提前 30 天通知调价。
- 因此，**免费试用状态不能从当前官方页面确认**。

### 官方历史价格

官方 2023 年文章：<https://www.syntheticusers.com/post/synthetic-users-the-summer-of-2023-and-the-road-ahead>

- 当时公开称 Synthetic Users interviews 为 **US$3–5 each**，并明确提醒 “we are testing”。
- 这是历史试验价，不代表 2026 合同价；它能证明产品长期采用“按 interview”口径，而非固定“每次研究 ¥500+”。

## 路径 2：YC W25

- **状态**：未核验到；已知上下文很可能把不同公司/人物混淆
- 在 YC 公开公司目录与公开搜索中，未找到 syntheticusers.com 这家公司属于 **YC W25** 的可靠记录。
- 搜索到的相似公司是 **Synthetic Society**：<https://www.ycombinator.com/companies/synthetic-society>，YC 页面显示其为 **Summer 2025**，产品是用浏览器代理做 QA，创始人为 Aaron 与 Kavan；它不是本报告所核验的市场研究产品。
- syntheticusers.com 的一手/较强公开资料指向的创始团队是 **Kwame Ferreira 与 Hugo Alves**，例如 Comcast LIFT Labs：<https://lift.comcast.com/smart-insights-less-friction-synthetic-users-is-simplifying-research-w-ai-personas/>。
- 未找到 **Flo Crivello** 是该公司创始人的权威证据，也未找到 **US$2.85M Seed** 的权威公告。
- Caplight/CB Insights 等聚合页只显示 accelerator/其他投资人线索，未公开可验证的 YC deal terms、估值或 US$2.85M 融资额。
- **结论**：YC W25、Flo Crivello、US$2.85M Seed 三项均应从 qizai 的已知上下文中降级为“未经证实/疑似串项”。YC 的标准协议也不能被当作该公司的特定成交条款。

## 路径 3：用户间接验证

- **状态**：找到多条价格记录，但没有找到可验证的 Reddit/LinkedIn/X 真实买家账单或合同截图

### 价格印证来源

1. **G2 AI Marketplace**  
   URL：<https://ai.g2.com/marketplace/tools/syntheticusers>  
   抓取内容列出：Free Trial **US$0**、Pro **US$49/月**、Enterprise **Contact us**。  
   评价：G2 是独立平台，但该页面与当前官网的 US$2–60/interview 口径不同，也未列 included interviews；可能是旧数据或目录字段，需销售确认，不能单独视为当前报价。

2. **Cubbie 采购目录**  
   URL：<https://www.cubbie.com/products/synthetic-users>  
   摘要：**US$2–60/interview**、usage-based、Enterprise 通过 demo；同时标为无 free trial、无 free plan。  
   评价：与当前官网单位价格一致，可作为独立印证；但其试用结论与 G2 冲突。

3. **Articos 竞争对手比较页**  
   URL：<https://www.articos.com/alternatives/synthetic-users>  
   摘要：Synthetic Users 按 interview 收费 **US$2–60**，常见 10–12 participants；页面声明该价格于 **2026 年 6 月**在 syntheticusers.com 核验。  
   评价：具体、近期、可追溯到官网，但发布者是竞争对手，存在商业偏见，可信度低于中立采购目录。

4. **iMario 竞争比较页**  
   URL：<https://imario.ai/blog/imario-vs-syntheticusers>（2026-05-06）  
   摘要：Synthetic Users 定价透明度为公开 **US$2–60/interview** 区间，具体报价需 demo；并称可 self-serve signup。  
   评价：时间明确且与官网一致，但同样是竞争对手来源。

### 未找到的渠道

- Reddit r/ycombinator、r/MachineLearning、r/startups：未找到明确指向 syntheticusers.com 且披露实际支付金额的帖子。
- Capterra、TrustRadius：未找到该产品可核验的专属定价/评论页。
- LinkedIn、X/Twitter：找到 synthetic-user 类别讨论，但未找到可靠的 Synthetic Users 客户合同价或账单。
- 因此不能声称存在“用户评论证实了某一实际成交价”；现有第三方证据主要是目录或竞品对官网口径的转述。

### 试用信息矛盾

- G2：Free Trial US$0。
- Cubbie：No free trial / No free plan。
- 当前官方 start-trial 页面：实际只明确 Book demo，没有试用天数/额度。

故本报告将 free trial 标为 **待销售确认**，不采信任何一方的绝对说法。

## 路径 4：直接询问

- **状态**：未发送
- **原因**：当前环境没有用户授权的发件邮箱；代表用户向外部公司发信会产生真实外联与隐私/跟进后果。官网公开了 support@syntheticusers.com 与 Book a call，但未提供匿名询价通道。未伪造身份、姓名、公司或邮箱提交。
- 联系页：<https://www.syntheticusers.com/start-trial>
- 联系邮箱：support@syntheticusers.com

### 建议发送的英文询价邮件

**Subject:** Pricing information for market research evaluation

> Hello Synthetic Users team,
>
> I’m a product manager at a market research company and I’m evaluating synthetic research tools for our team. Could you please share your current pricing tiers, included interviews or studies, overage/per-interview costs, and the main features in each tier?
>
> I’d also appreciate clarification on whether you offer a free trial, whether RAG/data enrichment and API access are add-ons, and how Enterprise pricing is structured.
>
> Thank you.

询问重点：

1. 当前 Essentials/Growth/Scale 是否仍在售；
2. US$2/interview 的适用量级和最低合同额；
3. “interview”与“study”的计价关系（典型 study 10–12 interviews 时，总成本是多少）；
4. RAG、API、额外席位是否叠加收费；
5. free trial 的期限、额度、是否需信用卡；
6. Enterprise 最低年费与 SLA。

## 综合定价表

| Tier / 口径 | 价格 | 计费周期 | 主要功能 | 独立来源数 | 可信度 |
|---|---:|---|---|---:|---|
| 当前公开 usage-based | US$2–60 / interview | 按 interview；合同周期未公开 | AI interview、追问、RAG/专有数据增强（具体是否加价未公开） | 5（官网、Cubbie、Articos、iMario、其他目录） | 🟢 单价区间；🟡 成交条件 |
| Essentials（文档标记 old） | US$18,000 | 年付，300 interviews | 研究规划、Vision、无限项目、5 席、平台 API 能力 | 1 个官方发布主体 | 🟡 版本状态待确认 |
| Growth（文档标记 old） | US$45,000 | 年付，1,000 interviews | Essentials + IRIS + RAG | 1 个官方发布主体 | 🟡 版本状态待确认 |
| Scale（文档标记 old） | US$85,000 | 年付，2,000 interviews | Growth + SSO + 优先吞吐 | 1 个官方发布主体 | 🟡 版本状态待确认 |
| Enterprise（文档标记 old） | Custom，含量示例 5,000 interviews | 年付/定制 | 自定义基础设施、预留容量、SLA、专属团队 | 官网当前页 + 官方旧文档 | 🟡 |
| G2 Pro（冲突记录） | US$49/月 | 月付 | G2 未给完整功能/额度 | 1 | 🔴 未获官网当前页印证 |
| Free trial | 未确认 | — | 官网只明确 demo；G2 与 Cubbie互相冲突 | 3 个相互矛盾来源 | 🔴 |

## “¥500+/次”传闻判定

- 若“次”指 **1 个 synthetic interview**：传闻不准确。当前官网为 US$2–60，按汇率粗略约人民币十几元至四百多元，**上限也不能稳定表述为 ¥500+**，且汇率会变化。
- 若“次”指 **1 个 study**：官网 FAQ 表示定性研究通常 10–12 participants 达到饱和。按 US$2–60/interview 粗算，一个 10–12 人 study 的纯 interview 费用约 **US$20–720**，跨度很大；部分配置确实可能超过 ¥500，但不是固定起步价。
- 若按年度企业合同：最低公开旧套餐 US$18,000/年，明显不是轻量级“单次 ¥500”产品。

因此，“¥500+/次”最多只能作为某种 study 配置的非权威估算，必须注明 participant 数量、interview 单价与是否含 RAG/API/服务，不能作为竞品的正式定价引用。

## 关键洞察

1. **计价原子是 interview，不是 study。** qizai 若拿“单次分析”直接对比，必须先统一一个 study 包含多少 persona/interviews。
2. **公开低价与企业合同同时存在。** US$2–60 是边际 interview 区间；旧年度套餐揭示真实企业采购可能是 US$18k–85k/年。
3. **公开定价存在版本歧义。** 当前官网只展示区间和 demo；法律文档虽 2026-04 更新，却标为 `pricing-old`，签约前必须邮件确认。
4. **已知公司背景疑似串项。** YC W25、Flo Crivello、US$2.85M Seed 均未被权威来源支持；至少创始人信息与官方/加速器资料冲突。
5. **试用状态不可靠。** G2、Cubbie 和官网当前页面互相不一致，不能写成已确认的“7 天免费试用”或“无试用”。

## 对 qizai 定价策略的影响

- 不应再用“Synthetic Users ¥500+/次”作为 qizai 定价锚点。
- 建议 qizai 将定价拆为两个可比较维度：
  1. **按 study**：明确包含 persona 数、追问轮数、平台数量、报告深度；
  2. **按年包**：明确 included studies/interviews 与超额单价。
- 若 qizai 服务对象是中国中小创作者，可把低门槛套餐定位在 Synthetic Users 企业合同之下，但必须以人民币按“研究项目”收费，避免用户理解 interview 配额。
- PoC 的竞品成本模型建议使用三个场景，而非单点：
  - 低配：10 interviews × US$2 = US$20/study；
  - 中位压力测试：10 interviews × US$30 = US$300/study；
  - 高配：12 interviews × US$60 = US$720/study。
- 上述只是基于公开区间的敏感性分析，不是该公司的正式 study 报价。

## 中立判断

- **完成标准判断**：已达到“至少 3 个独立来源 + 至少 2 个具体 tier”的形式标准；但 tier 数字来自一份官方 `pricing-old` 文档，故年度套餐整体标为 **区间/版本待确认**，而 US$2–60/interview 可视为高可信当前公开口径。
- qizai 在 PoC 前应采用双重兜底：
  1. 竞争分析只引用“公开 US$2–60/interview”，并附官网 URL 与核验日期；
  2. 财务模型同时跑 US$20、US$300、US$720/study 三档，不依赖单一传闻。
- 在收到销售回复或正式报价前，不应写入“最低合同额”“当前年包仍在售”“免费试用存在”“RAG 固定加价”等未确认事实。

## 来源清单

### 一级来源

1. 当前官网定价：<https://www.syntheticusers.com/pricing>
2. 官方年度定价旧文档（2026-04-01 更新，但 URL 标记 old）：<https://legal.syntheticusers.com/product-documentation/pricing-old>
3. 官方联系/demo 页：<https://www.syntheticusers.com/start-trial>
4. 官方服务条款：<https://legal.syntheticusers.com/terms-of-service>
5. 官方 2023 历史价格文章：<https://www.syntheticusers.com/post/synthetic-users-the-summer-of-2023-and-the-road-ahead>

### 独立/第三方来源

6. G2 AI Marketplace：<https://ai.g2.com/marketplace/tools/syntheticusers>
7. Cubbie 采购目录：<https://www.cubbie.com/products/synthetic-users>
8. Articos 比较页：<https://www.articos.com/alternatives/synthetic-users>
9. iMario 比较页（2026-05-06）：<https://imario.ai/blog/imario-vs-syntheticusers>
10. Comcast LIFT Labs 公司/创始团队资料：<https://lift.comcast.com/smart-insights-less-friction-synthetic-users-is-simplifying-research-w-ai-personas/>
11. YC 相似但不同公司 Synthetic Society：<https://www.ycombinator.com/companies/synthetic-society>

---

**最终可信结论**：Synthetic Users 当前公开价格是 **US$2–60/次 synthetic interview**；年度企业套餐曾/可能为 **US$18k、US$45k、US$85k 与定制 Enterprise**。原 Spec 的“¥500+/次”没有得到独立核验，应删除或改写为带单位与证据日期的公开美元区间。
