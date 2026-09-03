# 《系统资产清单》

## 1. 规模快照

| 资产                |              数量 | 真相源                                      | 结论                                                                                                                  |
| ------------------- | ----------------: | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 前端路由            |                73 | `apps/web/src/route-catalog.generated.json` | 已枚举，含 11 个公开/账号路由、1 个公开根路由、60 个受保护路由、1 个内部页、1 个 fallback；分类有交叠时以目录字段为准 |
| OpenAPI 路径        |               223 | `docs/openapi.yaml`                         | 已枚举                                                                                                                |
| OpenAPI 操作        |               257 | `docs/openapi.yaml`                         | 已枚举；真实异常注入并未覆盖全部 257 项                                                                               |
| 数据迁移            | 125 up + 125 down | `database/migrations/`                      | MySQL 5.7 合同齐全                                                                                                    |
| 建表语句            |               221 | `database/migrations/*.up.sql`              | 以物理表/投影/审计/幂等表为主                                                                                         |
| Worker 队列         |                18 | `apps/worker/src/worker-queue-registry.ts`  | 已注册超时、重试、熔断、老化和最大并发                                                                                |
| Worker 源文件       |                34 | `apps/worker/src/*.ts`                      | 已枚举                                                                                                                |
| Python 爬虫运行文件 |                11 | `apps/crawler/scoutops_crawler/*.py`        | 已枚举                                                                                                                |
| 运行服务            |                 5 | `docs/feature-map.json.runtime`             | Vue 站点、Node 后端/Worker、Python 爬虫、MySQL、Redis                                                                 |
| 配置键              |               290 | `config/env.example`                        | 已枚举；真实秘密不进入文档或 Git                                                                                      |

## 2. 前端页面与组件族

| 页面族     | 主要组件                                                                                                                                                                                                | 路由范围                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 认证与引导 | `LandingRedirect`、`LocalIdentity`、`TenancyChooser`、`OnboardingGuide`                                                                                                                                 | `/`、`/login` 至 `/onboarding`                             |
| 个人与主题 | `ThemeStudio`、`AccountShell`、`PersonalCenter`                                                                                                                                                         | `/settings/theme`、`/me`                                   |
| 成员业务   | `HomeDashboard`、`TrendDashboard`、`OpportunityWorkspace`、`CompetitorMonitor`、`SourcingWorkspace`、`TaskWorkspace`、`ApprovalWorkspace`、`NotificationCenter`、`AutomationRuleCenter`、`ReportCenter` | `/home` 至 `/reports`                                      |
| 组织治理   | `OrganizationAdminCenter` 及成员/角色/工作区/团队/令牌子面板                                                                                                                                            | `/org-admin/**`                                            |
| 平台治理   | `PlatformDashboard`、`PlatformAccountCenter`、`ProviderRuntimeSurface`、`CollectionRuntimeSurface`、`PlatformDataCenter`、`PlatformGovernanceCenter`、`SecurityOperationsCenter` 等                     | `/platform-admin/**`                                       |
| 运维韧性   | `BackupRecoveryCenter`、`ReleaseRolloutCenter`、`RuntimeTopologyCenter`、`RedisResilienceCenter`、`MySqlResilienceCenter`、`FileResilienceCenter`、`CrawlerSchedulerCenter`、`CapacityBoundaryCenter`   | `/platform-admin/operations` 至 `/platform-admin/capacity` |
| 内部与异常 | `UiStateShowcase`、`NotFoundPage`                                                                                                                                                                       | `/ui-states`、fallback                                     |

弹窗、抽屉、隐藏入口由各页面组件和 `DiscoveryOverlay` 承载；开发态 `?view=` 内部视图只在 `import.meta.env.DEV` 下开放，不属于生产入口。

## 3. 角色与权限

组织角色：`member`、`selection_manager`、`procurement_member`、`organization_admin`、`auditor`。平台角色：`platform_operations_admin`、`platform_security_admin`、`platform_super_admin`。权限真相源为 `0011h_seed_roles`、`0011i_seed_capabilities`、`0011j_seed_role_capabilities`，详见交付物 7。

## 4. 队列、Worker 与定时执行

| 队列                                                                 | 处理器/用途                              |
| -------------------------------------------------------------------- | ---------------------------------------- |
| `collection_tasks`                                                   | 采集任务领取、执行、证据和死信           |
| `auth_delivery`                                                      | 认证邮件投递箱；真实邮件 Provider 未选择 |
| `business_task_projection`                                           | 业务任务投影                             |
| `approval_escalation`                                                | 审批超时升级                             |
| `notification_outbox`                                                | 站内通知投递                             |
| `webhook_deliveries`                                                 | Webhook 签名投递与重试                   |
| `opportunity_refresh` / `opportunity_scoring` / `opportunity_profit` | 机会刷新、评分、利润计算                 |
| `competitor_monitor`                                                 | 竞品定时监控与告警                       |
| `sourcing_projection`                                                | 供应链投影                               |
| `trend_projection`                                                   | 趋势投影与告警                           |
| `ai_analysis`                                                        | 后端 AI 摘要/解释                        |
| `report_exports`                                                     | 异步报表导出                             |
| `automation_rules`                                                   | 自动化规则执行                           |
| `core_collection_projection`                                         | 采集结果清洗、标准化和核心业务投影       |
| `automatic_rule_sources` / `automatic_full_sources`                  | 规则来源和全量来源调度                   |

队列都通过单一注册表配置 `maxConcurrency`、`timeoutMs`、`maxRetries`、熔断阈值、冷却、老化和 stuck 判定。生产定时由宝塔可见的 Node/Python 项目承载，不允许系统级隐藏服务。

## 5. 爬虫与来源

- Node Playwright 适配层：`packages/playwright-crawler/`、`packages/provider-adapters/`、`apps/worker/src/provider-source-executor.ts`。
- Python 生命周期：`lease_client.py` → `main_loop.py` → `execution_runner.py`/`playwright_bridge.py` → `completion_receipts.py`。
- 已有来源注册、适配器健康、凭证档案、采集任务、证据、解析样本、回放、数据质量和调度页面。
- Amazon、1688 等真实登录、验证码、风控和页面结构生命周期仍受真实第三方环境阻塞，不能写成全通过。

## 6. 上传、下载、导入、导出

| 能力               | 入口/接口                                                      | 状态                                         |
| ------------------ | -------------------------------------------------------------- | -------------------------------------------- |
| ERP 商品导入       | `/imports/erp-products`、`docs/runbooks/erp-product-import.md` | 合同与本地测试通过；真实大文件容量需生产压测 |
| 证据下载           | `/platform/data/evidence/{id}/download-grant` 与 `/download`   | 短期授权合同存在                             |
| 报表导出/下载      | `/report-exports/**`、`ReportCenter`                           | Worker 链路与页面测试通过                    |
| 平台数据/日志导出  | `/platform/management/data/exports`、`logs/exports`            | 受权限与审计保护                             |
| 文件存储与恢复材料 | `/platform-admin/files`、运行目录 `runtime/`                   | 单机边界；无异地灾备                         |

## 7. 通知与第三方

- 已实现：站内通知、SSE、Webhook、投递审计、自动化/竞品/审批事件。
- 阻塞：真实邮件服务商未选择；不得宣称邮件发送、退信、投诉、抑制回调通过。
- AI：只允许后端访问 OpenAI-compatible endpoint；模型服务健康可能随外部状态变化。
- GitHub：仅源码托管，不是生产运行依赖。

## 8. 数据主要关系

核心链：`users` → `memberships` → `organizations`/`workspaces`/`teams` → `membership_role_assignments`/`membership_data_scopes`；业务链：趋势 → 机会 → 评分/利润/竞品/供应商 → 任务/审批/通知/报表；采集链：来源/凭证 → 采集任务/尝试/事件 → 证据/质量问题 → 核心投影；所有写链路通过幂等记录、版本号、审计事件或 outbox 形成可追踪关系。
