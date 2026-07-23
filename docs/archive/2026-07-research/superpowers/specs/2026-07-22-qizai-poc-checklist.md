# qizai PoC 前置验证 Checklist

**日期**：2026-07-22
**目标**：在进入 writing-plans 之前，用 1-2 周时间消除 Spec v0.2 的残留不确定性
**负责人**：蕾姆 + 独立核验 subagent

---

## 验证项总览（按优先级）

| # | 验证项 | 优先级 | 负责人 | 预计时长 | 完成标准 |
|---|--------|--------|--------|---------|---------|
| 1 | Synthetic Users 真实定价 | 🔴 P0 | verify-syn-users-pricing subagent | 3-5 天 | 拿到 3 个独立来源的定价数据 |
| 2 | 首批 3 家 MCN 接触 + Demo | 🔴 P0 | 蕾姆 + 昴君 | 1-2 周 | 至少 1 家 MCN 表达签约意向 |
| 3 | 1000 persona 性能 PoC | 🟡 P1 | tech-poc subagent | 3-5 天 | 实测 CPU 时间 + LLM 成本 |
| 4 | 三大陷阱参数 PoC | 🟡 P1 | research-poc subagent | 5-7 天 | DIVERSITY_THRESHOLD、TAIL_RATIO 等 4 个数字校准 |
| 5 | Synthetic Users 85-92% parity 独立验证 | 🟢 P2 | verify-parity subagent | 3-5 天 | 拿到 1 篇独立第三方评测 |

---

## 验证项 #1：Synthetic Users 真实定价（🔴 P0）

### 目标
消除 Spec v0.2 §6.4 "Synthetic Users ¥500+/次" 的传闻依赖，拿到权威定价。

### 核验路径（4 路并行）
1. **官网定价页**：直接访问 synthetic-users.com/pricing 或 pricing 子页面
2. **YC W25 数据库**：通过 YC Bookface / YC OSS API 查到 Synthetic Users 的 batch + deal terms
3. **用户间接验证**：Reddit r/ycombinator、r/MachineLearning、G2/Capterra 评论
4. **直接询问**：通过官网 contact form 或 hello@synthetic-users.com 邮件询问（虚构测试场景，避免暴露 qizai）

### 输出
- `pricing-data.json`：{ tier, price, billing_cycle, features, source }
- 至少 3 个独立来源印证
- 标注每个数字的来源 URL + 截图时间戳

### 完成判定
- ✅ 拿到 3 个独立来源 + 至少 2 个 tier 的具体定价
- ⚠️ 仅拿到 1 个来源 / 仅有区间 → 标记为"区间估算"
- ❌ 完全拿不到 → 标记为"数据缺失"，qizai 定价策略按"国际同类上浮 50%" 兜底

---

## 验证项 #2：首批 3 家 MCN 接触 + Demo（🔴 P0）

### 目标
将 N=5 MCN 访谈的"需求真实"假设升级为"签约意向真实"。

### 接触清单（建议）
- [ ] MCN-A（已访谈）：发出 Demo 邀请（用 qizai 模拟 1 条小红书内容）
- [ ] MCN-B（已访谈）：同上
- [ ] MCN-C（已访谈）：同上
- [ ] MCN-D（未访谈，行业群触达）：陌生拜访 + Demo
- [ ] MCN-E（未访谈，熟人介绍）：通过昴君人脉触达

### Demo 内容设计
- 选 3 条真实小红书内容（提前 1 周采集）
- qizai 输出：CTR 预测 + 3 秒留存预测 + 5 条优化建议
- 对比 MCN 内部运营经验，看预测准确度

### 输出
- `mcn-demo-feedback.md`：每家 MCN 的反馈 + 签约意向 + 报价敏感度
- 至少 1 家 MCN 表达"愿意为 ¥5000+/月 试用" 才算 PoC 通过

### 完成判定
- ✅ 至少 1 家 MCN 愿意试用 → 进入 writing-plans
- ⚠️ 3 家观望，无人签约 → 标记为"教育成本高"，需调整 BD 策略
- ❌ 0 兴趣 → Spec §2.7 假设证伪，**应暂停 qizai 推进**

---

## 验证项 #3：1000 persona 性能 PoC（🟡 P1）

### 目标
验证 Spec §2.5 的"CPU 即可 + 5-15 分钟 + ¥2.68-3.45" 假设。

### PoC 设计
```python
# 单条内容 1000 persona 模拟 PoC
content = "测试小红书笔记: 三招教你选对洗面奶"
personas = load_chinese_personas(n=1000)  # OCEAN + 兴趣标签

# 三档 LLM 对比
for provider in ["qwen-plus", "MiniMax-M3", "DeepSeek-V3"]:
    start = time.time()
    results = simulate(content, personas, provider=provider, rounds=1)
    elapsed = time.time() - start
    cost = calculate_cost(results, provider=provider)
    log(f"{provider}: {elapsed:.1f}s, ¥{cost:.2f}")
```

### 输出
- `poc-1000-persona-results.md`：三档 LLM 实测对比
- 至少跑 5 条不同类型内容（美妆 / 美食 / 职场 / 萌宠 / 旅游）

### 完成判定
- ✅ 实测时间在 5-15 分钟，成本 ¥2-4 → 进入 writing-plans
- ⚠️ 实测时间 > 30 分钟或成本 > ¥8 → 需优化（减少 persona 或换 LLM）
- ❌ 失败（如超时 / OOM）→ 需重构架构

---

## 验证项 #4：三大陷阱参数 PoC（🟡 P1）

### 目标
校准 Spec §3 的 4 个关键数字。

### 待校准数字
1. `DIVERSITY_THRESHOLD = 0.15` —— 100 条样本的真实分布
2. `TAIL_PERSONA_RATIO = 0.3` —— 不同比例对极端意见捕捉率的影响
3. `temperature = 0.7~0.9` —— MiniMax-M3 + DeepSeek-V3 上的最优区间
4. 多样性熔断机制的实际触发率（避免频繁熔断）

### PoC 设计
```python
# 用 50 条真实小红书评论作为 ground truth
ground_truth = load_xhs_comments(n=50)

# 对每个参数跑 3 档实验
for param_name, values in [
    ("DIVERSITY_THRESHOLD", [0.10, 0.15, 0.20]),
    ("TAIL_PERSONA_RATIO", [0.1, 0.2, 0.3, 0.4]),
    ("temperature", [0.5, 0.7, 0.9]),
]:
    for v in values:
        accuracy = simulate_with_param(personas, ground_truth, param_name, v)
        log(f"{param_name}={v}: accuracy={accuracy:.2%}")
```

### 输出
- `poc-trap-params.md`：每个参数的最优值 + 推荐范围
- 至少给出"DIVERSITY_THRESHOLD 应该落在 [a, b]" 这种带区间的结论

### 完成判定
- ✅ 拿到 4 个参数的最优区间 → 写入 Spec v0.3
- ⚠️ 部分参数无显著差异 → 保留默认值
- ❌ 三大陷阱无法有效缓解 → 架构层面需重构

---

## 验证项 #5：Synthetic Users 85-92% parity 独立验证（🟢 P2）

### 目标
核验 Spec §5.1 Synthetic Users "85-92% parity" 的数字来源。

### 核验路径
1. 找到 Synthetic Users 官方博客 / 论文 / 评测
2. 找到第三方独立评测（如学术论文、G2 评论、技术博客）
3. 区分"官方自评"vs"独立评测"

### 输出
- `syn-users-parity-evidence.md`：每个数字的来源 + 评测方法 + 样本量
- 区分自评 vs 独立评测

### 完成判定
- ✅ 拿到独立第三方评测 → 数字可信
- ⚠️ 仅官方自评 → 标记"未独立验证"
- ❌ 找不到 → 在 Spec 中删除此数字

---

## 时间表

| 周次 | 任务 | 状态 |
|------|------|------|
| 第 1 周 | 验证项 #1（Synthetic Users 定价）并行 #2（MCN Demo） | 待启动 |
| 第 2 周 | 验证项 #3（1000 persona PoC）并行 #4（三大陷阱参数 PoC） | 排期 |
| 第 2-3 周 | 验证项 #5（parity 独立验证）| 排期 |
| 第 3 周末 | PoC 前置验证完成 → 进入 writing-plans | 目标 |

---

## 中止条件（任一触发即暂停 qizai）

| 触发条件 | 后果 |
|---------|------|
| 验证项 #1 拿不到任何 Synthetic Users 定价 | qizai 定价策略改为"对标海外 ¥500+/次"，但承认数据不足 |
| 验证项 #2 0 家 MCN 愿意试用 | **暂停 qizai**，回到 Spec §2.7 重新审视商业模式 |
| 验证项 #3 性能 PoC 失败 | 架构层面需重构（拆分 OASIS 微服务） |
| 验证项 #4 三大陷阱无法缓解 | 仿真质量不可用，需另寻技术路线 |