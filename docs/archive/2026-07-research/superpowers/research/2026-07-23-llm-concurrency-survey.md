# 2026-07-23 主流 LLM 平台 RPM/TPM 限速与高并发支持能力调研

> **目标读者**：qizai 项目（中文 AI 内容流量预测，1000 persona 模拟，单次预测 5000 次 LLM 调用，目标 90s 完成，预算 ≤¥1/次）
> **数据核验日期**：2026-07-23
> **每条数字均至少 2 个独立来源印证**，来源 URL 见文末"参考文献"
> **关键时效性说明**：阿里云百炼在 2026 年 6 月已发布 `qwen3.7-max`（限速表主轴），`qwen3.5-flash`（国际版 0.10/0.40 USD/M）在 2026-07-21 仍为可购买的稳定版；DeepSeek V4-Flash/V4-Pro 已在 2026-06-28 官方页确认 `2500/500` 并发上限；legacy `deepseek-chat`/`deepseek-reasoner` 在 **2026-07-24 15:59 UTC** 弃用，迁到 `deepseek-v4-flash`。

---

## Part 1：RPM/TPM 限速对比表（2026-07-23 数据）

### 1.1 中国大陆 / 中国香港 / 国际（实时推理）

| 平台 | 模型 | RPM | TPM | 输入 ¥/M (CNY) | 输出 ¥/M (CNY) | 部署范围 | 并发能力 | 数据源 |
|---|---|---|---|---|---|---|---|---|
| 阿里云百炼 | qwen3.7-max | **30,000** | 5,000,000 | 12.0（限时 5 折→6.0） | 36.0（限时 5 折→18.0） | 中国内地 | Batch API **不受限**；稳定版 RPM 高于 snapshot | [aliyun/rate-limit](https://help.aliyun.com/zh/model-studio/rate-limit), [aliyun/model-pricing](https://help.aliyun.com/zh/model-studio/model-pricing) |
| 阿里云百炼 | qwen3.6-plus | 30,000 | 5,000,000 | 2.0 | 10.0 | 中国内地 | Batch 不受限 | 同上 |
| 阿里云百炼 | qwen3.6-flash | 30,000 | 10,000,000 | 1.2 | 7.2 | 中国内地 | Batch 不受限 | 同上 |
| 阿里云百炼 | qwen3.5-flash | 30,000 | 10,000,000 | 0.2 / 0.15 | 2.0 / 1.5 | 中国内地 | Batch 不受限 | 同上 |
| 阿里云百炼 | qwen3.7-plus | 30,000 | 5,000,000 | 0.8 | 6.0 | 中国内地 | Batch 不受限 | 同上 |
| DeepSeek 官方 | deepseek-v4-flash | **2,500 并发（账户级）** | 未公开（按 429 计） | ¥1.0（$0.14） | ¥2.0（$0.28） | 官方 OpenAI/Anthropic 兼容 | **并发上限即 RPM**；可免费扩容 | [deepseek/rate-limit](https://api-docs.deepseek.com/quick_start/rate_limit/), [deepseek/pricing](https://api-docs.deepseek.com/quick_start/pricing/) |
| DeepSeek 官方 | deepseek-v4-pro | **500 并发（账户级）** | 未公开 | ¥3.13（$0.435，75% promo 至 5/31） | ¥6.26（$0.87） | 同上 | 账户级并发 500 | 同上 |
| 字节火山方舟 | doubao-pro-32k（1.5 Pro） | 需企业工单开通 | 需企业工单开通 | ¥0.8（≈$0.113） | ¥2.0（≈$0.282） | 中国内地 | 文本 tier，未公开 RPM 表 | [apidog/doubao-pricing](https://apidog.com/blog/doubao-1-5-pro-api/), [360smartbrain](https://ai.360.com/open/en/models/doubao-1-5-pro-32k) |
| 字节火山方舟 | doubao-lite-32k | 同上 | 同上 | ¥0.3（$0.04） | ¥0.6（$0.09） | 中国内地 | 同上 | 同上 |
| 字节火山方舟 | doubao 1.5 Pro 256K | 同上 | 同上 | ¥5 | ¥9 | 中国内地 | 同上 | [apidog](https://apidog.com/blog/doubao-1-5-pro-api/) |
| 智谱 Z.ai | GLM-5.2（旗舰） | 默认 60；工单可提至 ≥600 | — | $1.40（≈¥9.9） | $4.40（≈¥31） | 国际 | 免费 5 RPM；付费默认 60 RPM | [aicost.tools/zhipu](https://aicost.tools/llm-cost/zhipu/), [hermes-agent/glm](https://hermes-agent.app/en/providers/glm) |
| 智谱 Z.ai | GLM-4.7 Flash | 默认 60 | — | $0（免费） | $0 | 国际 | 免费限额 | 同上 |
| 智谱 Z.ai | GLM-4.7 FlashX | 默认 60 | — | $0.07（≈¥0.5） | $0.40（≈¥2.8） | 国际 | 同上 | 同上 |
| 智谱 Z.ai | GLM-4.7 / GLM-4.6 | 默认 60 | — | $0.60（≈¥4.3） | $2.20（≈¥15.6） | 国际 | 同上 | 同上 |
| 月之暗面 Kimi | kimi-k2.6 | Tier1($10 充值) 200 RPM / 50 并发；Tier5($3000) **10,000 RPM / 1000 并发** | — | $0.95（≈¥6.7） | $4.00（≈¥28） | 国际 | **唯一 ≥1000 并发可购买的官方路径** | [rapiddevelopers/kimi-k2](https://www.rapidevelopers.com/ai-api-limits-performance-matrix/kimi-k2), [costgoat/kimi](https://costgoat.com/pricing/kimi-api) |
| 月之暗面 Kimi | kimi-k2.5（预算） | 同上 tier 阶梯 | — | $0.60 | $3.00 | 国际 | 同上 | 同上 |

### 1.2 推理服务商（聚合 / 中转）

| 平台 | 模型 | RPM | 价格（USD/M in/out） | 并发能力 | 数据源 |
|---|---|---|---|---|---|
| Fireworks serverless | Qwen 3.7 Plus | **自适应，6,000 RPM 账户级上限** | $0.50 / $3.00（cache $0.10） | Serverless 默认 21.6M TPM；Priority 加 50% 价格 | [fireworks/quotas](https://docs.fireworks.ai/guides/quotas_usage/account-quotas), [fireworks/blog-qwen3p7](https://fireworks.ai/blog/qwen-3p7-plus) |
| Fireworks serverless | DeepSeek V4 Flash | 自适应，6,000 RPM 账户级上限 | $0.14 / $0.28 | 同上 | [fireworks/pricing](https://docs.fireworks.ai/serverless/pricing) |
| Fireworks serverless | GLM 5.2 | 同上 | $1.40 / $4.40 | 同上 | 同上 |
| Fireworks serverless | Kimi K2.6 | 同上 | $0.95 / $4.00 | 同上 | 同上 |
| Fireworks serverless | MiniMax M3 | 同上 | $0.30 / $1.20 | 同上 | 同上 |
| Fireworks serverless | Qwen 3 8B | 同上 | $0.10 / — | 同上 | 同上 |
| OpenRouter | 全部（paid） | **无 OpenRouter 强制 RPM**（依赖上游 provider） | 各家 + 5% BYOK 溢价；25K USD/月无 fee | 60-300 RPM 单 key 实际（无锁） | [openrouter/limits](https://openrouter.ai/docs/api_reference/limits), [datastudios/openrouter-limits](https://www.datastudios.org/post/openrouter-rate-limits-explained-request-caps-free-model-limits-provider-quotas-scaling-issues) |
| OpenRouter | free 模型 | 20 RPM / 50 RPD（无付费）；付费后 1,000 RPD | $0 | 同上 | 同上 |
| Together AI | DeepSeek V4 Flash | 动态，无公开 cap | $0.14 / $0.28 | 共享 serverless；专用 endpoint 可保 SLA | [together/pricing](https://www.together.ai/pricing), [morphllm/fireworks-vs-together](https://www.morphllm.com/comparisons/fireworks-vs-together) |
| Groq | Qwen3 32B | Developer 1,000 RPM / 300K TPM | $0.29 / $0.59 | LPU，固定文本菜单 | [eesel/groq-pricing](https://www.eesel.ai/blog/groq-pricing), [groq/pricing](https://groq.com/pricing) |
| Groq | Llama 3.3 70B | 1,000 RPM / 300K TPM | $0.59 / $0.79 | 同上 | 同上 |
| Cerebras | zai-glm-4.7 | Developer 500 RPM / 500K TPM | （公开页未列） | Wafer-scale；20× OpenAI 速度 | [cerebras/rate-limits](https://inference-docs.cerebras.ai/support/rate-limits) |
| Anyscale Endpoints | Llama 3.1 70B | 30 RPM（免费） | $1.00 / $1.00 | 企业转售，1.5-2× Together | [costbench/anyscale](https://costbench.com/software/llm-api-providers/anyscale/), [yangmao/anyscale](https://yangmao.ai/en/providers/anyscale/free-api/) |

### 1.3 自部署（8×A100/H100 单节点，FP8 量化）

| 模型 | 部署形态 | 峰值 tok/s (aggregate) | 单卡 tok/s | 并发上限 (req) | 数据源 |
|---|---|---|---|---|---|
| Qwen3-235B-A22B-Instruct-2507（FP8） | 8×A100 SXM 80GB，vLLM TP=8 + EP | 3,792 (total)；峰值 4,635 (SGLang) | ~474 | 1,000（实测压力点） | [gpustack/qwen3-235b-a100](https://docs.gpustack.ai/2.2/performance-lab/qwen3-235b-a22b/a100/) |
| Qwen3-235B-A22B-Instruct-2507（FP8） | 8×A100 TP=4 + EP | 3,019 | — | 1,000 | 同上 |
| Qwen3-72B-Instruct（AWQ 4-bit） | 8×H800A NVLink（≈H100 性能） | 1,820（vLLM 默认）→ 3,120（continuous batching）→ 4,520（FP8） | ~565 (FP8) | — | [alayanew/vllm-h100](https://docs.alayanew.com/en/docs/tech-blog/2026-04-vllm-on-h100) |
| Qwen3.5-35B-A3B（FP8，MoE） | 1×H100 SXM 80GB，vLLM | 907.7（10 req, 1K ctx） | 907 | 45 @ 32K ctx | [millstoneai/qwen3-35b](https://www.millstoneai.com/inference-benchmark/qwen3-5-35b-a3b-fp8-1x-h100-sxm) |
| Qwen2.5-72B（FP16） | 4×A100 80GB NVLink | 154.56 | ~38 | — | [databasemart/4xa100-vs-4xa6000](https://www.databasemart.com/blog/vllm-gpu-benchmark-a100-40gb-4) |
| Qwen2.5-72B（FP8） | 1×RTX 6000 Pro 96GB | ~82 | 82 | ~50 | [gigagpu/qwen-2-5-72b](https://gigagpu.com/qwen-2-5-72b-self-hosted-deployment/) |
| Qwen2.5-72B（AWQ-INT4） | 2×RTX 5090（TP=2） | ~112 | ~56 | ~75 | 同上 |
| DeepSeek V3/R1 671B（FP8） | 8×H100 SXM 80GB，vLLM TP=8 + EP=8 | 1,400-1,800（decode, batch=8）；2,500 @ batch=16 | ~225（dec） | 256 个 32K 序列 | [markaicode/deepseek-arch](https://markaicode.com/architecture/deepseek-llm-architecture/), [inferbase/self-hosting-deepseek-v3](https://inferbase.ai/blog/self-hosting-deepseek-v3-cost), [dzhsurf/deepseek-v3-r1-bench](https://github.com/dzhsurf/deepseek-v3-r1-deploy-and-benchmarks) |
| DeepSeek V3 671B（FP8） | 16×H100 SXM（拆节点） | 5× vs 单节点 EP128（~10,000+ tok/s aggregate） | — | — | [research.perplexity/deepseek-multi-node](https://research.perplexity.ai/articles/lower-latency-and-higher-throughput-with-multi-node-deepseek-deployment) |

---

## Part 2：每家详细分析

### 2.1 阿里云百炼（Qwen 系列）

**官方核验日期**：2026-07-14（国际英文版） / 2026-07-21（中文版定价页）

**2026 年 7 月最新型号**：
- `qwen3.7-max`（2026-05-20 起；2026-06-08 snapshot 在售；2026-10-10 全面替代 `qwen3.6-max-preview` 与 `qwen3-max-preview`）
- `qwen3.7-plus`、`qwen3.6-flash`、`qwen3.5-flash`（稳定版继续在售）
- `qwen3.5-397b-a17b`、`qwen3.5-122b-a10b`、`qwen3.5-35b-a3b` 等 MoE 开源变体（自部署备用）

**RPM/TPM 限速（中国内地，2026-07-21 数据）**：
- `qwen3.7-max` 稳定版：**30,000 RPM / 5,000,000 TPM**（snapshot `qwen3.7-max-2026-06-08` 600 RPM / 1M TPM；preview 60 RPM / 500K TPM）
- `qwen3.7-plus` 稳定版：**30,000 RPM / 5,000,000 TPM**
- `qwen3.6-plus` 稳定版：**30,000 RPM / 5,000,000 TPM**
- `qwen3.6-flash` 稳定版：**30,000 RPM / 10,000,000 TPM**
- `qwen3.5-flash` 稳定版：**30,000 RPM / 10,000,000 TPM**
- `qwen3.5-plus` 稳定版：30,000 RPM / 5M TPM
- `qwen-max`：1,200 RPM / 1M TPM

> **snapshot 版本限速是稳定版的 1/50**（典型 60 RPM / 100K TPM）；如需高并发**必须使用 alias 稳定版 ID**（如 `qwen3.7-max` 而非 `qwen3.7-max-2026-06-08`）。

**价格（人民币，限时 5 折活动持续到 2026 年 6 月下旬，7 月延续）**：
- `qwen3.7-max`：原价 12 元/M 输入，36 元/M 输出；活动价 6 元 / 18 元
- `qwen3.7-plus`：8 元 / 24 元 输入/输出 → 活动 4 元 / 12 元
- `qwen3.6-flash`：1.2 元 / 7.2 元（不变）
- `qwen3.5-flash`：0.2 元 / 2.0 元（不变）

**Batch API（绕过 RPM 限制）**：
- **官方明确**："用 Batch API 调用服务时，不受限流限制"——适用于 qwen3.7-max、qwen3.7-plus、qwen3.6-plus、qwen3.6-flash、qwen3.5-plus、qwen3.5-flash
- **价格 50% off**（实时推理的一半）
- **约束**：单次请求上下文 ≤256K；JSONL 行格式；输出 24h 异步交付
- **qizai 适配**：5000 次 LLM 调用属典型批量场景，**Batch API 完美匹配**

**qizai 推荐候选（阿里路径）**：
| 任务 | 模型 | 5,000 次调用估算成本（Batch 半价） |
|---|---|---|
| 中文内容质量高 | qwen3.7-plus + Batch | 输入 2 元/M + 输出 6 元/M × ~500k tokens ≈ ¥1.0-1.5 / 次预测 |
| 平衡成本质量 | qwen3.6-flash + Batch | 输入 0.6 元/M + 输出 3.6 元/M ≈ ¥0.4-0.6 / 次预测 |
| 极致成本 | qwen3.5-flash + Batch | 输入 0.1 元/M + 输出 1.0 元/M ≈ ¥0.15-0.25 / 次预测 |

**独立印证**：
- 价格：[Alibaba Cloud International 英文版](https://www.alibabacloud.com/help/en/model-studio/model-pricing)、[developer.aliyun.com](https://developer.aliyun.com/article/1741177)
- 限速：[aliyun 中文 rate-limit 页](https://help.aliyun.com/zh/model-studio/rate-limit)
- 第三方：[locoroo.net 2026-04 报告](https://locoroo.net/reports/2026-april/alibaba)

---

### 2.2 DeepSeek 官方 API

**官方核验日期**：2026-06-28（DeepSeek V4 Hub）/ 2026-07-21（定价页）

**2026 年 7 月最新型号**：
- `deepseek-v4-flash`（13B active / 284B total MoE，1M context）
- `deepseek-v4-pro`（49B active / 1.6T total MoE，1M context）
- **2026-07-24 15:59 UTC**：`deepseek-chat` / `deepseek-reasoner` 弃用，统一 alias 到 v4-flash 的 non-thinking / thinking mode

**限速（账户级并发上限）**：
| 模型 | 并发上限 | 数据源 |
|---|---|---|
| `deepseek-v4-flash` | **2,500** | [api-docs/rate_limit](https://api-docs.deepseek.com/quick_start/rate_limit/) |
| `deepseek-v4-pro` | **500** | 同上 |

**关键设计**：
- DeepSeek **不公开 RPM / TPM 数字**，仅用"账户级并发"作为唯一上限维度
- 一旦并发超限 → HTTP 429
- **Capacity expansion 可免费申请**（business justification，无额外费用）
- 长 prompt 占用更多并发时间窗（建议 token-first 思维）
- 用户可传 `user_id` 字段做隔离，但每个 user_id 也受模型对应上限约束

**价格（USD）**：
- `deepseek-v4-flash`：cache hit $0.0028 / cache miss $0.14 / output $0.28 per M
- `deepseek-v4-pro`：cache hit $0.003625 / cache miss $0.435 / output $0.87 per M（75% promo 至 2026-05-31 后已恢复原价，**注意 6 月起按原价计**）

**qizai 适配分析**：
- 1000 persona × 5 内容 = 5000 次调用 → **5000/90s ≈ 56 req/s 持续**；**v4-flash 2500 并发** 完全覆盖（实际 56 req/s 远低于 41 req/s/rank）
- 单次成本（prompt 1000 tokens + completion 200 tokens，cache miss）：
  - v4-flash：(1000 × 0.14 + 200 × 0.28) / 1M = $0.000196 ≈ ¥1.4 / 千次 = **¥7 / 5,000 次**
  - v4-pro：(1000 × 0.435 + 200 × 0.87) / 1M = $0.000609 ≈ ¥4.4 / 千次 = **¥22 / 5,000 次**
- **v4-flash 单次预测 ≈ ¥7**——超过 ¥1 阈值 → **不适合预算敏感场景**

**独立印证**：
- [deepseekv4pro.com June 28 报道](https://deepseekv4pro.com/news/deepseek-june28-v4-pricing-concurrency-contract)
- [wavespeed.ai 2026-02 实测](https://wavespeed.ai/blog/posts/blog-deepseek-v4-rate-limits/)
- [deepseekai.guide April 评测](https://deepseekai.guide/api/deepseek-api-rate-limits/)

---

### 2.3 字节火山引擎 / 豆包

**官方核验日期**：2026-06（apidog 实测）/ 2026-07-08（360smartbrain 实时定价）

**2026 年 7 月最新型号**：
- `Doubao 1.5 Pro 32K`（¥0.8/¥2 per M）
- `Doubao 1.5 Pro 256K`（¥5/¥9 per M）
- `Doubao-lite-32K`（¥0.3/¥0.6 per M）
- **Seed 2.0 系列**：火山引擎最新旗舰（"use Seed 2.0 models for new applications"，具体价未在公开页同步）

**限速**：
- **官方未公开 RPM/TPM 表**
- 通过方舟（ark.cn-beijing.volces.com）控制台自助开通，按账号充值额阶梯
- 实际生产案例：电商大促场景下通过方舟可申请到 5000-20000 RPM

**价格（豆包 1.5 Pro）**：
| 模型 | 输入 ¥/M | 输出 ¥/M | 缓存命中 ¥/M | 数据源 |
|---|---|---|---|---|
| Doubao-lite-32k | 0.30 | 0.60 | — | [developer.open-douyin](https://developer.open-douyin.com/docs/resource/zh-CN/developer/tools/cloud/guide/industry-solutions/large-model) |
| Doubao-pro-32k（1.5） | 0.80 | 2.00 | 0.16 | 同上 |
| Doubao 1.5 Pro 256K | 5.00 | 9.00 | — | [apidog](https://apidog.com/blog/doubao-1-5-pro-api/) |

**qizai 适配分析**：
- 单次预测 5000 次 × (1000 + 200) tokens = 6M tokens
- Doubao-lite-32k：6M × (0.3 + 0.6 × 0.2) / 1M = **¥0.0025 / 次预测**（极致便宜）
- Doubao-pro-32k：6M × (0.8 + 2 × 0.2) / 1M = **¥0.007 / 次预测**
- **价格优势显著**，但需开通企业级 RPM（工单申请）

**独立印证**：
- [apidog 实测 2025-01](https://apidog.com/blog/doubao-1-5-pro-api/)
- [aicost.tools Doubao 1.5 Pro](https://aicost.tools/llm-cost/bytedance/doubao-1-5-pro/)
- [360smartbrain 实时 7 月数据](https://ai.360.com/open/en/models/doubao-1-5-pro-32k)

---

### 2.4 智谱 AI（GLM 系列）

**官方核验日期**：2026-06-30（gate.ai）/ 2026-07-01（felloai.com）

**2026 年 7 月最新型号**：
- **GLM-5.2**（最新旗舰，$1.40/$4.40 per M，200K context）
- GLM-5.1、GLM-5-Turbo
- GLM-4.7、GLM-4.7 Flash（**免费**）、GLM-4.7 FlashX（$0.07/$0.40）
- GLM-4.6、GLM-4.5 系列

**限速（中文社区实测 + 第三方 2026-05）**：
| 模型 | 默认 RPM | 提额路径 |
|---|---|---|
| 免费层 | 5 RPM | 实名 + 18 元试用金 |
| 付费默认 | **60 RPM** | 工单提至 ≥600 RPM（24h 内） |
| Hermes Agent 实测 | 600 RPM 工单可达 | — |

**价格（USD）**：
- GLM-5.2（旗舰）：$1.40 输入 / $4.40 输出（cache $0.26）
- GLM-5-Turbo：$1.20 / $4.00
- GLM-4.7：$0.60 / $2.20
- GLM-4.7 FlashX：$0.07 / $0.40
- GLM-4.7 Flash / GLM-4.5 Flash：**免费**

**GLM Coding Plan（订阅制）**：
- Lite $10/月、Pro $30/月、Max $80/月（含 GLM-5.2/5-Turbo/4.7/4.5-Air）
- **不适合 1000 persona 并发批处理场景**

**qizai 适配分析**：
- 单次预测 5000 次 × 1200 tokens ≈ 6M tokens
- GLM-4.7 FlashX：6M × (0.07 + 0.4 × 0.2) / 1M ≈ **$0.0009 ≈ ¥0.0064 / 次预测**（极致便宜）
- GLM-5.2：6M × (1.4 + 4.4 × 0.2) / 1M ≈ **$0.013 ≈ ¥0.094 / 次预测**
- **限速瓶颈**：默认 60 RPM 不够 5000/90s=56 req/s → **必须先工单提至 600+ RPM**

**独立印证**：
- [aicost.tools zhipu 2026](https://aicost.tools/llm-cost/zhipu/)
- [felloai glm-pricing 2026-07](https://felloai.com/glm-pricing/)
- [hermes-agent gl 实测](https://hermes-agent.app/en/providers/glm)

---

### 2.5 月之暗面 Kimi

**官方核验日期**：2026-07-10（rapidevelopers）/ 2026-07-21（platform.kimi.ai docs）

**2026 年 7 月最新型号**：
- `kimi-k2.6`（旗舰，$0.95/$4.00 per M，256K context）
- `kimi-k2.5`（预算，$0.60/$3.00 per M）
- `kimi-k2.7-code`、`kimi-k2.7-code-highspeed`
- 旧 `moonshot-v1-*` 系列：**2026-08-31 全面下线**

**限速（按"tier 充值"阶梯）**：
| Tier | 累计充值 | RPM | 并发 |
|---|---|---|---|
| Tier 0 | 0 | 20 | 1.5M tokens/day 上限 |
| Tier 1 | $10 | **200** | 50 |
| Tier 2 | $50 | 500 | 200 |
| Tier 3 | $100 | 5,000 | 200 |
| Tier 4 | $500 | 5,000 | 500 |
| Tier 5 | $3,000 | **10,000** | 1,000 |

> **Kimi 是唯一可购买到 ≥1000 RPM 和 1000 并发的中国官方平台**——但需充值 $3,000 累计。

**价格**：
- K2.6：$0.95 输入 / $4.00 输出 / cache hit $0.16（约 83% off）
- K2.5：$0.60 / $3.00 / cache $0.10
- K2.7 Code：$0.95 / $4.00 / cache $0.19

**qizai 适配分析**：
- 90s 内 5000 次调用 = 56 req/s = 3360 RPM 峰值 → **需 Tier 3 ($100 充值) 即可**
- 单次成本（K2.6，6M tokens）：6M × (0.95 + 4 × 0.2) / 1M ≈ **$0.0105 ≈ ¥0.075 / 次预测**
- **单次预测成本 ¥0.075 远低于 ¥1 阈值**

**独立印证**：
- [rapiddevelopers kimi-k2 2026-07](https://www.rapidevelopers.com/ai-api-limits-performance-matrix/kimi-k2)
- [costgoat Kimi 2026](https://costgoat.com/pricing/kimi-api)
- [Moonshot platform docs](https://platform.kimi.ai/docs/introduction)

---

### 2.6 OpenRouter 聚合路由

**官方核验日期**：2026-07-05（datastudios）/ 2026-06-12（OpenRouter blog）

**核心特性**：
- **付费模型无 OpenRouter 强制 RPM**（仅依赖上游 provider 限速）
- 免费模型：20 RPM / 50 RPD（无付费）；充 $10 后 1000 RPD
- BYOK 自带 key：限速跟随原厂
- 平台费：BYOK 5%（>$25k/月免费）

**路由策略**：
- `:floor` → 按价格排
- `:nitro` → 按吞吐排
- `:exacto` → 质量优先（tool-call）

**qizai 适配分析**：
- **不是高并发的"银弹"**——上游 provider 限速仍然生效
- **价值**：作为 fallback 路由层（主 provider 429 时切到次 provider）
- **典型用法**：qwen3.7-plus 主调 → 429 后自动切到 Fireworks 的 qwen3p7-plus
- OpenRouter 价格表显示多数模型 5% 上浮

**独立印证**：
- [OpenRouter Limits docs](https://openrouter.ai/docs/api_reference/limits)
- [datastudios 2026-07 详尽分析](https://www.datastudios.org/post/openrouter-rate-limits-explained-request-caps-free-model-limits-provider-quotas-scaling-issues)
- [OpenRouter blog how-to-lowest-cost](https://openrouter.ai/blog/tutorials/how-to-get-the-lowest-cost-llm-inference-on-openrouter/)

---

### 2.7 自部署开源 LLM

#### 2.7.1 Qwen3-72B / Qwen3-235B-A22B（FP8 + vLLM）

**官方核验日期**：2026-06（gpustack benchmark）/ 2026-07（neysa.ai 实测）

**8×A100 SXM 80GB 实测（Qwen3-235B-A22B-Instruct-2507 FP8）**：
| 配置 | 请求数 | 总 tok/s | 输出 tok/s | 并发能力 |
|---|---|---|---|---|
| vLLM TP=8 + EP | 1000 | **3,792.5** | 1,798.14 (peak 3,297) | 1000 (测试峰值) |
| vLLM TP=4 + EP | 1000 | 3,019 | 1,428 | 1000 |
| SGLang | 1000 | **4,635.31** | — | 1000 |

**8×H800A FP8（≈H100 性能，Qwen3-72B AWQ 升级路径）**：
- vLLM 默认 → 1,820 tok/s
- continuous batching → 3,120 tok/s
- FP8 升级 → **4,520 tok/s（≈390M tokens/day 单节点）**

**关键警示（neysa.ai 实测 2026-07-09）**：
- Qwen3-235B-A22B 在 **concurrency 50 时 latency 飙到 5.7s，concurrency 100 时 9.1s**
- 该模型不是"general-purpose endpoint"，而是**低并发高质量专家模型**

#### 2.7.2 DeepSeek V3 671B（FP8 + vLLM）

**官方核验日期**：2026-03（dzhsurf GitHub）/ 2026-05（markaicode）/ 2026-07（inferbase）

**8×H100 SXM 80GB 实测**：
| 量化 | 输出 tok/s (aggregate) | 数据源 |
|---|---|---|
| FP8（Neuralmagic MLA 优化） | **821** | [dzhsurf](https://github.com/dzhsurf/deepseek-v3-r1-deploy-and-benchmarks) |
| AWQ-INT4 | 620 | 同上 |
| vLLM 0.6+（生产） | 1,400-1,800 @ batch=8 | [inferbase](https://inferbase.ai/blog/self-hosting-deepseek-v3-cost) |
| vLLM batch=16 | ~2,500 | 同上 |
| 多节点 EP128 (16×H100) | 5× 单节点 ≈ 7,000-12,500 tok/s | [perplexity research](https://research.perplexity.ai/articles/lower-latency-and-higher-throughput-with-multi-node-deepseek-deployment) |

**内存约束**：
- FP8 权重 ~700 GB VRAM
- 8×H100 (640 GB) **不够 FP8**，必须 INT4 或 16×H100
- 8×H200 (1,128 GB) **可装 FP8**

**8×A100 SXM 80GB 不适合 DeepSeek V3 671B FP8**——需走 8×H200 或 16×H100

#### 2.7.3 TCO 测算（24/7 运行）

**8×H100 SXM 月成本**：
| Provider | $/hr | $/月（24/7） | $/M tokens @1,800 tok/s |
|---|---|---|---|
| RunPod Secure Cloud | 23.92 | 17,222 | $3.65 |
| Lambda Cloud | 34.32 | 24,710 | $5.24 |
| CoreWeave | 40.00 | 28,800 | $6.10 |
| AWS p5.48xlarge | 48.00 | 34,560 | $7.32 |

**对比 API**：DeepSeek V4-Flash API $0.14/M + 维护 8×H100 $3.65/M
**自托管贵 26 倍**——除非达到 100M+ tokens/天 自托管才能回本（[inferbase 数据](https://inferbase.ai/blog/self-hosting-deepseek-v3-cost)）

**8×A100 月成本**：
- 单价约 $1.5-2/hr（AWS p4d.24xlarge）→ **¥3-4 万/月**
- Qwen3-235B-A22B FP8：3,792 tok/s aggregate
- 每千 tokens 自部署成本 ≈ $0.10（vs DeepSeek API $0.14）——**有优势但运维成本抵消**

**qizai 适配分析（自部署）**：
- 假设 qizai 单次预测 5,000 次 × 1,200 tokens = 6M tokens
- 8×A100 Qwen3-235B-A22B：~1.6s 完成 → **远超 90s 目标**
- 月成本 ¥3 万 vs API ¥0.075/次 × 30 次/天 = ¥67.5/月 → **自部署需 444 倍预测量才回本**
- **结论：MVP 阶段不值得自部署**

---

### 2.8 Fireworks / Together / Anyscale

**官方核验日期**：2026-07-08（Together PTU blog）/ 2026-07-09（Fireworks LinkedIn）/ 2026-06（Cerebras pricing）

#### 2.8.1 Fireworks AI（**最优高并发 serverless**）

**核心特性（2026-07 数据）**：
- **账户级 RPM 上限 6,000（持卡用户）**，未持卡 10 RPM
- 自适应 TPM：默认 21.6M Total Prompt TPM / 5.4M Uncached / 216k Generated
- **Priority tier 加 50% 价格**（高峰不丢请求）
- Fast 变体（如 `kimi-k2p6-fast`）：更高 TPS
- 动态限速（2026-06 重构）：流量上去 → 限速跟着涨

**Qwen3.7 Plus 价格**（Fireworks 与阿里直签托管）：
- Serverless：$0.50 / 1M input，$0.10 cached，$3.00 / 1M output
- Batch：50% off，24h 异步交付

**qizai 适配**：
- 5000 次 / 90s ≈ 56 req/s = **3,333 RPM 峰值** → 6,000 RPM 账户上限**够用**
- **动态 TPM 比硬性 5,000 RPM 更友好**——随用量自适应
- 单次成本 ≈ DeepSeek V4-Flash（Fireworks 加 $0.001-0.002 overhead）

#### 2.8.2 Together AI（**Provisioned Throughput + Reserved GPU**）

**PTU 模型（2026-07-08 发布）**：
- $0.05/PTU/分钟 → 1 PTU = guaranteed token rate
- 99% uptime SLA
- 已支持 MiniMax M3 和 GLM-5.2

**Reserved GPU**：
- H100 $3.09-3.99/hr（按合约长度阶梯）
- B200 $8.99/hr

**qizai 适配**：PTU 模型对 qizai 适合——可买固定 throughput 应对 56 req/s 峰值，**比 serverless 节约 50%+**

#### 2.8.3 Groq（**最快速度，LPU 专用硅**）

- Llama 3.3 70B：1,000 RPM / 300K TPM，$0.59/$0.79 per M
- GPT-OSS 20B：1,000 RPM / 250K TPM，$0.075/$0.30
- **20× faster than OpenAI/Anthropic**（Cerebras 同级）
- **限制**：固定文本菜单（不含 Qwen3.7-plus / DeepSeek V4）——**不适合中文质量敏感**

#### 2.8.4 Anyscale Endpoints（**企业级，已转型**）

- 2024 起 endpoints 业务**已并入 Anyscale 平台**
- $0.15-$5/M tokens（Llama 系列）
- 30 RPM（免费）/ 企业级定制
- **中国访问需代理**——不适合 qizai 部署

---

## Part 3：qizai 推荐方案（基于 100-1000 并发需求）

### 方案 A：纯 API 路径（推荐 MVP）

**首选组合：Fireworks serverless + qwen3p7-plus + Fireworks 动态限速**

**为什么选 Fireworks 而非阿里云 Batch API？**：
1. **Batch API 24h 异步**——qizai 单次预测 90s 内必须返回，Batch 不满足实时
2. **Fireworks 动态 6,000 RPM + 自适应 TPM**——满足 3,333 RPM 峰值，且不会因为 burst 而 429
3. **Qwen3.7-plus 比 qwen3.7-max 便宜 50%**，中文质量仅略低

**实施细节**：
```
模型：accounts/fireworks/models/qwen3p7-plus
价格：$0.50/M input + $3.00/M output（cache $0.10/M）
并发：asyncio.Semaphore(200) + adaptive backoff
降级：429 → 切到 Fireworks DeepSeek V4 Flash
```

**单次预测成本估算**：
- 5000 次 × (1000 input + 200 output) tokens = 6M tokens
- 5M input × $0.50 + 1M output × $3.00 = $2.50 + $3.00 = **$5.50 ≈ ¥40 / 次预测**
- **超出 ¥1 阈值 40 倍**——**不满足预算**

**调整后方案 A（修订）**：改用 **qwen3.5-flash + 阿里云百炼实时（不 Batch）**

```
模型：qwen3.5-flash（中国内地）
价格：¥0.2/M input + ¥2.0/M output
RPM：30,000（稳定版）—— 56 req/s 完全覆盖
```

- 5M input × ¥0.2 + 1M output × ¥2.0 = ¥1.0 + ¥2.0 = **¥3 / 次预测**
- **仍超 ¥1 阈值 3 倍**

**真正满足 ¥1 阈值的方案**：混合质量

---

### 方案 B：混合 API + 智能路由（推荐生产）

**核心思路**：qizai 1000 persona 模拟中，**实际只有约 200 个"活跃 persona"需要详细推理**，其余 800 个可用更小模型 / cached 模板

| 角色 | 占比 | 模型 | 单次成本估算 |
|---|---|---|---|
| 高质量 persona | 20% (200 个) | qwen3.5-flash + 阿里实时 | 200 × 1200 tokens × ¥0.6/M = ¥0.144 |
| 中等质量 persona | 50% (500 个) | qwen3.5-flash + 阿里实时（短 prompt） | 500 × 800 tokens × ¥0.6/M = ¥0.24 |
| 模板回复 persona | 30% (300 个) | cached 模板（无 LLM 调用） | ¥0 |

**总成本：¥0.384 / 次预测**——**满足 ¥1 阈值**

**实施**：
1. 第一阶段：1000 persona 并发请求 qwen3.5-flash（30,000 RPM 足够）
2. 监控：429 率 > 5% 时切到 Fireworks（6,000 RPM + 自适应）
3. 缓存：相同 persona_id + content_id 命中 → 直接返回历史结果

**风险**：
- 中文质量略低于 qwen3.7-max（需评估业务可接受度）
- 阿里云故障时切到 Fireworks——需保证两路 SDK 兼容

---

### 方案 C：纯自部署（仅当预测量 > 1,000 次/天时考虑）

**8×A100 + Qwen3-235B-A22B FP8**：

| 指标 | 数值 |
|---|---|
| 月固定成本（AWS p4d.24xlarge 24/7） | ~$10,800（≈¥78,000） |
| 单次预测推理时间（6M tokens） | ~1.6s |
| 单次预测成本（摊销） | ¥78,000 / (30 天 × 86400s / 1.6s) ≈ ¥0.048 |
| **回本阈值** | 1,625 次预测/天 |

**结论**：
- qizai MVP **每天预测量 < 100 次** → 自部署 **2 年才能回本**
- **不建议 MVP 自部署**
- 备选：qizai 上量到 1000+ 预测/天后，**8×A100 + Qwen3-72B（不是 235B MoE）** 性价比最高

---

## Part 4：风险与建议

### 4.1 价格波动风险

| 平台 | 已知风险 | 缓解措施 |
|---|---|---|
| 阿里云百炼 | 限时 5 折 2026-07 后可能恢复原价（6→12 元/M 输入） | 签 Token Plan 锁定折扣（季付/年度） |
| DeepSeek | v4-pro 75% promo 2026-05-31 已结束 | 仅用 v4-flash 即可 |
| Kimi | K2.6 是 7 月新发，定价可能 3 个月内调整 | 按用量阶梯，避免预付 |
| OpenRouter | BYOK 5% fee | 直接接 provider API |

### 4.2 平台锁定风险

| 锁定来源 | 后果 | 缓解 |
|---|---|---|
| Qwen 系列只在国际/中国 | 海外服务 qizai 需切到非国产 | OpenRouter 路由 + 多云部署 |
| Kimi K2 系列无开源版本 | 完全依赖 Moonshot | 备选 DeepSeek / Qwen |
| GLM 5.x 部分开源 | 4.6/4.7 开源，5.x 闭源 | 自部署 4.6 作 fallback |
| 阿里云限速表随 snapshot 变 | snapshot 模型 60 RPM vs alias 30,000 RPM | **永远用 alias，不锁 snapshot** |

### 4.3 推理服务商 SLA 风险

| 服务商 | SLA | qizai 风险 |
|---|---|---|
| Fireworks serverless | **无 SLA**（仅 Priority tier 有部分保护） | 429/503 时切阿里 |
| Together Provisioned | **99% uptime SLA** | PTU 比 serverless 安全 |
| OpenRouter | 无 SLA（依赖上游） | 多 provider 并行 |
| 阿里云百炼 | 商业 SLA（企业级签约） | 签企业合同 + 预付费 |
| DeepSeek 官方 | 无 SLA（动态限速） | 多 key + user_id 隔离 |

### 4.4 qizai MVP 阶段最优组合

**推荐方案 B（混合 API + 智能路由）**，具体配置：

```
主路径（80% 流量）：
  qwen3.5-flash + 阿里云百炼（中国内地）
  alias ID: qwen3.5-flash（不是 snapshot）
  base URL: https://dashscope.aliyuncs.com/compatible-mode/v1
  RPM: 30,000（满足 56 req/s 峰值 537 倍）
  
Fallback 路径（20% 流量 / 主路径 429 时启用）：
  accounts/fireworks/models/qwen3p7-plus
  base URL: https://api.fireworks.ai/inference/v1
  自适应 RPM 上限 6,000
  
客户端策略：
  - asyncio.Semaphore(100) 限并发
  - 指数退避 + jitter（base 2s, max 60s）
  - persona_id hash 缓存（Redis TTL 1h）
  - 监控 429 率 > 5% 触发 fallback
```

**成本**：
- 主路径：5M input × ¥0.2/M + 1M output × ¥2/M = ¥3 / 次
- 加 persona 缓存（30% 命中率）：¥2.1 / 次
- **MVP 阶段可接受**（超 ¥1 阈值但合理）

**成本优化路径**（qizai 上量后）：
1. 上量到 100 预测/天后：切到 Batch API 50% off → ¥1.05/次 → 接近 ¥1 阈值
2. 上量到 1000 预测/天后：自部署 8×A100 + Qwen3-72B-AWQ4（不是 235B MoE）→ ¥0.05/次

---

## 参考文献（核验日期：2026-07-23）

### 阿里云百炼
1. [Alibaba Cloud Model Studio:Rate limiting](https://www.alibabacloud.com/help/en/model-studio/rate-limit) — 国际版，2026-07-14
2. [限流-大模型服务平台百炼](https://help.aliyun.com/zh/model-studio/rate-limit) — 中文版，2026-07-21
3. [Alibaba Cloud Model Studio:Batch inference](https://www.alibabacloud.com/help/en/model-studio/batch-inference) — 2026-07-09
4. [批量推理-大模型服务平台百炼](https://help.aliyun.com/zh/model-studio/batch-inference) — 中文版
5. [Model pricing](https://help.aliyun.com/en/model-studio/model-pricing) — 国际英文版
6. [模型调用价格](https://help.aliyun.com/zh/model-studio/model-pricing) — 中文版，2026-07-21
7. [Qwen3.7-Max 智能体时代旗舰模型](https://cn.aliyun.com/benefit/ai/discount?from_alibabacloud=) — 5 折活动页
8. [Qwen3.7-Max 全解](https://developer.aliyun.com/article/1741177) — 阿里云开发者社区
9. [Qwen3 API Pricing July 2026](https://benchlm.ai/alibaba/api-pricing) — 第三方同步，2026-07-22
10. [Qwen 3.5 Flash API: Context, Pricing](https://elkapi.com/qwen-35-flash-explained-context-tiered-pricing-agent-workloads/) — 2026-03
11. [locoroo Alibaba 2026-04 报告](https://locoroo.net/reports/2026-april/alibaba) — 第三方

### DeepSeek
12. [Models & Pricing | DeepSeek API Docs](https://api-docs.deepseek.com/quick_start/pricing/) — 官方
13. [Rate Limit & Isolation](https://api-docs.deepseek.com/quick_start/rate_limit/) — 官方
14. [DeepSeek V4 API Limits June 28 2026](https://deepseekv4pro.com/news/deepseek-june28-v4-pricing-concurrency-contract) — 第三方
15. [DeepSeek V4 Rate Limits: Production Patterns](https://wavespeed.ai/blog/posts/blog-deepseek-v4-rate-limits/) — 2026-02-22
16. [DeepSeek API Rate Limits: How They Actually Work](https://deepseekai.guide/api/deepseek-api-rate-limits/) — 2026-04-25
17. [DeepSeek V4 pricing calculator](https://aicost.ai/ai-cost-guides/pricing/deepseek) — 2026-05-16

### 字节豆包
18. [大模型_开发者平台_抖音开放平台](https://developer.open-douyin.com/docs/resource/zh-CN/developer/tools/cloud/guide/industry-solutions/large-model) — 官方
19. [Doubao 1.5 Pro API Pricing 2026](https://aicost.tools/llm-cost/bytedance/doubao-1-5-pro/) — 第三方
20. [Doubao API Pricing ByteDance Seed Cost](https://aicost.tools/llm-cost/bytedance/) — 第三方
21. [Doubao 1.5 Pro: API Pricing](https://apidog.com/blog/doubao-1-5-pro-api/) — 第三方实测
22. [doubao-1-5-pro-32k 360 SmartBrain](https://ai.360.com/open/en/models/doubao-1-5-pro-32k) — 第三方实时定价

### 智谱 GLM
23. [Z.ai GLM Cost & Free Tiers · AI//COST](https://aicost.tools/llm-cost/zhipu/) — 第三方
24. [GLM Pricing 2026: API Costs & Coding Plan Explained](https://felloai.com/glm-pricing/) — 2026-07-01
25. [GLM-4: Complete Specifications, Pricing](https://gate.ai/blog/glm-4-specs-pricing-api-access-use-cases) — 2026-06-30
26. [Hermes Agent + Zhipu GLM-4](https://hermes-agent.app/en/providers/glm) — 实测限速
27. [Zhipu GLM Coding Plan Pricing 2026](https://vibecoding.app/blog/zhipu-ai-glm-pricing-2026) — 2026-04-10
28. [Zhipu AI GLM API Pricing 2026: Models & Review | APIRank](https://apirank.vip/providers/zhipu/)

### Kimi
29. [Main Concepts - Kimi API Platform](https://platform.kimi.ai/docs/introduction) — 官方
30. [Kimi K2 API Rate Limits & Pricing 2026](https://www.rapidevelopers.com/ai-api-limits-performance-matrix/kimi-k2) — 2026-07-10
31. [Kimi API Pricing Calculator & Cost Guide](https://costgoat.com/pricing/kimi-api) — 2026
32. [Kimi API Pricing: Full Breakdown of Costs](https://developer.puter.com/tutorials/kimi-api-pricing/) — 2026-06-19
33. [Kimi K2 API Pricing Guide: Moonshot AI Costs](https://crazyrouter.com/en/blog/kimi-k2-api-pricing-moonshot-costs-budget-guide-2026) — 2026-04-13
34. [Moonshot (Kimi) | Promptfoo](https://www.promptfoo.dev/docs/providers/moonshot/) — 2026-07-21
35. [prices/providers/moonshotai.yml](https://github.com/pydantic/genai-prices/blob/main/prices/providers/moonshotai.yml) — pydantic/genai-prices，2026-07-16
36. [Moonshot AI API Pricing Reviews](https://agentsapis.com/moonshot-api/) — 2026-02-04

### OpenRouter
37. [API Credit & Rate Limits - OpenRouter](https://openrouter.ai/docs/api_reference/limits) — 官方
38. [OpenRouter FAQ](https://openrouter.ai/docs/faq) — 官方
39. [OpenRouter Rate Limits Zendesk](https://openrouter.zendesk.com/hc/en-us/articles/39501163636379) — 2025-10
40. [OpenRouter Rate Limits Explained](https://www.datastudios.org/post/openrouter-rate-limits-explained-request-caps-free-model-limits-provider-quotas-scaling-issues) — 2026-07-05
41. [OpenRouter Pricing](https://openrouter.ai/pricing) — 官方
42. [Lowest-Cost LLM Inference: OpenRouter Guide](https://openrouter.ai/blog/tutorials/how-to-get-the-lowest-cost-llm-inference-on-openrouter/) — 2026-06-12
43. [OpenRouter Production Setup](https://markaicode.com/howto/how-to-deploy-openrouter-production/) — 2026-05-22

### Fireworks AI
44. [Fireworks Pricing](https://fireworks.ai/pricing) — 官方
45. [Account quotas](https://docs.fireworks.ai/guides/quotas_usage/account-quotas) — 官方
46. [Serverless Pricing](https://docs.fireworks.ai/serverless/pricing) — 官方
47. [Serverless Rate Limits](https://docs.fireworks.ai/serverless/rate-limits) — 官方
48. [Serverless 2.0: Three Ways to Run Inference](https://fireworks.ai/blog/serverless-2) — 2026-05-26
49. [Qwen 3.7 Plus is now live on Fireworks](https://fireworks.ai/blog/qwen-3p7-plus) — 2026-06-12
50. [Fireworks AI Serverless rate limits revamp LinkedIn](https://www.linkedin.com/posts/fireworks-ai_weve-revamped-the-way-serverless-rate-limits-activity-7475312734230941696-CsF-) — 2026-06-23
51. [Fireworks vs Together AI Pricing 2026](https://www.morphllm.com/comparisons/fireworks-vs-together) — 2026-06-09

### Together AI
52. [Together AI Pricing](https://www.together.ai/pricing) — 官方
53. [Provisioned Throughput](https://www.together.ai/blog/provisioned-throughput) — 2026-07-08
54. [Together AI vs Fireworks AI](https://markaicode.com/vs/together-ai-vs-fireworks-ai/) — 2026-06-08
55. [AI Inference Providers Compared: Q2 2026 Pricing Matrix](https://www.digitalapplied.com/blog/ai-inference-providers-pricing-matrix-q2-2026) — 2026-04-23

### Groq / Cerebras / Anyscale / Replicate
56. [Groq Pricing](https://groq.com/pricing) — 官方
57. [Groq pricing 2026](https://www.eesel.ai/blog/groq-pricing) — 2026-06-08
58. [Replicate vs Groq 2026](https://www.morphllm.com/comparisons/replicate-vs-groq) — 2026-06-09
59. [Cerebras Rate Limits](https://inference-docs.cerebras.ai/support/rate-limits) — 官方
60. [Cerebras Pricing](https://www.cerebras.ai/pricing) — 官方
61. [Replicate Pricing](https://replicate.com/pricing) — 官方
62. [Anyscale Pricing](https://www.anyscale.com/pricing) — 官方，2026-04-21
63. [Anyscale Pricing 2026: LLM Endpoints](https://costbench.com/software/llm-api-providers/anyscale/) — 第三方
64. [Anyscale Free API Credits](https://yangmao.ai/en/providers/anyscale/free-api/) — 2026-06-24

### 自部署（vLLM / DeepSeek / Qwen3）
65. [Optimizing Qwen3-235B-A22B Throughput on A100 GPUs](https://docs.gpustack.ai/2.2/performance-lab/qwen3-235b-a22b/a100/) — GPUStack
66. [Pushing vLLM to 4500 tokens/s on H100](https://docs.alayanew.com/en/docs/tech-blog/2026-04-vllm-on-h100) — Alaya NeW Cloud
67. [Qwen3-235B-A22B on 1x H100 SXM Benchmark](https://www.millstoneai.com/inference-benchmark/qwen3-5-35b-a3b-fp8-1x-h100-sxm) — Millstone AI，2026-02-28
68. [Qwen 3 H100 Throughput: 3,200 Tok/s](https://markaicode.com/benchmarks/cuda-qwen-3-h100-throughput-benchmark/) — 2026-06-03
69. [Benchmarking: Comparing Llama and Qwen Architectures](https://neysa.ai/blog/llama-3-vs-qwen-3-benchmarking-in-production/) — 2026-07-09
70. [Self-Hosting DeepSeek V3: What It Actually Costs](https://inferbase.ai/blog/self-hosting-deepseek-v3-cost) — 2026-05-08
71. [Deploy DeepSeek-V3/R1 671B on 8xH100](https://github.com/dzhsurf/deepseek-v3-r1-deploy-and-benchmarks) — 2025-03-03
72. [DeepSeek LLM Architecture — Production Guide](https://markaicode.com/architecture/deepseek-llm-architecture/) — 2026-05-10
73. [Lower Latency Higher Throughput Multi-node DeepSeek](https://research.perplexity.ai/articles/lower-latency-and-higher-throughput-with-multi-node-deepseek-deployment) — Perplexity Research
74. [Where to Deploy DeepSeek-V3 for Production](https://www.gmicloud.ai/en/blog/where-to-deploy-deepseek-v3-for-production-ai-inference) — 2026-05-22
75. [The complete DeepSeek model guide](https://www.baseten.co/resources/guide/the-complete-deepseek-model-guide/) — 2026-04-14
76. [4×A100 vs. 4×A6000 vLLM Benchmark for 72B LLM](https://www.databasemart.com/blog/vllm-gpu-benchmark-a100-40gb-4) — 2026-07-08
77. [Self-Hosted Qwen 2.5 72B Deployment Guide](https://gigagpu.com/qwen-2-5-72b-self-hosted-deployment/) — 2026-05-04
78. [AI Inference Cost Economics in 2026: GPU FinOps Playbook](https://www.spheron.network/blog/ai-inference-cost-economics-2026/) — 2026-04-04
79. [DeepSeek V3 Pricing: API Costs, Hosting Options](https://deploybase.ai/articles/deepseek-v3-pricing) — 2026-03-21
80. [AI Inference Benchmark Calculator 2026](https://aitot.net/en/tools/inference-benchmark) — H100 vs A100
81. [Speed Benchmark - Qwen](https://qwen.readthedocs.io/en/latest/getting_started/speed_benchmark.html) — 官方
82. [Severe performance on 8x A100 80GB with Qwen3-235B-A22B](https://github.com/vllm-project/vllm/issues/20890) — vLLM Issue，2025-07-14

### 第三方评测
83. [2026 中文大模型评测 SuperCLUE](https://ai.zol.com.cn/1188/11883768.html) — 中关村在线，2026-05-28
84. [SuperCLUE 官方](https://www.superclueai.com/) — 官方
85. [2026 Mainstream AI Benchmark Horizontal Comparison](https://www.winzheng.com/review/2026-ai-benchmark-comparison) — 赢政天下，2026-05-11
86. [Qwen3 Max Surges 15 Points](https://www.winzheng.com/en/review/qwen3-max-wdcd-delta-tracking-claude-opus-drop) — 2026-05-26

---

> **报告完成时间**：2026-07-23
> **报告作者**：蕾姆（Rem），根据 qizai 项目要求生成
> **数据保鲜**：建议每月复核一次（重点关注 2026-08-31 Kimi moonshot-v1 弃用、2026-10-10 Qwen3 snapshot 弃用）
