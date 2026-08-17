# M05-02 审批流程运行与回滚

## 宝塔运行

应用数据库迁移后，在宝塔面板重启唯一的“ai选品”统一后端。内部 Worker 读取 `APPROVAL_ESCALATION_POLL_MS`（默认 2000）和 `APPROVAL_ESCALATION_LEASE_SECONDS`（默认 120）；修改任一配置后必须重启“ai选品”。生产不得另建 Worker 项目或使用面板外 PM2、systemd、crontab。

检查 API 的 `/api/v1/tasks/approval-templates` 与 `/api/v1/tasks/approvals`，观察 Worker 日志队列名 `approval_escalation`。`queued` 任务到期后应成为 `succeeded`，对应节点保留 pending，但 active approver 改为超时接收人，并产生 `approval.overdue` Outbox。超时后请求若自动变成 approved/rejected 属于严重故障，应立即在宝塔停止 Worker。

失败租约到期可被其他轮询接管；同一 node run 只有一个升级任务。连续三次处理失败进入 dead_letter，运维核对 request_id/trace_id、成员范围及 MySQL 后再人工恢复为 queued，不得直接篡改审批结论。

## 回滚

先在宝塔停止“ai选品”，等待 `approval_escalation_jobs.status='leased'` 的租约结束，再下线审批入口与 API。若不存在需保留的审批历史，可执行 `0018b_approval_workflow_m05_02.down.sql`；该脚本按外键逆序删除本模块表。若已有业务审批，先备份且不要执行破坏性 down，只回滚应用版本并保持表只读。审计、全局 Outbox 和已形成的审批动作不得为了回滚而删除。
