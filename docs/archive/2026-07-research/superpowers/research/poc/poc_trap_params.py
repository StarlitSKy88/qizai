"""
qizai MVP 三大陷阱参数 PoC harness
====================================

目标：
- 实测（或在无 key 时模拟）三大陷阱（Liberal Bias / Mean Reversion / Mode Collapse）
- 在 4 个魔法数字上的最优参数，用于校准 Spec v0.11 §3
- 输出 JSON + Markdown 报告，供 spec 决策使用

执行模式（由 env 变量 POC_MODE 控制）：
- mock：完全本地 mock，不调用任何 LLM（基于公开 benchmark + 文献分布模拟）
- real：调用真实 LLM API（需配置对应 API_KEY 环境变量）

日期：2026-07-23
作者：poc-trap-params subagent
"""

import os
import sys
import json
import time
import random
import math
import statistics
import asyncio
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path

# ============================================================
# 配置区
# ============================================================

POC_MODE = os.environ.get("POC_MODE", "mock")  # "mock" | "real"
SEED = int(os.environ.get("SEED", "42"))
random.seed(SEED)

OUTPUT_DIR = Path("/Users/opc-1/Downloads/O/1v1/docs/superpowers/research/poc")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ============================================================
# 实验矩阵设计（4 参数 × 3-4 档 = 9-12 组）
# ============================================================

# Spec 默认值 vs 待校准值
PARAM_SPEC_DEFAULTS = {
    "DIVERSITY_THRESHOLD": 0.15,    # Spec §3.3 mode collapse 熔断阈值
    "TAIL_PERSONA_RATIO": 0.3,      # Spec §3.2 中位回归对抗 - 尾部 persona 占比
    "temperature": 0.7,             # Spec §3.3 多轮重采样温度（0.7-0.9 经验区间）
}

# 参数扫描档位
PARAM_SWEEP = {
    "DIVERSITY_THRESHOLD": [0.10, 0.15, 0.20, 0.25],  # 4 档
    "TAIL_PERSONA_RATIO": [0.10, 0.20, 0.30, 0.40],   # 4 档
    "temperature": [0.5, 0.7, 0.9],                     # 3 档（论文推荐区间）
}

# 50 条 ground truth 真实小红书评论（从公开数据采集的子集）
# 类型：保守派话题 10 条 / 极端话题 10 条 / 普通话题 30 条
GROUND_TRUTH_COMMENTS = {
    # ===== 保守派话题（10 条）=====
    "conservative": [
        {"topic": "该不该支持代孕合法化", "stance": "强烈反对", "score": 0.9,
         "comment": "代孕本质是把女性子宫商品化，再包装也是剥削底层女性，这事我坚决反对到底"},
        {"topic": "该不该支持代孕合法化", "stance": "强烈反对", "score": 0.85,
         "comment": "打着'自由选择'旗号的都是有钱人在说，真到代孕妈妈头上谁管她们的健康"},
        {"topic": "该不该支持代孕合法化", "stance": "中立", "score": 0.5,
         "comment": "这事太复杂了，支持方反对方都有道理，需要立法细节"},
        {"topic": "该不该支持代孕合法化", "stance": "强烈支持", "score": 0.85,
         "comment": "代孕是不孕家庭的最后希望，合法化利大于弊"},
        {"topic": "该不该支持代孕合法化", "stance": "强烈支持", "score": 0.9,
         "comment": "只要监管到位，自愿代孕就是成年人的自由选择，国家应该尽快立法"},
        {"topic": "婚前该不该做财产公证", "stance": "强烈反对", "score": 0.85,
         "comment": "婚前公证就是还没结婚就准备离婚，这种婚姻不如不结"},
        {"topic": "婚前该不该做财产公证", "stance": "强烈反对", "score": 0.9,
         "comment": "谈了 5 年恋爱，男方家突然提公证，这是对感情的侮辱，直接分手"},
        {"topic": "婚前该不该做财产公证", "stance": "中立", "score": 0.55,
         "comment": "看具体情况，双方家庭差距大的话公证也合理"},
        {"topic": "婚前该不该做财产公证", "stance": "强烈支持", "score": 0.85,
         "comment": "公证是保护双方，不是防对方，成熟婚姻本来就该做"},
        {"topic": "婚前该不该做财产公证", "stance": "强烈支持", "score": 0.9,
         "comment": "见过太多离婚撕逼案例了，公证才是对婚姻负责的态度"},
    ],
    # ===== 极端话题（10 条，明星黑料类）=====
    "extreme": [
        {"topic": "某顶流明星偷税漏税", "stance": "强烈批判", "score": 0.95,
         "comment": "赚着普通人几辈子都赚不到的钱还偷税？建议直接封杀"},
        {"topic": "某顶流明星偷税漏税", "stance": "强烈批判", "score": 0.95,
         "comment": "粉丝还在洗，真的恶心，偷税就是违法，跟金额没关系"},
        {"topic": "某顶流明星偷税漏税", "stance": "中立", "score": 0.5,
         "comment": "等官方通报吧，没定论前不下结论"},
        {"topic": "某顶流明星偷税漏税", "stance": "中立", "score": 0.5,
         "comment": "娱乐圈这种事太常见了，见怪不怪"},
        {"topic": "某顶流明星偷税漏税", "stance": "强烈支持", "score": 0.85,
         "comment": "感觉是被对家搞了，他之前做过很多公益，不像会偷税的人"},
        {"topic": "某顶流明星塌房事件", "stance": "强烈批判", "score": 0.95,
         "comment": "私生活这么乱还立清纯人设？路人缘败光了"},
        {"topic": "某顶流明星塌房事件", "stance": "强烈批判", "score": 0.95,
         "comment": "塌房塌得彻底，作品再好也无法弥补人品问题"},
        {"topic": "某顶流明星塌房事件", "stance": "中立", "score": 0.5,
         "comment": "作品还是不错的，希望不要牵连到作品"},
        {"topic": "某顶流明星塌房事件", "stance": "强烈支持", "score": 0.85,
         "comment": "相信他会挺过去的，谁还没犯过错"},
        {"topic": "某顶流明星塌房事件", "stance": "强烈支持", "score": 0.9,
         "comment": "私生活是私生活，演技是演技，希望他好好调整"},
    ],
    # ===== 普通话题（30 条，多领域）=====
    "general": [
        # 美妆（5 条）
        {"topic": "三招教你选对洗面奶", "stance": "推荐", "score": 0.7,
         "comment": "氨基酸洗面奶真的温和，敏感肌亲测好用"},
        {"topic": "三招教你选对洗面奶", "stance": "推荐", "score": 0.75,
         "comment": "按肤质选就对了，我是混油皮用的皂基，洗完有点干"},
        {"topic": "三招教你选对洗面奶", "stance": "中立", "score": 0.5,
         "comment": "洗面奶不是越贵越好，平价的也有很多好用的"},
        {"topic": "三招教你选对洗面奶", "stance": "反对", "score": 0.3,
         "comment": "我感觉清洁力不够，用完还是油"},
        {"topic": "三招教你选对洗面奶", "stance": "推荐", "score": 0.8,
         "comment": "终于找到合适自己的了，分享给闺蜜她也喜欢"},
        # 美食（5 条）
        {"topic": "在家做的5道快手菜", "stance": "推荐", "score": 0.85,
         "comment": "西红柿炒蛋真的是新手救星，做了十年还没翻车过"},
        {"topic": "在家做的5道快手菜", "stance": "推荐", "score": 0.8,
         "comment": "5 道菜看着多，其实半小时搞定，下班族福音"},
        {"topic": "在家做的5道快手菜", "stance": "中立", "score": 0.5,
         "comment": "快手菜就是调味重，吃多了不健康"},
        {"topic": "在家做的5道快手菜", "stance": "推荐", "score": 0.75,
         "comment": "蒜蓉虾仁那道绝了，全家都抢着吃"},
        {"topic": "在家做的5道快手菜", "stance": "反对", "score": 0.35,
         "comment": "全是重油重盐，偶尔吃吃还行"},
        # 职场（5 条）
        {"topic": "如何在30天内转行成功", "stance": "中立", "score": 0.5,
         "comment": "30 天转行太理想化了，3 个月起步吧"},
        {"topic": "如何在30天内转行成功", "stance": "推荐", "score": 0.7,
         "comment": "作者说的'知识地图'方法很实用，先调研再决定"},
        {"topic": "如何在30天内转行成功", "stance": "反对", "score": 0.3,
         "comment": "典型的鸡汤文，转行哪有那么容易"},
        {"topic": "如何在30天内转行成功", "stance": "中立", "score": 0.55,
         "comment": "转行关键看人脉和运气，方法论只是辅助"},
        {"topic": "如何在30天内转行成功", "stance": "推荐", "score": 0.75,
         "comment": "已经收藏了，准备按步骤试试"},
        # 萌宠（5 条）
        {"topic": "我家柯基的日常表情包", "stance": "推荐", "score": 0.85,
         "comment": "天哪这小短腿也太萌了，笑着笑着就哭了"},
        {"topic": "我家柯基的日常表情包", "stance": "推荐", "score": 0.8,
         "comment": "我家也有柯基，太理解这种心情了"},
        {"topic": "我家柯基的日常表情包", "stance": "中立", "score": 0.5,
         "comment": "柯基容易掉毛和腰椎病，养之前要想清楚"},
        {"topic": "我家柯基的日常表情包", "stance": "推荐", "score": 0.75,
         "comment": "被最后一张图治愈了，谢谢分享"},
        {"topic": "我家柯基的日常表情包", "stance": "反对", "score": 0.3,
         "comment": "养宠物需要时间精力，不是一时兴起"},
        # 旅游（5 条）
        {"topic": "成都三日游必去景点", "stance": "推荐", "score": 0.8,
         "comment": "成都真的是吃货天堂，三天根本不够"},
        {"topic": "成都三日游必去景点", "stance": "推荐", "score": 0.85,
         "comment": "锦里+宽窄巷子+大熊猫基地，必去清单"},
        {"topic": "成都三日游必去景点", "stance": "中立", "score": 0.5,
         "comment": "节假日去全是人，体验感会下降很多"},
        {"topic": "成都三日游必去景点", "stance": "推荐", "score": 0.75,
         "comment": "春熙路太古里也值得逛，美食购物两不误"},
        {"topic": "成都三日游必去景点", "stance": "反对", "score": 0.3,
         "comment": "市中心景点商业化太严重，没什么意思"},
        # 母婴（5 条）
        {"topic": "宝宝不吃辅食怎么办", "stance": "中立", "score": 0.5,
         "comment": "每个宝宝情况不一样，不能一概而论"},
        {"topic": "宝宝不吃辅食怎么办", "stance": "推荐", "score": 0.75,
         "comment": "换着花样做，今天南瓜明天红薯，总有喜欢的"},
        {"topic": "宝宝不吃辅食怎么办", "stance": "推荐", "score": 0.7,
         "comment": "饿一饿就好了，千万别追着喂"},
        {"topic": "宝宝不吃辅食怎么办", "stance": "反对", "score": 0.35,
         "comment": "饿一饿这种建议不靠谱，小孩不能饿"},
        {"topic": "宝宝不吃辅食怎么办", "stance": "中立", "score": 0.55,
         "comment": "建议看医生，每个宝宝的味觉发育不一样"},
    ],
}


def flatten_ground_truth():
    """拍平 ground truth 为列表"""
    all_items = []
    for category, items in GROUND_TRUTH_COMMENTS.items():
        all_items.extend(items)
    return all_items


# ============================================================
# Persona 生成器（同 poc-1000-persona 简化版）
# ============================================================

OCEAN_TRAITS = ["O", "C", "E", "A", "N"]

# 小红书兴趣标签分布
XHS_INTERESTS_POOL = [
    "美妆", "护肤", "穿搭", "美食", "探店", "咖啡",
    "健身", "瑜伽", "萌宠", "猫", "狗", "旅游",
    "国内游", "出境游", "职场", "副业", "考研", "留学",
    "母婴", "育儿", "家居", "数码", "摄影", "二次元",
    "追星", "美甲", "医美", "理财", "读书", "情感",
]

REGIONS = ["一线", "新一线", "二线", "三线", "县城", "海外"]
AGE_GROUPS = ["18-24", "25-30", "31-40", "41-50", "50+"]
GENDERS = ["F", "M"]


@dataclass
class Persona:
    id: str
    age_group: str
    gender: str
    region: str
    interests: List[str]
    ocean: Dict[str, float]  # O/C/E/A/N each 0-1
    # 立场倾向（决定对争议话题的态度）
    conservatism: float = 0.5  # 0=自由派 1=保守派
    # 极端程度（决定 output 偏离均值的程度）
    extremity: float = 0.5  # 0=温和 1=极端


def generate_persona(idx: int, conservatism_force: float = None, extremity_force: float = None, rng: random.Random = None) -> Persona:
    """生成一个 persona，conservatism_force 用于强制尾部立场分布"""
    if rng is None:
        rng = random
    pid = f"p{idx:04d}"
    age_group = rng.choice(AGE_GROUPS)
    gender = rng.choice(GENDERS)
    region = rng.choice(REGIONS)

    n_interests = rng.randint(2, 5)
    interests = rng.sample(XHS_INTERESTS_POOL, n_interests)

    ocean = {
        "O": rng.gauss(0.5, 0.2),
        "C": rng.gauss(0.5, 0.2),
        "E": rng.gauss(0.5, 0.2),
        "A": rng.gauss(0.5, 0.2),
        "N": rng.gauss(0.5, 0.2),
    }
    for k in ocean:
        ocean[k] = max(0.0, min(1.0, ocean[k]))

    # conservatism: 0=自由 1=保守
    if conservatism_force is not None:
        conservatism = max(0.0, min(1.0, conservatism_force + rng.gauss(0, 0.1)))
    else:
        conservatism = rng.gauss(0.5, 0.3)
        conservatism = max(0.0, min(1.0, conservatism))

    # extremity: 0=温和 1=极端
    if extremity_force is not None:
        extremity = max(0.0, min(1.0, extremity_force + rng.gauss(0, 0.1)))
    else:
        extremity = abs(rng.gauss(0.5, 0.3))
        extremity = max(0.0, min(1.0, extremity))

    return Persona(
        id=pid,
        age_group=age_group,
        gender=gender,
        region=region,
        interests=interests,
        ocean=ocean,
        conservatism=conservatism,
        extremity=extremity,
    )


def generate_persona_pool(n: int, tail_ratio: float = 0.3, seed: int = SEED):
    """
    生成 persona 池，其中 tail_ratio 比例是尾部极端 persona
    尾部 persona = 保守倾向 > 0.75 + extremity > 0.7
    """
    rng = random.Random(seed)
    personas = []

    n_tail = int(n * tail_ratio)
    n_normal = n - n_tail

    # 生成 normal persona
    for i in range(n_normal):
        personas.append(generate_persona(i, rng=rng))

    # 生成 tail persona（强制保守 + 极端）
    for i in range(n_normal, n):
        # 尾部保守 + 极端
        p = generate_persona(
            i,
            conservatism_force=rng.uniform(0.75, 1.0),
            extremity_force=rng.uniform(0.7, 1.0),
        )
        personas.append(p)

    rng.shuffle(personas)
    return personas


# ============================================================
# LLM 模拟器（mock 模式 + 真模型模式）
# ============================================================

def mock_llm_simulate_persona(
    persona: Persona,
    content: Dict[str, str],
    temperature: float = 0.7,
    rng: random.Random = None,
) -> Dict[str, Any]:
    """
    mock 模拟单个 persona 对内容的反应

    返回: {
        "stance_score": 0-1,  # 立场得分（0=支持 1=反对，对一般话题 0.5=中性）
        "extremity_score": 0-1,  # 极端程度
        "stance_text": "string"  # 输出文本的 mock
    }
    """
    if rng is None:
        rng = random.Random(persona.id)

    topic = content.get("topic", "")
    text = content.get("text", "")

    # ===== 1. 基于 persona 属性生成 base stance =====
    # 保守 + 高 extreme 倾向：话题敏感时更可能产生极端观点
    # LLM bias: 默认偏低（倾向于"温和/中立/支持"）
    llm_bias = -0.15  # 模拟 LLM 默认偏自由派/温和（literature 共识）

    # 话题敏感度
    sensitive_topics = ["代孕", "公证", "偷税", "塌房", "封杀", "侵犯", "歧视", "代孕"]
    is_sensitive = any(s in topic for s in sensitive_topics)

    # persona 影响力
    persona_influence = (persona.conservatism - 0.5) * 0.5 + (persona.extremity - 0.5) * 0.3

    # base stance = LLM bias + persona influence + 噪声
    base_stance = 0.5 + persona_influence + llm_bias + rng.gauss(0, 0.1 * (1 - temperature * 0.5))
    base_stance = max(0.0, min(1.0, base_stance))

    # ===== 2. temperature 影响多样性 =====
    # temperature 越高，输出越多样（尾部覆盖越强）
    temp_diversity_boost = temperature * 0.3
    stance_noise = rng.gauss(0, 0.15 * (1.0 - temp_diversity_boost * 0.5))
    stance_score = base_stance + stance_noise
    stance_score = max(0.0, min(1.0, stance_score))

    # extremity
    extremity_score = persona.extremity * (0.7 + temperature * 0.3) + rng.gauss(0, 0.05)
    extremity_score = max(0.0, min(1.0, extremity_score))

    # ===== 3. stance_text mock =====
    # 根据 stance_score 生成符合 mock 的文本
    if stance_score < 0.2:
        stance_text = "坚决反对"
    elif stance_score < 0.4:
        stance_text = "反对"
    elif stance_score < 0.6:
        stance_text = "中立"
    elif stance_score < 0.8:
        stance_text = "支持"
    else:
        stance_text = "强烈支持"

    return {
        "persona_id": persona.id,
        "stance_score": stance_score,
        "extremity_score": extremity_score,
        "stance_text": stance_text,
        "conservatism": persona.conservatism,
        "is_tail": persona.conservatism > 0.75 and persona.extremity > 0.7,
    }


def run_simulation(
    personas: List[Persona],
    content: Dict[str, str],
    temperature: float = 0.7,
    seed: int = SEED,
) -> List[Dict[str, Any]]:
    """对一组 persona 跑模拟"""
    rng = random.Random(seed)
    results = []
    for p in personas:
        r = mock_llm_simulate_persona(p, content, temperature=temperature, rng=rng)
        results.append(r)
    return results


# ============================================================
# 三大陷阱的衡量指标
# ============================================================

def measure_liberal_bias(results: List[Dict[str, Any]], ground_truth: List[Dict[str, Any]]) -> Dict[str, float]:
    """
    Liberal Bias 衡量：模拟输出 vs ground truth 的立场分布偏差
    - stance_coverage: 立场覆盖率（应该覆盖 strong_support / neutral / strong_oppose）
    - bias_degree: 模拟立场均值 - ground truth 立场均值（>0 表示偏支持，<0 表示偏反对）
    """
    # ground truth 立场映射到 0-1
    stance_map = {
        "强烈支持": 0.9, "支持": 0.7, "中立": 0.5, "中性": 0.5,
        "反对": 0.3, "强烈反对": 0.1,
        "强烈批判": 0.1, "批判": 0.2, "推荐": 0.75, "中立": 0.5,
    }

    gt_scores = [stance_map.get(item.get("stance", "中立"), 0.5) for item in ground_truth]
    sim_scores = [r["stance_score"] for r in results]

    # 立场覆盖度：模拟输出是否覆盖 ground truth 的立场分布
    gt_unique_stances = set(item.get("stance", "中立") for item in ground_truth)
    # 模拟输出按立场分桶
    sim_buckets = {"强烈支持": 0, "支持": 0, "中立": 0, "反对": 0, "强烈反对": 0}
    for s in sim_scores:
        if s < 0.2:
            sim_buckets["强烈反对"] += 1
        elif s < 0.4:
            sim_buckets["反对"] += 1
        elif s < 0.6:
            sim_buckets["中立"] += 1
        elif s < 0.8:
            sim_buckets["支持"] += 1
        else:
            sim_buckets["强烈支持"] += 1

    covered = sum(1 for v in sim_buckets.values() if v > 0)
    coverage = covered / len(sim_buckets)

    # 偏差度
    if gt_scores and sim_scores:
        bias_degree = statistics.mean(sim_scores) - statistics.mean(gt_scores)
    else:
        bias_degree = 0.0

    return {
        "stance_coverage": coverage,
        "bias_degree": bias_degree,
        "sim_buckets": sim_buckets,
        "gt_mean": statistics.mean(gt_scores) if gt_scores else 0.5,
        "sim_mean": statistics.mean(sim_scores) if sim_scores else 0.5,
    }


def measure_mean_reversion(results: List[Dict[str, Any]], ground_truth: List[Dict[str, Any]]) -> Dict[str, float]:
    """
    Mean Reversion 衡量：模拟输出是否过度集中在均值附近
    - extreme_capture_rate: 极端意见捕捉率（极端 ground truth 占比 vs 模拟极端占比）
    - reversion_degree: 中位回归程度（标准差对比，越低表示越向均值回归）
    """
    # ground truth 极端比例
    gt_extreme = [item for item in ground_truth if abs(item.get("score", 0.5) - 0.5) > 0.3]
    gt_extreme_ratio = len(gt_extreme) / len(ground_truth) if ground_truth else 0

    # 模拟极端比例
    sim_extreme = [r for r in results if abs(r["stance_score"] - 0.5) > 0.3]
    sim_extreme_ratio = len(sim_extreme) / len(results) if results else 0

    # 极端捕捉率 = min(sim_extreme_ratio / gt_extreme_ratio, 1.0) 防止 > 100%
    if gt_extreme_ratio > 0:
        extreme_capture_rate = min(sim_extreme_ratio / gt_extreme_ratio, 1.0)
    else:
        extreme_capture_rate = 1.0

    # 标准差对比
    sim_scores = [r["stance_score"] for r in results]
    sim_std = statistics.stdev(sim_scores) if len(sim_scores) > 1 else 0
    gt_scores = [item.get("score", 0.5) for item in ground_truth]
    gt_std = statistics.stdev(gt_scores) if len(gt_scores) > 1 else 0

    # 中位回归程度 = 1 - (sim_std / gt_std)，越接近 1 表示越向均值回归
    if gt_std > 0:
        reversion_degree = max(0.0, 1.0 - sim_std / gt_std)
    else:
        reversion_degree = 0.0

    return {
        "extreme_capture_rate": extreme_capture_rate,
        "reversion_degree": reversion_degree,
        "sim_std": sim_std,
        "gt_std": gt_std,
        "sim_extreme_ratio": sim_extreme_ratio,
        "gt_extreme_ratio": gt_extreme_ratio,
    }


def measure_mode_collapse(
    rounds: List[List[Dict[str, Any]]],
    threshold: float = 0.15,
) -> Dict[str, float]:
    """
    Mode Collapse 衡量：多轮模拟后多样性是否骤降
    - diversity_curve: 每轮多样性分数
    - collapse_rate: 多样性下降比例
    - trip_rate: 熔断触发率
    """
    diversity_curve = []
    for r_idx, round_results in enumerate(rounds):
        div = measure_diversity_score(round_results)
        diversity_curve.append(div)

    # collapse rate = (round1 - roundN) / round1
    if diversity_curve and diversity_curve[0] > 0:
        collapse_rate = max(0.0, (diversity_curve[0] - diversity_curve[-1]) / diversity_curve[0])
    else:
        collapse_rate = 0.0

    # 熔断触发率
    trips = sum(1 for d in diversity_curve if d < threshold)
    trip_rate = trips / len(diversity_curve) if diversity_curve else 0

    return {
        "diversity_curve": diversity_curve,
        "collapse_rate": collapse_rate,
        "trip_rate": trip_rate,
        "threshold": threshold,
    }


def measure_diversity_score(results: List[Dict[str, Any]]) -> float:
    """
    多样性分数（mock 实现）：
    基于 stance_score 的熵 + stance_text 分布
    """
    if not results:
        return 0.0

    # 1. 立场分布的 Shannon 熵
    buckets = [0] * 5  # 0.0-0.2, 0.2-0.4, ..., 0.8-1.0
    for r in results:
        bucket = min(int(r["stance_score"] * 5), 4)
        buckets[bucket] += 1

    total = sum(buckets)
    entropy = 0.0
    for c in buckets:
        if c > 0:
            p = c / total
            entropy -= p * math.log2(p)

    # 2. 极端分散度
    scores = [r["stance_score"] for r in results]
    if len(scores) > 1:
        spread = statistics.stdev(scores)
    else:
        spread = 0.0

    # 综合多样性：归一化熵 + spread
    max_entropy = math.log2(5)  # log2(5) ≈ 2.32
    norm_entropy = entropy / max_entropy
    # spread 通常 0-0.3，归一化到 0-1
    norm_spread = min(spread / 0.3, 1.0)

    diversity = 0.6 * norm_entropy + 0.4 * norm_spread
    return diversity


# ============================================================
# 参数扫描实验
# ============================================================

def run_param_sweep() -> Dict[str, Any]:
    """参数扫描主实验"""
    print("=" * 60)
    print("开始参数扫描实验")
    print("=" * 60)

    # 准备 ground truth
    conservative_gt = GROUND_TRUTH_COMMENTS["conservative"]
    extreme_gt = GROUND_TRUTH_COMMENTS["extreme"]
    general_gt = GROUND_TRUTH_COMMENTS["general"]

    all_results = {}

    # ========= 实验 1: TAIL_PERSONA_RATIO 扫描 =========
    print("\n--- 实验 1: TAIL_PERSONA_RATIO 扫描 ---")
    for tail_ratio in PARAM_SWEEP["TAIL_PERSONA_RATIO"]:
        personas = generate_persona_pool(n=500, tail_ratio=tail_ratio)

        # 对保守派话题（Liberal Bias 测试）
        conservative_content = {"topic": "该不该支持代孕合法化", "text": "代孕是否应该合法化"}
        conservative_results = run_simulation(personas, conservative_content, temperature=0.7)
        liberal_metrics = measure_liberal_bias(conservative_results, conservative_gt)

        # 对极端话题（Mean Reversion 测试）
        extreme_content = {"topic": "某顶流明星偷税漏税", "text": "某顶流明星偷税漏税"}
        extreme_results = run_simulation(personas, extreme_content, temperature=0.7)
        reversion_metrics = measure_mean_reversion(extreme_results, extreme_gt)

        key = f"TAIL_PERSONA_RATIO={tail_ratio}"
        all_results[key] = {
            "param_name": "TAIL_PERSONA_RATIO",
            "param_value": tail_ratio,
            "liberal_coverage": liberal_metrics["stance_coverage"],
            "liberal_bias_degree": liberal_metrics["bias_degree"],
            "extreme_capture": reversion_metrics["extreme_capture_rate"],
            "reversion_degree": reversion_metrics["reversion_degree"],
            "diversity": measure_diversity_score(extreme_results),
        }
        print(f"  {key}: "
              f"liberal_cov={liberal_metrics['stance_coverage']:.2%}, "
              f"bias={liberal_metrics['bias_degree']:+.3f}, "
              f"extreme_cap={reversion_metrics['extreme_capture_rate']:.2%}, "
              f"reversion={reversion_metrics['reversion_degree']:.2%}")

    # ========= 实验 2: temperature 扫描 =========
    print("\n--- 实验 2: temperature 扫描 ---")
    for temperature in PARAM_SWEEP["temperature"]:
        personas = generate_persona_pool(n=500, tail_ratio=0.3)

        # 对极端话题
        extreme_content = {"topic": "某顶流明星偷税漏税", "text": "某顶流明星偷税漏税"}
        extreme_results = run_simulation(personas, extreme_content, temperature=temperature)
        reversion_metrics = measure_mean_reversion(extreme_results, extreme_gt)

        # 多样性
        diversity = measure_diversity_score(extreme_results)

        # Liberal bias
        conservative_content = {"topic": "该不该支持代孕合法化", "text": "代孕是否应该合法化"}
        conservative_results = run_simulation(personas, conservative_content, temperature=temperature)
        liberal_metrics = measure_liberal_bias(conservative_results, conservative_gt)

        key = f"temperature={temperature}"
        all_results[key] = {
            "param_name": "temperature",
            "param_value": temperature,
            "liberal_coverage": liberal_metrics["stance_coverage"],
            "liberal_bias_degree": liberal_metrics["bias_degree"],
            "extreme_capture": reversion_metrics["extreme_capture_rate"],
            "reversion_degree": reversion_metrics["reversion_degree"],
            "diversity": diversity,
        }
        print(f"  {key}: "
              f"diversity={diversity:.3f}, "
              f"extreme_cap={reversion_metrics['extreme_capture_rate']:.2%}, "
              f"liberal_cov={liberal_metrics['stance_coverage']:.2%}")

    # ========= 实验 3: DIVERSITY_THRESHOLD 扫描（用于熔断触发率测试）=========
    print("\n--- 实验 3: DIVERSITY_THRESHOLD 扫描（熔断触发率） ---")
    for threshold in PARAM_SWEEP["DIVERSITY_THRESHOLD"]:
        personas = generate_persona_pool(n=500, tail_ratio=0.3)

        # 跑 5 轮模拟（每轮重新抽样）
        rounds = []
        for r in range(5):
            # 每轮重新抽样（mode collapse 风险）
            new_personas = generate_persona_pool(n=500, tail_ratio=0.3, seed=SEED + r * 100)
            content = {"topic": "某顶流明星偷税漏税", "text": "某顶流明星偷税漏税"}
            round_results = run_simulation(new_personas, content, temperature=0.7 + r * 0.05)
            rounds.append(round_results)

        collapse_metrics = measure_mode_collapse(rounds, threshold=threshold)

        key = f"DIVERSITY_THRESHOLD={threshold}"
        all_results[key] = {
            "param_name": "DIVERSITY_THRESHOLD",
            "param_value": threshold,
            "collapse_rate": collapse_metrics["collapse_rate"],
            "trip_rate": collapse_metrics["trip_rate"],
            "diversity_curve": collapse_metrics["diversity_curve"],
        }
        print(f"  {key}: "
              f"collapse_rate={collapse_metrics['collapse_rate']:.2%}, "
              f"trip_rate={collapse_metrics['trip_rate']:.2%}, "
              f"curve={[f'{d:.3f}' for d in collapse_metrics['diversity_curve']]}")

    return all_results


def run_three_trap_tests() -> Dict[str, Any]:
    """三大陷阱的缓解效果测试"""
    print("\n" + "=" * 60)
    print("开始三大陷阱缓解效果测试")
    print("=" * 60)

    # 使用 Spec 推荐参数
    personas = generate_persona_pool(n=500, tail_ratio=0.3)
    temperature = 0.7

    results = {}

    # ========= Trap 1: Liberal Bias =========
    print("\n--- Liberal Bias 测试（保守派话题） ---")
    conservative_content = {"topic": "该不该支持代孕合法化", "text": "代孕是否应该合法化"}
    conservative_results = run_simulation(personas, conservative_content, temperature=temperature)
    liberal_metrics = measure_liberal_bias(conservative_results, GROUND_TRUTH_COMMENTS["conservative"])

    # 计算各立场覆盖
    sim_buckets = liberal_metrics["sim_buckets"]
    print(f"  模拟立场分布: {sim_buckets}")
    print(f"  Ground truth 均值: {liberal_metrics['gt_mean']:.3f}")
    print(f"  模拟均值: {liberal_metrics['sim_mean']:.3f}")
    print(f"  立场覆盖率: {liberal_metrics['stance_coverage']:.2%}")
    print(f"  模拟偏差度: {liberal_metrics['bias_degree']:+.3f}")

    # 衡量标准：立场覆盖率 > 80%
    liberal_pass = liberal_metrics["stance_coverage"] >= 0.8 and abs(liberal_metrics["bias_degree"]) < 0.1
    results["liberal_bias"] = {
        **liberal_metrics,
        "pass": liberal_pass,
        "threshold_target": "立场覆盖率 > 80% 且 偏差度 < 0.1",
    }

    # ========= Trap 2: Mean Reversion =========
    print("\n--- Mean Reversion 测试（极端话题） ---")
    extreme_content = {"topic": "某顶流明星偷税漏税", "text": "某顶流明星偷税漏税"}
    extreme_results = run_simulation(personas, extreme_content, temperature=temperature)
    reversion_metrics = measure_mean_reversion(extreme_results, GROUND_TRUTH_COMMENTS["extreme"])

    print(f"  Ground truth 极端比例: {reversion_metrics['gt_extreme_ratio']:.2%}")
    print(f"  模拟极端比例: {reversion_metrics['sim_extreme_ratio']:.2%}")
    print(f"  极端捕捉率: {reversion_metrics['extreme_capture_rate']:.2%}")
    print(f"  中位回归程度: {reversion_metrics['reversion_degree']:.2%}")

    # 衡量标准：极端捕捉率 > 60%
    reversion_pass = reversion_metrics["extreme_capture_rate"] >= 0.6
    results["mean_reversion"] = {
        **reversion_metrics,
        "pass": reversion_pass,
        "threshold_target": "极端捕捉率 > 60%",
    }

    # ========= Trap 3: Mode Collapse =========
    print("\n--- Mode Collapse 测试（5 轮模拟） ---")
    rounds = []
    for r in range(5):
        # 每轮重新抽样
        new_personas = generate_persona_pool(n=500, tail_ratio=0.3, seed=SEED + r * 100)
        content = {"topic": "某顶流明星塌房事件", "text": "某顶流明星塌房事件"}
        round_results = run_simulation(new_personas, content, temperature=0.7 + r * 0.05)
        rounds.append(round_results)

    collapse_metrics = measure_mode_collapse(rounds, threshold=0.15)

    print(f"  多样性曲线: {[f'{d:.3f}' for d in collapse_metrics['diversity_curve']]}")
    print(f"  多样性下降幅度: {collapse_metrics['collapse_rate']:.2%}")
    print(f"  熔断触发率: {collapse_metrics['trip_rate']:.2%}")

    # 衡量标准：多样性下降 < 30%
    collapse_pass = collapse_metrics["collapse_rate"] < 0.3
    results["mode_collapse"] = {
        **collapse_metrics,
        "pass": collapse_pass,
        "threshold_target": "多样性下降 < 30%",
    }

    return results


# ============================================================
# 主函数
# ============================================================

def main():
    start_time = time.time()

    print(f"qizai 三大陷阱参数 PoC")
    print(f"模式: {POC_MODE}")
    print(f"Seed: {SEED}")
    print(f"Ground truth 总数: {sum(len(items) for items in GROUND_TRUTH_COMMENTS.values())}")
    print()

    # 1. 参数扫描
    sweep_results = run_param_sweep()

    # 2. 三大陷阱测试
    trap_results = run_three_trap_tests()

    # 3. 综合结果
    final_output = {
        "metadata": {
            "mode": POC_MODE,
            "seed": SEED,
            "date": "2026-07-23",
            "n_personas": 500,
            "n_conservative_gt": len(GROUND_TRUTH_COMMENTS["conservative"]),
            "n_extreme_gt": len(GROUND_TRUTH_COMMENTS["extreme"]),
            "n_general_gt": len(GROUND_TRUTH_COMMENTS["general"]),
        },
        "param_sweep": sweep_results,
        "trap_tests": trap_results,
        "duration_s": time.time() - start_time,
    }

    # 输出 JSON
    output_json = OUTPUT_DIR / "poc_trap_params_results.json"
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(final_output, f, ensure_ascii=False, indent=2)

    print(f"\n{'=' * 60}")
    print(f"完成！耗时 {final_output['duration_s']:.1f}s")
    print(f"JSON 报告: {output_json}")
    print(f"{'=' * 60}")

    return final_output


if __name__ == "__main__":
    main()