# M05-05 自动化规则运维与回滚

## 宝塔配置

在宝塔 `Node Worker` 项目环境变量设置 `AUTOMATION_POLL_MS`、`AUTOMATION_LEASE_SECONDS`、`AUTOMATION_RETRY_LIMIT`、`AUTOMATION_DEFAULT_RATE_LIMIT`。配置在启动时读取，变更后必须在宝塔重启 Node Worker；API 默认限流值变更还需重启 Node API。不得创建面板外生产服务。

## 观测与故障处理

Worker 日志队列名为 `automation_rules`，应观察 `succeeded`、`rate_limited`、`retry_scheduled`、`dead_letter` 和 `dependency_failed`。规则异常时先在 `/automations` 人工暂停，再按 `request_id/trace_id` 查询 `automation_executions`、`audit_logs` 与 `outbox_events`。租约到期会自动重领；dead letter 不会自动改业务事实。

## 回滚

1. 在页面暂停所有 active 规则，并等待 leased 执行结束。
2. 在宝塔停止 Node Worker 和 Node API，备份数据库。
3. 仅当不存在 `source_type='automation'` 的任务时执行 `0018e_automation_rules_m05_05.down.sql`；否则先保留数据并停止回滚。
4. 在宝塔恢复上一版本并移除四个 `AUTOMATION_*` 配置，随后启动 API/Worker 并检查健康状态。

回滚会删除规则及执行历史，必须保留备份和审计导出。
