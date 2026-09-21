# 平台账号管理运维与回滚

## P43 创建与改密回执归属当前核验

运行`node scripts/verify-ui-phase2-user-lifecycle-review-current-replay.mjs`验证当前36个
局部Vue场景，不截图或访问生产；`--smoke`仅创建。当前72图入口是
`output/playwright/p43-lifecycle-current-replay-r1/index.html`，完整包拒绝capture/resume
覆盖。来源检查运行`node --test tests/unit/ui-phase2-user-lifecycle-review-capture-boundary.test.mjs`。
首轮全库入口`node scripts/verify-ui-phase2-user-lifecycle-unit-gate.mjs`已保留失败报告，
已有报告时拒绝再次运行。格式门ENAMETOOLONG修复后使用独立
`node scripts/verify-ui-phase2-user-lifecycle-unit-gate-r2.mjs`，同样不覆盖已有r2报告。
详见`design-plans/ui-phase-2-2026-09-07/P43-LIFECYCLE-CURRENT-REVIEW.md`。
无生产代码、配置或重启变化；不得据此操作真实账号或把局部回放当作宝塔验收。

## P43 改密与原因当前审核

`node scripts/verify-ui-phase2-user-security-review-current-replay.mjs`无参数只运行当前Vue
审核组合，不截图、不访问生产；`--smoke`仅改密。368张图位于
`output/playwright/p43-security-current-replay-r1/index.html`。完整包拒绝`--capture`/
`--resume`覆盖，当前来源核验运行`node --test tests/unit/ui-phase2-user-security-review-capture-boundary.test.mjs`。
没有真实改密/角色或会话写入，不需调参、重启或迁移；不得据审核脚本操作生产账号。
详见`design-plans/ui-phase-2-2026-09-07/P43-SECURITY-CURRENT-REVIEW.md`。

## P43 当前用户目录、详情和创建审核

`node scripts/verify-ui-phase2-user-review-current-replay.mjs`不带参数只回放当前Vue审核
组合，不截图或访问生产。当前154图见`output/playwright/p43-current-replay-r1/index.html`；
完整包存在时`--capture`/`--resume`拒绝覆盖。来源校验运行
`node --test tests/unit/ui-phase2-user-review-capture-boundary.test.mjs`。仅审核辅助变化，
无运行配置、API或重启要求。详见`design-plans/ui-phase-2-2026-09-07/P43-PAGE-CREATE-CURRENT-REVIEW.md`；
不据此执行下方历史迁移，改密/原因/真实账号权限与生产发布仍另行验证。

## P44 当前审核状态与历史图证

当前独立审核入口见`output/playwright/p44-current-replay-r3/index.html`，322张当前Vue审核
组合图、1653检查，旧图不覆盖。来源核验运行`node --test tests/unit/ui-phase2-admin-review-capture-boundary.test.mjs`。
图包创建入口`node scripts/verify-ui-phase2-admin-review-current-replay.mjs --capture`仅用于
首次捕获；完整包存在后拒绝重拍/续拍。当前仅审核宿主的标题和手机内边距整合，运行页面
及权限不变，不需生产重启。全库、清理遗留及审核边界见
`design-plans/ui-phase-2-2026-09-07/P44-CAPTURE-BOUNDARY-REPAIR.md`，不得据此执行下面历史迁移。

## 第二阶段账号详情读取与写入反馈归属修复

此修复仅更新Web静态运行包，没有新增SQL、API、配置或调节项，也不新增后端重启要求。以下早期0036迁移说明不是此次UI更新或回退的通用操作：正式发布以AGENTS及当前`python scripts/deploy-baota.py`为准，核对线上迁移记录、既有白名单、宝塔停启窗口及恢复材料；不得为回退此次前端修复执行Down SQL。当前部署器会停止Node并检查迁移，不能承诺零停机。

在隔离账号上验证：读取甲详情时关闭并打开乙、关闭后重新打开甲、浏览器前进/后退离开账号页，迟到结果均不替换当前详情或复活已关闭窗口。桌面和390移动执行`tests/e2e/m06-01-platform-accounts.spec.ts`，先`--grep 'UI2-PA01|UI2-PA02|UI2-PA03|UI2-PA04'`定向验证，通过后运行该文件完整回归。UI2-PA03检查登录状态、平台角色、会话撤销和加入组织写入：停留原窗正常反馈，切人/关闭/重开/离页后不污染新窗口；UI2-PA04检查过期原因确认不发写请求。已有写入不因关闭回滚，也不自动重发；需要核对后台最终结果时，重新主动打开对应账号，或按原审计链查询。

创建、强制改密、组织资料/状态、共享原因窗自动关闭、授权撤回及全站视觉仍需另验。上述为隔离Vue请求合同用例，不替代真实角色/会话/数据库事务验收。本次没有新配置项或重试/超时调节；部署只需交付更新后的Web运行包，仍按既有部署器检查迁移白名单与停启窗口，不执行Down SQL。

## 历史模块上线与业务核验

发布时先执行 `0036_automatic_hotspot_sources.up.sql`，再通过宝塔重启统一后端“ai选品”并发布 Web 静态文件。使用活动平台超级管理员检查“组织与用户”：创建一个测试组织应同时出现默认工作区，且首位组织管理员应拥有组织级数据范围；停用测试用户后旧会话应立即失效；角色变更应出现在平台审计。

发布验收时还要检查创建组织向导：未填写有效名称和英文标识时不得进入第二步；第二步必须展示首位管理员选择和默认工作区、组织级数据范围的影响说明；点击最终确认前不得发出创建请求，确认后仍只能发出一次原子创建请求。

进入“管理员管理”后检查“角色权限差异”：默认对比运营管理员和安全管理员，可切换到超级管理员，勾选“只看差异”时只展示两侧能力集合不一致的动作。对比数据必须来自 `GET /api/v1/platform/roles`；接口 403 时不得回退为前端写死矩阵，应按平台超级管理员授权故障处理。

发布前在已加载 API、授权和数据库构建产物且连接 MySQL 5.7 `product_scout` 业务账号的受限验证环境运行 `node scripts/verify-platform-accounts-live.mjs`。输出必须包含 `platform_role_catalog: passed`、三种平台角色的 `platform_permission_matrix` 和 `authorization_decision_audit: passed`；脚本会逐项验证固定能力的正反向授权，并在结束时删除临时用户、组织、授权判定和审计数据。出现 `platform_role_catalog_drift` 时停止发布，先核对角色迁移与代码目录；出现 `platform_capability_unexpected_allow` 或 `platform_permission_decision_audit_failed` 时停止发布并检查授权仓储及审计表。该脚本不应使用 root 数据库账号。

在 390 像素视口分别检查组织、用户和管理员页签：记录应显示摘要卡片且页面没有横向滚动；打开详情抽屉后仍可执行该记录原有操作。筛选条件应从抽屉打开，关闭再打开时仍保留已输入的关键词和状态。完整组织或用户 UUID 默认不可见，只能在记录详情内展开“技术详情”查看。

故障时按 request_id/trace_id 查询 `platform_audit_events`，按 actor/route/idempotency key 查询 `platform_account_operations`。回滚应用不能删除已创建组织、成员关系、角色或数据范围；按审计证据修复。不要直接修改用户密码哈希、会话令牌或角色表来绕过页面规则。

回滚应用前先停止平台账号写入口，再执行 `0036_automatic_hotspot_sources.down.sql`。Down 不恢复已经创建的组织、工作区、成员关系、用户状态或角色变更；这些是已审计业务操作，若要反向修改必须通过当前平台账号 API 或另行获得数据修复授权。
