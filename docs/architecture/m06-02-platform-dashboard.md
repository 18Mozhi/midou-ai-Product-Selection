# M06-02 平台驾驶舱

`/platform-admin` 使用高分辨率图 10 的深色驾驶舱布局，但所有数字来自当前 MySQL 5.7。读模型聚合活动组织/用户、启用来源与时间窗内子查询、任务终态和积压、开放质量问题、活动文件体积与窗内增长。没有任务样本时成功率为 `null`；没有来源样本时为 `unknown`。

首页首屏以“等待处理”和“需要关注”作为直接行动入口，不堆叠平台规模指标。来源健康在桌面保留表格，760px 及以下改为摘要卡片与详情抽屉；来源 UUID、来源代码、告警组织/工作区 UUID 和请求标识只在“技术详情”展示。无趋势数据时直接提供检查来源和采集队列的恢复动作。

全量数据、规则治理、热点内容、通知投递和历史邮件页同样在桌面保留表格，760px 及以下改用摘要卡片和详情抽屉；筛选条件进入抽屉并在关闭、重开之间保留。状态筛选显示中文名称，但请求仍提交既有状态值。记录 ID、版本代码、原始投递错误码和 request_id 只在折叠的“技术详情”中显示；这不改变查询、导出、审核、投递处置、版本锁或审计合同。

`GET /api/v1/platform/dashboard` 只允许具备 `platform:operate` 的平台身份，不依赖组织会话。响应不包含凭证、Cookie、业务 payload 或文件路径；告警仅带组织/工作区 ID、错误码、严重度和时间。每次敏感全局读取在同一事务写 `platform_dashboard_views` 与 `platform_audit_events`，关联 request_id/trace_id。

驾驶舱同步读取既有 Worker/Crawler/Outbox 状态，不拥有异步任务，也不新建常驻进程。队列告警阈值只影响显示状态。当前仍是宝塔 S0 单机交付，不代表多节点或 10,000 用户能力。

生产邮件 Provider 当前为 `pending_provider_selection`。平台导航不提供 `/platform-admin/email` 入口，直接访问也不装载邮件管理页面；通知偏好和平台通知草稿的邮件开关固定关闭。Node API 同时拒绝启用邮件偏好、创建邮件草稿、为通知启用邮件或发布历史邮件草稿，防止绕过前端。历史邮件投递、草稿、审计和安全处置 API 不删除，待 Provider 合同、回调与合规验收完成后再单独开放。

平台管理页由 `PlatformManagementCenter.vue` 统一持有读取、写入、审核和加载状态；热点内容与邮件记录列表、消息列表、消息编辑器与通知运营事实分别下沉到 `PlatformManagementRecordList.vue`、`PlatformMessageWorkbench.vue`、`PlatformMessageEditor.vue` 和 `PlatformNotificationOperations.vue`。通知运营样式由页面专属 `platform-notification-operations.css` 持有并以 `.notification-ops` 限定作用域。子组件只通过属性和事件协作，不直接访问 API，也不改变既有权限、审计或消息状态合同。
