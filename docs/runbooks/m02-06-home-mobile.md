# M02-06 宝塔发布、验证与回滚

## 发布

1. 在宝塔 MySQL 5.7 使用 `product_scout` 业务账号执行 `0015b_home_dashboard_m02_06.up.sql`、`0068_automatic_selection_rule_matches.up.sql` 和 `0069_rule_based_recommendations.up.sql`，确认表字符集为 `utf8mb4`、UUID 外键为 ASCII。
2. 通过宝塔 Node 项目发布并重启 Node API 与 Node Worker，使 `/api/v1/me/home-dashboard` 和自动规则调度生效；通过宝塔网站发布 Vue Web 静态资源。Python Crawler 和 Redis 无变更，不重启，不创建面板外服务。
3. 不新增环境变量。验证桌面与 390px `/home` 首屏可直接创建第一条规则或恢复暂停规则，并在第一视口优先显示待人工采纳的推荐；状态摘要只直接显示待采纳、自动补证中和运行规则。点击“运行详情”后，必须准确显示候选、人工已采纳、采集步骤以及最近/下次采集时间；点击“数据说明”后才显示投影数、生成时间和“自动推荐不等于自动采纳”。推荐复核入口必须进入真实机会列表，不能把推荐直接写成采纳。移动端滚动到首条推荐后，其操作入口不得被固定底部导航遮挡。再验证本人任务、当前审批节点、健康提示、空状态入口和 `/opportunities/{uuid}` 的真实详情。

## 故障定位

- 首页显示“未配置”：检查活动会话的组织/工作区及 `trend_monitoring_rules.status='enabled'`。存在规则但显示“需处理”时，继续检查最近规则采集任务的阻断/失败状态；不得用前端假状态改成“运行中”。
- 首页无推荐：检查 `opportunity_rule_matches`、匹配规则是否启用、`recommendation_min_source_count`、机会 `source_count` 以及是否已有评分规则版本。无评分规则结果时，达到任一启用命中规则的独立来源门槛才写入 `recommend`；存在评分版本时仍以评分结论为准。
- 次要行动为空：检查本人未完成任务、本人当前审批节点、本人待决策机会，以及 `home_dashboard_items` 的 capability、受众、站内 route、`source_version` 与 `observed_at`。这些范围为空时保留自动选品控制台，不应把整个首页伪装为故障。
- 行动顺序异常：先核对逾期时间、暂停或关联采集阻断、任务优先级、机会风险、推荐状态与已有总分，再按 `overdue, blocking, high_risk, high_value, normal` 检查排序；不要用前端重新定义业务排序。
- 阻断项无法进入上下文：任务必须使用 `/tasks/{id}`，审批使用 `/tasks/approvals?approval={id}`，机会使用 `/opportunities/{id}`；关联采集上下文由任务详情中的 `collection_task_id` 继续下钻。
- 健康信息缺失：健康项必须将 `audience_user_id` 设置为受影响用户；禁止改为全工作区广播来绕过过滤。
- 401/403/409：重新登录、检查 capability 或重新选择组织/工作区。429/502/503/504 显示受阻并使用 `request_id` 定位宝塔 Node API 日志。

## 回滚

先在宝塔网站和 Node 项目回退 Web/API 并重启 Node API。确认后续模块未依赖首页投影后，备份必要投影并执行 `0015b_home_dashboard_m02_06.down.sql`。该表不包含原始业务真相；不得删除任务、机会、趋势、来源或证据原表。Worker/Crawler/Redis 无需处理。
