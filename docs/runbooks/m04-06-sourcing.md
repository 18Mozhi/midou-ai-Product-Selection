# M04-06 供应链找货运维与回滚

## 宝塔上线

在宝塔发布任务备份后应用 `0017f_sourcing_m04_06.up.sql`，配置 `SOURCING_PROJECTION_POLL_MS`、`SOURCING_PROJECTION_LEASE_SECONDS`，重新构建 Vue，并在宝塔重启 Node API 与 Node Worker。运行 `npm run verify:module -- M04-06`。

## 诊断

- 找货任务不投影：确认关联采集任务属于同一组织/工作区且状态为成功、空成功或带警告完成；当前只接受真实 `product-supply-csv-v1` 记录。
- 候选不能对比：检查缺失项；采购成员必须带 Evidence ID 确认规格、交期、所在地、可信度、稳定性和风险。
- 采购任务被拒绝：数量不得低于现行报价 MOQ。
- 队列异常：在宝塔 Worker 日志搜索 `sourcing_projection`，再检查租约、尝试次数和 `last_error_code`。配置修改后必须重启 Worker。

## 回滚

先停用页面写入口并导出搜索、候选、报价版本、对比、采购任务、事件和 Outbox；在宝塔停止 Worker 后才执行 down 迁移。down 会删除本模块业务数据，必须确认备份可恢复。已被 P05 消费的任务不能由本迁移撤销，应按任务模块 Runbook 处理。回退应用后在宝塔重启 API/Worker。
