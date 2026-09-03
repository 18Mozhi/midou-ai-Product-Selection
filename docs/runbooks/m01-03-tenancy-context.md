# M01-03 组织与工作区上下文 Runbook

## 发布与验证

在宝塔备份 product_scout 后，按 `0010a`、`0010b`、`0010c`、`0010d`、`0010e`、`0010f`、`0010g` 顺序执行 up 迁移。发布 Web/API 构建并仅通过宝塔重启 Node API；API 代码和连接池在启动时加载，必须重启。Web 静态资源按宝塔站点发布规则替换。M01-03 没有 Worker/Crawler 逻辑或新环境变量，二者无需重启，`config/env.example` 也无需增加键。

执行 `npm run build`、三个 `tests/m01-03` 测试、`node scripts/verify-tenancy-live.mjs`、M01-03 Playwright 和 `npm run verify:module -- M01-03`。真实数据库探针必须显示 MySQL 5.7、product_scout 业务账号、utf8mb4、跨组织拒绝、上下文审计和测试数据清理通过。

人工检查：已有成员登录后进入 `/select-context`，只能看到本人活动成员资格对应的活动组织；已归档组织即使仍残留活动成员关系也不得显示。选择组织后只能看到该组织工作区/团队摘要。没有任何可用活动组织的新账号应看到“创建并进入选品空间”，点击一次后创建固定个人组织、默认工作区、组织管理员角色和组织范围并直接进入 `/home`；重复请求不得创建第二个组织。归档工作区不可进入；选择成功后刷新后续页面应由服务端会话上下文确定范围，浏览器不能提交 actor_id/session_id。

## 观测、故障与恢复

关注 `organization_forbidden`、`workspace_not_found`、`workspace_archived`、`personal_workspace_unavailable`、上下文选择失败率以及 `tenancy_audit_events` 中 request_id/trace_id 的连续性。403 激增时检查成员资格是否被禁用或请求组织是否错误；404 检查工作区是否属于当前组织；409 检查个人空间并发创建后的成员资格与默认工作区状态。数据库异常时保持页面错误状态，不缓存或猜测旧范围，并在宝塔检查 Node API/MySQL 日志与 readiness。

## 回滚

应用回滚优先：在宝塔回退 Web/API 到上一版本并重启 Node API，保留 0010 表以避免丢失组织上下文和审计。若业务确认必须删除 schema，先导出加密备份并确认不再有后续表外键，然后按 `0010g`、`0010f`、`0010e`、`0010d`、`0010c`、`0010b`、`0010a` 逆序执行 down；该操作会删除组织、成员资格、上下文与审计，属于破坏性操作，不能自动执行。回滚后验证 health live/ready 与本地登录，不得用面板外进程临时顶替。
