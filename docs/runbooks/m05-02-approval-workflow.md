# M05-02 审批流程运行与回滚

## 宝塔运行

应用数据库迁移后，在宝塔面板重启唯一的“ai选品”统一后端。0047 为 `approval_requests` 增加可空的 `decision_context_json`；新审批会保存发起时快照，旧审批保持空值并在详情明确标记当前事实回退。内部 Worker 读取 `APPROVAL_ESCALATION_POLL_MS`（默认 2000）和 `APPROVAL_ESCALATION_LEASE_SECONDS`（默认 120）；修改任一配置后必须重启“ai选品”。生产不得另建 Worker 项目或使用面板外 PM2、systemd、crontab。

检查 API 的 `/api/v1/tasks/approval-templates` 与 `/api/v1/tasks/approvals`。机会决策审批详情应返回 `snapshot_status=captured`、四类证据检查、审批/评分/利润规则版本、申请原因及 `decision_context_diff`；补采证据或重新计算后，差异中的提交值保持不变，当前值与变化明细应更新。该比较是只读的，不得新增评分运行、审批动作或证据记录。若新请求仍为 `live_fallback`，先检查 0047 是否应用以及 Node 是否已重启；历史回退详情没有可靠提交快照，`decision_context_diff.available` 必须为 false。再观察 Worker 日志队列名 `approval_escalation`：`queued` 任务到期后应成为 `succeeded`，对应节点保留 pending，但 active approver 改为超时接收人，并产生 `approval.overdue` Outbox。超时后请求若自动变成 approved/rejected 属于严重故障，应立即在宝塔停止 Worker。

页面核对时分别请求 `involvement=decidable` 与 `involvement=requested`，确认前者只返回当前用户可处理节点、后者只返回当前用户发起的审批；状态筛选必须在数据库分页前叠加，相同条件重复请求的编号顺序必须一致且相邻页不得重复。页头数量只代表当前页，分页总量以“共 N 项”为准。具备 `task:assign` 的账号应看到配置模板和发起审批，无该能力的只读账号不得看到写入口，直接调用写接口仍应返回 403。模板表单必须以当前工作区成员选项配置审批人和超时接收人；发起审批选定模板后，资源类型应由模板锁定。

通知中的 `approval` 深链应直接打开对应详情，顶部持续展示影响范围和判断依据，`from` 返回通知中心；不存在或跨工作区的编号应提示后保留当前列表。任务详情链接必须使用 `/tasks/{taskId}`，包括历史快照读取结果。保存过快照的详情还应展示“提交快照与当前证据”，逐项标出变化前后值；没有变化时明确显示保持一致。每个节点还应显示原审批人、当前审批人、超时接收人和超时后的升级方向；已升级节点必须显示升级时间，未升级节点不得伪造已代理。批准、驳回或升级后，操作记录必须展示真实成员、时间和原因。此查询合同变更需要发布前后端并在宝塔重启“ai选品”，不需要迁移或新增环境变量。

失败租约到期可被其他轮询接管；同一 node run 只有一个升级任务。连续三次处理失败进入 dead_letter，运维核对 request_id/trace_id、成员范围及 MySQL 后再人工恢复为 queued，不得直接篡改审批结论。

## 第二阶段审批交互核对（2026-09-07）

P25规格及逐动作合同见`design-plans/ui-phase-2-2026-09-07/page-specs/P25.md`和`approval-notification-contract-review.md`。本次前端局部修复：详情采用原生模态，打开后焦点进入关闭按钮，Tab/Shift+Tab在可见控制间循环，Escape/关闭/真实遮罩点击返回触发器；详情内部留白不算遮罩。409决策错误应在详情内可读并保留原因，重开清旧原因/错误。模板/发起表单提交时，如果必填审批人、超时接收人或资源编号在折叠区，浏览器校验应自动展开该区并聚焦首个缺项，未填写时不得发请求。批准/驳回、版本、模板及超时升级合同没有改变。

复验使用m05-02-approval-workflow中的UI2-AN01/AN02/AN04和原模块用例；这些是局部隔离Vue证据，不证明全新视觉或生产已验。运行代码只改变前端，无新增SQL/环境变量，修复自身无需Node/Python重启。正式发布仍走`python scripts/deploy-baota.py`，需核实既有迁移白名单、恢复材料和宝塔停启窗口，不假定部署器是纯前端上传。

## 回滚

先在宝塔停止“ai选品”，等待 `approval_escalation_jobs.status='leased'` 的租约结束，再下线审批入口与 API。只回滚本次快照能力时，先回滚应用，再执行 `0047_approval_decision_context_snapshot.down.sql`；该操作会删除已保存快照，生产已有新审批时必须先备份且通常不应执行。若不存在任何需保留的审批历史，才可继续执行 `0018b_approval_workflow_m05_02.down.sql`；该脚本按外键逆序删除本模块表。审计、全局 Outbox 和已形成的审批动作不得为了回滚而删除。
