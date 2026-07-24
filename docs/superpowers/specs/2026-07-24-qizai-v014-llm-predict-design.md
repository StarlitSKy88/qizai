# qizai v0.14 LLM Predict Design Spec (2026-07-24)

## Goal

Turn qizai from a multi-route SPA with placeholder predictions (v0.13.B.1) into an end-to-end LLM-powered predict product:
- Web form → authenticated POST → 3 platforms × 100 personas simulation → streamed progress → shareable report URL.

## Non-Goals (Explicit Out-of-Scope for v0.14)

- Real payment / 微信支付集成 (Phase 2)
- Mobile native app
- Multi-language i18n (Chinese-only v0.14)
- Real-time collaboration / multi-user reports
- Webhook / 3rd-party API integrations
- D1 → Postgres migration (D1 is single-region; multi-region Phase 2)
- ML model fine-tuning (Phase 2, after 1000 real users collected)

## Architecture (5 Layers)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Cloudflare Pages (apps/web, Vite 5 + React 18 + react-router v6)  │
│                                                                     │
│  ┌──────────┐   POST /api/auth/register   ┌─────────────────┐  │
│  │ /signup  │ ──────────────────────────▶│ apps/api Hono   │  │
│  └──────────┘                            │  Workers         │  │
│  ┌──────────┐  POST /api/auth/login       │                 │  │
│  │ /login   │ ──────────────────────────▶│  /auth/*        │  │
│  └──────────┘                            │   D1 users      │  │
│                                           │   bcrypt+JWT    │  │
│  ┌──────────┐  POST /api/predict/stream  │                 │  │
│  │ /predict │  Authorization: Bearer JWT │  /predict/stream │  │
│  │   SSE    │ ◀─────────────────────────│  (SSE)          │  │
│  └──────────┘  data: {progress, report}  │                 │  │
│         │                                 │  SimulationEngine│  │
│         ▼                                 │   100 personas × │  │
│  ┌──────────┐  GET /api/report/:id        │   3 platforms    │  │
│  │ /report/ │ ◀─────────────────────────│                 │  │
│  │   :id    │  {report, evidence_pack}   │  ReportGenerator │  │
│  └──────────┘                            │                 │  │
│                                          └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

5 layers:
1. **apps/web** — UI / SSE consumer
2. **apps/api** — Hono Workers
3. **packages/shared** — domain logic (zero changes; v0.12 ready)
4. **Cloudflare D1** — DB
5. **Cloudflare Workers KV** — caching (optional)

## End-to-End Data Flow

```
1. User 在 /predict 表单输入 content → 提交
2. apps/web POST /api/predict/stream (Authorization: Bearer JWT)
   └─ payload: { content: {title, body?}, platforms: ['xhs','tiktok','bilibili'] }
3. apps/api/predict/stream handler:
   ├─ 鉴权 → quota check → 创建 report row (D1 status='streaming')
   ├─ 立即返回 200 + `Content-Type: text/event-stream`
   └─ 后台异步串行跑 3 个平台:
       for platform in platforms:
         personas = PersonaBuilder.buildBalanced({topic, count:100, platform})
         engine = new SimulationEngine({router, concurrency:100, diversityThreshold:0.40})
         result = await engine.simulate(content, personas)
         push SSE: data: {type:'progress', platform, completed, total, diversity}
       report = ReportGenerator.generate(content, [r1,r2,r3])
       保存 D1 (status='done', report_json, evidence_pack)
       push SSE: data: {type:'complete', report_id, report, evidence}
4. apps/web SSE consumer:
   ├─ 实时更新 progress bar
   ├─ 收到 type=complete 后 navigate('/report/:id') — shareable
```

### Serial Platform Pipeline (3 platforms × 100 personas)

```
         t=0     t=10s    t=20s   t=30s   t=40s   t=50s   t=60s
xhs      [══════batch 100════════]
tiktok                     [══════batch 100════════]
bilibili                                 [════batch 100══════]
                                          ▼
                              [complete + report_id]
```

**Decision: SERIAL** (recommended). Total 30-60s. Rejected parallel (LLM RPM contest) and serial-xhs-then-parallel (too complex for MVP).

## SSE Protocol

### Event Types (5)

| Type | Payload | When |
|---|---|---|
| `start` | `{report_id, total_personas: 300}` | Connection open |
| `progress` | `{platform, completed, total, diversity}` | Each batch done |
| `boost_triggered` | `{platform, reason}` | DIVERSITY < 0.40 |
| `complete` | `{report_id, report, evidence}` | All 3 platforms done |
| `error` | `{code, message}` | LLM down / quota / auth |

### Required Headers

```
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

### 30s Heartbeat

Cloudflare Workers SSE must flush periodically. Worker emits `: heartbeat\n\n` every 25s (5s margin).

### 3 Resilience Optimizations

1. **SSE reconnection** — EventSource auto-reconnect, frontend `retry: 5000` response header.
2. **Resume from progress** — `Last-Event-Id` header includes `(report_id, latest_persona_index)`. Backend resumes without re-charging LLM.
3. **Quota soft-cap** — User 一次 stream 最多 N calls. Excess → graceful degrade (return diversity report, refuse boost).

## Error Handling

### 7 Auth Gating Points

| Location | Verification | Fail HTTP |
|---|---|---|
| POST /api/auth/register | email regex + password ≥ 8 chars + bcrypt | 400 / 409 |
| POST /api/auth/login | email + bcrypt match → JWT (HS256, 7d) | 401 |
| POST /api/predict/stream | JWT middleware first (no quota if fail) | 401 |
| GET /api/report/:id | user_id ownership OR public demo | 403 / 404 |
| GET /api/predictions | JWT (list user history) | 401 |
| Cloudflare WAF | 5x/h/IP rate-limit pre-route | 429 |
| D1 row-level | `WHERE user_id = ?` parameter binding | — |

### 3-Layer LLM Fallback

```
LLMRouter.complete(prompt, persona)
  ├─ Try AlibabaProvider (qwen3.5-flash, 30K RPM)
  │   ├─ 429 rate limit → 立即 fallback
  │   ├─ 网络 5xx → fallback
  │   └─ 4xx 业务错误 → retry 1 次后 fallback
  ├─ Try FireworksProvider (qwen3p7-plus)
  ├─ Try DeepSeekProvider (deepseek-v4-flash)
  └─ All 3 fail → push SSE: type='error', code='LLM_DOWN'
```

### Quota System (Dual Layer)

| Layer | Implementation | Limit |
|---|---|---|
| User quota | D1 `users.quota_used` field | 30/月 默认；¥29 升级 300/月 |
| Rate limit | Cloudflare Rate Limiting Rules | 5 次/小时/IP |

### 4 User-Visible Errors (Frontend handling)

| code | message | UI |
|---|---|---|
| `AUTH_REQUIRED` | 请先登录 | redirect /login |
| `QUOTA_EXHAUSTED` | 本月配额已用完 | display upgrade CTA → /pricing |
| `LLM_DOWN` | AI 临时不可用 | retry button + 倒计时 |
| `CONTENT_TOO_LONG` | 内容超过 2000 字 | truncation hint |

## Testing Strategy (4-layer pyramid)

```
                ┌─────────────────┐
                │   Playwright    │   5 e2e
                │   e2e 端到端     │
                ├─────────────────┤
                │   Vitest worker │  30 API integration
                │   integration   │
                ├─────────────────┤
                │   Vitest unit   │  60 shared/ domain
                │   unit          │
                ├─────────────────┤
                │   Golden reports│  8 hand-curated
                │   评估质量       │
                └─────────────────┘
```

### 5 E2E Scenarios (Playwright)

| # | Scenario | Expected |
|---|---|---|
| 1 | register happy path | success → /predict |
| 2 | login + auth-gated /predict | no JWT → /login |
| 3 | predict SSE consumer | form submit → progress → complete → /report/:id |
| 4 | quota exhausted | 31st predict → QUOTA_EXHAUSTED + /pricing |
| 5 | report shareable URL | /report/:abc → visible report |

## Rollout Plan (4 PR + 1 release)

| PR | Scope | Days |
|---|---|---|
| v0.14.0-pr1 | D1 schema + auth/* + JWT + bcrypt | 3-4 |
| v0.14.0-pr2 | /predict/stream SSE handler + 3 platforms serial | 5-6 |
| v0.14.0-pr3 | /report/:id + /predictions + SSE consumer frontend | 4-5 |
| v0.14.0-pr4 | quota + Rate Limit + 5 e2e + golden reports | 3-4 |
| v0.14.0 release | CHANGELOG + master merge + manual smoke | 1 |

Total: 15-20 working days = 4-5 weeks.

**Rollback**: Each PR independent atomic commit. Fail → `git revert <merge-sha>` → CF Worker deploys in 30s.

## Known Risks + Mitigations

- **Risk 1: D1 migrations forward-only** — Schema changes need migration scripts; never drop columns in same release.
- **Risk 2: LLM cost overload** — Per-platform circuit breaker (1 platform fail doesn't break other 2) + quota.
- **Risk 3: SSE 30s Cloudflare proxy timeout** — 25s heartbeat margin (5s early flush).

## Decisions Reconciled

- ADR-008: 3 platforms serial over parallel (complexity vs speed)
- ADR-009: SSE over WebSocket (CF Workers native + retry semantics)
- ADR-010: D1 over Postgres (single-region MVP, ≤ 1000 rows / user / month)
- ADR-011: Full JWT + bcrypt (vs mock session) — committed for v0.14 production readiness

## Out-of-Scope (Re-declared)

- LLM model fine-tuning
- Multi-region failover
- Webhook integrations
- Real payment
- Collaboration features
- i18n
