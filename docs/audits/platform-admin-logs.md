# `/platform-admin/logs` 逐页 UI、功能与链路审计

## 页面审计记录

1. 页面名称和路由：链路日志，`/platform-admin/logs`；平台后台 / 系统运维 / 链路日志。
2. 服务角色：具备 `platform:operate` 或 `platform:superadmin` 的平台运营管理员、平台超级管理员。平台安全管理员真实浏览器进入无权状态，API 实测 403；匿名 API 实测 401。
3. 业务目标：按 request_id、trace_id、任务、事件和错误码，把 API 审计、Worker 任务事件与 Crawler 运行事实拼成可追溯但不伪造关联的调用链，并导出当前受控范围。
4. 当前截图：修复前桌面 [before-desktop.png](../../output/playwright/platform-admin-logs/before-desktop.png)、修复前 390px [before-mobile.png](../../output/playwright/platform-admin-logs/before-mobile.png)；修复后桌面 [after-desktop.png](../../output/playwright/platform-admin-logs/after-desktop.png)、修复后 390px [after-mobile.png](../../output/playwright/platform-admin-logs/after-mobile.png)、数据库失败保留 [after-database-failure-preserved.png](../../output/playwright/platform-admin-logs/after-database-failure-preserved.png)、空筛选 [after-empty-filter.png](../../output/playwright/platform-admin-logs/after-empty-filter.png)、首次页面读取失败 [after-page-error-state.png](../../output/playwright/platform-admin-logs/after-page-error-state.png)。
5. 可操作入口：检索条件、运行面、检索、重置、刷新日志、导出当前筛选、导出原因、取消、确认导出、列设置、首列冻结、密度、技术详情、移动端事件详情、关联任务、关联来源、面包屑、系统运维二级导航和平台导航。
6. 控件结果：逐项见“前端功能结果”；不存在“其他按钮正常”或“页面整体可用”的合并结论。
7. 接口：`GET /api/v1/platform/management?domain=logs&query=&status=`；`POST /api/v1/platform/management/logs/exports`。真实结果覆盖正常、缺参、类型/长度错误、匿名、无权限、重复、并发、超时、同源、幂等和数据库失败。
8. 数据表：`platform_audit_events`、`collection_task_events`、`collection_tasks`、`crawler_browser_runs`、`browser_collection_jobs`、`providers`；导出写入 `platform_management_operations` 与 `platform_audit_events`；权限涉及 `user_sessions`、`platform_role_assignments`、`role_capabilities`、`authorization_decisions`。
9. 权限与数据隔离：该页是明确的平台全局运维视图，不按组织过滤；API 强制 `platform:operate`。响应和 CSV 不返回 metadata、payload、stderr、Cookie、Token、密码、凭据、文件路径或完整隐私数据。
10. 正常状态：隔离 MySQL 5.7、Redis、Node API、Node Worker、Python Crawler 和 Vite 均真实运行；最终页面显示 16 条真实事件、13 条调用链，其中 API 13、Worker 2、Crawler 1。
11. 空数据状态：真实查询 `PAGE49_NO_MATCH` 返回 0 条，显示明确空状态，筛选和恢复入口保留。
12. 加载状态：首次无快照显示读取态；已有快照刷新时调用链继续显示，按钮显示“正在刷新…”，禁用并设置 `aria-busy=true`。
13. 接口失败状态：真实停止隔离 MySQL 后 GET 返回 503；已有日志继续显示并提示依赖不可用。页面专属 503 注入的首次读取错误态提供“重新加载”，恢复后返回正常列表。
14. 超时状态：真实浏览器把请求延迟超过 15 秒，`AbortController` 中止；原 4 条调用链保留并显示“已停止本次请求并保留上次成功日志”。
15. 无权限状态：平台安全管理员真实浏览器显示“无权打开此页面”，API 返回 403 `permission_denied`；匿名 API 返回 401 `session_invalid`。
16. 表单校验状态：查询最多 120 字；服务端超长查询返回 400；来源只允许 API、Worker、Crawler；导出原因 1 字时确认按钮禁用，2–300 字可提交，缺失/非法值返回 400。
17. 重复提交状态：刷新使用单请求控制器，延迟期间双击只产生 1 次 GET。导出强制 `Idempotency-Key`；相同键相同负载并发两次均为 200、CSV 完全一致，数据库只写 1 条操作和 1 条审计；同键不同负载返回 409。
18. 刷新和返回状态：查询和运行面写入 URL；Enter 提交后刷新仍为 1 条 Worker 失败事件，重置清除 URL。任务/来源深链携带 `from`，任务页能打开精确任务，来源页诚实显示当前目录中不存在该测试 Provider。
19. 不同分辨率：1920×1080、1440×900、1280×800、390×844 的 `scrollWidth` 均等于视口宽度，没有页面级横向溢出；390px 使用摘要卡和详情抽屉。
20. UI 和交互问题：修复前筛选刷新即丢失、原始英文事件/状态直出、刷新会清空事实；均已修复。共享移动底部导航可能覆盖超长页面末端，属于壳层范围外问题，未在本页越权修改。
21. 功能问题：修复前非法来源返回 200 空列表；重复导出写两条审计；无请求取消、超时和迟到响应保护。当前均有服务端和浏览器证据。
22. 性能问题：本地小数据正常 GET 约 156ms；12 并发均为 200，最大约 1708ms。没有百万级日志、200 行复杂链和正式连接池容量数据，不能宣称企业容量通过。
23. 安全问题：CSV 公式注入样例 `=PAGE49_FORMULA_TEST` 和 `+441234` 均以单引号保护；跨源导出 403；缺少幂等键 400；响应秘密关键字扫描未命中。没有使用生产账号、生产数据或真实通知。
24. 企业级缺失：没有超过最新 200 条的历史检索/分页、日志保留策略和归档检索、SIEM/告警联动、保存筛选、链路 SLA、正式容量基线与独立日志读取审计；当前页面不能替代宝塔原始进程日志。
25. 具体优化建议：见“逐页面优化升级方案”；必须保留精确 trace 分组、真实任务/来源关联、归一化最小字段、200 条边界、技术详情折叠、CSV 防注入、平台全局权限与既有 Worker/Crawler 所有权。

## 页面—功能—接口—数据库—权限—后台任务矩阵

| 页面功能 | 接口 | 数据库 | 权限 | 后台任务/依赖 | 实际结果 |
| --- | --- | --- | --- | --- | --- |
| 日志读取 | GET management logs | 三类事件事实表及关联表 | `platform:operate` | Node API、MySQL | 200，最多 200 条归一化事件 |
| 查询筛选 | 同上，`query` | request/trace/event/resource/error 索引字段 | 同上 | 无写任务 | URL 保持；Enter、刷新、返回通过 |
| 运行面筛选 | 同上，`status` | API/Worker/Crawler 三类事实 | 同上 | API/Worker/Crawler | 三种合法值 200；非法值 400 |
| trace 分组 | 同上 | `trace_id`、`occurred_at` | 同上 | 无 | 同 trace 四事件按时间正序，不跨 trace 拼接 |
| 任务下钻 | 无新增接口 | `collection_tasks`、`collection_task_events`、`browser_collection_jobs` | 目标页自身权限 | Worker/Crawler 关联 | 精确任务 ID 打开详情 |
| 来源下钻 | 无新增接口 | `crawler_browser_runs.provider_id`、`providers` | 目标页自身权限 | Crawler 持久化关联 | 仅有精确 Provider 时显示链接 |
| 刷新 | GET management logs | 同读取 | 同上 | API/MySQL | 单请求、15 秒中止、失败保留快照 |
| CSV 导出 | POST logs exports | 读取表 + `platform_management_operations` + `platform_audit_events` | `platform:operate`、同源、幂等键 | 无 Worker/Crawler 写任务 | 当前筛选 200 条内；审计、重放、防注入通过 |
| 权限拒绝 | GET/POST | 会话、角色、能力、授权决定 | 安全管理员无 `platform:operate` | 无 | 浏览器保护、API 403；匿名 401 |

## 前端功能测试结果

| 编号 | 功能/入口 | 操作 | 实际结果 | 结论 |
| --- | --- | --- | --- | --- |
| LOGS-FE-001 | 页面访问 | 运营管理员打开路由 | 标题、面包屑、摘要和真实链路出现 | 通过 |
| LOGS-FE-002 | 查询 | 输入错误码并点击检索 | URL 写入 query，返回 1 条 Worker 事件 | 通过 |
| LOGS-FE-003 | 键盘检索 | 输入后按 Enter | 同 LOGS-FE-002 | 通过 |
| LOGS-FE-004 | 运行面 | 选 API/Worker/Crawler | 真实 API 分别返回对应运行面 | 通过 |
| LOGS-FE-005 | 重置 | 点击重置 | 清空草稿和 URL，恢复全部日志 | 通过 |
| LOGS-FE-006 | 页面刷新 | 带筛选 reload | URL 和 1 条结果保持 | 通过 |
| LOGS-FE-007 | 浏览器返回 | 从任务/来源页返回 | 回到日志页并恢复受控范围 | 通过 |
| LOGS-FE-008 | 刷新日志 | 点击按钮 | GET 200，观测时间更新 | 通过 |
| LOGS-FE-009 | 重复刷新 | 延迟期间重复点击 | 按钮禁用，只记录 1 次 GET | 通过 |
| LOGS-FE-010 | 后台刷新 | 4 秒响应延迟 | 旧链路可见，按钮显示忙状态 | 通过 |
| LOGS-FE-011 | 超时 | 响应延迟超过 15 秒 | 请求中止，旧链路与提示保留 | 通过 |
| LOGS-FE-012 | 数据库失败 | 停止隔离 MySQL 后刷新 | 503 提示，旧链路保留 | 通过 |
| LOGS-FE-013 | 空状态 | 查询不存在内容 | 0 条明确空状态 | 通过 |
| LOGS-FE-014 | 首次错误 | 页面专属 503 后进入 | 错误态和重新加载入口出现 | 通过 |
| LOGS-FE-015 | 错误恢复 | 撤销 503 后重新加载 | 返回真实链路 | 通过 |
| LOGS-FE-016 | 导出入口 | 点击导出 | 打开原因对话框 | 通过 |
| LOGS-FE-017 | 原因必填 | 输入 1 字 | 确认按钮禁用 | 通过 |
| LOGS-FE-018 | 取消导出 | 点击取消 | 对话框关闭，不下载、不审计 | 通过 |
| LOGS-FE-019 | 确认导出 | 合法原因确认 | 下载 UTF-8 BOM CSV | 通过 |
| LOGS-FE-020 | 公式防护 | 导出危险前缀 | 两个单元格均以单引号保护 | 通过 |
| LOGS-FE-021 | 列设置 | 展开并切换列 | 当前链表字段按选择显示 | 通过 |
| LOGS-FE-022 | 首列冻结 | 点击冻结按钮 | pressed 状态和冻结样式切换 | 通过 |
| LOGS-FE-023 | 密度 | 切换标准/紧凑 | 行密度改变，数据不变 | 通过 |
| LOGS-FE-024 | 技术详情 | 展开编号 | request/trace 等编号出现，默认折叠 | 通过 |
| LOGS-FE-025 | 关联任务 | 点击精确链接 | 打开匹配任务详情 | 通过 |
| LOGS-FE-026 | 关联来源 | 点击精确链接 | 进入来源筛选页，不伪造不存在来源 | 通过 |
| LOGS-FE-027 | 中文语义 | 查看失败/超时行 | 显示“采集任务失败/终止失败”“爬虫运行超时/已超时” | 通过 |
| LOGS-FE-028 | 390px 详情 | 打开事件详情 | 摘要卡和具名抽屉可用 | 通过 |
| LOGS-FE-029 | 多标签页 | 新标签打开相同 URL | 独立加载且筛选由 URL 恢复 | 通过 |
| LOGS-FE-030 | 四档分辨率 | 检查页面宽度 | 均无页面级横向溢出 | 通过 |
| LOGS-FE-031 | 控制台 | 干净会话正常加载 | 0 error、0 warning | 通过 |
| LOGS-FE-032 | 安全管理员 | 直达路由 | 无权状态，不装载日志事实 | 通过 |
| LOGS-FE-033 | 匿名 | 无会话请求 GET | 401 | 通过 |

排序、分页、全选、批量操作、新增、编辑、复制、删除、上传和导入不是该受控最新 200 条链路页的既有能力，标记“不适用”，没有用不存在的控件冒充通过。下载仅指受审计 CSV 导出；日志页不直接暂停、恢复、取消或重跑任务，相关能力属于采集任务页。

## 接口清单及逐接口测试

### `GET /api/v1/platform/management?domain=logs`

| 场景 | 实际结果 | 结论 |
| --- | --- | --- |
| 正常请求 | 200，结构含 items/summary/observed_at | 通过 |
| 缺少 query/status | 200，使用全量受控范围 | 通过 |
| 缺少 domain | 200，当前服务默认为 status | 与 OpenAPI 必填不一致，见阻塞/问题 |
| query 超过 120 字 | 400 `platform_management_filter_invalid` | 通过 |
| 非法 status | 400 `platform_management_filter_invalid` | 通过 |
| API/Worker/Crawler 筛选 | 均 200，仅返回目标运行面 | 通过 |
| 未登录 | 401 `session_invalid` | 通过 |
| 无权限 | 403 `permission_denied` | 通过 |
| 重复 GET | 200，无写副作用 | 通过 |
| 12 并发 | 12 个 200，最大约 1708ms | 通过，仅小数据 |
| 超时 | 浏览器 15 秒主动中止并保留旧事实 | 通过 |
| 数据库异常 | 真实停库后 503，恢复后 200 | 通过 |
| 第三方依赖失败 | 读取不调用第三方 | 不适用 |
| 分页/排序 | 固定最新 200 条，组内时间正序；无分页参数 | 合同通过，企业历史检索缺口 |
| 返回秘密扫描 | 未出现 password/token/cookie/secret | 通过 |

### `POST /api/v1/platform/management/logs/exports`

| 场景 | 实际结果 | 结论 |
| --- | --- | --- |
| 正常请求 | 200 `text/csv`，下载当前筛选 | 通过 |
| 原因缺失/过短 | 400 或前端禁用 | 通过 |
| query 超长/来源非法 | 400 | 通过 |
| 未登录/无权限 | 401/403 | 通过 |
| 跨源请求 | 403 `origin_forbidden` | 通过 |
| 缺幂等键 | 400 `idempotency_key_required` | 通过 |
| 同键同负载顺序重复 | 重放首份 CSV，不重复审计 | 通过 |
| 同键同负载并发重复 | 两个 200、字节一致；1 操作、1 审计 | 通过 |
| 同键不同负载 | 409 `idempotency_key_reused` | 通过 |
| CSV 公式注入 | 危险前缀以单引号保护 | 通过 |
| 审计 | actor/filter/reason/row_count 持久化 | 通过 |
| 数据库异常 | 事务回滚；接口失败，不留下半条审计 | 通过 |

## Worker、Crawler 与联合流程证据

- Worker 真实进程 `page49-worker` 启动，注册 Amazon、1688、Made-in-China、DHgate、EC21、公开 RSS/Google News 等来源和 18 个队列；调度状态为 running。
- Python Crawler 真实进程启动，每 5 秒向 `http://127.0.0.1:4188` 领取作业；空队列真实返回 204。日志页不以空轮询冒充第三方完整生命周期。
- 联合链路：运营管理员登录 → 路由权限通过 → Web GET → Node API 鉴权 → MySQL 读取 API/Worker/Crawler 事实 → 同 trace 四事件按时间组装 → 页面筛选失败错误码 → 下钻精确任务/来源 → 导出当前筛选 → MySQL 写幂等操作与平台审计 → 重复导出重放。
- 前置条件：仅隔离本地账号、隔离库和测试事件；未使用生产账号、真实第三方 Cookie、验证码、真实通知或不可逆操作。
- 实际结论：页面联合链路通过；Amazon/1688 等真实登录、验证码、页面解析、入库、暂停恢复与重启恢复不属于本页写链路，仍按采集专项阻塞项处理。

## 问题记录

### LOGS-P1-001 刷新与返回丢失筛选（已修复）

- 所属页面/模块：`/platform-admin/logs`，Web 读取控制器；类型/等级：功能可靠性，P1。
- 描述：修复前检索只存在组件内存，URL 不变，浏览器刷新或返回立即回到全部日志。
- 复现：输入 `PAGE49_UPSTREAM_TIMEOUT` → 运行面选 Worker → 检索 → reload。
- 预期/实际：预期继续 1 条 Worker 失败；实际恢复全部记录。证据：修复前真实浏览器 URL 仍为裸路由。
- 涉及文件/接口/数据：`PlatformLogCenter.vue`；GET management logs；不改表，仅改变已提交 query/source 的浏览器状态。
- 影响：故障排查上下文丢失，多标签协作不可复现。
- 修复建议/验收：把已提交筛选写入 URL，草稿不提前改变导出；reload、返回、多标签均恢复。当前已由 Enter、reload、reset 实测满足。

### LOGS-P1-002 刷新失败清空最后可信日志（已修复）

- 所属页面/模块：日志页读取生命周期；类型/等级：可用性，P1。
- 描述：修复前每次刷新先切整页 loading，失败后替换为错误态，事故期间最后可信链路消失，且没有超时和迟到响应保护。
- 复现：先加载成功日志 → 停止隔离 MySQL 或延迟响应超过 15 秒 → 刷新。
- 预期/实际：预期保留快照并提示；实际修复前只剩错误页。证据：前后截图及真实 503/延迟日志。
- 涉及文件/接口/数据：`PlatformLogCenter.vue`；GET management logs；三类日志事实表只读。
- 影响：核心故障排查在依赖异常时不可用。
- 修复建议/验收：单请求、AbortController、15 秒中止、序列保护、卸载取消、后台刷新保留快照。当前真实 MySQL 503 和超时均满足。

### LOGS-P1-003 重复导出产生重复审计（已修复）

- 所属页面/模块：日志 CSV 导出；类型/等级：数据一致性与审计，P1。
- 描述：修复前相同 `Idempotency-Key` 连续提交两次均重新生成并写两条 `platform.logs.export` 审计。
- 复现：同一账号、同一键、同一查询/source/reason 连续或并发 POST 两次。
- 预期/实际：预期返回同一 CSV、只留一次操作和审计；实际修复前两次 200 且审计计数 2。
- 涉及文件/接口/数据：`platform-dashboard-routes.ts`、`platform-dashboard-service.ts`、`mysql-platform-dashboard-repository.ts`；POST logs exports；`platform_management_operations`、`platform_audit_events`。
- 影响：审计膨胀、重复下载无法判定、自动重试不安全。
- 修复建议/验收：强制幂等键，MySQL 命名锁串行同键并在事务内重放/写审计；同键异负载 409。当前并发两个 200、CSV 344 字节一致、操作 1、审计 1。

### LOGS-P2-004 非法运行面被当作空结果（已修复）

- 所属页面/模块：平台管理日志读取；类型/等级：接口校验，P2。
- 描述：修复前 `status=invalid-source` 返回 200 空列表，调用方无法区分无数据和参数错误。
- 复现：GET management logs 携带非法 status。
- 预期/实际：预期 400；实际修复前 200。涉及文件为 `platform-dashboard-service.ts`，接口同上，不写数据。
- 影响：自动化和用户误判数据为空。
- 修复建议/验收：仅允许空值/API/Worker/Crawler；当前真实请求返回 400 `platform_management_filter_invalid`。

### LOGS-P3-005 原始技术枚举降低可读性（已修复）

- 所属页面/模块：日志事件列表；类型/等级：UI/易用性，P3。
- 描述：`collection.task.failed`、`timed_out` 等直接作为主文案，运营角色难以快速扫描。
- 复现：查看失败 Worker 与超时 Crawler 行。预期中文主语义且原始码可追溯；修复前只有英文枚举。
- 文件/接口/数据：`PlatformLogCenter.vue`；不改接口和表。
- 影响：事故判断速度和新用户理解。
- 修复建议/验收：事件、资源、状态显示中文，原始事件码保留为次级技术文本。当前截图和可访问树已验证。

### LOGS-P3-006 共享移动导航覆盖风险（未修改）

- 所属页面/模块：平台共享壳层；类型/等级：UI，P3。
- 描述/证据：390px 长页面底部固定导航可能覆盖最后内容；本页自身 `scrollWidth=390`，不是横向溢出。
- 复现：390×844 滚动到完整链路末尾。预期末项保留安全区；实际需避让固定导航。
- 文件/接口/数据：共享 NavigationShell/CSS；无接口/数据影响。
- 影响：移动端末端操作可见性；范围为所有平台页。
- 修复建议/验收：共享壳层批次统一增加底部安全区，在至少 390px 验证末项完全可见；本页批次禁止越权修改。

### LOGS-P4-007 domain 必填合同漂移（未修改）

- 所属页面/模块：共享 platform management GET；类型/等级：接口合同，P4。
- 描述：OpenAPI 把 domain 描述为必填，真实缺参默认进入 status 并返回 200。
- 复现：不带 domain 请求共享接口。预期按文档 400；实际 200 status。
- 文件/接口/数据：共享路由/服务与 OpenAPI；本页没有发送缺参请求，不影响本页正常链路。
- 影响：通用 API 客户端可能错误理解默认行为。
- 修复建议/验收：由共享接口批次决定保留默认值并更新文档，或改为缺参 400；需要先锁定兼容性，不能在日志页单独修改。

### LOGS-P4-008 企业容量未验证

- 所属页面/模块：日志读取/导出；类型/等级：性能容量，P4。
- 描述：仅本地小数据和 12 并发；没有 200 条复杂链、长期历史或正式 p95/p99。
- 复现：当前缺少批准容量数据集。预期有目标、数据规模、连接池和导出时延基线；实际未验证。
- 文件/接口/数据：读仓储、GET/POST、三类事实表；影响运维高峰与大规模租户。
- 修复建议/验收：使用脱敏测试数据完成 200 条上限、并发 50/100、p95/p99、错误率和连接池测试，未达到目标前不得宣称企业容量。

## 逐页面优化升级方案

- 页面定位：平台全局跨运行面故障检索器，不是原始日志全文搜索或任务控制台。
- 使用者：平台运营管理员和超级管理员；安全管理员、组织管理员和普通成员保持拒绝。
- 核心任务：从错误码/request/trace 定位调用链，确认异常运行面与精确业务对象，留存受审计 CSV。
- 当前问题：本批已解决筛选丢失、刷新事实丢失、超时、非法来源、重复导出和中文语义；历史检索、容量、共享移动安全区仍缺失。
- 应保留的功能：API/Worker/Crawler 三面、精确 trace 分组、任务/来源深链、技术编号、列控制、200 条边界、原因审计、CSV 防注入。
- 应删除或合并：不删除既有能力；不能把不同 trace 合并，不能凭错误码猜 Provider，不能把宝塔原始日志全文复制到页面。
- 信息架构：页面说明与主操作 → URL 筛选 → 返回量和运行面摘要 → trace 链组 → 观测时间与查询编号。
- 新页面布局：继续采用当前紧凑运维布局；桌面按 trace 分区表格，移动按事件卡片与详情抽屉，不做装饰性大图或低密度卡墙。
- 页面区域划分：主操作只保留刷新和导出；筛选与摘要相邻；异常下钻只出现在有精确关系的行。
- 主要操作：检索、刷新、导出。都必须使用已提交筛选；刷新失败不清空事实，导出必须原因、同源和幂等。
- 次要操作：重置、列设置、冻结、密度、技术详情、任务/来源下钻。
- 表格字段：时间、运行面、事件、状态、资源、异常处理、技术详情；原始事件码作为次级文本，不增加 payload/stderr 列。
- 筛选条件：单一全文条件和运行面；未来若增加时间范围必须是服务端真实边界并写 URL，不能只筛已下载 200 条。
- 表单字段：查询 0–120 字；来源固定枚举；导出原因 2–300 字。错误码、空格和长文本必须有明确提示。
- 弹窗和抽屉：导出原因使用审计对话框；移动事件详情使用具名抽屉；关闭不丢筛选，取消不写审计。
- 加载状态：首次骨架/读取态；已有快照后台刷新，按钮 busy 并禁用。
- 空白状态：说明当前筛选无结果，保留重置与修改筛选，不暗示平台没有任何日志。
- 错误状态：首次失败显示恢复入口；已有事实失败/超时显示行内提示并保留观测时间。
- 无权限状态：路由守卫显示访问保护；API 401/403，不渲染敏感摘要。
- 成功和失败反馈：检索由 URL 和摘要变化确认；导出由下载与审计确认；失败反馈使用稳定错误码和 action hint，不暴露 SQL/路径/秘密。
- 动效：只保留按钮忙态和抽屉轻量过渡；事故数据不闪烁，不自动滚动，不用颜色代替文字。
- 响应式行为：1920/1440/1280 使用宽表局部滚动；390px 摘要卡；共享壳层另行补安全区。
- 权限差异：运营/超级管理员读与导出；安全管理员不因“安全”角色自动获得运维日志；目标下钻继续服从目标页权限。
- 与其他页面联动：从系统状态进入日志；日志只在持久化关系存在时进入采集任务和来源页；返回保留 query/source。
- 涉及接口：GET management logs、POST logs exports；不新增路由。
- 数据状态变化：GET 不写业务数据；导出仅写一条幂等操作和一条平台审计，不修改任务、队列、Crawler 运行或来源。
- 验收标准：正常/空/加载/首次失败/保留失败/15 秒超时/无权限都有证据；URL、Enter、重置、reload、多标签通过；四档无溢出；并发重复导出只写一次；CSV 无秘密且防公式注入；控制台无非预期错误。

## 无法测试项与阻塞项

- 真实生产账号、生产数据、真实通知、不可逆操作：按限制未使用，不能标记通过。
- 真实 Amazon/1688 登录、Cookie 过期、验证码、代理、页面结构变化、解析、去重、清洗、入库、暂停、恢复、取消、失败重跑、部分成功、告警、资源释放和服务重启恢复：本页只读既有事实，不能用 Worker 注册或 Crawler acquire 204 冒充完整生命周期，继续列为采集专项阻塞。
- 第三方依赖失败：日志读取和导出不调用第三方，标记不适用；第三方失败事件仅作为已持久化测试事实展示。
- 数据库写异常精确到事务中途断连：已验证停库 503 和事务设计，但未在审计 INSERT 与幂等 INSERT 之间强制断连，标记未验证。
- 正式大数据容量：缺少批准的数据规模和指标目标，标记未验证。
- 全量回归若仍出现范围外既有单元测试、`CompetitorMonitor.vue` 静态分析或 Worker Windows `EPERM`，必须单列基线，不能把本页标记失败或伪装通过。
