# M04-01 热点与监控架构

## 范围与非目标

本模块把 P03 的手动 `google_news_search` 和 96 条 `gnews_<市场>_<主题>` 自动频道规范化证据投影为工作区级趋势主题，提供主题列表、详情、时间线、关键词、证据、关注、相关性状态和监控规则。机会数据仍由 M04-02 管理；商品型热点频道可自动建立“待评估选品”，但不会自动评分、推荐、采纳或填充利润。机会评分、邮件投递和 AI 摘要分别属于 M04-03、后续通知模块和 M04-07。

## 数据和异步链路

`normalized_records` 由宝塔管理的 Node Worker 扫描并补建 `trend_projection_jobs`。投影任务使用 MySQL 5.7 租约、四次总尝试和 1/5/15 分钟退避；不可恢复的字段错误进入 `failed_terminal`，可恢复依赖错误耗尽后进入 `dead_letter`，非趋势来源进入 `succeeded_empty`。

Google News 记录按市场、语言以及 NFKC、小写和连续空白折叠后的完整标题生成 `topic_key`。相同市场和语言的相同标题在同一组织与工作区内合并；自动频道从 Provider code 解析真实市场与语言，不能全部伪装为美国。`trend_signals.normalized_record_id` 唯一，重放不会重复增加热度。`heat.value` 是实际信号数，单位固定为 `signals`。没有批准的时间窗口和置信度算法时，`momentum_percent` 与 `confidence_score` 保持空值，`confidence_status=insufficient_data`。

商品型热点频道仅包括爆款商品、Amazon、TikTok Shop、Etsy、eBay 和新品发布。首次出现的新主题由同一 Worker 在同一事务创建 M04-02 的待评估选品、关联当前真实趋势证据并写 `opportunity.candidate.discovered` 审计与 Outbox；后续同主题信号只增补证据。消费趋势、零售数据、搜索数据和社区讨论仍只进入热点中心，避免把每条新闻都冒充商品。自动发现结果保持 `recommendation_status=insufficient_data`，必须由人补齐竞争、成本和风险证据后再决策。

投影、关注、取消关注、相关性和规则变更都在同一事务写 `trend_events` 与 `trend_outbox`，保留 `request_id`、`trace_id` 和组织/工作区范围。相关性更新不删除 `raw_evidence`、`normalized_records` 或 `trend_signals`。

## API 与权限

读取接口要求 `trend:read`；关注、相关性和监控规则写入要求 `trend:manage`。服务端从 HttpOnly 会话解析组织和工作区，不接受请求体覆盖范围。所有写入要求与 `WEB_ORIGIN` 完全一致的 `Origin` 和 `Idempotency-Key`，并使用版本锁避免静默覆盖。

监控规则包含名称、包含关键词、排除关键词、市场、语言、可选分类和状态。通知渠道当前固定为 `in_app`；邮件 Provider 尚未确认。

## 页面合同

`/trends` 参考概念图 28–32 和高清图 05，提供桌面双栏工作台与 390px 单栏布局。图表同时显示数值、时间和来源；加载、空、错误、登录过期、无权限和依赖受阻均有文字与下一步。M04-02 未通过前，“转为机会”保持禁用并说明阶段边界。
