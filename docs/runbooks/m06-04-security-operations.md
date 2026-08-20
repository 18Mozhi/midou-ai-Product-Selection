# M06-04 宝塔运维与回滚

1. 备份后执行 `0022_security_operations_m06_04.up.sql`，由宝塔发布 Web/API。
2. 设置 `SECURITY_OPERATIONS_DEFAULT_WINDOW=24h` 与 `SECURITY_OPERATIONS_RECENT_LIMIT=50`，重启 Node API。
3. 用平台安全管理员访问 `/platform-admin/security`；确认桌面使用表格、390 像素窄屏使用摘要卡片和详情抽屉，页面无横向遮挡。业务状态应显示中文；Token 前缀、凭证指纹/key_version、原始标识和 request_id 默认收进“技术详情”，展开后仍可用于关联全局审计。
4. 轮换或撤销必须进入既有受控页面；不要在数据库直接改密文、会话或 Token。

回滚：回退 Web/API 后执行 `0022_security_operations_m06_04.down.sql`。只删除读取证据表，安全事件、会话、Token、凭证版本和平台审计全部保留。
