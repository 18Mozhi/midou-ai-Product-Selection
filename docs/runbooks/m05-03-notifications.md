# M05-03 Outbox 与通知运行及回滚

数据库迁移后在宝塔面板重启唯一的“ai选品”统一后端。内部 Worker 配置为 `NOTIFICATION_OUTBOX_POLL_MS`、`NOTIFICATION_OUTBOX_LEASE_SECONDS`、`NOTIFICATION_OUTBOX_RETRY_LIMIT`；邮件模式只能是 `NOTIFICATION_EMAIL_DELIVERY_MODE=placeholder`，其他值会阻止统一后端启动。该值只用于兼容历史投递事实，不开放邮件偏好或发送入口；修改后必须重启“ai选品”。

观察 Worker 日志队列 `notification_outbox`，确认受支持事件由 pending/leased 进入 published，通知投递 in_app 为 delivered。页面邮件偏好必须禁用，直接 API 提交 `email_enabled=true` 必须返回 `mail_provider_pending`；历史 email 只能是 pending_placeholder 或 suppressed。若出现真实 Provider 引用或外发邮件，立即在宝塔停止 Worker。租约超时会恢复，达到重试上限进入 dead_letter；依据 request_id/trace_id 修复接收人或依赖后才能人工恢复。

通知列表的 `workflow_status` 筛选和同根因聚合由 Node API 在 MySQL 查询中执行，不依赖浏览器对当前页二次过滤。排查数量不一致时，按当前 organization_id、workspace_id、recipient_id 和 delivered 站内投递范围检查 `root_cause_key`；不得通过删除旧通知来修正组数。状态动作使用通知 version 和幂等键，409 表示代表记录已经变化，应刷新后重试。

页面核对时确认分类、处理状态、仅未读和分页可由 URL 刷新恢复，`notification` 可直接打开详情；列表需同时区分已读/未读和未处理/处理中/已关闭，并明确同根因合并数量。关联业务链接必须携带 `from`，任务或审批详情应能返回原通知。该前端变化无需重启 Node 或 Python，发布 `frontend` 静态资源即可。

回滚时先在宝塔停止“ai选品”并等待 leased 到期，再关闭通知路由。必须先执行 `0046_notification_workflow_root_cause.down.sql` 移除处理状态和根因索引，再按需执行 `0018c_notifications_m05_03.down.sql`；已有通知时只回滚应用并保留表只读。不要删除全局 Outbox、审计或其他模块事件来掩盖通知故障。

## 补采后提醒验收

- 对 `task.evidence_completion.redecision_ready`，核对通知标题为“机会可重新决策”、资源类型为 `opportunity`、资源 ID 为对应机会，并确认点击后进入机会详情；普通手动评分不得产生该提醒。
