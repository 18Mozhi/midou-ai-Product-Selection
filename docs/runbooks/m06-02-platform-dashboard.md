# M06-02 宝塔运维与回滚

1. 在宝塔备份数据库，执行 `0020_platform_dashboard_m06_02.up.sql`，发布同一提交的 Web 与 Node API。
2. 在 Node API 受限环境设置 `PLATFORM_DASHBOARD_DEFAULT_WINDOW=24h`、`PLATFORM_DASHBOARD_QUEUE_WARNING=1000`、`PLATFORM_DASHBOARD_ERROR_LIMIT=20`。调整后必须由宝塔重启 Node API；不需要重启 Worker/Crawler。
3. 以平台运营管理员访问 `/platform-admin`，确认无终态样本显示“暂无终态”、无来源样本显示“未知”，并用 request_id 在 `platform_audit_events` 定位读取记录。
4. 告警异常时先在宝塔核对 Node API、MySQL、Worker/Crawler 日志及既有采集控制台；驾驶舱不会重放任务或修改队列。

回滚：先由宝塔回退 Web/API 到上一提交，再执行 `0020_platform_dashboard_m06_02.down.sql`。删除的仅是驾驶舱访问证据表；已有平台审计事件和业务事实保留。回滚前导出 `platform_dashboard_views` 以满足审计保留要求。
