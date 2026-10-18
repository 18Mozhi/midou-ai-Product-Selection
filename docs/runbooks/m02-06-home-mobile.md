> 2026-10-18 当前成员界面已收敛为情报、证据和选品流程，不再提供关键词监控、关注或主题治理表单。本文相关历史操作不再是成员入口；后台 API、审计、数据及存量调度本轮保留。当前使用与验证见 `docs/selection-member-intelligence-flow.md`。

# M02-06 宝塔发布、验证与回滚

## 发布

1. 在宝塔 MySQL 5.7 使用 `product_scout` 业务账号执行 `0015b_home_dashboard_m02_06.up.sql`、`0068_automatic_selection_rule_matches.up.sql`、`0069_rule_based_recommendations.up.sql`、`0070_rule_candidates_quality_gate.up.sql` 和 `0071_opportunity_migration_timestamp_timezone.up.sql`。0070 会把历史上仅凭来源门槛写成 `recommend` 且尚无评分版本的待决策记录恢复为 `insufficient_data`；0071 只校正这批记录的迁移时间显示，不删除机会、证据或人工决策。
2. 通过宝塔 Node 项目发布并重启 Node API 与 Node Worker，使 `/api/v1/me/home-dashboard` 和自动规则调度生效；通过宝塔网站发布 Vue Web 静态资源。Python Crawler 和 Redis 无变更，不重启，不创建面板外服务。
3. 不新增环境变量。验证桌面与 390px `/home` 首屏可直接创建第一条规则或恢复暂停规则，并在第一视口显示“待你采纳 / 规则命中候选 / 采集中 / 运行规则”四项真实计数。推荐清单只能列出五项质量门全部通过的商品；规则候选只计数、不伪装成人工待办。点击“运行详情”后，必须准确显示候选、人工已采纳、采集步骤以及最近/下次采集时间；推荐入口必须进入真实机会列表，不能把推荐直接写成采纳。

## 故障定位

- 首页生产验收：本地执行 `node scripts/verify-home-dashboard-live.mjs --baota-production`。探针通过固定宝塔节点连接生产 MySQL，只预检 `home_dashboard_items` 等既有 schema，不执行 DDL；会写入随机临时验收数据并在结束时清理，不要中断清理步骤。

- 首页显示“未配置”：检查活动会话的组织/工作区及 `trend_monitoring_rules.status='enabled'`；展开“运行详情”后，“监控平台”步骤必须是未完成且显示零条规则。存在规则但显示“需处理”时，继续检查最近规则采集任务的阻断/失败状态；不得用前端假状态改成“运行中”。
- 首页无推荐：先检查 `opportunity_rule_matches`、规则启用状态、`recommendation_min_source_count` 与机会 `source_count`。达到门槛后应只增加“规则命中候选”；再依次核对评分结论与完整覆盖、市场分、竞争分、利润成本计算和风险输入。任何一项未通过都不进入推荐清单。
- 次要行动为空：检查本人未完成任务、本人当前审批节点、本人待决策机会，以及 `home_dashboard_items` 的 capability、受众、站内 route、`source_version` 与 `observed_at`。这些范围为空时保留自动选品控制台，不应把整个首页伪装为故障。
- 行动顺序异常：先核对逾期时间、暂停或关联采集阻断、任务优先级、机会风险、推荐状态与已有总分，再按 `overdue, blocking, high_risk, high_value, normal` 检查排序；不要用前端重新定义业务排序。
- 阻断项无法进入上下文：任务必须使用 `/tasks/{id}`，审批使用 `/tasks/approvals?approval={id}`，机会使用 `/opportunities/{id}`；关联采集上下文由任务详情中的 `collection_task_id` 继续下钻。
- 健康信息缺失：健康项必须将 `audience_user_id` 设置为受影响用户；禁止改为全工作区广播来绕过过滤。
- 401/403/409：重新登录、检查 capability 或重新选择组织/工作区。429/502/503/504 显示受阻并使用 `request_id` 定位宝塔 Node API 日志。

## 回滚

先在宝塔网站和 Node 项目回退 Web/API 并重启 Node API。确认后续模块未依赖首页投影后，备份必要投影并执行 `0015b_home_dashboard_m02_06.down.sql`。该表不包含原始业务真相；不得删除任务、机会、趋势、来源或证据原表。Worker/Crawler/Redis 无需处理。

## 2026-10-16 工作台更新

首页可见且激活时每 5 秒重新读取汇总，回到页面或重新聚焦立即读取；切离缓存页中止请求并停止读取，401/403 清空旧快照。间隔位于 `HomeDashboard.vue` 的 `HOME_REFRESH_INTERVAL_MS`，不改变后端来源和规则的采集分钟间隔。后台读取保留未提交表单与已受理写操作反馈，不强行重新展开已收起的首次设置。

仅有启用规则但最新任务发生阻断或失败时显示“自动选品需检查”。零结果且存在失败/阻断的任务复用 `completed_with_warnings`，不再标为空成功。排查顺序为来源审批、真实健康检查、熔断恢复、任务子查询、标准化记录、规则匹配和质量门；不得以 UI 轮询证明采集完成。

上传本次 API/Worker 运行包后须由固定宝塔部署命令重启 Node 项目，静态前端刷新生效；无需数据库迁移或新增环境配置。来源审批和受控熔断恢复通过已有管理页面生效，不需为这些数据写入单独重启服务。


## 2026-10-17 每日选品产出

首页新增按北京时间当前工作区统计的主品 ASIN 去重新增与当前质量门通过数量，历史可解析身份不算新增；未知和零分开，进度目标为用户要求至少 100。原累计数不充当日报。DTO、OpenAPI、生产读取及界面边界见 `docs/selection-daily-production.md`；API/静态文件需同包发布，宝塔 Node 重启，本轮未部署。
