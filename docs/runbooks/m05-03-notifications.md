# M05-03 Outbox 与通知运行及回滚

数据库迁移后在宝塔面板重启 `product-scout-api` 和 `product-scout-worker`。Worker 配置为 `NOTIFICATION_OUTBOX_POLL_MS`、`NOTIFICATION_OUTBOX_LEASE_SECONDS`、`NOTIFICATION_OUTBOX_RETRY_LIMIT`；邮件模式只能是 `NOTIFICATION_EMAIL_DELIVERY_MODE=placeholder`，其他值会阻止进程启动。修改后必须在宝塔重启 Worker。

观察 Worker 日志队列 `notification_outbox`，确认受支持事件由 pending/leased 进入 published，通知投递 in_app 为 delivered。email 只能是 pending_placeholder 或 suppressed；若出现真实 Provider 引用或外发邮件，立即在宝塔停止 Worker。租约超时会恢复，达到重试上限进入 dead_letter；依据 request_id/trace_id 修复接收人或依赖后才能人工恢复。

回滚时先在宝塔停止 Worker并等待 leased 到期，再关闭通知路由。没有需保留通知时执行 `0018c_notifications_m05_03.down.sql`；已有通知时只回滚应用并保留表只读。不要删除全局 Outbox、审计或其他模块事件来掩盖通知故障。
