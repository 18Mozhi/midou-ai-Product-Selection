# M04-01 热点与监控架构

## 范围与非目标

本模块把 P03 的手动 `google_news_search` 和 96 条 `gnews_<市场>_<主题>` 自动频道规范化证据投影为工作区级趋势主题，提供主题列表、详情、时间线、关键词、证据、关注、相关性状态和监控规则。机会数据仍由 M04-02 管理；商品型热点频道可自动建立“待评估选品”，但不会自动评分、推荐、采纳或填充利润。机会评分、邮件投递和 AI 摘要分别属于 M04-03、后续通知模块和 M04-07。

## 数据和异步链路

`normalized_records` 由宝塔管理的 Node Worker 扫描并补建 `trend_projection_jobs`。投影任务使用 MySQL 5.7 租约、四次总尝试和 1/5/15 分钟退避；不可恢复的字段错误进入 `failed_terminal`，可恢复依赖错误耗尽后进入 `dead_letter`，非趋势来源进入 `succeeded_empty`。

Google News 记录按市场、语言以及 NFKC、小写和连续空白折叠后的完整标题生成 `topic_key`。相同市场和语言的相同标题在同一组织与工作区内合并；自动频道从 `gnews_<地区>_<主题>` Provider code 的唯一主题捕获组解析真实市场、语言和来源类别，不能全部伪装为美国，也不能因读取不存在的捕获组漏掉新品等商品主题。`trend_signals.normalized_record_id` 唯一，重放不会重复增加热度。`heat.value` 是实际信号数，单位固定为 `signals`。没有批准的时间窗口和置信度算法时，`momentum_percent` 与 `confidence_score` 保持空值，`confidence_status=insufficient_data`。

人工主题治理通过 `trend_topic_change_requests` 保存合并或拆分提案，提案人与确认人必须是两个不同的活动 `trend:manage` 用户。合并保留目标主题、迁移信号、合并关键词与关注关系并归档来源主题；涉及多个既有机会时失败关闭，只存在一个机会时把它绑定到保留主题。拆分只能迁移提案中逐条锁定的信号，并要求显式输入新主题名称；既有机会继续留在原主题，新主题不自动生成或迁移机会。提案和确认均锁定主题及请求版本，拒绝不改业务事实，所有结论写趋势事件、Outbox 和审计。

商品型热点频道仅包括爆款商品、Amazon、TikTok Shop、Etsy、eBay 和新品发布。首次出现的新主题由同一 Worker 在同一事务创建 M04-02 的待评估选品、关联当前真实趋势证据并写 `opportunity.candidate.discovered` 审计与 Outbox；后续同主题信号只增补证据。消费趋势、零售数据、搜索数据和社区讨论仍只进入热点中心，避免把每条新闻都冒充商品。自动发现结果保持 `recommendation_status=insufficient_data`，必须由人补齐竞争、成本和风险证据后再决策。

投影、关注、取消关注、相关性和规则变更都在同一事务写 `trend_events` 与 `trend_outbox`，保留 `request_id`、`trace_id` 和组织/工作区范围。相关性更新强制填写原因；详情从追加式事件返回最近 50 次标记和恢复记录，允许操作员按当前版本恢复为相关，不删除 `raw_evidence`、`normalized_records` 或 `trend_signals`。

趋势投影 Worker 按职责拆分：`trend-projection-worker.ts` 只负责补建任务、租约、退避重试和主循环编排；`trend-projection-calculation.ts` 负责来源判定、输入校验、标题归一化、找货关键词和主题键计算；`trend-projection-persistence.ts` 在原事务中写主题、信号、关键词和投影任务状态；`trend-projection-alerts.ts` 负责监控规则命中以及趋势/机会事件与 Outbox。拆分不改变四次尝试、事务提交顺序、主题合并规则或下游采集合同。

## API 与权限

读取接口要求 `trend:read`；关注、相关性和监控规则写入要求 `trend:manage`。服务端从 HttpOnly 会话解析组织和工作区，不接受请求体覆盖范围。所有写入要求与 `WEB_ORIGIN` 完全一致的 `Origin` 和 `Idempotency-Key`，并使用版本锁避免静默覆盖。

监控规则包含名称、包含关键词、排除关键词、市场、语言、可选分类和状态。页面展示真实 `next_collection_at`，并从上一次 `last_collection_task_id` 的子查询读取失败或受阻来源名称；没有失败子查询时明确显示“无”。通知渠道当前固定为 `in_app`；邮件 Provider 尚未确认。

## 页面合同

`/trends` 参考概念图 28–32 和高清图 05，提供桌面双栏工作台与 390px 单栏布局。首屏用紧凑的“市场质量门 · 证据就绪”条汇总启用规则、真实主题和最近失败来源，直接给出下一步；它只表达工作区市场证据链是否运行，不替代机会详情中的市场质量门结论。趋势列表先于折叠帮助面板，并在每项展示来源数、来源新鲜度和实测或数据不足的可信度；关注、监控和转机会保持独立动作。详情同时返回全来源聚合时间线和按真实 `provider_id`、发布方标签分组的 `timeline_sources`，浏览器只切换这些服务端归属点，不自行猜测来源。长时间线只在时间线卡片内部横向滚动，详情网格和整页必须保持在当前视口内；关键词允许在卡片内断行。图表同时显示数值、时间和来源；加载、空、错误、登录过期、无权限和依赖受阻均有文字与下一步。

列表筛选、排序、页码、当前主题和“趋势主题 / 监控规则”分区分别使用 `q`、`market`、`category`、`status`、`sort`、`page`、`topic` 与 `section` 查询参数。地址可复制为保存视图和详情深链，但不声称已建立服务端视图存储。桌面主从栏允许在 32%–48% 内调整列表宽度；详情主要操作保持在可视区域。空结果可一键清除筛选，监控规则可带真实包含关键词返回趋势结果。

前端按监控就绪状态、筛选、详情、证据时间线和治理队列拆分展示边界：`TrendDashboard.vue` 保留路由状态、API、主题选择、治理与监控规则编排；共享就绪状态模型只把已加载事实映射为状态条，不请求接口、不推导商品结论；`TrendFilterPanel.vue` 只上抛筛选值与动作；`TrendDetailPanel.vue` 展示选中主题事实与动作；`TrendEvidenceTimeline.vue` 展示证据、相关性历史、来源筛选时间线和关键词；`TrendChangeQueue.vue` 展示合并/拆分提案及第二人确认。子组件不直接请求接口，也不改变治理、评分或相关性合同。

详情证据行提供“报告异常”，但不在趋势域复制质量工单模型。写入接口要求 `trend:manage`、同源 `Origin` 和 `Idempotency-Key`；服务端用当前会话组织、工作区、主题和 `trend_signal.id` 反查真实 Provider、`raw_evidence`、`normalized_record` 与解析器版本，再在既有 `data_quality_issues` 事务中写工单、事件和 Outbox。相同原始证据已有未关闭的 `trend_evidence_anomaly` 时返回现有工单，避免重复处理；浏览器不能提交或覆盖租户、来源和证据关联。

## 多来源规则采集扩展

投影现在接纳代码目录中的手动 Google News、固定 Google 频道、非 Google RSS/Atom、主要论坛和 Amazon/eBay 公开榜单。市场和语言来自来源目录；公开商品页没有独立发布时间时使用真实抓取时间。未登记来源仍以 `succeeded_empty` 结束。

`trend_monitoring_rules.collection_interval_minutes` 允许 15–10080 分钟。统一宝塔 Node Worker 按 `next_collection_at` 和 `source_cursor` 分批选择匹配市场的来源，把关键词与规则编号写入采集目标、任务事件和 Outbox。通过固定样本回放、第二人审批并由负责人显式启用后的 `1688-browser-contract-v3` 与 `amazon-structured-product-v2` 都属于规则驱动的商品发现来源；1688 规范记录使用供应商名称作为趋势信号发布方，并只把规范 `https://detail.1688.com/offer/{offerId}.html` 识别为具体商品证据。暂停规则会停止下次执行，恢复规则会立即排队；不创建 crontab、systemd 或独立服务。

商品型 Google 频道和自动电商来源直接建立证据化机会；普通新闻、数据和社区来源只有命中用户规则才建立机会。Amazon 商品网址中的真实 ASIN 会建立竞品，并立即以高优先级排队 `amazon_product` 公开商品页快照；同一机会同时排队 Made-in-China 与 EC21 公开供应商搜索，只要任一来源返回有效公开商品就投影候选。列表图片读取竞品快照关联的不可变规范记录，供应商候选保留报价、币种、MOQ、网址和原始证据；网页未披露的字段继续保持缺失，不填 0 或演示数据。

Worker 每轮还会恢复历史上已建立但从未排队下游任务的自动商品机会：竞品任务必须包含 `page_url` 才视为有效，旧版错误使用 `url` 的子查询会补建一次正确任务；找货子查询必须包含 `query_contract=supplier-keywords-v2` 和 1–300 字符的 `query`，旧版直接使用完整商品长标题或未保留代理请求 URL 的任务同样只补建一次正确任务。其他已经成功、失败或进入死信的有效任务不自动重放，避免重复爬取和无限重试。自动找货记录的 `input_ref` 固定保存机会 ID；公开找货关键词优先从标题中已出现的通用品类词组提取，未命中词组时保留标题首段最多 6 个有效词，最终限制为 120 字符，不借此声称商品等同或供应商匹配已确认。宝塔受限代理响应会保留请求 URL，供应商适配器也会在原生 `Response.url` 为空时回退到已校验的请求 URL。Made-in-China 与 EC21 都是非必需子查询，任一来源出现可恢复网络错误时会记录该来源失败并继续下一来源，不会让单一网站中断整次找货。
