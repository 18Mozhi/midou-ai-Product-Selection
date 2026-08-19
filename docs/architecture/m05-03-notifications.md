# M05-03 Outbox 与通知架构

宝塔 Node Worker 从全局 `outbox_events` 以租约读取任务、审批和竞品事件，按事件载荷或当前审批节点解析当前组织/工作区内的接收人，并以 `source_event_id + recipient_id` 唯一键生成站内通知。重放不会产生重复通知；失败按配置重试，达到上限进入 dead_letter。事件发布完成后状态为 published，M05-04 SSE 将消费通知事实而不是抢占全局 Outbox。

`notifications` 始终包含 organization_id、workspace_id、recipient_id，API 查询还强制 recipient_id 等于当前用户。已读/未读与偏好使用版本锁和幂等键，写入审计。`notification_preferences` 控制任务、审批、竞品类别及站内/邮件渠道。邮件适配器在 M05-03 固定为 `placeholder`：启用邮件只写 `pending_placeholder` 投递记录，不读取或发送用户邮箱，不产生任何外部副作用。

每条通知持久化 `workflow_status`（`open`、`in_progress`、`closed`）和 `root_cause_key`。列表先在 MySQL 5.7 中应用当前组织、工作区、接收人、分类、未读和处理状态过滤，再按根因键分组和分页；每组以 `created_at + id` 最新的一条作为代表并返回真实 `group_count`，因此同根因记录不会因跨页重复。详情重新计算同范围组数，开始处理、关闭和重新打开只更新被操作的代表通知，并保留原始通知事实、审计与版本锁。

视觉依据为概念图 17 通知中心和 18 消息详情；实现保留分类、未读、处理状态、同根因摘要、详情、偏好和移动布局，但不采用图片中的示例数据。Worker 按通知类别生成中文业务正文，不把 Outbox 事件代码拼进用户文案；前端对升级前已落库的“事件代码 + 可审计事件”旧正文做只读中文展示兼容，不改写数据库事实。UUID、根因键及内部来源代码只在折叠技术详情中展示。
