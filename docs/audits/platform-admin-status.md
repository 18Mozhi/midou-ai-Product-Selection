# `/platform-admin/status` 逐页 UI、功能与链路审计

## 页面审计记录

1. 页面名称和路由：系统状态，`/platform-admin/status`；平台后台 / 系统运维 / 系统状态。
2. 服务角色：具备 `platform:operate` 或 `platform:superadmin` 的平台运营管理员、平台超级管理员。平台安全管理员真实浏览器进入访问保护态，API 实测 403；未登录 API 实测 401。
3. 业务目标：用持久化事实回答 API、MySQL、Redis、文件、Node Worker、Python Crawler 是否有新鲜观测，说明异常持续时需要核查的直接和后续影响面，并提供精确运维下钻。
4. 当前截图：修复前桌面 [desktop-1440.png](../../output/playwright/platform-admin-status/before/desktop-1440.png)、修复前 390px [mobile-390.png](../../output/playwright/platform-admin-status/before/mobile-390.png)、修复前真实数据库故障 [database-failure.png](../../output/playwright/platform-admin-status/before/database-failure.png)；修复后桌面 [desktop-1440.png](../../output/playwright/platform-admin-status/after/desktop-1440.png)、修复后 390px [mobile-390.png](../../output/playwright/platform-admin-status/after/mobile-390.png)、故障保留 [database-failure-preserved.png](../../output/playwright/platform-admin-status/after/database-failure-preserved.png)、空状态 [empty-state.png](../../output/playwright/platform-admin-status/after/empty-state.png)。
5. 可操作入口：刷新数据、查看实时拓扑、API 节点、MySQL 节点、Redis 节点、文件节点、Worker 节点、Crawler 节点、各异常传播“进入处理”、查看任务详情、管理来源配置、技术详情、面包屑、系统运维二级导航和平台导航。
6. 控件结果：每个入口的结果单独记录在“前端功能结果”，没有使用“其他按钮正常”等合并结论。
7. 接口：`GET /api/v1/platform/management?domain=status`。真实结果为运营管理员 200、安全管理员 403、匿名 401、非法 domain 400、MySQL 停机 503；12 并发读取均为 200。
8. 数据表：`platform_dashboard_views`、`collection_tasks`、`providers`、`organizations`、`users`、`runtime_nodes`、`redis_resilience_observations`、`mysql_resilience_observations`、`file_resilience_observations`、`crawler_scheduler_observations`；权限核对另涉及 `user_sessions`、`platform_role_assignments`、`role_capabilities`、`authorization_decisions`。
9. 权限与数据隔离：该页是平台全局运行事实，不按组织过滤；API 强制 `platform:operate`。响应不含密码、Cookie、Token、密钥、原始凭据、业务 payload 或完整隐私数据。
10. 正常状态：隔离 MySQL 5.7、Redis、API、Worker、Crawler 和前端均真实运行。页面返回六个固定服务节点、1 个活动组织、2 个活动用户、5 个任务和 4 个来源。
11. 空数据状态：隔离库真实删除全部任务和来源后，GET 仍返回六类运行观测；页面分别显示“当前没有采集任务状态记录”和“当前没有来源配置记录”，下钻入口保留。
12. 加载状态：首次加载无快照时显示读取态；已有快照刷新时六类拓扑保持可见，按钮显示“刷新中…”、禁用并设置 `aria-busy=true`。
13. 接口失败状态：真实停止 MySQL 后 GET 安全重试三次并返回 503；修复前成功快照被清空，修复后保留快照并显示恢复提示。
14. 超时状态：真实响应延迟注入超过 15 秒后，`AbortController` 中止请求，六类拓扑继续显示，提示“已停止本次请求并保留上次成功数据”。
15. 无权限状态：平台安全管理员真实浏览器显示“无权打开此页面”；API 为 403 `permission_denied`。匿名 API 为 401 `session_invalid`。
16. 表单校验状态：本页没有输入表单，不适用；不会把不存在的表单标记为通过。
17. 重复提交状态：本页没有写操作；读取使用单请求控制器，刷新期间按钮禁用，第二次刷新不创建新读取。
18. 刷新和返回状态：正常刷新 200；从 7 个真实下钻页返回后重新显示状态页；浏览器刷新恢复六节点、统计与观测时间。
19. 不同分辨率：1920×1080、1440×900、1280×800、390×844 的 `scrollWidth` 分别等于视口宽度，没有页面级横向溢出。
20. UI 和交互问题：修复前刷新清空事实、失败整页替换、英文任务枚举直出、零任务/零来源无说明；本批均已处理。移动端固定快捷导航属于共享壳层，本批没有越权修改。
21. 功能问题：修复前状态读取没有超时、取消、序列或单请求保护；真实慢响应和数据库 503 可复现。修复后已有事实不会被读取生命周期清空。
22. 性能问题：单次正常读取约 142ms，重复读取约 138ms；12 并发在本地小数据集最大约 699ms。没有百万级观测和任务数据，容量结论标记未验证。
23. 安全问题：未发现响应秘密泄漏；安全字段扫描 password/token/cookie/secret 均为 false。测试密码在一次 CLI 回显后已立即轮换，后续敏感输入输出均被丢弃。
24. 企业级缺失：缺少状态读取专属审计事件、Worker 与 Crawler 独立健康结论、全站 SSE 聚合、正式容量基线和外部告警渠道；当前页面必须继续诚实展示持久化观测，不能据此宣称高可用。
25. 优化建议：见“逐页面优化升级方案”。必须保留六服务拓扑、5 分钟陈旧规则、持久化事实、故障传播的待核查措辞、标签页 SSE 边界、专属深链和既有权限语义。

## 页面—功能—接口—数据库—权限—后台任务矩阵

| 页面功能     | 接口                  | 数据库                                                                      | 权限                            | 后台任务/依赖                     | 实际结果与证据                                    |
| ------------ | --------------------- | --------------------------------------------------------------------------- | ------------------------------- | --------------------------------- | ------------------------------------------------- |
| 页面摘要     | GET management status | `platform_dashboard_views`、`organizations`、`users`                        | `platform:operate`              | Node API、MySQL                   | 200；1 个组织、2 个用户、15 分钟访问 1            |
| 六服务拓扑   | 同上                  | `runtime_nodes`、四类 resilience/scheduler observation                      | 同上                            | API、Worker、Crawler、Redis、文件 | 六节点完整；超过 5 分钟显示“已过期”               |
| 故障传播     | 同上                  | 同上                                                                        | 同上                            | 无写任务                          | 只列非 healthy/ready 节点，不把关联服务判为已故障 |
| 采集任务状态 | 同上                  | `collection_tasks`                                                          | 同上                            | Worker 读取任务队列               | 5 条真实测试任务；中文状态 2/1/1/1                |
| 来源状态     | 同上                  | `providers`                                                                 | 同上                            | Worker 注册 Amazon、1688 等适配器 | 4 个来源；启用 2、停用 1、草稿 1                  |
| 刷新         | 同上                  | 上述只读表                                                                  | 同上                            | API 安全读取重试                  | 单请求、15 秒中止、失败保留成功快照               |
| 实时连接退化 | 无平台 API            | 浏览器 `sessionStorage`，不写 MySQL                                         | 当前标签页                      | EventSource 客户端                | 0.00%、0 次；明确不代表全站                       |
| 权限拒绝     | 同上                  | `platform_role_assignments`、`role_capabilities`、`authorization_decisions` | 安全管理员无 `platform:operate` | 无                                | 浏览器访问保护；API 403                           |

## 前端功能结果

| 编号          | 功能/入口    | 操作                             | 实际结果                                      | 结论 |
| ------------- | ------------ | -------------------------------- | --------------------------------------------- | ---- |
| STATUS-FE-001 | 页面访问     | 运营管理员打开路由               | 标题、面包屑、六节点和真实统计出现            | 通过 |
| STATUS-FE-002 | 刷新按钮     | 鼠标点击                         | 单次 GET 200，观测时间更新                    | 通过 |
| STATUS-FE-003 | 键盘刷新     | 聚焦按钮并按 Enter               | GET 200，焦点操作有效                         | 通过 |
| STATUS-FE-004 | 重复刷新     | 慢请求期间再次触发               | 按钮禁用，控制器拒绝第二次读取                | 通过 |
| STATUS-FE-005 | 首次加载     | 无快照进入页面                   | 显示读取管理数据                              | 通过 |
| STATUS-FE-006 | 后台刷新     | 5 秒真实请求延迟                 | 拓扑可见、无整页 loading、按钮“刷新中…”       | 通过 |
| STATUS-FE-007 | 数据库失败   | 停止隔离 MySQL 后刷新            | 503 提示，旧快照可见                          | 通过 |
| STATUS-FE-008 | 超时         | 将真实请求延迟到 30 秒           | 15 秒中止，旧快照可见                         | 通过 |
| STATUS-FE-009 | 任务空状态   | 实际删除测试任务                 | 显示明确空状态和任务入口                      | 通过 |
| STATUS-FE-010 | 来源空状态   | 实际删除测试来源                 | 显示明确空状态和来源入口                      | 通过 |
| STATUS-FE-011 | 陈旧观测     | 使用 5 分钟外观测                | 节点显示“已过期”                              | 通过 |
| STATUS-FE-012 | 状态文案     | 读取 blocked/running/failed 数据 | 显示阻断/运行中/最终失败等中文                | 通过 |
| STATUS-FE-013 | 查看实时拓扑 | 点击链接                         | 到 `/platform-admin/topology`，无权限门或 404 | 通过 |
| STATUS-FE-014 | MySQL 节点   | 点击链接                         | 到 `/platform-admin/mysql`                    | 通过 |
| STATUS-FE-015 | Redis 节点   | 点击链接                         | 到 `/platform-admin/redis`                    | 通过 |
| STATUS-FE-016 | 文件节点     | 点击链接                         | 到 `/platform-admin/files`                    | 通过 |
| STATUS-FE-017 | Worker 节点  | 点击链接                         | 到 `/platform-admin/crawler-scheduler`        | 通过 |
| STATUS-FE-018 | Crawler 节点 | 点击链接                         | 到 `/platform-admin/crawler-scheduler`        | 通过 |
| STATUS-FE-019 | 查看任务详情 | 点击链接                         | 到 `/platform-admin/collection/overview`      | 通过 |
| STATUS-FE-020 | 管理来源配置 | 点击链接                         | 到 `/platform-admin/providers/sources`        | 通过 |
| STATUS-FE-021 | 技术详情     | 展开页尾 details                 | 关联编号出现，默认折叠                        | 通过 |
| STATUS-FE-022 | 浏览器返回   | 从每个下钻页返回                 | 回到状态页并重新显示事实                      | 通过 |
| STATUS-FE-023 | 页面刷新     | 浏览器 reload                    | 六节点和统计恢复                              | 通过 |
| STATUS-FE-024 | 多标签页     | 新标签打开同一路由               | 独立加载 6 节点，标题正确                     | 通过 |
| STATUS-FE-025 | 1920px       | 检查宽度                         | 无横向溢出                                    | 通过 |
| STATUS-FE-026 | 1440px       | 检查宽度                         | 无横向溢出                                    | 通过 |
| STATUS-FE-027 | 1280px       | 检查宽度                         | 无横向溢出                                    | 通过 |
| STATUS-FE-028 | 390px        | 检查宽度和卡片                   | 无横向溢出，拓扑单列可读                      | 通过 |
| STATUS-FE-029 | 控制台       | 清理故障注入消息后重新加载       | 0 error、0 warning                            | 通过 |
| STATUS-FE-030 | 安全管理员   | 登录后直达路由                   | 显示无权页面，不装载状态事实                  | 通过 |
| STATUS-FE-031 | 匿名访问     | 不带会话请求 API                 | 401                                           | 通过 |

搜索、筛选、排序、分页、全选、批量操作、新增、编辑、复制、删除、弹窗、抽屉、表单、上传、下载、导入和导出不是本状态聚合页的既有能力，均标记“不适用”，没有用缺失控件模拟通过。系统运维二级导航属于共享壳层，已验证本页当前项与 7 个业务下钻入口；其他运维页功能由各自批次验收。

## 接口结果

### `GET /api/v1/platform/management?domain=status`

| 场景               | 实际结果                                                  | 结论                         |
| ------------------ | --------------------------------------------------------- | ---------------------------- |
| 运营管理员正常请求 | 200，六服务、任务、来源、摘要和 `observed_at`             | 通过                         |
| 重复请求           | 200，约 138ms                                             | 通过                         |
| 12 并发请求        | 12 个 200，最大约 699ms                                   | 通过（仅小数据）             |
| 未登录             | 401 `session_invalid`                                     | 通过                         |
| 无权限             | 403 `permission_denied`                                   | 通过                         |
| 非法 domain        | 400 `platform_management_domain_invalid`                  | 通过                         |
| MySQL 不可用       | 503 `platform_data_dependency_unavailable`                | 通过                         |
| 缓存控制           | `private, no-store`                                       | 通过                         |
| 请求关联           | 响应 request_id 与请求一致                                | 通过                         |
| 返回结构           | `domain/summary/services/collections/sources/observed_at` | 通过                         |
| 秘密扫描           | password/token/cookie/secret 均未出现                     | 通过                         |
| 跨租户访问         | 平台全局接口，不接受 tenant 参数；安全角色 403            | 不适用为租户读，权限边界通过 |
| 数据库异常注入     | 真实停库 503，恢复后 ready 200                            | 通过                         |
| 第三方依赖失败     | 本接口不调用第三方                                        | 不适用                       |
| 幂等性             | GET 只读，可安全重复；无写副作用                          | 通过                         |
| 专属读取审计       | 只有授权决策，没有 status-read 专属平台审计               | 企业缺口                     |

## Worker、Crawler 与联合链路证据

- Worker 真实进程 `page48-worker` 启动，注册 `amazon_product`、`1688_search`、Made-in-China、DHgate、EC21、公开 RSS/Google News 等来源和 18 个队列；正常阶段轮询失败数为 0。
- Python Crawler 真实进程 `page48-crawler` 启动，每 5 秒调用内部 acquire；空队列真实返回 204。
- 联合链路：运营管理员登录 → 路由权限通过 → Web GET → Node API 鉴权 → MySQL 并行读取 9 类事实 → 页面呈现六节点/任务/来源 → Worker/Crawler 保持运行 → 下钻到拓扑、调度、任务和来源页 → `authorization_decisions` 保留授权决定。
- 本页不创建采集任务，也不执行第三方登录、验证码、代理、解析和入库，因此不能把 Crawler 空轮询宣称为完整采集生命周期通过；完整生命周期由采集专项批次承担。

## 问题记录

| 编号          | 类型/等级     | 问题与证据                                                  | 影响                             | 修复/建议与验收标准                                               | 状态       |
| ------------- | ------------- | ----------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------- | ---------- |
| STATUS-P2-001 | 刷新可靠性/P2 | 修复前已有快照刷新立即隐藏拓扑；真实 MySQL 503 后只剩错误页 | 运维人员在故障时失去最后可信事实 | 保留快照、后台刷新、失败提示；故障截图中拓扑仍可见                | 已修复     |
| STATUS-P2-002 | 超时与竞争/P2 | 修复前无 AbortController、超时、序列或单请求保护            | 慢请求可无限占用并产生旧响应覆盖 | 15 秒中止、单请求、卸载取消；真实延迟验收                         | 已修复     |
| STATUS-P3-003 | 数据可读性/P3 | `blocked_captcha`、`failed_terminal`、`running` 英文直出    | 非技术管理员难以理解             | 全状态中文映射；页面无原始枚举                                    | 已修复     |
| STATUS-P3-004 | 空状态/P3     | 零任务/零来源时只剩标题和链接                               | 容易误判页面未加载               | 明确两类空状态并保留下钻                                          | 已修复     |
| STATUS-P4-005 | 审计/P4       | GET 产生授权决定，但没有 `platform.status.read` 专属审计    | 难以独立统计状态页读取           | 后续评估低噪声聚合审计；验收需关联 actor/request/trace 且不放秘密 | 待后续     |
| STATUS-P4-006 | 观测模型/P4   | Worker 和 Crawler 共用最新 scheduler state                  | 无法表达单边进程存活、单边阻断   | 后续扩展独立观测字段/表前需先锁定 API 与迁移合同                  | 待后续     |
| STATUS-P4-007 | 容量/P4       | 小数据 12 并发最大约 699ms，无大数据基线                    | 无法宣称企业容量                 | 用批准的任务/来源/观测规模做 p95/p99 与连接池测试                 | 未验证     |
| STATUS-P4-008 | 全站实时性/P4 | SSE 指标只在当前标签页                                      | 无法作为平台级实时健康指标       | 保持当前诚实边界；如需全站指标须另建受控聚合与隐私方案            | 待产品决策 |

每个问题涉及页面 `/platform-admin/status`；主要文件为 `PlatformManagementCenter.vue`、`use-platform-status.ts`、`platform-management-presentation.ts`，接口为 GET management status，数据表和影响范围见矩阵。证据为上述真实截图、API 结果、数据库查询与服务日志。P2 验收标准均已由真实浏览器和真实 MySQL 故障注入满足。

## 逐页面优化升级方案

- 页面定位：平台运行事实总览，不是配置中心或自动故障判定器。
- 使用者：平台运营管理员和超级管理员；安全管理员保持拒绝。
- 核心任务：先识别过期、警告、阻断节点，再进入对应专属运维页。
- 当前问题：本批已解决刷新事实丢失、无超时、英文枚举和空状态；独立审计、独立 Worker/Crawler 健康与容量仍是缺口。
- 应保留的功能：五项摘要、六服务拓扑、5 分钟陈旧规则、传播待核查措辞、SSE 标签页统计、任务/来源统计、技术详情和全部深链。
- 应删除或合并：不删除既有能力；不得把 Worker/Crawler 合并成“后台正常”，也不得把 warning/blocked 合并成一个无依据红点。
- 信息架构：顶部说明与刷新 → 关键摘要 → 三泳道依赖拓扑 → 异常传播范围 → 当前标签页实时退化 → 任务/来源状态 → 观测时间与关联编号。
- 新页面布局：继续使用当前布局；桌面三泳道，移动单列。异常项按真实状态着色，正常项不进入传播列表。
- 页面区域划分：访问入口、共享依赖、异步执行三个区域必须保留；任务与来源是下游业务摘要，不混入运行节点。
- 主要操作：刷新。请求期间必须保留快照、禁用按钮并提供可访问忙状态。
- 次要操作：七类真实下钻、传播处理入口和技术详情。链接必须指向精确运维页面。
- 表格字段：本页不使用表格；状态卡必须保留名称、状态、观测时间、依赖、异常影响和实例/活动数。
- 筛选条件：当前不需要筛选；如未来增加时间范围，必须对应真实历史观测，不能仅筛前端数组。
- 表单字段：无。任何“确认健康”写操作必须另行定义权限、原因、幂等和审计，不能塞入本读页。
- 弹窗和抽屉：无业务弹窗；技术编号继续使用 details 折叠，不默认暴露。
- 加载状态：首次无快照显示 loading；已有数据只做后台刷新。
- 空白状态：任务与来源分别说明为空并保留下钻。
- 错误状态：首次失败显示恢复页；已有快照失败显示行内提示且保留事实。
- 无权限状态：路由守卫拒绝并给出返回安全中心/申请权限入口；API 403。
- 成功反馈：观测时间更新、错误提示消失；不使用“全系统健康”笼统提示。
- 失败反馈：使用后端 action hint，说明旧快照保留；不得暴露 SQL、主机路径或凭据。
- 动效：仅保留按钮忙状态和轻量状态过渡；故障信息不闪烁、不自动滚动。
- 响应式行为：1920/1440/1280 三泳道，390px 单列；二级导航可横向滚动但不能造成页面级溢出。
- 权限差异：运营/超级管理员可读；安全管理员和普通成员不可读。聚合数字不增加账号明细入口。
- 与其他页面联动：拓扑、MySQL、Redis、文件、调度、任务和来源页使用既有路由；返回后重新读取当前事实。
- 涉及接口：仅 GET management status；本批不新增字段或写接口。
- 数据状态变化：页面自身不改业务数据。刷新只把成功响应原子替换为新快照；失败和超时不改变旧快照。
- 验收标准：六节点完整；5 分钟陈旧语义正确；正常/空/首次失败/已有数据失败/15 秒超时/无权限均有证据；重复刷新单请求；四档无溢出；控制台无非预期错误；响应无秘密。

## 无法测试与阻塞

### 交付回归门禁

- 状态页定向模块：`tests/m06-02/platform-dashboard.test.mjs` 9/9 通过；平台相关定向单元测试 17/17 通过；Web 类型检查通过。
- 全量构建：22/22 工作区通过；代码风格、路由制品和文档一致性门禁通过；契约测试 7/7、Python Crawler 测试 24/24 通过。
- 全量单元测试：170/180 通过，10 项范围外既有基线失败，涉及设计质量、`PlatformAccountCenter.vue` 行数、`/platform-admin/data` 路由状态详情漂移、共享弹窗、生产验收 223/222 路径基线、Provider 熔断隔离、共享主题 CSS 和 UI 治理。状态页新增的 9 项模块断言全部通过，未把这些范围外失败标记为本页通过。
- 全量静态分析：范围外 `CompetitorMonitor.vue` 存在异步回调未观测 Promise，门禁失败；本批未修改该文件。
- 运行日志：API 在恢复 MySQL 后 live/ready/available 均为 200，Crawler 持续 acquire 并返回 204；Worker 故障注入后的队列失败率恢复为 0，但共享调度状态文件仍偶发 Windows `EPERM`，按范围外阻塞记录。

- 真实生产账号、生产数据、真实通知、不可逆操作：按限制未使用，不标记通过。
- 真实第三方 Amazon/1688 登录、Cookie 过期、验证码、代理、页面结构变化、解析、入库、暂停恢复和重启恢复：本状态页不创建任务，标记为本页不适用；不能用 Crawler acquire 204 代替完整生命周期。
- 百万级任务/来源/观测和正式并发容量：缺少批准的数据集与容量目标，标记未验证。
- 全站 SSE 健康：当前产品合同只允许标签页会话统计，标记未提供而非通过。
- Worker 状态文件 Windows 原子 rename 的既有 EPERM 基线若再次出现，属于共享 Worker 范围外基线；本页只消费持久化调度观测，不把该基线标记为本页通过。
