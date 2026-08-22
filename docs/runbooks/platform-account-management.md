# 平台账号管理运维与回滚

发布时先执行 `0036_automatic_hotspot_sources.up.sql`，再通过宝塔重启统一后端“ai选品”并发布 Web 静态文件。使用活动平台超级管理员检查“组织与用户”：创建一个测试组织应同时出现默认工作区，且首位组织管理员应拥有组织级数据范围；停用测试用户后旧会话应立即失效；角色变更应出现在平台审计。

发布验收时还要检查创建组织向导：未填写有效名称和英文标识时不得进入第二步；第二步必须展示首位管理员选择和默认工作区、组织级数据范围的影响说明；点击最终确认前不得发出创建请求，确认后仍只能发出一次原子创建请求。

进入“管理员管理”后检查“角色权限差异”：默认对比运营管理员和安全管理员，可切换到超级管理员，勾选“只看差异”时只展示两侧能力集合不一致的动作。对比数据必须来自 `GET /api/v1/platform/roles`；接口 403 时不得回退为前端写死矩阵，应按平台超级管理员授权故障处理。

发布前在已加载 API、授权和数据库构建产物且连接 MySQL 5.7 `product_scout` 业务账号的受限验证环境运行 `node scripts/verify-platform-accounts-live.mjs`。输出必须包含 `platform_role_catalog: passed`、三种平台角色的 `platform_permission_matrix` 和 `authorization_decision_audit: passed`；脚本会逐项验证固定能力的正反向授权，并在结束时删除临时用户、组织、授权判定和审计数据。出现 `platform_role_catalog_drift` 时停止发布，先核对角色迁移与代码目录；出现 `platform_capability_unexpected_allow` 或 `platform_permission_decision_audit_failed` 时停止发布并检查授权仓储及审计表。该脚本不应使用 root 数据库账号。

在 390 像素视口分别检查组织、用户和管理员页签：记录应显示摘要卡片且页面没有横向滚动；打开详情抽屉后仍可执行该记录原有操作。筛选条件应从抽屉打开，关闭再打开时仍保留已输入的关键词和状态。完整组织或用户 UUID 默认不可见，只能在记录详情内展开“技术详情”查看。

故障时按 request_id/trace_id 查询 `platform_audit_events`，按 actor/route/idempotency key 查询 `platform_account_operations`。回滚应用不能删除已创建组织、成员关系、角色或数据范围；按审计证据修复。不要直接修改用户密码哈希、会话令牌或角色表来绕过页面规则。

回滚应用前先停止平台账号写入口，再执行 `0036_automatic_hotspot_sources.down.sql`。Down 不恢复已经创建的组织、工作区、成员关系、用户状态或角色变更；这些是已审计业务操作，若要反向修改必须通过当前平台账号 API 或另行获得数据修复授权。
