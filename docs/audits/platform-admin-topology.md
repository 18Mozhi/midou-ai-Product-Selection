# `/platform-admin/topology` 逐页 UI、功能与链路审计

## 页面审计记录

1. 页面名称和路由：服务拓扑，`/platform-admin/topology`；平台后台 / 系统运维 / 服务拓扑。
2. 服务角色：具备 `platform:operate` 或 `platform:superadmin` 的平台运营管理员、平台超级管理员。平台安全管理员真实浏览器进入无权状态，直调接口为 403；匿名接口为 401。
3. 业务目标：在固定单台惠州宝塔主机边界内，汇总 API 心跳、监督进程、固定健康探测、Worker 调度与运行告警，给出可审计但不夸大为高可用或容量承诺的当前事实。
4. 当前截图：修复前桌面 [before-desktop.png](../../output/playwright/platform-admin-topology/before-desktop.png)、修复前 390px [before-mobile-390.png](../../output/playwright/platform-admin-topology/before-mobile-390.png)、修复前数据库失败 [before-database-failure.png](../../output/playwright/platform-admin-topology/before-database-failure.png)、真实会话过期 [before-session-expired.png](../../output/playwright/platform-admin-topology/before-session-expired.png)；修复后桌面 [after-desktop.png](../../output/playwright/platform-admin-topology/after-desktop.png)、修复后 390px [after-mobile-390.png](../../output/playwright/platform-admin-topology/after-mobile-390.png)、15 秒超时保留 [after-timeout-preserved.png](../../output/playwright/platform-admin-topology/after-timeout-preserved.png)、真实停库 503 保留 [after-database-failure-preserved.png](../../output/playwright/platform-admin-topology/after-database-failure-preserved.png)。
5. 可操作入口：刷新运行事实、失败后重新核验、查看全部 18 个队列策略、仅看运行与异常、进程最近失败、单队列调度策略、状态文件异常、运行告警技术详情、阻断项技术详情、精确业务对象链接、会话过期重新登录、面包屑、系统运维二级导航和平台导航。
6. 控件结果：逐项见“前端功能测试结果”；不存在“其他按钮正常”或“页面整体可用”的合并结论。
7. 接口：`GET /api/v1/platform/operations/topology`、`GET /api/v1/health/live`、`GET /api/v1/health/ready`、`GET /api/v1/health/available`、`GET /api/v1/health/nodes`。正常、额外查询参数、错误方法、匿名、无权限、并发、超时、数据库失败、返回结构、缓存和审计均有真实结果或自动化证据。
8. 数据表：`runtime_nodes`、`runtime_node_heartbeats`、`runtime_topology_views`、`runtime_process_restart_observations`、`runtime_health_endpoint_probes`、`platform_audit_events`；权限涉及 `user_sessions`、`platform_role_assignments`、`role_capabilities`、`authorization_decisions`。Worker 队列事实来自受控状态文件，不新建或修改业务表。
9. 权限与数据隔离：页面是平台全局运维视图，不按组织过滤；API 强制 `platform:operate` 并记录 actor/request/trace。响应秘密扫描未出现 password、cookie、token、secret、私钥、测试临时目录或生产绝对路径。
10. 正常状态：隔离 MySQL 5.7、Redis、Node API、Node Worker、Python Crawler 和 Vite 真实运行。`live`、`ready`、`available`、`nodes` 均返回 HTTP 200；停库恢复后页面回到 `ready`。`available` 当前正文诚实标记 `degraded`，因为故障演练产生过 Worker 状态告警，未把 HTTP 200误写成完全健康。
11. 空数据状态：真实 Worker 快照 `due_queue_count=0`、18 个队列均 `due=false`，主列表显示“当前没有等待、运行或异常队列”和“18 个空闲队列已收起”；节点完全为空的页面状态由 M08-01 E2E 覆盖，真实运行环境不伪造空节点。
12. 加载状态：首次无快照显示读取态；已有快照刷新不清空事实。数据库锁期间按钮显示“正在刷新…”，`disabled=true`、`aria-busy=true`，旧拓扑仍可见。
13. 接口失败状态：真实停止隔离 MySQL 后同一 GET 的最终响应为 503 `runtime_topology_dependency_unavailable`；页面保留上一快照、request_id 和重新核验入口。服务端未返回 SQL、连接参数或驱动错误。
14. 超时状态：真实对 `runtime_nodes` 加写锁让读取超过 15 秒，浏览器主动中止；页面保留旧拓扑并显示“读取超过 15 秒”。首次超时独立错误态由 E2E 合同覆盖。
15. 无权限状态：平台安全管理员真实浏览器显示“无权打开此页面”，路由守卫不装载拓扑；直接 GET 为 403 `permission_denied`。匿名 GET 为 401。共享权限 action_hint 对安全管理员仍有“组织”措辞偏差，见未修改问题。
16. 表单校验状态：本页无用户输入表单、上传或可变查询条件。接口不声明查询参数；额外 `unexpected=1` 被兼容忽略并返回 200。错误方法 POST 返回 404。
17. 重复提交状态：刷新是单请求控制器。真实数据库锁期间同步触发三次点击，浏览器只发起一条业务读取；`runtime_topology_views` 与 read audit 各只增加 1 条，request_id 各自唯一。接口层 503 的共享客户端可进行有界重试，这不等于并发刷新。
18. 刷新和返回状态：系统状态链接真实进入 `/platform-admin/status`，浏览器返回恢复 `/platform-admin/topology`；reload 后重新读取并回到 `ready`。多标签页各自真实读取且标题、页面状态一致。
19. 不同分辨率：1920×1080、1440×900、1280×800、390×844 的 `scrollWidth` 均等于视口宽度，无页面级横向溢出。390px 纵向高度约 4803px，已通过收起 18 个空闲队列显著降低长度，但运行事实本身仍较多。
20. UI 和交互问题：修复前桌面右栏被长队列撑出大块空白，移动端 18 条空闲队列占据主要篇幅；现改为单列事实流、异常优先队列和显式全部策略开关。共享 favicon 404 和共享移动底部导航覆盖风险不属于本页，未越权修改。
21. 功能问题：修复前刷新立即清空快照、没有超时、重复点击产生多次 GET/审计；空闲队列因轮询抖动显示“等待中”和虚假“实际调度延迟”；停库返回 500。当前均有代码、浏览器、接口和数据库证据。
22. 性能问题：本地小数据 12 并发均为 200，最大约 180ms；连续健康探测表在本次结束前有 783 条样本。本结果不能代表正式连接池、百万级历史或 50/100 并发容量，企业容量仍未验证。
23. 安全问题：页面只读、`Cache-Control: private, no-store`、请求/跟踪编号相关联；匿名 401、无权限 403、停库错误脱敏、响应秘密扫描通过。没有使用生产账号、生产数据、生产通知、真实第三方 Cookie 或不可逆操作。
24. 企业级缺失：没有正式容量指标与压测报告、外部进程级监控、跨主机高可用（且当前产品明确不宣称）、告警确认/抑制/升级闭环、健康探测历史钻取、保存视图和时间范围；页面不能替代宝塔原始日志与监控。
25. 具体优化建议：见“逐页面优化升级方案”；必须保留固定单机边界、真实心跳、监督进程、健康分位数、18 个队列完整策略、精确告警关联、request/trace 审计和宝塔唯一运维边界。

## 页面—功能—接口—数据库—权限—后台任务矩阵

| 页面功能            | 接口                           | 数据库/状态                           | 权限                 | 后台任务/依赖                        | 实际结果                                              |
| ------------------- | ------------------------------ | ------------------------------------- | -------------------- | ------------------------------------ | ----------------------------------------------------- |
| 单机拓扑读取        | GET operations topology        | nodes、heartbeats、views、audit       | `platform:operate`   | Node API、MySQL                      | 200，写一条读取事实与审计                             |
| API/Worker 进程监督 | 同上                           | restart observations + 监督器状态文件 | 同上                 | Node supervisor、Worker              | 显示真实 PID、就绪时间、重启次数与趋势                |
| 健康探测分位数      | 同上；事实源为四个公共健康接口 | health endpoint probes                | 同上；健康源公开脱敏 | API 内定时探测、MySQL、Redis、Worker | live/ready/available 固定端点，P50/P95/P99/超时数可见 |
| 队列调度摘要        | 同上                           | Worker scheduler 状态文件             | 同上                 | Node Worker、18 队列                 | 真实 `due=0`，空闲不再标等待或延迟                    |
| 全部队列策略        | 无新增请求                     | 同一快照                              | 同上                 | 18 个 Worker 队列                    | 展开 18 条，全部显示空闲/未进入等待；收起恢复 0 条    |
| 运行告警/阻断       | GET operations topology        | 当前拓扑、告警精确关联                | 同上                 | API/Worker/探测                      | 技术详情默认折叠，不返回任务 payload 或秘密           |
| 刷新/重新核验       | GET operations topology        | views + audit                         | 同上                 | API/MySQL                            | 单飞、15 秒中止、失败保留、恢复重读                   |
| 权限拒绝            | GET operations topology        | 会话、角色、能力、授权决定            | 安全管理员缺能力     | 无业务后台任务                       | 浏览器守卫；API 403，匿名 401                         |
| 公共健康            | GET live/ready/available/nodes | nodes/依赖/Worker 状态                | 公开脱敏             | API、MySQL、Redis、Worker            | 均 HTTP 200；available 正文当前为 degraded            |

## 前端功能测试结果

| 编号        | 功能/入口        | 操作                           | 实际结果                                      | 结论                   |
| ----------- | ---------------- | ------------------------------ | --------------------------------------------- | ---------------------- |
| TOPO-FE-001 | 页面访问         | 运营管理员打开路由             | 标题、面包屑、真实拓扑出现                    | 通过                   |
| TOPO-FE-002 | 刷新运行事实     | 单击                           | 读取当前 MySQL/状态文件并更新观测时间         | 通过                   |
| TOPO-FE-003 | 重复刷新         | 数据库锁期间同步触发三次       | 单飞；按钮 busy，views/audit 各只增 1         | 通过                   |
| TOPO-FE-004 | 后台刷新         | 延迟期间查看页面               | 旧快照、进程、探测和队列摘要继续可见          | 通过                   |
| TOPO-FE-005 | 15 秒超时        | 锁表超过 15 秒                 | 浏览器中止、旧快照和超时提示保留              | 通过                   |
| TOPO-FE-006 | 数据库失败       | 真实停止隔离 MySQL 后刷新      | 最终 503，旧事实、request_id 和恢复入口保留   | 通过                   |
| TOPO-FE-007 | 重新核验         | 重启 MySQL 后点击              | 提示消失，页面回到 `ready`                    | 通过                   |
| TOPO-FE-008 | 空闲队列摘要     | `due_queue_count=0`            | 显示 0 等待、0ms 最长延迟、18 个空闲收起      | 通过                   |
| TOPO-FE-009 | 查看全部队列策略 | 点击开关                       | 展开 18 条；18 个“空闲/未进入等待/不累计老化” | 通过                   |
| TOPO-FE-010 | 仅看运行与异常   | 点击开关                       | 收回 18 条，异常优先主列表恢复为空            | 通过                   |
| TOPO-FE-011 | 调度策略         | 展开单队列 details             | 显示真实并发、超时、重试、连续失败            | 通过（E2E + 真实 DOM） |
| TOPO-FE-012 | 状态文件异常     | 展开 details                   | 展示受控错误摘要，不改变业务任务结果          | 通过                   |
| TOPO-FE-013 | 进程最近失败     | 有失败时展开                   | 仅在真实 `last_failure` 存在时出现            | 通过（条件渲染合同）   |
| TOPO-FE-014 | 告警技术详情     | 展开 details                   | 稳定告警码/根因码可见，默认折叠               | 通过                   |
| TOPO-FE-015 | 阻断技术详情     | 有阻断时展开                   | 稳定阻断码可见                                | 通过（E2E 状态）       |
| TOPO-FE-016 | 精确业务对象     | 告警存在 allowlist 关联时点击  | 只为精确 href 渲染链接，不猜测对象            | 通过（服务/组件合同）  |
| TOPO-FE-017 | 首次加载         | 新标签页打开                   | 读取态后进入 ready                            | 通过                   |
| TOPO-FE-018 | 节点空状态       | E2E 返回空节点                 | 显示“没有当前节点可绘制”                      | 通过（E2E）            |
| TOPO-FE-019 | 首次失败/超时    | E2E 返回错误或延迟             | 独立错误态和重新核验入口                      | 通过（E2E）            |
| TOPO-FE-020 | 会话过期         | 撤销真实本地会话               | 清空拓扑，显示重新登录                        | 通过                   |
| TOPO-FE-021 | 无权限           | 安全管理员直达                 | 显示路由权限拒绝，不装载拓扑                  | 通过                   |
| TOPO-FE-022 | 面包屑/二级导航  | 查看平台后台/系统运维/服务拓扑 | 层级与当前页一致                              | 通过                   |
| TOPO-FE-023 | 页面联动         | 点系统状态后浏览器返回         | `/status` → back → `/topology`                | 通过                   |
| TOPO-FE-024 | 页面刷新         | reload                         | 重新读取并回到 ready                          | 通过                   |
| TOPO-FE-025 | 多标签页         | 新标签打开同一路由             | 独立读取，标题和 ready 状态一致               | 通过                   |
| TOPO-FE-026 | 键盘焦点         | Tab/程序聚焦刷新按钮           | 按钮可获取焦点，焦点样式由 CSS 提供           | 通过                   |
| TOPO-FE-027 | 四档分辨率       | 1920/1440/1280/390             | 全部无页面级横向溢出                          | 通过                   |
| TOPO-FE-028 | 控制台           | 干净授权会话正常加载           | 仅共享 favicon 404；本页无新增错误            | 带基线通过             |

搜索、筛选、重置、排序、分页、全选、批量操作、新增、编辑、复制、删除、上传、下载、导入和导出不是该实时只读拓扑页的既有能力，标记“不适用”，没有用不存在的控件冒充通过。暂停、恢复、取消和失败重跑属于任务/采集控制页；本页只观察事实，不写任务状态。

## 接口清单及逐接口测试

### `GET /api/v1/platform/operations/topology`

| 场景            | 实际结果                                                                         | 结论               |
| --------------- | -------------------------------------------------------------------------------- | ------------------ |
| 正常请求        | 200，顶层 `data/request_id/trace_id`                                             | 通过               |
| 参数缺失        | 无必填查询参数，200                                                              | 通过               |
| 额外查询参数    | `unexpected=1` 被兼容忽略，200                                                   | 通过               |
| 参数类型/边界   | 无请求参数                                                                       | 不适用             |
| 错误方法        | POST 返回 404 JSON                                                               | 通过               |
| 未登录          | 401                                                                              | 通过               |
| 无权限          | 403 `permission_denied`                                                          | 通过               |
| 跨租户          | 平台全局接口，不接受组织/工作区参数；不能用参数绕过                              | 不适用/边界明确    |
| 重复页面点击    | 单飞，锁期间三次触发只形成一条读取                                               | 通过               |
| 12 并发接口请求 | 12 个 200，最大约 180ms                                                          | 通过，仅本地小数据 |
| 浏览器超时      | 15 秒主动中止，旧快照保留                                                        | 通过               |
| 数据库异常      | 真实停库最终 503 `runtime_topology_dependency_unavailable`                       | 通过               |
| 第三方失败      | 读取不调用第三方                                                                 | 不适用             |
| 返回结构        | 稳定 data/request/trace；`Cache-Control: private, no-store`                      | 通过               |
| 状态码/错误码   | 200/401/403/503/404 各有实测                                                     | 通过               |
| 分页/排序/筛选  | 当前快照，无此类参数                                                             | 不适用             |
| 幂等性          | GET 不改业务数据；每次授权读取独立审计                                           | 通过               |
| 日志和审计      | `runtime_topology_views` 与 `platform.runtime_topology.read` request_id 一一对应 | 通过               |
| 返回秘密扫描    | 未命中密码、Cookie、Token、secret、私钥和绝对运行路径                            | 通过               |

### 公共健康接口

| 接口                           | 实际结果                                     | 边界                           |
| ------------------------------ | -------------------------------------------- | ------------------------------ |
| `GET /api/v1/health/live`      | 200 `status=ok`                              | 只证明 API 进程存活            |
| `GET /api/v1/health/ready`     | 200，MySQL/Redis/supervisor available        | 同步依赖就绪                   |
| `GET /api/v1/health/available` | 200，API/Worker available；正文当前 degraded | 不把 HTTP 200 冒充全链完全健康 |
| `GET /api/v1/health/nodes`     | 200，single_host、1 API、0 stale             | 脱敏单机节点摘要               |

## Worker、Crawler 与联合流程证据

- Worker 真实进程 `page50-worker` 启动并注册 18 个队列；当前 `active_runs=0`、`due_queue_count=0`、`max_queue_delay_ms=0`。故障演练停库期间日志真实出现 `dependency_failed`，恢复后调度继续运行。
- Python Crawler 真实进程 `page50-crawler` 启动并每约 5 秒向本机内部 acquire 接口领取作业；空队列返回 204。停库期间出现受控 `internal_error`，恢复后继续轮询。本页不以 204 空轮询冒充 Amazon/1688 登录、解析或入库完整生命周期。
- 连续探测真实写入 `runtime_health_endpoint_probes`；本次结束前 783 条，live/ready/available 各 261 条，包含 12 条真实超时样本。API 与 Worker 重启观测共 16 条。
- 联合链路：运营管理员登录 → 路由权限通过 → Web GET → Node API 鉴权 → MySQL 读取心跳/趋势/探测并写 view/audit → API 读取监督器与 Worker 快照 → 页面绘制真实单机拓扑/队列/告警 → 数据库锁触发 15 秒保留 → 真实停库触发 503 → Worker/Crawler 记录依赖失败 → 重启 MySQL → 页面重新核验回到 ready → 后台轮询恢复。
- 前置条件：仅隔离本地账号、隔离库和本地端口；未使用生产账号、生产数据、真实支付、真实通知、第三方 Cookie、验证码或不可逆操作。
- 最终结论：本页只读拓扑联合链路通过；真实第三方采集生命周期、宝塔生产重启与正式容量仍是阻塞/未验证项。

## 问题记录

### TOPO-P1-001 刷新丢失最后可信事实且可重复请求（已修复）

- 所属页面/模块：`/platform-admin/topology` Web 读取生命周期；类型/等级：核心运维可靠性，P1。
- 问题描述：修复前每次刷新先清空整页进入 loading，没有超时和迟到响应保护；三次快速点击产生三条 GET、三条 view 和三条审计。
- 复现步骤：成功读取拓扑 → 锁住 `runtime_nodes` → 快速点击刷新三次 → 等待超过 15 秒。
- 预期结果：单请求、按钮忙态、旧事实持续可见、15 秒中止并可重试。
- 实际结果：修复前持续 loading 且可重复写审计；修复后 `disabled/aria-busy=true`、旧快照可见，三次触发只新增一条 view/audit，15 秒后出现保留提示。
- 截图或日志证据：修复前长时间 loading；[after-timeout-preserved.png](../../output/playwright/platform-admin-topology/after-timeout-preserved.png)；MySQL 计数前后差 1。
- 涉及文件/接口/数据：`RuntimeTopologyCenter.vue`；GET operations topology；`runtime_topology_views`、`platform_audit_events`。
- 影响范围：事故期间核心拓扑事实、审计准确性、重复请求压力。
- 修复建议：单请求控制器、15 秒 AbortController、序列保护、卸载取消、刷新失败保留最后成功快照，401/403 必须清空。
- 验收标准：重复触发只形成一个活动读取；已有快照在超时/503 时可见；401/403 不可见；当前已满足。

### TOPO-P2-002 数据库故障与 OpenAPI 503 合同不一致（已修复）

- 所属页面/模块：runtime topology API；类型/等级：接口可靠性，P2。
- 问题描述：修复前真实停库返回 500，OpenAPI 声明依赖不可用应为 503，调用方无法稳定识别可恢复故障。
- 复现步骤：停止隔离 MySQL → 请求 GET operations topology。
- 预期/实际：预期 503 稳定错误码且脱敏；修复前 500。修复后最终响应 503 `runtime_topology_dependency_unavailable`，request_id 与 trace_id 相等。
- 截图或日志证据：[before-database-failure.png](../../output/playwright/platform-admin-topology/before-database-failure.png)、[after-database-failure-preserved.png](../../output/playwright/platform-admin-topology/after-database-failure-preserved.png)、真实响应头和 272 字节 JSON。
- 涉及文件/接口/数据：`runtime-topology-routes.ts`、OpenAPI；GET operations topology；读取 MySQL 表。
- 影响范围：运维自动化、故障恢复提示、错误监控分类。
- 修复建议：仅把 MySQL 连接类错误映射为 503，不吞掉编程错误，不输出原始错误。
- 验收标准：真实停库 503、无 SQL/主机/账号/驱动错误，恢复后 200；当前已满足。

### TOPO-P2-003 空闲队列被标成等待并显示虚假延迟（已修复）

- 所属页面/模块：Worker 队列事实展示；类型/等级：数据语义，P2。
- 问题描述：修复前 `due=false` 但 `queue_delay_ms` 有轮询抖动时，18 个空闲队列均显示“等待中”和“实际调度延迟”。
- 复现步骤：真实 Worker 无待处理任务 → 页面查看 18 个队列。
- 预期/实际：预期 `due=false` 为“空闲/未进入等待队列”，不累计老化；修复前误报等待。修复后默认收起 18 个空闲队列，展开后 18 条语义一致且 0 个“等待中”。
- 截图或日志证据：前后桌面/移动截图；真实 DOM 18 idle、18 not due、18 no aging、0 waiting。
- 涉及文件/接口/数据：`RuntimeTopologyCenter.vue`；GET operations topology；Worker 状态文件，不改数据库。
- 影响范围：值班人员误判队列积压、延迟和饥饿风险。
- 修复建议：等待、老化和饥饿必须以 `due=true` 为前置；历史累计失败不能等同当前异常，使用连续失败/熔断/卡死等当前信号。
- 验收标准：due=0 时等待=0、最长延迟=0，空闲不显示实际延迟；当前已满足。

### TOPO-P3-004 长队列导致桌面空栏和移动信息过载（已修复）

- 所属页面/模块：拓扑布局与队列列表；类型/等级：UI/信息效率，P3。
- 问题描述：右侧运行边界随 18 条队列被拉伸，形成大块空白；390px 用户必须滚过全部空闲策略才能查看告警和阻断。
- 复现步骤：桌面和 390px 打开无待处理任务的真实页面。
- 预期/实际：预期异常优先、完整策略仍可访问；修复前长卡墙。修复后单列事实流、空闲队列收起并提供显式开关。
- 截图或日志证据：before/after desktop 与 mobile。
- 涉及文件/接口/数据：`runtime-topology.css`、`RuntimeTopologyCenter.vue`；不改 API/表。
- 影响范围：桌面扫描效率、移动端告警到达路径。
- 修复建议：保留事实密度，以异常优先和按需披露缩短路径，不删 18 个队列策略。
- 验收标准：四档无横向溢出；空闲队列默认 0 条、可展开 18 条；当前已满足。

### TOPO-P3-005 共享无权限 action hint 组织措辞不适用于平台页（未修改）

- 所属页面/模块：共享鉴权错误文案；类型/等级：易用性，P3。
- 问题描述：平台安全管理员的直接 API 403 action_hint 提示“重新选择仍有成员资格的组织”，但本接口是平台全局能力。
- 复现步骤：安全管理员直调 operations topology。
- 预期/实际：预期申请 `platform:operate` 或联系平台管理员；实际为组织成员资格提示。
- 截图或日志证据：安全管理员真实 API 403；路由守卫自身文案正确。
- 涉及文件/接口/数据：共享 auth middleware/error envelope；无业务数据变化。
- 影响范围：多个平台级受保护接口；不是 topology 单页专属。
- 修复建议：共享鉴权批次按权限域选择 action_hint，不能在单页覆盖统一错误。
- 验收标准：平台全局 403 不再要求切组织，组织域接口原提示保持；本批次范围外，未验证。

### TOPO-P3-006 共享 favicon 404（未修改）

- 所属页面/模块：Web 壳层静态资源；类型/等级：控制台洁净度，P3。
- 问题描述：干净授权会话打开页面产生一条 `/favicon.ico` 404。
- 复现步骤：新浏览器上下文加载 topology → 查看 console。
- 预期/实际：预期 0 非预期控制台错误；实际仅共享 favicon 404，本页 API 与渲染无错误。
- 截图或日志证据：Playwright clean session console。
- 涉及文件/接口/数据：共享 HTML/静态资产；与 topology API/数据库无关。
- 影响范围：全站控制台和监控噪声。
- 修复建议/验收：共享壳层批次提供有效图标或移除无效引用；全站首次加载不再 404。本页禁止越权修改。

### TOPO-P4-007 企业容量与长期保留未验证

- 所属页面/模块：拓扑读取、探测聚合、审计写入；类型/等级：性能容量，P4。
- 问题描述：只有本地小数据 12 并发与 783 个探测样本，没有正式容量目标、长期表规模或 50/100 并发 p95/p99。
- 复现步骤：当前缺少批准的数据规模和性能阈值。
- 预期/实际：预期给出连接池、聚合 SQL、索引、审计增长和保留清理的容量报告；实际未验证。
- 截图或日志证据：12 并发均 200、最大约 180ms，仅能证明当前隔离小数据。
- 涉及文件/接口/数据：拓扑 service/repository；五张运行事实/审计表。
- 影响范围：长期运行后的运维页时延和表增长。
- 修复建议：用脱敏数据完成 30/90 天样本、50/100 并发、p95/p99、错误率、慢 SQL、连接池和清理任务压测。
- 验收标准：先锁定指标再压测，未达标前不得宣称企业容量通过。

## 逐页面优化升级方案

- 页面定位：固定单服务器生产边界的实时运维总览，不是多节点编排器、任务控制台或原始日志浏览器。
- 使用者：平台运营管理员和超级管理员；安全管理员、组织管理员和普通成员保持拒绝。
- 核心任务：确认单机运行门、API/Worker 进程、固定健康探测、当前队列积压/异常、运行告警与阻断，并携带 request_id 复核。
- 当前问题：本批已解决刷新事实丢失/重复请求/无超时、停库错误码、空闲队列假等待和低效布局；共享鉴权提示、favicon、正式容量与生产宝塔重验仍缺失。
- 应保留的功能：单机和无高可用承诺、真实节点/构建/心跳、监督 PID/重启趋势、三端点分位数、18 个完整队列策略、状态文件异常、精确告警/阻断、request_id。
- 应删除或合并的内容：不删除能力；默认合并空闲队列为摘要，历史累计失败不能单独把当前队列放入异常主列表，技术码继续折叠。
- 信息架构：页面定位与主操作 → 单机运行门 → 核心指标 → 拓扑/进程/探测/调度事实 → 运行边界 → 告警 → 阻断 → 观测与 request_id。
- 新页面布局：桌面和移动均采用单列因果顺序；不再让短运行边界卡与长队列列表互相拉伸；异常主列表优先，完整策略按需展开。
- 页面区域划分：主操作只保留刷新；恢复操作只在失败提示出现；队列策略开关与调度标题相邻；告警和阻断位于全部运行事实之后。
- 主要操作：刷新运行事实、失败后重新核验。必须单飞、有界、保留快照，并明确最后观测时间。
- 次要操作：查看全部/仅看异常、调度策略、状态文件异常、最近失败、告警/阻断技术详情和精确业务对象跳转。
- 表格字段：本页不使用传统表格；事实卡字段固定为节点身份/状态/心跳、进程 PID/重启/就绪、探测分位数/超时/可用率、队列优先级/状态/老化/策略。
- 筛选条件：当前没有筛选。若未来增加，只允许端点/队列/时间范围的服务端真实边界并写 URL，不能只筛当前快照后宣称历史检索。
- 表单字段：无编辑表单。未来告警确认若出现，必须单独设计原因、幂等、权限和审计，不应塞进当前只读 GET。
- 弹窗和抽屉：当前不需要；技术详情用轻量 details。未来移动端队列策略若超过可读长度，可用具名抽屉，但不能隐藏异常主状态。
- 加载状态：首次读取态；已有快照后台刷新，按钮 busy/disabled，旧事实不闪烁。
- 空白状态：节点为空说明等待真实心跳；队列为空说明没有等待/运行/异常，并保留查看全部策略入口。
- 错误状态：首次错误显示稳定状态和重新核验；已有事实的超时/503用行内提示保留快照；数据库错误不泄露细节。
- 无权限状态：路由守卫阻止装载；API 401/403；不能用缓存快照绕过权限。
- 成功和失败反馈：成功由观测时间/request_id/state 更新确认；失败由稳定错误码、action hint、request_id 和保留说明确认。
- 动效：仅按钮忙态、轻量展开和脉冲加载；运维数值不自动跳动、不用装饰动画，不以颜色代替文字。
- 响应式行为：1920/1440/1280 保持紧凑单列；390px 纵向堆叠，空闲队列默认收起；共享底部导航安全区另行治理。
- 权限差异：运营/超级管理员可读；安全管理员不能因角色名称自动获得运维权；业务对象下钻继续服从目标页权限。
- 与其他页面联动：系统状态提供更高层健康摘要，链路日志用于 request/trace 排障，采集调度/Redis/MySQL 页面负责各自专题；浏览器返回必须回到拓扑。
- 涉及接口：operations topology 与四个公开健康 GET；不新增路由，不改变字段。
- 数据状态变化：授权 GET 只写一条 topology view 和一条平台审计；不修改节点、队列、任务、Crawler、通知或业务对象。
- 验收标准：真实全栈启动；正常/空/加载/超时/503/恢复/会话过期/无权限均有证据；刷新单飞；due=false 不显示等待/延迟；18 个策略仍可访问；四档无溢出；响应无秘密；数据库 view/audit 一一对应；构建、定向测试、E2E、路由产物、模块验证通过。

## 验证门禁结果

- Web 类型检查、API 构建、Web 生产构建、格式门禁和路由产物校验通过。
- `tests/m08-01/single-server-runtime.test.mjs` 13/13 通过，包含数据库故障 503、单请求/15 秒/空闲队列语义和既有单机边界。
- M08-01 Playwright 在单 worker 独立复跑 6/6 通过；默认双 worker 首次复跑曾因共享测试服务与连续 reload 时序出现 4/6、随后串行全部通过。该结果证明功能合同，不作为正式并发容量结论。
- 全量单元测试 170/180 通过；10 项为此前已经记录的范围外基线，涉及设计质量、`PlatformAccountCenter.vue` 行数、`/platform-admin/data` 状态详情漂移、共享弹窗、生产验收路径、Provider 熔断隔离、共享主题 CSS 和 UI 治理。本页定向 13 项全部通过。
- 全量静态分析仅在范围外 `CompetitorMonitor.vue` 报“异步回调可能产生未观测 Promise”；本批未修改该文件。
- `verify:module M08-01` 被前置模块 `M07-06` 的既有状态阻断，返回 `dependency_blocked`；不能标记为模块门禁通过。

## 无法测试项与阻塞项

- 真实生产账号、生产数据、真实通知、支付、不可逆操作：按限制未使用，不能标记通过。
- 真实 Amazon/1688 登录、Cookie 过期、验证码、代理、页面结构变化、解析、去重、清洗、入库、暂停、恢复、取消、失败重跑、部分成功、告警、资源释放和服务重启恢复：本页只读运行事实，不能用来源注册或 acquire 204 冒充完整生命周期，继续列为采集专项阻塞。
- 宝塔生产重启、真实生产目录权限和线上反向代理：本批只使用隔离本地全栈，没有改生产配置，也没有重新执行生产演练；沿用的历史证据不能冒充本次实测。
- 数据库事务中途断连：已真实验证连接拒绝 503，但没有在 view INSERT 与 audit INSERT 之间强制断连；事务原子性由定向单元测试覆盖，真实中途断连未验证。
- 正式大数据容量、长期审计/探测保留与告警峰值：缺少批准的数据规模、指标和独立压测环境，标记未验证。
- 共享平台 403 action_hint、favicon 404 和移动底部导航安全区：范围外既有问题，本页未修改。
- 全量回归若仍出现用户已接受的范围外既有单元测试、`CompetitorMonitor.vue` 静态分析或 Worker Windows `EPERM`，必须单列基线，不能把本页伪装为无基线通过。
