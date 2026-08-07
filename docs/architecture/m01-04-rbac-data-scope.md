# M01-04 RBAC 与数据范围架构

## 范围与图片依据

本模块已读取 `images-html/README.txt`、`images-html/manifest.json`、`images-html/01_72_page_concepts/56_成员管理.jpg`、`57_角色与权限.jpg` 与 `images-html/02_high_resolution_core_pages/09_赛博风组织管理后台仪表盘.png`。页面采用独立组织后台侧栏、服务端授权摘要、角色列表和只读能力详情，桌面为列表/详情双栏，390px 顺序堆叠。图片只决定信息层级和视觉；角色、能力和范围来自总纲与服务端。

范围冻结为八类内置角色、版本化能力代码、成员/平台角色分配和本人/团队/工作区/组织/平台范围。自定义角色、成员邀请与角色分配写入口由后续组织管理模块承接；M01-05 的指定资源临时授权、30 天到期和原因不在本模块提前实现。前端不可提交 actor_id、membership_id 或授权决定，也不能通过隐藏菜单代替 Guard。

## 决策模型

`roles`、`capabilities`、`role_capabilities` 保存固定矩阵；`membership_role_assignments` 只允许组织角色，`platform_role_assignments` 只允许平台角色；`membership_data_scopes` 保存显式范围及适用的 workspace/team 目标。应用按以下顺序默认拒绝：平台能力+平台范围；否则活动组织成员；组织角色能力；最后匹配资源事实与范围。本人必须匹配 resource owner，团队必须匹配 team_id，工作区必须匹配 workspace_id，组织范围仅限当前 organization_id。平台范围不能由组织角色获得。

| 动作族 | 允许角色示例 | 适用范围 | 当前 API/页面 |
|---|---|---|---|
| `task:*`、`opportunity:*`、`trend:read`、`sourcing:read` | 普通成员、选品经理、采购成员、审计员按矩阵 | 本人/团队/工作区/组织；平台只读角色按能力 | 后续业务 API 复用 Guard；`/?view=authorization` 展示 |
| `membership:*`、`workspace:manage`、`team:manage`、`role:*` | 组织管理员；审计员仅 read | 组织 | `GET /api/v1/org/{organizationId}/roles` 当前要求 `role:read` |
| `provider:configure` | 组织管理员或平台运营管理员按能力 | 组织或平台 | 后续 Provider 配置 API |
| `collection:replay` | 平台运营管理员或后续显式来源负责人；组织管理员默认不具备 | 平台或显式来源职责范围 | 后续采集 API、Worker |
| `session:manage`、`platform_token:manage`、`key_rotation:manage` | 平台安全/超级管理员 | 平台 | 后续平台安全 API |
| `platform:operate`、`platform:secure`、`platform:superadmin` | 对应平台角色 | 平台 | 后续平台后台 |
| 本人有效授权摘要 | 任一活动成员 | 当前会话组织/工作区 | `GET /api/v1/me/authorization` |

角色目录只读接口先要求会话选择的 organization_id 与路径一致，再使用 `role:read` 和组织范围 Guard。本人授权摘要由服务端根据 session_id 查 `user_session_contexts`，不接受浏览器指定范围。

## 六类执行面与审计

`AuthorizationService.authorize` 的 surface 固定为 API、Worker、export、file、event、SSE；所有消费者传入相同 capability 和真实资源范围。当前业务 Worker/导出/SSE 尚未在 P01 创建，领域测试已锁定六类执行面的同一拒绝合同，后续模块必须调用而不能复制策略。

Guard 是同步安全前置条件，M01-04.A05 不创建授权队列、重试或死信；异步授权会产生已撤权任务继续执行的窗口。每个允许/拒绝结果同步写 `authorization_decisions`，包括 actor、请求范围、能力、执行面、原因、request_id、trace_id 和版本，不记录 Cookie 或 Token。

本模块没有新增环境变量，继续使用既有 MySQL、会话和 Web Origin 配置；`config/env.example` 无新增键。生产仍只重启宝塔 Node API 并发布 Web 静态资源，不创建面板外服务。

## A01–A17 证据

- A01–A05：本文、`packages/authorization/src/index.ts` 与 0011 迁移。
- A06–A11：OpenAPI/DTO、授权路由、MySQL Repository、角色页面、六执行面 Guard 与决策审计。
- A12–A16：策略/API/契约测试、MySQL 5.7 隔离探针、Playwright 桌面/390 快照及拒绝状态。
- A17：总纲、Feature Map、本架构、Runbook、模块登记与验收报告。
