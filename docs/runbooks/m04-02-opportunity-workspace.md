# M04-02 机会工作台运维与回滚

## 宝塔运行

- Node API 与 Node Worker 均继续由宝塔面板管理，不创建额外生产服务。
- `OPPORTUNITY_REFRESH_POLL_MS` 与 `OPPORTUNITY_REFRESH_LEASE_SECONDS` 只放在宝塔受限环境；修改后在面板重启 Node Worker。
- 上线先执行 MySQL 5.7 迁移 `0017b_opportunities_m04_02.up.sql` 与 `0060_opportunity_workflow_visibility.up.sql`，再重启 Node API 和 Node Worker，最后检查 `/api/v1/health/ready`。
- 发布自动发现选品逻辑后，确认商品型 `gnews_*` 主题能建立 `trend_topic` 来源候选、关联至少一条真实证据并保持 `insufficient_data`；普通新闻与数据频道不得批量生成候选。

## 观测和处置

- 使用 request_id/trace_id 关联 `opportunity_events`、`opportunity_outbox` 和 `opportunity_refresh_jobs`。
- `retry_scheduled` 会按 1/5/15 分钟退避；`failed_terminal` 表示来源已失效等不可重试输入，`dead_letter` 表示依赖错误耗尽四次。
- 页面显示 `insufficient_data` 或 `unknown` 是事实状态，不应通过手工 SQL 填入分数、ROI 或低风险。
- 机会列表可按“不完整 / 部分完整 / 完整”筛选，也可按“缺少可采纳证据 / 尚无可靠推荐结论”筛选；后者只对应采纳接口已有的持久化阻断条件。两类筛选都无需配置或重启 Worker。应用发布后需由宝塔重启 Node API 并更新网站静态文件。
- 发布后在列表设置筛选并翻页，确认地址栏同步；从结果进入详情，再使用“返回来源列表”，应恢复完整筛选和页码。直接打开带 `tab=evidence` 的详情链接应定位证据分区。桌面滚动时决策栏保持可见，390px 下确认标签可横向滚动、底部栏不被系统安全区遮挡且文字不竖排。
- 核对列表的阶段停留时长不会因改负责人或普通刷新而重置；只有阶段实际变化时 `lifecycle_entered_at` 才更新。详情应同时展示两类采纳阻断、补采任务进度与评分 Job 状态。
- 完成一个 `evidence_completion` 任务后，活动评分规则存在时应生成带同一 `trigger_task_id` 的评分 Job；Job 完成后通知中心出现“机会可重新决策”，收件人为机会负责人或补采任务执行人，入口直达 `/opportunities/{id}`。没有活动评分规则时保持 `waiting_for_active_rule`，不得发送完成提醒。

## 回滚

先在宝塔关闭机会入口并停止 Node Worker，回滚应用版本；只回滚本批次时先执行 `0060_opportunity_workflow_visibility.down.sql`，完整移除机会域时再执行 `0017b_opportunities_m04_02.down.sql`。下迁移会移除阶段进入时间与评分 Job 的补采任务关联，已经投递的通知和审计事实保留。只有确认无需保留本模块业务数据时才执行完整结构回滚；审计或证据需要留存时应先完成受控归档，不得以删除掩盖失败。恢复时重新应用迁移、启动 API/Worker，并运行 `npm run verify:module -- M04-02`。
