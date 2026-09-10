# P28 报表与导出 · 源动作与逐态图核对

2026-09-10操作增量：[创建/下载/刷新回执](P28-OPERATION-OWNERSHIP-REVIEW.md)。24源及24真实Vue双端场景通过；新增独立视图代次，创建/刷新防重入与销毁后标志保护、下载错误归属和URL释放。原14源控件及接口不变，重新生成函数等待并发跳转政策选择，不将局部修复或源指纹更新算成按钮批准。

2026-09-10读取增量：[真实读取批次与详情归属](P28-READ-OWNERSHIP-REVIEW.md)。24项源逻辑回归和22项真实Vue双端场景通过，报表/导出同批首错失效，关闭/清参数/新详情/销毁后旧详情不再落地。仅组件script变化，模板/接口及原90+208图布局不改，按新源码复核；下方“读取归属未改”为上一批历史，写入/下载/完整缓存范围仍待。

2026-09-10，基于干净main/41a71b92。本批承接已选C方向，新增独立按钮图册与P28动作登记；不是完整页面批准、真实Vue改造或部署。

## 源路径与分母

AGENTS → Feature Map reportsExports → ReportCenter.vue → report-routes/service/mysql-report-repository → report-export-worker。产品总纲规定聚合事实、异步CSV、下载有效文件以及重建过期/最终失败记录。既有[局部合同](automation-report-contract-review.md)已列14个源候选，本批将它们显式归为10个业务/导航/本地动作与1个模态接线组；下载是读取文件，写入只有创建导出和重新生成两个语义组。

| 动作 | 源位置/入口 | 关键约束 |
| --- | --- | --- |
| RP-CREATE | createExport | 三种report_type与固定csv；空报表仍能创建；202仅入队 |
| RP-TYPE | choose(v) | 三类型，机会省略query，当前选择早退；aria-pressed不是禁用 |
| RP-TECH | 两处summary | 页面requestId与详情错误码分别绑定；原生折叠，无HTTP |
| RP-LOAD | load() | 五类读失败重载；不改变报表范围或日期 |
| RP-REFRESH | refresh | 后台刷新保留可见报告，refreshing禁用本按钮 |
| RP-TASKS | RouterLink | /tasks?view=exports；不伪造业务任务 |
| RP-DOWNLOAD | 列表download(item) | succeeded且未到期，原始文件GET；blob URL用后释放 |
| RP-REGENERATE | 列表与详情两入口 | bodyless POST；新ID，旧记录不覆盖；time/dead_letter服务边界不变 |
| RP-DETAIL | openDetail | export query及GET；不存在/无权清参数，不伪造记录弹窗 |
| RP-CLOSE | closeDetail | 按钮/Escape归同一关闭动作，保留其他query，不撤销事务 |
| D-RP-EXPORT | dialog定义+cancel接线 | handleDetailCancel经useModalDialog到closeDetail，不再算一个写动作 |

组件没有v-model输入，没有日期、格式编辑或表单；仅1个原生dialog。登记17个关联状态，其中15个匹配窗口，2个（不存在/无权）是明确无记录窗的页面反馈，不算额外弹窗。

## 新图稿与验证边界

[逐按钮C图册](design/report-controls-direction-c/README.md)新增208PNG：10代表控件、14扩展变体。代表控件对应48条精确状态引用；8个当前源码无禁用/忙碌呈现槽与4个导航槽单列。14变体对应60条状态引用，不增加业务动作数。默认、真实hover、键盘Tab焦点、鼠标按下分别截图；在途由既有场景或原控制器hold呈现，不直接伪造disabled属性。选中报表与鼠标按下分开验证。

沿用原REPORT-C-r1蓝色类型目录、白色报告及独立导出队列；父HTML/CSS/controller/数据均未改。本包只把可操作技术summary改16px，并增加审核工具入口。目检发现模拟按下留下文本选区后，验证器在截图前清选区并断言为空，再完整重拍。

复用原90图及其惰性源执行验证：三CSV请求body、无body重建、query/新ID/null/0/到期、组织成员与工作区任务SQL、服务下载409/410/503顺序；浏览器只操作隔离图稿。新图验证44px热区/16px字号、真实状态、点击命中/无横向溢出，过程中业务state、路径与意图不变。仅busyClick准备场景记录明确的合成POST意图；不连接HTTP、数据库、Worker或真实文件。

新7项登记测试检查14源位置、10动作、1窗/0输入、208图精确归属；遗漏源位置、伪造日期字段、借错selector/手机图、错误cancel、源码漂移或假批准均拒绝。登记生成器只按人工核对的sig/语义/完整合同别名构建，必须有已验证的当前源hash，不从按钮文本猜写入。

## 未完成

0代表槽缺图不等于全部按钮组合通过。尚缺全部导出行/报告类型/状态/主题/密度/角色/原生200%缩放组合及最终Vue同状态对照。单busy的离线控制器不能证明真实四个独立忙碌状态的所有组合。下载函数拦截任一在途下载但源按钮仅禁用当前行；重建不同ID并发与旧finally、读诊断/详情/写后刷新/KeepAlive/跨范围仍待审计，不通过图稿修正或掩盖。

RP-G01–G04/F03-G05保持待办；expired标签与服务时间规则差异、团队人数/任务口径及原夹具汇总/明细差异保留。当前全站目标仍73路由，用户尚未批准P28整体或按钮；P27新建后新增草稿的处理问题仍待用户选择。

## 使用与交付

直接打开图册或交互HTML，无需服务。`node scripts/verify-ui-phase2-report-controls-c.mjs --smoke`执行最小检查；`--capture`生成永久208图/evidence/gallery；无参数只读核对。`node scripts/build-ui-phase2-report-review.mjs --write`生成登记，`--check`校验；无运行时新配置。

本批不改apps/、API/OpenAPI、数据库、Worker/Python、依赖或.env；未部署、无需重启。新增测试、图证和文档为永久交付，浏览器/context通过finally关闭，临时审核下载清理结果及完整门禁见PROGRESS。
