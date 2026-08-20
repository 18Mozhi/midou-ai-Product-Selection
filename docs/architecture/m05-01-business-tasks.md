# M05-01 业务任务中心架构

业务任务使用 `tasks`、不可变 `task_comments`、`task_events` 与幂等 `task_operations`，所有查询和写入同时约束 organization_id/workspace_id。状态只含 todo、in_progress、completed、cancelled；SLA 是由真实 due_at 派生的 on_track、due_soon、overdue 或 not_set，不补造期限。写事务同时写 `audit_logs` 与 `outbox_events`，请求保持 request_id/trace_id。

M04-06 的 `sourcing.purchase_task.queued` 由宝塔 Node Worker 以租约投影为 `sourcing_purchase` 任务，唯一来源约束保证重放不重复。浏览器只调用 API；读取 `task:read`，创建 `task:create`，更新/评论 `task:update`，转交 `task:assign`。M05-02 审批、M05-03 通知 Outbox 消费和 M05-04 SSE 不在本模块实现。

视觉依据为概念图 12、23–26 与高清图 01、04；保留结论、SLA、任务列表、详情和快捷动作层级，不把图中示例指标作为生产数据。

任务列表使用 `/tasks`，任务详情使用可直接分享和恢复的 `/tasks/{taskId}` 独立前端路由；详情仍消费既有 `GET /api/v1/tasks/{taskId}`，不新增 API 或持久化字段。列表行的删除入口收进独立“任务操作”菜单，避免与打开/运行任务的主操作竞争；进度主表达使用待开始、执行中、已暂停、已完成或已结束阶段，既有百分比只保留为辅助进度条事实。
