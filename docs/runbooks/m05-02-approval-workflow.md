# M05-02 审批流程运行与回滚

## 宝塔运行

应用数据库迁移后，在宝塔面板重启唯一的“ai选品”统一后端。0047 为 `approval_requests` 增加可空的 `decision_context_json`；新审批会保存发起时快照，旧审批保持空值并在详情明确标记当前事实回退。内部 Worker 读取 `APPROVAL_ESCALATION_POLL_MS`（默认 2000）和 `APPROVAL_ESCALATION_LEASE_SECONDS`（默认 120）；修改任一配置后必须重启“ai选品”。生产不得另建 Worker 项目或使用面板外 PM2、systemd、crontab。

检查 API 的 `/api/v1/tasks/approval-templates` 与 `/api/v1/tasks/approvals`。机会决策审批详情应返回 `snapshot_status=captured`、四类证据检查、审批/评分/利润规则版本及申请原因；若新请求仍为 `live_fallback`，先检查 0047 是否应用以及 Node 是否已重启。再观察 Worker 日志队列名 `approval_escalation`：`queued` 任务到期后应成为 `succeeded`，对应节点保留 pending，但 active approver 改为超时接收人，并产生 `approval.overdue` Outbox。超时后请求若自动变成 approved/rejected 属于严重故障，应立即在宝塔停止 Worker。

页面核对时分别请求 `involvement=decidable` 与 `involvement=requested`，确认前者只返回当前用户可处理节点、后者只返回当前用户发起的审批；状态筛选必须在数据库分页前叠加。通知中的 `approval` 深链应直接打开对应详情，顶部持续展示影响范围和判断依据，`from` 返回通知中心。此查询合同变更需要发布前后端并在宝塔重启“ai选品”，不需要迁移或新增环境变量。

失败租约到期可被其他轮询接管；同一 node run 只有一个升级任务。连续三次处理失败进入 dead_letter，运维核对 request_id/trace_id、成员范围及 MySQL 后再人工恢复为 queued，不得直接篡改审批结论。

## 回滚

先在宝塔停止“ai选品”，等待 `approval_escalation_jobs.status='leased'` 的租约结束，再下线审批入口与 API。只回滚本次快照能力时，先回滚应用，再执行 `0047_approval_decision_context_snapshot.down.sql`；该操作会删除已保存快照，生产已有新审批时必须先备份且通常不应执行。若不存在任何需保留的审批历史，才可继续执行 `0018b_approval_workflow_m05_02.down.sql`；该脚本按外键逆序删除本模块表。审计、全局 Outbox 和已形成的审批动作不得为了回滚而删除。
