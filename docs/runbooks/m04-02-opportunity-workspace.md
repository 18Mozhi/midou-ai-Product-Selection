# M04-02 机会工作台运维与回滚

## 业务血缘核查

打开任一机会详情的“业务血缘”页签，核对来源到通知的节点顺序、最新证据观测时间、失败影响和折叠技术链路。点击节点应进入对应的来源、采集、数据、趋势、利润、任务或通知页面；目标页面仍按当前角色权限独立授权。若节点缺失，先按相同组织、工作区和资源 ID 检查真实关联表，不得手工补造血缘。定向验证运行 `npm run build:api && npm run typecheck:web && node --test tests/m04-02/business-lineage.test.mjs`。

## 宝塔运行

- Node API 与 Node Worker 均继续由宝塔面板管理，不创建额外生产服务。
- `OPPORTUNITY_REFRESH_POLL_MS` 与 `OPPORTUNITY_REFRESH_LEASE_SECONDS` 只放在宝塔受限环境；修改后在面板重启 Node Worker。
- 上线先执行 MySQL 5.7 迁移 `0017b_opportunities_m04_02.up.sql`、`0060_opportunity_workflow_visibility.up.sql` 与 `0065_opportunity_operating_feedback.up.sql`，再重启 Node API 和 Node Worker，最后检查 `/api/v1/health/ready`。
- 发布自动发现选品逻辑后，确认商品型 `gnews_*` 主题能建立 `trend_topic` 来源候选、关联至少一条真实证据并保持 `insufficient_data`；普通新闻与数据频道不得批量生成候选。

## 观测和处置

- 使用 request_id/trace_id 关联 `opportunity_events`、`opportunity_outbox` 和 `opportunity_refresh_jobs`。
- 在“经营复盘”页签写入一段真实周期数据，确认退货率、广告投入占比、同币种利润偏差和报价交期偏差来自保存事实；没有可比基线时必须显示“没有可比基线”。复盘后评分规则、利润规则和决策状态不得自动变化。
- `retry_scheduled` 会按 1/5/15 分钟退避；`failed_terminal` 表示来源已失效等不可重试输入，`dead_letter` 表示依赖错误耗尽四次。
- 页面显示 `insufficient_data` 或 `unknown` 是事实状态，不应通过手工 SQL 填入分数、ROI 或低风险。
- 机会列表可按“不完整 / 部分完整 / 完整”筛选，也可按“缺少可采纳证据 / 尚无可靠推荐结论”筛选；后者只对应采纳接口已有的持久化阻断条件。两类筛选都无需配置或重启 Worker。应用发布后需由宝塔重启 Node API 并更新网站静态文件。
- 发布后先打开默认“待我采纳”，确认每条记录都存在规则命中标记且服务端为 `decision_status=pending`、`recommendation_status=recommend`；切换“自动补证中”只应出现规则命中且 `recommendation_status=insufficient_data` 的候选；“全部机会”保留手工、ERP 导入和其他机会。该变更无数据库迁移、环境变量或 Worker 重启要求，但新增 API 查询参数需要宝塔重启 Node API，前端静态文件需要重新发布。
- 发布后在列表设置筛选并翻页，确认地址栏同步；从结果进入详情，再使用“返回来源列表”，应恢复完整筛选和页码。直接打开带 `tab=evidence` 的详情链接应定位证据分区。桌面滚动时决策栏保持可见，390px 下确认标签可横向滚动、底部栏不被系统安全区遮挡且文字不竖排。
- 核对列表的阶段停留时长不会因改负责人或普通刷新而重置；只有阶段实际变化时 `lifecycle_entered_at` 才更新。详情应同时展示两类采纳阻断、补采任务进度与评分 Job 状态。
- 完成一个 `evidence_completion` 任务后，活动评分规则存在时应生成带同一 `trigger_task_id` 的评分 Job；Job 完成后通知中心出现“机会可重新决策”，收件人为机会负责人或补采任务执行人，入口直达 `/opportunities/{id}`。没有活动评分规则时保持 `waiting_for_active_rule`，不得发送完成提醒。

## 回滚

先在宝塔关闭机会入口并停止 Node Worker，回滚应用版本。经营复盘表包含业务事实，只有完成受控归档并确认可删除后才能执行 `0065_opportunity_operating_feedback.down.sql`；随后按需执行 `0060_opportunity_workflow_visibility.down.sql`，完整移除机会域时再执行 `0017b_opportunities_m04_02.down.sql`。下迁移会移除阶段进入时间与评分 Job 的补采任务关联，已经投递的通知和审计事实保留。恢复时重新应用迁移、启动 API/Worker，并运行 `npm run verify:module -- M04-02`。
