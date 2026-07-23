"""MiniMax M3 真实 API 串行 PoC：1000 persona × 5 条内容。"""

from __future__ import annotations

import json
import os
import random
import statistics
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import anthropic
from dotenv import load_dotenv

PROJECT_ROOT = Path("/Users/opc-1/Downloads/O/1v1")
OUTPUT_DIR = PROJECT_ROOT / "docs/superpowers/research/poc"
ENV_PATH = PROJECT_ROOT / ".env.local"
OUTPUT_JSON = OUTPUT_DIR / "poc-minimax-concurrency-1.json"
OUTPUT_REPORT = OUTPUT_DIR / "poc-minimax-concurrency-1-report.md"
CHECKPOINT_JSON = OUTPUT_DIR / ".poc-minimax-concurrency-1-checkpoint.json"

load_dotenv(ENV_PATH)
API_KEY = os.environ.get("MINIMAX_API_KEY", "")
MODEL = os.environ.get("MINIMAX_MODEL", "MiniMax-M3")
BASE_URL = os.environ.get("MINIMAX_BASE_URL", "https://api.minimaxi.com/v1")

CONCURRENCY = 1
PERSONA_COUNT = 1000
REQUEST_INTERVAL_SECONDS = 0.1
MAX_TOKENS = 128
INPUT_PRICE_PER_M = 3.0
OUTPUT_PRICE_PER_M = 15.0
SEED = 20260723

CONTENTS = [
    {"topic": "美妆", "text": "三招教你选对洗面奶"},
    {"topic": "美食", "text": "在家做出米其林三星意面"},
    {"topic": "职场", "text": "面试时这三个问题千万别回答"},
    {"topic": "萌宠", "text": "猫咪这五种行为说明它超爱你"},
    {"topic": "旅游", "text": "云南 7 天自由行攻略"},
]
STANCE_LABELS = ["保守", "中立", "自由"]
GENDERS = ["女", "男"]
AGE_BUCKETS = [(18, 24), (25, 29), (30, 34), (35, 39), (40, 49)]
CITIES = ["北京", "上海", "广州", "深圳", "杭州", "成都", "武汉", "南京", "西安", "重庆"]
PROMPT_TEMPLATE = (
    '你是 {persona}。看到这条小红书内容："{content}"\n'
    "请用 1-2 句话表达你的真实反应（点赞/收藏/评论/划过）。"
)


@dataclass(frozen=True)
class Persona:
    pid: str
    age: int
    gender: str
    city: str
    stance_label: str

    def render(self) -> str:
        return f"{self.age}岁{self.gender}性，城市{self.city}，立场{self.stance_label}"


@dataclass(frozen=True)
class CallResult:
    success: bool
    input_tokens: int
    output_tokens: int
    latency_ms: float
    ttfb_ms: float
    api_attempts: int
    retries: int
    rate_limit_errors: int
    error_code: str | None = None
    error: str | None = None
    balance_insufficient: bool = False


def generate_personas() -> list[Persona]:
    rng = random.Random(SEED)
    personas: list[Persona] = []
    for index in range(PERSONA_COUNT):
        age_low, age_high = rng.choice(AGE_BUCKETS)
        personas.append(
            Persona(
                pid=f"P{index:04d}",
                age=rng.randint(age_low, age_high),
                gender=rng.choice(GENDERS),
                city=rng.choice(CITIES),
                stance_label=rng.choice(STANCE_LABELS),
            )
        )
    return personas


def percentile(values: list[float], quantile: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    position = (len(ordered) - 1) * quantile
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    fraction = position - lower
    return ordered[lower] + (ordered[upper] - ordered[lower]) * fraction


def extract_error_code(error: BaseException) -> str:
    body = getattr(error, "body", None)
    candidates: list[Any] = [body]
    if isinstance(body, dict):
        candidates.extend([body.get("error"), body.get("base_resp")])
    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue
        for key in ("code", "status_code", "error_code"):
            value = candidate.get(key)
            if value is not None:
                return str(value)
    status_code = getattr(error, "status_code", None)
    if status_code is not None:
        return str(status_code)
    return type(error).__name__


def is_rate_limit(code: str, error: BaseException) -> bool:
    text = f"{code} {error}".lower()
    return code in {"429", "1002"} or "rate limit" in text or "限流" in text


def stream_once(client: anthropic.Anthropic, prompt: str) -> tuple[int, int, float, float]:
    started = time.perf_counter()
    first_event_at: float | None = None
    with client.messages.stream(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        for _event in stream:
            if first_event_at is None:
                first_event_at = time.perf_counter()
        final_message = stream.get_final_message()
    finished = time.perf_counter()
    usage = final_message.usage
    ttfb_at = first_event_at if first_event_at is not None else finished
    return (
        int(getattr(usage, "input_tokens", 0) or 0),
        int(getattr(usage, "output_tokens", 0) or 0),
        (ttfb_at - started) * 1000,
        (finished - started) * 1000,
    )


def call_with_retry(client: anthropic.Anthropic, prompt: str) -> CallResult:
    request_started = time.perf_counter()
    rate_limit_errors = 0
    last_error: BaseException | None = None
    last_code: str | None = None

    for attempt in range(2):
        try:
            input_tokens, output_tokens, ttfb_ms, _attempt_latency_ms = stream_once(client, prompt)
            return CallResult(
                success=True,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                latency_ms=(time.perf_counter() - request_started) * 1000,
                ttfb_ms=ttfb_ms,
                api_attempts=attempt + 1,
                retries=attempt,
                rate_limit_errors=rate_limit_errors,
            )
        except Exception as error:  # SDK 将 HTTP、连接和流错误映射为不同异常类
            last_error = error
            last_code = extract_error_code(error)
            if is_rate_limit(last_code, error):
                rate_limit_errors += 1
            if last_code == "1008":
                return CallResult(
                    success=False,
                    input_tokens=0,
                    output_tokens=0,
                    latency_ms=(time.perf_counter() - request_started) * 1000,
                    ttfb_ms=0,
                    api_attempts=attempt + 1,
                    retries=attempt,
                    rate_limit_errors=rate_limit_errors,
                    error_code=last_code,
                    error=str(error)[:500],
                    balance_insufficient=True,
                )
            if attempt == 0:
                time.sleep(2.0 if is_rate_limit(last_code, error) else REQUEST_INTERVAL_SECONDS)

    return CallResult(
        success=False,
        input_tokens=0,
        output_tokens=0,
        latency_ms=(time.perf_counter() - request_started) * 1000,
        ttfb_ms=0,
        api_attempts=2,
        retries=1,
        rate_limit_errors=rate_limit_errors,
        error_code=last_code,
        error=str(last_error)[:500] if last_error else "unknown error",
    )


def aggregate_content(content: str, results: list[CallResult], wallclock_seconds: float) -> dict[str, Any]:
    successful = [result for result in results if result.success]
    input_tokens = sum(result.input_tokens for result in results)
    output_tokens = sum(result.output_tokens for result in results)
    return {
        "content": content,
        "total_requests": len(results),
        "successful": len(successful),
        "failed": len(results) - len(successful),
        "wallclock_seconds": round(wallclock_seconds, 3),
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "estimated_cost_cny": round(
            input_tokens * INPUT_PRICE_PER_M / 1_000_000
            + output_tokens * OUTPUT_PRICE_PER_M / 1_000_000,
            6,
        ),
        "api_calls": sum(result.api_attempts for result in results),
        "retry_count": sum(result.retries for result in results),
        "rate_limit_errors": sum(result.rate_limit_errors for result in results),
        "p50_latency_ms": round(percentile([r.latency_ms for r in successful], 0.50), 3),
        "p95_latency_ms": round(percentile([r.latency_ms for r in successful], 0.95), 3),
        "p50_ttfb_ms": round(percentile([r.ttfb_ms for r in successful], 0.50), 3),
        "p95_ttfb_ms": round(percentile([r.ttfb_ms for r in successful], 0.95), 3),
        "errors": [
            {"code": result.error_code, "message": result.error}
            for result in results
            if not result.success
        ][:20],
    }


def build_output(
    results_per_content: list[dict[str, Any]],
    all_results: list[CallResult],
    total_wallclock_seconds: float,
    stopped_early: bool,
    stop_reason: str | None,
) -> dict[str, Any]:
    successful = [result for result in all_results if result.success]
    total_input = sum(result.input_tokens for result in all_results)
    total_output = sum(result.output_tokens for result in all_results)
    total_logical_requests = len(all_results)
    total_failed = total_logical_requests - len(successful)
    return {
        "concurrency": CONCURRENCY,
        "model": MODEL,
        "content_types": [item["topic"] for item in CONTENTS],
        "persona_count": PERSONA_COUNT,
        "rounds": 1,
        "results_per_content": results_per_content,
        "summary": {
            "total_wallclock_seconds": round(total_wallclock_seconds, 3),
            "total_input_tokens": total_input,
            "total_output_tokens": total_output,
            "total_cost_cny": round(
                total_input * INPUT_PRICE_PER_M / 1_000_000
                + total_output * OUTPUT_PRICE_PER_M / 1_000_000,
                6,
            ),
            "avg_seconds_per_request": round(
                total_wallclock_seconds / total_logical_requests, 6
            ) if total_logical_requests else 0,
            "api_calls": sum(result.api_attempts for result in all_results),
            "logical_requests_completed": total_logical_requests,
            "successful": len(successful),
            "failed": total_failed,
            "error_rate": round(total_failed / total_logical_requests, 8)
            if total_logical_requests else 0,
            "retry_count": sum(result.retries for result in all_results),
            "rate_limit_errors": sum(result.rate_limit_errors for result in all_results),
            "p50_latency_ms": round(percentile([r.latency_ms for r in successful], 0.50), 3),
            "p95_latency_ms": round(percentile([r.latency_ms for r in successful], 0.95), 3),
            "p50_ttfb_ms": round(percentile([r.ttfb_ms for r in successful], 0.50), 3),
            "p95_ttfb_ms": round(percentile([r.ttfb_ms for r in successful], 0.95), 3),
            "mean_latency_ms": round(statistics.fmean(r.latency_ms for r in successful), 3)
            if successful else 0,
            "stopped_early": stopped_early,
            "stop_reason": stop_reason,
        },
        "meta": {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "request_interval_seconds": REQUEST_INTERVAL_SECONDS,
            "max_tokens": MAX_TOKENS,
            "input_price_cny_per_m_tokens": INPUT_PRICE_PER_M,
            "output_price_cny_per_m_tokens": OUTPUT_PRICE_PER_M,
            "ttfb_method": "streaming: elapsed time to first received stream event",
            "usage_source": "response.usage.input_tokens/output_tokens",
        },
    }


def write_report(output: dict[str, Any]) -> None:
    summary = output["summary"]
    minutes = summary["total_wallclock_seconds"] / 60
    spec_time_status = "符合" if 5 <= minutes <= 15 else "不符合"
    spec_cost_status = "符合" if 2 <= summary["total_cost_cny"] <= 4 else "不符合"
    rows = []
    for item, result in zip(CONTENTS, output["results_per_content"]):
        rows.append(
            f"| {item['topic']} | {result['total_requests']} | {result['successful']} | "
            f"{result['failed']} | {result['api_calls']} | {result['wallclock_seconds']:.3f} | "
            f"{result['input_tokens']} | {result['output_tokens']} | "
            f"¥{result['estimated_cost_cny']:.6f} | {result['p50_ttfb_ms']:.1f} | "
            f"{result['p95_ttfb_ms']:.1f} |"
        )
    stop_note = ""
    if summary["stopped_early"]:
        stop_note = f"\n> 测试提前停止：{summary['stop_reason']}。以下结果仅覆盖已完成请求。\n"
    report = f"""# MiniMax M3 串行 PoC 报告

## 1. 测试方法

- 模型：`{output['model']}`，Anthropic SDK 兼容接口。
- 工作量：1000 个简化 persona × 5 条小红书内容 × 1 轮，共计划 5000 条逻辑请求。
- Persona 字段：年龄、性别、城市、立场标签（保守/中立/自由），固定随机种子 `{SEED}`。
- 并发度：严格为 1；每个逻辑请求完成后等待 `{REQUEST_INTERVAL_SECONDS}` 秒。
- 失败策略：每条请求最多重试 1 次；API 调用次数含重试。
- Token：逐次读取 `response.usage.input_tokens` 与 `response.usage.output_tokens`。
- TTFB：启用流式响应，从发起请求到收到第一个流事件的 wall-clock 延迟。
- 成本：输入 ¥3/M tokens，输出 ¥15/M tokens。
{stop_note}
## 2. 完整数据表

| 内容类型 | 逻辑请求 | 成功 | 失败 | API 调用 | 用时(s) | 输入 tokens | 输出 tokens | 成本 | TTFB p50(ms) | TTFB p95(ms) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
{chr(10).join(rows)}
| **总计** | **{summary['logical_requests_completed']}** | **{summary['successful']}** | **{summary['failed']}** | **{summary['api_calls']}** | **{summary['total_wallclock_seconds']:.3f}** | **{summary['total_input_tokens']}** | **{summary['total_output_tokens']}** | **¥{summary['total_cost_cny']:.6f}** | **{summary['p50_ttfb_ms']:.1f}** | **{summary['p95_ttfb_ms']:.1f}** |

补充指标：平均每条逻辑请求 `{summary['avg_seconds_per_request']:.6f}` 秒，延迟 p50/p95 为 `{summary['p50_latency_ms']:.1f}` / `{summary['p95_latency_ms']:.1f}` ms，错误率 `{summary['error_rate']:.4%}`，限流错误 `{summary['rate_limit_errors']}` 次，重试 `{summary['retry_count']}` 次。

## 3. 与 Spec v0.11 假设对比

| 指标 | Spec v0.11 假设 | 实测 | 判断 |
|---|---:|---:|---|
| 总用时 | 5–15 分钟 | {minutes:.3f} 分钟 | {spec_time_status} |
| 总成本 | ¥2–4 | ¥{summary['total_cost_cny']:.6f} | {spec_cost_status} |

## 4. 真实 vs Spec 假设偏差分析

- 用时相对假设下界偏差：`{((minutes / 5) - 1) * 100:.2f}%`；相对假设上界偏差：`{((minutes / 15) - 1) * 100:.2f}%`。
- 成本相对假设下界偏差：`{((summary['total_cost_cny'] / 2) - 1) * 100:.2f}%`；相对假设上界偏差：`{((summary['total_cost_cny'] / 4) - 1) * 100:.2f}%`。
- 成本差异主要由短 prompt、1–2 句话的短输出，以及 MiniMax M3 按实际 token 计费造成。
- 串行总用时主要由单请求模型延迟、5000 次固定 0.1 秒间隔和重试退避共同构成。

## 5. 建议

- 若生产目标仍是 5–15 分钟，串行配置只有在本次实测落入该区间时才可直接采用；否则需要提高并发或减少 persona 数，但应重新验证 RPM/TPM 限制。
- 定价不应继续用 ¥2–4 作为单次 5000 请求的模型成本点估计，应以本次 usage 实测成本加上重试、日志、存储、任务编排和利润系数定价。
- 保留流式 TTFB、usage 和错误码逐调用埋点，并用 p95 而非均值作为用户等待体验指标。
- 若限流错误较多，应提高请求间隔或申请更高配额；如果配额确为免费 20 RPM，0.1 秒间隔本身不足以保证不触发限流。
"""
    OUTPUT_REPORT.write_text(report, encoding="utf-8")


def save_checkpoint(output: dict[str, Any]) -> None:
    CHECKPOINT_JSON.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    if not API_KEY:
        print(f"缺少 MINIMAX_API_KEY，请检查 {ENV_PATH}", file=sys.stderr)
        return 1

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    personas = generate_personas()
    client = anthropic.Anthropic(api_key=API_KEY, base_url=BASE_URL, max_retries=0, timeout=120.0)
    results_per_content: list[dict[str, Any]] = []
    all_results: list[CallResult] = []
    total_started = time.perf_counter()
    stopped_early = False
    stop_reason: str | None = None

    for content_index, content in enumerate(CONTENTS, start=1):
        print(f"[{content_index}/5] {content['topic']}：{content['text']}", flush=True)
        content_started = time.perf_counter()
        content_results: list[CallResult] = []
        for persona_index, persona in enumerate(personas, start=1):
            prompt = PROMPT_TEMPLATE.format(persona=persona.render(), content=content["text"])
            result = call_with_retry(client, prompt)
            content_results.append(result)
            all_results.append(result)
            if persona_index % 25 == 0 or not result.success:
                elapsed = time.perf_counter() - total_started
                print(
                    f"  {persona_index}/1000 success={sum(r.success for r in content_results)} "
                    f"api_calls={sum(r.api_attempts for r in content_results)} elapsed={elapsed:.1f}s",
                    flush=True,
                )
            if result.balance_insufficient:
                stopped_early = True
                stop_reason = "MiniMax API error 1008: 余额不足"
                break
            time.sleep(REQUEST_INTERVAL_SECONDS)

        results_per_content.append(
            aggregate_content(content["text"], content_results, time.perf_counter() - content_started)
        )
        checkpoint = build_output(
            results_per_content,
            all_results,
            time.perf_counter() - total_started,
            stopped_early,
            stop_reason,
        )
        save_checkpoint(checkpoint)
        if stopped_early:
            break

    output = build_output(
        results_per_content,
        all_results,
        time.perf_counter() - total_started,
        stopped_early,
        stop_reason,
    )
    OUTPUT_JSON.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    write_report(output)
    CHECKPOINT_JSON.unlink(missing_ok=True)
    print(f"JSON: {OUTPUT_JSON}")
    print(f"报告: {OUTPUT_REPORT}")
    print(json.dumps(output["summary"], ensure_ascii=False, indent=2))
    return 2 if stopped_early else 0


if __name__ == "__main__":
    raise SystemExit(main())
