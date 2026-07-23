"""
MiniMax M3 真实 API 并发度 5 PoC
==================================

目标：
- 用 MiniMax M3 (Anthropic SDK 兼容) 真实 API 跑 5 条内容 × 1000 persona
- 并发度 = 5（asyncio.Semaphore）
- 精确记录：用时、input/output tokens、API 调用次数、成本、TTFB、错误率

日期：2026-07-23
"""

import os
import sys
import json
import time
import random
import asyncio
import statistics
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional
from pathlib import Path
from dotenv import load_dotenv

# Anthropic SDK（兼容模式）
import anthropic

# ============================================================
# 加载 .env.local（包含 MINIMAX_API_KEY 等）
# ============================================================

# 找到 1v1 项目根目录下的 .env.local
PROJECT_ROOT = Path("/Users/opc-1/Downloads/O/1v1")
ENV_PATH = PROJECT_ROOT / ".env.local"
load_dotenv(ENV_PATH)

MINIMAX_API_KEY = os.environ.get("MINIMAX_API_KEY", "")
MINIMAX_MODEL = os.environ.get("MINIMAX_MODEL", "MiniMax-M3")
MINIMAX_BASE_URL = os.environ.get("MINIMAX_BASE_URL", "https://api.minimaxi.com/anthropic")
CONCURRENCY = 5
N_PERSONAS = 1000

# MiniMax M3 价格（CNY / 1M tokens，按任务定义）
INPUT_PRICE_PER_M = 3.0   # ¥3/M
OUTPUT_PRICE_PER_M = 15.0 # ¥15/M

if not MINIMAX_API_KEY:
    print(f"❌ 未找到 MINIMAX_API_KEY，请检查 {ENV_PATH}", file=sys.stderr)
    sys.exit(1)

print(f"✅ 已加载 env: model={MINIMAX_MODEL}, base_url={MINIMAX_BASE_URL}")
print(f"   API key 长度: {len(MINIMAX_API_KEY)}")

# ============================================================
# 5 条内容（小红书风格）
# ============================================================

CONTENTS = [
    {"id": "beauty", "topic": "美妆", "text": "三招教你选对洗面奶"},
    {"id": "food", "topic": "美食", "text": "在家做出米其林三星意面"},
    {"id": "career", "topic": "职场", "text": "面试时这三个问题千万别回答"},
    {"id": "pet", "topic": "萌宠", "text": "猫咪这五种行为说明它超爱你"},
    {"id": "travel", "topic": "旅游", "text": "云南 7 天自由行攻略"},
]

STANCE_LABELS = ["保守", "中立", "自由"]
GENDERS = ["女", "男"]
AGE_BUCKETS = [(18, 24), (25, 29), (30, 34), (35, 39), (40, 49)]
CITIES = ["北京", "上海", "广州", "深圳", "杭州", "成都", "武汉", "南京", "西安", "重庆"]


# ============================================================
# Persona 生成（简化版）
# ============================================================

@dataclass
class Persona:
    pid: str
    age: int
    gender: str
    city: str
    stance_label: str

    def to_persona_str(self) -> str:
        return f"{self.age}岁{self.gender}性，{self.city}，立场{self.stance_label}"


def gen_persona(pid: str) -> Persona:
    age_lo, age_hi = random.choice(AGE_BUCKETS)
    return Persona(
        pid=pid,
        age=random.randint(age_lo, age_hi),
        gender=random.choice(GENDERS),
        city=random.choice(CITIES),
        stance_label=random.choice(STANCE_LABELS),
    )


def generate_personas(n: int) -> List[Persona]:
    return [gen_persona(f"P{i:04d}") for i in range(n)]


# ============================================================
# Prompt 模板
# ============================================================

SYSTEM_PROMPT = "你是一个小红书内容调研受访者。请用 1-2 句话表达真实反应（点赞/收藏/评论/划过）。"

USER_PROMPT_TEMPLATE = "你是 {persona_str}。看到这条小红书内容：\"{content}\"\n请用 1-2 句话表达你的真实反应（点赞/收藏/评论/划过）。"


def build_prompt(persona: Persona, content: str) -> str:
    return USER_PROMPT_TEMPLATE.format(
        persona_str=persona.to_persona_str(),
        content=content,
    )


# ============================================================
# 单次 API 调用
# ============================================================

@dataclass
class CallResult:
    success: bool
    text: str = ""
    input_tokens: int = 0
    output_tokens: int = 0
    ttfb_ms: float = 0.0        # time-to-first-byte (ms)
    latency_ms: float = 0.0     # 总耗时
    error: Optional[str] = None
    error_code: Optional[str] = None
    retries: int = 0


def call_minimax_sync(
    client: anthropic.Anthropic,
    persona: Persona,
    content: str,
) -> CallResult:
    """同步单次调用 MiniMax M3"""
    user_prompt = build_prompt(persona, content)

    last_err = None
    last_err_code = None

    # 最多重试 1 次（按任务定义：失败重试 1 次后仍失败则记录）
    for attempt in range(2):
        t0 = time.perf_counter()
        try:
            response = client.messages.create(
                model=MINIMAX_MODEL,
                max_tokens=128,
                system=SYSTEM_PROMPT,
                messages=[
                    {"role": "user", "content": user_prompt},
                ],
            )
            t1 = time.perf_counter()

            # 提取 usage（Anthropic SDK 字段）
            in_tok = getattr(response.usage, "input_tokens", 0) or 0
            out_tok = getattr(response.usage, "output_tokens", 0) or 0

            # 提取文本
            text_parts = []
            for block in response.content:
                if hasattr(block, "text"):
                    text_parts.append(block.text)
            text = "".join(text_parts)

            return CallResult(
                success=True,
                text=text,
                input_tokens=in_tok,
                output_tokens=out_tok,
                ttfb_ms=(t1 - t0) * 1000,  # 简化：非流式时 TTFB ≈ 总耗时
                latency_ms=(t1 - t0) * 1000,
                retries=attempt,
            )
        except anthropic.RateLimitError as e:
            last_err = str(e)
            last_err_code = "rate_limit"
            time.sleep(2 + attempt * 2)
        except anthropic.APIStatusError as e:
            last_err = str(e)
            last_err_code = f"api_status_{e.status_code}"
            # 1002 限流等：等一下再试
            if e.status_code in (429, 1002, 1008):
                time.sleep(2 + attempt * 2)
            else:
                break  # 不可恢复错误
        except Exception as e:
            last_err = repr(e)
            last_err_code = "exception"
            break

    return CallResult(
        success=False,
        error=last_err,
        error_code=last_err_code,
        retries=1,
    )


# ============================================================
# 异步并发调用（asyncio.Semaphore=5）
# ============================================================

async def call_one(
    semaphore: asyncio.Semaphore,
    client: anthropic.Anthropic,
    persona: Persona,
    content: str,
) -> CallResult:
    async with semaphore:
        # 异步执行同步 SDK（Anthropic SDK 是同步的，用线程池）
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None,  # 默认 ThreadPoolExecutor
            call_minimax_sync,
            client,
            persona,
            content,
        )


async def run_concurrent_for_content(
    client: anthropic.Anthropic,
    personas: List[Persona],
    content: str,
    concurrency: int = CONCURRENCY,
) -> Dict[str, Any]:
    """跑一条内容的所有 persona（并发）"""
    semaphore = asyncio.Semaphore(concurrency)
    tasks = [call_one(semaphore, client, p, content) for p in personas]

    t_start = time.perf_counter()
    results = await asyncio.gather(*tasks, return_exceptions=False)
    t_end = time.perf_counter()

    wallclock_s = t_end - t_start

    # 聚合
    succ = sum(1 for r in results if r.success)
    fail = len(results) - succ
    in_tok = sum(r.input_tokens for r in results)
    out_tok = sum(r.output_tokens for r in results)
    rate_limit_errs = sum(1 for r in results if r.error_code in ("rate_limit", "api_status_429", "api_status_1002"))

    latencies = sorted([r.latency_ms for r in results if r.success])
    ttfb_list = sorted([r.ttfb_ms for r in results if r.success])
    p50 = latencies[len(latencies) // 2] if latencies else 0
    p95 = latencies[int(len(latencies) * 0.95)] if latencies else 0

    return {
        "content": content,
        "total_requests": len(personas),
        "successful": succ,
        "failed": fail,
        "wallclock_seconds": round(wallclock_s, 2),
        "input_tokens": in_tok,
        "output_tokens": out_tok,
        "estimated_cost_cny": round(
            in_tok / 1e6 * INPUT_PRICE_PER_M + out_tok / 1e6 * OUTPUT_PRICE_PER_M, 4
        ),
        "rate_limit_errors": rate_limit_errs,
        "p50_latency_ms": round(p50, 1),
        "p95_latency_ms": round(p95, 1),
        "ttfb_p50_ms": round(ttfb_list[len(ttfb_list) // 2], 1) if ttfb_list else 0,
        "ttfb_p95_ms": round(ttfb_list[int(len(ttfb_list) * 0.95)], 1) if ttfb_list else 0,
        "error_breakdown": _err_breakdown(results),
        "sample_failures": [
            {"pid": personas[i].pid, "error_code": results[i].error_code, "error": (results[i].error or "")[:200]}
            for i in range(len(results)) if not results[i].success
        ][:5],
    }


def _err_breakdown(results: List[CallResult]) -> Dict[str, int]:
    d: Dict[str, int] = {}
    for r in results:
        if r.success:
            continue
        k = r.error_code or "unknown"
        d[k] = d.get(k, 0) + 1
    return d


# ============================================================
# 主流程
# ============================================================

async def main():
    print(f"\n=== MiniMax M3 PoC（并发度={CONCURRENCY}）===")
    print(f"模型: {MINIMAX_MODEL}")
    print(f"Base URL: {MINIMAX_BASE_URL}")
    print(f"persona 数: {N_PERSONAS}")
    print(f"内容数: {len(CONTENTS)}")
    print()

    # 生成 persona
    personas = generate_personas(N_PERSONAS)
    print(f"✅ 已生成 {len(personas)} 个 persona")

    # 创建 Anthropic 客户端（MiniMax 兼容模式）
    client = anthropic.Anthropic(
        api_key=MINIMAX_API_KEY,
        base_url=MINIMAX_BASE_URL,
    )
    print(f"✅ 客户端初始化完成\n")

    # 探测 1 个请求，确认 API 通
    print("🔍 探测 API 通道...")
    probe = call_minimax_sync(client, personas[0], CONTENTS[0]["text"])
    if not probe.success:
        print(f"❌ 探测失败: {probe.error_code} - {probe.error}")
        if probe.error_code in ("api_status_1008", "api_status_1002"):
            print("🛑 余额不足或严重限流，立即停止")
            sys.exit(2)
        print("⚠️ 继续（可能是临时错误）")
    else:
        print(f"✅ 探测成功: in={probe.input_tokens} out={probe.output_tokens} latency={probe.latency_ms:.0f}ms\n")

    # 跑 5 条内容
    results_per_content = []
    total_t0 = time.perf_counter()

    for idx, content_obj in enumerate(CONTENTS, 1):
        print(f"[{idx}/{len(CONTENTS)}] {content_obj['topic']}：{content_obj['text'][:30]}...")
        r = await run_concurrent_for_content(client, personas, content_obj["text"])
        r["content_id"] = content_obj["id"]
        r["topic"] = content_obj["topic"]
        results_per_content.append(r)
        print(
            f"    wallclock={r['wallclock_seconds']:.1f}s "
            f"succ={r['successful']}/{r['total_requests']} "
            f"in={r['input_tokens']:,} out={r['output_tokens']:,} "
            f"¥{r['estimated_cost_cny']:.3f} "
            f"errs={r['failed']} rl={r['rate_limit_errors']} "
            f"p50={r['p50_latency_ms']:.0f}ms p95={r['p95_latency_ms']:.0f}ms"
        )
        print()

    total_t_end = time.perf_counter()

    # 汇总
    total_wallclock = total_t_end - total_t0
    total_in = sum(r["input_tokens"] for r in results_per_content)
    total_out = sum(r["output_tokens"] for r in results_per_content)
    total_cost = sum(r["estimated_cost_cny"] for r in results_per_content)
    total_rl = sum(r["rate_limit_errors"] for r in results_per_content)
    total_succ = sum(r["successful"] for r in results_per_content)
    total_fail = sum(r["failed"] for r in results_per_content)
    total_reqs = total_succ + total_fail

    # 合并所有延迟用于统计
    all_latencies = []
    all_p50 = []
    all_p95 = []
    for r in results_per_content:
        all_p50.append(r["p50_latency_ms"])
        all_p95.append(r["p95_latency_ms"])

    summary = {
        "concurrency": CONCURRENCY,
        "model": MINIMAX_MODEL,
        "content_types": [c["topic"] for c in CONTENTS],
        "persona_count": N_PERSONAS,
        "rounds": 1,
        "results_per_content": results_per_content,
        "summary": {
            "total_wallclock_seconds": round(total_wallclock, 2),
            "total_input_tokens": total_in,
            "total_output_tokens": total_out,
            "total_cost_cny": round(total_cost, 4),
            "total_requests": total_reqs,
            "total_successful": total_succ,
            "total_failed": total_fail,
            "overall_error_rate": round(total_fail / total_reqs, 4) if total_reqs else 0,
            "rate_limit_errors": total_rl,
            "p50_latency_ms_across_contents": round(statistics.mean(all_p50), 1) if all_p50 else 0,
            "p95_latency_ms_across_contents": round(statistics.mean(all_p95), 1) if all_p95 else 0,
            "speedup_vs_concurrency_1": None,  # 由报告层对比
            "spec_assumption_minutes": "5-15",  # 由报告层对比
            "spec_assumption_minutes_min": 5,
            "spec_assumption_minutes_max": 15,
        },
        "meta": {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "input_price_cny_per_m": INPUT_PRICE_PER_M,
            "output_price_cny_per_m": OUTPUT_PRICE_PER_M,
            "concurrency": CONCURRENCY,
            "n_personas": N_PERSONAS,
            "base_url": MINIMAX_BASE_URL,
        },
    }

    # 输出 JSON
    json_path = PROJECT_ROOT / "docs/superpowers/research/poc/poc-minimax-concurrency-5.json"
    json_path.parent.mkdir(parents=True, exist_ok=True)
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print(f"\n✅ JSON 写入: {json_path}")
    print(f"\n=== 汇总 ===")
    print(f"总用时: {total_wallclock:.1f}s ({total_wallclock/60:.2f} 分钟)")
    print(f"总请求: {total_reqs} (成功 {total_succ}, 失败 {total_fail})")
    print(f"总 token: in={total_in:,} out={total_out:,}")
    print(f"总成本: ¥{total_cost:.3f}")
    print(f"限流错误: {total_rl}")

    return summary


if __name__ == "__main__":
    summary = asyncio.run(main())