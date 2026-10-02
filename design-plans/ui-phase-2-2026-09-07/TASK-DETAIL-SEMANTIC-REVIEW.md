# P24 任务详情：逐项审核与实施缺口

2026-09-29提交态闭锁与失败恢复：父级 `busy` 禁用 pause/cancel/delay/transfer/progress 活动字段、关闭和返回，并拦截原生 Escape。实际 Vue E2E 以 delayed progress POST 覆盖成功闭窗，以五变体逐一用 delayed 409 覆盖就地 action_hint/请求编号、原草稿保留、仅显式同body重试；桌面 Chromium 与390px均通过，真实失败态图12张。受控响应仅证明本地交互，不证明真实会话、RBAC、数据库冲突或服务端持久化。

2026-09-10，基线main/87369638。沿已选C方向，使用ui-skills-root/frontend-design核对真实路由、职责和控件行为；不是重新选风格，也不把P16布局批准迁移到本页。

2026-09-29跟进：详情页曾错误继承列表专用 `view=exports` 和 `create=1` 参数。现已修复：详情路由始终读取任务与成员目录，不切出卷宗、不请求导出，也不打开新建窗；两个挂载Vue回归在桌面与390px移动各2/2通过。提交 `9de0ccd278d7344ec82c9140547789813e550c79` 已部署，线上 health/version 与该 SHA 一致。下方 2026-09-10发现记录保留为历史，其两项路由缺陷已由本次跟进覆盖；其他动作和状态缺口仍按各自证据核验。

[详情与更多操作图](design/task-direction-c/README.md) · [五操作及编辑/删除图](design/task-direction-c-forms/README.md) · [逐项清单](action-reviews/P24.json)

## 实际页面范围

`/tasks/:taskId`由TaskWorkspace(mode=all,taskId)编排，TaskDetailPanel显示常驻详情aside，不是列表抽屉或模态框。本页48个源位置归33组：28页面动作、4事件/定义关联、1组隐藏列表壳层来源。7类写入组不是7个新API。三处原生dialog对应新建/编辑、删除、五单项，共8业务变体；5个父v-model、8处结构、18个容器变体关联。子组件评论及五操作字段通过事件受控，不能因无v-model就漏记。

**共享DOM不等于可见入口**：`task-workspace-enhancements.css`隐藏详情根下除详情、dialog、状态和notice外的子元素，头部新建、业务/导出Tab、列表/批量、分页和导出区均隐藏。旧任务合同“头部入口可在详情存在”是共享DOM描述，不足以证明当前可点击；本页清单按CSS明确排除，不修改旧图来源合同。

历史路由差异已在2026-09-29跟进修复并以双端挂载Vue测试核实：详情路由忽略列表专用 `?create=1`/`?view=exports`，不触发创建窗或导出读取；保留参数合同，不改为其他导航行为。

## 按钮与弹窗设计约束

| 区域/动作 | 必须保留的语义 | 图稿与待细化状态 |
| --- | --- | --- |
| 返回详情来源 | 只接受/work、/tasks及其query，否则/tasks；真实RouterLink | detail；长标题下独立44px返回热区、有效/无效from |
| 关联采集任务 | 仅有collection_task_id时展示，目标平台采集页裁决权限 | 关联有无、目标拒绝不能由固定样本抵扣 |
| 技术详情/更多操作 | 两个原生details；收起真实隐藏内容 | detail/more；focus、只分配权、终态菜单待补 |
| 开始/继续/完成 | todo开始、paused继续、三非终态完成；task:update，busy禁用，直接POST | 不凭空新增确认窗；完成只按返回区分评分入队/缺规则，不显示评分已完成 |
| 更新进度/暂停/延期/取消 | 进度/延期/取消非终态，暂停in_progress；打开表单并预填事实 | 失败与提交中状态均在五变体真实Vue双端覆盖；按钮逐控件状态及长内容仍需补证 |
| 转交负责人 | 单项独立task:assign，源码无终态限制；不能套用批量资格 | transfer；只有分配权、目录失败/空、终态待补 |
| 编辑 | task:update，不额外排除终态；四字段，PATCH保留负责人和版本 | edit；标题200、说明5000、四优先级、可空本地期限 |
| 快捷新建 | 首次create=1并task:create；当前详情无可见创建按钮 | create；快捷参数清除、来源返回和草稿待验 |
| 删除打开/提交/关闭 | task:update，目标事实与版本，原因trim；删当前详情成功返回from | delete；P23列表和P24详情均以实际Vue覆盖busy期间Escape不关闭；P24成功回原from与精确请求体由桌面/390px用例覆盖 |
| 评论输入/提交 | task:update，required/max2000，busy禁用；trim仅判空，发送原文 | detail仅关联；独立label、空白/长文/失败/忙碌与活动增长待补 |
| 单项表单确认 | 五变体各自字段，POST action/version；原因/说明trim，期限ISO | 失败提示保留现有 action_hint/request_id，草稿和目标不变，用户显式重试；不自动重发，不改API/权限/版本 |
| 表单字段/返回/Escape | 进度百分比/说明、转交成员、延期时间、操作原因在途禁用；关闭/返回禁用且Escape不关闭 | desktop/mobile delayed-write 与五变体409/显式重试均有实测；离页时在途生命周期、完整焦点/读屏及真实服务仍待 |
| 重新加载 | 五种详情错误区load；正常仅详情与成员目录 | error/not_found/forbidden/expired/rate_limited；不是登录或申请权限按钮 |

两任务图包现有60PNG属于P23/P24及审核board共享交付，不是P24新增60图。本轮新增12张实际图：2张进度在途 + 5种动作失败态各2视口。它们是局部状态参考，不替代全页逐控件图。164个代表视觉槽尚未逐selector登记；不等于恰缺164张图，也不代表其他已关联状态已完成验收。

## 新增验证证据

`node scripts/verify-ui-phase2-task-detail-review.mjs`提取真实函数到隔离VM并用惰性边界执行8组检查：

1. 详情无论残留activeView为何都仅读任务与成员目录；列表专用 view=exports/create=1 隔离另由挂载Vue桌面/390px E2E覆盖，不触发导出或创建；列表无权限分支仍按原权限合同处理。
2. 开始/继续/完成三个body、五个只开表单入口、完成的两种auto_score_status文案。
3. 五表单精确字段与expected_version；单项转交独立分配权限。
4. 在途编辑与提交快照分离：progress延迟成功仍只提交点击瞬间的body；五变体延迟409后原草稿保留，提示与请求编号在原窗显示，用户显式重试发送原body。受控本地响应不代表服务端解决真实版本冲突。
5. 编辑在无create但有update权时PATCH，保持负责人/版本/固定修改原因，空期限null；成功关闭、清快捷query并刷新。
6. 评论发送原文，成功清空，失败保留，不擅加版本字段。
7. 删除当前详情普通成功按returnPath导航，不回列表load；在途关闭缺陷复用P23证据，不声称已修复。
8. 源呈现检查：转交无终态判断、五字段/返回 busy 锁、Escape守卫与详情CSS隐藏范围。
9. 挂载Vue桌面/390px逐项覆盖pause/cancel/delay/transfer/progress：写入 pending 时字段与关闭锁定，Escape不收窗；409后当前弹窗显示action_hint/请求编号、保留全部已填值，不自动重发；用户显式重试精确相同body后才成功收窗。五种失败截图各2张保留。受控响应不证明服务端冲突解决、真实RBAC、会话或数据库状态。

既有读取已经有active、路由归属、read key与Abort保护；本轮不把写入/视图选择差异泛化为所有GET缺隔离。后端、真实鉴权、持久化/事务、网络、原生焦点、完整生命周期和生产未复验。已知缺口断言在获审修复后应改为保护预期，不永久要求错误行为。

## 交付边界与下一步

全局当前25页局部语义审阅、537独立源位置、519逐页组；余48页同级核对。P24其余字段边界、逐控件视觉状态、长内容/主题、全路由与真实服务验收仍未完成；其余视觉由用户授权自动通过，但视觉同意不升级到交互/真实RBAC/数据库/M07-03验收。

静态验证器与审核JSON/说明为源结构审阅证据；新增 Vue 行为用真实挂载组件与本地拦截响应单独验证。生产Vue/CSS仅新增单窗错误反馈，不改 API/OpenAPI、后端/Worker/Python、数据库/迁移、env/配置、依赖、权限或业务状态；完成提交发布门与部署验收后再记录生产部署状态。

本轮新增10张永久失败状态参考PNG；首次测试产生的一次性 Playwright 失败附件待最终清理，其余正常测试输出按仓库规则清理。没有启动需交接的常驻开发服务；历史拒绝清理的三路径仍原样保留且不提交：`output/playwright/p16-layout-20260910/.last-run.json`，`output/playwright/ui-phase2-competitor-races-20260909/playwright.config.ts`，后者目录`results/.last-run.json`。
