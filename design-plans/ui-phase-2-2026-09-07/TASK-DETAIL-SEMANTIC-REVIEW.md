# P24 任务详情：逐项审核与实施缺口

2026-09-10，基线main/87369638。沿已选C方向，使用ui-skills-root/frontend-design核对真实路由、职责和控件行为；不是重新选风格，也不把P16布局批准迁移到本页。

[详情与更多操作图](design/task-direction-c/README.md) · [五操作及编辑/删除图](design/task-direction-c-forms/README.md) · [逐项清单](action-reviews/P24.json)

## 实际页面范围

`/tasks/:taskId`由TaskWorkspace(mode=all,taskId)编排，TaskDetailPanel显示常驻详情aside，不是列表抽屉或模态框。本页48个源位置归33组：28页面动作、4事件/定义关联、1组隐藏列表壳层来源。7类写入组不是7个新API。三处原生dialog对应新建/编辑、删除、五单项，共8业务变体；5个父v-model、8处结构、18个容器变体关联。子组件评论及五操作字段通过事件受控，不能因无v-model就漏记。

**共享DOM不等于可见入口**：`task-workspace-enhancements.css`隐藏详情根下除详情、dialog、状态和notice外的子元素，头部新建、业务/导出Tab、列表/批量、分页和导出区均隐藏。旧任务合同“头部入口可在详情存在”是共享DOM描述，不足以证明当前可点击；本页清单按CSS明确排除，不修改旧图来源合同。

首次带`?create=1`仍可依task:create打开新建窗，虽然没有可见新建按钮；不能把新建变体完全排除。另有待修差异：带`?view=exports`且有report:read时，load在taskId分支前读取导出，首次selected为空，而导出区又被CSS隐藏。源码组合能证明读取偏离详情；实际空白呈现、URL修复和缓存返回须真实浏览器验证。本轮不擅自更改URL合同。

## 按钮与弹窗设计约束

| 区域/动作 | 必须保留的语义 | 图稿与待细化状态 |
| --- | --- | --- |
| 返回详情来源 | 只接受/work、/tasks及其query，否则/tasks；真实RouterLink | detail；长标题下独立44px返回热区、有效/无效from |
| 关联采集任务 | 仅有collection_task_id时展示，目标平台采集页裁决权限 | 关联有无、目标拒绝不能由固定样本抵扣 |
| 技术详情/更多操作 | 两个原生details；收起真实隐藏内容 | detail/more；focus、只分配权、终态菜单待补 |
| 开始/继续/完成 | todo开始、paused继续、三非终态完成；task:update，busy禁用，直接POST | 不凭空新增确认窗；完成只按返回区分评分入队/缺规则，不显示评分已完成 |
| 更新进度/暂停/延期/取消 | 进度/延期/取消非终态，暂停in_progress；打开表单并预填事实 | progress/pause/delay/cancel；各入口及失败/busy不能只共用一张进度图 |
| 转交负责人 | 单项独立task:assign，源码无终态限制；不能套用批量资格 | transfer；只有分配权、目录失败/空、终态待补 |
| 编辑 | task:update，不额外排除终态；四字段，PATCH保留负责人和版本 | edit；标题200、说明5000、四优先级、可空本地期限 |
| 快捷新建 | 首次create=1并task:create；当前详情无可见创建按钮 | create；快捷参数清除、来源返回和草稿待验 |
| 删除打开/提交/关闭 | task:update，目标事实与版本，原因trim；删当前详情成功返回from | delete；普通成功已作源检查；P23已复现原生关闭晚到空引用，未修 |
| 评论输入/提交 | task:update，required/max2000，busy禁用；trim仅判空，发送原文 | detail仅关联；独立label、空白/长文/失败/忙碌与活动增长待补 |
| 单项表单确认 | 五变体各自字段，POST action/version；原因/说明trim，期限ISO | 五表单已有双端稿；不能新增API、版本字段或自造成员 |
| 表单字段/返回/Escape | 五字段及返回当前无busy禁用；Escape回调也无busy保护 | 需明确提交快照与当前草稿差别，关闭不撤回已发请求；获审后统一交互 |
| 重新加载 | 五种详情错误区load；正常仅详情与成员目录 | error/not_found/forbidden/expired/rate_limited；不是登录或申请权限按钮 |

两任务图包现有60PNG属于P23/P24及审核board共享交付，不是P24新增60图。本批没有重拍或新增图片；关联已有详情、只读、更多、五单项、编辑/删除和读取异常，不把列表/批量图充作详情控件证据。164个代表视觉槽尚未逐selector登记；不等于恰缺164张图，也不代表其他已关联状态获批。

## 新增验证证据

`node scripts/verify-ui-phase2-task-detail-review.mjs`提取真实函数到隔离VM并用惰性边界执行8组检查：

1. 普通详情准确读取任务→成员，不读列表/summary；有权限exports query优先分支偏离详情；无权限零API转business意图，未模拟后续watch。
2. 开始/继续/完成三个body、五个只开表单入口、完成的两种auto_score_status文案。
3. 五表单精确字段与expected_version；单项转交独立分配权限。
4. 在途修改进展说明不会进入已发送body：成功仍关闭表单，新说明只留本地；失败保留当前草稿。这是源ref组合，不冒称浏览器输入或服务器冲突证明。需补明确提交状态，而非暗示新输入已保存。
5. 编辑在无create但有update权时PATCH，保持负责人/版本/固定修改原因，空期限null；成功关闭、清快捷query并刷新。
6. 评论发送原文，成功清空，失败保留，不擅加版本字段。
7. 删除当前详情普通成功按returnPath导航，不回列表load；在途关闭缺陷复用P23证据，不声称已修复。
8. 源呈现检查：转交无终态判断、五字段与返回无busy禁用、详情CSS隐藏范围。源码检查不等于浏览器布局/键盘验收。

既有读取已经有active、路由归属、read key与Abort保护；本轮不把写入/视图选择差异泛化为所有GET缺隔离。后端、真实鉴权、持久化/事务、网络、原生焦点、完整生命周期和生产未复验。已知缺口断言在获审修复后应改为保护预期，不永久要求错误行为。

## 交付边界与下一步

全局当前25页局部语义审阅、537独立源位置、519逐页组；余48页同级核对。具体P24设计、全字段/按钮/异常/主题、真实Vue及最终宝塔验收未完成，下一P25。用户已批P16整体布局，不代表本页或全站批准。

新验证器无参数，仅读源码和内存检查；审核JSON与说明是永久交付。生产Vue/CSS、API/OpenAPI、后端/Worker/Python、数据库/迁移、env/配置、依赖、权限与宝塔均未改，无新配置、部署或重启要求。已有任务图包及验证输入未变，复用上一批同源通过结果，不宣称本轮重新浏览器执行。

无新一次性文件、截图、日志或服务；历史拒绝清理的三路径保留且不提交，不重试绕过：`output/playwright/p16-layout-20260910/.last-run.json`，`output/playwright/ui-phase2-competitor-races-20260909/playwright.config.ts`，后者目录`results/.last-run.json`。新增代码/文档不是临时测试产物。
