# M01-05 资源临时授权架构

## 范围、依据与非目标

本模块依据总纲 2.3.1，已读取 `images-html/README.txt`、`manifest.json`、概念图 19「个人中心」与 57「角色与权限」。页面沿用个人权限摘要和组织权限后台的信息层级，提供桌面与 390px 的列表、筛选、详情、创建、延长、撤销、加载、空、错误、无权、登录过期和业务受阻状态。图片只约束视觉层级，授权动作与数据合同以服务端和总纲为准。

首发只允许把一个 `task`、`opportunity`、`competitor` 或 `sourcing` 资源授权给同一组织的活动成员；工作区必须属于同一组织。目标成员由 `memberships` 与 `users` 联查，组织外身份、匿名链接、邮箱分享和跨组织 Token 均不支持。资源授权不会提升成员角色或数据范围，也不会创建自定义角色。

## 领域规则与权限判定

`resource_grants` 保存组织、工作区、资源类型、资源 UUID、目标 membership、授权人、业务原因、到期、撤销和版本；动作拆到 `resource_grant_actions`。创建、延长、撤销使用 `Idempotency-Key`，并由 `resource_grant_operations` 保存请求哈希；相同键和相同请求返回原结果，不同请求返回冲突。到期最长为处理时刻后 30 天；只允许延长仍生效的授权，过期或撤销后必须新建，不能静默恢复。

`AuthorizationService` 先执行平台/组织 RBAC 与 Data Scope；仅在活动成员因能力或范围不足时，才对同时提供的 `resourceType + resourceId + workspaceId` 查询指定资源授权。授权目标、组织、工作区、类型、资源 UUID 和动作必须全部一致。没有完整资源事实时保持默认拒绝。

安全动作白名单固定为：

- `task`: `task:read`、`task:update`
- `opportunity`: `opportunity:read`、`opportunity:decide`
- `competitor`: `competitor:read`
- `sourcing`: `sourcing:read`、`supplier_quote:manage`、`cost:confirm`

原始证据下载、任何导出、凭证引用和 `collection:replay` 不在白名单，不能通过 Resource Grant 获得。实际资源模块上线时必须把真实 organization/workspace/type/id 传入同一个 Guard，不能仅凭前端菜单或授权列表放行。

## 动作 × 数据范围 × API/页面

| 动作 | RBAC 管理范围 | Resource Grant 范围 | API / 页面 |
|---|---|---|---|
| 查看本人资源授权 | 活动 membership + 当前会话组织 | 仅本人 membership、当前组织 | `GET /api/v1/me/resource-grants`；`/?view=resource-grants` |
| 查看组织授权 | `role:read` + organization scope | 当前会话组织 | `GET /api/v1/org/{organizationId}/resource-grants` |
| 查看可授权成员 | `membership:read` + organization scope | 同组织活动 membership | `GET /api/v1/org/{organizationId}/resource-grant-targets` |
| 创建、延长、撤销 | `role:manage` + organization scope | 指定 workspace/type/id/action；最长 30 天 | 资源授权 POST/PATCH/撤销 API；组织后台表单 |
| 读取/协作指定资源 | 原 RBAC+Data Scope 先判；不足时检查授权 | exact organization/workspace/type/id/action | API、Worker、文件、事件、SSE；export 面仍复用 Guard 但无导出动作可授权 |
| 证据下载、导出、凭证、重放 | 仅后续对应专用能力与范围 | 永不由首发 Resource Grant 授予 | 后续业务 API/Worker；当前默认拒绝 |

组织管理员用既有 `role:manage` 管理授权，审计员可通过 `role:read` 只读；普通活动成员可查看自己的授权。此安排不新增能力代码或角色映射，避免 M01-05 反向扩大 M01-04 的角色合同。

## 审计、同步到期与运行边界

`resource_grant_audit_events` 同步记录 created、extended、revoked、expired、accessed、access_denied，包括 actor、授权、资源、动作、执行面、结果、原因、request_id、trace_id、时间和 schema_version。RBAC 最终允许/拒绝仍同时进入 `authorization_decisions`。

到期真相是 MySQL 的 `expires_at`，每次列表与实际访问同步比较当前时间；因此到期立即不再授权，不依赖 Worker、Crawler、Redis、计划任务或面板外 cron。M01-05.A05 的异步队列、租约、重试和死信不适用于安全前置判定，创建异步失效任务反而会产生授权过期后仍可访问的窗口。

本模块没有新增环境变量；`config/env.example` 不增加 `RESOURCE_GRANT_*` 或可被运行时放大的天数开关。生产变更只需要在宝塔执行 0012 迁移、重启 Node API、发布 Web 静态资源；Worker 与 Crawler 无需重启。

## A01–A17 证据

- A01–A05：本文、`packages/resource-grants/src/index.ts`、`packages/authorization/src/index.ts` 与 0012 迁移。
- A06–A11：OpenAPI、contracts、API/MySQL Repository、资源授权页面、共享 Guard 与双层审计。
- A12–A16：领域/API/契约测试、MySQL 5.7 生命周期隔离探针、Playwright 桌面/390 快照和故障分支。
- A17：总纲、Feature Map、本文、Runbook、模块登记和验收报告。
