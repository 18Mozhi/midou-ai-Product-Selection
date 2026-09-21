# M02-04 宝塔发布与回滚

## P34两接口时序本地验证（2026-09-14）

`node scripts/verify-ui-phase2-org-approvals-read-order-vue.mjs`默认双端旧56组+时序24组；
`--smoke`手机20+12组，不写图；`--capture`独占`output/playwright/p34-read-order-vue-c-r1`，
拒绝覆盖及组合参数。独立释放本地响应门，观察真实测试响应与开发Vue快照，不连接生产。
服务/浏览器/监听和等待门finally释放，无需重启。见[范围及证据](../../design-plans/ui-phase-2-2026-09-07/P34-READ-ORDER-VUE-C-REVIEW.md)。

## P34加载实际Vue审核（2026-09-13）

`node scripts/verify-ui-phase2-org-approvals-loading-vue.mjs`默认双端矩阵；`--smoke`手机20组；
`--capture`独占`output/playwright/p34-loading-vue-c-r2`，拒绝覆盖和组合/重复参数。
只用现有依赖、本机拦截API、可释放测试门、finally关闭；无需生产重启。
见[加载设计、r1对照与验证边界](../../design-plans/ui-phase-2-2026-09-07/P34-LOADING-VUE-C-REVIEW.md)。

## P34其余读取反馈实际Vue审核（2026-09-13）

`node scripts/verify-ui-phase2-org-approvals-read-feedback-vue.mjs`默认双端56组；`--smoke`手机
20组；`--capture`独占`output/playwright/p34-read-feedback-vue-c-r1`且拒绝覆盖和组合参数。
本机随机端口、既有依赖、API拦截、finally关闭；不改生产配置，无需重启。
见[160图与32新增键盘流程](../../design-plans/ui-phase-2-2026-09-07/P34-READ-FEEDBACK-VUE-C-REVIEW.md)。

## P34登录失效实际Vue本地审核（2026-09-13）

`node scripts/verify-ui-phase2-org-approvals-expired-vue.mjs`默认两宽56组；`--smoke`手机401/403
八组；`--capture`独占`output/playwright/p34-expired-vue-c-r1`，只接受一个参数且拒绝覆盖。
本地拦截API、随机端口、finally关闭，登录说明/重读沿用原行为。未改生产配置，不需重启。
见[审核图、键盘修订与边界](../../design-plans/ui-phase-2-2026-09-07/P34-EXPIRED-VUE-C-REVIEW.md)。

## P34权限提示实际Vue本地审核（2026-09-13）

`node scripts/verify-ui-phase2-org-approvals-permission-vue.mjs`默认两宽56组；`--smoke`手机
12组；`--capture`拒绝覆盖`output/playwright/p34-permission-vue-c-r1`，仅一个参数。
在固定父r3驱动上组合本地权限展示，原load/权限/其他状态不改。本机随机端口、拦截API、
finally关闭；无生产配置/迁移/重启。见[范围与80图](../../design-plans/ui-phase-2-2026-09-07/P34-PERMISSION-VUE-C-REVIEW.md)。

## P34当前父级C矩阵（2026-09-13）

`node scripts/verify-ui-phase2-org-approvals-parent-current.mjs`默认两宽56组；`--smoke`手机
12组；`--capture`启动前拒绝覆盖`output/playwright/p34-parent-current-c-r3`。未知、重复和
组合参数拒绝。原父脚本不改，仅Vite内存展示标记/缺席态页头样式与既有C壳/子页组合。
本机随机端口、拦截HTTP、finally关闭；无生产配置/迁移/重启。旧图包不覆盖，边界见
[矩阵与64图](../../design-plans/ui-phase-2-2026-09-07/P34-CURRENT-PARENT-MATRIX-REVIEW.md)。

## P34整页C本地审核（2026-09-13）

`node scripts/verify-ui-phase2-org-approvals-vue-c.mjs`默认两基线/六改版宽度；`--smoke`只跑
390；`--capture`拒绝覆盖`output/playwright/p34-approvals-vue-c-r4`，仅单选参数。
实际Vue内存替换、本机随机端口、API全拦截、finally关闭，不改生产/权限/配置、无需重启。
58图与224检查的范围见[审核说明](../../design-plans/ui-phase-2-2026-09-07/P34-ACTUAL-VUE-C-REVIEW.md)。

## P33成员确认窗本地审核（2026-09-13）

`node scripts/verify-ui-phase2-teams-member-dialog.mjs`核对四宽分配/移除原因窗；`--smoke`
仅390，`--capture`在启动浏览器前拒绝覆盖`output/playwright/p33-member-dialog-c-r1`。
只接收一个smoke/capture选项。本机随机空闲端口、API全拦截、复用依赖，finally关闭。
未修改共享生产组件或API/权限，没有生产配置/迁移/重启要求。见[范围与40图](../../design-plans/ui-phase-2-2026-09-07/P33-MEMBER-DIALOG-REVIEW.md)。

## P33重读成功焦点本地验证（2026-09-13）

`node scripts/verify-ui-phase2-teams-recovery-focus.mjs`默认修订模式500/403四宽；`--baseline`
检查原行为，`--external`检查等待期间转向其他入口不抢焦点。`--smoke`仅手机500；`--capture`
拒绝覆盖对应两个`output/playwright/p33-recovery-focus-{模式}-{500,403}-r2`目录，不能与smoke
组合。未知/重复参数与baseline+external组合拒绝。复用依赖、随机空闲本机端口、API拦截，
finally关闭浏览器/Vite；无生产配置或重启。见[24图与范围](../../design-plans/ui-phase-2-2026-09-07/P33-RECOVERY-FOCUS-REVIEW.md)。

## P33创建与读取结果纠偏预览（2026-09-13）

`node scripts/verify-ui-phase2-teams-read-result.mjs`运行500/403四宽流程；`--smoke`仅手机500，
`--capture`预检两个`output/playwright/p33-read-result-{500,403}-r2`目录，任一已存在即拒绝。
[范围与图](../../design-plans/ui-phase-2-2026-09-07/P33-READ-RESULT-REVIEW.md)：只读恢复不重提
创建，状态均为本机拦截样例。生产未导入纠偏代码，没有配置或生产重启要求。

## P33创建状态本地回放（2026-09-13）

`node scripts/verify-ui-phase2-teams-create-states.mjs`运行四宽流程，`--smoke`仅手机，
`--capture`独占`output/playwright/p33-create-states-r2`，已存在拒绝。仅明确拦截的本机
创建POST可执行，其他未知/外部请求拒绝；不连接真实API。[28图与已知失败](../../design-plans/ui-phase-2-2026-09-07/P33-CREATE-STATES-REVIEW.md)。
OG-G02重读失败提示被覆盖尚未修复；未改生产配置，无重启要求，不据此部署。

## P33创建区焦点预览（2026-09-13）

`node scripts/verify-ui-phase2-teams-create-focus.mjs`运行四宽前后460项；`--smoke`仅手机，
`--capture`独占`output/playwright/p33-create-focus-r1`，已存在拒绝。原r4图包不改。
[图与范围](../../design-plans/ui-phase-2-2026-09-07/P33-CREATE-FOCUS-REVIEW.md)。仅内联取消
焦点修订，真实写入/成功回执/生产不覆盖，无配置变更或生产重启需求。

## P33页内导航交互（2026-09-13）

`node scripts/verify-ui-phase2-teams-anchors.mjs`运行C预览四宽196项无图检查；`--smoke`
仅手机49项，`--capture`拒绝。复用真实App、本机GET拦截和原r4夹具，不启动生产服务。
[范围与限制](../../design-plans/ui-phase-2-2026-09-07/P33-ANCHOR-INTERACTION-REVIEW.md)：
验证点击/键盘/历史切换与草稿保留，不定义历史滚动策略。无配置变更或生产重启要求。

## P33真实Vue C组合（2026-09-13）

[图包与完整边界](../../design-plans/ui-phase-2-2026-09-07/P33-ACTUAL-VUE-C-REVIEW.md)。
`node scripts/verify-ui-phase2-teams-vue-c.mjs`运行本地六组无图回放，`--smoke`仅手机。
`--capture`独占r4目录，已存在即拒绝；不得覆盖原图。区域截图临时加高视口，实际尺寸
在清单captureViewport中，交互仍为1000px高；不是短屏完整验收。
`node --test tests/unit/ui-phase2-teams-vue-preview.test.mjs`核对当前源码、图和转换边界。
没有生产导入、配置或API变化，无需重启；原因窗重设计和OG-G02仍未完成。

## C账号组合跨路由回执（2026-09-13）

[证据及边界](../../design-plans/ui-phase-2-2026-09-07/ACCOUNT-PAIR-C-LIFECYCLE-REVIEW.md)。
`node scripts/verify-ui-phase2-account-pair-lifecycle.mjs`仅无图本地回放，`--smoke`手机，
`--capture`独占r2且启动前拒绝覆盖；依赖原整页r2精确清单/来源，不接受未知漂移。
新永久门`node --test tests/unit/ui-phase2-account-pair-lifecycle.test.mjs`；无生产配置/API
变化、无重启部署要求。常驻导航不等于模态窗口，业务关闭和导航身份均必须核对。

## P43/P44 C整页真实App审核（2026-09-13）

[组合边界](../../design-plans/ui-phase-2-2026-09-07/P43-P44-APP-COMPOSITION-REVIEW.md)。
`node scripts/verify-ui-phase2-account-pair-app.mjs`四宽度无图回放；`--smoke`仅390新稿。
`--capture`独占r2目录，已存在时启动前拒绝。80图仅本地整页提案，不代表全部状态或真实权限。
`node --test tests/unit/ui-phase2-account-pair-preview.test.mjs`核对生产script/事件保留、来源及图。
无生产导入、接口/环境变化、重启或部署要求。

## P43 真实App路由与缓存回执验证（2026-09-13）

[范围和证据](../../design-plans/ui-phase-2-2026-09-07/P43-ACTUAL-APP-LIFECYCLE-REVIEW.md)。
`node scripts/verify-ui-phase2-account-app-lifecycle.mjs`仅本地无图重放，`--smoke`仅手机；
真实App不注入C模板，16组224检查48图是功能证据，非新布局审核。新fixture/来源/图片门运行
`node --test tests/unit/ui-phase2-account-app-lifecycle.test.mjs`。`--capture`独占创建r1目录，
已存在时启动前失败；必须新版本保留旧证据。无生产/API/环境变化，无重启或部署要求。

## P49 捕获版本标记（2026-09-13，审核工具）

[版本记录](../../design-plans/ui-phase-2-2026-09-07/P49-REVIEW-VERSION-STATUS.md)。
`node scripts/build-ui-phase2-acceptance-review-r2.mjs --check`核对原图证、已知版本变化及入口
同步；输出sourceMatchesCurrent=false表示旧捕获来源可核对，不是当前实现通过。
`node scripts/verify-ui-phase2-acceptance-review-r2.mjs`无图验证双端入口、版本/原图链接。
--capture在来源不同情况下独占创建review-proof-versioned，拒绝覆盖；现有目录已生成。
原manifest和PNG不改，未知来源漂移仍失败关闭；无配置、API或生产服务变化，无重启要求。

## P47 后续预览保留分页修复（2026-09-13）

[整合记录](../../design-plans/ui-phase-2-2026-09-07/P47-PAGINATION-PREVIEW-INTEGRATION.md)。
`node scripts/verify-ui-phase2-provider-adapter-current-states.mjs --state=access` 或
`--state=filter-pagination` 仅无图重放当前来源。在当前24a3b2组件版本下，--capture在启动
浏览器前拒绝，防止覆盖旧current-review包；需要新图时应建立新版本目录及完整来源证据。
旧两项来源门仍失败，不据本地预览宣布生产通过。无生产/接口/配置变更，无重启或发布。

## P47 分页焦点（2026-09-13，未发布）

[本地实施证据](../../design-plans/ui-phase-2-2026-09-07/P47-PAGINATION-FOCUS-IMPLEMENTATION.md)。
`node scripts/verify-provider-adapter-pagination-focus.mjs` 实际 App 四宽度前后复验，不写图。
检查 Enter 翻到首页/末页聚焦页码，Shift+Tab 可返回有效分页按钮，中间页不移焦点；搜索
缩至单页仍保留原分页，清除空结果回搜索。无配置开关或 API 变化，无独立后端重启需求。
全库门仍失败，未提交部署；正式发布必须使用既定宝塔流程，不能把本地图当线上生效。
P49 r2 各有一处 P47 来源变化，原图作为捕获时快照保留，--check 不代表当前通过。

## P49 当前审核图包 r2（2026-09-13，非生产发布）

见[证据与使用方式](../../design-plans/ui-phase-2-2026-09-07/P49-CURRENT-REVIEW-r2.md)。
直接打开 `output/playwright/p49-current-review-r2/index.html`，无需服务或重启。
`node scripts/build-ui-phase2-acceptance-review-r2.mjs --check` 校验当前来源和 143 图；
`node scripts/verify-ui-phase2-acceptance-review-r2.mjs` 复验键盘、链接和双端布局，不截图。
捕获入口仅接受 page/read-states/actions/robustness/lifecycle，目录存在时失败关闭，不能
覆盖旧证据。导航壳仍旧、长图固定栏中段的限制已显示；只提请页内排列审核，仍待回复。
未改生产/API/配置/权限/迁移；不需要重启，未执行宝塔发布。

## 发布

1. 本模块改动只需要更新前端静态构建，没有新增数据库迁移、API路由、环境变量或后端合同。实际发布仍遵循AGENTS.md的本地构建及`python scripts/deploy-baota.py`统一宝塔流程，不手工建立另一条生产部署链。
2. 此前端修复本身不要求重启Node/Python，但现有统一部署器可能停止/启动Node并检查既有迁移白名单；发布前按PLAN第9节核实执行记录与维护窗口，不能承诺零停机。不得为状态组件创建面板外服务。
3. 开发环境验证`/ui-states`八态、query刷新/history、每个演示动作、确认勾选/短语、Escape/取消/遮罩关闭后的焦点归还以及390×667短视口。生产构建则验证`/ui-states`及`?view=ui-states`不能露出内部展示，扫描dist确认无UiStateShowcase/VerificationFramework组件产物；保留请求URL和响应，不能仅凭404画面推断HTTP状态码。
4. 直接打开一个未登记的深层地址，确认渲染专用 404，而不是状态组件库；页面不得出现状态选择器、确认演示、示例请求编号或查询参数。验证有效最近页面、已删除最近页面、刷新、前进、后退、长路径、1440/1024/768/390px 和 44px 触控目标。
5. 浏览器网络记录只能包含静态资源和站内导航；停留在 `/ui-states` 或未知路径时不应新增 `/api/`、上传、下载、队列或采集请求。

## 故障定位

- 状态文案不符合实际 HTTP 结果时，先核对所属业务模块传入的状态；通用组件不访问 API，也不自行猜测权限。
- `request_id`/`trace_id` 未显示时，核对是否为空、超过 128 字符或包含不安全字符；不要放宽为任意文本。
- 弹窗无法确认时，检查影响确认框与确认短语；不得通过移除校验绕过高影响确认。
- 生产未知地址为空白或露出内部工具时，检查路由internal过滤、App的DEV条件导入、构建剥离以及NotFoundPage装配；不能为消除空白而重新发布内部展示组件，`?view=`调试入口必须保持仅开发环境可用。
- 点击遮罩取消后焦点丢失时，核对ConfirmDialog的`@mousedown.self.prevent`；保留取消时机和调用方事件，不用关闭校验或改写业务取消逻辑处理焦点问题。回归用例为UI2-ST03/ST04。
- 短视口无法触达弹窗底部按钮时，检查 `.confirm-dialog` 的动态视口最大高度和滚动容器，以及弹窗关闭后 `body` 滚动是否恢复。
- 未知地址出现状态选择器或确认演示时，检查 `App.vue` 是否错误地把兜底路由重新指向 `UiStateShowcase`；兜底页必须由 `NotFoundPage` 独立渲染。
- “返回最近页面”仍进入 404 时，检查候选地址是否先通过 `router.resolve` 且拒绝 `meta.notFound`；不得通过把 404 改成空结果掩盖失效地址。

## 回滚

通过已有宝塔流程恢复已留存的稳定Web运行包并复验公开版本、健康和恢复入口；本模块没有需要回退的数据库、队列或审计数据，不执行down迁移。统一部署器的配置/后端切换与数据库不保证随前端自动恢复，按当前发布记录逐项核对。恢复App与NotFoundPage的兼容版本，不恢复已废弃的生产内部展示入口。

## 仅本地：第二阶段审核材料入口

`design-plans/ui-phase-2-2026-09-07/review.html`不属于生产路由。搜索P44/P46/P47可查看补充
实施图、历史来源差异、原尺寸图和版本绑定批注；局部批准不等于整页或真实后端验收。
用`node scripts/build-ui-phase2-recent-review-materials.mjs --check`核对索引；查明来源变化后
才用`--write`更新补充索引，不改旧图或审批。运行`node scripts/verify-ui-phase2-review.mjs`
验证审核工具；新增`--capture-recent`仅写独立review-proof/recent-materials，不与旧capture
混用。它们不需要生产重启/部署/环境变量；不得把本地审核资料上传到生产网站目录。
完整范围、例外与清理见`design-plans/ui-phase-2-2026-09-07/RECENT-IMPLEMENTATION-REVIEW-ENTRY.md`。

P44控件/目录历史校验与当前原始图证分开，运行命令与固定Git版本见
`design-plans/ui-phase-2-2026-09-07/P44-HISTORICAL-GATE-CLOSURE.md`。新历史读取器只供单测，
需要保留原Git对象；缺失必须失败，不替换SHA或转换当前页面。历史通过不代表当前验收，
无新增运行参数、环境配置或生产重启步骤。

P44权限结果与角色资料的四阶段原图证及当前累计样式校验见
`design-plans/ui-phase-2-2026-09-07/P44-RESULTS-ROLE-FACTS-GATE.md`。二者共用结果验证驱动，
资料使用`--role-facts`，不是独立服务。历史测试需要原Git对象，当前仍按原文核对；
颜色变量展开一致不代表整页/真实权限通过，不新增生产部署或重启要求。

P44管理员详情用`node scripts/verify-ui-phase2-admin-detail-preview.mjs`无参数重放当前
源码上的待审组合，不传capture、不覆盖旧图。此入口不是生产App或真实账号权限检查，
旧46来源/94图按42909c61校验；当前驱动来源计数不含全部折入CSS。完整命令/范围见
`design-plans/ui-phase-2-2026-09-07/P44-DETAIL-CURRENT-REPLAY.md`，无生产重启或新配置。

P49五组当前无capture重放与历史校验见
`design-plans/ui-phase-2-2026-09-07/P49-CURRENT-REPLAY-HISTORY.md`。旧图按五个独立Git版本读取，
唯一不入Git的browser配置构建文件必须与原清单SHA一致，不能泛化允许缺源。提交只在本地
被拦截，缓存/双反馈修复仍是待审提案，无新增生产配置、部署或重启步骤。
