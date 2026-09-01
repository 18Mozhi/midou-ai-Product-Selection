# 《页面与路由清单》

路由顺序与 `apps/web/src/route-catalog.generated.json` 完全一致。`P`=公开/登录前，`M`=成员，`O`=组织后台，`A`=平台后台，`I`=内部，`F`=fallback。

|   # | 路由                                                | 页面             | 类别   | 页面组件/Surface              | 关键权限                        |
| --: | --------------------------------------------------- | ---------------- | ------ | ----------------------------- | ------------------------------- |
|   1 | `/`                                                 | 正在进入         | P      | `LandingRedirect`             | 无                              |
|   2 | `/login`                                            | 登录             | P      | `LocalIdentity`               | 无                              |
|   3 | `/register`                                         | 注册             | P      | `LocalIdentity`               | 无                              |
|   4 | `/forgot-password`                                  | 找回密码         | P      | `LocalIdentity`               | 无                              |
|   5 | `/verify-email`                                     | 验证邮箱         | P      | `LocalIdentity`               | 无                              |
|   6 | `/reset-password`                                   | 重置密码         | P      | `LocalIdentity`               | 无                              |
|   7 | `/security/mfa`                                     | 安全设置         | P      | `LocalIdentity`               | 会话/MFA 状态                   |
|   8 | `/select-context`                                   | 选择组织与工作区 | P      | `TenancyChooser`              | 有效会话/成员关系               |
|   9 | `/onboarding`                                       | 快速引导         | P      | `OnboardingGuide`             | 会话状态                        |
|  10 | `/settings/theme`                                   | 外观偏好         | P      | `ThemeStudio`                 | 登录后偏好写入                  |
|  11 | `/me`                                               | 个人中心         | P/账号 | `PersonalCenter`              | 当前用户                        |
|  12 | `/home`                                             | 今日行动         | M      | `HomeDashboard`               | `task:read`                     |
|  13 | `/work`                                             | 今日工作         | M      | `TaskWorkspace`               | `task:read`                     |
|  14 | `/trends`                                           | 热点趋势         | M      | `TrendDashboard`              | `trend:read`                    |
|  15 | `/opportunities`                                    | 选品机会         | M      | `OpportunityWorkspace`        | `opportunity:read`              |
|  16 | `/opportunities/start`                              | 创建选品         | M      | `SelectionJourney`            | `opportunity:decide`            |
|  17 | `/opportunities/scoring-rules`                      | 评分规则         | M      | `ScoreRuleConsole`            | `opportunity:read` + 写权限裁决 |
|  18 | `/opportunities/:opportunityId`                     | 机会详情         | M      | `OpportunityWorkspace`        | `opportunity:read`              |
|  19 | `/competitors`                                      | 竞品监控         | M      | `CompetitorMonitor`           | `competitor:read`               |
|  20 | `/competitors/monitoring-rules`                     | 竞品监控规则     | M      | `CompetitorMonitor`           | `competitor:read` + 写权限裁决  |
|  21 | `/sourcing`                                         | 供应链与利润     | M      | `SourcingWorkspace`           | `sourcing:read`                 |
|  22 | `/sourcing/cost-rules`                              | 费用与利润规则   | M      | `CostRuleConsole`             | 成本确认/管理权限               |
|  23 | `/tasks`                                            | 全部任务         | M      | `TaskWorkspace`               | `task:read`                     |
|  24 | `/tasks/:taskId`                                    | 任务详情         | M      | `TaskWorkspace`               | `task:read` + 资源范围          |
|  25 | `/tasks/approvals`                                  | 审批中心         | M      | `ApprovalWorkspace`           | `task:read` + 节点裁决          |
|  26 | `/notifications`                                    | 通知中心         | M      | `NotificationCenter`          | `notification:read`             |
|  27 | `/automations`                                      | 自动化规则       | M      | `AutomationRuleCenter`        | `team:manage`                   |
|  28 | `/reports`                                          | 报表与导出       | M      | `ReportCenter`                | `report:read`                   |
|  29 | `/org-admin`                                        | 治理概览         | O      | `OrganizationAdminCenter`     | `organization:manage`           |
|  30 | `/org-admin/members`                                | 成员与邀请       | O      | 同上                          | `membership:manage`             |
|  31 | `/org-admin/roles`                                  | 角色与权限       | O      | 同上                          | `role:read/manage`              |
|  32 | `/org-admin/workspaces`                             | 工作区管理       | O      | 同上                          | `workspace:manage`              |
|  33 | `/org-admin/teams`                                  | 团队管理         | O      | 同上                          | `team:manage`                   |
|  34 | `/org-admin/approvals`                              | 审批模板         | O      | 同上                          | 组织管理/审批权限               |
|  35 | `/org-admin/data`                                   | 组织数据         | O      | 同上                          | `report:read`                   |
|  36 | `/org-admin/tokens`                                 | 组织令牌         | O      | 同上                          | `organization_token:manage`     |
|  37 | `/org-admin/audit`                                  | 组织审计         | O      | 同上                          | `audit:read`                    |
|  38 | `/platform-admin`                                   | 平台概览         | A      | `PlatformDashboard`           | `platform:operate/secure`       |
|  39 | `/platform-admin/accounts`                          | 账号与组织       | A      | `PlatformAccountCenter`       | `platform:superadmin`           |
|  40 | `/platform-admin/organizations`                     | 组织管理         | A      | 同上                          | `platform:superadmin`           |
|  41 | `/platform-admin/organizations/new`                 | 创建组织         | A      | 同上                          | `platform:superadmin`           |
|  42 | `/platform-admin/organizations/:organizationId`     | 组织详情         | A      | 同上                          | `platform:superadmin`           |
|  43 | `/platform-admin/users`                             | 用户管理         | A      | 同上                          | `platform:superadmin`           |
|  44 | `/platform-admin/admins`                            | 管理员管理       | A      | 同上                          | `platform:superadmin`           |
|  45 | `/platform-admin/permissions`                       | 角色权限         | A      | 同上                          | `platform:superadmin`           |
|  46 | `/platform-admin/providers`                         | 来源设置         | A      | `ProviderRuntimeSurface`      | `platform:operate/superadmin`   |
|  47 | `/platform-admin/providers/adapters`                | 采集程序         | A      | 同上                          | 同上                            |
|  48 | `/platform-admin/providers/sources`                 | 热点来源         | A      | 同上                          | 同上                            |
|  49 | `/platform-admin/providers/sources/1688-acceptance` | 1688 验收        | A      | `Alibaba1688AcceptanceCenter` | 同上                            |
|  50 | `/platform-admin/credentials`                       | 凭证与档案       | A      | `CredentialAssetCenter`       | `platform:superadmin`           |
|  51 | `/platform-admin/collection`                        | 采集任务         | A      | `CollectionRuntimeSurface`    | `platform:operate`              |
|  52 | `/platform-admin/collection/overview`               | 采集总览         | A      | 同上                          | `platform:operate`              |
|  53 | `/platform-admin/collection/browser-runtime`        | 网页登录采集     | A      | 同上                          | `platform:operate`              |
|  54 | `/platform-admin/data`                              | 数据中心         | A      | `PlatformDataCenter`          | `platform:operate`              |
|  55 | `/platform-admin/governance`                        | 质量与规则       | A      | `PlatformGovernanceCenter`    | `platform:operate`              |
|  56 | `/platform-admin/content`                           | 内容管理         | A      | `PlatformManagementCenter`    | `platform:operate`              |
|  57 | `/platform-admin/notifications`                     | 通知管理         | A      | 同上                          | `platform:operate`              |
|  58 | `/platform-admin/commercial`                        | 配额管理         | A      | `CommercialOperationsCenter`  | `platform:operate/superadmin`   |
|  59 | `/platform-admin/security`                          | 安全中心         | A      | `SecurityOperationsCenter`    | `platform:secure/superadmin`    |
|  60 | `/platform-admin/open-platform`                     | 开放平台         | A      | `OpenPlatformCenter`          | `platform_token:manage`         |
|  61 | `/platform-admin/status`                            | 系统状态         | A      | `PlatformManagementCenter`    | `platform:operate`              |
|  62 | `/platform-admin/logs`                              | 链路日志         | A      | `PlatformLogCenter`           | `platform:operate`              |
|  63 | `/platform-admin/api-coverage`                      | 接口覆盖         | A      | `PlatformLogCenter`           | `platform:operate`              |
|  64 | `/platform-admin/operations`                        | 备份与恢复       | A      | `BackupRecoveryCenter`        | `platform:operate`              |
|  65 | `/platform-admin/releases`                          | 发布管理         | A      | `ReleaseRolloutCenter`        | `platform:operate`              |
|  66 | `/platform-admin/topology`                          | 服务拓扑         | A      | `RuntimeTopologyCenter`       | `platform:operate`              |
|  67 | `/platform-admin/redis`                             | Redis 运行       | A      | `RedisResilienceCenter`       | `platform:operate`              |
|  68 | `/platform-admin/mysql`                             | MySQL 运行       | A      | `MySqlResilienceCenter`       | `platform:operate`              |
|  69 | `/platform-admin/files`                             | 文件存储         | A      | `FileResilienceCenter`        | `platform:operate`              |
|  70 | `/platform-admin/crawler-scheduler`                 | 采集调度         | A      | `CrawlerSchedulerCenter`      | `platform:operate`              |
|  71 | `/platform-admin/capacity`                          | 容量边界         | A      | `CapacityBoundaryCenter`      | `platform:operate`              |
|  72 | `/ui-states`                                        | 界面状态         | I      | `UiStateShowcase`             | 内部验收页                      |
|  73 | `/:pathMatch(.*)*`                                  | 页面不存在       | F      | `NotFoundPage`                | 不依赖会话                      |

每条路由的 `breadcrumb`、`surface`、`cachePolicy`、`sessionRequired` 和完整 capabilities 以生成目录为准；本表不复制未知或未声明权限。
