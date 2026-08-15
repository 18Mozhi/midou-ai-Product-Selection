# M08-05 Crawler 单机调度架构

## 范围冻结

M08-05 只在当前惠州单台宝塔服务器上收口 S0 Crawler/Worker 调度：一个 Node Worker、一个 Python Crawler、每来源有效并发 1、浏览器档案独占、MySQL 租约去重和 CPU/内存/磁盘停止门。它不建设负载均衡、备用服务器、多节点调度或 10,000 用户能力，也不改变 M03-05 的任务状态机、失败分类和重试次数。

## 真实链路

Node Worker 继续调用 `processCollectionTaskOnce`。领取任务前，本机资源探针读取按 CPU 核数归一化的一分钟负载、可用内存和证据盘可用空间；触及停止线时只记录观测并保持任务排队。领取任务与 `crawler_scheduler_leases` 的全局 Worker 槽位及来源槽位在同一 MySQL 5.7 事务中完成，任务心跳同步延长槽位，成功、失败、协调冲突和过期恢复均释放槽位。Redis 仍只承担组织/工作区范围的队列协调，不成为租约或权限真相。

浏览器运行继续使用 M03-04 的 `crawler_profile_leases`。M08-05 在同一事务增加全局 Crawler 槽位；只有全局槽位与档案独占租约同时成功才允许运行，心跳、完成和恢复同步处理两个租约。来源原有 `providers.concurrency_limit` 保留为配置事实，但 S0 有效值固定 `min(configured, 1)`。

平台运维接口 `/api/v1/platform/operations/crawler-scheduler` 只向 `platform:operate` 返回进程计数、聚合租约、来源有效并发、档案聚合和资源水位；不返回组织/工作区标识、任务目标、租约令牌、哈希、凭证、Cookie、文件路径或队列载荷。读取写入观测和平台审计，过期回收要求同源和 Idempotency-Key。

## 数据与失败关闭

- `crawler_scheduler_leases`：全局 Worker、全局 Crawler 和来源槽位；任务/运行槽位保留组织与工作区外键，平台全局观测可为空。
- `crawler_scheduler_observations`：进程、租约、来源/档案数量、资源水位、finding code、request_id/trace_id。
- `crawler_scheduler_operations`：过期回收幂等结果；实际操作另写 `platform_audit_events`。
- 进程数量不是恰好 1、活动槽位超过 1、重复租约、来源超额、档案非独占、资源观测过期或资源触及停止线均为 `blocked`；接近停止线为 `warning`。

## 页面与图片

已依次读取 `images-html/README.txt`、`manifest.json` 和当前页面图片。布局取自 `61_平台运营-概览.jpg` 的平台总览、`62_采集来源管理.jpg` 的来源配额、`63_采集任务监控.jpg` 的调度状态、`64_系统监控.jpg` 的资源水位、`69_异常告警.jpg` 的失败关闭面板，并沿用 `10_霓虹科技平台驾驶舱_dashboard.png` 的深色霓虹平台驾驶舱。桌面为结论、四项指标、来源/档案双栏和告警；390px 折叠为卡片且不隐藏风险、时间、数值或 CTA。图片示例不作为生产事实。

## 合同边界

MySQL 固定 5.7/utf8mb4，生产服务和有限任务只由宝塔管理。容量仍为 `unverified`；单机调度通过不代表负载均衡、多节点、备用服务器、整机或 10,000 用户能力。
