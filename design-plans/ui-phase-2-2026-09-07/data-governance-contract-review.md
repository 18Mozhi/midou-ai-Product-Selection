# B2a · 数据中心与治理目录事实合同

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
| P54单问题/批处理             | 两个ConfirmDialog；输入确认解决/确认处理、取消/遮罩/Escape/确认                                | 单问题表单和批量选择是不同消费者；busy未传入确认组件，不能声称全部防重通过                |
| P54证据详情/解决原因         | 内嵌aside，不是modal；关闭、字段/血缘阅读、原因预检查                                          | 详情焦点/可发现性、迟到请求、表单关闭与写入反馈，不能套用useModalDialog自动通过           |
| P55桌面详情                  | 原生dialog/useModalDialog，selected来自当前行；两个关闭按钮、Escape、技术展开、所属工作台      | 行类型/版本/链接随原快照；移动另用共享抽屉，两者特有字段是否等价另验                      |
| P54/P55页尾                  | TechnicalDetails的summary与复制请求编号按钮                                                    | Clipboard失败、读屏名、长ID换行及离开后的反馈；不是业务下载或原文复制                     |

## 4. 本批复现、修复与未验范围

UI2-DG54：在旧热点成功后挂起供应商读取，旧实现立即丢失信号/来源表头；UI2-DG55：在旧评分成功后挂起自动化读取，原生详情无法继续显示revision=2。原始两个桌面定向用例都在目标断言处失败；不是改测数据或只验源字符串。修复后还验证404失败保留原解释/链接、重新读取成功切换新类型/版本；404避免共享GET重试干扰。

移动初跑DG55通过，DG54在已自动关闭的筛选抽屉上再次点关闭而超时，属于测试步骤错误；调整为断言抽屉关闭后复测。最终定向及模块结果以PROGRESS记录为准，不把中间失败隐去。新用例没有脚本修改DOM或固定sleep来掩盖产品问题。

| 待验ID | 证据与后续动作                                                                                                            | 当前结论                                                            |
| ------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| DG-G01 | 两父页及质量子页仅onBeforeUnmount abort，无完整onDeactivated/历史watch；Tab切换后旧读取、分页失败与缓存返回需受控终态复现 | 本批只修分类/已应用范围的记录解释，不宣称请求生命周期全部闭环       |
| DG-G02 | exportCsv原因await之后/下载命名仍读取可变entity；授权下载无单飞；质量详情GET无代次                                        | 需验证导出/下载/详情归属与取消，未用本批范围提示替代                |
| DG-G03 | 单问题/批处理POST成功后load吞错，再由成功notice覆盖；ConfirmDialog无busy、父函数缺saving早退                              | 需可靠复现写成功但读失败及重复确认/取消，不按网络异常自行回滚或重发 |
| DG-G04 | 问题checkbox只在desktop模板，移动摘要/详情无选择入口；过滤/下钻可能保留选择集                                             | 需补真实移动批选与影响范围一致性测试；不能称全部按钮手机可达        |
| DG-G05 | ResponsiveDataView未显式Tab圈定；质量aside无初焦点；P55移动缺少部分自动化特有字段；表格控件部分热区<44                    | 后续正式布局和对应消费者回归，不在当前局部修复中大范围改公共组件    |
| DG-G06 | 质量当前页检索/深链/对账下钻范围有限；供应商列语义、空数字转换、桌面空反馈、原模块权限落点需细分                          | 保留真实合同，不编接口/搜索/统计；有业务冲突先确认                  |
| DG-G07 | 正式方向未获审；当前无本批正式图、真实MySQL/文件完整性/生产审计和用户签收                                                 | 全站G0未冻结、G1–G5仍待验，规格58/73不代表重设计完成率              |

## 5. 局部控件候选、字段绑定与源码指纹

下列清单来自三个局部Vue的AST扫描并逐项关联真实handler。68个候选由19+27+22组成，包含表单事件、控件、脚本调用、弹窗定义/调用的重复位置，不是68个去重业务动作；9个v-model另列。ResponsiveDataView不会被本扫描自动当作dialog调用，已在第3节人工补四种场景。全局actions/dialogs/coverage由审计脚本在本轮收尾时重新生成，但生成成功不等于用户批准或真实服务验收。

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

文件：`apps/web/src/components/DataQualityCenter.vue`；候选27项。

| 源签名.序号        | 行  | 类型                  | 语义归属                        |
| ------------------ | --- | --------------------- | ------------------------------- |
| 25af292333a00121.1 | 450 | event-binding         | Q54-LOAD · 状态重试             |
| 962cb06e44ff9bc9.1 | 511 | control               | Q54-TAB · 证据                  |
| 30e8ea79455855f2.1 | 516 | control               | Q54-TAB · 问题                  |
| 65223b82b82a6bdf.1 | 521 | control               | Q54-TAB · 核对运行              |
| 7bd92702b23c9693.1 | 572 | control               | Q54-EVIDENCE · 桌面证据详情     |
| ae9bd960542d86e4.1 | 573 | control               | Q54-DOWNLOAD · 桌面授权下载     |
| 57c01717dbdca94f.1 | 611 | control               | Q54-EVIDENCE · 移动完整溯源     |
| 1314e818824ce060.1 | 620 | control               | Q54-DOWNLOAD · 移动授权下载     |
| 1c008f867673db60.1 | 623 | control               | Q54-TECH · 证据标识             |
| f2fe7b9e26309877.1 | 662 | control               | Q54-RUN · 返回全部问题          |
| e1512e639fd3f6dc.1 | 694 | control               | Q54-BATCH · 影响预览            |
| 72968bdd17422980.1 | 721 | event-binding         | Q54-SELECT · 开放问题checkbox   |
| 232fadd70e14fb44.1 | 754 | control               | Q54-EVIDENCE · 问题关联证据     |
| 4feb3476c1a70841.1 | 761 | control               | Q54-RESOLVE · 桌面解决表单      |
| b4391f4667c57834.1 | 831 | control               | Q54-EVIDENCE · 移动关联证据     |
| eaff8a0f18b4cd6c.1 | 842 | control               | Q54-RESOLVE · 移动解决表单      |
| 1c008f867673db60.2 | 853 | control               | Q54-TECH · 问题标识             |
| 6b65e8ff40f32c66.1 | 883 | control               | Q54-RUN · 异常字段样本下钻      |
| 6318a60e090bab69.1 | 893 | control               | Q54-PAGE · 上一页               |
| 36fa4dddd2d51dd7.1 | 897 | control               | Q54-PAGE · 下一页               |
| 1052dd42c6994868.1 | 912 | control               | Q54-EVIDENCE · 关闭完整溯源     |
| 87db0311c644aa85.1 | 953 | control               | Q54-RESOLVE · 关闭原因表单      |
| e4b44826587c4dcd.1 | 963 | control               | Q54-RESOLVE · 确认前检查        |
| d9a4caa16a647610.1 | 967 | event-binding         | Q54-RESOLVE · 确认/取消事件     |
| a2e5b3b777187bdd.1 | 967 | dialog-component-call | Q54-RESOLVE · ConfirmDialog调用 |
| 80aac8ff27852b4d.1 | 977 | event-binding         | Q54-BATCH · 确认/取消事件       |
| d8aabe3a13b05163.1 | 977 | dialog-component-call | Q54-BATCH · ConfirmDialog调用   |

字段绑定：

- 第528行：`query`。
- 第674行：`batchAction`。
- 第681行：`batchAssignee`。
- 第690行：`batchReason`。
- 第958行：`reason`。

### PlatformGovernanceCenter

文件：`apps/web/src/components/PlatformGovernanceCenter.vue`；候选22项。

| 源签名.序号        | 行  | 类型                  | 语义归属                          |
| ------------------ | --- | --------------------- | --------------------------------- |
| 08baa16283bd4f61.1 | 312 | control               | DG55-LOAD · 刷新事实              |
| a5bd47ee42556f27.1 | 315 | control               | DG55-WORKBENCH · 目标分类顶部入口 |
| 1a97224c567e5a16.1 | 318 | dialog-component-call | DG55-FILTER · 共享筛选抽屉        |
| e89421a25cd6a707.1 | 319 | form-event            | DG55-FILTER · 表单提交            |
| 84ddf55965c63e53.1 | 334 | control               | DG55-FILTER · 应用                |
| d2bd484790411f68.1 | 335 | control               | DG55-FILTER · 重置                |
| 7c508e0f69cc08ef.1 | 357 | control               | DG55-LOAD · 首错重试              |
| afe46eeebe1ea9c0.1 | 366 | control               | DG55-SECTION · 五分类选择         |
| e6fe66816eb31ec7.1 | 425 | control               | DG55-DETAIL · 桌面原生详情        |
| 339a9f00e20513ad.1 | 426 | control               | DG55-WORKBENCH · 桌面所属入口     |
| 1c008f867673db60.1 | 432 | control               | DG55-TECH · 桌面记录              |
| 1c008f867673db60.2 | 482 | control               | DG55-TECH · 移动记录              |
| e06a7289ed736f28.1 | 494 | control               | DG55-WORKBENCH · 移动所属入口     |
| 053cd828dd3324d8.1 | 502 | control               | DG55-PAGE · 上一页                |
| b7a08810a69e9930.1 | 510 | control               | DG55-PAGE · 下一页                |
| 763f45cd6b7c3560.1 | 529 | control               | DG55-PROVIDER · 来源版本          |
| a96089c835f25daa.1 | 539 | dialog-definition     | DG55-DETAIL · 原生dialog定义      |
| 78a618fc321fc7ea.1 | 539 | event-binding         | DG55-DETAIL · 原生cancel事件      |
| a9ad4a103838db20.1 | 551 | control               | DG55-DETAIL · 顶部关闭            |
| 1c008f867673db60.3 | 603 | control               | DG55-TECH · 原生详情标识          |
| ef25aec09f768729.1 | 616 | control               | DG55-DETAIL · 底部关闭            |
| 25ff23ae940dd1c3.1 | 617 | control               | DG55-WORKBENCH · 原生详情所属入口 |

字段绑定：

- 第322行：`queryDraft`。
- 第326行：`statusDraft`。

质量checkbox第721行通过checked/change双向转发selectedIssueIds；共享textarea/确认短语/表格密度等绑定按第3节另验，不混入这9处局部v-model。

### 本批源码指纹

下列25份文件以UTF-8读取、CRLF归一化为LF后SHA-256。指纹只绑定本合同的引用版本，不证明每个共享组件、SQL事务或生产操作已经执行；测试结果另见PROGRESS。

| 文件                                                 | LF SHA-256                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| apps/web/src/components/PlatformDataCenter.vue       | 10f653d56272859493121550b668ec02a88e7a2586aa9590e9cf31659115ccf4 |
| apps/web/src/components/PlatformGovernanceCenter.vue | 76eae80f51225c3af676a17ab9c4ec94369262cc5e8c968be7fd62ef5f2280db |
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
| apps/web/src/components/ResponsiveDataView.vue       | 52738f13651a70aab3601928e163fe32fb88cc992d0b09dfe67297754e44b39c |
| apps/web/src/components/ResponsiveFilterDrawer.vue   | a566080f7b00f13c8890ea8ef5b002296b39e9b7fe10f324a4fe754226dec011 |
| apps/web/src/components/TableViewControls.vue        | d0611b8367773f915a885c6c09f34c958fed67e7b99110abec20bb0febeea9ff |
| apps/web/src/components/TechnicalDetails.vue         | 4e2443f3f7f901c3d1cf14243523956e8705bbd39aed8e0a19d54063220fe82d |
| apps/web/src/components/AuditedReasonDialog.vue      | 3191e4ba14aa0919d5083e048f89a6ef99497d01aa6c5d8d5bcbbc47f42e1a9a |
| apps/web/src/components/ConfirmDialog.vue            | 3fbdb1841fe1426ecb6a4d808d05d9da8216e501c251b5bf3704b5680af35424 |
| apps/web/src/components/UiStatePanel.vue             | 8f0c147245627493cf5d235162b9dc00424875d0296e710f180a3365c603c164 |
| config/route-catalog.json                            | d02ade33d087f133ddada8c087085e12c1d321b72f35cd1ef6ffb155076e8150 |
| tests/e2e/m06-02-platform-dashboard.spec.ts          | ad45253b01418096d7df00f364d8b820c99f7285ff961798c7749211bb2f1bb0 |
| tests/e2e/m03-06-evidence-data-quality.spec.ts       | e5a582642e3b35d2ccfa82872cc91bc00412a1521893508433c31cfaad3b45cb |
| tests/unit/platform-data-center.test.mjs             | dd0629fc25dbefe1e4e14458bfcc68cba707f1d2f515e545fad0e24c6af533ac |
| tests/unit/platform-governance.test.mjs              | 282907ebf35a276e8e5112a832f12592153b848e08c056f354f61fed71213bbd |

2026-09-10 P32恢复组合增量：共享原因组件新增仅显式workspaceRestore上下文启用的目标说明与C样式；其他调用的默认请求结构、原因校验和提交关闭顺序不变。真实Vue双端94检查/20图及默认/替换/关闭单测见[P32落地说明](P32-VUE-RESTORE-REVIEW.md)。本表同步已验证来源，不扩展其他页面或生产验收；旧指纹保存在07902a2e。
