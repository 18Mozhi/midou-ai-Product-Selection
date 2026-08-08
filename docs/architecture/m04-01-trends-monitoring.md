# M04-01 热点与监控架构

## 范围与非目标

本模块把 P03 的 `google_news_search` 规范化证据投影为工作区级趋势主题，提供主题列表、详情、时间线、关键词、证据、关注、相关性状态和监控规则。创建机会、机会评分、邮件投递和 AI 摘要分别属于 M04-02、M04-03、后续通知模块和 M04-07，本模块不提前实现或伪装启用。

## 数据和异步链路

`normalized_records` 由宝塔管理的 Node Worker 扫描并补建 `trend_projection_jobs`。投影任务使用 MySQL 5.7 租约、四次总尝试和 1/5/15 分钟退避；不可恢复的字段错误进入 `failed_terminal`，可恢复依赖错误耗尽后进入 `dead_letter`，非趋势来源进入 `succeeded_empty`。

Google News 记录按 NFKC、小写和连续空白折叠后的完整标题生成 `topic_key`。相同标题在同一组织与工作区内合并；`trend_signals.normalized_record_id` 唯一，重放不会重复增加热度。`heat.value` 是实际信号数，单位固定为 `signals`。没有批准的时间窗口和置信度算法时，`momentum_percent` 与 `confidence_score` 保持空值，`confidence_status=insufficient_data`。

投影、关注、取消关注、相关性和规则变更都在同一事务写 `trend_events` 与 `trend_outbox`，保留 `request_id`、`trace_id` 和组织/工作区范围。相关性更新不删除 `raw_evidence`、`normalized_records` 或 `trend_signals`。

## API 与权限

读取接口要求 `trend:read`；关注、相关性和监控规则写入要求 `trend:manage`。服务端从 HttpOnly 会话解析组织和工作区，不接受请求体覆盖范围。所有写入要求与 `WEB_ORIGIN` 完全一致的 `Origin` 和 `Idempotency-Key`，并使用版本锁避免静默覆盖。

监控规则包含名称、包含关键词、排除关键词、市场、语言、可选分类和状态。通知渠道当前固定为 `in_app`；邮件 Provider 尚未确认。

## 页面合同

`/trends` 参考概念图 28–32 和高清图 05，提供桌面双栏工作台与 390px 单栏布局。图表同时显示数值、时间和来源；加载、空、错误、登录过期、无权限和依赖受阻均有文字与下一步。M04-02 未通过前，“转为机会”保持禁用并说明阶段边界。
