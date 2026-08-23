# M06-02 平台驾驶舱

`/platform-admin` 使用高分辨率图 10 的深色驾驶舱布局，但所有数字来自当前 MySQL 5.7。读模型聚合活动组织/用户、启用来源与时间窗内子查询、任务终态和积压、开放质量问题、活动文件体积与窗内增长。没有任务样本时成功率为 `null`；没有来源样本时为 `unknown`。

驾驶舱仓储把只读聚合按指标域拆分：平台规模模块只读取组织、用户与启用来源；采集运行模块只读取任务终态、队列、来源健康与趋势；风险模块只读取质量问题、失败告警和最近平台活动；文件容量模块只读取当前体积与窗口增长。`mysql-platform-dashboard-repository.ts` 仍负责并行编排、结果语义、读取记录与审计事务；内容运营、通知、日志、导出和治理写流程不在这些只读模块中，也没有新增表、路由或运行服务。

首页首屏以“等待处理”和“需要关注”作为直接行动入口，不堆叠平台规模指标。来源健康在桌面保留表格，760px 及以下改为摘要卡片与详情抽屉；来源 UUID、来源代码、告警组织/工作区 UUID 和请求标识只在“技术详情”展示。无趋势数据时直接提供检查来源和采集队列的恢复动作。

全量数据、规则治理、热点内容、通知投递和历史邮件页同样在桌面保留表格，760px 及以下改用摘要卡片和详情抽屉；筛选条件进入抽屉并在关闭、重开之间保留。状态筛选显示中文名称，但请求仍提交既有状态值。记录 ID、版本代码、原始投递错误码和 request_id 只在折叠的“技术详情”中显示；这不改变查询、导出、审核、投递处置、版本锁或审计合同。

`GET /api/v1/platform/dashboard` 只允许具备 `platform:operate` 的平台身份，不依赖组织会话。响应不包含凭证、Cookie、业务 payload 或文件路径；告警仅带组织/工作区 ID、错误码、严重度和时间。每次敏感全局读取在同一事务写 `platform_dashboard_views` 与 `platform_audit_events`，关联 request_id/trace_id。

驾驶舱同步读取既有 Worker/Crawler/Outbox 状态，不拥有异步任务，也不新建常驻进程。队列告警阈值只影响显示状态。当前仍是宝塔 S0 单机交付，不代表多节点或 10,000 用户能力。

系统状态页把既有 API、MySQL、Redis、文件、Node Worker 与 Python Crawler 观测按“访问入口、共享依赖、异步执行”展示为“依赖拓扑与故障传播”视图。依赖关系来自已锁定运行架构：API 同步就绪依赖 MySQL 与 Redis；Worker 使用 MySQL、Redis 和文件目录；Crawler 由 Worker 创建登录型作业并通过内部 API 领取、心跳和回传，同时使用受限文件目录。页面只在服务自身不是 `healthy` 或 `ready` 时列出“当前需核查的传播范围”，说明异常持续时应核查的业务面和直接或后续关联服务；它不根据拓扑推断下游已经故障，也不生成故障数量、可用性或容量结论。每个节点沿用原服务的专属运维链接。

同页“实时连接退化”只展示当前浏览器标签页会话的 SSE 客户端观测：重连次数除以连接打开与重连事件总数得到重连率，EventSource 首次进入每轮错误状态时立即刷新一次通知事实并累计“降级轮询次数”。重复错误事件在重新 `open` 前不会重复累计。该数据保存在标签页 `sessionStorage`，不写平台管理 API、MySQL 或审计，不推断其他用户和全站实时服务健康。

生产邮件 Provider 当前为 `pending_provider_selection`。平台导航不提供 `/platform-admin/email` 入口，直接访问也不装载邮件管理页面；通知偏好和平台通知草稿的邮件开关固定关闭。Node API 同时拒绝启用邮件偏好、创建邮件草稿、为通知启用邮件或发布历史邮件草稿，防止绕过前端。历史邮件投递、草稿、审计和安全处置 API 不删除，待 Provider 合同、回调与合规验收完成后再单独开放。

平台管理页由 `PlatformManagementCenter.vue` 统一持有读取、写入、审核和加载状态，领域标题、状态文案和时间展示等无副作用转换集中在 `platform-management-presentation.ts`；热点内容与邮件记录列表、消息列表、消息编辑器与通知运营事实分别下沉到 `PlatformManagementRecordList.vue`、`PlatformMessageWorkbench.vue`、`PlatformMessageEditor.vue` 和 `PlatformNotificationOperations.vue`。通知运营样式由页面专属 `platform-notification-operations.css` 持有并以 `.notification-ops` 限定作用域。子组件只通过属性和事件协作，不直接访问 API，也不改变既有权限、审计或消息状态合同。

系统运维的 `/platform-admin/logs` 由独立 `PlatformLogCenter.vue` 承载。它复用 `GET /api/v1/platform/management?domain=logs`，按同一个查询词检索 `platform_audit_events`、`collection_task_events` 与 `crawler_browser_runs` 中已有索引的 request_id、trace_id、事件、资源和错误码，最多返回最新 200 条。页面先按同一 `trace_id` 分组，再在组内按时间正序展示 API、Worker 与 Crawler 事件，不把不同 trace 拼成一条链。桌面端每条链保留带列设置、首列冻结和密度切换的表格；390 像素下每个事件只显示事件、运行面、状态和时间摘要，完整资源、错误码、精确任务/来源入口与技术编号进入具名侧边详情，不保留横向宽表。Worker 任务事件返回既有 collection task 关联；Crawler 运行通过 `browser_collection_jobs.crawler_run_id` 和 `crawler_browser_runs.provider_id` 返回精确任务、Provider 与来源展示名，异常行可直达任务和过滤后的来源页。API 记录或没有单一 Provider 事实的 Worker 记录保持关联来源为空，不猜测来源。`POST /api/v1/platform/management/logs/exports` 复用同一查询和运行面筛选，导出同一上限内的归一化字段，CSV 防公式注入，并把操作者、筛选、原因和记录数写入平台审计；不会扩大查询范围。响应和导出均不包含审计 metadata、任务 payload、浏览器结果、凭证、Cookie 或 stderr；完整技术编号默认折叠。该模型不创建日志副本、搜索服务或新常驻进程。

`/platform-admin/api-coverage` 复用同一平台管理读取 API，但不把数据库行当成接口目录。每次读取都重新解析部署包中的 `docs/openapi.yaml`，以 `config/api-coverage-metadata.json` 声明数据来源、UI 消费方与爬虫副作用，并读取一次性宝塔验收写出的生产报告。报告 schema 2 携带由全部 `METHOD path` 排序后计算的 SHA-256；只有指纹、路径数和操作数都与当前 OpenAPI 相同，成功、空结果、受阻、越权及角色统计才进入覆盖率。报告缺失或不匹配时，255 个操作仍完整显示，但统一为“未执行”，覆盖率为 0，避免旧报告冒充当前事实。六角色的预期允许数来自同一 `config/route-catalog.json`，实际角色与结果来自报告；页面不生成新探针、不触发爬虫，也不读取响应正文、Cookie 或凭证。
