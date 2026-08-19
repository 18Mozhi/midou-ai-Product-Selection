# M06-02 宝塔运维与回滚

1. 在宝塔备份数据库。固定目录部署脚本会在切换代码前校验并幂等执行 `0040_platform_messages.up.sql`；已执行环境只校验迁移文件校验值。迁移兼容 MySQL 5.7 与 utf8mb4，不创建常驻服务。
2. 在 Node API 受限环境设置 `PLATFORM_DASHBOARD_DEFAULT_WINDOW=24h`、`PLATFORM_DASHBOARD_QUEUE_WARNING=1000`、`PLATFORM_DASHBOARD_ERROR_LIMIT=20`。调整后必须由宝塔重启 Node API；不需要重启 Worker/Crawler。
3. 以平台运营管理员访问 `/platform-admin`，确认折线图展示成功/失败任务趋势；再检查内容、通知、系统状态、账号与组织、人员与权限等导航。邮件 Provider 为 `pending_provider_selection` 时不得出现“邮箱管理”菜单，直接访问 `/platform-admin/email` 应显示页面不存在，通知偏好和平台通知草稿的邮件选项应禁用；直接 API 提交 `email_enabled=true` 或邮件草稿必须返回 `mail_provider_pending`。历史邮件事实仍保留，不执行删除。所有允许的修改必须填写原因，并用关联编号在 `platform_audit_events` 定位记录。
4. 告警异常时先在宝塔核对 Node API、MySQL、Worker/Crawler 日志及既有采集控制台；驾驶舱不会重放任务或修改队列。

发布后必须通过宝塔重启 Node API 以加载新增路由；Web 静态文件按现有网站发布流程替换，不需要重启 Worker/Crawler。

回滚：先由宝塔回退网站与后端到上一提交。仅在确认不再需要通知/邮件草稿及发布记录后，才人工执行 `0040_platform_messages.down.sql`；该操作会删除平台消息记录，必须先备份。历史投递与审计事实不随表回滚删除。
