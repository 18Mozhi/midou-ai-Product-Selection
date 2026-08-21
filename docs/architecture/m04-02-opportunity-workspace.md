# M04-02 机会工作台架构

机会是当前组织与工作区内的候选决策资源。API 从服务端会话解析范围，`opportunity:read` 保护列表与详情，既有 `opportunity:decide` 保护创建和人工决策；浏览器写入还要求同源 `Origin`、`Idempotency-Key` 和乐观 `version`。

人工创建事务同时写 `opportunities`、刷新任务、事件、Outbox 和幂等操作。趋势来源必须是同一组织、工作区的活动 `trend_topic`。宝塔管理的 Node Worker 以 MySQL 5.7 租约刷新证据链接，只引用已存在的 `trend_signals` 与 `raw_evidence`，不复制或删除原始证据。来自 M04-01 商品型自动热点频道的新主题会在趋势投影事务中自动创建待评估选品并写 `opportunity.candidate.discovered`；该候选只有真实趋势证据，不等于推荐或自动采纳。

M04-02 的事实边界是：趋势证据可使市场分区变为 covered，但单一市场证据只能得到 `partial` 覆盖。评分、利润、竞品和风险输入分别由后续模块交付；当前值保持 null、`insufficient_data` 或 `unknown`。人工决定单独留痕，不修改原始评分与证据。

机会列表的证据完整度筛选直接匹配持久化 `coverage_status`（`insufficient`、`partial`、`complete`），与组织、工作区和其他列表条件共同下推到 MySQL。该筛选不推断推荐质量、利润状态或风险结论。

机会列表的阻断原因筛选只复用采纳接口已经执行的事实条件：`evidence_insufficient` 对应证据数为零或覆盖状态为 `insufficient`，`recommendation_insufficient` 对应推荐状态为 `insufficient_data`。列表响应返回同一组 `blocking_reasons` 并在界面翻译为中文；不把利润不足或风险未知擅自升级为采纳阻断。

机会列表同时将持久化 `lifecycle_status`、`owner_id` 下推到 MySQL 筛选；未显式筛选阶段时默认排除 `archived`。`POST /opportunities/batch` 在单个事务内锁定 1–50 个机会并逐项校验 version，支持把负责人改为当前组织且可访问当前工作区的活动成员、进入归档阶段，或进入验证阶段并创建/复用 `selection_verification` 人工任务。任一机会不存在、越权或版本冲突都会整批回滚，每个成功机会写独立事件与 Outbox。

数据不足的详情可通过 `POST /opportunities/{id}/evidence-completion-tasks` 创建或复用唯一 `evidence_completion` 补数任务，不再跳转到未关联机会的通用任务表单。任务完成事务会检查当前工作区活动评分规则：存在时写入 `opportunity_score_jobs` 并把未归档机会切到验证中；不存在时明确返回 `waiting_for_active_rule`，不伪造已重新评分。评分仍由宝塔 Node Worker 基于已持久化输入重新计算。

机会详情按结论、证据、利润、风险优先展示，并在用户界面把来源、覆盖、利润、风险和决策状态转换为中文；每条证据统一显式标注“证据新鲜度：观测于”及真实观测时间，不在没有来源时效规则的情况下猜测新鲜、临期或过期阈值。原始状态码仅保留在 API 与技术诊断数据中。

趋势、机会和平台采集总览的筛选在桌面端保持内联，在 760px 及以下进入同一个可访问抽屉。抽屉只改变呈现方式，不重建表单，因此关闭后仍保留已选条件。

`OpportunityListPanel.vue` 独立承载机会筛选、摘要与列表，`OpportunityWorkspaceDialogs.vue` 承载 ERP 导入、机会创建与留痕决策弹窗，详情数据编排继续由 `OpportunityWorkspace.vue` 负责；各弹窗进入浏览器顶层模态层并统一处理 Esc、焦点约束与关闭后的焦点归还，避免单个页面组件重新超过千行门禁。

列表和详情使用独立 `/opportunities`、`/opportunities/{opportunityId}` 路由。列表筛选、范围和页码同步到 URL；进入详情时以同源 `from` 查询参数保存完整来源路径，返回后恢复原筛选与页码。详情分区使用 `tab` 查询参数支持直接定位。详情移除重复页面大标题卡，将推荐结论放在内容首屏，并把采纳、观察、驳回和证据补齐入口放入固定底部决策栏；390px 下标签横向滚动，决策栏避让系统安全区与成员底部导航。

所有业务写入、Worker 写入和失败均携带 request_id/trace_id。四次总尝试与 1/5/15 分钟退避在代码中锁定；不可重试错误进入 `failed_terminal`，依赖错误耗尽后进入 `dead_letter`。
