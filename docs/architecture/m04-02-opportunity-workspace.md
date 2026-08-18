# M04-02 机会工作台架构

机会是当前组织与工作区内的候选决策资源。API 从服务端会话解析范围，`opportunity:read` 保护列表与详情，既有 `opportunity:decide` 保护创建和人工决策；浏览器写入还要求同源 `Origin`、`Idempotency-Key` 和乐观 `version`。

人工创建事务同时写 `opportunities`、刷新任务、事件、Outbox 和幂等操作。趋势来源必须是同一组织、工作区的活动 `trend_topic`。宝塔管理的 Node Worker 以 MySQL 5.7 租约刷新证据链接，只引用已存在的 `trend_signals` 与 `raw_evidence`，不复制或删除原始证据。来自 M04-01 商品型自动热点频道的新主题会在趋势投影事务中自动创建待评估选品并写 `opportunity.candidate.discovered`；该候选只有真实趋势证据，不等于推荐或自动采纳。

M04-02 的事实边界是：趋势证据可使市场分区变为 covered，但单一市场证据只能得到 `partial` 覆盖。评分、利润、竞品和风险输入分别由后续模块交付；当前值保持 null、`insufficient_data` 或 `unknown`。人工决定单独留痕，不修改原始评分与证据。

所有业务写入、Worker 写入和失败均携带 request_id/trace_id。四次总尝试与 1/5/15 分钟退避在代码中锁定；不可重试错误进入 `failed_terminal`，依赖错误耗尽后进入 `dead_letter`。
