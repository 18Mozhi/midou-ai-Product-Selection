# 账号切换：Webhook 投递回执

保留原投递 ID、端点、请求号、追踪号和尝试次数。账号版回执从原投递读取端点，不复用已移除的组织字段。完成状态与事件在同一事务写入；旧租约或旧尝试不能写回，事件失败时不保留半条状态。

签名、目标和重试上限不变。此变更不触发重放或真实对外投递。运行 `npm run build:worker` 与 `node --test tests/unit/webhook-delivery-receipt.test.mjs` 验证；正式协调发布启动新版 Worker，无新增开关或手工重启。
