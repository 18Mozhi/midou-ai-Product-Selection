# B2a · 数据中心与治理目录事实合同

2026-09-12 P55治理目录实现追加：[P55治理交互实现](P55-GOVERNANCE-INTERACTION-IMPLEMENTATION.md)把 C 方向五分类蓝色目录、白色版本/责任工作区、桌面表格与原生详情、手机等价详情、温和权限提示和独立空结果装入真实Vue。当前23个局部候选归并为8组动作；查询草稿、成功快照和目标范围分离，KeepAlive停用时中止读取并以代次隔离迟到响应，激活后刷新且不重写URL。`rate_limit_count=0`按事实展示，不再被truthy判断隐藏。API、SQL、字段、权限和写入合同未改；12张当前Vue图、双端夹具及源码映射不等于真实DB/RBAC/生产或用户批准。

2026-09-12 P54证据质量实现追加：[P54-证据与质量交互实现](P54-QUALITY-INTERACTION-IMPLEMENTATION.md)将蓝色核对路径、白色三任务工作区、原生溯源/原因窗、手机等价选择、冻结批处理、下载单飞、独立写入/重读反馈和未知结果防重装入真实Vue。质量动作清单按当前源码重绑为39个候选；连同近期记录共58个源位置/18语义组，7个v-model、9容器/14消费者变体。双端20项夹具回归和14张当前Vue图已生成；真实DB/RBAC/文件/审计/生产及用户批准仍待验。

2026-09-11 共享复制增量：TechnicalDetails 的哈希行已更新为当前实现；其余历史描述不扩大为最新验收。复制拒绝现有就地反馈、重试和迟到结果隔离，见 [共享复制反馈复核](TECHNICAL-COPY-FEEDBACK-REVIEW.md)。无 API、权限或复制内容调整。

2026-09-12 P54近期记录实现追加：[P54-近期记录交互实现](P54-RECORDS-INTERACTION-IMPLEMENTATION.md)将 C 方向装入真实 Vue，包含蓝色四类目录、白色筛选/快照/记录面、桌面与手机共用详情、同路由历史恢复、质量工作态保留、读取代际隔离、KeepAlive 中止与导出未知结果锁。新增三组场景在桌面/手机均通过，共6项；实际 Vue 双端图与未知结果图进入审核。API、字段、权限、SQL和数据质量内部实现未改，真实CSV、审计、生产与用户批准仍待验。

2026-09-09 P55追加：[GOVERNANCE-C-r1](design/governance-direction-c/README.md)五分类版本目录、双端详情、筛选/保留范围及原模块入口首轮具体稿待审。原始两类夹具与合成其他类别分开；6组源Vue/service/repository惰性检查覆盖25状态组合、10失败状态、分页和计数，不执行真实SQL/RBAC/业务导航。移动完整自动化字段及模态焦点是提案；零频控源truthy隐藏、权限失败保留和忽略abort后的更新仍明确列为边界。历史25源hash及ff46bfe9追溯不变。下一设计P56，具体批准、DG-G01–07及全站实现部署仍待办；下文“P55正式图未交”为历史状态。

2026-09-09 P54质量段追加：[DATA-QUALITY-C-r1](design/data-quality-direction-c/README.md)首轮双端具体稿待审，与近期记录段分开验收。原始夹具不含成员/开放与严重COUNT，回退必须标本页；新稿保持证据/问题分页与最近20核对、七指标及到期风险边界。源隔离执行复现迟到详情、重复授权/解决、写成功覆盖读取失败、筛选隐藏选择、批预览超限及成员/动作漂移；手机批选、模态和固定提交只在原型。服务下载错误图不冒充window.location.assign后的应用回执，真实文件/授权/审计未执行。25历史源绑定沿用ff46bfe9追溯，不修改旧表。DG-G01–07、具体批准及全站实现部署待办；下一设计P55。下文“质量段未交”为历史状态。

2026-09-09 P54近期记录段追加：[DATA-RECORDS-C-r1](design/data-records-direction-c/README.md)首轮具体稿待审；不含证据质量段，也不计P54完整交付。源惰性函数复现导出原因await后使用新entity、响应等待后文件名再次使用新entity，固定条件/文件命名与未知不重发只在原型。25源合同中24份当前指纹不变；`tests/e2e/m06-02-platform-dashboard.spec.ts`的旧dc949ced…在既有提交ff46bfe9添加原因窗焦点测试后为7d0f9118…，验证器同时核对该提交前后完整hash及当前文件，保留下方历史hash表。无生产源码、HTTP/SQL/审计或真实CSV变化；下一继续P54证据质量，DG-G01–07及全站实现部署签收未完成。

F04b后续：仅AuditedReasonDialog的当前hash因局部Tab循环修复更新，旧值可由e414e0e追溯。m06-02现有数据入口用例补受控导出原因窗首焦点、两种提交可用态首末循环和取消返焦；没有执行此数据导出的POST，不证明导出数据/文件归属。其余待验保持，详见共享入口合同第11节。

2026-09-08；起点main/63a1ef0。覆盖[P54](page-specs/P54.md)、[P55](page-specs/P55.md)，独立于旧全局清单的历史指纹。事实规格与局部正确性验证不等于正式新风格、全行为、生产或用户审核通过；本批没有新正式图，也不选择A/B/C。

## 1. 入口、读取与事实边界

| 页面/入口                          | 真实生产者                                                                                                              | 范围与消费                                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| P54近期记录 / PlatformDataCenter   | platform-dashboard-routes → PlatformDashboardService.management → MySqlPlatformDashboardRepository.readManagement(data) | 四类型SQL先筛后LIMIT 100；summary为返回集计数，Vue按20条切页；供应商搜索不含workspace_name          |
| P54质量 / DataQualityCenter        | data-quality-routes → DataQualityService.dashboard/detail → MySqlDataQualityRepository                                  | 平台权限读取；Vue不传组织/工作区范围。证据/问题各自同page与20条；对账最近20次；计数与当前页风险独立 |
| P55治理 / PlatformGovernanceCenter | platform-dashboard-routes → management(governance) → 五类独立SQL                                                        | 全局六表COUNT；当前列表独立COUNT及20条服务端分页，页码收束；五种版本解释和原模块链接分别维护        |

两路由使用platform_admin壳层、preserve，目录capabilities为platform:operate/platform:superadmin；API实际要求会话+platform:operate。不能把前端目录可见当作后端授权，不能把治理目录跳转当作目标模块可写。数据/治理GET未在该readManagement分支追加独立platform_dashboard_views审计，勿将驾驶舱read的审计合同套用到每次目录读取。

质量highlight从返回runs顺序取各code第一个出现项，不保证全历史最新或每来源各一项；run下钻只是过滤已加载问题，缺失样本不编造。source_freshness与准确率统一按value/threshold百分比显示，单位变化需源合同支持。证据哈希“已校验”文案不是本次下载完整性验证；真正字节/SHA校验在受控下载。

## 2. 操作与消费者合同

DG54-VIEW/ENTITY/FILTER/PAGE/LOAD控制目标范围；DG54-EXPORT使用已应用筛选，不使用queryDraft。snapshotScope记录成功读取的entity/query/status，表头/状态/摘要和双端详情依此解释；目标范围未成功读取时显示保留范围并禁用导出。导出在原因等待前冻结快照，未知结果阻止同一快照重复提交，下一次成功读取后解除。当前页切片与URL仍沿原逻辑，未新增持久化或API字段。

DG55-SECTION/FILTER/PAGE/LOAD控制目标请求；成功snapshotScope保存section/query/status及实际响应page。recordSection/recordType只用于已显示行、类型、版本、详情和行工作台；顶部入口继续对应目标分类。等待/失败时明确原范围，成功后切换，不把score id放入automation编辑参数。

| 写入/外部动作  | 请求与真实约束                                                                                                                                                   | 不得夸大                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| DG54-EXPORT    | POST /platform/management/data/exports，entity/query/status/reason；会话、platform:operate、Origin，原因2–300；重新读最近100条并写platform.data.export审计       | 客户端会附随机幂等键，但此路由不校验/保存幂等结果，不是日志导出的幂等事务；不保证与先前页面快照逐行相同 |
| Q54-DOWNLOAD   | POST /platform/data/evidence/{id}/download-grant body={}；Origin/幂等；再GET download?grant；有效active证据、授权范围/路径/期限、字节/SHA核验                    | 授权签发与实际访问两条审计；无密钥503，列表仍可用；图与trace不记录真实grant                             |
| Q54-RESOLVE    | POST /platform/data-quality/issues/{id}/resolve，reason/expected_version；Origin/幂等/开放状态/版本                                                              | 只变问题并追加事件/Outbox；不修改原始证据、规范版本和历史对账                                           |
| Q54-BATCH      | POST /platform/data-quality/issues/batch，items[{id,expected_version}]/action/reason/assignee_membership_id；attribute/assign/close，1–50个唯一问题，2–500字原因 | 行锁与整批事务，任一过时/非open拒绝；assign要求所有记录同组织的活动成员，不自动缩小范围部分提交         |
| DG55-WORKBENCH | 五类原模块RouterLink；自动化行链接附rule与action=edit，其他只到工作台                                                                                            | 没有本页启停/删除/审批/发布POST；不同平台角色和组织上下文要到目标模块验证                               |

api-client仅GET/HEAD对安全状态/网络失败最多三次读取，非GET不自动重试；每次用户重新提交默认新幂等键。本批不修后端幂等实现或新增重试语义，不以共享客户端“带键”断言后端全部幂等。

## 3. 弹窗、菜单及未被局部扫描计入的共享动作

| 调用方                       | 实际形态与子动作                                                                               | 独立验收                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| P54/P55筛选                  | ResponsiveFilterDrawer；760px及以下抽屉，开/关闭/遮罩/Escape/Tab圈定；submit.capture自动关闭   | 条件草稿保留、提交目标与旧快照区分、禁用导出说明可读；不在自动关闭后再找一次关闭按钮      |
| P54近期、证据、问题；P55治理 | ResponsiveDataView；移动摘要按钮→记录抽屉，关闭/遮罩/Escape及焦点返回                          | 四种调用场景不能以一次共享测试替代；Tab圈定缺口单列                                       |
| 四种表格                     | TableViewControls；列设置summary、各列checkbox、至少保留一列、冻结首个可见列、standard/compact | 分类切换后列标签及显隐/冻结状态；本地组件状态不是全局偏好持久化                           |
| P54导出                      | askExportReason + AuditedReasonDialog原生dialog；textarea、取消/关闭/Escape、2–300校验、submit | 原因输入初焦点、边界、处理中、失败、未知结果及下载文件归属；真实服务幂等与CSV内容仍需验收 |
| P54单问题/批处理             | 两个ConfirmDialog；输入确认解决/确认处理、取消/遮罩/Escape/确认，并接收busy与就地失败状态      | 单问题表单和批量选择是不同消费者；本地夹具通过不替代真实幂等、权限、事务与审计            |
| P54证据详情/解决原因         | 两个原生dialog/useModalDialog；完整溯源与原因预检分开，移动抽屉关闭后再交接焦点                | 详情代次/取消/返焦已有双端回归；真实字段来源、权限、文件和写入并发仍需独立验收            |
| P55桌面详情                  | 原生dialog/useModalDialog，selected来自当前行；两个关闭按钮、Escape、技术展开、所属工作台      | 行类型/版本/链接随原快照；移动另用共享抽屉，两者特有字段是否等价另验                      |
| P54/P55页尾                  | TechnicalDetails的summary与复制请求编号按钮                                                    | Clipboard失败、读屏名、长ID换行及离开后的反馈；不是业务下载或原文复制                     |

## 4. 本批复现、修复与未验范围

P54质量当前实现为读取与详情各自使用代次/AbortController，KeepAlive停用中止GET；完整溯源和原因表单为原生模态。批量预览冻结对象/版本/动作/原因/成员，单问题和批量确认均在saving期间锁定；下载按证据单飞。无HTTP结果保留未知锁，只有成功重读解除；写成功和随后重读失败分开播报。上述已有桌面/手机fixture回归，但不证明真实数据库、文件、权限、审计或生产行为。

UI2-DG54：在旧热点成功后挂起供应商读取，旧实现立即丢失信号/来源表头；UI2-DG55：在旧评分成功后挂起自动化读取，原生详情无法继续显示revision=2。原始两个桌面定向用例都在目标断言处失败；不是改测数据或只验源字符串。修复后还验证404失败保留原解释/链接、重新读取成功切换新类型/版本；404避免共享GET重试干扰。

移动初跑DG55通过，DG54在已自动关闭的筛选抽屉上再次点关闭而超时，属于测试步骤错误；调整为断言抽屉关闭后复测。最终定向及模块结果以PROGRESS记录为准，不把中间失败隐去。新用例没有脚本修改DOM或固定sleep来掩盖产品问题。

| 待验ID | 证据与后续动作                                                                                                            | 当前结论                                                            |
| ------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| DG-G01 | P54/P55已补读取代次、onDeactivated中止和onActivated刷新；真实长历史、生产缓存返回及跨标签页仍需受控终态复现             | 当前Vue夹具已覆盖离开不读、返回刷新和迟到响应隔离，不扩大为生产闭环 |
| DG-G02 | exportCsv原因await之后/下载命名仍读取可变entity；授权下载无单飞；质量详情GET无代次                                        | 需验证导出/下载/详情归属与取消，未用本批范围提示替代                |
| DG-G03 | 单问题/批处理POST成功后load吞错，再由成功notice覆盖；ConfirmDialog无busy、父函数缺saving早退                              | 需可靠复现写成功但读失败及重复确认/取消，不按网络异常自行回滚或重发 |
| DG-G04 | 问题checkbox只在desktop模板，移动摘要/详情无选择入口；过滤/下钻可能保留选择集                                             | 需补真实移动批选与影响范围一致性测试；不能称全部按钮手机可达        |
| DG-G05 | P55移动详情已补自动化特有字段并沿用共享抽屉Tab圈定；质量aside初焦点和其他表格控件部分热区<44                              | P55双端夹具已验字段等价；其他消费者与真实软键盘仍需逐页复核          |
| DG-G06 | 质量当前页检索/深链/对账下钻范围有限；供应商列语义、空数字转换、桌面空反馈、原模块权限落点需细分                          | 保留真实合同，不编接口/搜索/统计；有业务冲突先确认                  |
| DG-G07 | 正式方向未获审；当前无本批正式图、真实MySQL/文件完整性/生产审计和用户签收                                                 | 全站G0未冻结、G1–G5仍待验，规格58/73不代表重设计完成率              |

## 5. 局部控件候选、字段绑定与源码指纹

下列清单来自三个局部Vue的AST扫描并逐项关联真实handler。81个当前候选由19+39+23组成，包含表单事件、控件、弹窗定义/调用的重复位置，不是81个去重业务动作；9个v-model另列。ResponsiveDataView不会被本扫描自动当作dialog调用，已在第3节人工补四种场景。P55的23个局部位置另见`action-reviews/P55.json`归并为8组；全局生成成功不等于用户批准或真实服务验收。

### PlatformDataCenter

文件：`apps/web/src/components/PlatformDataCenter.vue`；候选19项。

| 源签名.序号        | 行  | 类型                  | 语义归属                        |
| ------------------ | --- | --------------------- | ------------------------------- |
| d8576e9119c47e48.1 | 456 | control               | DG54-VIEW · 近期记录            |
| 3d3b85cc3453eef2.1 | 463 | control               | DG54-VIEW · 证据与质量          |
| 318d604dd4996018.1 | 477 | control               | DG54-ENTITY · 四类目标选择      |
| 7266ebf634d2b8b9.1 | 497 | control               | DG54-EXPORT · 桌面导出入口/禁用 |
| b1ba73fd44155bb1.1 | 514 | dialog-component-call | DG54-FILTER · 共享筛选抽屉      |
| 0ca9483df3aea355.1 | 515 | form-event            | DG54-FILTER · 表单提交          |
| 791084433fb5ad25.1 | 518 | event-binding         | DG54-FILTER · Enter提交         |
| 6bb29ec0529e0e59.1 | 534 | control               | DG54-FILTER · 提交按钮          |
| 7d45674378db30da.1 | 535 | control               | DG54-FILTER · 重置              |
| 7939e0d7813a93ae.1 | 542 | control               | DG54-EXPORT · 手机导出入口/禁用 |
| fa3fbd7bf13eae52.1 | 601 | control               | DG54-LOAD · 重新加载            |
| 84e7596199967f7e.1 | 650 | control               | DG54-TECH · 桌面打开记录详情    |
| 1c008f867673db60.1 | 673 | control               | DG54-TECH · 桌面记录标识        |
| 1c008f867673db60.2 | 715 | control               | DG54-TECH · 移动记录标识        |
| 55d3fe91022d0dbb.1 | 721 | control               | DG54-PAGE · 上一页              |
| 97d75da3f85810f7.1 | 731 | control               | DG54-PAGE · 下一页              |
| 29f3caf3dd5ff454.1 | 750 | event-binding         | DG54-EXPORT · 原因提交/取消事件 |
| 6d8eee10bf038ef3.1 | 750 | dialog-component-call | DG54-EXPORT · 原因dialog调用    |
| f65c3340e428d8ed.1 | 290 | dialog-script-call    | DG54-EXPORT · ask脚本调用       |

字段绑定：

- 第519行：`queryDraft`。
- 第527行：`statusDraft`。

### DataQualityCenter

文件：`apps/web/src/components/DataQualityCenter.vue`；候选39项。

| 源签名.序号        | 行   | 类型                  | 语义归属                        |
| ------------------ | ---- | --------------------- | ------------------------------- |
| 15912fa115381d2d.1 | 769  | event-binding         | Q54-LOAD · 首次状态恢复         |
| 0c3266c5e4ec717f.1 | 841  | control               | Q54-LOAD · 工作区刷新           |
| 3c02110a0877635d.1 | 851  | control               | Q54-TAB · 证据                  |
| b2556958fd8ef037.1 | 857  | control               | Q54-TAB · 质量问题              |
| aa2356189420d59b.1 | 863  | control               | Q54-TAB · 核对运行              |
| 50981bed37222bb6.1 | 889  | event-binding         | Q54-SEARCH · 检索变更同步       |
| 2310ecf26c0ac332.1 | 896  | control               | Q54-SEARCH · 清除检索           |
| c56baf2a56445da0.1 | 946  | control               | Q54-EVIDENCE · 桌面完整溯源     |
| 5443375c8e9e7547.1 | 948  | control               | Q54-DOWNLOAD · 桌面受控下载     |
| 0703818483f3ea40.1 | 1003 | control               | Q54-EVIDENCE · 移动完整溯源     |
| 203fccdcb63ff0e1.1 | 1006 | control               | Q54-DOWNLOAD · 移动受控下载     |
| 1c008f867673db60.1 | 1019 | control               | Q54-TECH · 证据标识             |
| f2fe7b9e26309877.1 | 1062 | control               | Q54-RUN · 返回全部问题          |
| 91f486fb0dc95d45.1 | 1076 | control               | Q54-SELECT · 清除选择           |
| c0a8ac3c192bbfe4.1 | 1106 | control               | Q54-BATCH · 影响预览            |
| 89c4ebef359431bf.1 | 1141 | event-binding         | Q54-SELECT · 桌面问题选择       |
| 1abe71571b4dfe5d.1 | 1179 | control               | Q54-EVIDENCE · 桌面关联证据     |
| eb0caf70507d0ae7.1 | 1187 | control               | Q54-RESOLVE · 桌面解决表单      |
| a59648cf951ee036.1 | 1221 | event-binding         | Q54-SELECT · 移动问题选择       |
| c8ae47474adb97d3.1 | 1279 | control               | Q54-EVIDENCE · 移动关联证据     |
| 37daad70b2e75d59.1 | 1287 | control               | Q54-RESOLVE · 移动解决表单      |
| 1c008f867673db60.2 | 1298 | control               | Q54-TECH · 问题标识             |
| 6b65e8ff40f32c66.1 | 1328 | control               | Q54-RUN · 异常字段样本下钻      |
| 6318a60e090bab69.1 | 1338 | control               | Q54-PAGE · 上一页               |
| 36fa4dddd2d51dd7.1 | 1342 | control               | Q54-PAGE · 下一页               |
| 2c714917657e61eb.1 | 1351 | dialog-definition     | Q54-EVIDENCE · 完整溯源原生窗   |
| 4b8b7c1b554343b3.1 | 1351 | event-binding         | Q54-EVIDENCE · 完整溯源取消     |
| 8a6a073e931655a9.1 | 1364 | control               | Q54-EVIDENCE · 关闭完整溯源     |
| 2fa1de5ac75409c9.1 | 1375 | control               | Q54-EVIDENCE · 失败后重读       |
| 495e04b542eaa8d6.1 | 1435 | control               | Q54-TECH · 溯源技术标识         |
| bfa0dacb9030e23d.1 | 1457 | dialog-definition     | Q54-RESOLVE · 原因原生窗        |
| f662156f502d2ebe.1 | 1457 | event-binding         | Q54-RESOLVE · 原因窗取消        |
| 9c1ba8320560a191.1 | 1470 | control               | Q54-RESOLVE · 顶部关闭原因窗    |
| 2798723322952c96.1 | 1506 | control               | Q54-RESOLVE · 底部取消原因窗    |
| cb0cfd08fa44e9c8.1 | 1507 | control               | Q54-RESOLVE · 确认前检查        |
| d3df84c3780de261.1 | 1522 | event-binding         | Q54-RESOLVE · 确认/取消事件     |
| 5a462ae4421ffff4.1 | 1522 | dialog-component-call | Q54-RESOLVE · ConfirmDialog调用 |
| d0581b00f2b934eb.1 | 1536 | event-binding         | Q54-BATCH · 确认/取消事件       |
| 05d2e10fd98621ac.1 | 1536 | dialog-component-call | Q54-BATCH · ConfirmDialog调用   |

字段绑定：

- 第528行：`query`。
- 第674行：`batchAction`。
- 第681行：`batchAssignee`。
- 第690行：`batchReason`。
- 第958行：`reason`。

### PlatformGovernanceCenter

文件：`apps/web/src/components/PlatformGovernanceCenter.vue`；当前候选23项。

| 源签名.序号        | 行 | 类型                  | 语义归属                          |
| ------------------ | --: | --------------------- | --------------------------------- |
| da39e75f0c29a10d.1 | 372 | control               | DG55-SECTION · 五分类选择         |
| 763f45cd6b7c3560.1 | 401 | control               | DG55-PROVIDER · 桌面来源版本      |
| 08baa16283bd4f61.1 | 413 | control               | DG55-LOAD · 刷新事实              |
| a5bd47ee42556f27.1 | 416 | control               | DG55-WORKBENCH · 目标分类顶部入口 |
| adbd9ecccfb8b14c.1 | 422 | dialog-component-call | DG55-FILTER · 共享筛选抽屉        |
| 7967356d90bb2be5.1 | 427 | form-event            | DG55-FILTER · 表单提交            |
| 84ddf55965c63e53.1 | 444 | control               | DG55-FILTER · 应用                |
| d2bd484790411f68.1 | 445 | control               | DG55-FILTER · 重置                |
| 98e49bfa8722733e.1 | 486 | control               | DG55-LOAD · 首错重试              |
| e6fe66816eb31ec7.1 | 576 | control               | DG55-DETAIL · 桌面原生详情        |
| 339a9f00e20513ad.1 | 577 | control               | DG55-WORKBENCH · 桌面所属入口     |
| 495e04b542eaa8d6.1 | 582 | control               | DG55-TECH · 桌面技术标识          |
| 1c008f867673db60.1 | 654 | control               | DG55-TECH · 移动技术详情          |
| e06a7289ed736f28.1 | 666 | control               | DG55-WORKBENCH · 移动所属入口     |
| 053cd828dd3324d8.1 | 675 | control               | DG55-PAGE · 上一页                |
| b7a08810a69e9930.1 | 683 | control               | DG55-PAGE · 下一页                |
| 763f45cd6b7c3560.2 | 707 | control               | DG55-PROVIDER · 手机来源版本      |
| a96089c835f25daa.1 | 720 | dialog-definition     | DG55-DETAIL · 原生dialog定义      |
| 78a618fc321fc7ea.1 | 720 | event-binding         | DG55-DETAIL · 原生cancel事件      |
| a9ad4a103838db20.1 | 732 | control               | DG55-DETAIL · 顶部关闭            |
| 1c008f867673db60.2 | 791 | control               | DG55-TECH · 原生详情标识          |
| ef25aec09f768729.1 | 804 | control               | DG55-DETAIL · 底部关闭            |
| 25ff23ae940dd1c3.1 | 805 | control               | DG55-WORKBENCH · 原生详情所属入口 |

字段绑定：

- 第431行：`queryDraft`。
- 第439行：`statusDraft`。

质量checkbox第721行通过checked/change双向转发selectedIssueIds；共享textarea/确认短语/表格密度等绑定按第3节另验，不混入这9处局部v-model。

### 本批源码指纹

下列25份文件以UTF-8读取、CRLF归一化为LF后SHA-256。指纹只绑定本合同的引用版本，不证明每个共享组件、SQL事务或生产操作已经执行；测试结果另见PROGRESS。

| 文件                                                 | LF SHA-256                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| apps/web/src/components/PlatformDataCenter.vue       | 10f653d56272859493121550b668ec02a88e7a2586aa9590e9cf31659115ccf4 |
| apps/web/src/components/PlatformGovernanceCenter.vue | aaf41ff99d80d1e7055adf23c3abc3db7e256e54c06e54301735747db2e6a048 |
| apps/web/src/components/DataQualityCenter.vue        | 92bfec2ad010bc6f6b0c82571a911a0107075acba1c3b5643376f86716b94d2c |
| apps/api/src/platform-dashboard-routes.ts            | 1b84b99708bf4610259b42dd48987831229560cf5653b15b98b3cc1d30284f30 |
| apps/api/src/platform-dashboard-service.ts           | 568938e88c90615410a7c43224004930936165e91a4172afafc7ce2ff4d8428e |
| apps/api/src/mysql-platform-dashboard-repository.ts  | b290af1c03b2767c79bb565f9ec256550250acc4be0cc787de12b81e9b8dcd28 |
| apps/api/src/data-quality-routes.ts                  | b937aae166ac5f0993b967643dc18e68eef8c2422123aa15cf6ea78e3e3d806c |
| apps/api/src/data-quality-service.ts                 | 39bcb82436d7b520e4597bbe8e1bc8e2930e260f564050cd17790c943659a6fc |
| apps/api/src/mysql-data-quality-repository.ts        | 43e62fdd3a08b3866a66c1e4e7d6c528365edbf2db72716d596e91323b414cd2 |
| apps/web/src/api-client.ts                           | 953c3da783121a797a86ff82e03a968067ae2c694a4fb5f883187b04569fa9ff |
| apps/web/src/use-audited-reason.ts                   | e31e580799041d994e58d011f991d96918e6ca5b699473a94577967f63302eab |
| apps/web/src/use-modal-dialog.ts                     | 5f3488e444f30c86d9f7e7424cc0f5463118fac0d3e78422251167dbd571b2fc |
| apps/web/src/ui/state-contract.ts                    | 9c912b4c0507506484cf04b623839869022fdc68eb6ee332e3cb638dee3b267a |
| apps/web/src/components/ResponsiveDataView.vue       | 739ac85b109ec7c2557909d1f267d1b67a8384aa385afb80f2fd512502d17f7a |
| apps/web/src/components/ResponsiveFilterDrawer.vue   | 727009735e3fb767e5f5d84c4a83f2dcc63a8f09e05623c3cb1609103ece9be4 |
| apps/web/src/components/TableViewControls.vue        | d0611b8367773f915a885c6c09f34c958fed67e7b99110abec20bb0febeea9ff |
| apps/web/src/components/TechnicalDetails.vue         | 4e2443f3f7f901c3d1cf14243523956e8705bbd39aed8e0a19d54063220fe82d |
| apps/web/src/components/AuditedReasonDialog.vue      | 3191e4ba14aa0919d5083e048f89a6ef99497d01aa6c5d8d5bcbbc47f42e1a9a |
| apps/web/src/components/ConfirmDialog.vue            | 3fbdb1841fe1426ecb6a4d808d05d9da8216e501c251b5bf3704b5680af35424 |
| apps/web/src/components/UiStatePanel.vue             | 8f0c147245627493cf5d235162b9dc00424875d0296e710f180a3365c603c164 |
| config/route-catalog.json                            | d02ade33d087f133ddada8c087085e12c1d321b72f35cd1ef6ffb155076e8150 |
| tests/e2e/m06-02-platform-dashboard.spec.ts          | a39d80a78761cd4382bbc2d8684f5334af4f6b3285c0c719932bf83f4da72069 |
| tests/e2e/m03-06-evidence-data-quality.spec.ts       | e5a582642e3b35d2ccfa82872cc91bc00412a1521893508433c31cfaad3b45cb |
| tests/unit/platform-data-center.test.mjs             | dd0629fc25dbefe1e4e14458bfcc68cba707f1d2f515e545fad0e24c6af533ac |
| tests/unit/platform-governance.test.mjs              | ac52496955c78c1bf7c2a383c32b6993a94b232b66b523eff55ff011b8268fce |

2026-09-10 P32恢复组合增量：共享原因组件新增仅显式workspaceRestore上下文启用的目标说明与C样式；其他调用的默认请求结构、原因校验和提交关闭顺序不变。真实Vue双端94检查/20图及默认/替换/关闭单测见[P32落地说明](P32-VUE-RESTORE-REVIEW.md)。本表同步已验证来源，不扩展其他页面或生产验收；旧指纹保存在07902a2e。
