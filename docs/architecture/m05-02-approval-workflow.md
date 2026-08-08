# M05-02 审批流程架构

审批流程以 `approval_templates` 和不可变 `approval_template_versions`/`approval_template_nodes` 定义。模板先保存草稿，再以 revision 乐观锁显式发布；审批请求只绑定已发布的准确版本，后续模板变化不会改写历史实例。请求必须引用当前组织、当前工作区内存在的任务或机会决策。

实例化时复制节点名称、审批人、SLA 和超时接收人到 `approval_node_runs`。任一时刻只有一个 pending 节点，批准后按序启用下一节点，最终批准或任一驳回结束请求。批准与驳回都必须填写原因并追加 `approval_actions`；请求 version 防止并发覆盖。读取使用 `task:read`，模板、发起和决策使用管理职责已有的 `task:assign`，API 和仓储同时执行组织/工作区约束。

宝塔 Node Worker 以租约消费 `approval_escalation_jobs`。节点超时只把 active approver 切换到显式配置的 escalation assignee，追加 escalated 动作、审计和 `approval.overdue` Outbox；绝不自动批准或驳回。M05-03 负责消费 Outbox 生成通知，M05-04 负责 SSE，本模块不越界发送通知或建立实时连接。

视觉依据为 `images-html/01_72_page_concepts/27_任务审批.jpg` 与 `60_审批流程.jpg`；实现保留审批收件箱、节点时间线、状态、原因和模板层级，图片中的示例数量不作为生产数据。
