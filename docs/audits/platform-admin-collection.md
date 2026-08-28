# `/platform-admin/collection` 页面 UI 与功能审计记录

## 页面定位与关联矩阵

| 项目          | 实际结果                                                                                                                                                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 页面 / 路由   | 采集任务 / `/platform-admin/collection`                                                                                                                                                                                                             |
| 使用者 / 权限 | 平台运营管理员、平台超级管理员；页面及 3 个接口均由服务端校验 `collection:replay`。未登录 401，平台安全管理员真实登录后 403                                                                                                                         |
| 业务目标      | 读取全平台采集任务、子查询覆盖、尝试、事件和死信，按事实定位阻塞原因，并在确认依赖恢复后安全重放单条死信                                                                                                                                            |
| 页面组件      | `CollectionTaskCenter.vue`、`ResponsiveDataView.vue`、`UiStatePanel.vue`、`ConfirmDialog.vue`、平台管理 Shell                                                                                                                                       |
| 接口          | `GET /api/v1/platform/collection/tasks`；`GET /api/v1/platform/collection/tasks/{taskId}`；`POST /api/v1/platform/collection/tasks/{taskId}/replay`                                                                                                 |
| 数据关系      | `organizations` / `workspaces` → `collection_tasks` → `collection_subqueries` / `collection_task_attempts` / `collection_task_events` / `collection_task_outbox` / `collection_dead_letters` / `collection_task_operations`；子查询关联 `providers` |
| 后台任务      | Node Worker 领取业务任务并维护租约、重试、覆盖、事件、Outbox 与死信；Python Crawler 只领取浏览器作业；Redis 只做范围化协调，MySQL 5.7 是事实源                                                                                                      |
| 页面联动      | 登录/验证码进入凭证档案；robots/页面变化进入来源设置；终止失败/部分完成进入采集总览；高级运行记录进入浏览器运行时                                                                                                                                   |

## 当前截图与证据边界

- 修改前全量桌面：[collection-1440x900.png](../../output/playwright/platform-admin-collection/before/collection-1440x900.png)
- 修改前详情：[dead-letter-detail-1440x900.png](../../output/playwright/platform-admin-collection/before/dead-letter-detail-1440x900.png)
- 修改后 1440 桌面：[collection-1440x900.png](../../output/playwright/platform-admin-collection/after/collection-1440x900.png)
- 修改后 1920 桌面：[collection-1920x1080.png](../../output/playwright/platform-admin-collection/after/collection-1920x1080.png)
- 修改后 1024 桌面：[collection-1024x768.png](../../output/playwright/platform-admin-collection/after/collection-1024x768.png)
- 修改后 390 页面：[collection-390x844.png](../../output/playwright/platform-admin-collection/after/collection-390x844.png)
- 修改后 390 详情：[task-detail-390x844.png](../../output/playwright/platform-admin-collection/after/task-detail-390x844.png)
- 15 秒超时保留事实：[timeout-preserved.png](../../output/playwright/platform-admin-collection/after/timeout-preserved.png)
- MySQL 停机保留事实：[mysql-unavailable-preserved.png](../../output/playwright/platform-admin-collection/after/mysql-unavailable-preserved.png)
- 死信重放成功：[replay-success.png](../../output/playwright/platform-admin-collection/after/replay-success.png)

证据只使用隔离本地 MySQL 5.7、Redis、合成账号和合成任务；不含密码、Cookie、Token、密钥或完整隐私数据。真实 Amazon、1688 等第三方成功采集不在本页伪造。

## 页面所有入口与逐项结果

| 功能 / 控件                              | 实际结果                                                                                                       | 结论                   |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 页面访问、标题、面包屑                   | 平台运营账号真实登录后 200，标题与路由一致；平台安全账号接口 403                                               | 通过                   |
| 刷新任务                                 | 单击读取真实接口；执行中按钮禁用，函数拒绝重复刷新                                                             | 通过                   |
| 分页                                     | 61 条初始任务真实返回 50 + 11；上一页/下一页、区间、页数和 URL `page=2` 一致                                   | 通过                   |
| 当前页筛选                               | 用真实任务 UUID 筛到 1 条；无匹配显示“当前筛选没有任务记录”；控件明确写“筛选当前页”                            | 通过                   |
| 状态筛选                                 | 19 个持久化状态全部可选；选择 `dead_letter`、`blocked_captcha` 均发起服务端精确筛选并同步 URL                  | 通过                   |
| 固定排序                                 | API 按 critical/high/normal/low，再按更新时间与 ID 排序；首批真实结果为 critical                               | 通过；无用户自定义排序 |
| 指标卡                                   | 处理、部分完成、受阻/死信、可用结果均明确为当前页合计，不冒充全库指标                                          | 通过                   |
| 查看详情                                 | 读取真实子查询、尝试、事件和死信；业务标题短 ID，完整标识只在技术详情                                          | 通过                   |
| 详情 URL / 刷新 / 返回                   | URL 写入 `task`；刷新恢复同一详情；Escape、关闭和返回移除 `task`                                               | 通过                   |
| 键盘与可访问性                           | 具名 dialog、`aria-modal`、遮罩、关闭按钮初始焦点、Tab 约束、Escape、焦点返回、44px 关闭入口                   | 通过                   |
| 详情失败                                 | 注入 503 时先清空旧任务，显示独立失败和重试；恢复后重新读取，未发生数据错配                                    | 通过（故障注入）       |
| 刷新失败 / 离线                          | 已有 11 条或 50 条事实均保留，显示 live alert，恢复后原地重试成功                                              | 通过（故障注入）       |
| 15 秒超时                                | 挂起读取在约 15.2 秒终止，保留 50 条事实并恢复按钮                                                             | 通过（计时证据）       |
| MySQL 异常                               | 实际停止隔离 MySQL 后读取无法完成，页面 15 秒截止且保留 50 条；重启 MySQL 5.7 后原地恢复                       | 通过（真实依赖停机）   |
| 空数据 / 首次失败                        | 空数组、403、503 分别显示 empty、forbidden、blocked，不把异常伪装为空                                          | 通过（自动化）         |
| 长文本 / 异常数据                        | 长缺失字段无页面级横向溢出；详情技术 ID `overflow-wrap`                                                        | 通过                   |
| 桌面分辨率                               | 1920×1080、1440×900、1024×768 均无页面级横向溢出                                                               | 通过                   |
| 390px                                    | 表格能力转为摘要卡，50 条可读、分页可达；完整详情对话框可滚动且无横向溢出                                      | 通过                   |
| 人工重放表单                             | 少于 2 字按钮禁用，最多 500 字，显示字数和不可绕过历史说明                                                     | 通过                   |
| 人工重放确认                             | 必须输入原因，再在确认框输入“确认重放”；一次真实 POST 创建新任务并更新 URL                                     | 通过                   |
| 重复 / 并发重放                          | UI 保存中拒绝重复；相同 Idempotency-Key 两个并发请求均 200，返回同一结果任务                                   | 通过                   |
| 重放历史                                 | MySQL 证明旧任务 `manually_replayed`、死信 `replayed`、原因保留、1 次尝试和 5 个事件仍在；新任务保留来源子查询 | 通过                   |
| Worker 联合流程                          | 新任务先以 scheduled 返回页面，Node Worker 真实领取后因本地外部依赖不足进入 `retry_scheduled`，未伪造采集成功  | 通过（受阻生命周期）   |
| 浏览器运行时 / 来源 / 凭证联动           | 链接目的地与失败类型一致；本批不打开或修改相邻页面                                                             | 通过（导航合同）       |
| 上传、下载、导入、导出、复制、删除、批量 | 本页没有这些能力；死信重放是保留历史的单条动作，不提供硬删除或批量绕过                                         | 不适用                 |

## 接口真实结果

| 场景                          | 实际结果                                                                                               | 结论              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------- |
| 列表正常 / 默认参数           | 200；显式 50 条，总数 62；缺省参数返回默认 20；`private, no-store`                                     | 通过              |
| 分页边界                      | `page_size=1/100` 为 200；`101` 和 `page=abc` 为 400 `collection_pagination_invalid`                   | 通过              |
| 状态筛选 / 非法状态           | `blocked_captcha` 4 条；非法值 400 `collection_status_invalid`                                         | 通过              |
| 详情正常 / 非法 UUID / 不存在 | 200；400 `collection_task_id_invalid`；404 `collection_task_not_found`                                 | 通过              |
| 重放原因缺失 / 边界           | 缺失或少于 2 字为 400 `collection_replay_reason_invalid`；UI 限制 500 字，服务端同样限制               | 通过              |
| Origin / Idempotency-Key      | 浏览器同源请求通过；缺少 Idempotency-Key 为 400 `idempotency_key_required`；OpenAPI 保留同源合同       | 通过              |
| 未登录 / 无权限               | 无会话真实 401；平台安全管理员真实登录后 403                                                           | 通过              |
| 重复与并发                    | 修复前同 Key 并发为 200 + 409；修复后两个 200 且结果 UUID 相同；顺序重放也返回同一结果                 | 通过（P1 已修复） |
| 跨组织                        | 真实 M03-05 脚本创建第二组织任务，按 organization/workspace 查询不泄露范围外任务                       | 通过              |
| 返回结构 / 关联 ID            | 所有成功与失败响应带 request_id；列表/详情成功为 `private, no-store`；无租约令牌、凭证或 `target_json` | 通过              |
| 数据库 / Redis / 日志         | MySQL 5.7.44、utf8mb4、业务账号；真实 Redis 范围协调；API/Worker 日志可按 request/trace 关联           | 通过              |

`scripts/verify-collection-task-live.mjs` 真实输出：成功覆盖、重试、限流、登录阻塞、死信、过期租约、协调冲突、顺序与并发幂等、组织/工作区隔离、23 个关联事件和清理均 passed。

## 问题记录

### P38-01（P1）任务总数超过 50 后不可达

- 所属页面 / 类型：采集任务 / 核心数据可达性。
- 复现：准备 61 条任务，打开页面；修改前接口显示总数 61，但 DOM 只有 50 行且无翻页控件。
- 预期 / 实际：应能到达全部任务；修改前末 11 条无法从 UI 打开、筛选或重放。
- 证据：修改前截图和 DOM 50 行；修改后第 1/2 页 50 条、第 2/2 页 11 条。
- 涉及文件 / 接口 / 数据：`CollectionTaskCenter.vue`、CSS、E2E；列表 GET；`collection_tasks`。
- 影响：任务监控、失败排查和死信恢复遗漏。
- 修复 / 验收：增加服务端分页控制、总数/区间/URL 状态；61 条均可达且刷新保留页码，已通过。

### P38-02（P1）相同幂等键并发重放返回 409

- 所属页面 / 类型：死信重放 / 幂等与并发。
- 复现：对同一 open 死信并发提交相同 actor、route、Idempotency-Key 和原因。
- 预期 / 实际：应返回同一结果；修改前为 200 + 409 `collection_replay_not_allowed`。
- 证据：修复前真实接口结果；修复后两个 200、同一结果 UUID；真实 MySQL 脚本通过。
- 涉及文件 / 接口 / 数据：`mysql-collection-task-repository.ts`、验证脚本、OpenAPI；重放 POST；task/dead-letter/operation/event 表。
- 影响：用户双击、网络重传或并发代理可能把已成功动作显示为失败。
- 修复 / 验收：任务锁后对幂等操作做当前读，已提交则返回既有结果；只创建一个新任务，已通过。

### P38-03（P2）详情没有可恢复 URL、失败可能保留旧上下文

- 所属页面 / 类型：任务详情 / 状态一致性与可访问性。
- 复现：打开任务后刷新，或先成功打开 A 再令 B 详情 503。
- 预期 / 实际：应恢复当前详情且失败不显示 A；修改前 URL 不变，刷新丢失详情，错误只写列表提示。
- 证据：修改前 URL、无 dialog/focus；修改后 task 深链、刷新、失败无旧 h3、Escape 与焦点证据。
- 涉及：页面组件、详情 GET；不改数据库。
- 修复 / 验收：task query、请求序列/AbortController、先清旧详情、具名对话框和焦点生命周期，已通过。

### P38-04（P2）刷新无页面级截止且会覆盖既有事实

- 所属页面 / 类型：任务列表 / 可靠性。
- 复现：成功读取后离线、503、挂起或停止隔离 MySQL，再点击刷新。
- 预期 / 实际：应保留上次验证事实并明确失败；修改前直接切换全页状态且无截止时间。
- 证据：离线、503、15.2 秒计时、MySQL 停机与恢复截图。
- 涉及：页面组件与 CSS；列表 GET；只读任务表。
- 修复 / 验收：15 秒终止、刷新互斥、旧数据保留和 inline alert；四类异常均恢复，已通过。

### P38-05（P3）状态入口不完整且详情渲染多余字符

- 所属页面 / 类型：筛选与 UI 完整性。
- 复现：修改前下拉只有 5 个状态；打开子查询详情可见独立 `>`。
- 预期 / 实际：所有真实状态应可定位，模板不应输出标记残留。
- 证据：修改前快照和详情文本；修改后 19 状态选项且 literalChevron=false。
- 涉及：页面组件；状态精确筛选 GET；无数据变更。
- 修复 / 验收：按阶段分组全部状态并移除模板残留，已通过。

### BLK-P38-01（阻塞）真实第三方成功采集

- 原因：本地测试环境没有合法 Amazon/1688 登录账号、Cookie、验证码处置条件或可逆第三方沙箱。
- 实际：API、Worker、Crawler、MySQL 和 Redis 均真实启动；Worker 对无外部凭证任务真实记录 `validation_failed` / `source_circuit_open` 并重试或死信。
- 结论：本页状态机和失败生命周期通过；真实第三方成功、验证码和风控不能标记通过。
- 验收条件：提供合法测试账号与隔离目标站条件，完成 queued → browser job → crawler → evidence → succeeded 全链并保留日志。

### BLK-P38-02（阻塞）模块门禁前置状态

- 证据：`npm run verify:module -- M03-05` 返回 `dependency_blocked`，缺少已完成前置 `M00-04`、`M03-03`。
- 边界：本批没有修改这两个范围外模块，也不能把当前页面的定向验证结果替代模块依赖门禁。
- 验收条件：前置模块状态完成后重新执行 M03-05 模块门禁。

### BLK-P38-03（阻塞）共享 Worker 状态文件 EPERM 基线

- 证据：真实 Worker 日志出现 `scheduler_state_write_failed`，Windows 对共享状态文件原子重命名返回 `EPERM`；采集任务消费、重试和死信证据仍可形成。
- 边界：该共享 Worker 运行时问题不属于本页代码范围，本批未修改。
- 验收条件：在独立 Worker 状态目录或目标宝塔运行目录复测，状态文件写入不再出现 `EPERM`。

### BLK-P38-04（阻塞）范围外静态分析基线

- 证据：`npm run verify:static-analysis` 仍只报告 `apps/web/src/components/CompetitorMonitor.vue` 的异步回调可能产生未观察 Promise；该文件相对本批基线无差异。
- 边界：`CompetitorMonitor.vue` 不属于 `/platform-admin/collection`，本批未修改。
- 验收条件：在对应页面批次消除该静态分析问题后重跑全局门禁。

## 单页优化方案与不变能力

- 页面定位 / 使用者 / 核心任务：平台采集故障处置台；运营管理员快速回答“哪些任务受阻、为什么、下一步是什么、是否可以重放”。
- 新信息架构：业务说明和刷新 → 当前页指标 → 总数/区间 → 当前页筛选与完整状态 → 桌面表格/移动卡 → 分页 → URL 化详情对话框。
- 主要操作：刷新、状态筛选、翻页、打开详情、确认重放；次要操作是当前页文本筛选、技术标识和失败恢复联动。
- 保留：全部状态机、4 次总尝试、1/5/15 分钟退避、rate-limit reset、组织/工作区事实、子查询独立结果、历史保留、确认短语、权限、表格列设置/冻结/密度和移动摘要。
- 不删除或合并：不删除任何任务字段、子查询、尝试、事件、死信或恢复入口；不把采集总览和浏览器运行时并入本页。
- 状态设计：首次 loading/empty/error/expired/forbidden/blocked；已有数据刷新失败、离线、超时和数据库异常保留旧事实；详情拥有独立 loading/error/retry。
- 响应式：桌面保留高密度表格；390px 使用可展开摘要卡和全屏宽度详情；所有控件禁止页面级横向溢出。
- 权限差异：`collection:replay` 是列表、详情和写操作的统一服务端边界；不靠隐藏按钮授权。
- 数据变化：只有确认重放会写新任务、复制子查询、更新旧任务/死信、写事件/Outbox/operation；筛选、分页和详情均只读。
- 验收：所有 3 个接口和页面入口有证据；50+ 全可达；失败不覆盖旧事实；详情可刷新/返回/键盘操作；同 Key 并发只生成一个任务；桌面与 390px 无溢出。

## 性能、安全与企业能力缺口

- 性能：61 条任务、50 条当前页、3 个桌面尺寸和 390px 已验证；未做 10 万任务、持续并发或生产容量测量，标记未验证。
- 安全：会话、权限、同源、幂等、原因边界、技术字段隔离和 no-store 已验证；未进行本批次渗透测试，不能宣称全面安全审计通过。
- 排序/搜索：固定业务优先级排序正确；全库文本搜索和用户自定义排序尚无服务端合同，当前页筛选已明确范围，列为 P4 后续能力。
- 运营能力：页面没有批量重放，批量能力在采集总览沿用单任务安全重放合同；本页不复制第二套批量状态机。
- 外部生命周期：真实 Amazon/1688 登录、Cookie 过期、验证码/风控、页面结构变化与成功证据入库保持阻塞，不能用本地合成执行器替代。

## 当前结论

本批实现和本地真实全栈验证完成，等待用户验收后提交。可确认页面分页、全状态筛选、可靠刷新、URL 详情、可访问性、死信重放、并发幂等、权限和 Worker 失败生命周期；真实第三方成功采集与生产容量仍为阻塞/未验证。
