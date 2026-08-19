# M08-05 Crawler 单机调度架构

## 范围冻结

M08-05 只在当前惠州单台宝塔服务器上收口 S0 Crawler/Worker 调度：一个由统一后端托管的 Node Worker、一个由宝塔 Python 项目托管的 Crawler 桥接进程、每来源有效并发 1、浏览器档案独占、MySQL 租约去重和 CPU/内存/磁盘停止门。它不建设负载均衡、备用服务器、多节点调度或 10,000 用户能力，也不改变 M03-05 的任务状态机、失败分类和重试次数。

## 真实链路

Node Worker 继续调用 `processCollectionTaskOnce` 并唯一拥有业务采集任务状态机；遇到 `authenticated_browser` 子查询时，Worker 写入 `browser_collection_jobs` 并等待结果。独立的宝塔 Python 项目 `ai选品-python` 只领取这些业务关联作业、维持作业/档案/全局 Crawler 租约并提供 Python-to-Playwright 桥接，不承载 API、普通公开来源或 Node 队列处理器，空闲时不发送心跳。领取业务任务前，本机资源探针读取按 CPU 核数归一化的一分钟负载、可用内存和证据盘可用空间；触及停止线时只记录观测并保持任务排队。领取任务与 `crawler_scheduler_leases` 的全局 Worker 槽位及来源槽位在同一 MySQL 5.7 事务中完成，任务心跳同步延长槽位，成功、失败、协调冲突和过期恢复均释放槽位。Redis 仍只承担组织/工作区范围的队列协调，不成为租约或权限真相。

Linux 主机探针分别读取 `/proc/*/cmdline`：Node Worker 只匹配 Worker 启动命令，Python Crawler 只匹配 `python -m scoutops_crawler`，不得再用 Worker 数量代替 Crawler 数量。任一进程不是恰好一个时调度状态失败关闭。本机非 Linux 开发环境只提供测试占位计数，不作为生产证据。

浏览器运行继续使用 M03-04 的 `crawler_profile_leases`，并通过 `browser_collection_jobs.collection_task_id/collection_subquery_id` 关联 Worker 已领取的业务任务。只有全局 Crawler 槽位、档案独占租约和浏览器作业租约同时成功才允许运行，心跳、完成和恢复同步处理三个租约。来源原有 `providers.concurrency_limit` 保留为配置事实，但 S0 有效值固定 `min(configured, 1)`。

平台运维接口 `/api/v1/platform/operations/crawler-scheduler` 只向 `platform:operate` 返回分别观测的 Node Worker/Python Crawler 进程计数、聚合租约、来源有效并发、来源排队、档案聚合、资源水位，以及最多 100 个活动槽位到逻辑进程角色和采集任务的关联。来源排队直接按 `collection_subqueries.provider_id` 关联业务任务，只统计 `available_at <=` 当前服务端时间且状态为 `scheduled`、`queued`、`retry_scheduled` 或 `rate_limited` 的可领取任务；同一任务同一来源只计一次，最长等待按 `available_at` 计算，尚未到期的退避或限流任务不冒充当前积压。关联直接读取 `crawler_scheduler_leases` 的任务、运行、进程标识、心跳和到期事实；来源槽位联表展示来源名称。任务 UUID、运行 UUID、进程标识和槽位类型只放在可展开技术详情中，不返回组织/工作区标识、任务目标、租约令牌、哈希、凭证、Cookie、文件路径或队列载荷。读取写入观测和平台审计，过期回收要求同源和 Idempotency-Key。

## 数据与失败关闭

- `crawler_scheduler_leases`：全局 Worker、全局 Crawler 和来源槽位；任务/运行槽位保留组织与工作区外键，平台全局观测可为空。
- `crawler_scheduler_observations`：进程、租约、来源/档案数量、资源水位、finding code、request_id/trace_id。
- `crawler_scheduler_operations`：过期回收幂等结果；实际操作另写 `platform_audit_events`。
- 进程数量不是恰好 1、活动槽位超过 1、重复租约、来源超额、档案非独占、资源观测过期或资源触及停止线均为 `blocked`；接近停止线为 `warning`。

## 页面与图片

已依次读取 `images-html/README.txt`、`manifest.json` 和当前页面图片。布局取自 `61_平台运营-概览.jpg` 的平台总览、`62_采集来源管理.jpg` 的来源配额、`63_采集任务监控.jpg` 的调度状态、`64_系统监控.jpg` 的资源水位、`69_异常告警.jpg` 的失败关闭面板，并沿用 `10_霓虹科技平台驾驶舱_dashboard.png` 的深色霓虹平台驾驶舱。页面菜单和唯一一级标题统一为“采集调度”，内容模块标题为“运行与配额”。桌面为结论、四项指标、来源/档案双栏、活动租约关联和告警；390px 折叠为卡片且不隐藏风险、时间、数值或 CTA。没有活动槽位时不展示空关联面板，图片示例不作为生产事实。

## 合同边界

MySQL 固定 5.7/utf8mb4，生产服务和有限任务只由宝塔管理。容量仍为 `unverified`；单机调度通过不代表负载均衡、多节点、备用服务器、整机或 10,000 用户能力。
