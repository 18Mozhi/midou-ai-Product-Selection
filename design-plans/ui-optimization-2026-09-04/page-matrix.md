# ScoutOps 全页面 UI 优化矩阵

- 路由依据：`apps/web/src/route-catalog.generated.json`
- 设计方向：证据罗盘
- 覆盖：73 条真实路由；每条均有桌面与 390px 移动稿。

| # | 页面 | 路由 | 角色 | 推荐布局 | 首要焦点 | 设计图 |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | 正在进入 | `/` | 公开/账号 | 安全跳转页 | 正在进入的核心任务与下一步 | [桌面](screens/desktop/01-root.png) / [移动](screens/mobile/01-root.png) |
| 02 | 登录 | `/login` | 公开/账号 | 双区认证页 | 登录的核心任务与下一步 | [桌面](screens/desktop/02-login.png) / [移动](screens/mobile/02-login.png) |
| 03 | 注册 | `/register` | 公开/账号 | 双区认证页 | 注册的核心任务与下一步 | [桌面](screens/desktop/03-register.png) / [移动](screens/mobile/03-register.png) |
| 04 | 找回密码 | `/forgot-password` | 公开/账号 | 双区认证页 | 找回密码的核心任务与下一步 | [桌面](screens/desktop/04-forgot-password.png) / [移动](screens/mobile/04-forgot-password.png) |
| 05 | 验证邮箱 | `/verify-email` | 公开/账号 | 双区认证页 | 验证邮箱的核心任务与下一步 | [桌面](screens/desktop/05-verify-email.png) / [移动](screens/mobile/05-verify-email.png) |
| 06 | 重置密码 | `/reset-password` | 公开/账号 | 双区认证页 | 重置密码的核心任务与下一步 | [桌面](screens/desktop/06-reset-password.png) / [移动](screens/mobile/06-reset-password.png) |
| 07 | 安全设置 | `/security/mfa` | 公开/账号 | 双区认证页 | 安全设置的核心任务与下一步 | [桌面](screens/desktop/07-security__mfa.png) / [移动](screens/mobile/07-security__mfa.png) |
| 08 | 选择组织与工作区 | `/select-context` | 公开/账号 | 范围选择器 | 选择组织与工作区的核心任务与下一步 | [桌面](screens/desktop/08-select-context.png) / [移动](screens/mobile/08-select-context.png) |
| 09 | 快速引导 | `/onboarding` | 公开/账号 | 三步引导 | 快速引导的核心任务与下一步 | [桌面](screens/desktop/09-onboarding.png) / [移动](screens/mobile/09-onboarding.png) |
| 10 | 外观偏好 | `/settings/theme` | 公开/账号 | 分区设置页 | 外观偏好的核心任务与下一步 | [桌面](screens/desktop/10-settings__theme.png) / [移动](screens/mobile/10-settings__theme.png) |
| 11 | 个人中心 | `/me` | account | 分区设置页 | 个人中心的核心任务与下一步 | [桌面](screens/desktop/11-me.png) / [移动](screens/mobile/11-me.png) |
| 12 | 今日行动 | `/home` | member | 行动驾驶舱 | 今日行动的核心任务与下一步 | [桌面](screens/desktop/12-home.png) / [移动](screens/mobile/12-home.png) |
| 13 | 今日工作 | `/work` | member | 可批处理队列 | 今日工作的核心任务与下一步 | [桌面](screens/desktop/13-work.png) / [移动](screens/mobile/13-work.png) |
| 14 | 热点趋势 | `/trends` | member | 筛选 + 主从列表 | 热点趋势的核心任务与下一步 | [桌面](screens/desktop/14-trends.png) / [移动](screens/mobile/14-trends.png) |
| 15 | 选品机会 | `/opportunities` | member | 筛选 + 主从列表 | 选品机会的核心任务与下一步 | [桌面](screens/desktop/15-opportunities.png) / [移动](screens/mobile/15-opportunities.png) |
| 16 | 创建选品 | `/opportunities/start` | member | 分步表单 | 创建选品的核心任务与下一步 | [桌面](screens/desktop/16-opportunities__start.png) / [移动](screens/mobile/16-opportunities__start.png) |
| 17 | 评分规则 | `/opportunities/scoring-rules` | member | 规则列表 + 版本侧栏 | 评分规则的核心任务与下一步 | [桌面](screens/desktop/17-opportunities__scoring-rules.png) / [移动](screens/mobile/17-opportunities__scoring-rules.png) |
| 18 | 机会详情 | `/opportunities/:opportunityId` | member | 摘要 + 证据页签 | 机会详情的核心任务与下一步 | [桌面](screens/desktop/18-opportunities__opportunityId.png) / [移动](screens/mobile/18-opportunities__opportunityId.png) |
| 19 | 竞品监控 | `/competitors` | member | 变化监控台 | 竞品监控的核心任务与下一步 | [桌面](screens/desktop/19-competitors.png) / [移动](screens/mobile/19-competitors.png) |
| 20 | 竞品监控规则 | `/competitors/monitoring-rules` | member | 规则列表 + 版本侧栏 | 竞品监控规则的核心任务与下一步 | [桌面](screens/desktop/20-competitors__monitoring-rules.png) / [移动](screens/mobile/20-competitors__monitoring-rules.png) |
| 21 | 供应链与利润 | `/sourcing` | member | 筛选 + 主从列表 | 供应链与利润的核心任务与下一步 | [桌面](screens/desktop/21-sourcing.png) / [移动](screens/mobile/21-sourcing.png) |
| 22 | 费用与利润规则 | `/sourcing/cost-rules` | member | 规则列表 + 版本侧栏 | 费用与利润规则的核心任务与下一步 | [桌面](screens/desktop/22-sourcing__cost-rules.png) / [移动](screens/mobile/22-sourcing__cost-rules.png) |
| 23 | 全部任务 | `/tasks` | member | 可批处理队列 | 全部任务的核心任务与下一步 | [桌面](screens/desktop/23-tasks.png) / [移动](screens/mobile/23-tasks.png) |
| 24 | 任务详情 | `/tasks/:taskId` | member | 摘要 + 证据页签 | 任务详情的核心任务与下一步 | [桌面](screens/desktop/24-tasks__taskId.png) / [移动](screens/mobile/24-tasks__taskId.png) |
| 25 | 审批中心 | `/tasks/approvals` | member | 上下文审批台 | 审批中心的核心任务与下一步 | [桌面](screens/desktop/25-tasks__approvals.png) / [移动](screens/mobile/25-tasks__approvals.png) |
| 26 | 通知中心 | `/notifications` | member | 消息双栏 | 通知中心的核心任务与下一步 | [桌面](screens/desktop/26-notifications.png) / [移动](screens/mobile/26-notifications.png) |
| 27 | 自动化规则 | `/automations` | member | 规则列表 + 版本侧栏 | 自动化规则的核心任务与下一步 | [桌面](screens/desktop/27-automations.png) / [移动](screens/mobile/27-automations.png) |
| 28 | 报表与导出 | `/reports` | member | 报表工作台 | 报表与导出的核心任务与下一步 | [桌面](screens/desktop/28-reports.png) / [移动](screens/mobile/28-reports.png) |
| 29 | 治理概览 | `/org-admin` | organization_admin | 治理驾驶舱 | 治理概览的核心任务与下一步 | [桌面](screens/desktop/29-org-admin.png) / [移动](screens/mobile/29-org-admin.png) |
| 30 | 成员与邀请 | `/org-admin/members` | organization_admin | 紧凑管理表 | 成员与邀请的核心任务与下一步 | [桌面](screens/desktop/30-org-admin__members.png) / [移动](screens/mobile/30-org-admin__members.png) |
| 31 | 角色与权限 | `/org-admin/roles` | organization_admin | 紧凑管理表 | 角色与权限的核心任务与下一步 | [桌面](screens/desktop/31-org-admin__roles.png) / [移动](screens/mobile/31-org-admin__roles.png) |
| 32 | 工作区管理 | `/org-admin/workspaces` | organization_admin | 紧凑管理表 | 工作区管理的核心任务与下一步 | [桌面](screens/desktop/32-org-admin__workspaces.png) / [移动](screens/mobile/32-org-admin__workspaces.png) |
| 33 | 团队管理 | `/org-admin/teams` | organization_admin | 紧凑管理表 | 团队管理的核心任务与下一步 | [桌面](screens/desktop/33-org-admin__teams.png) / [移动](screens/mobile/33-org-admin__teams.png) |
| 34 | 审批模板 | `/org-admin/approvals` | organization_admin | 紧凑管理表 | 审批模板的核心任务与下一步 | [桌面](screens/desktop/34-org-admin__approvals.png) / [移动](screens/mobile/34-org-admin__approvals.png) |
| 35 | 组织数据 | `/org-admin/data` | organization_admin | 紧凑管理表 | 组织数据的核心任务与下一步 | [桌面](screens/desktop/35-org-admin__data.png) / [移动](screens/mobile/35-org-admin__data.png) |
| 36 | 组织令牌 | `/org-admin/tokens` | organization_admin | 紧凑管理表 | 组织令牌的核心任务与下一步 | [桌面](screens/desktop/36-org-admin__tokens.png) / [移动](screens/mobile/36-org-admin__tokens.png) |
| 37 | 组织审计 | `/org-admin/audit` | organization_admin | 信息工作台 | 组织审计的核心任务与下一步 | [桌面](screens/desktop/37-org-admin__audit.png) / [移动](screens/mobile/37-org-admin__audit.png) |
| 38 | 平台概览 | `/platform-admin` | platform_admin | 运行驾驶舱 | 平台概览的核心任务与下一步 | [桌面](screens/desktop/38-platform-admin.png) / [移动](screens/mobile/38-platform-admin.png) |
| 39 | 账号与组织 | `/platform-admin/accounts` | platform_admin | 紧凑管理表 | 账号与组织的核心任务与下一步 | [桌面](screens/desktop/39-platform-admin__accounts.png) / [移动](screens/mobile/39-platform-admin__accounts.png) |
| 40 | 组织管理 | `/platform-admin/organizations` | platform_admin | 紧凑管理表 | 组织管理的核心任务与下一步 | [桌面](screens/desktop/40-platform-admin__organizations.png) / [移动](screens/mobile/40-platform-admin__organizations.png) |
| 41 | 创建组织 | `/platform-admin/organizations/new` | platform_admin | 分步表单 | 创建组织的核心任务与下一步 | [桌面](screens/desktop/41-platform-admin__organizations__new.png) / [移动](screens/mobile/41-platform-admin__organizations__new.png) |
| 42 | 组织详情 | `/platform-admin/organizations/:organizationId` | platform_admin | 摘要 + 证据页签 | 组织详情的核心任务与下一步 | [桌面](screens/desktop/42-platform-admin__organizations__organizationId.png) / [移动](screens/mobile/42-platform-admin__organizations__organizationId.png) |
| 43 | 用户管理 | `/platform-admin/users` | platform_admin | 紧凑管理表 | 用户管理的核心任务与下一步 | [桌面](screens/desktop/43-platform-admin__users.png) / [移动](screens/mobile/43-platform-admin__users.png) |
| 44 | 管理员管理 | `/platform-admin/admins` | platform_admin | 紧凑管理表 | 管理员管理的核心任务与下一步 | [桌面](screens/desktop/44-platform-admin__admins.png) / [移动](screens/mobile/44-platform-admin__admins.png) |
| 45 | 角色权限 | `/platform-admin/permissions` | platform_admin | 能力矩阵 | 角色权限的核心任务与下一步 | [桌面](screens/desktop/45-platform-admin__permissions.png) / [移动](screens/mobile/45-platform-admin__permissions.png) |
| 46 | 来源设置 | `/platform-admin/providers` | platform_admin | 可观测运维表 | 来源设置的核心任务与下一步 | [桌面](screens/desktop/46-platform-admin__providers.png) / [移动](screens/mobile/46-platform-admin__providers.png) |
| 47 | 采集程序 | `/platform-admin/providers/adapters` | platform_admin | 可观测运维表 | 采集程序的核心任务与下一步 | [桌面](screens/desktop/47-platform-admin__providers__adapters.png) / [移动](screens/mobile/47-platform-admin__providers__adapters.png) |
| 48 | 热点来源 | `/platform-admin/providers/sources` | platform_admin | 可观测运维表 | 热点来源的核心任务与下一步 | [桌面](screens/desktop/48-platform-admin__providers__sources.png) / [移动](screens/mobile/48-platform-admin__providers__sources.png) |
| 49 | 1688 启用检查 | `/platform-admin/providers/sources/1688-acceptance` | platform_admin | 门禁清单 | 1688 启用检查的核心任务与下一步 | [桌面](screens/desktop/49-platform-admin__providers__sources__1688-acceptance.png) / [移动](screens/mobile/49-platform-admin__providers__sources__1688-acceptance.png) |
| 50 | 凭证与档案 | `/platform-admin/credentials` | platform_admin | 可观测运维表 | 凭证与档案的核心任务与下一步 | [桌面](screens/desktop/50-platform-admin__credentials.png) / [移动](screens/mobile/50-platform-admin__credentials.png) |
| 51 | 采集任务 | `/platform-admin/collection` | platform_admin | 可观测运维表 | 采集任务的核心任务与下一步 | [桌面](screens/desktop/51-platform-admin__collection.png) / [移动](screens/mobile/51-platform-admin__collection.png) |
| 52 | 采集总览 | `/platform-admin/collection/overview` | platform_admin | 运行驾驶舱 | 采集总览的核心任务与下一步 | [桌面](screens/desktop/52-platform-admin__collection__overview.png) / [移动](screens/mobile/52-platform-admin__collection__overview.png) |
| 53 | 网页登录采集 | `/platform-admin/collection/browser-runtime` | platform_admin | 可观测运维表 | 网页登录采集的核心任务与下一步 | [桌面](screens/desktop/53-platform-admin__collection__browser-runtime.png) / [移动](screens/mobile/53-platform-admin__collection__browser-runtime.png) |
| 54 | 数据中心 | `/platform-admin/data` | platform_admin | 可观测运维表 | 数据中心的核心任务与下一步 | [桌面](screens/desktop/54-platform-admin__data.png) / [移动](screens/mobile/54-platform-admin__data.png) |
| 55 | 质量与规则 | `/platform-admin/governance` | platform_admin | 可观测运维表 | 质量与规则的核心任务与下一步 | [桌面](screens/desktop/55-platform-admin__governance.png) / [移动](screens/mobile/55-platform-admin__governance.png) |
| 56 | 内容管理 | `/platform-admin/content` | platform_admin | 内容审核台 | 内容管理的核心任务与下一步 | [桌面](screens/desktop/56-platform-admin__content.png) / [移动](screens/mobile/56-platform-admin__content.png) |
| 57 | 通知管理 | `/platform-admin/notifications` | platform_admin | 消息双栏 | 通知管理的核心任务与下一步 | [桌面](screens/desktop/57-platform-admin__notifications.png) / [移动](screens/mobile/57-platform-admin__notifications.png) |
| 58 | 配额管理 | `/platform-admin/commercial` | platform_admin | 可观测运维表 | 配额管理的核心任务与下一步 | [桌面](screens/desktop/58-platform-admin__commercial.png) / [移动](screens/mobile/58-platform-admin__commercial.png) |
| 59 | 安全中心 | `/platform-admin/security` | platform_admin | 可观测运维表 | 安全中心的核心任务与下一步 | [桌面](screens/desktop/59-platform-admin__security.png) / [移动](screens/mobile/59-platform-admin__security.png) |
| 60 | 开放平台 | `/platform-admin/open-platform` | platform_admin | 可观测运维表 | 开放平台的核心任务与下一步 | [桌面](screens/desktop/60-platform-admin__open-platform.png) / [移动](screens/mobile/60-platform-admin__open-platform.png) |
| 61 | 系统状态 | `/platform-admin/status` | platform_admin | 运行驾驶舱 | 系统状态的核心任务与下一步 | [桌面](screens/desktop/61-platform-admin__status.png) / [移动](screens/mobile/61-platform-admin__status.png) |
| 62 | 链路日志 | `/platform-admin/logs` | platform_admin | 信息工作台 | 链路日志的核心任务与下一步 | [桌面](screens/desktop/62-platform-admin__logs.png) / [移动](screens/mobile/62-platform-admin__logs.png) |
| 63 | 接口覆盖证据 | `/platform-admin/api-coverage` | platform_admin | 能力矩阵 | 接口覆盖证据的核心任务与下一步 | [桌面](screens/desktop/63-platform-admin__api-coverage.png) / [移动](screens/mobile/63-platform-admin__api-coverage.png) |
| 64 | 备份与恢复 | `/platform-admin/operations` | platform_admin | 门禁清单 | 备份与恢复的核心任务与下一步 | [桌面](screens/desktop/64-platform-admin__operations.png) / [移动](screens/mobile/64-platform-admin__operations.png) |
| 65 | 发布管理 | `/platform-admin/releases` | platform_admin | 阶段发布轨 | 发布管理的核心任务与下一步 | [桌面](screens/desktop/65-platform-admin__releases.png) / [移动](screens/mobile/65-platform-admin__releases.png) |
| 66 | 服务拓扑 | `/platform-admin/topology` | platform_admin | 依赖拓扑 | 服务拓扑的核心任务与下一步 | [桌面](screens/desktop/66-platform-admin__topology.png) / [移动](screens/mobile/66-platform-admin__topology.png) |
| 67 | Redis 运行 | `/platform-admin/redis` | platform_admin | 运行驾驶舱 | Redis 运行的核心任务与下一步 | [桌面](screens/desktop/67-platform-admin__redis.png) / [移动](screens/mobile/67-platform-admin__redis.png) |
| 68 | MySQL 运行 | `/platform-admin/mysql` | platform_admin | 运行驾驶舱 | MySQL 运行的核心任务与下一步 | [桌面](screens/desktop/68-platform-admin__mysql.png) / [移动](screens/mobile/68-platform-admin__mysql.png) |
| 69 | 文件存储 | `/platform-admin/files` | platform_admin | 运行驾驶舱 | 文件存储的核心任务与下一步 | [桌面](screens/desktop/69-platform-admin__files.png) / [移动](screens/mobile/69-platform-admin__files.png) |
| 70 | 采集调度 | `/platform-admin/crawler-scheduler` | platform_admin | 运行驾驶舱 | 采集调度的核心任务与下一步 | [桌面](screens/desktop/70-platform-admin__crawler-scheduler.png) / [移动](screens/mobile/70-platform-admin__crawler-scheduler.png) |
| 71 | 容量边界 | `/platform-admin/capacity` | platform_admin | 运行驾驶舱 | 容量边界的核心任务与下一步 | [桌面](screens/desktop/71-platform-admin__capacity.png) / [移动](screens/mobile/71-platform-admin__capacity.png) |
| 72 | 界面状态 | `/ui-states` | 公开/账号 | 状态组件库 | 界面状态的核心任务与下一步 | [桌面](screens/desktop/72-ui-states.png) / [移动](screens/mobile/72-ui-states.png) |
| 73 | 页面不存在 | `/:pathMatch(.*)*` | 公开/账号 | 恢复型错误页 | 页面不存在的核心任务与下一步 | [桌面](screens/desktop/73-pathMatch-.png) / [移动](screens/mobile/73-pathMatch-.png) |
