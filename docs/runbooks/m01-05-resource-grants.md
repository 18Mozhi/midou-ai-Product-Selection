# M01-05 资源临时授权运维与回滚

## 宝塔发布

1. 在宝塔受限配置确认 Node API 仍连接 `product_scout` 业务账号；本模块无新增环境变量或秘密。
2. 备份数据库后，按顺序执行 `0012a_resource_grants_m01_05.up.sql`、`0012b_resource_grant_actions_m01_05.up.sql`、`0012c_resource_grant_audit_m01_05.up.sql`、`0012d_resource_grant_operations_m01_05.up.sql`。SQL 兼容 MySQL 5.7 与 `utf8mb4`。
3. 在宝塔 Node 项目发布新构建并重启 `product-scout-api`；健康检查 `/api/v1/health/live`、`/ready` 和 `/version`。
4. 在宝塔网站发布 Web 静态资源，打开 `/?view=resource-grants` 验证桌面与 390px。
5. Node Worker、Python Crawler、Redis 均没有 M01-05 新消费者或配置，不重启、不创建计划任务。到期由 API/共享授权 Guard 同步判断。

## 验证与告警

- 定向：`node --test tests/m01-05/resource-grant-domain.test.mjs`、API 与 contract 测试。
- 真实数据层：`node scripts/verify-resource-grants-live.mjs`，必须确认 MySQL 5.7、业务账号、同组织授权、跨组织拒绝、30 天边界、延长/撤销/到期/访问审计和清理。
- 视觉：`npx playwright test tests/e2e/m01-05-resource-grants.spec.ts`。
- 模块：`npm run verify:module -- M01-05`。
- 监控 `resource_grant_audit_events` 中 `access_denied`/`expired` 增量和 API 403/409；日志只记录 request_id/trace_id，不记录 Cookie、会话 Token 或秘密。

## 故障处置

- `grant_target_forbidden`：确认目标 membership 与工作区均为当前组织活动状态；不得改为邮箱链接或跨组织共享。
- `grant_action_not_allowed`：按资源类型选择白名单动作；不得临时加入证据下载、导出、凭证或重放。
- `grant_expiry_invalid`：到期必须在未来且不超过 30 天；这是代码锁定安全上限，不通过环境变量放宽。
- `grant_version_conflict`：刷新授权后，用最新 `version` 与新的 Idempotency-Key 重试。
- `grant_not_active`：已到期或撤销不能恢复，重新创建一条有新原因的新授权。
- 依赖不可用：在宝塔检查 MySQL 与 Node API；不要在面板外启动替代进程。

## 回滚

先在宝塔停止写流量并备份 0012 表。若已创建生产授权，回滚代码前先确认旧版本会默认拒绝这些授权；不能把资源授权误当 RBAC。按外键逆序执行 `0012d_resource_grant_operations_m01_05.down.sql`、`0012c_resource_grant_audit_m01_05.down.sql`、`0012b_resource_grant_actions_m01_05.down.sql`、`0012a_resource_grants_m01_05.down.sql`。随后在宝塔回滚 Node API 与 Web 发布并复查健康端点。

回滚会删除授权与专用审计表，必须以备份和审批为前置；不得在未备份时直接执行。M01-04 的角色、数据范围和 `authorization_decisions` 不回滚。
