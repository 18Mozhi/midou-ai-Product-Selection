# P22 · 费用规则逐项审核与实施边界

2026-09-10，起点main/1b95992e。按已选C方向、蓝图M04-04和实际CostRuleConsole核对，不将全局C方向当作P22获批。ui-skills-root/frontend-design用于区分版本浏览、显式费用输入与审批操作；本批不改生产UI或规则。

[打开既有166张桌面/手机图](design/cost-rules-direction-c/gallery.html) · [页面规格](page-specs/P22.md) · [机器可核对清单](action-reviews/P22.json) · [真实合同](sourcing-cost-contract-review.md)

## 范围与数量

30个本地源位置归为20组：18个页面动作组、2个窗口定义关联组；其中只有“保存草稿”和“确认版本操作”直接写入，七种审批入口只打开确认窗。表单与提交按钮不重复算写动作，两个返回链接与两个互补创建入口保留调用条件后归组。19个v-model绑定为2个筛选、15个草稿字段、2个操作字段；7个结构容器为3个form、2个dialog、2个说明aside，不是7个弹窗。

原有166PNG保持不变，本次建立具体动作/结构到已有场景的关联，不宣称新增图片或全状态通过。104个代表视觉槽仍未逐项绑定；这是待核对槽，不等于缺104张图。草稿人工/自动成本字段变体与七操作变体已分别关联。19字段还需要原生校验、错误关联、键盘、主题与不同内容长度的实际呈现审核。

## 按钮逐项合同

| 动作组 | 条件及实际行为 | 对应图/剩余核对 |
| --- | --- | --- |
| 返回两个入口 | 安全from，只允许/sourcing边界内部路径，否则回找货；不写入 | directory/no-active；完整history与编码/数组query待验 |
| 创建两个入口 | opportunity:approve；非ready或有active用顶部，ready无active用准备度入口；打开重置表单，不POST | create-blank/automatic；两位置实际焦点与忙碌呈现待验 |
| 异常恢复 | empty且管理者打开创建，其他主按钮load；副按钮返回；loading无按钮 | empty/error/expired/forbidden/blocked；不伪造登录/申请权限 |
| 搜索与状态筛选 | 本地computed，搜索名称/市场/平台/版本；改筛选页码回1，form仅prevent | filter-empty；不把表单算额外远程搜索按钮 |
| 重置筛选 | 空search且all时disabled；只清筛选 | directory/filter-empty |
| 版本行选择 | selected更新，合并query并replace规则ID；无HTTP | directory/page-two；选中与按下不同 |
| 上一页/下一页 | 每页10条，只有多页才显示，边界禁用 | page-two；watch自动换选中项与URL不同步见下文 |
| 查看汇率来源 | 使用已保存source_url，新窗口+noopener noreferrer | exchange-basis；不访问示例外站或声明汇率有效 |
| 提交审批入口 | 管理者+draft，busy禁用，只beginAction | submit-confirm |
| 批准两角色入口 | pending_approval+真实角色+该角色尚未处理，busy禁用 | selection/admin-approve-confirm、one-approved、manager-only |
| 拒绝两角色入口 | 与对应批准相同角色边界，busy禁用 | selection/admin-reject-confirm；不偷换为另一审批角色 |
| 发布入口 | 管理者+approved；busy禁用 | publish-confirm；真实服务仍验证双角色与revision |
| 回滚入口 | active且同市场/平台approved或retired候选非空，busy禁用 | rollback-confirm/no-rollback；不恢复跨范围版本 |
| 草稿关闭/取消/Escape | 同closeCreate：busy时拒绝关闭；底部取消disabled，右上X无disabled | create-busy/conflict；源“点击无效”与提案“可见禁用”不能混称 |
| 保存草稿 | 表单/submit同create；busy或本地校验失败禁用，显式0保留 | create-zero/invalid/conflict/busy/saved；只保存draft，不自动审批 |
| 操作关闭/取消/Escape | 同closeAction；busy拒绝关闭，不撤销已发请求 | 七变体；右上X与底部取消的disabled差异仍在 |
| 确认操作 | reason trim至少2，版本取提交时selected；按操作附role/target；post单飞 | 七confirm/busy/conflict；原生maxlength与函数校验分层 |

## 历史缺口复现证据（2026-09-27；已于2026-09-28修复）

新增永久`node scripts/verify-ui-phase2-cost-rules-review.mjs`。复用原9组源码检查，再执行3组真实setup隔离检查；无浏览器DOM、真实HTTP、数据库或审批写入。

1. **确认目标归属缺口曾复现**：选A并打开提交审批，输入“A的依据”；另一次load只返回B后，窗口仍开、原因仍属于A，但selected曾变B；旧隔离脚本观察到操作会漂到B。已由操作快照固定规则 ID、显示上下文和 `expected_revision` 修复；桌面/390px真实挂载回归现验证路由选择切至B后确认仍只向A提交。
2. **本地筛选与URL曾不同步**：初始rule=A，筛选B曾令selected变B但query.rule仍A。现在筛选/分页自动选择与显式选择统一写入 rule ID；搜索/状态筛选本身仍为本地状态且不进入 query。挂载 Vue 双端回归覆盖。
3. **query变化曾不更新已挂载选择**：query.rule改为B曾不会换选中。现在 query-only history/popstate 变更会选择目标；若目标被本地筛选隐藏则清除本地筛选；后续load也优先按有效 query 恢复。挂载 Vue 双端回归覆盖。

原9组同时继续验证四项空值阻止提交/显式0、可选物流和CNY→表单币种、权限加真实角色、同范围回滚、七个准确payload、POST单飞/关闭、初始第2页选择、草稿成功仍draft及SC-G05晚GET覆盖。所有样例ID、原因、响应为隔离数据。新脚本若源行为变化会失败，需根据实际修复更新预期，不能把当前缺陷永远作为正确产品合同。

## 2026-09-28 · 选择 query 与确认操作目标闭环

`CostRuleConsole`现将有效 `route.query.rule` 作为加载/刷新优先选择；本地筛选或分页导致自动换选中时只同步 `rule` ID，不持久化筛选字段；已挂载页面接到 query-only 路由变化时同步选中项，并确保该规则可见。确认窗目标仍取 `beginAction` 打开时快照。新增桌面 Chromium 与390px手机的三项 mounted Vue 场景：筛选/分页 URL 对齐、history/popstate选择恢复、操作确认期间切换规则仍精确提交A及A的revision；完整 M04-04 桌面与390px套件各13/13通过。旧 P22 页面图稿快照与现行 C 实际 Vue 存在旧布局差异，只更新对应成本规则页面桌面/手机快照，其余截图未变。原隔离 setup 检查现有9项加修复核验4项通过。上述本地测试不证明真实角色、数据库、审批服务或浏览器辅助技术。

## 实施时必须保持的边界

已存在的C稿以版本目录、费用依据和审批进度分区；草稿保留显式费用，不把可选物流/汇率空值等同所有人工成本失败。自动范围仍只允许既有phone_case，汇率目标币种来自表单，不推断实时汇率或费用默认值。发布和回滚不改历史利润运行。

上述SC-G05复现已在2026-09-27按局部安全边界修复：并发GET仅接受最后发起请求的响应；操作窗保存打开时规则ID、显示上下文及`expected_revision`快照，之后即使列表选中项变化，提交仍绑定原规则。隔离setup验证覆盖“A打开操作→读取返回B→确认”和乱序GET。该修复不改变API、URL选择策略或状态业务规则；不代表真实鼠标路径、读屏、RBAC或生产审批已验收。草稿字段统一busy禁用及X忙碌样式仍只是待审提案，未纳入本次。

父NavigationShell按reset_on_scope的组织/工作区key隔离，并向CostRuleConsole传真实roles/capabilities；局部没有请求代次不等于服务跨租户。QualityGateSetupSummary仅显示父组件首active投影；UiStatePanel和useModalDialog是共享依赖，不因P22映射就签收其全部调用页。

## 验证与交付

- 最小：新源码检查12组（原9+新3）；动作审计严格核对30源位置、合同末列、19模型和7容器/32变体关联，漏项或来源漂移失败。
- 图册复验：沿Playwright技能复用已有`node scripts/verify-ui-phase2-cost-rules-c.mjs`，核对原图/来源哈希及离线交互，不重拍未改的166图。具体结果见PROGRESS。
- 全局更新为23页局部语义审阅、510独立源位置、447组；其余50页待同级核对。完整页面批准、全站动作分母与G0–G5不提升。
- 新脚本无参数，只读取源并运行内存夹具；现有审计器`--write`更新报告。无新env/配置/API/OpenAPI/数据库/依赖或生产服务，后端/Worker/Python不相关且未改，无部署/重启要求。
- 新脚本、审核清单与文档是永久交付；本批不创建一次性文件。既有3个清理被拒文件不操作：`output/playwright/p16-layout-20260910/.last-run.json`、`output/playwright/ui-phase2-competitor-races-20260909/playwright.config.ts`及该目录`results/.last-run.json`。

下一步继续P23及后续页面的同级核对；已提交P16按钮等待具体审核，获批页再实施、真实验证及宝塔签收。P22关联图册不是第二阶段完成。
