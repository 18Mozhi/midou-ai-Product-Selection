# M01-03 组织、工作区与团队架构

## 范围与图片依据

本模块交付 organizations、workspaces、teams、memberships 和会话租户上下文。界面已读取 `images-html/README.txt`、`images-html/manifest.json`、`images-html/01_72_page_concepts/06_选择组织.jpg`、`07_选择工作区.jpg`、`58_工作区管理.jpg`、`59_团队管理.jpg` 以及 `images-html/02_high_resolution_core_pages/09_赛博风组织管理后台仪表盘.png`，采用深色后台层级、卡片式选择、清晰状态文案和桌面/390px 重排。图片只决定布局与视觉，不作为字段或权限事实。

组织创建由 `TenancyService.provisionOrganization` 作为内部事务能力提供。账号没有任何活动成员资格时，`POST /api/v1/me/personal-workspace` 只允许幂等创建固定名称的个人选品组织和默认工作区，同时写入创建者的组织管理员角色、组织数据范围与当前会话上下文；该入口不接受组织名称、成员或权限参数，不能用于创建任意组织或越权。团队在本模块仅为组织级实体和只读摘要，不猜测工作区归属或团队成员关系。

## 数据与同步真相

`0010a`–`0010g` 分步创建组织、工作区、团队、成员资格、会话上下文、租户审计及组织默认工作区外键。拆分默认工作区外键是为避免组织和默认工作区的循环建表依赖；创建事务先插入默认工作区为空的组织，再插入工作区、回填默认工作区、创建创建者成员资格、组织管理员角色和组织范围并写审计，任一步失败全部回滚。个人组织 slug 由不可变用户 UUID 派生，重复请求在唯一约束后重新读取现有成员资格，避免并发创建重复组织。

列表查询以当前 HttpOnly 会话解析出的 user_id 为唯一身份来源。组织列表先过滤活动成员资格；工作区和团队路由再次校验成员资格与组织状态。上下文选择还验证工作区属于该组织且未归档，并以 MySQL 5.7 `ON DUPLICATE KEY UPDATE` 保存单一会话上下文。外部请求不能提交 actor_id 或 session_id。

租户选择是进入后续授权路径的同步安全前置条件，必须在同一请求内形成数据库真相和审计，因此 M01-03.A05 的 Worker/Crawler/Outbox、租约、重试与死信不适用。引入异步传播会产生“页面显示已选择但授权仍使用旧范围”的窗口。

## 状态、审计与配置

页面覆盖加载、空组织、自助创建中、空工作区、接口错误、登录失效、无权、归档工作区、选择中和选择成功；错误保留 request_id 供排查。审计事件只保存范围、动作、资源、actor、request_id/trace_id 和时间，不保存 Cookie。

本模块没有新增环境变量，继续使用既有 API、MySQL、Web Origin 与会话配置，因此 `config/env.example` 无字段变化。所有生产运行仍限于宝塔管理的 Web 和 Node API；本模块不创建新生产服务，也不改 Worker/Crawler。

## A01–A17 证据

- A01–A05：本文、`packages/tenancy/src/index.ts`、`apps/api/src/mysql-tenancy-repository.ts` 与 `0010a`–`0010g`。
- A06–A11：共享 DTO、OpenAPI、租户路由、真实会话 Guard、前端状态、无新增配置证明及租户审计。
- A12–A16：领域/API/契约测试、MySQL 5.7 隔离探针和 Playwright 桌面/390 快照与故障状态。
- A17：总纲、Feature Map、本架构文档、Runbook、模块登记与验收报告。
