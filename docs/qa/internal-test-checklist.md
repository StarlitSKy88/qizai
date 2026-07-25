# qizai MVP 手动内测 Checklist

> **给昴君** —— 蕾姆把所有 e2e spec 跑通的同时，您可以用浏览器手动走一遍验证。
> 每个步骤有"成功标志"（看到就勾 ✅）+ "失败排查"（卡住时看这里）。

## 🚀 启动环境

### 终端 1：启动 API
```bash
cd apps/api
NODE_ENV=test WXPAY_USE_SANDBOX=true pnpm dev
```
成功标志：`[wrangler] Ready on http://localhost:8787`

### 终端 2：启动 Web
```bash
cd apps/web
pnpm dev
```
成功标志：`VITE ready in xxx ms` + `Local: http://localhost:5173/`

### 终端 3：打开浏览器
访问 **http://localhost:5173/**

---

## ✅ 8 步主流程清单

### 步骤 1：首页可见 + 视频背景播放
- [ ] 页面顶部有 Hero 文案
- [ ] 背景视频在自动播放（或显示静态封面图，无报错）
- [ ] 滚动到底部有 Footer + 社交链接
- **失败排查**：打开浏览器 console 看红色错误 → 通常是 video CDN 拉不到（predev 脚本问题）

### 步骤 2：注册新账号
- [ ] 点 NavBar 的 "Sign Up"
- [ ] 填邮箱（建议 `test+001@qizai.tld` 这种带数字的，便于识别）
- [ ] 密码 ≥ 8 位 + 确认密码一致
- [ ] 点提交 → **自动跳转到 /predict 页**
- [ ] NavBar 右上角出现你的邮箱头像
- **失败排查**：
  - 跳转到 `/signup?error=...` → 看错误码
  - 邮箱已存在 → 换一个
  - API 没起来 → 检查终端 1

### 步骤 3：登出再登录
- [ ] NavBar 右上角点菜单 → "Log out"
- [ ] 自动跳到 `/`
- [ ] 重新点 "Log in" → 填刚注册的邮箱密码
- [ ] 跳到 `/predict`
- **失败排查**：登录失败 → 看 Network 标签的 `/api/auth/login` 响应

### 步骤 4：访问 /pricing 看套餐
- [ ] 在 NavBar 点 "Pricing"
- [ ] 看到 3 个套餐卡：个人版 ¥29 / 团队版 ¥299 / 加量包 ¥9.9
- [ ] 每个套餐有"购买"按钮
- **失败排查**：套餐文案空白 → 检查 `apps/web/src/pages/Pricing.tsx` 的 PLAN_AMOUNTS 数据源

### 步骤 5：（沙箱）触发购买浮层
- [ ] 进入 /predict 页
- [ ] 把 "输入描述" 留空 → 点"开始预测"
- [ ] 应该弹出"免费 quota 已用完"的 BuyModal（首次用户不一定弹，看顶部 quota badge 数字）
- [ ] 或者：连续预测 3 次让 quota 变 0
- [ ] BuyModal 显示"个人版 / 团队版 / 加量包"3 个 tab
- **失败排查**：
  - 浮层不弹 → 看 console 的 BuyModal 错误
  - 沙箱支付凭证未配置 → 检查 `apps/api/wrangler.toml` 的 WXPAY_USE_SANDBOX

### 步骤 6：（沙箱）创建订单 + 模拟回调
- [ ] BuyModal 选"个人版" → 点购买
- [ ] 弹窗内显示二维码图片（base64）
- [ ] 看到 `orderId`（复制下来）
- **手动模拟微信回调**（沙箱下不会真触发）：
```bash
# 用 curl 模拟 WXPay 回调（用刚拿到的 orderId）
curl -X POST http://localhost:8787/api/checkout/callback \
  -H "Content-Type: application/json" \
  -H "Wechatpay-Signature: TEST_sig" \
  -H "Wechatpay-Timestamp: 1700000000" \
  -H "Wechatpay-Nonce: test-nonce" \
  -H "Wechatpay-Serial: TEST_SERIAL_0001" \
  -d '{"out_trade_no":"<刚才的orderId>","trade_state":"SUCCESS"}'
```
- [ ] 响应是 `SUCCESS` 200
- [ ] BuyModal 自动跳到"支付成功"
- [ ] NavBar 的 quota badge 增加 30
- **失败排查**：
  - 401 INVALID_SIGNATURE → 沙箱 TEST_ 前缀检查通过，应该 OK
  - 500 → 看 api 终端的红色日志

### 步骤 7：用 quota 做真实预测
- [ ] 在 /predict 输入一段描述（例："我想做个 SaaS 产品"）
- [ ] 点"开始预测"
- [ ] 流式输出开始（loading 状态）
- [ ] 最终跳转到 `/report/:id`
- **失败排查**：
  - 流式断流 → 看 Network 标签的 `/api/predict/stream` 是不是 SSE 格式
  - 跳转失败 → 看 console 错误

### 步骤 8：报告页可见 + 分享链接
- [ ] 报告页有标题 + 长文本
- [ ] 有"复制链接"按钮 → 点复制
- [ ] 打开新隐身窗口 → 粘贴链接访问
- [ ] **如果没登录**应该看到 401 提示或重定向到 /login
- **失败排查**：复制按钮没反应 → 看 console

---

## 🧪 错误场景（可选）

### 错误 1：邮箱重复注册
- 用同邮箱再注册一次 → 应提示"邮箱已注册"
- **预期**：4xx 友好提示，不崩溃

### 错误 2：错误密码登录
- 故意输错密码 → 应提示"邮箱或密码错误"
- **预期**：模糊错误（不区分"邮箱不存在"和"密码错误"，防枚举）

### 错误 3：未登录访问 /predict
- 登出后访问 /predict → 应重定向到 /login
- **预期**：登录后自动跳回 /predict

### 错误 4：刷新页面
- 在 /predict 页刷新 → 应保持登录态（localStorage 持久化 JWT）
- **预期**：不闪退、不掉登录

---

## 📝 测试记录表

| 测试人 | 邮箱 | 完成步骤 | 失败步骤 | 备注 |
|---|---|---|---|---|
| 昴君（您） | | | | |
| （可选）招募用户 1 | | | | |
| （可选）招募用户 2 | | | | |

---

## 💡 反馈给蕾姆

发现任何问题请告诉蕾姆：
- **哪个步骤**（步骤 1-8 或错误场景）
- **具体现象**（截图 / 报错文字 / Network 响应）
- **预期行为**（您觉得应该怎样）

蕾姆会立刻修 💙