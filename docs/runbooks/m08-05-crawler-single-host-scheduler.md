# M08-05 宝塔单机 Crawler 调度 Runbook

## 部署

1. 在候选发布迁移中以 `product_scout` 业务账号执行 `0034_crawler_scheduler_m08_05.up.sql`；确认 MySQL 5.7 与三张新表。
2. 在宝塔 Node API 和 Node Worker 受限环境加入 `CRAWLER_SCHEDULER_*` 配置。并发上限固定 Worker=1、Crawler=1、每来源=1，不提供调大开关。
3. 只通过宝塔按顺序重启候选 Node API、Node Worker、Python Crawler。不得用 systemd、独立 PM2、宿主 crontab 或屏外 Docker Compose。
4. 执行生产前置、MySQL live、调度 live、API 与浏览器验收；发布仍必须经过 5%/25%/100% 各不少于 1,800 秒且不得放宽错误率、读写 P95 或异步滞后阈值。

## 日常核验

- 宝塔进程必须恰好一个 `product-scout-worker` 和一个 `product-scout-crawler`；候选灰度期间 API 可有稳定/候选两个端口，但不构成长期负载均衡，晋级后只保留 4101。
- `crawler_scheduler_leases` 的 Worker/Crawler 活动槽位分别不超过 1；每来源活动槽位不超过有效并发 1；每个浏览器档案只允许一个租约。
- 资源停止线默认：归一化负载 85%、可用内存 1024 MB、证据盘可用空间 4096 MB。触线时任务保持排队，不得通过放宽阈值绕过。
- 页面和日志只用 request_id/trace_id 关联，不复制租约令牌、哈希、Cookie、凭证或任务输入。

## 过期租约恢复

平台运营管理员在 `/platform-admin/crawler-scheduler` 二次确认后调用幂等回收。只删除 `expires_at <= NOW(3)` 的调度槽位，不终止有效任务、不删除任务历史或档案；M03-04/M03-05 的任务/浏览器过期状态仍由原有恢复器负责。生产证据必须验证一次过期探针槽位回收、相同 Idempotency-Key 重放、平台审计和探针清理。

## 异常处置

- 进程数不为 1：停止新增采集，通过宝塔核对项目实例并只保留当前稳定实例。
- `crawler_resource_stop`：保持任务排队，检查同机 CPU、内存和磁盘；不得删除未知文件或放宽阈值。
- `crawler_lease_duplicate` / `crawler_provider_quota_exceeded`：先回收已过期槽位；仍异常则通过宝塔回滚候选，保留数据库和审计证据。
- MySQL/Redis 不可用：任务不得领取；先恢复宝塔服务，再重跑 live 门。

## 回滚

1. 通过宝塔把 Nginx 恢复为单一稳定 4101，上一个应用版本恢复后停止候选 4103；通过宝塔重启上一版 Node Worker 与 Python Crawler。
2. 保留 `crawler_scheduler_*` 与 `platform_audit_events`，不得为了通过验收删除失败证据。上一版不使用这些表时可暂留。
3. 只有确认所有 API、Worker、Crawler 已回到不读取/写入 0034 的版本，才用 `0034_crawler_scheduler_m08_05.down.sql` 删除新表。
4. 数据回滚失败时停止新采集并保持只读排查；不得启用备用服务器、负载均衡或面板外服务绕过。
