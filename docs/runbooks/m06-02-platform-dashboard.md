# M06-02 宝塔运维与回滚

1. 在宝塔备份数据库，已执行过 `0020_platform_dashboard_m06_02.up.sql` 的环境只需再执行 `0037_platform_management_operations.up.sql`，然后发布同一提交的 Web 与 Node API。迁移兼容 MySQL 5.7 与 utf8mb4。
2. 在 Node API 受限环境设置 `PLATFORM_DASHBOARD_DEFAULT_WINDOW=24h`、`PLATFORM_DASHBOARD_QUEUE_WARNING=1000`、`PLATFORM_DASHBOARD_ERROR_LIMIT=20`。调整后必须由宝塔重启 Node API；不需要重启 Worker/Crawler。
3. 以平台运营管理员访问 `/platform-admin`，确认折线图展示成功/失败任务趋势；再检查内容、通知、邮件、系统状态、账号与组织、人员与权限等导航。内容状态修改必须填写原因，并用 request_id 在 `platform_audit_events` 定位记录。
4. 告警异常时先在宝塔核对 Node API、MySQL、Worker/Crawler 日志及既有采集控制台；驾驶舱不会重放任务或修改队列。

发布后必须通过宝塔重启 Node API 以加载新增路由；Web 静态文件按现有网站发布流程替换，不需要重启 Worker/Crawler。

回滚：先由宝塔回退 Web/API 到上一提交，再执行 `0037_platform_management_operations.down.sql`。如果需要完整回退原 M06-02，再执行 `0020_platform_dashboard_m06_02.down.sql`。Down 不回滚已经写入的内容状态和审计事实；回滚前导出相关审计记录。
