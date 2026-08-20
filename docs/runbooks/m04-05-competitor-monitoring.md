# M04-05 竞品监控运维与回滚

## 宝塔上线

1. 备份 MySQL 和项目文件，在宝塔发布任务应用 `0017e_competitor_monitoring_m04_05.up.sql`。
2. 在宝塔 Node Worker 环境配置 `COMPETITOR_MONITOR_POLL_MS` 与 `COMPETITOR_MONITOR_LEASE_SECONDS`，随后重启 Node API 和 Node Worker；Vue 静态站点重新构建发布。
3. 运行 `npm run verify:module -- M04-05`，确认 MySQL 5.7、组织隔离、幂等、阈值告警、重试和页面视觉门均通过。

核心工作台增强发布还必须按顺序应用 `0044a_competitor_soft_delete.up.sql`、`0044d_nullable_competitor_metrics.up.sql`、`0044e_core_collection_projection.up.sql`、`0044f_enable_amazon_public_crawler.up.sql`。这些迁移由 `scripts/deploy-baota.py` 在宝塔重启前执行。发布后必须在宝塔重启 Node API 与 Node Worker；公开页面适配器和投影 Worker 都随 Node Worker 加载，不创建新服务。

## 诊断与调节

- 队列积压：检查 `competitor_snapshot_jobs` 的 `status/available_at/lease_expires_at/last_error_code`，再看宝塔 Worker 日志中的 `queue=competitor_monitor`。
- 快照不更新：确认竞品为 `active`、`amazon_product` 为 `enabled/public_page`，查看对应 `collection_tasks`、`collection_subqueries` 和 `core_collection_projection_runs`。页面没有披露的指标允许为空，不要手工补零。
- Amazon 解析升级：先应用 `0052a_amazon_structured_parser.up.sql`，再通过宝塔重启统一 Node 项目 `ai选品`。新任务的证据应优先显示 `application/ld+json` 与 `amazon.jsonld.Product.*` 字段路径；旧 HTML 回退证据仍可读取。无需重启 Python 项目。
- 告警未产生：核对规则范围、指标、方向和显式阈值。首个快照只是基线。
- 页面核对：详情应同时显示最早基线、当前快照、变化数和适用阈值；价格变化必须显示证据快照币种与变化时间。该呈现不新增配置，发布静态资源即可生效。
- 交互核对：添加入口必须依次经过商品链接、市场信息、确认采集三步；详情价格与库存时间轴应显示真实采集时间，当前竞品规则应自动选中该竞品。390px 下暂停与“删除竞品监控”只能从“更多操作”展开，外部链接必须标注新窗口。
- 配置修改后必须在宝塔重启 Node Worker；API 配置未动态读取。

## 回滚

先暂停写入并导出竞品身份、不可变快照、规则、变化、告警、事件和 outbox，再停止宝塔 Node Worker。应用 down 迁移会删除本模块全部表和 `competitor:manage` 授权，属于破坏性回滚；确认导出可恢复后才执行。回退代码与静态资源，最后在宝塔重启 Node API/Worker。P05 已消费的外部通知或任务不能通过本模块迁移自动撤回，应按其模块 Runbook 处理。
