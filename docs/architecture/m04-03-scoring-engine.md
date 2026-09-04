# M04-03 评分规则引擎

## 边界

评分规则、输入、任务、运行和分项均以 `organization_id + workspace_id` 隔离。规则只接受显式权重与阈值，不内置业务默认值；输入必须携带来源、时间、版本、证据 ID 或明确缺失字段。M04-04 至 M04-06 负责产生后续利润、竞品和供应链事实，本模块不伪造这些输入。

## 状态与计算

规则状态为 `draft → pending_approval → approved → active`，并支持 `rejected`、`retired`、`rolled_back`。提交使用 `opportunity:decide`，批准、启用和回滚使用 `opportunity:approve`。启用或回滚会为当前工作区机会创建新评分任务，但不修改历史运行。

必需维度有效覆盖低于 50% 时，综合分、置信度和自动结论为 `insufficient_data`。覆盖达到 50% 后，综合分按“可用输入分数 × 权重 ÷ 可用权重合计”计算，并以覆盖率作为置信度。只有覆盖至少 80%，且市场、竞争、成本证据组都存在时，结果才可达到 `recommend`；缺少核心证据时最多进入观察性结果。每次运行保存规则版本、输入版本快照、分项权重、证据 ID 和缺失项。

评分 Worker 在写入新运行前把当前评分输入中的证据 ID 解析到同组织、同工作区的 `raw_evidence`。若相同 Provider 与 Parser 的最近一次核对状态为 `failed`，或该证据仍有开放的严重质量问题，本次 Job 以 `score_blocked_by_data_quality_regression` 终止，不写评分运行、不覆盖机会既有分数，并追加 `opportunity.score.blocked_by_data_quality` 事件与 Outbox。`insufficient_sample` 继续按警告事实处理，不冒充已通过，也不在没有失败事实时扩大为评分阻断。

## 发布前影响预览

草稿、待审批和已批准但未启用的规则可按分页对当前工作区机会执行只读试算。预览与评分 Worker 共用 `calculateScoreProjection`，只读取机会当前分数、当前规则版本和持久化的当前评分输入，返回当前值、试算值、分差、结论变化、覆盖率与缺失项。预览不创建 `opportunity_score_runs`、不排队 Job、不更新机会或规则，也不写审计与 Outbox；页面汇总明确限定为当前页，避免把分页样本冒充全工作区统计。接口需要 `opportunity:approve`，用于发布前复核而不是普通只读浏览。

评分规则页把规则管理收敛为“评分与质量门”：首屏直接显示是否存在已启用版本，以及该版本是否显式要求市场、竞争、成本证据组和风险维度。该准备度只解释评分规则自身的覆盖，不能把竞品监控规则、费用规则或单个商品的质量门结果推断为已通过；完整自动推荐仍按 M04-02 的五项事实联合判断。

## 事务与运行

规则动作、输入记录、任务创建、审计事件和 Outbox 在同一 MySQL 5.7 事务中完成。Node Worker 使用数据库租约；失败最多四次，按 1/5/15 分钟退避，随后进入 `dead_letter`。Redis 只参与运行健康与协调，不作为规则、权限或评分真相。生产 API 与 Worker 只由宝塔面板管理。

## 补采触发与重新决策提醒

人工在机会详情创建的 `evidence_completion` 任务完成时，任务事务只在当前工作区存在活动评分规则时创建评分 Job，并把任务 ID 写入 `opportunity_score_jobs.trigger_task_id`。评分 Worker 完成该 Job 后，除既有不可变评分运行、组件、事件和 Outbox 外，还向全局 `outbox_events` 写 `task.evidence_completion.redecision_ready`；收件人优先使用机会负责人，无负责人时回退到补采任务执行人。通知只说明补采与重新评分已完成并要求人工重新决策，不自动采纳、观察或驳回。
