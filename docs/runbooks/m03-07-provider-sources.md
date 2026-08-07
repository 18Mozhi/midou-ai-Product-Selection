# M03-07 首批来源运维与回滚

## 宝塔部署

生产只使用宝塔面板已有对象：`product-scout-api` Node 项目、`product-scout-worker` Node 项目、MySQL 5.7、Redis 和站点静态文件。不得创建 systemd、独立 PM2、宿主机 crontab、屏外 Docker Compose 或其他常驻进程。

发布顺序：备份 MySQL 与证据目录；执行 `0016g_provider_sources_m03_07.up.sql`；部署构建产物；在宝塔先重启 Node API，再重启 Node Worker；检查 `/api/v1/health/ready`、Worker `registered_sources` 心跳和来源页面。迁移必须由 `product_scout` 业务账号在 `product_scout` 库执行，服务端字符集必须为 `utf8mb4`。

## 启用与日常操作

1. 在“首批来源”登记目录项，确认返回 `disabled`。
2. Google News 在启用前由所有者记录当前条款、允许的调用频率、展示/保存字段和保留期复核；CSV 由数据所有者确认上传权利和字段含义。
3. 在“来源定义”显式改为 `enabled`。不要修改固定 URL 模板，也不要在 Provider 字段放 Cookie、Token 或账号。
4. 创建一个小范围回放，从采集控制台确认 `scheduled → queued → leased → running → ...`，再到“全量数据”检查原始证据、规范化记录和字段血缘。

调节采集轮询、租约或通用响应上限时修改宝塔受限环境中的 `COLLECTION_TASK_*` / `PROVIDER_ADAPTER_*`，然后重启 Node Worker；适配器健康探针同时用于 API 时也重启 Node API。代码固定的 RSS 2 MB、CSV 1 MB 和每任务 20 条不能通过环境变量放宽。

## 告警与故障演练

- `rate_limited`：暂停扩大频率，等待任务可用时间；不要通过并发绕过限制。
- `source_changed` / `parse_failed`：立即将 Provider 改为 `disabled`，保留失败证据和 trace_id，更新 Parser 及合同测试后再启用。
- `permission_denied`：核对 Provider 是否启用、组织/工作区状态和平台权限。
- `network_error` / `timeout`：检查宝塔 Node Worker 日志、DNS/出口与上游状态；任务按 M03-05 退避，第四次失败进入 dead letter。
- 证据写入失败：停止回放，在宝塔检查中国境内 `EVIDENCE_ROOT` 权限/容量和 MySQL；禁止仅把任务手改为成功。

每次故障注入后以 request_id/trace_id 核对 `collection_task_events`、`collection_task_attempts`、`provider_source_replay_runs` 和 `raw_evidence`，并确认其他组织查询不到本组织数据。

## 回滚

先在来源定义中将两个来源置为 `disabled`，等待正在运行的任务结束或按 M03-05 恢复规则处理，然后在宝塔停止 Node Worker。回滚应用代码；若确认没有任何 M03-07 回放数据需要保留，先备份并执行 `0016g_provider_sources_m03_07.down.sql`。Down 只删除 replay run 与幂等操作表，不删除 Provider、M03-05 任务或 M03-06 证据；如需删除这些业务记录，必须另行获得数据删除授权。最后由宝塔启动/重启 Node API 与 Node Worker并复查健康状态。
