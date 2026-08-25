# M05-01 业务任务中心运行与回滚

## 宝塔运行

应用迁移后在宝塔重启唯一的“ai选品”统一后端。内部 Worker 读取 `BUSINESS_TASK_PROJECTION_POLL_MS` 和 `BUSINESS_TASK_PROJECTION_LEASE_SECONDS`；调整后必须在宝塔重启“ai选品”。生产不得另建 Worker 项目或使用面板外 PM2、systemd、crontab。

观察 Node Worker 日志中的 `business_task_projection`，并检查 `/api/v1/tasks`。成功投影应生成中文标题的 `sourcing_purchase` 任务，把 `sourcing_outbox.status` 更新为 `published` 并清空 `leased_by`、`leased_at`、`lease_expires_at`；该表没有 `published_at` 字段。若日志出现 `Illegal mix of collations`，说明运行包没有包含采购 ID 从 `ascii` 到 `utf8mb4` 的显式转换。`not_set` 表示上游未提供期限，不是故障。租约过期会被下一次轮询接管；来源唯一键避免重复任务。

任务详情前端路由为 `/tasks/{taskId}`；列表状态、搜索、排序与分页位于 URL，详情只接受原 `/work` 或 `/tasks` 筛选作为返回地址。直接访问详情时只应读取详情与成员目录，不应请求隐藏的任务列表和汇总。搜索覆盖当前组织和工作区内的标题与说明，排序只接受 `priority_due`、`due_asc`、`updated_desc`、`created_desc`；筛选或翻页会清空本页选择，避免批量操作误带不可见记录。任务活动按时间合并事件与评论，SLA 同时显示等级、期限和下一步。暂停任务应固定显示最近一次 pause 事件原因与当前成员目录中的负责人。批量延期和负责人调整先核对选择数、可执行数与跳过数，再确认新截止时间或当前工作区成员；每项应产生独立 `task.delay` 或 `task.transfer` 事件，并核对页面汇总的成功、失败、跳过数量。

详情页回归至少覆盖：只读角色没有状态、转交、编辑、进度、评论和删除入口；仅 `task:update` 的角色不能转交；写请求进行中按钮禁用且双击只产生一次请求；相同幂等键的并发详情写请求返回同一版本且数据库只新增一组 task operation/event/audit/outbox；进度事件 payload 保留当次 `progress_note`；404、401、403、429、超时或依赖失败时状态在详情路由内可见并可重试；删除当前详情后返回已校验的来源列表。当前详情页批次不新增迁移、环境变量、依赖或 API 契约；需重新构建并发布前端和 Node API 运行包，并在宝塔重启“ai选品”使 API 代码生效，Node Worker、Python Crawler、MySQL 与 Redis 无需因本批次重启。

## 故障与回滚

先在宝塔停止“ai选品”，确认 `sourcing_outbox.status='leased'` 的记录已完成或租约到期，再回滚应用。执行 down 迁移前会把残留 leased 恢复 queued，然后移除租约列及 M05-01 表。若已产生需保留的业务任务，先备份，不执行破坏性 down；回滚应用并关闭 `/work`、`/tasks` 入口。审计与已发布的全局 Outbox 不应为掩盖失败而删除。
