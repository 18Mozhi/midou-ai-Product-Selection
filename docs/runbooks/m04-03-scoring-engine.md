# M04-03 评分规则引擎 Runbook

## 部署

1. 在惠州生产库以 `product_scout` 业务账号执行 `0017c_scoring_rules_m04_03.up.sql`，确认 MySQL 5.7 与 `utf8mb4`。
2. 在宝塔受限环境设置 `OPPORTUNITY_SCORING_POLL_MS` 和 `OPPORTUNITY_SCORING_LEASE_SECONDS`；不得写入浏览器配置。
3. 由宝塔面板依次重启 Node API、Node Worker，再检查 `/api/v1/health/ready`、Worker 日志中的 `opportunity_scoring: registered` 和关联 `request_id/trace_id`。
4. 创建规则时显式填写权重和阈值；提交、批准、启用前先打开“预览影响”，核对当前页的当前分数、试算分数、分差、结论变化和覆盖率；确认预览未产生评分运行或 Job。
5. 启用后用一个真实机会验证部分覆盖不推荐、三类证据齐全后才可推荐。

## 告警与恢复

- `retry_scheduled` 持续增长：检查 MySQL 锁、连接和 Worker 租约；不要在面板外启动第二套生产 Worker。
- `failed_terminal`：核对机会/规则是否属于同一组织和工作区，或规则版本是否仍可复现。
- `score_blocked_by_data_quality_regression`：当前评分输入关联证据的最新 Provider/Parser 核对失败，或证据仍有开放严重质量问题。先在数据质量页处理问题并完成通过核对，再以新 Job 重新评分；不得直接改 Job、旧评分运行或机会分数。
- `dead_letter`：保留原任务和全部运行；修复依赖后以新幂等键重新排队，不直接改写运行记录。
- 结果异常：按运行的 `rule_version_code`、输入快照、分项、证据和缺失项复核。人工决策只能覆盖展示结论，不能改写原始分数。

## 回滚

应用回滚时先在 UI 停止新建/启用规则，再由宝塔回滚 API 与 Worker。业务规则回滚使用受审计的 `rollback` 动作，目标必须是当前工作区已批准或已停用版本，且仅影响后续计算。数据库迁移回滚前必须导出规则、动作、输入、运行与分项；确认不再需要保留后才执行 `0017c_scoring_rules_m04_03.down.sql`，不得删除审计证据掩盖失败。

## 补采后提醒验收

完成一条 `evidence_completion` 任务后，检查新评分 Job 的 `trigger_task_id` 与任务 ID 一致。Worker 完成评分后应新增 `task.evidence_completion.redecision_ready` Outbox；通知投影后，机会负责人或任务执行人的通知中心出现“机会可重新决策”，入口直达对应机会。手动重新评分的 Job 没有 `trigger_task_id`，不得生成补采完成提醒。
