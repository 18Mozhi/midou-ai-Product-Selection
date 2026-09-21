# M02-03 宝塔发布与回滚

## P39 当前重放与历史图证（非生产）

见 `design-plans/ui-phase-2-2026-09-07/P39-CAPTURE-BOUNDARY-REPAIR.md`。
`node scripts/verify-ui-phase2-account-current-replay.mjs`使用当前组件与原驱动断言，无图。
`--smoke`只跑筛选，`--capture`独占r1；`--resume`只用于未完成采集的严格来源校验后恢复。
完整后不要用resume重写汇总，日常用无参数。所有请求为本地样例；原88图不覆盖，
历史来源不可充当当前权限/生产验收。不新增API/环境变量/依赖，不需要生产重启。

## 组织保存结果与页面更新反馈审核（非生产）

见 `design-plans/ui-phase-2-2026-09-07/ORG-SAVE-FEEDBACK-ACTUAL-VUE-REVIEW.md`。
`node scripts/verify-ui-phase2-org-save-feedback-vue-c.mjs --smoke`双端500无图；无参数12组。
`--capture`独占r1，已有拒绝覆盖。PATCH由本地拦截，结果字段取自实际repository；
读取200/500/403分离保存/读取追踪，不代表真实保存、审计或权限验收。无生产导入、
环境变量、依赖或重启要求；草稿策略仍按原逻辑，不因审核稿自行修改。

## 组织资料校验与冲突审核（非生产）

见 `design-plans/ui-phase-2-2026-09-07/ORG-PROFILE-FORM-ACTUAL-VUE-REVIEW.md`。
`node scripts/verify-ui-phase2-org-profile-form-vue-c.mjs --smoke`双端无图；无参数新旧四组。
`--capture`独占r3，已有拒绝覆盖。6类原生校验、行内错误与保存焦点不改约束/API；每组
1个PATCH由浏览器本地拦截并返回原409样例，不能宣称真实写入/审计成功。r3字段图为
Tab离开后状态，未关闭原生校验。无生产导入/配置变更/重启，旧包与草稿策略不改。

## 组织首次读取与访问状态审核（非生产）

见 `design-plans/ui-phase-2-2026-09-07/ORG-READ-STATE-ACTUAL-VUE-REVIEW.md`。
`node scripts/verify-ui-phase2-org-read-state-vue-c.mjs --smoke` 4组双端403无图；无参数32组，
`--capture` 独占新版本，已有r1拒绝覆盖。baseline为上一C刷新提案，不是生产原始页。
新稿非ready撤下旧名称/时间，单一错误区和重读焦点；296GET零写入、原重试次数不变。
模拟重读恢复不代表真实登录/授权恢复。无生产导入、配置/API变更或重启要求，旧包不改。

## 组织概览刷新审核（非生产）

见 `design-plans/ui-phase-2-2026-09-07/ORG-REFRESH-ACTUAL-VUE-REVIEW.md`。
`node scripts/verify-ui-phase2-org-refresh-vue-c.mjs --smoke` 双端无图；无参数新旧四组，
`--capture` 独占已有r1时拒绝覆盖。仅本地GET的summary500失败→成功重读，原安全重试
不变；非真实保存/权限验收。新稿焦点与折叠只在审核宿主，原r2来源/图片不变。
成功覆盖表单草稿策略尚待决定，不自行更改；无生产配置、API或重启要求。

## 组织概览实际 Vue 审核（非生产）

见 `design-plans/ui-phase-2-2026-09-07/SHELL-ORG-ACTUAL-VUE-REVIEW.md`。
`node scripts/verify-ui-phase2-shell-org-vue-c.mjs --smoke` 双端无图，无参数六组无图。
`--capture` 独占目录，已有r2拒绝覆盖；原组织fixture与页面逻辑不变，仅宿主标题/CSS。
42GET零写入；主题偏好显式500不算同步通过，保存、真实权限和其他组织页面未验收。
Vite/Chromium finally关闭；生产无导入，无配置/API/依赖变化，无重启，不运行部署。

## 成员壳与创建选品审核（非生产）

见 `design-plans/ui-phase-2-2026-09-07/SHELL-JOURNEY-ACTUAL-VUE-REVIEW.md`。
`node scripts/verify-ui-phase2-shell-journey-vue-c.mjs` 完整无图回放，`--smoke`为双端输入。
r3捕获目录已有图，`--capture`拒绝覆盖。新壳/横向阶段只在本地审核宿主，P16源码、
五门/请求/权限不变；不需要后端重启，不代表真实采纳或批准，不运行部署命令。

## 三壳层访问状态审核（非生产）

见 `design-plans/ui-phase-2-2026-09-07/SHELL-ACCESS-VUE-C-REVIEW.md`。
`node scripts/verify-ui-phase2-shell-access-c.mjs --smoke` 是平台双端403/429最小回放，
无参数覆盖成员/组织/平台、两宽度、五错误分类的新旧状态；均不出图，仅本机GET。
`--capture` 已生成r1，独占目录防覆盖。重查保持原自动尝试次数并再次返回原错误，
不是真实权限恢复，登录/工作区链接未做目标流程验收。全部浏览器/服务finally关闭。
此变换及CSS不被生产导入，无生产配置/依赖/API/数据库变更，无重启要求；不可将局部
图或检查代替全库门和宝塔发布验收。

## C 导航壳平台装配审核（非生产）

`design-plans/ui-phase-2-2026-09-07/SHELL-VUE-C-PLATFORM-REVIEW.md` 记录真实 Vue 审核宿主。
`node scripts/verify-ui-phase2-shell-vue-c.mjs --smoke` 做双端最小检查，无参数覆盖完整
平台代表组合；均只调用本地拦截 GET，finally 关闭 Vite/Chromium。`--capture` 目标 r2
已存在时拒绝覆盖；修改提案须另建版本，不改旧证据或批准。r1 有根级 CSS 覆盖导致
桌面首屏正文不可见的问题，只保留为负面证据；r2 增加对应几何检查。
生产 NavigationShell/P47/P46、路由、权限、接口、配置、依赖均未改，无重启要求。
本图稿不可随生产包上线；待具体审核及全库门通过后再接入真实生产源码与宝塔流程。

## 共享筛选抽屉关联与首焦点

触发按钮通过 Vue 实例 ID 关联其面板，无须传入 ID 或增加配置。运行
`node scripts/verify-filter-drawer-association.mjs` 检查实际共享 Vue 的多实例关联、
开闭、断点切换、键盘边界与减少动态效果下的首焦点。该脚本无参数，仅本机静态请求，
自动关闭临时服务器和浏览器，不写出截图，不代表业务 API 或全部页面验收。
减少动态效果时，抽屉 surface 及其后代禁用过渡，避免全局极短过渡影响继承的 visibility。
普通动画、布局、调用参数和业务行为保持；本次没有环境变量、API、数据库或后台改动。
发布前须完成全库及消费者证据复核，正常 `npm run build:web` 后按宝塔既有流程上传
静态文件并刷新浏览器；此变更本身不要求重启 Node、Worker、Python、MySQL 或 Redis。

## P57 页面拆分的构建边界

P57 的 `PlatformNotificationFacts`、`PlatformNotificationActionDialog`、
`PlatformNotificationCenter`、`PlatformNotificationManagement`、
`PlatformNotificationOperations`、`PlatformNotificationPagination` 由所属页面静态导入，
不进入 `NavigationShell` 的动态组件目录。编辑器和消息工作台保留独立构建分块。
新增页面内部组件时，应同时核对外壳和所属页面的构建体积；不能将整个组件目录
改成仅包含路由入口，否则其他页面的子组件会被合并，导致单个页面包超限。

此调整保留原路由分派、KeepAlive、权限检查、模板与样式，无 API、环境变量、
数据库或依赖变更。运行 `npm run build:web` 后执行 `npm run verify:frontend-budget`，
并验证 P57 编辑、发布、取消冲突、独立分页以及三类壳层导航。
最终发布需重新构建并按既有宝塔流程上传静态文件、刷新浏览器；
此构建调整本身不要求重启 Node、Worker、Python、MySQL 或 Redis。

历史审核包若绑定 `NavigationShell.vue` 的完整源码哈希，会因动态目录变更而失效，
必须按各包的验证器复核后更新；不得只替换哈希或把旧截图记为新版验收。

## 发布

1. 本模块没有数据库迁移和新增环境变量；先执行 M02-03 模块门禁，再通过宝塔网站发布 Node API 构建和 Vue Web 静态资源。
2. 因新增 `/api/v1/me/landing` 并调整 `/api/v1/me/navigation` 消费方式，必须在宝塔统一 Node 项目“ai选品”中重启一次。不得创建第二个后端项目或面板外生产服务。
3. 抽查 `/`、登录成功、MFA 成功、`/home`、`/org-admin`、`/platform-admin`：根路径和登录后必须按真实角色进入对应面板；有活动成员资格但未选上下文时进入 `/select-context`，完全无活动成员资格时可进入 `/select-context` 创建个人选品空间；普通成员不能进入组织或平台后台，组织管理员不能进入平台后台；平台管理员无组织上下文仍可进入平台后台。
4. 同时检查桌面、390px、键盘抽屉、401、403、409、429 与 API 不可用恢复状态；角色摘要只能显示中文业务角色名，关联编号只在“故障详情”展开后显示，不得用示例角色或前端开关绕过服务端结果。
5. 运行前端路由标题合同测试，确认 Feature Map 路径无重复、`/me` 只有一个 PersonalCenter 所有者，并确认 `/platform-admin/crawler-scheduler` 的菜单和一级标题均为“采集调度”。
6. 运行采集调度页 390px E2E；滚动到页尾交接信息后，底部导航与该信息的几何重叠必须为 0，不以全页截图中固定元素的绘制位置代替遮挡判断。
7. 分别以成员、组织管理员和平台管理员打开 390px 页面：底栏在权限足够时必须恰好四个链接加一个“更多”，点击“更多”后完整抽屉打开；底栏不得再出现创建选品、邀请成员或新建组织形成第六项。
8. 抽查任意成员列表筛选地址，刷新浏览器和从根路径重新进入后都应恢复原完整地址；进入平台后台后点击“选择范围并返回工作台”，必须先显示组织/工作区选择，选择成功后返回原完整地址。手工传入 `return_to=//example.com` 时必须回退到快速引导，不能跳往站外；浏览器存储只允许出现限定的最近成员路径、最近有效路径、最多五个组织 ID 和主题 ID，不得写入身份、权限、查询结果或凭证。
9. 直接打开未知地址，确认显示 404 且模块索引不高亮“今日行动”或“平台概览”；分别点击 `/platform-admin/organizations`、`/platform-admin/users`、`/platform-admin/admins` 和任意业务内链，确认页面无整页刷新，浏览器前进/后退仍可恢复路径。
10. 在来源管理页确认凭证入口只出现在来源二级导航；平台横向模块索引应分为“业务运营、采集与数据、治理与安全、高级运维”，导航搜索按菜单名和分组名都可命中；当前组只高亮、不在桌面初始加载时遮挡正文，点击后展开索引页。在采集和系统运维页面确认二级导航保持当前项。
11. 打开 `/me`，确认使用独立横向账号分区索引；平台管理员和无组织账号在没有组织上下文时仍能读取、更新账号资料，并能进入 `/security/mfa`。组织相关分区失败只能显示局部提示。成员、组织、平台和个人中心必须继承同一纸张主题，后台只使用紧凑密度。
12. 抽查成员、组织和平台壳层：页面必须显示账页序号、路由一级标题与说明；上下文轨只能展示服务端返回的当前组织/工作区、路由任务域、固定的连接状态文案和中文角色。桌面壳层切换入口位于模块索引末端，顶栏只保留主题、搜索、中性快捷入口、通知与账号；朱砂色只允许当前页面唯一主操作使用。机会、趋势与采集筛选在桌面保持内联，760px 及以下使用无圆角、无阴影的全屏筛选层；840px 及以下导航改为抽屉和五列底栏，上下文轨改为单列且不得横向溢出。

本次 P0 视觉壳层只改变 Vue 静态资源，不新增 API、数据库迁移、环境变量或运行依赖；更新 `frontend` 即可，Node、Python、MySQL 和 Redis 均无需因该视觉改动重启。账号级落地/个人资料逻辑变更仍必须同时发布 `frontend` 与 `backend` 并在宝塔重启 Node 项目“ai选品”。若宝塔网站启用了静态缓存，按现有网站配置刷新静态缓存。

## 故障定位

共享详情当前交互可运行 `node scripts/verify-responsive-data-view-current.mjs`（无参数）。
它复用已有依赖，在本地临时端口测试实际 Vue 的3种现有外观、2种动态偏好和4个屏宽，
涵盖嵌套弹窗、焦点返回、背景隔离及真实 KeepAlive 切出/返回；不截图、不请求业务接口。
与实际路由缓存联查时运行 `node scripts/verify-ui-phase2-platform-shell-lifecycle.mjs`，不带
`--capture`，其请求全部为本地样例 GET。这两项不替代历史图证、真实权限或整页验收。
若初始挂载失败，先读输出中的页面错误/请求诊断，不提高超时掩盖问题。无需生产重启。

- 401：重新登录；409：选择活动组织与工作区；403：返回有权工作台并由管理员核对真实角色；429：等待后重试。
- 5xx/网络失败：在宝塔查看 Node API 状态和日志，并使用页面 `request_id`/`trace_id` 关联 `authorization_decisions`。不要记录 Cookie、密码或令牌。
- 平台管理员意外要求组织上下文时，核对请求的 `shell=platform_admin` 与真实平台角色分配；不要临时创建组织成员资格掩盖问题。

## 回滚

在宝塔回退统一 Node 项目和 Web 到上一提交并重启“ai选品”。无需 down 迁移；现有允许/拒绝审计保留。回滚时必须同时回退 `/me/landing` 的 API 与 Web 消费代码。
