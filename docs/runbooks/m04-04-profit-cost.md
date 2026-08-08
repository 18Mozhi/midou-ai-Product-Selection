# M04-04 利润与成本 Runbook

## 宝塔部署

1. 在维护窗口执行 `0017d_profit_cost_m04_04.up.sql`，确认 MySQL 5.7、`product_scout` 业务账号和 `utf8mb4`。
2. 在宝塔 Node 项目中部署 API 和 Worker 构建；不得创建面板外 PM2、systemd、crontab 或 Docker 服务。
3. 在宝塔 Worker 受限环境设置 `PROFIT_CALCULATION_POLL_MS` 与 `PROFIT_CALCULATION_LEASE_SECONDS`，然后重启宝塔 Node Worker。API 路由变更后同时重启宝塔 Node API。
4. 访问 `/sourcing` 创建显式费用规则，完成选品经理与组织管理员双审批后发布；未审批规则不会参与计算。

## 运行检查

- 确认队列没有长时间 `leased`，失败按 1/5/15 分钟重试，四次后进入 `dead_letter`。
- 对 `insufficient_data` 先检查 `missing_fields`；不得直接把缺失费用或汇率填为零。
- 汇率 Provider 必须已启用并声明 `exchange_rate`。停用 Provider 后，新计算不再选用其报价；既有运行仍保留原汇率快照。
- 使用 `request_id` / `trace_id` 对照 `opportunity_events` 和 `opportunity_outbox`。

## 调节与回滚

- 轮询间隔允许 250–60000 ms，租约允许 30–3600 秒；修改后必须在宝塔重启 Node Worker。
- 费用业务值不可通过环境变量调整；应创建新规则版本并重新完成双审批。
- 业务回滚：对当前活动规则调用 `rollback` 并指定同市场同平台的已批准或停用版本，后续任务使用目标版本，历史运行不改写。
- 数据库回滚：停止宝塔 Node API/Worker，确认没有 M04-04 业务数据需要保留后执行 down migration。该操作删除利润与费用表，属于破坏性操作，生产执行前必须备份并获得明确授权。
