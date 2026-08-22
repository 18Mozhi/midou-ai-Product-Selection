# M08-05 宝塔单机 Crawler 调度 Runbook

## 部署

1. 在候选发布迁移中以 `product_scout` 业务账号执行 `0034_crawler_scheduler_m08_05.up.sql`、`0055_provider_runtime_circuits.up.sql` 与 `0061_crawler_completion_spool_status.up.sql`；确认 MySQL 5.7、调度表、来源运行熔断表及完成回执水位表。
2. 在宝塔受限环境加入 `CRAWLER_SCHEDULER_*`、`CRAWLER_COMPLETION_RETENTION_DAYS`、`CRAWLER_COMPLETION_MAX_BYTES` 和 `CRAWLER_COMPLETION_MIN_FREE_DISK_MB`。Node Worker=1、宝塔 Python Crawler=1、每来源=1，不提供调大开关；回执保留期只告警，不执行自动删除。
3. 只通过宝塔分别重启既有 `ai选品` Node 项目和 `ai选品-python` Python 项目。不得用 systemd、独立 PM2、宿主 crontab 或屏外 Docker Compose。
4. 执行生产前置、MySQL live、调度 live、API 与浏览器验收；当前单后端只覆盖固定目录，不创建版本目录、`current` 链接或常驻候选项目。

## 日常核验

- 宝塔必须恰好有一个“ai选品”Node 项目和一个“ai选品-python”Python 项目。Node 项目只监听 4101 并托管 API/Worker；Python 项目不监听公网端口，只领取 `browser_collection_jobs` 并在执行期间维持 Crawler 心跳和 Playwright 桥接，空闲时不得上报伪运行心跳。不得创建额外 Worker、Crawler 或常驻 4103 候选。
- `crawler_scheduler_leases` 的 Worker/Crawler 活动槽位分别不超过 1；每来源活动槽位不超过有效并发 1；每个浏览器档案只允许一个租约。
- “来源并发与排队”汇总待领取任务、最老等待和饥饿风险来源，并逐来源展示活动/有效并发、当前已到期可领取任务数、最长等待、等待 P50/P95、24 小时成功率、耗时 P95、样本量和独立熔断。排队只统计服务端时间已经到达 `available_at` 的任务；未来退避或限流任务不计入当前等待。最长等待超过同来源真实近 24 小时 P95 时提示饥饿风险；没有样本时只提示缺少基线。若等待持续上升，先核对同页进程、租约、资源与告警，再通过任务中心下钻，不得直接调大单机并发。
- “吞吐与失败率趋势”按浏览器运行小时桶展示最近 24 小时总量、成功、失败和失败率；没有样本时明确显示无样本，不把 0 次运行表述为 100% 健康。
- 采集调度页的“租约、进程与采集任务”必须把每个活动槽位关联到 Node Worker 或 Python Crawler、当前任务状态、最近心跳和到期时间。任务 UUID、运行 UUID、进程标识与槽位类型仅在“技术详情”中查看；页面不得展示组织/工作区、任务输入、租约令牌或凭证。
- 资源停止线默认：归一化负载 85%、可用内存 1024 MB、证据盘可用空间 4096 MB。触线时任务保持排队，不得通过放宽阈值绕过。
- “完成回执”必须展示待回写/隔离数量与字节、最老回执、保留期、容量上限和目录所在磁盘可用量。默认保留期 30 天、容量 512 MiB、磁盘停止线 4096 MB；保留期或隔离告警要求人工核对 correlation，禁止直接删除回执。
- 页面和日志只用 request_id/trace_id 关联，不复制租约令牌、哈希、Cookie、凭证或任务输入。

## 过期租约恢复

平台运营管理员在 `/platform-admin/crawler-scheduler` 二次确认后调用幂等回收。确认框先展示当前读取时点的过期槽位总数、Worker/Crawler/来源类型、关联任务数和最早到期时间；这只是影响预览，执行事务会再次按服务端时间筛选。只删除 `expires_at <= NOW(3)` 的调度槽位，不终止有效任务、不删除任务历史或档案；M03-04/M03-05 的任务/浏览器过期状态仍由原有恢复器负责。生产证据必须验证一次过期探针槽位回收、相同 Idempotency-Key 重放、平台审计和探针清理。

## 来源级熔断恢复

来源连续运行失败达到 `providers.circuit_failure_threshold` 后只暂停该来源，其他来源继续执行。先进入“来源健康”，对同一来源执行一次真实健康检查；只有结果为 `ready` 且检查时间晚于熔断开启时间，才能回到采集调度页二次确认“解除熔断”。恢复 API 要求 `platform:operate`、同源和 Idempotency-Key，只清零当前来源并记录 `platform.crawler_scheduler.provider_recover` 审计。不得直接修改表、用旧健康结果或批量解除全部来源。

## 异常处置

- Node Worker 或 Python Crawler 进程数不为 1：停止新增采集，通过宝塔分别核对 `ai选品` 与 `ai选品-python`，只保留各一个当前稳定实例。
- `crawler_resource_stop`：保持任务排队并记录受阻状态；设备容量不作为软件完成条件，不得因此创建其他生产项目绕过。
- `crawler_lease_duplicate` / `crawler_provider_quota_exceeded`：先回收已过期槽位；仍异常则通过宝塔回滚候选，保留数据库和审计证据。
- `crawler_completion_spool_*`：先恢复 Node API 回写链，核对待回写和隔离回执的 request_id/trace_id；容量或磁盘触线时停止领取新作业。保留期到达不代表可以删除，必须在回写成功或取得终态登记依据后人工处理。
- MySQL/Redis 不可用：任务不得领取；先恢复宝塔服务，再重跑 live 门。

## 回滚

1. 在本地切换到上一已验证 Git 提交，重新运行 `python scripts/deploy-baota.py`，再通过宝塔重启唯一的“ai选品”统一后端；Nginx 始终只指向 4101。
2. 保留 `crawler_scheduler_*` 与 `platform_audit_events`，不得为了通过验收删除失败证据。上一版不使用这些表时可暂留。
3. 只有确认所有 API、Worker、Crawler 已回到不读取/写入 0055/0034 的版本，才依次用 `0055_provider_runtime_circuits.down.sql`、`0034_crawler_scheduler_m08_05.down.sql` 删除新表。
4. 数据回滚失败时停止新采集并保持只读排查；不得启用备用服务器、负载均衡或面板外服务绕过。

## 完成回执水位发布

应用 `0061_crawler_completion_spool_status.up.sql`，在宝塔受限配置写入三个 `CRAWLER_COMPLETION_*` 参数，然后依次重启 `ai选品` 和 `ai选品-python` 并发布 Web 静态文件。Python 配置只在进程启动时读取，必须重启；Node 需要迁移和新合同，同样必须重启。回滚前停止 Python Crawler 并保留全部回执文件；旧版不读取新表时可保留该表，只有确认所有运行版本均不再读取后才执行 `0061_crawler_completion_spool_status.down.sql`。

## 本次探针与页面纠偏发布

本次只修改 Node API 的 Linux 进程探针和 Web 展示，不修改 Python Crawler 代码、环境变量、数据库或端口。发布后通过宝塔重启 `ai选品` Node 项目并发布 Web 静态文件；`ai选品-python` 必须保持一个健康实例，但无需因本次变更重启。

来源排队观测同样只修改 Node API 查询与 Web 展示，不新增迁移、配置或服务。发布后通过宝塔重启托管 API 与 Worker 的 `ai选品` 统一 Node 项目并发布 Web 静态文件；不创建或单独重启 Worker，`ai选品-python` 无需重启。

## 浏览器业务作业链发布

应用 `0048_browser_collection_jobs.up.sql` 后，通过宝塔同时重启 `ai选品` 与 `ai选品-python`。删除受限配置中已经弃用的 `CRAWLER_ORGANIZATION_ID`、`CRAWLER_WORKSPACE_ID`、`CRAWLER_PROFILE_ID` 和 `CRAWLER_EXECUTION_REQUEST_FILE`；保留服务 Token、API Base URL、租约、心跳、Playwright runner 与凭证主密钥。发布后运行 `npm run verify:crawler-chain`，确认无任务返回 204、任务心跳同步更新三类租约、完成回写同一业务子查询。

## Python Crawler 模块拆分发布

本次内部拆分没有新增环境变量、端口、依赖、数据库字段或 API 合同，宝塔启动命令仍为 `python -m scoutops_crawler --env-file=/www/wwwroot/ai选品/config/product_scout.env`。部署 Python 运行包后必须在宝塔重启 `ai选品-python` 以加载新模块；Node 项目和 Web 不因该拆分单独重启。重启前不要删除 `CRAWLER_COMPLETION_SPOOL_ROOT` 中的待回写文件；新代码按回执内 `created_at` 轮询，历史文件缺少该字段时按文件修改时间兼容处理。暂时网络或服务端故障继续留在原队列；连续两次不可重试响应或结构损坏的文件会保留到同一受限根目录的 `quarantine`。运营人员须按其中的 `request_id`、`trace_id`、`last_error_code` 修复合同后人工审阅，不能直接删除或自动重放隔离文件。
