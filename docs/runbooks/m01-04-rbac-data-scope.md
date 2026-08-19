# M01-04 RBAC 与数据范围 Runbook

## 发布与验证

备份 product_scout 后按 `0011a`–`0011g` 建表，再按 `0011h`、`0011i`、`0011j` 写入固定角色、能力和映射。发布 API/Web 构建，只通过宝塔重启 Node API；授权代码与连接池在启动时加载，必须重启。当前 Worker/Crawler 没有 P01 受保护业务任务，不需重启；未来消费者接入 Guard 后随对应宝塔项目发布。本模块无新环境变量，`config/env.example` 不增加键。

运行 `npm run build`、三个 `tests/m01-04` 测试、`node scripts/verify-rbac-live.mjs`、M01-04 Playwright 和 `npm run verify:module -- M01-04`。真实探针必须确认 MySQL 5.7、product_scout 账号、utf8mb4、角色矩阵、工作区与平台范围、跨组织拒绝、允许/拒绝审计及测试数据清理。

人工验证：登录、选择组织和工作区，访问 `/?view=authorization`。有 `role:read` 与组织范围者可查看组织角色矩阵；普通成员仍可读取本人有效授权摘要，但组织角色目录返回 403 并明确联系管理员；未选择上下文返回 409；登录过期返回 401。平台超级管理员还应通过 `/api/v1/platform/roles` 读取平台角色矩阵，运营或安全管理员直接调用该接口必须返回 403。禁止通过浏览器修改响应或显示菜单来判断 API 是否授权。

## 观测与故障恢复

按 capability、surface、reason 监控 `authorization_decisions` 的 denied 比例。`membership_inactive` 激增时检查成员状态；`capability_missing` 检查角色分配；`scope_mismatch` 检查真实 resource owner/team/workspace 字段及范围记录。数据库不可用时保持默认拒绝，页面展示请求标识，不缓存允许决定。平台角色异常必须检查 `platform_role_assignments`，不能临时把组织管理员提升为平台角色。

## 回滚

优先在宝塔回退 API/Web 且保留 0011 表和决策审计。禁止回退到仅靠前端菜单授权的构建。若经安全负责人确认必须删除 schema，先导出加密备份并确认下游无外键，依次执行 `0011j`、`0011i`、`0011h` down 删除固定映射，再按 `0011g`、`0011f`、`0011e`、`0011d`、`0011c`、`0011b`、`0011a` 逆序 down；这会删除角色分配、范围和授权审计，属于破坏性操作，不能由验收脚本自动执行。回滚后通过宝塔重启并验证 health、登录、组织选择和默认拒绝。
