# P46/P47 · 来源定义与适配器事实合同

日期：2026-09-08；实施基线main/c306e88，接续55a7439后的P46/P47与UI2-PR47在途草稿。范围仅B1a两页，不是W06八页完成，也不是正式设计、生产或用户验收通过。

逐页规格：[P46来源设置](page-specs/P46.md)、[P47采集程序](page-specs/P47.md)。两页各有十节；拟议布局待正式风格审核。静态记录来自实际Vue AST和handler/API/服务/仓储，不能把静态数量当运行时业务动作分母。最终图、全按钮状态、共享模态可访问性及真实授权仍须后续补验。

## 1. 真实装配、范围与API

| 页 | 装配与目的 | 读取/写入 | 边界 |
| --- | --- | --- | --- |
| P46 `/platform-admin/providers` | ProviderRuntimeSurface → ProviderRegistry；平台来源技术定义，四步编辑 | GET/POST `/api/v1/platform/providers`；PUT `/api/v1/platform/providers/{providerId}` | GET全数组、本地20条分页；写入provider:configure、Origin、Idempotency-Key，更新expected_version；没有独立删除、烟测、直接解除熔断动作 |
| P47 `/platform-admin/providers/adapters` | ProviderRuntimeSurface → ProviderAdapterCenter；程序注册/探针及运行事实 | GET `/api/v1/platform/provider-adapters`；POST `/api/v1/platform/provider-adapters/{providerId}/health-check`，无body | 全数组、本地20条分页；探针同样要求provider:configure、Origin、幂等，不是只读；没有登记/修改程序、批量探针入口 |

上述GET均在服务端重新鉴权并返回private/no-store。两页路由目录capabilities声明为platform:operate、platform:superadmin，API实际检查provider:configure；不把路由声明等同于API能力，也不凭此静态数组推断真实允许/拒绝结果。前端api-client添加/api/v1前缀和既有请求/幂等处理，本批不改其语义。平台来源不是组织连接，不添加organization_id/workspace_id输入。ProviderRuntimeSurface五条导航中P49/P50显示另需platform:superadmin，但菜单可见不能证明路由或API授权，真实权限拒绝要单独验证。

P46仓储读取按启用、name、id排序，无服务端分页；更新用SELECT version FOR UPDATE检查版本、冲突409、写入递增版本与不可变快照/操作记录。服务端清洗数组去重及trim，生成terms_reviewed_at；本批不执行真实数据库写入。

P47服务查注册表，缺程序时返回blocked/adapter_not_registered；已注册则调用真实healthCheck，可有网络副作用，recordHealth持久化健康、不可变版本与幂等操作。24h已完成子查询窗口与探针结果分开；成功率basis points÷100、空样本null不补零、P95不拿探针延迟替代。错误预算为max(阈值−运行连续失败,0)，恢复资格需open且ready探针时间晚于opened_at；检查不会关闭熔断，链接只去P70。

API的compatibility_matrix聚合留存HTML/DOM的页面指纹与解析版本，不等于P47模板已展示：本页只有类型声明，没有矩阵入口或渲染。矩阵具体界面属于ProviderSourceCenter相关入口，P48完整消费者审核留B1b；不据旧Feature Map或测试名声称本页有矩阵弹窗。

## 2. 直接候选逐项映射

文件别名：S=ProviderRuntimeSurface.vue，R=ProviderRegistry.vue，A=ProviderAdapterCenter.vue；均在apps/web/src/components。完整candidateId为该路径加`#`和下表签名。41个直接静态候选=S5+R22+A14；包含同一个提交的form/button以及定义/事件，不是41个独立业务动作。条件分支和重复行需要运行时扩展，不据此冻结全站分母。

| 文件 | 签名 | 动作/定义归属 | 实际入口、条件与结果 |
| --- | --- | --- | --- |
| S | 7d0657958d2afe06.1 | PR-NAV46 | RouterLink到P46；aria-current按routePath |
| S | c91c2e71e426b739.1 | PR-NAV47 | RouterLink到P47 |
| S | d6812914ba6d07da.1 | PR-NAV48 | RouterLink到来源频道，独立B1b |
| S | c56767a09d40c33b.1 | PR-NAV49 | superadmin可见，去1688检查 |
| S | 23ee0a87fa977a0d.1 | PR-NAV50 | superadmin可见，去凭证 |
| R | 7895edf33d41a47a.1 | PR46-CREATE | 页头edit(undefined,event)，内存技术默认值、disabled |
| R | 3eebd05a35b5e2d1.1 | PR46-LOAD | loadMessage时再次读取，保留快照 |
| R | d2b72f6631a5008b.1 | PR46-LOAD | UiStatePanel primary调用load；默认动作文案差异见PR-G04 |
| R | de4c1cd1ccf4c8da.1 | PR46-CREATE | 空目录且编辑器关闭时创建，与页头同业务动作 |
| R | 27f5c560567881c4.1 | PR46-LOAD | 列表工具栏刷新，refreshing禁用 |
| R | 0da6a9c39b0f685c.1 | PR46-RESET | 重置5筛选/排序控件，watch回第1页 |
| R | f9d454b64dd4b22a.1 | PR46-RESET | 过滤无结果时同一完整重置 |
| R | 478ad8851af1360d.1 | PR46-EDIT | 桌面行edit(item,event) |
| R | 5d4463e03e3aa18b.1 | PR46-EDIT | 移动详情先close预览再edit；原触发可能卸载 |
| R | 1c008f867673db60.1 | PR46-TECH-ROW | 原生details/summary展开ID/目标/解析等技术值 |
| R | 83d11b8719b1c99d.1 | PR46-PAGE-PREV | 本地上一页，边界禁用 |
| R | bd43d7b540116c32.1 | PR46-PAGE-NEXT | 本地下一页，边界禁用 |
| R | b899ac570cd48224.1 | PR46-CLOSE | 自定义遮罩mousedown.self调用closeEditor |
| R | 33a2c5d568a6c67c.1 | PR46-EDITOR | role=dialog定义；创建/编辑×四步，不是八个独立定义 |
| R | fab2f2181783074f.1 | PR46-CLOSE/SAVE | 表单Escape关闭，submit.prevent保存；和提交按钮同调用链 |
| R | e03ff4bf86eb6a89.1 | PR46-CLOSE | 编辑器命名关闭按钮 |
| R | 71fedaee68dde679.1 | PR46-STEP-JUMP | v-for四步骤，直接跳步不做当前组校验 |
| R | 83ffe5899e1ccfcf.1 | PR46-TEMPLATE | 按五模式应用技术模板，覆盖共用策略及fields/failure_rules |
| R | 1c008f867673db60.2 | PR46-TECH-FEEDBACK | 编辑反馈关联号技术详情 |
| R | 4ba7742e75103fa4.1 | PR46-STEP-PREV | 上一步，内存字段保留 |
| R | d0e6c4e6deaeab8a.1 | PR46-STEP-NEXT | 校验当前组再下一步 |
| R | 476b79a4175dbc41.1 | PR46-SAVE | type=submit；创建POST/编辑PUT+expected_version，busy防重复 |
| A | 92930355cc4e2a4f.1 | PR47-LOAD | 刷新，refreshing禁用 |
| A | 3d1c1781d275b76d.1 | PR47-DEFINE | 页头返回P46，仅导航 |
| A | d2b72f6631a5008b.1 | PR47-LOAD | 状态primary调用load；不是登录或返回工作台 |
| A | 0da6a9c39b0f685c.1 | PR47-RESET | 工具栏完整resetFilters |
| A | d1614ad8db6bddf9.1 | PR47-DEFINE | 无来源时“登记来源”去P46，不是登记程序 |
| A | 2c7db35d039ef2f4.1 | PR47-RESET | 过滤空态“清除筛选”，本批改为同一完整resetFilters |
| A | 96211fe8b4dfe48d.1 | PR47-RECOVER | 桌面open且恢复门满足时链接P70，不发恢复请求 |
| A | b02f109125f46ed4.1 | PR47-PROBE | 桌面probe(item)，probing非空禁用全部探针按钮 |
| A | efa5a28bbc761600.1 | PR47-PROBE | 移动详情probe(row)，相同接口/副作用 |
| A | 2cf3eb393d8269a0.1 | PR47-RECOVER | 移动同条件去采集调度 |
| A | 1c008f867673db60.1 | PR47-TECH-ROW | 移动详情技术标识/错误码 |
| A | 369397a871aefe1e.1 | PR47-PAGE-PREV | 本地上一页 |
| A | e193aebbbf403ff8.1 | PR47-PAGE-NEXT | 本地下一页 |
| A | 1c008f867673db60.2 | PR47-TECH-FEEDBACK | 反馈关联号展开 |

历史A空结果候选3670aecf7cfb60e1.1（仅清mode/health）对应现在2c7db35d039ef2f4.1（resetFilters），语义仍PR47-RESET；保留此映射，不把候选变化冒充新增功能。全局生成清单和旧图库保持原来源，R01按实际影响更新，不只替换hash。

## 3. 输入绑定及字段边界

直接v-model绑定34处=R28+A6；S无绑定。下表保持AST源码顺序，R编辑字段23处不包括只读返回字段。各组基数不是创建/编辑/模式展开后的实例总数。

| 文件 | 组 | v-model表达式 |
| --- | --- | --- |
| R | 列表5 | searchQuery, statusFilter, accessModeFilter, admissionFilter, sortOrder |
| R | 基础5 | form.code, form.name, form.target_url, form.owner_label, form.access_mode |
| R | 范围6 | form.markets, form.languages, form.fields, form.dedupe_key, form.parser_version, form.healthcheck_url |
| R | 执行7 | form.schedule_minutes, form.concurrency_limit, form.timeout_ms, form.retry_limit, form.circuit_failure_threshold, form.retention_days, form.failure_rules |
| R | 发布5 | form.terms_review_status, form.status, form.terms_reference_url, form.terms_version, form.terms_expires_at |
| A | 目录6 | query, mode, providerStatus, registration, health, sort |

| 字段 | 现有约束与转换 | 必须区分 |
| --- | --- | --- |
| code/name/owner | code小写字母数字下划线2–80；name2–160；owner2–120 | 不从标题生成平台真实code，不猜负责人 |
| target/access | 五模式public_page/public_rss/authenticated_browser/import/manual；目标1–1000，非导入/人工需要HTTP(S) | 浏览器URL校验拒绝账号信息；后端target/health URL校验不完全相同，不宣称前后端完全等价 |
| markets/languages/fields/failure_rules | 逗号拆分trim去空，服务端再去重后1–100项 | 不新增市场或字段业务默认；新建技术模板不是事实数据 |
| schedule/concurrency/timeout/retry/circuit/retention | 整数范围分别1–10080分钟、1–20、1000–120000ms、0–10、1–20、1–3650天 | 本批无阈值、单位、默认值改变 |
| dedupe/parser/healthcheck | dedupe1–255；parser字母数字点下划线横线1–80；healthcheck可空HTTP(S) | 不新增探针目标或凭证 |
| terms/status | pending/approved/rejected；draft/disabled/enabled；可空HTTPS参考、版本、ISO到期时间 | 公开来源enabled要求approved+参考+版本+未来到期；日期切片→本地输入→ISO可能有时区差异，待验 |
| 更新锁 | 编辑PUT携带当前version为expected_version | 409保留输入，不自动重放写入 |

R的edit用Object.assign把item展开进form，save再展开form：因此23个可编辑字段不是精确网络body白名单，可能残留id/version/updated_at等只读属性；由编辑转创建的清理与body合同需要PR-G03验证。本批不擅自删除字段或改变请求契约。模板只覆盖共同执行默认与fields/failure_rules，不覆盖code/name/target/owner/terms/status；重复应用会覆盖用户已改策略值。

## 4. 共享控件、模态与消费者差异

D=ResponsiveDataView.vue，T=TableViewControls.vue，U=UiStatePanel.vue。以下10个共享静态候选另计，不能加到每一页再宣称去重业务分母；加直接候选共51个源位置。T另有density一个v-model；本次核对总35绑定。

| 文件 | 签名 | 共享行为与本族消费者 |
| --- | --- | --- |
| D | 6da4dad42cb34c8d.1 | 移动行show(row,event)，P46定义预览/P47运行预览两个内容变体 |
| D | 4fa7deb3456a41ae.1 | overlay Escape关闭并回触发按钮 |
| D | 53d89072117d7eda.1 | scrim命名按钮关闭 |
| D | e23893d134b1daa1.1 | role=dialog定义，标题来自detailTitle；没有native模态或焦点循环证明 |
| D | 847801b2ac6e7a17.1 | 标题区关闭，初焦点落此按钮 |
| T | e2fd0d02cbd9f684.1 | 列设置原生details/summary，只在识别列数>1时显示 |
| T | 921f4be18a3fe814.1 | 动态每列checkbox，toggleColumn，至少留1列；两个不同表格消费者 |
| T | d09cd5524db7bee5.1 | 冻结第一个可见列，aria-pressed，内存设置 |
| U | 589e8eedc7c9c864.1 | primary emit，两页均仅接load |
| U | 3eebdb6b72e10446.1 | secondary emit，两页均无handler，仍可能按默认文案显示 |

T的density为standard/compact，设置表格dataset及DOM列显隐；不是服务器主题偏好。列由表头动态识别，不能把模板单个@change算作一列；详细列/状态展开仍需运行时审核。D的selected从当前rows按key查找，分页/过滤/探针更新导致行消失会让弹层消失，原触发也可能卸载；它只实现show/close初焦点与回焦点，没有Tab循环、背景inert或缓存离开清理保证。

R编辑器为一个自建form role=dialog，两业务模式×四步骤，另叠五access_mode、条款/状态条件和校验/提交反馈；P47没有本地native业务模态。不是“两个页面没有弹窗”。R下一步只校验当前组、步骤按钮可直接跳、最终submit全表校验并定位最前错误组；关闭按当前代码清编辑选择和message但不清form。保存忙时的遮罩/Escape、失败留输入、移动预览转编辑的回焦点均列PR-G02/03。

## 5. 状态、异步与未完成事项

| ID | 证据与影响 | 后续验收/决定；本批状态 |
| --- | --- | --- |
| PR-G01 | 蓝图5.1把条款/robots称为可选管理信息；5.2、真实Registry服务和执行政策又要求公开来源条款；5.1要求保存停用→烟测→版本锁启用，但本次P46直接create/update链未见烟测门 | 独立确认对应入口的启用规则并追P48/执行端，不借UI重构绕过或加造门禁。本批只记录矛盾，未改规则，不把P46局部阅读当全局旁路结论 |
| PR-G02 | R/D自建模态无完整焦点循环，R字段错误未逐项aria-describedby关联；T样式部分36px不能证明全44px | 两视口+键盘/ShiftTab/Escape/关闭/回焦点、背景隔离、首错误、软键盘及实际计算尺寸；未验未改共享组件 |
| PR-G03 | R读取catch检查controller但success/finally不完整；A每次load独立controller；写反馈无窗口代次；R保存后load失败仍可能说已刷新；两页刷新401/403可留快照 | 逐条延迟成功/失败、换对象/路由、KeepAlive、关重开、读写交错复现；错误真实性、日期及form附带字段另验。本批不以reset测试关闭这些项 |
| PR-G04 | U默认expired“重新登录”、forbidden“返回工作台”实际均load；error/forbidden/blocked的secondary无消费者 | 按现有安全导航合同逐页绑定真实恢复或准确文案，不能全局修改无关调用方。当前是源证据，未做本批浏览器行为复现 |
| PR47-RESET | 旧空结果按钮只清mode/health，query/status/registration/sort残留 | 本批已复现query残留，复用resetFilters；4种原因定向通过，整个Adapter模块桌面/移动各8项通过 |
| PR-G05 | 正式新布局与图、所有弹窗/状态/主题密度、真实后端/角色/生产/用户审核未交 | 保持W00–W09未完成；本批只补两页事实与一处已证实局部交互，不作为全新风格实施完成 |

两页加载状态为loading/ready/empty/error/expired/forbidden/blocked；零来源与过滤零结果分开。刷新保留数组时标明快照，不把旧数据当健康成功；A最近刷新时间是浏览器读取完成时间而非服务器采样时间。探针替换同id对象可能重排/移出当前过滤，不能把健康检查成功当列表所有事实都更新。

## 6. 本批行为证据、使用和边界

原红测句柄86699已确认终态：点击清除后搜索仍为no-such-adapter，toHaveValue空字符串失败；更早一次失败仅因getByLabel排序定位器不匹配，不能计产品复现。修复后UI2-PR47四种空结果原因检查六控件复位、2结果、首分页、单次目录GET及该目录零写入。测试使用真实Vue和隔离API返回，不调用真实健康检查或数据库。

实际运行：UI2-PR47桌面定向4通过；m03-03-provider-adapter完整桌面8通过、mobile-390共8通过。已有模块测试名含matrix/visual不代表P47兼容弹窗或正式设计已验。命令为现有Playwright配置、workers=1，桌面/移动串行；完整其他门与清理结果见[PROGRESS.md](PROGRESS.md)本批记录。

用户使用：搜索/筛选到无结果时点击“清除筛选”，恢复全部当前已读取来源、默认排序和第一页；它不重新请求目录，不执行探针或扩大后端数据范围。代码仅A按钮和说明、永久测试；无新API/字段/SQL/环境变量/依赖，Registry代码未变，不重复无变化的Registry/Node/Python全套。后续发布仍走宝塔部署器核对迁移和Node停启窗口，本批未部署，不需要单独后端配置或重启。

## 7. 当前源指纹（LF SHA-256）

指纹对应本批真实内容，不声明该内容已存在于基线c306e88，也不修改旧图来源。以下15源用于本次静态可重检性，不是运行时证明。六Vue候选/绑定由现有scanSource及Vue AST只读核对；规格路由、十节、本地链接和源码hash另验。

| 文件 | SHA-256 |
| --- | --- |
| apps/web/src/components/ProviderRuntimeSurface.vue | a00c9a5067e5756da93c4ea7b88d6a42cca963202eda533ab3ce96d16c5856a6 |
| apps/web/src/components/ProviderRegistry.vue | e98ec358ce10015bca5cac1ff9e5b433411bcdc49cb60654458ebed31e4c2a2e |
| apps/web/src/components/ProviderAdapterCenter.vue | 0ef775e4638ffdee87eb12caf959891d30b52932f4b5eb6b9b96ebec88851075 |
| apps/web/src/components/ResponsiveDataView.vue | 28fa47d1a8beac1666c0cf8be1316484abd39729682a68adb4fed803742f2aaa |
| apps/web/src/components/TableViewControls.vue | d0611b8367773f915a885c6c09f34c958fed67e7b99110abec20bb0febeea9ff |
| apps/web/src/components/UiStatePanel.vue | 8f0c147245627493cf5d235162b9dc00424875d0296e710f180a3365c603c164 |
| apps/api/src/provider-registry-routes.ts | 0b7eba02f7b56b9fd37c39c6efc905697883cbaf92ba02d7464f7ab2c5e7a326 |
| apps/api/src/provider-registry-service.ts | df147a6ad0de04b8f4b0aaf7c479676efdda6ca180a7c979e2ee36accdd3c47c |
| apps/api/src/mysql-provider-registry-repository.ts | 9ae963936c1ba33b505113bf4d35446d80faee347c94dd94d97bc4ea701ebb58 |
| apps/api/src/provider-adapter-routes.ts | c05435d102362ed3a12241e1fe2c824b4a65d512cb3a13ddaceea8f75b668410 |
| apps/api/src/provider-adapter-service.ts | 6a6ac254d3f93a72ba443652f4a2f40d6039428f898ae49e2e34c9211d46f669 |
| apps/api/src/mysql-provider-adapter-repository.ts | e17a94d2967a6db9fb611152999f52d718a1349f2ca5053e84b85c9f3123c963 |
| apps/web/src/api-client.ts | 953c3da783121a797a86ff82e03a968067ae2c694a4fb5f883187b04569fa9ff |
| apps/web/src/ui/state-contract.ts | 9c912b4c0507506484cf04b623839869022fdc68eb6ee332e3cb638dee3b267a |
| config/route-catalog.json | d02ade33d087f133ddada8c087085e12c1d321b72f35cd1ef6ffb155076e8150 |
