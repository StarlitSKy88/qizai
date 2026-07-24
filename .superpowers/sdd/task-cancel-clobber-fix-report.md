# Cancel clobber fix report

## 修复内容

- 取消处理只会把仍处于 `streaming` 的报告更新为 `aborted`，不会覆盖已经完成的 `done` 状态。
- 路由作用域新增一次性退款函数，`cancel` 与 predictor 异常 `catch` 共用同一幂等标记，避免重复扣减 `quota_used`。
- 新增两条集成回归测试：完成状态保护、重复退款幂等性。

## 验证结果

- API：`pnpm vitest run` — 33/33 PASS。
- API 类型检查：`npx tsc --noEmit` — PASS。
- Web 单元测试：`pnpm vitest run test` — 85/85 PASS。
- Web 原始命令：`pnpm vitest run` — 85 个单元测试均 PASS，但 Vitest 还误收集 5 个 Playwright `e2e/*.spec.ts`，因此命令 exit 1；这是既存测试配置问题，本次未改 Web 代码。
- 代码审查：检查状态转换、退款竞态、SQL 参数绑定、异常路径与 diff 空白，无 CRITICAL/HIGH 阻断项。

## 变更文件

- `apps/api/src/routes/predict.ts`
- `apps/api/test/integration/predict-stream.test.ts`
