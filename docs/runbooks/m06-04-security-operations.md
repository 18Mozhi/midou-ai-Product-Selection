# M06-04 宝塔运维与回滚

1. 备份后执行 `0022_security_operations_m06_04.up.sql`，由宝塔发布 Web/API。
2. 设置 `SECURITY_OPERATIONS_DEFAULT_WINDOW=24h` 与 `SECURITY_OPERATIONS_RECENT_LIMIT=50`，重启 Node API。
3. 用平台安全管理员访问 `/platform-admin/security`；逐一验证事件、会话、访问与凭证、平台审计四个 URL 视图，确认时间窗、搜索、状态、重置、刷新、分页、浏览器返回和刷新后状态恢复。桌面使用表格，390 像素窄屏使用每页最多 20 条摘要卡片和详情抽屉，页面不得横向遮挡。
4. 核对会话、凭证和组织令牌：数据库中 `status=active` 但 `expires_at<=observed_at` 的记录必须显示为“已过期”且不计入有效摘要。接口不得出现 Session/Token hash、凭证密文、Cookie、原始 IP、原始 User-Agent 或原始设备标签；设备只显示粗粒度系统/浏览器分类。
5. 仅在明确授权的隔离验证环境模拟 MySQL 不可用，验证接口返回 `503 security_operations_dependency_unavailable`；恢复后用页面“刷新数据”确认保留数据可恢复。不得为了 UI 验收停止生产 MySQL。权限验证至少覆盖未登录 401、缺少 `platform:secure` 的 403 和平台安全管理员 200。
6. 轮换或撤销必须进入既有受控页面；不要在数据库直接改密文、会话或 Token。

回滚：回退 Web/API 后执行 `0022_security_operations_m06_04.down.sql`。只删除读取证据表，安全事件、会话、Token、凭证版本和平台审计全部保留。

## UI 第二阶段 B2c：零摘要与历史记录

2026-09-08：安全摘要只计近期事件和当前有效生命周期对象，不能用它判断历史会话、过期/撤销凭证、组织令牌或平台审计是否存在。成功读取后保留工作区、四个视图、筛选和更新时间，由各集合显示自己的空态。没有匹配时可以切视图或查询/重置；读取失败仍显示原错误，不伪装成空列表。

事实规格及逐项未验范围见 `design-plans/ui-phase-2-2026-09-07/page-specs/P59.md` 和 `commercial-security-open-platform-contract-review.md`。永久 `UI2-CS59` 用例验证零摘要下历史会话、过期凭证、平台审计及空事件→会话→查询无匹配→重置恢复；桌面与390移动分别执行。测试使用隔离API响应，不证明真实数据库、全部角色或生产已验证。

本批仅改变 Web 成功状态展示，不改查询、权限、审计、环境配置或数据库。无需新增/回退0022迁移，不按上方首次模块退役说明执行 down.sql；失败时恢复已知稳定 Web 运行包。正式上线仍通过 `python scripts/deploy-baota.py` 和现有宝塔对象，预检既有迁移白名单及实际停启窗口，不自行建立前端独立部署流程。本批本地测试/构建不代表已部署，也不需要现在重启生产服务。
