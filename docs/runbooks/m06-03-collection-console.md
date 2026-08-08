# M06-03 宝塔运维与回滚

1. 备份后执行 `0021_collection_console_m06_03.up.sql`，由宝塔发布并重启 Node API；Web 同步发布。
2. 设置 `COLLECTION_CONSOLE_RECENT_LIMIT=50`（10–200）。不需要重启 Worker/Crawler。
3. 访问 `/platform-admin/collection/overview`，用组织与工作区 ID 验证范围；从链接进入来源配置、健康、任务、浏览器运行和数据质量页面。
4. 使用 request_id/trace_id 关联 `collection_console_views`、`platform_audit_events`、任务尝试和宝塔日志。控制台本身不重放任务。

回滚：先回退 Web/API，再执行 `0021_collection_console_m06_03.down.sql`。已有来源、任务、尝试、死信、质量事实与平台审计不删除。
