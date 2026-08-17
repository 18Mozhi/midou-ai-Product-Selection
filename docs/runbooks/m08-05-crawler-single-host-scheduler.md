# M08-05 宝塔单机 Crawler 调度 Runbook

## 部署

1. 在候选发布迁移中以 `product_scout` 业务账号执行 `0034_crawler_scheduler_m08_05.up.sql`；确认 MySQL 5.7 与三张新表。
2. 在宝塔“ai选品”统一后端的受限环境加入 `CRAWLER_SCHEDULER_*` 配置。内部 Worker=1、按需采集执行通道=1、每来源=1，不提供调大开关。
3. 只通过宝塔重启候选 ai选品 统一后端。不得用 systemd、独立 PM2、宿主 crontab 或屏外 Docker Compose。
4. 执行生产前置、MySQL live、调度 live、API 与浏览器验收；当前单后端发布使用版本目录与 `current` 原子链接，不创建常驻候选项目。

## 日常核验

- 宝塔项目必须恰好一个“ai选品”，只监听 4101；API、Worker 和采集执行通道是该项目的内部子进程或按需任务，不得显示为独立宝塔项目或常驻 4103 候选。
- `crawler_scheduler_leases` 的 Worker/Crawler 活动槽位分别不超过 1；每来源活动槽位不超过有效并发 1；每个浏览器档案只允许一个租约。
- 资源停止线默认：归一化负载 85%、可用内存 1024 MB、证据盘可用空间 4096 MB。触线时任务保持排队，不得通过放宽阈值绕过。
- 页面和日志只用 request_id/trace_id 关联，不复制租约令牌、哈希、Cookie、凭证或任务输入。

## 过期租约恢复

平台运营管理员在 `/platform-admin/crawler-scheduler` 二次确认后调用幂等回收。只删除 `expires_at <= NOW(3)` 的调度槽位，不终止有效任务、不删除任务历史或档案；M03-04/M03-05 的任务/浏览器过期状态仍由原有恢复器负责。生产证据必须验证一次过期探针槽位回收、相同 Idempotency-Key 重放、平台审计和探针清理。

## 异常处置

- 进程数不为 1：停止新增采集，通过宝塔核对项目实例并只保留当前稳定实例。
- `crawler_resource_stop`：保持任务排队并记录受阻状态；设备容量不作为软件完成条件，不得因此创建其他生产项目绕过。
- `crawler_lease_duplicate` / `crawler_provider_quota_exceeded`：先回收已过期槽位；仍异常则通过宝塔回滚候选，保留数据库和审计证据。
- MySQL/Redis 不可用：任务不得领取；先恢复宝塔服务，再重跑 live 门。

## 回滚

1. 通过宝塔把 `current` 原子链接恢复到上一发布目录，并重启唯一的“ai选品”统一后端；Nginx 始终只指向 4101。
2. 保留 `crawler_scheduler_*` 与 `platform_audit_events`，不得为了通过验收删除失败证据。上一版不使用这些表时可暂留。
3. 只有确认所有 API、Worker、Crawler 已回到不读取/写入 0034 的版本，才用 `0034_crawler_scheduler_m08_05.down.sql` 删除新表。
4. 数据回滚失败时停止新采集并保持只读排查；不得启用备用服务器、负载均衡或面板外服务绕过。
