# `/platform-admin/mysql` 逐页 UI、功能与链路审计

## 页面审计记录

1. 页面名称和路由：MySQL 运行，`/platform-admin/mysql`；平台后台 / 系统运维 / MySQL 运行。
2. 服务角色：具备 `platform:operate` 的平台运营管理员、平台超级管理员。匿名真实 GET 为 401；把本地测试账号临时降为平台安全管理员后真实 GET 为 403，恢复超级管理员角色后重新可读。
3. 业务目标：在惠州单机、宝塔唯一运维入口和一个 MySQL 5.7 主实例边界内，核对单主、ROW binlog、刷盘、连接、数据盘、缓冲池、慢查询、行锁累计量及同机加密恢复事实。页面不是 SQL 控制台、配置编辑器、备份执行器或容量承诺页。
4. 当前截图：修复前桌面 [before-desktop-1440.png](../../output/playwright/platform-admin-mysql/before-desktop-1440.png)、修复前 390px [before-mobile-390.png](../../output/playwright/platform-admin-mysql/before-mobile-390.png)、修复前重复刷新悬挂 [before-refresh-hanging-mobile.png](../../output/playwright/platform-admin-mysql/before-refresh-hanging-mobile.png)、修复前停库 500 [before-mysql-outage-mobile.png](../../output/playwright/platform-admin-mysql/before-mysql-outage-mobile.png)；修复后桌面 [after-desktop-1440.png](../../output/playwright/platform-admin-mysql/after-desktop-1440.png)、修复后 390px [after-mobile-390.png](../../output/playwright/platform-admin-mysql/after-mobile-390.png)、超时保留 [after-refresh-timeout-preserved-mobile.png](../../output/playwright/platform-admin-mysql/after-refresh-timeout-preserved-mobile.png)、停库 503 保留 [after-mysql-unavailable-preserved-mobile.png](../../output/playwright/platform-admin-mysql/after-mysql-unavailable-preserved-mobile.png)。
5. 页面所有可操作入口：刷新运行事实、失败后重新核验、会话失效后重新登录、面包屑、系统运维二级导航、平台导航菜单、主题切换、新建组织、个人中心、返回用户工作台和移动端更多菜单。本页没有配置、执行 SQL、备份、恢复、删除、上传、下载、导入、导出或故障切换按钮。
6. 每个按钮和控件：逐项记录在“前端功能测试结果”，不使用“其他按钮正常”概括。
7. 调用接口：`GET /api/v1/platform/operations/mysql`；真实覆盖正常、401、403、重复点击、锁等待超时、MySQL 停止、恢复和响应脱敏。
8. 涉及数据表：`mysql_resilience_observations`、`mysql_resilience_views`、`platform_audit_events`；恢复事实来自 `backup_recovery_runs`、`backup_recovery_assets`；权限链涉及 `users`、`user_sessions`、`platform_role_assignments`、`roles`、`role_capabilities`、`authorization_decisions`。
9. 权限和数据隔离：平台全局只读视图，不接受组织/工作区参数；API 强制 `platform:operate`。响应不返回主机、端口、账号、密码、路径、binlog 文件名、SQL、组织、工作区或恢复资产哈希。
10. 正常状态：隔离 MySQL 5.7.44-log、Redis、Node API、Node Worker、Python Crawler 与 Vite 实际运行；页面真实显示 `S0 · READY`、ROW、flush=2、sync_binlog=1、无副本、无备用服务器和本地测试恢复事实。
11. 空数据状态：无 recovery run 时服务会返回 `recovery.status=empty` 并形成阻断项，不把缺少恢复证据美化为 READY；接口 `data=null` 的页面空状态由 E2E 覆盖。真实验收环境为了验证正常状态只写入标记为 `local-test/synthetic_fixture` 的可删除本地恢复证据，不冒充生产备份。
12. 加载状态：首次无快照显示读取态；已有快照刷新时保留所有事实，按钮显示“正在刷新…”、`disabled=true`、`aria-busy=true`。
13. 接口失败状态：修复前真实停库返回 500，页面清空旧事实；修复后数据库连接类错误为 503 `mysql_resilience_dependency_unavailable`，页面保留最后成功快照和关联 ID。
14. 超时状态：对 `mysql_resilience_observations` 持有 120 秒写锁；API 在 14 秒中止事实读取并返回 503 `mysql_resilience_read_timeout`，浏览器保留 15 秒兜底；页面只显示本次刷新失败并保留 READY。事务在锁释放后回滚，不得补写 observation/view/audit 或以迟到响应覆盖页面。
15. 无权限状态：匿名真实 GET 返回 401 `session_invalid`；本地账号临时降权后真实 GET 返回 403 `permission_denied`。401/403 清空旧内存快照，失效会话提供重新登录入口。
16. 表单校验状态：本页没有表单或查询参数。配置阈值由后端环境配置校验；不存在的字段、长度、上传格式和边界值不能标记通过。
17. 重复提交状态：同一组件只保留一个 AbortController。修复前连续三次点击使 observation/view 从 1 增至 4；修复后同步触发额外 DOM click 仍只有一个在途请求。
18. 刷新和返回状态：刷新成功更新 observed_at/request_id；依赖恢复后重新核验回到 READY。reload、浏览器返回和多标签页重新走相同权限/API 合同，不把事实快照写入 localStorage。
19. 不同分辨率：1440×1000 和 390×844 均真实打开并截图；页面业务区域不产生横向溢出，移动端按结论、指标、持久化、恢复、影响和阻断纵向排列。
20. UI 和交互问题：本批修复刷新闪空、重复点击、无界等待、失败无保留、会话失效缺少明确登录动作，以及 390px 下业务影响标题与说明重叠；不改真实业务信息架构和共享平台壳层。
21. 功能问题：修复前数据库锁会让三个重复请求同时排队，停库返回 500；修复后单飞、15 秒有界取消、503 稳定语义和恢复重试形成闭环。
22. 性能问题：本地 222 张表、少量审计记录和单用户下完成读取；没有百万级历史、长期三表增长、50/100 并发或生产 p95/p99，容量只能标记未验证。
23. 安全问题：GET 是只读事实查询但成功读取会写观察/浏览/审计；响应 `private, no-store`，401/403/503 脱敏。未使用生产账号、生产数据、真实通知、支付、第三方 Cookie 或不可逆操作。
24. 企业级缺失：正式容量基线、生产宝塔故障演练、外部监控告警确认、长期审计归档、真实备份/隔离恢复材料仍缺失。产品边界明确不建设读副本、负载均衡或备用服务器，不能把这些写成已交付。
25. 具体优化建议：见“逐页面优化升级方案”；必须保留 MySQL 5.7 单主真相、完整指标、宝塔唯一运维边界、平台权限、审计与脱敏。

## 页面—功能—接口—数据库—权限—后台任务矩阵

| 页面功能            | 接口                 | 数据库/事实源                                                          | 权限               | 后台任务/依赖               | 验收目标                                 |
| ------------------- | -------------------- | ---------------------------------------------------------------------- | ------------------ | --------------------------- | ---------------------------------------- |
| MySQL 韧性读取      | GET operations mysql | global variables/status、master/slave status、observations/views/audit | `platform:operate` | API、MySQL                  | 200 READY/WARNING/BLOCKED，三表同事务    |
| 持久化合同          | 同上                 | log_bin、binlog_format、flush、sync_binlog                             | 同上               | MySQL 5.7 单主              | ROW、2、1、未排除 product_scout          |
| 连接/存储/I/O       | 同上                 | threads、buffer pool、statfs                                           | 同上               | MySQL、同机数据盘           | 只返回聚合值，不返回 datadir             |
| 慢查询/锁等待       | 同上                 | Slow_queries、Innodb_row_lock_waits                                    | 同上               | MySQL                       | 窗口速率与累计量分开，不冒充延迟         |
| 恢复事实            | 同上                 | backup_recovery_runs/assets                                            | 同上               | 现有备份恢复链              | 无证据失败关闭；不宣称备用服务器         |
| 刷新/重新核验       | 同上                 | 成功才写 observation/view/audit                                        | 同上               | API/MySQL                   | 单飞、API 14 秒/浏览器 15 秒、回滚、恢复 |
| MySQL 停止          | 同上                 | 无成功记录                                                             | 同上               | MySQL                       | 503 稳定码、旧快照保留                   |
| 权限拒绝            | 同上                 | session/role/capability/decision                                       | 匿名或缺能力       | 无业务后台任务              | 401/403，旧平台事实清除                  |
| Worker/Crawler 联动 | 无本页新增接口       | Worker 队列和 Crawler 租约                                             | 本页不控制         | Node Worker、Python Crawler | 仅证明实际启动，不冒充第三方采集生命周期 |

## 前端功能测试结果

| 编号         | 功能/入口     | 操作                             | 预期/验收                                 | 结果                        |
| ------------ | ------------- | -------------------------------- | ----------------------------------------- | --------------------------- |
| MYSQL-FE-001 | 页面访问      | 平台超级管理员打开路由           | 标题、面包屑、真实事实可见                | 通过                        |
| MYSQL-FE-002 | 刷新运行事实  | 单击                             | 更新 observed_at/request_id               | 通过                        |
| MYSQL-FE-003 | 重复刷新      | 在途时触发三次 DOM click         | 只允许一个请求，按钮禁用                  | 通过                        |
| MYSQL-FE-004 | 在途保留      | 有 READY 快照后刷新              | 旧事实持续可见                            | 通过                        |
| MYSQL-FE-005 | 有界超时      | 锁 observations 120 秒           | API 14 秒 503、回滚、保留、不接受迟到响应 | 通过                        |
| MYSQL-FE-006 | 重新核验      | 依赖/锁恢复后点击                | 提示消失并回到 READY                      | 通过                        |
| MYSQL-FE-007 | MySQL 停止    | 精确停止 3366 实例               | 503 稳定错误，旧快照保留                  | 通过                        |
| MYSQL-FE-008 | MySQL 恢复    | 原参数重启 5.7.44 后重试         | READY，合同值不漂移                       | 通过                        |
| MYSQL-FE-009 | 首次加载      | 无快照进入                       | 读取态后切真实状态                        | 通过（真实 + E2E）          |
| MYSQL-FE-010 | 空返回        | data=null                        | 显示尚无观测与重新核验                    | 通过（E2E）                 |
| MYSQL-FE-011 | warning       | 返回慢查询 warning               | 结论和 action hint 可读                   | 通过（E2E）                 |
| MYSQL-FE-012 | blocked       | 关闭 binlog/恢复证据失效合同     | 阻断项逐条展示                            | 通过（单元 + E2E）          |
| MYSQL-FE-013 | 会话失效      | 401                              | 清空旧事实并提供重新登录                  | 通过（真实 API + E2E 合同） |
| MYSQL-FE-014 | 无权限        | 账号无 platform:operate          | 403，不返回 MySQL 事实                    | 通过（真实 API）            |
| MYSQL-FE-015 | 429           | 刷新限流                         | 保留旧事实并提示稍后重试                  | 通过（E2E 合同）            |
| MYSQL-FE-016 | 持久化卡      | 检查五项                         | binlog/ROW/2/1/无副本                     | 通过                        |
| MYSQL-FE-017 | 恢复卡        | 检查状态/RPO/RTO/演练/备用服务器 | 真实值且无备用服务器                      | 通过（本地测试证据）        |
| MYSQL-FE-018 | 业务影响      | 检查慢查询/锁等待                | 窗口和累计语义分开                        | 通过                        |
| MYSQL-FE-019 | 1440 桌面     | 真实截图/溢出检查                | 层级完整、无横向溢出                      | 通过                        |
| MYSQL-FE-020 | 390 手机      | 真实截图/溢出检查                | 卡片头纵向排列、无文字重叠或横向溢出      | 通过                        |
| MYSQL-FE-021 | 键盘/可访问性 | Tab/Enter/忙态/live 区域         | 原生按钮、disabled、aria-busy、aria-live  | 通过                        |
| MYSQL-FE-022 | 面包屑        | 检查平台后台/系统运维/MySQL      | href 与当前层级一致                       | 通过                        |
| MYSQL-FE-023 | 二级导航      | 检查十个运维入口                 | 当前 MySQL 链接和目标 href 正确           | 通过                        |
| MYSQL-FE-024 | 控制台        | 正常页与故障页分别检查           | 正常页无业务错误；故障页仅预期 5xx        | 通过，按场景分离            |

搜索、筛选、重置、排序、分页、全选、批量操作、新增、编辑、复制、删除、上传、下载、导入和导出不是此只读实时快照页的既有能力，均为“不适用”。暂停、恢复、取消和失败重跑属于任务/采集页；本页不能执行 MySQL 服务控制、SQL 或恢复操作。

## 接口清单及逐接口测试

### `GET /api/v1/platform/operations/mysql`

| 场景           | 实际结果                                              | 结论                    |
| -------------- | ----------------------------------------------------- | ----------------------- |
| 正常请求       | 200，稳定 data/request_id/trace_id，READY 真实值      | 通过                    |
| 参数缺失       | 无必填查询参数                                        | 不适用/合同明确         |
| 参数类型/边界  | 无查询参数；阈值由后端配置校验                        | 通过（模块测试）        |
| 未登录         | 401 `session_invalid`                                 | 通过（真实）            |
| 无权限         | 403 `permission_denied`                               | 通过（真实）            |
| 跨租户         | 平台全局接口，不接受组织/工作区参数                   | 不适用/边界明确         |
| 重复请求       | 页面单飞；直接 API 并发仍各自形成独立审计             | 页面通过/接口按合同     |
| MySQL 异常     | 503 `mysql_resilience_dependency_unavailable`         | 通过（真实 + 单元）     |
| 超时           | API 14 秒返回 timeout 503；事务回滚；浏览器 15 秒兜底 | 通过（真实 + 模块）     |
| 第三方依赖失败 | 本接口不调用第三方                                    | 不适用                  |
| 数据库异常细节 | 响应不含驱动错误、SQL、主机、账号或凭证               | 通过                    |
| 返回结构       | 成功和标准错误 envelope 稳定                          | 通过                    |
| 状态码/错误码  | 200/401/403/503 有真实证据；429 有 E2E                | 通过/429 合同验证       |
| 分页/排序/筛选 | 当前有界快照，无此类参数                              | 不适用                  |
| 幂等性         | GET 不改业务事实；每次成功授权读取独立写三条审计事实  | 通过                    |
| 日志和审计     | observation/view/audit 同事务，request/trace 关联     | 通过（模块 + 真实计数） |
| 缓存           | `private, no-store`                                   | 通过（模块）            |
| 并发/容量      | 仅页面单飞与小规模本地数据                            | 正式容量未验证          |

## Worker、Crawler 与联合流程证据

- Node Worker 和 Python Crawler 均实际启动；Worker 注册 Amazon 商品、Amazon 畅销榜、1688、Made-in-China、DHgate、EC21 等来源和 18 条队列。Crawler 运行进程实际存在。本页不把“注册/空闲”冒充真实 Amazon/1688 登录、验证码、解析、清洗、入库完整生命周期。
- 联合链路：本地测试管理员登录 → 平台导航/权限通过 → Web GET → API 会话鉴权 → `platform:operate` 授权 → MySQL probe 读取实例/文件系统/恢复事实 → service 评估 READY/WARNING/BLOCKED → repository 同事务写 observation/view/audit → 页面展示 → MySQL 停止 503 保留 → MySQL 恢复重新核验 READY。
- Redis、Worker、Crawler 是按企业级全栈要求实际运行的相关服务；本页 GET 不依赖它们生成 MySQL 事实，不增加虚假的后台任务关联。
- 只使用隔离本地数据库、端口、测试账号和带 `synthetic_fixture=true` 的本地测试恢复记录；没有生产账号、通知、支付、第三方 Cookie 或不可逆操作。

## 问题记录

### MYSQL-P1-001 刷新重复提交、无界等待且丢失最后可信快照（已修复）

- 所属页面/模块：`/platform-admin/mysql`；问题类型：核心运维可靠性；严重等级：P1。
- 问题描述：修复前刷新立即切整页 loading，按钮仍可点击；锁表期间三次点击形成三份在途请求，旧事实不可见。
- 复现步骤：成功读取 → 对 `mysql_resilience_observations` 加 WRITE 锁 → 连续点击刷新三次 → 观察按钮、页面和锁释放后的计数。
- 预期结果：单飞、按钮忙态、已有快照持续可见、15 秒有界取消、迟到响应无效。
- 实际结果：修复前 observation/view 从 1 增至 4；修复后只有一个在途请求，API 14 秒超时保留 READY，锁释放后事务回滚且三类成功记录计数不增加。
- 截图/日志证据：before/after refresh timeout 截图；真实 MySQL 计数和 Playwright 请求计数。
- 涉及文件：`MySqlResilienceCenter.vue`、`mysql-resilience.css`、M08-03 E2E；接口：GET operations mysql；数据：observations/views/audit。
- 影响范围：事故时事实可信度、连接池压力、审计放大和操作反馈。
- 修复建议：AbortController 单飞、API 14 秒上限、浏览器 15 秒兜底、事务阶段中止检查、sequence、卸载取消、同一 correlation ID；429/503/timeout 保留，401/403 清除。
- 验收标准：在途额外 click 不增请求；旧事实可见；15 秒提示；恢复可重试；当前满足。

### MYSQL-P2-002 MySQL 停止返回 500 且页面清空事实（已修复）

- 所属页面/模块：MySQL operations API 与页面故障态；问题类型：接口可靠性；严重等级：P2。
- 问题描述：修复前真实停止 MySQL 后 GET 为 500，调用方无法区分数据库依赖故障与代码缺陷，页面清空健康快照。
- 复现步骤：READY 页面 → 精确停止隔离 3366 mysqld → 点击刷新 → 检查请求和页面。
- 预期结果：503 稳定码、关联 ID、无底层细节；已有快照保留；恢复后重新核验。
- 实际结果：修复前请求 44 为 500；修复后为 503 `mysql_resilience_dependency_unavailable`，旧 READY 保留，重启后回 READY。
- 截图/日志证据：before/after MySQL unavailable 截图、浏览器 request 列表、模块 503 脱敏测试。
- 涉及文件：`mysql-resilience-routes.ts`、OpenAPI、前端组件；接口：GET operations mysql；数据：鉴权/授权和观测事务依赖 MySQL。
- 影响范围：前端恢复、监控分类、值班处置和错误暴露风险。
- 修复建议：仅映射明确 MySQL/网络依赖码；不吞编程错误，不回显原始错误。
- 验收标准：停库 503 脱敏、恢复 200、页面保留；当前满足。

### MYSQL-P3-005 390px 业务影响卡片头文字重叠（已修复）

- 所属页面/模块：`/platform-admin/mysql` 业务影响与告警卡片；问题类型：移动端 UI；严重等级：P3。
- 问题描述：390px 下卡片头仍采用横向两端布局，长标题“慢查询与锁等待影响”与说明“不把累计值冒充当前延迟”发生视觉重叠。
- 复现步骤：将真实页面调整为 390×844 → 滚动到业务影响区域 → 检查标题与说明的边界。
- 预期结果：标题、说明保持完整阅读顺序，无覆盖、截断或横向溢出。
- 实际结果：修复前真实截图可见文字覆盖；修复后 520px 以下卡片头纵向排列，390px `scrollWidth=390`、无重叠。
- 截图/日志证据：`after-mobile-390.png` 修复后截图及浏览器溢出检查；修复前画面由本批实际视觉复核记录。
- 涉及文件：`apps/web/src/mysql-resilience.css`；接口/数据：无，纯本页响应式布局。
- 影响范围：小屏运维人员对慢查询/锁等待语义的理解，不影响桌面布局或后台事实。
- 修复建议：仅在本页 520px 媒体查询内把 `.mysql-resilience__panel header` 改为纵向、左对齐并增加 8px 间距。
- 验收标准：1440px 仍保持双端排列；390px 标题与说明不重叠且无横向溢出；当前满足。

### MYSQL-P4-003 正式容量与长期审计规模未验证（未修改）

- 所属页面/模块：probe/service/repository/页面；问题类型：性能容量；严重等级：P4。
- 问题描述：本地只有 222 张表和少量审计记录，没有长期增长、高并发或生产负载。
- 复现步骤：当前缺少批准的容量目标、合成规模和独立压测窗口。
- 预期结果：按明确 SLO 给出 p50/p95/p99、错误率、连接池、审计索引增长和页面首屏数据。
- 实际结果：功能与有界失败通过；企业容量未验证。
- 截图/日志证据：本地页面与定向测试，不足以证明容量。
- 涉及文件/接口/数据：M08-03 全链；三张观测/审计表。
- 影响范围：长期读取时延、连接峰值、审计写放大。
- 修复建议：容量专项使用脱敏合成 30/90 天规模和 50/100 并发测试。
- 验收标准：SLO、数据规模、结果和资源水位可复验；当前未满足。

### MYSQL-P2-004 共享全栈 readiness 为 503（前置基线，未修改）

- 所属页面/模块：共享运行拓扑/就绪门；问题类型：运行时监督；严重等级：P2。
- 问题描述：本地 API live=200、页面 GET=200、Worker/Crawler 进程运行，但共享 ready 返回 503。
- 复现步骤：启动隔离全栈 → 分别请求 health live/ready → 核对进程和页面。
- 预期结果：与当前运行合同一致的服务被 ready 正确识别，或给出明确缺失节点。
- 实际结果：live 200、ready 503；本页使用独立同构 API/Worker/Crawler 完成真实验证，未越权修改前置模块。
- 截图/日志证据：端口/进程/health 输出和本地日志；临时文件结束时删除。
- 涉及文件/接口/数据：共享 topology/health，不是 MySQL 页面业务接口。
- 影响范围：本地验收与生产监督可信度。
- 修复建议：在前置运行时批次核对节点注册、build/config fingerprint、过期阈值和进程所有权。
- 验收标准：live 与 ready 语义一致，缺失节点可定位；当前未验证。

## 逐页面优化升级方案

- 页面定位/使用者/核心任务：平台运营管理员对单 MySQL 5.7 主实例做只读韧性核验；在最短路径判断持久化合同、资源、查询/锁影响、恢复事实和阻断动作。
- 当前问题：本批解决重复刷新、无界等待、闪空和 500；生产容量、真实备份演练及共享 readiness 仍缺失。
- 必须保留：S0 READY/WARNING/BLOCKED、ROW/2/1、无副本/无备用服务器、连接/存储/I/O/慢查询/锁等待/恢复、全部 finding、observed_at/request_id、宝塔边界。
- 不应增加：网页 SQL、配置编辑、重启、备份恢复执行、凭证/path/binlog 文件名或把未知数据美化为 0。
- 信息架构/新布局：保持“定位与刷新 → 总结论 → 四项资源 → 持久化/恢复 → 查询与锁影响 → 阻断 → 关联信息”；桌面双列，390px 因果顺序单列。
- 主要/次要操作：主要只有刷新和失败后的重新核验；次要是面包屑和运维导航。刷新必须单飞、有界、保留事实；重新登录仅在 401 提供。
- 表格/筛选/表单：当前快照无需表格、筛选或表单。未来历史趋势应服务端分页，只允许时间、状态、finding code；配置写入必须独立审批和回滚流程。
- 弹窗/抽屉：当前无需；阻断项直接可读效率更高。未来历史详情才可使用具名抽屉并恢复焦点。
- 状态设计：首次 loading；data=null 空态；429/503/timeout 行内保留；401/403 清空；恢复后明确成功；不存在离线缓存冒充当前状态。
- 成功/失败反馈：成功用 state/observed_at/request_id；失败用稳定码、action hint、request_id 和“已保留”说明。
- 动效：仅加载转圈和按钮忙态；禁止数字装饰跳动或用颜色代替文字结论。
- 响应式：桌面保持高密度，390px 单列；长 request_id 换行；共享底栏安全区由壳层专项统一处理。
- 权限差异：`platform:operate` 只读；任何未来配置写必须更高能力、审批、版本和审计，不能复用 GET 权限。
- 联动：系统状态看总览、拓扑看进程、日志按 request_id 排障、备份恢复看演练材料、容量边界看承诺；本页只负责 MySQL 专题事实。
- 涉及接口/状态变化：仅 GET operations mysql；成功授权读取写 observation/view/audit，失败/取消不伪造成功；无数据库结构变化。
- 验收标准：真实全栈、正常/空/加载/超时/停库/恢复/401/403/429/503、单飞、脱敏、两档响应式、构建/模块/E2E/文档均有证据。

## 验证门禁与阻塞

- 真实隔离运行：MySQL 5.7.44-log、Redis、Node API、Node Worker、Python Crawler 与 Vite 均实际启动。API `/health/live` 为 200；共享 `/health/ready` 为 503，按前置运行拓扑基线记录，未冒充通过。
- 真实超时：写锁前 observation/view/audit(read) 为 `16/16/16`；两个读取均由 API 在约 14.03 秒返回 503，锁释放后仍为 `16/16/16`；依赖恢复后一次成功重新核验为 `17/17/17`。这证明超时事务没有迟到补写。
- 真实停库/恢复：精确停止隔离 3366 后 operations GET 返回 503，页面保留最后 READY；按原参数重启后 GET 为 200，实例仍为 MySQL 5.7.44-log、ROW、flush=2、sync_binlog=1，成功计数为 `18/18/18`。
- 页面证据：1440×1000 与 390×844 均无横向溢出；390px 修复后的卡片头无文字重叠。故障态控制台只记录预期 503；恢复后清空场景日志并 reload，控制台错误为 0。
- 定向门禁：`build:api`、`typecheck:web` 通过；M08-03 Node 模块测试 11/11；定向 Playwright 桌面与 390px 共 6/6。
- 完整门禁：22 个 workspace 全量构建通过；文档门禁 136 个必需文件通过；route artifacts 73 routes/60 protected/6 roles 通过；格式门禁通过。
- 已授权范围外基线：`verify:module M08-03` 只因前置 `M08-01` 状态为 blocked；静态分析只命中 `CompetitorMonitor.vue` 既有未观察 Promise；共享单元测试为 170/180，10 项均属于既有设计/主题/UI 治理基线。本批未修改这些范围外文件来掩盖失败。
- 真实生产账号/数据/通知/支付和不可逆操作按限制未使用，不能标记通过。
- 真实 Amazon/1688/供应链采集的登录、验证码、代理、重试、解析、去重、清洗、入库、暂停、恢复、取消、失败重跑、告警、资源释放和重启恢复不是本页链路；服务实际启动不等于这些生命周期通过。
- 真实宝塔生产配置、线上 MySQL 停止/重启、生产备份和隔离恢复演练未执行；本地证据不能冒充生产。
- 正式大数据量、长期审计保留和并发容量未验证；共享 ready=503 作为前置基线保留。
