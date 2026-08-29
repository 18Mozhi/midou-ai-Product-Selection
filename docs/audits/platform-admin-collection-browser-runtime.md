# `/platform-admin/collection/browser-runtime` 页面 UI 与功能审计记录

## 页面定位与关联矩阵

| 项目 | 实际结果 |
| --- | --- |
| 页面 / 路由 | 网页登录采集 / `/platform-admin/collection/browser-runtime` |
| 使用者 / 权限 | 平台超级管理员；页面和 `GET/POST /api/v1/platform/crawler-runtime*` 均要求 `collection:replay`。未登录接口真实 401；没有该能力的平台安全管理员真实登录后页面拒绝、接口 403 |
| 业务目标 | 查看浏览器档案、登录有效期、档案租约和全部浏览器运行记录；筛选历史故障；在明确确认后幂等回收过期租约 |
| 页面组件 | `CollectionRuntimeCenter.vue`、`ResponsiveDataView.vue`、`ConfirmDialog.vue`、平台管理 Shell |
| 接口 | `GET /api/v1/platform/crawler-runtime`；`POST /api/v1/platform/crawler-runtime/recover-expired`；联合流程还使用内部 browser-jobs acquire/renew/complete API |
| 数据关系 | `provider_sources` / `provider_accounts` / `credential_assets` → `crawler_browser_profiles` → `crawler_browser_runs` / `crawler_profile_leases`；浏览器作业关联 `collection_tasks` / `collection_subqueries`；回收操作写审计 operation |
| 后台任务 | Node Worker 创建浏览器作业；Python Crawler 领取、续租、调用 Node Playwright runner、回写结果；MySQL 5.7 为事实源，Redis 用于队列/协调 |
| 页面联动 | “采集总览”到 `/platform-admin/collection/overview`；“任务详情”和“处理续期任务”到 `/platform-admin/collection`，后者携带 `status=blocked_login` |

## 当前截图与证据边界

- 修改前桌面：[desktop-current.png](../../output/playwright/platform-admin-collection-browser-runtime/before/desktop-current.png)
- 修改前被截断的历史搜索：[search-truncated-history.png](../../output/playwright/platform-admin-collection-browser-runtime/before/search-truncated-history.png)
- 修改前移动端：[mobile-current.png](../../output/playwright/platform-admin-collection-browser-runtime/before/mobile-current.png)
- 修改后 1440：[desktop-1440.png](../../output/playwright/platform-admin-collection-browser-runtime/after/desktop-1440.png)
- 修改后 1024：[desktop-1024.png](../../output/playwright/platform-admin-collection-browser-runtime/after/desktop-1024.png)
- 修改后 390：[mobile-390.png](../../output/playwright/platform-admin-collection-browser-runtime/after/mobile-390.png)
- 历史精确搜索：[exact-old-trace-search.png](../../output/playwright/platform-admin-collection-browser-runtime/after/exact-old-trace-search.png)
- 第 2 页及 URL 状态：[page-2.png](../../output/playwright/platform-admin-collection-browser-runtime/after/page-2.png)
- 移动端运行详情：[mobile-run-detail.png](../../output/playwright/platform-admin-collection-browser-runtime/after/mobile-run-detail.png)
- 回收成功反馈：[recovery-success.png](../../output/playwright/platform-admin-collection-browser-runtime/after/recovery-success.png)
- 刷新失败保留旧事实：[refresh-failure-preserves-data.png](../../output/playwright/platform-admin-collection-browser-runtime/after/refresh-failure-preserves-data.png)

证据只来自隔离本地 MySQL 5.7、Redis、本地账号、本地合成数据和仅监听 `127.0.0.1` 的受控网页。没有使用生产账号、生产数据、真实通知、支付或不可逆外部操作；本文不包含密码、Cookie、Token、密钥、凭证明文或完整隐私数据。真实 Amazon、1688 登录、验证码及风控生命周期没有用本地成功事实替代。

## 页面 25 项审计记录

| 编号 | 审计项 | 实际结果 | 结论 |
| --- | --- | --- | --- |
| 1 | 页面名称和路由 | 标题、面包屑和 `/platform-admin/collection/browser-runtime` 一致 | 通过 |
| 2 | 用户角色 | 超级管理员真实访问；安全管理员页面拒绝；匿名接口 401 | 通过 |
| 3 | 业务目标 | 档案、租约、全历史运行、异常检索和安全回收形成同一运维视图 | 通过 |
| 4 | 当前截图 | 修改前后 1440、1024、390、详情、分页、恢复和失败状态均有证据 | 通过 |
| 5 | 所有操作入口 | 刷新、搜索、状态、查询、重置、分页、列显隐、冻结、密度、运行详情、回收、3 个关联入口均逐项操作 | 通过 |
| 6 | 按钮和控件 | 查询/重置/上一页/下一页/刷新均真实请求；列和密度可切换并恢复；重复回收仅一个 POST | 通过 |
| 7 | 接口和响应 | 正常、非法参数、401、403、跨来源 Origin、缺幂等键、并发、依赖失败、重复幂等请求均取得真实状态码 | 通过 |
| 8 | 数据表 | 129 条运行、6 个档案、租约和操作审计由真实 MySQL 读取/核验；无结构变更 | 通过 |
| 9 | 权限和隔离 | 服务端能力校验；浏览器接口只返回净化后的元数据；租约令牌、凭证引用、密文和临时路径未泄露 | 通过 |
| 10 | 正常状态 | 25 条/页、全局指标、档案卡、状态和观测时间来自真实 API | 通过 |
| 11 | 空数据状态 | 自动化验证档案和运行同时为空；页面显示明确空态，不显示伪造数据 | 通过（自动化） |
| 12 | 加载状态 | 初次读取显示加载；已有事实刷新时保持内容并禁用重复读取 | 通过 |
| 13 | 接口失败状态 | 注入 503 与真实 MySQL 停止均显示明确依赖故障且保留旧事实 | 通过 |
| 14 | 超时状态 | 请求挂起超过 15 秒后被 AbortController 取消，旧事实和控件均保留 | 通过 |
| 15 | 无权限状态 | 匿名 401 `session_invalid`；安全管理员 403 `permission_denied` | 通过 |
| 16 | 表单校验状态 | 页码、状态和 161 字符查询服务端 400；回收确认短语错误时确认按钮不可用 | 通过 |
| 17 | 重复提交状态 | 同步双击回收确认只发 1 个 POST；相同幂等键两次响应一致且数据库仅 1 个 operation | 通过 |
| 18 | 刷新和返回状态 | 查询、状态、页码写 URL；刷新保持第 2 页；三个关联入口返回后恢复本页 | 通过 |
| 19 | 不同分辨率 | 1440、1024、390 均无页面级横向溢出；390 使用 25 张分页卡片和详情抽屉 | 通过 |
| 20 | UI 和交互问题 | 修改后层级清楚、失败不遮蔽事实、1024 长租约文本正常换行、焦点从抽屉返回触发卡 | 通过 |
| 21 | 功能问题 | UTF-8 链路、100 条截断、URL 丢失、失败覆盖、错误 500、重复回收和成功反馈问题均已修复 | 通过 |
| 22 | 性能问题 | 129 条下页面查询 5 次平均 150.6ms/最大 233.4ms；精确搜索平均 132.1ms/最大 193.2ms；10 万级未验证 | 当前规模通过；大容量未验证 |
| 23 | 安全问题 | 会话、能力、同源、幂等、确认短语、no-store 和敏感字段净化均验证；未做本批全面渗透测试 | 已覆盖边界通过；渗透未验证 |
| 24 | 企业级缺失项 | 缺真实第三方可控沙箱、生产规模压测和前置模块完成状态 | 阻塞 / 未验证 |
| 25 | 具体优化建议 | 当前批已实现服务端分页/筛选、URL 状态、可靠刷新、响应式布局和 UTF-8 运行合同；索引与游标分页留待容量批次 | 当前页方案完成 |

## 页面功能逐项结果

| 功能 / 控件 | 操作与实际结果 | 结论 |
| --- | --- | --- |
| 刷新 | 正常刷新发起一个 GET；503、离线和 15 秒超时保留最近事实；成功恢复后清除故障提示 | 通过 |
| 搜索 | 输入历史 `trace_id` 后按 Enter 或点击查询，服务端返回 1 条；URL 可刷新/返回/多标签独立保持 | 通过 |
| 状态筛选 | 选择状态后点击查询，状态写入 URL 并由服务端过滤；非法状态 API 返回 400 | 通过 |
| 重置 | 清除搜索、状态和页码，URL 回到页面基准地址并重新读取第一页 | 通过 |
| 排序 | 页面未提供排序入口，API/OpenAPI 也没有排序合同 | 不适用，未虚构通过 |
| 分页 | 129 条分 6 页；第 2 页显示 26–50，第 6 页返回 4 条；首末页按钮状态正确 | 通过 |
| 列设置 | 隐藏第 6 列后表头即时变为 5 列，恢复后重新显示“开始时间” | 通过 |
| 首列冻结 | “首列已冻结/未冻结”真实切换，最终恢复默认冻结 | 通过 |
| 表格密度 | “标准/紧凑”真实切换，最终恢复标准 | 通过 |
| 运行详情 | 桌面表格/移动卡片可打开；显示 run、组织、工作区、request、trace 等净化技术字段；关闭后焦点返回 | 通过 |
| 回收过期运行 | 无过期租约时禁用；有过期租约时展示影响范围、要求确认短语；取消不发请求；成功显示回收数量 | 通过 |
| 重复回收 | 同步双击只发一个 POST；客户端忙碌锁与后端幂等同时生效 | 通过 |
| 关联导航 | 采集总览、任务详情、处理续期任务分别到预期路由；浏览器返回后本页恢复 | 通过 |
| 上传 / 下载 / 导入 / 导出 | 当前真实页面和 API 没有这些能力 | 不适用，未虚构通过 |
| 新增 / 编辑 / 复制 / 删除 / 全选 / 批处理 | 当前页面不管理档案内容；唯一写操作是“批量回收全部过期租约” | 不适用或由回收项覆盖 |

## 接口真实结果

### `GET /api/v1/platform/crawler-runtime`

| 场景 | 实际结果 | 结论 |
| --- | --- | --- |
| 默认读取 | 200；25 条、总数 129、6 页；返回 6 个档案、全历史指标、筛选回显和观测时间 | 通过 |
| 第 2 / 6 页 | 第 2 页 25 条，第 6 页 4 条，总数保持 129 | 通过 |
| 精确历史搜索 | 查询第 125 条历史 `trace_id` 返回 1 条，修复固定 100 条上限 | 通过 |
| 状态筛选 | 运行状态服务端过滤，返回精确总数和页数 | 通过 |
| 参数缺失 | page/status/q 缺失使用明确默认值 | 通过 |
| 类型 / 边界 | `page=0`、未知状态、161 字符查询分别 400 对应业务错误码 | 通过 |
| 未登录 / 无权限 | 401 `session_invalid`；403 `permission_denied` | 通过 |
| 并发 | 5 个并发 GET 均 200 | 通过 |
| 数据库停止 | 真实停止隔离 MySQL 后返回 503 `crawler_runtime_dependency_unavailable`，不泄露底层异常 | 通过 |
| 返回结构 | `profiles/runs/run_metrics/pagination/filters/observed_at` 一致；敏感字段扫描为 false | 通过 |

### `POST /api/v1/platform/crawler-runtime/recover-expired`

| 场景 | 实际结果 | 结论 |
| --- | --- | --- |
| 正常回收 | 200；回收 1 个过期租约，过期 run 更新为 `timed_out/lease_expired` | 通过 |
| 有效租约隔离 | 同时存在的有效活动租约保持 `running`，没有被误回收 | 通过 |
| 缺幂等键 | 400 `idempotency_key_required` | 通过 |
| 跨来源 Origin | 403 `origin_forbidden` | 通过 |
| 重复请求 | 同一幂等键两次均返回相同结果，数据库仅一条 operation | 通过 |
| UI 重复提交 | 同步双击确认只产生一个 POST | 通过 |
| 审计 | 操作记录包含回收结果和关联请求，不记录租约令牌或凭证明文 | 通过 |

## 爬虫完整生命周期与联合流程

### 前置条件

- 隔离 MySQL 5.7（3351）、Redis（6423）、Node API（4175）、Node Worker、Python Crawler、Vue（5245）和受控本地来源（5460）均真实启动。
- 使用本地平台超级管理员和平台安全管理员；凭证只存在临时受限文件，报告和日志不输出秘密。
- 受控来源仅监听 `127.0.0.1`，不访问真实第三方账户。

### 链路 1：登录态浏览器成功采集

| 项目 | 记录 |
| --- | --- |
| 操作步骤 | 加密本地浏览器档案 → Worker 创建 browser job → Python acquire → 解密到受限临时目录 → Node Playwright runner 启动真实 Chromium → 访问受控页面 → 解析 1 条 → renew/complete → 清理临时凭证目录 |
| 预期结果 | 作业成功、item_count=1、租约释放、结果入库、临时凭证清除 |
| 实际结果 | `succeeded`、item_count=1；数据库作业 completed；临时凭证目录为空；Crawler stderr 为空 |
| 页面 / 接口 | 本页；内部 acquire/renew/complete；本页 runtime GET |
| 数据 / 后台任务 | credential/profile/job/run、task/subquery；Worker + Python Crawler + Node runner |
| 日志证据 | 隔离运行时 `crawler-lifecycle.stdout.log`（验收后删除，仅结论写入本文） |
| 结论 | 通过 |

### 链路 2：登录阻塞与恢复入口

| 项目 | 记录 |
| --- | --- |
| 操作步骤 | 创建第二个真实 browser job → Crawler 访问受控登录阻塞页面 → 回写 `blocked_login` → 本页显示档案最近失败和运行状态 → 点击“处理续期任务” |
| 预期结果 | 登录阻塞不得冒充成功；页面可定位续期任务 |
| 实际结果 | job 为 `blocked_login`，页面显示“需要验证码/已拦截”，入口到 `/platform-admin/collection?status=blocked_login` |
| 结论 | 通过（本地受控阻塞）；真实第三方验证码/风控仍阻塞 |

### 链路 3：过期租约安全回收

| 项目 | 记录 |
| --- | --- |
| 操作步骤 | 准备 1 个过期租约和 1 个有效租约 → 页面刷新 → 打开确认框 → 错误短语/取消/正确短语双击 → 查询 API 和数据库 |
| 预期结果 | 只回收过期租约；重复提交幂等；有效租约不变；操作可审计 |
| 实际结果 | 1 个 POST、recovered=1；过期 run `timed_out/lease_expired`；有效 run `running`；operation_count=1 |
| 结论 | 通过 |

### Crawler 生命周期分项

| 生命周期项 | 实际结果 |
| --- | --- |
| 创建、参数校验、调度、队列 | 真实 Worker/browser job 和 Crawler acquire 通过；非法参数由服务端拒绝 |
| 并发 / 租约 | 单档案单租约；有效租约不被回收；过期租约可幂等回收 |
| 登录状态 / Cookie 到期 | 有效和到期档案均展示；本地受控 `blocked_login` 通过 |
| 验证码 / 风控 | 本地受控阻塞状态通过；真实 Amazon/1688 阻塞 |
| 重试 / 超时 / 失败回写 | 定向集成覆盖失败 completion spool/replay、API backoff、超时和状态回写 |
| 页面结构 / 解析 / 清洗 / 入库 | 真实 Chromium 对受控页面解析 1 条并完成入库；真实第三方结构变化未验证 |
| 去重 / 部分成功 | 重复风险指标来自全历史；`succeeded_empty` 独立；真实第三方部分成功未验证 |
| 暂停 / 恢复 / 取消 | 本页没有这些控制；由任务页面负责，不在本批冒充通过 |
| 日志 / 进度 / 告警 | 本页显示净化状态、计数和技术详情；Crawler/Worker 日志检查通过；外部通知告警未触发 |
| 资源释放 / 重启恢复 | 临时凭证清空，Playwright 子进程退出；失败 completion spool/replay 集成通过；服务重启后真实第三方任务恢复未验证 |

## 问题记录

### P40-01（P1）Windows 默认代码页破坏 Python → Node 临时目录合同

- 所属页面或模块 / 问题类型：浏览器采集运行链 / 核心流程不可用。
- 问题描述：Python 以系统默认编码向 Node runner 写 JSON，中文工作区下 `CREDENTIAL_TEMP_ROOT` 被转码，runner 判定目录越界并拒绝运行。
- 复现步骤：在中文路径工作区创建加密档案并让 Python Crawler 调用 Node runner。
- 预期结果：stdin JSON 精确保留 Unicode 临时目录，真实 Chromium 启动。
- 实际结果：修改前 `crawler_runner_temp_scope_invalid`；修改后真实 Chromium 成功采集 1 条。
- 截图或日志证据：Crawler 生命周期 stdout；Python UTF-8 合同测试。
- 涉及文件：`apps/crawler/scoutops_crawler/playwright_bridge.py`、`apps/crawler/tests/test_foundation.py`。
- 涉及接口 / 数据：内部 runner stdin/stdout；credential temp root、browser job。
- 影响范围 / 严重等级：中文 Windows 环境全部网页登录采集，P1。
- 修复建议：`Popen` 文本管道显式 `encoding="utf-8"`，并用中文路径回归。
- 验收标准：子进程收到的路径逐字相同、真实 Chromium 成功、临时目录清空；已通过。

### P40-02（P1）固定 100 条上限使历史运行不可达

- 所属页面或模块 / 问题类型：运行记录 / 事实完整性。
- 问题描述：数据库 129 条，接口固定只返回最新 100 条，页面搜索旧 `trace_id` 得到空结果。
- 复现步骤：准备 129 条运行并搜索第 125 条历史 trace。
- 预期结果：全部历史可分页、可检索。
- 实际结果：修改前为空；修改后返回 1 条，129 条分 6 页。
- 截图或日志证据：修改前被截断搜索、修改后精确历史搜索和第 2 页截图。
- 涉及文件：页面、runtime service/repository/routes、OpenAPI、测试。
- 涉及接口 / 数据：runtime GET；`crawler_browser_runs`。
- 影响范围 / 严重等级：历史故障和审计遗漏，P1。
- 修复建议：服务端状态/文本过滤、固定 25 条分页、精确总数和全历史指标。
- 验收标准：第一页 25、末页 4、旧 trace 可达、总数 129；已通过。

### P40-03（P2）查询和页码刷新后丢失

- 所属页面或模块 / 问题类型：查询导航状态。
- 问题描述：搜索、状态和页码只在组件内存，刷新、返回和分享 URL 丢失上下文。
- 复现步骤：到第 2 页或设置搜索/状态后刷新。
- 预期结果：URL 表达查询状态并可恢复。
- 实际结果：修改前回第一页/清空；修改后 `page/status/q` 保持，多标签互不污染。
- 证据：第 2 页和精确搜索截图、真实浏览器刷新/返回记录。
- 涉及文件 / 接口 / 数据：`CollectionRuntimeCenter.vue`；runtime GET；不写数据库。
- 影响范围 / 严重等级：排障上下文丢失，P2。
- 修复建议 / 验收标准：URL 单一事实源、筛选变化重置页码、刷新恢复；已通过。

### P40-04（P2）刷新失败和无限等待覆盖已验证事实

- 所属页面或模块 / 问题类型：可靠性 / 异常状态。
- 问题描述：刷新失败会用错误态替换现有数据，且缺客户端超时。
- 复现步骤：先成功读取，再注入 503、离线或挂起 GET。
- 预期结果：保留最近事实、提示新鲜度并允许重试。
- 实际结果：修改后 503/离线/15 秒超时均保留数据，按钮恢复。
- 证据：失败保留截图和 15 秒真实计时提示。
- 涉及文件 / 接口 / 数据：页面与样式；runtime GET；只读。
- 影响范围 / 严重等级：故障时运维失去最后可信视图，P2。
- 修复建议 / 验收标准：AbortController、读取互斥、inline alert、恢复反馈；已通过。

### P40-05（P2）数据库不可用被暴露为通用 500

- 所属页面或模块 / 问题类型：API 依赖故障合同。
- 问题描述：真实停止 MySQL 后 runtime GET 返回通用 500，页面无法区分依赖不可用。
- 复现步骤：安全停止隔离 MySQL 后读取 runtime API。
- 预期结果：503 稳定业务错误且不泄露数据库细节。
- 实际结果：修改后 503 `crawler_runtime_dependency_unavailable`，敏感信息扫描为 false。
- 证据：真实停库/重启状态码和定向 API 测试。
- 涉及文件：runtime routes/service 和测试、OpenAPI/运行文档。
- 涉及接口 / 数据：runtime GET/recover；MySQL 连接。
- 影响范围 / 严重等级：故障诊断和错误信息安全，P2。
- 修复建议 / 验收标准：仅将已知 MySQL/网络依赖码映射 503，保留认证/业务错误；已通过。

### P40-06（P2）回收操作缺少客户端重复提交互斥

- 所属页面或模块 / 问题类型：租约回收 / 重复提交。
- 问题描述：快速重复确认可能发出多次写请求，依赖后端幂等兜底。
- 复现步骤：正确确认后同步双击。
- 预期结果：客户端只发一个 POST，服务端重复幂等。
- 实际结果：修改后浏览器捕获 1 POST；稳定幂等键两次 API 调用数据库仍仅一条 operation。
- 证据：浏览器请求列表与 MySQL operation_count=1。
- 涉及文件 / 接口 / 数据：页面；recover POST；leases/runs/operations。
- 影响范围 / 严重等级：关键恢复动作重复负载和反馈冲突，P2。
- 修复建议 / 验收标准：函数入口 busy guard、按钮禁用、稳定幂等合同；已通过。

### P40-07（P3）成功回收后没有明确结果反馈

- 所属页面或模块 / 问题类型：操作反馈。
- 问题描述：回收完成后只刷新数据，用户不能确认处理数量。
- 复现步骤：回收一个过期租约。
- 预期结果：显示成功、数量并刷新事实。
- 实际结果：修改后显示“已回收 1 个过期租约”。
- 证据：回收成功截图。
- 涉及文件 / 接口 / 数据：页面与样式；recover POST；不新增表。
- 影响范围 / 严重等级：运维确认成本，P3。
- 修复建议 / 验收标准：成功 notice 使用服务端 recovered 数量；已通过。

### P40-08（P3）1024px 长租约所有者逐字换行

- 所属页面或模块 / 问题类型：响应式 UI。
- 问题描述：双列档案布局在 1024px 压缩事实字段，长租约所有者几乎逐字换行。
- 复现步骤：1024×768 查看长名称档案和租约事实。
- 预期结果：文本按词/合理位置换行，无页面横向溢出。
- 实际结果：修改后 1180px 以下档案双列、租约事实单列；1024/390 无溢出。
- 证据：修改后 1024 和 390 截图，`scrollWidth === clientWidth`。
- 涉及文件 / 接口 / 数据：`crawler-runtime.css`；无 API/数据库影响。
- 影响范围 / 严重等级：常见桌面分辨率可读性，P3。
- 修复建议 / 验收标准：在 1180/760 两级调整网格，不删除字段；已通过。

## 阻塞和未验证项

### BLK-P40-01：真实第三方完整生命周期

- 阻塞原因：本地环境没有合法 Amazon/1688 测试账号、Cookie、验证码处置条件或可逆第三方沙箱。
- 已验证边界：真实 Worker、Python Crawler、Node runner 和 Chromium 对本地受控来源完成 `succeeded` 与 `blocked_login` 生命周期。
- 未验证：真实第三方登录、Cookie 过期、验证码、风控、结构变化、代理质量、部分成功、告警和服务重启恢复。
- 解阻条件：提供合法隔离账号与允许访问的测试目标，执行完整 queued → Worker → Crawler → evidence → 入库 → 页面 → 导出/审计链。

### BLK-P40-02：M03-04 模块状态门禁

- `npm run verify:module -- M03-04` 返回 `dependency_blocked`。
- 前置模块 `M03-02`、`M03-03` 尚未 completed；当前页面定向测试和构建不受影响，但模块总状态不能标记通过。
- 解阻条件：完成前置模块状态后重跑门禁。

### BLK-P40-03：范围外静态分析基线

- `npm run verify:static-analysis` 仅报告既有 `apps/web/src/components/CompetitorMonitor.vue` 异步回调可能产生未观测 Promise。
- 该文件不属于本批；本批 Web/API 构建、类型、格式、文档和定向测试均通过。
- 解阻条件：在 CompetitorMonitor 独立批次修复，或由验收人明确允许携带该范围外基线提交。

### RISK-P40-01：大容量查询未验证

- 当前 129 条下读取和搜索延迟可接受，但 `INSTR` 模糊查询、精确 `COUNT` 和 OFFSET 分页在 10 万级可能扫描。
- 本批没有数据库结构变更，也没有用小数据结果冒充容量通过。
- 后续容量批次应基于生产等比分布压测，按查询计划决定检索索引、归档或游标分页。

## 页面级优化升级方案

| 设计项 | 本页方案与验收标准 |
| --- | --- |
| 页面定位 / 使用者 / 核心任务 | 平台级浏览器采集运维；超级管理员快速定位档案过期、异常运行和僵尸租约 |
| 应保留能力 | 档案元数据、登录有效期、租约事实、运行详情、状态语义、确认回收、技术标识、关联任务入口全部保留 |
| 删除或合并 | 不删除业务字段；把全量长列表改为 25 条服务端分页，把搜索/状态/页码合并为 URL 查询合同 |
| 信息架构 / 新布局 | 标题与主操作 → 全历史指标 → 档案与租约 → 运行查询 → 响应式数据视图 → 分页和观测元数据 |
| 主要 / 次要操作 | 主要：查询、刷新、回收过期；次要：重置、分页、列/密度、技术详情和关联导航 |
| 表格字段 | 运行、范围、状态、采集量、耗时、开始时间；允许列显隐、首列冻结和密度切换，不丢技术详情 |
| 筛选条件 | 状态 + run/error/request/trace 文本；长度 160；显式查询和重置；页码在筛选变化时回 1 |
| 表单 / 弹窗 / 抽屉 | 回收弹窗列影响范围并要求“确认回收”；移动运行详情用抽屉；关闭后归还焦点 |
| 加载 / 空白 / 错误 / 无权限 | 首次 loading；空数据单独说明；刷新失败/超时保留旧事实；403 使用全页无权状态 |
| 成功 / 失败反馈 | 回收显示真实数量；503、离线、15 秒超时提供可操作提示和数据新鲜度 |
| 动效 | 只保留既有轻量过渡，不新增装饰性动画；尊重减少动态效果偏好 |
| 响应式行为 | 1440 完整表格；1024 调整档案/租约网格；760 以下改卡片与详情抽屉，保持 25 条分页 |
| 权限差异 | 只有 `collection:replay` 可访问；无权限不加载运行数据，写操作继续校验同源和幂等 |
| 页面联动 | 到采集总览、任务详情和登录续期筛选；返回后本页 URL 查询状态恢复 |
| 接口 / 数据状态 | GET 只读净化元数据；recover 将过期 run 变为 timed_out/lease_expired 并写 operation，有效租约不变 |
| 总验收标准 | 全历史可达、刷新可靠、写操作幂等、敏感字段不返回、1440/1024/390 无溢出、真实链路证据可核验 |

## 验证清单

- Python Crawler 全量单元测试：24/24 通过。
- M03-04 Node 定向测试：5/5 通过。
- Playwright E2E：desktop 3/3、mobile-390 3/3 通过。
- 真实联合集成：加密登录档案真实 Chromium、Python acquire/renew/complete、无空闲心跳、失败 completion spool/replay，4/4 通过。
- `npm run verify:crawler-chain`：通过。
- `build:credentials`、`build:playwright-crawler`、`build:api`、`build:worker`、`build:web`：通过。
- `verify:docs`、`verify:route-artifacts`、`format:check`：通过。
- 浏览器控制台：目标页 0 error；runtime GET 200。
- 服务端日志：API、Worker、Vite、Crawler stderr 为空；MySQL 安全停止和恢复均正常。
- `verify:module -- M03-04`：前置状态阻塞，未标记通过。
- `verify:static-analysis`：范围外 `CompetitorMonitor.vue` 基线失败，未标记通过。
