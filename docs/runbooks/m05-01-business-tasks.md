# M05-01 业务任务中心运行与回滚

## 宝塔运行

应用迁移后在宝塔重启唯一的“ai选品”统一后端。内部 Worker 读取 `BUSINESS_TASK_PROJECTION_POLL_MS` 和 `BUSINESS_TASK_PROJECTION_LEASE_SECONDS`；调整后必须在宝塔重启“ai选品”。生产不得另建 Worker 项目或使用面板外 PM2、systemd、crontab。

观察 Node Worker 日志中的 `business_task_projection`，并检查 `/api/v1/tasks`。`not_set` 表示上游未提供期限，不是故障。租约过期会被下一次轮询接管；来源唯一键避免重复任务。

任务详情前端路由为 `/tasks/{taskId}`。本次详情深链、行尾操作菜单和阶段文案只需发布新版 `frontend` 静态资源，不新增迁移、环境变量或 API，Node、Python、MySQL 与 Redis 均无需重启。

## 故障与回滚

先在宝塔停止“ai选品”，确认 `sourcing_outbox.status='leased'` 的记录已完成或租约到期，再回滚应用。执行 down 迁移前会把残留 leased 恢复 queued，然后移除租约列及 M05-01 表。若已产生需保留的业务任务，先备份，不执行破坏性 down；回滚应用并关闭 `/work`、`/tasks` 入口。审计与已发布的全局 Outbox 不应为掩盖失败而删除。
