# M04-05 竞品监控运维与回滚

## 宝塔上线

1. 备份 MySQL 和项目文件，在宝塔发布任务应用 `0017e_competitor_monitoring_m04_05.up.sql`。
2. 在宝塔 Node Worker 环境配置 `COMPETITOR_MONITOR_POLL_MS` 与 `COMPETITOR_MONITOR_LEASE_SECONDS`，随后重启 Node API 和 Node Worker；Vue 静态站点重新构建发布。
3. 运行 `npm run verify:module -- M04-05`，确认 MySQL 5.7、组织隔离、幂等、阈值告警、重试和页面视觉门均通过。

## 诊断与调节

- 队列积压：检查 `competitor_snapshot_jobs` 的 `status/available_at/lease_expires_at/last_error_code`，再看宝塔 Worker 日志中的 `queue=competitor_monitor`。
- 快照不更新：确认竞品为 `active`、Provider 为 `enabled`，且请求提供全部来源字段；不要手工补假值。
- 告警未产生：核对规则范围、指标、方向和显式阈值。首个快照只是基线。
- 配置修改后必须在宝塔重启 Node Worker；API 配置未动态读取。

## 回滚

先暂停写入并导出竞品身份、不可变快照、规则、变化、告警、事件和 outbox，再停止宝塔 Node Worker。应用 down 迁移会删除本模块全部表和 `competitor:manage` 授权，属于破坏性回滚；确认导出可恢复后才执行。回退代码与静态资源，最后在宝塔重启 Node API/Worker。P05 已消费的外部通知或任务不能通过本模块迁移自动撤回，应按其模块 Runbook 处理。
