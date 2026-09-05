# M08-05 Crawler 单机调度架构

## 范围冻结

M08-05 只在当前惠州单台宝塔服务器上收口 S0 Crawler/Worker 调度：一个由统一后端托管的 Node Worker、一个由宝塔 Python 项目托管的 Crawler 桥接进程、每来源有效并发 1、浏览器档案独占、来源级运行熔断、MySQL 租约去重和 CPU/内存/磁盘停止门。它不建设负载均衡、备用服务器、多节点调度或 10,000 用户能力；M03-05 原有任务重试次数不变，新增的 `source_circuit_open` 只作为子查询覆盖事实，不触发整任务重试风暴。

## 真实链路

Node Worker 继续调用 `processCollectionTaskOnce` 并唯一拥有业务采集任务状态机；遇到 `authenticated_browser` 子查询时，Worker 写入 `browser_collection_jobs` 并等待结果。独立的宝塔 Python 项目 `ai选品-python` 只领取这些业务关联作业、维持作业/档案/全局 Crawler 租约并提供 Python-to-Playwright 桥接，不承载 API、普通公开来源或 Node 队列处理器，空闲时不发送心跳。领取业务任务前，本机资源探针读取按 CPU 核数归一化的一分钟负载、可用内存和证据盘可用空间；触及停止线时只记录观测并保持任务排队。领取任务与 `crawler_scheduler_leases` 的全局 Worker 槽位及来源槽位在同一 MySQL 5.7 事务中完成，任务心跳同步延长槽位，成功、失败、协调冲突和过期恢复均释放槽位。Redis 仍只承担组织/工作区范围的队列协调，不成为租约或权限真相。

Python Crawler 保持宝塔启动命令 `python -m scoutops_crawler --env-file=...` 不变，但包内职责已拆开：`main_loop.py` 只编排单次领取和常驻轮询，`lease_client.py` 只负责领取与心跳，`execution_runner.py` 只构造受限 Playwright 请求并归一化执行失败，`completion_receipts.py` 只负责终态回写、本地耐久回执和受限目录聚合水位，`runtime_transport.py` 统一有界重试和认证传输。Crawler 到统一 Node API 的内部回环请求显式禁用系统代理，避免 Windows 或主机代理把 `127.0.0.1` 错误转发为外部 502；这不改变 Provider 受限代理合同。`runtime_client.py` 仅保留兼容门面，避免现有调用方和部署命令随内部拆分变化。待回写回执保存创建时间，并按该事实顺序重试；旧回执没有该字段时才回退到文件修改时间。可重试的网络或服务端故障始终保留在待回写队列；同一回执连续两次得到不可重试响应时，原文件携带失败次数和最近错误移入受限 `quarantine` 子目录，避免永久占据活动队头且不删除终态事实；损坏或缺字段的回执同样只隔离、不执行。每次领取轮询把待回写/隔离数量与字节数、最老待回写时间、保留期、容量上限和磁盘水位作为脱敏聚合事实写入 MySQL，不上传路径、文件名或回执内容。

Linux 主机探针分别读取 `/proc/*/cmdline`：Node Worker 只匹配 Worker 启动命令，Python Crawler 只匹配 `python -m scoutops_crawler`，不得再用 Worker 数量代替 Crawler 数量。任一进程不是恰好一个时调度状态失败关闭。本机非 Linux 开发环境只提供测试占位计数，不作为生产证据。

浏览器运行继续使用 M03-04 的 `crawler_profile_leases`，并通过 `browser_collection_jobs.collection_task_id/collection_subquery_id` 关联 Worker 已领取的业务任务。只有全局 Crawler 槽位、档案独占租约和浏览器作业租约同时成功才允许运行，心跳、完成和恢复同步处理三个租约。来源原有 `providers.concurrency_limit` 保留为配置事实，但 S0 有效值固定 `min(configured, 1)`。

平台运维接口 `/api/v1/platform/operations/crawler-scheduler` 只向 `platform:operate` 返回分别观测的 Node Worker/Python Crawler 进程计数、聚合租约、来源有效并发、来源排队 P50/P95、24 小时成功率/耗时 P95/样本量、来源运行熔断、浏览器运行小时吞吐与失败率、档案聚合、资源水位，以及最多 100 个活动槽位到逻辑进程角色和采集任务的关联。来源排队直接按 `collection_subqueries.provider_id` 关联业务任务，只统计 `available_at <=` 当前服务端时间且状态为 `scheduled`、`queued`、`retry_scheduled` 或 `rate_limited` 的可领取任务；同一任务同一来源只计一次，最长等待按 `available_at` 计算，尚未到期的退避或限流任务不冒充当前积压。页面汇总当前待领取量和最老等待；仅当某来源最长等待超过其真实近 24 小时 P95 且存在样本时提示饥饿风险，缺少样本时明确“缺少基线”，不发明固定阈值。关联直接读取 `crawler_scheduler_leases` 的任务、运行、进程标识、心跳和到期事实；来源槽位联表展示来源名称。回收前的确认框使用同一读取时点聚合已过期槽位总数、类型、关联任务数和最早到期时间，明确预览影响；最终写事务仍重新以服务端当前时间筛选 `expires_at <= NOW`，不会依据过期预览删除活动租约。任务 UUID、运行 UUID、进程标识和槽位类型只放在可展开技术详情中，不返回组织/工作区标识、任务目标、租约令牌、哈希、凭证、Cookie、文件路径或队列载荷。读取写入观测和平台审计，过期回收与来源恢复均要求同源和 Idempotency-Key。

读取链采用双层有界失败：浏览器 15 秒主动取消，API 14 秒中止读取；同一页面实例只允许一个在途 GET。刷新中的按钮禁用且旧快照继续可读，429、依赖 503 或超时只显示刷新告警，不用失败覆盖上次已核验事实；401/403 则清除受保护快照。API 将 MySQL、连接与受控目录依赖错误归一为脱敏 `crawler_scheduler_dependency_unavailable`，超时为 `crawler_scheduler_read_timeout`。九组调度事实复用一个只读、可重复读 MySQL 连接，既保持同一读取快照，也避免页面刷新一次占满连接池并阻塞 Worker/Crawler 内部请求。AbortSignal 在查询前后和观测事务提交前检查，连接关闭或超时后不得补写“读取成功”观测和审计。过期租约与单来源恢复在一次用户操作内固定 Idempotency-Key；网络或 5xx 结果不确定时重试复用该键，明确 4xx 或成功后才释放。恢复已确认但随后的 GET 失败时，页面同时保留操作成功消息、旧快照和刷新失败提示。

Worker 在每个来源真实执行结果后独立更新 `provider_runtime_circuits`：成功清零，失败累加，达到该来源 `circuit_failure_threshold` 后只打开该来源熔断。后续多来源任务把该子查询记录为 `blocked/source_circuit_open` 并继续其余来源，不复用来源健康探针的手工检查次数冒充运行失败次数。解除熔断必须调用来源恢复端点，且 `provider_adapter_health` 必须存在一条晚于 `opened_at` 的 `ready` 健康检查；恢复只清零当前来源并写幂等操作和平台审计。

平台调度页在既有进程、租约、来源和资源事实之外，集中展示完成回执容量与保留期。Python 上报只携带聚合计数、字节和时间；内部领取 API 不接受路径、文件名或回执正文，平台 API 也不返回这些敏感信息。

## 数据与失败关闭

- `crawler_scheduler_leases`：全局 Worker、全局 Crawler 和来源槽位；任务/运行槽位保留组织与工作区外键，平台全局观测可为空。
- `crawler_scheduler_observations`：进程、租约、来源/档案数量、资源水位、finding code、request_id/trace_id。
- `crawler_scheduler_operations`：过期回收幂等结果；实际操作另写 `platform_audit_events`。
- `provider_runtime_circuits`：按来源保存运行连续失败、来源注册阈值、开启与恢复时间；与人工来源健康检查事实分表。
- `crawler_completion_spool_status`：每个 Python Crawler 最近一次上报的待回写/隔离聚合数量、字节、最老时间、保留期、容量和可用磁盘；不保存路径、文件名或回执内容。
- 进程数量不是恰好 1、活动槽位超过 1、重复租约、来源超额、档案非独占、资源观测过期或资源触及停止线均为 `blocked`；接近停止线为 `warning`。
- 回执水位缺失或过期、目录达到容量上限、可用磁盘低于停止线时为 `blocked`；达到容量 80%、最老待回写达到配置保留期或隔离区非空时为 `warning`。保留期只触发人工处置，不自动删除终态事实。

## 页面与图片

当前布局采用信号账页的平台总览、来源配额、调度状态、资源水位和失败关闭清单，不再沿用旧深色霓虹驾驶舱。页面模块索引和唯一一级标题统一为“采集调度”，内容模块标题为“运行与配额”。桌面为结论、四项指标账格、来源/档案双栏、活动租约关联和告警；390px 折叠为单列账页且不隐藏风险、时间、数值或 CTA。

## 合同边界

MySQL 固定 5.7/utf8mb4，生产服务和有限任务只由宝塔管理。容量仍为 `unverified`；单机调度通过不代表负载均衡、多节点、备用服务器、整机或 10,000 用户能力。
