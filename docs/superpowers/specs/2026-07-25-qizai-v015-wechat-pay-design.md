# qizai v0.15.0 — WeChat Pay Checkout & Quota UI Design

> **For agentic workers:** Brainstorming output. Run `superpowers:writing-plans` next to produce the implementation plan.

**Goal:** Turn v0.14 Pricing 页面 4 个「即将上线」钩子之一（付费升级）做成商业闭环——用户扫码 → 微信支付回调 → quota 升级。

**Architecture:** CF Workers 后端封装微信支付 V3 Native 扫码（不依赖 SDK，Workers crypto 自实现）+ 新增 `orders` 表 + 前端 QuotaBadge + BuyModal + 5s 轮询订单状态。

**Tech Stack:** Hono + D1 (orders) + Workers crypto (HMAC-SHA256 + RSA) + Playwright mock + react 状态管理。

## Global Constraints

- v0.15.x 路线图：`v0.15.0` = 微信支付 + 配额 UI；`v0.15.1` = persona_id 缓存；`v0.15.2` = MCN demo 演示页；`v0.15.3` = i18n 中英双语。每个 PR 小而稳。
- 微信支付接入：**Native 扫码**（生成二维码，微信扫一扫完成）。商户主体由昴君提供（暂用环境变量 `WXPAY_MCH_ID` / `WXPAY_API_KEY_V3` / `WXPAY_PRIVATE_KEY` / `WXPAY_CERT_SERIAL` / `WXPAY_NOTIFY_URL`）。
- 套餐形式：**订阅 + 一次性加量包** 双 SKU。订阅 SKU：`personal_sub` (¥29/月) / `team_sub` (¥299/月)；加量包 SKU：`topup_100` (¥9.9/100 次)。
- 环境：**沙箱联调 + 真实账户可切**——通过 `WXPAY_USE_SANDBOX=true|false` 切换，沙箱测试不影响生产。
- 支付成功后升级：**实时轮询查单**（5s 间隔，最多 3 分钟）；用户不需手动刷新。
- 个人信息：**不索取手机号**——邮箱注册即可购买。
- 安全：微信回调**必须验签**（v3 HMAC-SHA256 + RSA 公钥解密）+ **幂等 token**（order_id 单次 UUID，重放 no-op）+ **订单归属校验**（callback 必须带 user_id 与数据库匹配）。
- 配额可见：**NavBar QuotaBadge + Predict 页顶部 banner** 双位置。
- 配额耗尽 UX：**Predict 页内联 buy modal**（不走 /pricing 跳转）。
- 数据：新建 `orders` 表；users 表加 `plan` + `quota_limit_renew_at` 列。
- 配额升级规则：订阅 plan='personal_sub' → quota_limit 永久 +30/月（renew_at 到期自动重置）；plan='topup_100' → 一次性 +100（不 renew）。
- 范围外（v0.15.0 不做）：发票 / 退款 / 自动续费 / 团队子账号管理 / 真实 openid 绑定 / cron 自动关单（v0.15.0 改"下单时检查 + 状态过期自动关闭"）。

## §一 数据模型

### 新增表 `orders`

```sql
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,                    -- UUID v4
  user_id TEXT NOT NULL,
  plan TEXT NOT NULL,                     -- 'personal_sub' | 'team_sub' | 'topup_100'
  amount_fen INTEGER NOT NULL,            -- 分（¥29 = 2900）
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'paid' | 'closed' | 'refunded'
  wx_code_url TEXT,                       -- 微信返回的扫码 URL
  wx_qr_code TEXT,                        -- base64 PNG（前端直接展示）
  wx_transaction_id TEXT,                 -- 微信回调填入
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  paid_at INTEGER,
  expires_at INTEGER,                     -- 订单超时关闭时间（created_at + 1800s）
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
```

### 改动表 `users`

```sql
ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN quota_limit_renew_at INTEGER;
```

### Migration 文件

`apps/api/migrations/0002_orders_and_user_plan.sql`——顺序应用：
1. CREATE TABLE orders + 2 个索引
2. ALTER TABLE users ADD COLUMN plan
3. ALTER TABLE users ADD COLUMN quota_limit_renew_at

注意：D1 的 ALTER TABLE ADD COLUMN 在 SQLite 下向前兼容，旧 users 行自动得默认值 `'free'` / `NULL`。

## §二 后端模块

### `apps/api/src/utils/wechat-pay.ts`

封装 4 个函数（**不依赖第三方 SDK**，全部用 Workers crypto）：

1. **`signV3(method, urlPath, body, timestamp, nonce)`** → string
   - HMAC-SHA256 over `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`
   - 输出 lowercase hex
   - 用于所有微信 V3 接口请求签名

2. **`verifyCallbackSignature(timestamp, nonce, body, signature, certSerial)`** → boolean
   - 用微信平台证书公钥（环境变量 `WXPAY_PLATFORM_CERT` 注入）RSA 验签
   - 防伪 + 防重放（nonce 单次校验由业务层做）

3. **`unifiedorderNative(orderId, amountFen, description, attach)`** → `{code_url, qr_code_base64}`
   - 调 `https://api.mch.weixin.qq.com/v3/pay/transactions/native`
   - 沙箱走 `https://api.mch.weixin.qq.com/sandboxnew/v3/pay/transactions/native`
   - 用 `qrcode` npm 包（dev dep）生成 base64 PNG

4. **`queryOrderStatus(orderId)`** → `{status, transaction_id}` | null
   - 调 `https://api.mch.weixin.qq.com/v3/pay/transactions/out-trade-no/{orderId}`
   - 返回 `status` = 'SUCCESS' / 'NOTPAY' / 'CLOSED' / 'REVOKED' / 'PAYERROR'

### `apps/api/src/routes/checkout.ts`

3 个端点：

1. **`POST /api/checkout/create`** — `requireAuth`
   - Body: `{plan: 'personal_sub' | 'team_sub' | 'topup_100'}`
   - 流程：校验 plan 白名单 → SELECT users WHERE id=? 检查 plan 不重复（订阅可续费，加量包可叠加）→ INSERT orders row (status=pending, expires_at=now+1800) → 调 `unifiedorderNative` 拿到 code_url + qr_code → UPDATE orders SET wx_code_url, wx_qr_code → 返回 `{orderId, qrCodeBase64, expiresAt, amountFen}`
   - 错误：401 AUTH_REQUIRED（未登录）/ 400 INVALID_PLAN（plan 不在白名单）/ 500 WXPAY_ERROR（微信接口失败）

2. **`GET /api/checkout/status/:orderId`** — `requireAuth`
   - 流程：SELECT orders WHERE id=? AND user_id=? → 200 返回 `{status, paidAt}`；若 status=pending 且 now > expires_at，自动 UPDATE status=closed → 返回 closed
   - 不存在或归属不符 → 404 NOT_FOUND
   - 不调微信接口（前端轮询只查本地，节省微信 API 配额）

3. **`POST /api/checkout/callback`** — **无 auth**（微信服务器调用）
   - Headers: `Wechatpay-Timestamp`, `Wechatpay-Nonce`, `Wechatpay-Signature`, `Wechatpay-Serial`
   - 流程：验签 → 解密 ciphertext（RSA）→ 解析 JSON `{out_trade_no, transaction_id, trade_state}` → SELECT orders WHERE id=out_trade_no → 不存在 → 404；归属不匹配 → 400；status 已 paid → 200 幂等 ack；trade_state='SUCCESS' → UPDATE orders SET status='paid', wx_transaction_id, paid_at → 升级 quota_limit → 200 ack "SUCCESS"
   - 失败响应：401 INVALID_SIGNATURE / 400 DECRYPT_FAILED / 404 ORDER_NOT_FOUND

### `apps/api/src/utils/quota-upgrade.ts`

封装"订单 paid → 升级 quota"逻辑，被 callback 复用：

```ts
export async function applyQuotaUpgrade(db: D1Database, userId: string, plan: OrderPlan): Promise<void> {
  const limits: Record<OrderPlan, { add: number; renewMonths: number }> = {
    personal_sub: { add: 30, renewMonths: 1 },
    team_sub: { add: 300, renewMonths: 1 },
    topup_100: { add: 100, renewMonths: 0 },
  };
  const cfg = limits[plan];
  const renewAt = cfg.renewMonths > 0 ? Math.floor(Date.now()/1000) + cfg.renewMonths * 30 * 86400 : null;
  await db.prepare(`
    UPDATE users
    SET quota_limit = quota_limit + ?,
        plan = ?,
        quota_limit_renew_at = COALESCE(?, quota_limit_renew_at)
    WHERE id = ?
  `).bind(cfg.add, plan, renewAt, userId).run();
}
```

加量包叠加（用户购买多个 topup_100）→ quota_limit 直接累加，renew_at 保持 NULL。
订阅续费（已有 plan=personal_sub 的用户再次购买）→ quota_limit 再 +30，renew_at 延长 30 天。

## §三 前端模块

### `apps/web/src/components/QuotaBadge.tsx`

- 顶部 NavBar 右侧（已登录状态显示）
- 内容：`X / Y` 文本 + 横向进度条
- 颜色规则：X ≤ 5 → 红；X = 0 → 灰
- 数据源：每 30s GET /api/users/me 拉一次
- 路由：登出后不渲染（用 `getJwt()` 判断）

### `apps/web/src/pages/Predict.tsx` 顶部 banner

- 标题下方加一行「本月剩余 X / Y」+ 「升级套餐」按钮
- 配额 ≤ 5 时 banner 变红 + 加 emoji ⚠️
- 配额 = 0 时 banner 替换为「套餐已用完 → 升级」CTA，CTA 直接打开 BuyModal

### `apps/web/src/components/BuyModal.tsx`

- 浮层 + backdrop
- 两个 tab：「订阅」/ 「加量包」
- 订阅 tab：展示 2 个套餐卡片（¥29 个人 / ¥299 团队），点击 → POST /api/checkout/create → 显示二维码 + 「微信扫一扫」图标 + 倒计时「订单将在 X 秒后关闭」
- 加量包 tab：1 个卡片（¥9.9 / 100 次预测）
- 底部：「已完成支付」按钮（手动确认触发一次 status 轮询）+ 「遇到问题？联系 support@qizai.app」

### `apps/web/src/api/billing.ts`

3 个函数：
- `createCheckout(plan)` → POST /api/checkout/create
- `pollOrderStatus(orderId)` → GET /api/checkout/status/:orderId
- `getMe()` → GET /api/users/me（顺便返回 quota_used / quota_limit / plan）

新增后端端点 `GET /api/users/me`：
- `requireAuth` 中间件
- 返回 `{userId, email, plan, quota_used, quota_limit, quota_limit_renew_at}`

## §四 流程

### 4.1 正常支付路径

1. 用户在 Predict 页点击「预测」→ POST /api/predict/stream → 配额用完 → 收到 `QUOTA_EXHAUSTED` 错误码
2. Predict.tsx 错误分支打开 BuyModal
3. 用户选套餐（personal_sub）→ POST /api/checkout/create → 后端 INSERT orders + 调微信 Native 统一下单 → 返回 qr_code_base64
4. 前端展示二维码 + 启动轮询（每 5s GET /api/checkout/status/:orderId，最多 3 分钟）
5. 用户微信扫码 → 完成支付 → 微信异步通知 POST /api/checkout/callback
6. callback 验签 → UPDATE orders SET status='paid' → applyQuotaUpgrade（quota_limit +30, plan='personal_sub', renew_at=now+30d）
7. 前端下次轮询查到 status='paid' → BuyModal 关闭 + 显示「支付成功」toast + QuotaBadge 自动刷新（轮询 /api/users/me 触发）
8. 用户可继续预测

### 4.2 错误路径

- **微信回调验签失败**：返回 401 INVALID_SIGNATURE，不更新订单。前端轮询继续（订单仍是 pending），3 分钟超时后转 closed。
- **回调重放**：幂等 ack 200，no-op。前端无感知。
- **订单超时未支付**：expires_at=now+1800s；轮询 GET /api/checkout/status 时若 now > expires_at 自动 UPDATE status=closed。前端显示「订单已关闭」+ 「重新购买」按钮。
- **重复购买同款订阅**：plan 不强制唯一（续费场景），允许在原 quota_limit 上继续累加。
- **网络异常（前端 apiFetch throw）**：BuyModal 显示「网络异常，请稍后重试」+ 「重试」按钮。

## §五 测试

### 单元（apps/api/test/unit）

| 文件 | 测试数 | 覆盖 |
|---|---|---|
| `wechat-pay.test.ts` | 4 | signV3 / verifyCallback / unifiedorder 拼包 / queryOrderStatus |
| `quota-upgrade.test.ts` | 3 | 订阅 / 加量包 / 续费累加 |

### 集成（apps/api/test/integration）

| 文件 | 测试数 | 覆盖 |
|---|---|---|
| `checkout.test.ts` | 8 | create 成功 / create 重复订阅 / status 轮询 / status 自动关闭 / callback 验签失败 / callback 幂等 / callback 升级 quota / 非用户订单 403 |

### 前端单元（apps/web/test）

| 文件 | 测试数 | 覆盖 |
|---|---|---|
| `QuotaBadge.test.tsx` | 3 | 渲染 / 颜色规则 / 登出隐藏 |
| `BuyModal.test.tsx` | 3 | tab 切换 / 二维码展示 / 倒计时 |

总计 **21 个新测试**，覆盖核心流程 + 错误路径 + 安全。

## §六 文件清单

### 新增（5 文件）

- `apps/api/migrations/0002_orders_and_user_plan.sql`
- `apps/api/src/utils/wechat-pay.ts`
- `apps/api/src/utils/quota-upgrade.ts`
- `apps/api/src/routes/checkout.ts`
- `apps/api/src/routes/users.ts` (GET /api/users/me)
- `apps/web/src/components/QuotaBadge.tsx`
- `apps/web/src/components/BuyModal.tsx`
- `apps/web/src/api/billing.ts`

### 修改（5 文件）

- `apps/api/src/index.ts` — 挂载 checkoutRouter + usersRouter
- `apps/api/src/utils/env.ts` — 新增 WXPAY_* 5 个环境变量 + 沙箱开关
- `apps/web/src/components/NavBar.tsx` — 嵌入 QuotaBadge
- `apps/web/src/pages/Predict.tsx` — 加 banner + 触发 BuyModal
- `apps/api/wrangler.toml` — 加 WXPAY_* 占位（wrangler secret put 注入）

## §七 范围外（v0.15.1+ 跟进）

- 发票 / 退款流程
- 自动续费 / 微信支付分
- 团队子账号管理（plan=team 的 5 子账号）
- 真实 openid 绑定（公众号场景）
- cron 定时关单（v0.15.0 用"轮询时检查"模拟）
- wechat-pay.ts 改为 TypeScript 完整类型导出（v0.15.0 用 `any` + 注释）

## §八 风险与开放问题

1. **微信平台证书轮换**：v0.15.0 假设 `WXPAY_PLATFORM_CERT` 是当前有效证书，过期需手动更新。v0.15.2 加自动下载 + 缓存。
2. **沙箱 vs 真实环境切换**：沙箱用不同 mch_id / api_key，需要严格区分环境变量。README 文档明示。
3. **5s 轮询频率**：3 分钟内最多 36 次，本地 DB 查询轻量；不构成性能问题。
4. **重复订阅风险**：用户连续点 2 次购买 → 2 张订单 → 2 次 quota 累加（+60 而非 +30）。BuyModal 加 5s 防抖按钮。
5. **支付成功但 quota 没升级**：callback 升级失败时 retry 3 次；最终失败写 alarm 日志 + 邮件告警（v0.15.0 用 console.error + DB log 表占位）。