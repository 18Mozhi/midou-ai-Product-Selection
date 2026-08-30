# M06-04 宝塔运维与回滚

1. 备份后执行 `0022_security_operations_m06_04.up.sql`，由宝塔发布 Web/API。
2. 设置 `SECURITY_OPERATIONS_DEFAULT_WINDOW=24h` 与 `SECURITY_OPERATIONS_RECENT_LIMIT=50`，重启 Node API。
3. 用平台安全管理员访问 `/platform-admin/security`；逐一验证事件、会话、访问与凭证、平台审计四个 URL 视图，确认时间窗、搜索、状态、重置、刷新、分页、浏览器返回和刷新后状态恢复。桌面使用表格，390 像素窄屏使用每页最多 20 条摘要卡片和详情抽屉，页面不得横向遮挡。
4. 核对会话、凭证和组织令牌：数据库中 `status=active` 但 `expires_at<=observed_at` 的记录必须显示为“已过期”且不计入有效摘要。接口不得出现 Session/Token hash、凭证密文、Cookie、原始 IP、原始 User-Agent 或原始设备标签；设备只显示粗粒度系统/浏览器分类。
5. 停止 MySQL 验证接口返回 `503 security_operations_dependency_unavailable`；恢复 MySQL 后用页面“刷新数据”确认保留数据可恢复。权限验证至少覆盖未登录 401、缺少 `platform:secure` 的 403 和平台安全管理员 200。
6. 轮换或撤销必须进入既有受控页面；不要在数据库直接改密文、会话或 Token。

回滚：回退 Web/API 后执行 `0022_security_operations_m06_04.down.sql`。只删除读取证据表，安全事件、会话、Token、凭证版本和平台审计全部保留。
