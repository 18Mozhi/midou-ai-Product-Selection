# M04-06 供应链找货运维与回滚

## 宝塔上线

在宝塔发布任务备份后应用 `0017f_sourcing_m04_06.up.sql`，配置 `SOURCING_PROJECTION_POLL_MS`、`SOURCING_PROJECTION_LEASE_SECONDS`，重新构建 Vue，并在宝塔重启 Node API 与 Node Worker。运行 `npm run verify:module -- M04-06`。

核心工作台增强发布还必须按顺序应用 `0044b_sourcing_soft_delete.up.sql`、`0044c_truthful_missing_metrics.up.sql` 和 `0044e_core_collection_projection.up.sql`。API 启动时会从代码目录同步并启用 `made_in_china_search` 与 `ec21_supplier_search`；不需要官方 API 密钥。变更代码后必须在宝塔重启 Node API 与 Node Worker，不得创建 systemd、独立 PM2 或其他面板外服务。

`verify-sourcing-live.mjs` 使用随机 `m04-06-…@example.test` 范围，并为两条合成规范记录写入当前任务的 `collection_task_evidence_links`。验收不创建第二个队列消费者，而是等待宝塔管理的生产 Worker 投影；查询只允许使用本次 `job_id + organization_id + workspace_id` 精确范围，禁止领取或读取任意其他生产任务。清理时必须先删除该随机组织的证据关联，再删除规范记录、原始证据和任务。若本次 job 没有在 10 秒内进入受控终态，验收必须失败关闭，不能把其他队列项的结果当成本模块证据。

## 诊断

- 找货任务不投影：确认 `made_in_china_search` 与 `ec21_supplier_search` 为 `enabled/public_page`，关联采集任务属于同一组织/工作区并进入成功、空成功或带警告完成；再按精确任务编号检查各子查询和 `core_collection_projection_runs`。旧的 `product-supply-csv-v1` 投影仍兼容。
- 候选不能对比：检查缺失项；采购成员必须带 Evidence ID 确认规格、交期、所在地、可信度、稳定性和风险。
- 采购任务被拒绝：数量不得低于现行报价 MOQ。
- 队列异常：在宝塔 Worker 日志搜索 `sourcing_projection`，再检查租约、尝试次数和 `last_error_code`。配置修改后必须重启 Worker。

## 回滚

先停用页面写入口并导出搜索、候选、报价版本、对比、采购任务、事件和 Outbox；在宝塔停止 Worker 后才执行 down 迁移。down 会删除本模块业务数据，必须确认备份可恢复。已被 P05 消费的任务不能由本迁移撤销，应按任务模块 Runbook 处理。回退应用后在宝塔重启 API/Worker。
