# M05-06 报表与导出运维和回滚

## 宝塔配置

Node API 与 Node Worker 必须在宝塔配置相同的 `REPORT_EXPORT_ROOT`。Worker 还读取轮询、租约、重试、生命周期和最大行数配置。所有配置均在启动时读取，修改后在宝塔重启 Node API 与 Node Worker；不得创建面板外生产服务。

目录应仅允许对应宝塔项目账号读写。日志队列名为 `report_exports`，关注 `succeeded`、`retry_scheduled`、`dead_letter`、`row_limit_exceeded`、`dependency_failed`。使用 `request_id/trace_id` 关联 `report_exports`、`audit_logs` 和 `outbox_events`。

用户可以在报表页直接重新生成已过期或 `dead_letter` 的文件。该动作不会恢复、覆盖或删除旧文件，而是创建新的 `queued` 任务；使用审计事件 `report.export.regenerated` 和字段 `regenerated_from_export_id` 追查来源。仍在排队、生成、等待重试或有效期内的文件会返回 409，避免重复消耗 Worker 配额。重新生成功能不增加环境变量，仍使用现有 `REPORT_EXPORT_*` 配置。

## 恢复和回滚

租约到期可自动重领。文件缺失时 API 返回 503，应核对 API/Worker 根目录是否一致；如原记录已经过期或最终失败，可在页面重新生成。到期文件由 Worker 清理，不可恢复。

回滚前在宝塔停止 API/Worker，备份数据库和导出目录，等待 leased 任务结束。执行 `0018f_reports_m05_06.down.sql` 会删除导出记录和幂等历史；随后恢复上一版本、移除六个 `REPORT_EXPORT_*` 配置并从宝塔启动服务。已生成文件需按备份清单人工清理，禁止对宽泛目录递归删除。
