# B1c · 采集任务、总览与浏览器运行合同

2026-09-12追加P53：[读取、回收与焦点归属](P53-INTERACTION-OWNERSHIP-IMPLEMENTATION.md)补齐同路由q/status/page恢复、GET快照/代次与KeepAlive续读；回收POST离页不取消、不后台核对，返回后才应用结算。成功与核对失败分开播报，无HTTP响应标记结果未知并锁定重提；确认期间底层P53 inert。旧实现前四组双端8项全红，修复后五组双端10/10、完整M03-04双端16/16。API、权限、空body、服务端事务和数据库不变；真实回收、生产与C视觉审核仍待。

2026-09-12追加P52可达性：[焦点与字段语义](P52-ACCESSIBILITY-IMPLEMENTATION.md)让批确认期间底层总览inert并在Escape后返焦，来源展开关联实际结果区，原因帮助/错误/焦点形成字段闭环；既有手机记录抽屉补齐隔离、Tab和返焦证据。旧实现新增4失败/2通过，修复后定向6/6、完整M06-03双端42/42。当前O扫描为29候选/5个v-model，新增候选仅是原因输入清错事件；下方66候选表保留初始合同定位，不把运行增量重算成新业务动作。API/权限/批量合同不变，真实链路与C视觉仍待。

2026-09-12追加P52批量写入：[批量重放写入归属](P52-BATCH-WRITE-OWNERSHIP-IMPLEMENTATION.md)在预览时固定目标/原因/影响/batchId，串行POST保持独立幂等，成功只称创建新任务，明确失败与未知结果分开；未知不自动重发。KeepAlive离页不取消POST、不后台GET，返回先恢复当前URL范围再核对。旧实现新增双端8项全红，修复后UI2-CL52双端24/24、完整M06-03双端36/36。API/权限/事务/数据库不变，真实链路与C视觉仍待。

2026-09-12追加P52：[读取生命周期与查询连续性](P52-READ-LIFECYCLE-IMPLEMENTATION.md)补齐同路由七字段恢复、查询快照/代次、快速查询旧读隔离、KeepAlive中断续读及attempts-only ready。旧代码新增双端8项全红，修复后UI2-CL52双端16/16、完整M06-03双端28/28。GET/查询/分页/权限/批量写入/API/数据库不变；401/403快照策略、C视觉与真实链路仍待。

2026-09-12继续追加：P51 KeepAlive离页会中止等待中的列表GET、隔离旧代次并仅在返回任务页时续读；手机记录抽屉进入完整详情后关闭会返焦原任务记录。旧代码定向3失败/1通过，修复后双端4/4。缓存策略、路由、共享抽屉合同、API、权限、数据库和业务动作未改；完整C视觉与真实链路仍待。

2026-09-12追加P51交互实施：[详情可达性与重放归属](P51-INTERACTION-OWNERSHIP-IMPLEMENTATION.md)补齐自动重放状态筛选、详情三态常驻标题/关闭入口、可见控件焦点循环与reduced-motion。人工重放固定提交目标/原因；详情关闭或切换后迟到成功只刷新列表和页面提示，未知写入结果不再声称未执行。API、状态机、权限、数据库、配置未改，未部署；C视觉审核、空结果筛选、嵌套确认焦点、page/status历史和真实链路仍待。

2026-09-12同批追加：P51服务端空结果不再移除状态/文本筛选，指定状态可返回全部状态且不造创建入口；重放ConfirmDialog取得焦点时底层详情原生inert，取消后返焦。双端定向覆盖，原API、状态参数和确认短语不变；page/status历史、移动二级入口、完整C视觉与真实链路仍待。

2026-09-12再追加：P51同路由page/status由路径受限watcher响应back/forward；每次列表读取固定查询快照和代次，新读取abort旧请求，迟到成功/失败/finally不提交。旧代码历史恢复与等待中切状态均红，修复后双端定向通过。URL、GET参数、分页、状态机不变；KeepAlive离页读取恢复、移动二级入口、完整C视觉与真实链路仍待。

2026-09-11 共享复制增量：TechnicalDetails 的哈希行已更新为当前实现；其余历史描述不扩大为最新验收。复制拒绝现有就地反馈、重试和迟到结果隔离，见 [共享复制反馈复核](TECHNICAL-COPY-FEEDBACK-REVIEW.md)。无 API、权限或复制内容调整。

2026-09-09追加P53：[BROWSER-RUNTIME-C-r1](design/browser-runtime-direction-c/README.md)蓝色全局风险/白色占用清单与运行台账，双端两类弹窗待审。R未传destructive，实际只输入“确认回收”无影响勾选，更正P53旧规格；不改变O批量确认规则。源函数复现读取状态漂移、成功回收覆盖刷新失败、未知结果错误声称未执行和忽略abort后引用更新；保护仅原型。31份源合同LF指纹未变，惰性service/repository适配不执行SQL或回收。真实服务还清过期调度租约，回收数不等于OS进程数。原三条与合成26条分页分开；具体审核、CL-G01–07与全73页实现部署签收未完成，下一P54数据中心。

日期：2026-09-08；起点main/0ba784a，接续同一目标的两份采集E2E在途改动。对应[P51](page-specs/P51.md)、[P52](page-specs/P52.md)、[P53](page-specs/P53.md)。本批交付事实规格与两处局部UI修复，不是正式风格、全站行为、真实后端、生产或用户验收通过。

2026-09-09追加：P51 [COLLECTION-TASKS-C-r1](design/collection-tasks-direction-c/README.md)63场景双端及长窗图稿待审；蓝色范围/当前页摘要、白色队列/来源事实，三模态变体。源函数复现状态单飞丢请求、确认目标/原因漂移与旧重放覆盖新详情，保护仅原型。T确认只需短语无勾选；20状态/19选项及旧重放响应夹具履历矛盾显式保留。31项合同源LF指纹未变，未真实重放或修改运行合同。P52/P53新图、CL-G01–07、真实Vue/权限/API/MySQL/Worker及全73页实现部署签收待办。

## 1. 源码边界与角色

2026-09-09追加P52：[COLLECTION-OVERVIEW-C-r1](design/collection-overview-direction-c/README.md)首轮双端具体稿待审，范围/来源/尝试/批确认四模态。O真实destructive确认需勾选及短语；源函数复现范围单飞丢请求、批原因漂移与尝试独存被隐藏，结果归属/固定快照/未知结果/焦点只在原型。真实service和SQL-filter构造验证不执行SQL或审计；原始分页/批次夹具meta不匹配返回条数保留并解释。31合同源不变，无生产写入。下一P53；CL-G01–07与全73页实现部署签收保持未完成。

| 别名 | 实际入口 | 候选数 / v-model数 |
| --- | --- | --- |
| S | [CollectionRuntimeSurface.vue](../../apps/web/src/components/CollectionRuntimeSurface.vue) | 3 / 0 |
| T | [CollectionTaskCenter.vue](../../apps/web/src/components/CollectionTaskCenter.vue) | 23 / 3 |
| O | [CollectionOperationsConsole.vue](../../apps/web/src/components/CollectionOperationsConsole.vue) | 28 / 5 |
| R | [CollectionRuntimeCenter.vue](../../apps/web/src/components/CollectionRuntimeCenter.vue) | 12 / 2 |

三条路由分别为/platform-admin/collection、其/overview及/browser-runtime；统一surface但不同子组件，均platform_admin、preserve，目录capabilities列platform:operate/platform:superadmin。API任务读/详情/重放与runtime读/回收均要求collection:replay，总览GET要求platform:operate。只复核该差异，不改变权限或把页面按钮可见当实际授权。

共66个局部源码候选，包含同节点事件/弹窗调用的重复扫描，不等于66个业务按钮。仅T有1个本地role=dialog，另有三个ConfirmDialog调用、O的ResponsiveFilterDrawer；ResponsiveDataView移动记录弹窗、TableViewControls、TechnicalDetails与UiStatePanel属于共享消费者，不能漏验，也不能重复加到全站动作分母。[共享状态与确认合同](state-recovery-contract-review.md)是索引，不代表所有调用方已通过。

## 2. 逐候选语义对应

使用现有scanSource、LF归一源码；位置键是别名:签名.同签名序号。行号只辅助定位，handler/API行为以正文及页面规格为准。

| 位置键 | 类型 / 行 | 语义归属 |
| --- | --- | --- |
| S:3c465962052e3b24.1 | control / 16 | CL-NAV / 总览 |
| S:ebad8fdaf536f0e3.1 | control / 20 | CL-NAV / 任务页 |
| S:404044c1ac23071f.1 | control / 24 | CL-NAV / 浏览器运行 |
| T:d1849db8e18799fd.1 | control / 597 | CL51-LOAD / 保留快照刷新 |
| T:a0dc06b99ac90370.1 | control / 600 | CL51-LINK / 浏览器运行 |
| T:4ec44b3c83794aca.1 | control / 612 | CL51-LOAD / 错误重读 |
| T:7e6436ac5e8e9b15.1 | event-binding / 648 | CL51-FILTER / changeStatus |
| T:dfaa056b9550313b.1 | control / 727 | CL51-DETAIL / 桌面查看push task |
| T:5efbd64729e57af0.1 | control / 772 | CL51-DETAIL / 关闭移动记录后开完整详情 |
| T:1c008f867673db60.1 | control / 782 | CL51-TECH / 移动技术详情 |
| T:680ca05fdeabfdbf.1 | control / 825 | CL51-PAGE / 前页 |
| T:cda5e997a43d64c9.1 | control / 829 | CL51-PAGE / 后页 |
| T:33bc529b8390aa3d.1 | control / 887 | CL51-DETAIL / 失败后读取当前task |
| T:30e32a01e61d8558.1 | control / 868 | CL51-DETAIL / loading、error、loaded共用关闭详情 |
| T:96164ff76e31b8d8.1 | control / 911 | CL51-RECOVER / 重放原因区锚点 |
| T:9334ac0d41264e22.1 | control / 912 | CL51-RECOVER / 凭证、来源或总览链接 |
| T:d499af7185a1f039.1 | control / 935 | CL51-TECH / robots判定展开 |
| T:79686f2d00e174f0.1 | control / 994 | CL51-TECH / 完整技术标识 |
| T:5046ae27ac1c3e07.1 | control / 1043 | CL51-REPLAY / 确认预览 |
| T:acbca874b622fd25.1 | event-binding / 1055 | CL51-REPLAY / cancel、replay |
| T:e9f14f18f727a992.1 | dialog-component-call / 1055 | CL51-REPLAY / 共享确认调用 |
| O:2506d9788c717641.1 | dialog-component-call / 586 | CL52-SCOPE / 移动筛选抽屉 |
| O:9ba7fa048065cd28.1 | form-event / 587 | CL52-SCOPE / applyScope |
| O:3a14c060674cdbaa.1 | control / 670 | CL52-LINK / 响应links六类目标 |
| O:f6229375f6be78df.1 | control / 713 | CL52-SOURCE / 桌面技术展开 |
| O:1c008f867673db60.1 | control / 756 | CL52-SOURCE / 移动技术展开 |
| O:1c008f867673db60.2 | control / 831 | CL52-ROOT / 原始错误码 |
| O:f6229375f6be78df.2 | control / 869 | CL52-ATTEMPT / 桌面技术展开 |
| O:1c008f867673db60.3 | control / 916 | CL52-ATTEMPT / 移动技术展开 |
| O:660c7a198b93551d.1 | control / 972 | CL52-BATCH / 安全重放区展开 |
| O:9ebd065e5010fd46.1 | control / 1022 | CL52-DEAD / 链接单任务详情重放 |
| O:1c008f867673db60.4 | control / 1026 | CL52-DEAD / 技术详情 |
| R:25af292333a00121.1 | event-binding / 433| CL53-LOAD / 状态面primary |
| R:a9a0bd7b83bfaa17.1 | control / 516| CL53-RENEW / blocked_login任务链接 |
| R:cbea42c5b9e6a6b3.1 | form-event / 530| CL53-FILTER / applyFilters |
| R:1c008f867673db60.1 | control / 648| CL53-DETAIL / 移动技术展开 |

## 3. 输入绑定和弹窗变体

| 文件:行 | 绑定 | 生效边界 |
| --- | --- | --- |
| T:536 | query | 当前响应页文本过滤，无API写入 |
| T:539 | status | changeStatus重置页码与文本后GET |
| T:887 | replayReason | trim后≥2；maxlength500；确认后POST |
| O:370 | org | scopeValidation及提交时trim |
| O:376 | workspace | 范围存在/归属由后端核验 |
| O:382 | provider | 来源ID选项来自完整source_options |
| O:394 | timeWindow | 24h/7d/30d/all |
| O:754 | batchReason | trim≥2、原始≤500；预览时冻结进批次快照 |
| R:392 | queryDraft | 提交到query后请求，≤160 |
| R:399 | status | 查询提交生效，不立即GET |

O:743的checkbox另外由:checked/:disabled及@change转发到toggleDeadLetter；状态非open、batchBusy或存在未知批结果时禁用，不能把这个输入漏在10个v-model之外。ConfirmDialog共享影响勾选仅在destructive=true时出现，不能一概计入三个调用；T未传该prop，默认false，实际只输入“确认重放”。R也未传该prop，P53复核确认只输入“确认回收”。共享签认输入不在局部v-model数量内；O依其destructive调用保留影响勾选，不跨页套用。

T详情loading/error/loaded、死信确认；O范围抽屉、来源/尝试记录详情、批量确认；R运行记录详情、租约回收确认分别出桌面/移动及全部适用状态图。原生details/summary不是模态，仍需展开/折叠与键盘验收。当前共享记录抽屉无完整Tab闭环的源码保证，实际验证不能只断言role存在。

## 4. 读写合同与真实统计

| 页面 / 操作 | 实际合同 | 不可误报 |
| --- | --- | --- |
| T列表 | GET tasks?page&page_size=50&status；文本只筛当前页；meta.total服务端 | 四项摘要均当前页，不能画成平台总量 |
| T详情 | GET tasks/{UUID}；每条子查询事实、尝试/事件/死信 | 空成功、无新内容、解析失败不同；缺result_kind不补猜 |
| T或O单任务重放 | POST tasks/{id}/replay reason；collection:replay、Origin、Idempotency-Key | dead_letter锁定后新建scheduled任务，旧任务/尝试保留；不是恢复成功 |
| O总览 | GET console范围、时间、两页码与精确错误；读有审计 | sources仅provider过滤；各统计表时间字段不同；root只数死信且不被当前error筛掉 |
| O批量 | 最多20当前开放项；预览固定items/reason/impact/batchId，串行单任务POST | 不整批回滚；成功、明确失败、结果未知分开，未知不自动重发；离页返回后按当前范围核对 |
| R列表 | GET crawler-runtime page/q/status；25/页；q仅运行/错误/request/trace | profiles和run_metrics为全局，pagination为筛选集合 |
| R回收 | POST crawler-runtime/recover-expired {}；同权限/Origin/幂等 | 全局过期租约，不是当前筛选，也不是OS终止或业务任务重放 |

R有效/过期登录状态仅依据凭证expires_at；预测以observed_at算剩余天数。activeLeases含过期lease；lease_expired是重复执行风险信号不是重复事实。三页无新轮询、配置或数据库变更。总览GET的审计写入属于已有后端读合同；本批隔离响应不会产生该真实审计。

## 5. 本批已复现修复与验证范围

UI2-CL51最初503失败分支会被api-client的安全GET重试影响；改用不自动重试的404，确认失败终态归属而不修改重试器。等待精确请求finished/failed与渲染帧后断言迟到响应不得重开详情，再检查forward重新读取和close删除task。校正后成功/失败两例在旧源码均红；task查询被移除或无效时abort并递增detailSequence后定向绿，防止try/catch/finally旧分支重新占用详情。

UI2-CL52按可见桌面/移动区域定位来源；旧9项测试的strict定位错误已纠正，不作为产品缺陷。0/1/8/9边界在旧源码仅1/8错误空态红；把空提示从展开按钮的v-else改为独立sources.length=0条件，不改排序、8项截断或显示全部操作。校正red共4失败/2通过，定向绿6通过；模块最终结果与环境范围以PROGRESS为准，不仅凭这一组计完整页面通过。

本批不改业务/后端/SQL/权限/环境和依赖。P53源码只读，无变化不重跑旧生命周期测试；不称真实MySQL、Cookie、Python、外部浏览器任务或生产重放/回收已验。局部源码hash不替代全局4b83588清单的实际增量重采，G0分母保持未冻结，正式方向和用户通过保持待审。

## 6. 独立未验项与后续退出条件

| ID | 源码事实 / 待验场景 | 退出证据 |
| --- | --- | --- |
| CL-G01 | T、O与R的同路由查询、读取代次及等待中KeepAlive续读已局部修复；三页组织/角色变化仍待 | 继续跨范围权限变化与真实读链；当前隔离响应不外推到生产权限 |
| CL-G02 | T重放、O批量及R全局回收已补写入归属、离页结算和未知不重发；R回收后核对失败独立提示 | 继续真实幂等、审计、数据库与运行恢复核查；本地成功不等于生产恢复 |
| CL-G03 | T详情、T/O/R确认和三页共享手机详情已有局部焦点证据；完整读屏与全部消费者仍待 | 继续真实键盘、焦点返回、错误关联与读屏可达，不能靠CSS或脚本改DOM绕过 |
| CL-G04 | T已补automatically_replayed与空结果筛选保留；O已补attempts-only ready | 继续核对真实可达数据/过滤合同与总览呈现；不改任务状态机 |
| CL-G05 | 三页初次与刷新失权的处理不同；路由能力与API能力不同 | 六角色真实允许/拒绝、当前快照安全展示和跨范围隔离，不能用Mock权限冒充 |
| CL-G06 | 指标范围、登录期限与真实运行含义不同 | 正式新图明确范围/时间/未知，真实API与SQL核对，不新增假指标 |
| CL-G07 | 全新结构、全按钮/弹窗/主题/密度与生产仍未交 | 正式审图→Vue→全量适用行为→宝塔同SHA→用户签收；高影响最终提交按具体授权 |

已有J07/PR-G01业务差异按原合同独立决策，本批不处理或默认解决。每项仍可在已知权限下开展的事实/隔离验证继续推进，不能以本批两修复替代全阶段。

## 7. 来源指纹

以下LF归一SHA-256绑定本批最终源文件；不是声称这些工作树修改已包含于起点提交。仅哈希相符证明来源一致，不证明界面或接口已执行。图与生产证据仍须另行采集。

| 源路径（仓库根相对） | LF SHA-256 |
| --- | --- |
| apps/web/src/components/CollectionRuntimeSurface.vue | f0420048e7dcdc8f0106f7c10644aee298c4b8204c9cbd378dfe2034a79f9335 |
| apps/web/src/components/CollectionTaskCenter.vue | 509341da51ee51234bbf27de21e14c7943d409efb0339bcd59b6dbf047ff6160 |
| apps/web/src/components/CollectionOperationsConsole.vue | 7acded3c40ce98f08e87955cd161bba67874aca496d1768b34505bb35b527d7d |
| apps/web/src/components/CollectionRuntimeCenter.vue | 39f1a91cbff368c91253423bd0d400202f52af365a32a17f91147c8e93887db9 |
| apps/web/src/collection-tasks.css | 4c5a0775200b22badcfc3c56ee193cd91c12901f603021eac5d43e8a291a15d4 |
| apps/web/src/collection-task-detail.css | cdeb6209781acc6ff747fb4728f9675d69479c53fd3a97dfdb9e0b5c17130544 |
| apps/web/src/styles/platform-operations.css | 7fd76092fe05dfaac21310794381af649eeecf2421c5d136162b19e1335f86f9 |
| apps/web/src/crawler-runtime.css | 544a5f1f6b2e9d851a98385377db29f909e867a720fbdd78b20e28bee1bcfcad |
| apps/web/src/components/ConfirmDialog.vue | 3fbdb1841fe1426ecb6a4d808d05d9da8216e501c251b5bf3704b5680af35424 |
| apps/web/src/components/ResponsiveDataView.vue | 28fa47d1a8beac1666c0cf8be1316484abd39729682a68adb4fed803742f2aaa |
| apps/web/src/components/ResponsiveFilterDrawer.vue | a566080f7b00f13c8890ea8ef5b002296b39e9b7fe10f324a4fe754226dec011 |
| apps/web/src/components/UiStatePanel.vue | 8f0c147245627493cf5d235162b9dc00424875d0296e710f180a3365c603c164 |
| apps/web/src/components/TechnicalDetails.vue | 4e2443f3f7f901c3d1cf14243523956e8705bbd39aed8e0a19d54063220fe82d |

## 9. T组件剩余当前源码候选（2026-09-24）

第8节已为 `CollectionTaskCenter.vue` 绑定当前LF指纹；本节补录旧表尚未覆盖的5个当前候选。它们分别属于状态面主操作事件、空结果恢复按钮、详情遮罩自身点击关闭、详情原生语义与详情键盘处理。`recoverEmpty` 在非全部状态时先清状态/页码/本地query再读取；在全部状态时只重新读取。详情遮罩仅在按下目标本身时关闭，内部点击不会命中 `.self` 分支；键盘事件继续交给当前 `detailKeydown`。

| 当前candidateId | 行 | 类型 | 当前语义归属 |
| --- | ---: | --- | --- |
| apps/web/src/components/CollectionTaskCenter.vue#3a210e63ca5a7831.1 | 603 | event-binding | CL51-CURRENT-STATE-PRIMARY / 非ready与非empty时将状态面primary接到列表load |
| apps/web/src/components/CollectionTaskCenter.vue#16620352511db5c2.1 | 820 | control | CL51-CURRENT-EMPTY-RECOVERY / 全部状态重读；筛选空态返回全部状态并重读 |
| apps/web/src/components/CollectionTaskCenter.vue#6b55734308f206c3.1 | 838 | event-binding | CL51-CURRENT-DETAIL-DISMISS / 仅详情遮罩本身mousedown时关闭详情 |
| apps/web/src/components/CollectionTaskCenter.vue#ed8b70dc2e6170f2.1 | 839 | dialog-definition | CL51-CURRENT-DETAIL-SEMANTICS / 当前详情面板role=dialog、aria-modal与标题/描述关联 |
| apps/web/src/components/CollectionTaskCenter.vue#d3da42ac8f789e3b.1 | 839 | event-binding | CL51-CURRENT-DETAIL-KEYBOARD / 将详情keydown转发给既有Escape与Tab边界处理 |

本节仅补候选定位，不将列表/详情读取、人工重放的API合同、RBAC、真实任务事实、键盘实机或生产部署验收重新声明为通过；原5个失效签名仍保持identity-not-found。

### 9.1 P51详情状态与关闭旧身份归档

以下五个早期签名由第9节现行状态面、详情遮罩、dialog语义、键盘候选与跨状态关闭按钮替代。原“失败关闭”是错误态专用按钮；372ecd71 起详情头部关闭按钮覆盖 loading/error/loaded，且仍调用同一 `closeDetail`，由当前源码与双端真实路由 E2E 核对。历史身份不计当前覆盖，替代映射仅证明源码位置，不代替完整读屏或真实后端验收。

| 旧candidateId | 原始语义 | 当前替代身份 |
| --- | --- | --- |
| apps/web/src/components/CollectionTaskCenter.vue#2f2f0f3ceae01eac.1 | CL51-LOAD 状态面primary | #3a210e63ca5a7831.1 CL51-CURRENT-STATE-PRIMARY |
| apps/web/src/components/CollectionTaskCenter.vue#b6414d02a0f96150.1 | CL51-DETAIL 遮罩mousedown.self关闭 | #6b55734308f206c3.1 CL51-CURRENT-DETAIL-DISMISS |
| apps/web/src/components/CollectionTaskCenter.vue#472cf13bb7c4d799.1 | CL51-DETAIL loading/error/loaded容器 | #ed8b70dc2e6170f2.1 CL51-CURRENT-DETAIL-SEMANTICS |
| apps/web/src/components/CollectionTaskCenter.vue#86cb88a88c044c05.1 | CL51-DETAIL detailKeydown Tab/Escape | #d3da42ac8f789e3b.1 CL51-CURRENT-DETAIL-KEYBOARD |
| apps/web/src/components/CollectionTaskCenter.vue#e2f1f3476ece93e2.1 | CL51-DETAIL 错误态专用关闭按钮 | #30e32a01e61d8558.1 CL51-DETAIL 跨状态关闭详情 |
| apps/web/src/api-client.ts | 953c3da783121a797a86ff82e03a968067ae2c694a4fb5f883187b04569fa9ff |
| config/route-catalog.json | d02ade33d087f133ddada8c087085e12c1d321b72f35cd1ef6ffb155076e8150 |
| apps/web/src/route-catalog.ts | 6b0d6c7770f26ebf09017c32ce8dec08179d1a9ec1c532b6066ed8efed807956 |
| apps/web/src/router.ts | 67dc541e1856fd5bd30688f9bf64d9e32d66491bb9a1a19d8ce5ef81679162f4 |
| apps/web/src/App.vue | e8ed64e10e641a7988c999c3965c917d4640cd3a4eab213b8f23131641bac531 |
| apps/api/src/collection-task-routes.ts | 74a9af17287692ed20d99b3f5993ad49b07a43ba967801748025a3640a078fbd |
| apps/api/src/collection-task-service.ts | e2be97bceb32547991fe08c629d5459b686bd1672278366e7e3919321af81684 |
| apps/api/src/mysql-collection-task-repository.ts | f2941278cff537ad1d6688989a159b8398db759373bc51379c1f8e7302fcfc47 |
| apps/api/src/collection-console-routes.ts | e728860cac1614245115e5bf43d90ba0ad31115e07e58e845c8b73129962eac2 |
| apps/api/src/collection-console-service.ts | 2567112c398106794d0110afe90d94a8793d67ec168e8461d02e531420483310 |
| apps/api/src/mysql-collection-console-repository.ts | c1adfee1a3f3a8e66765d990e804ba57bc234441b233d8f795db72e0f9605915 |
| apps/api/src/crawler-runtime-routes.ts | 69f5e8f0e9c5529aec86ed8c39ad2638551a4dffb6a1f43469b2b3dba8450477 |
| apps/api/src/crawler-runtime-service.ts | 7dda282fdefdd95a9d49ec4be11cc2f67e723122264da54b5de45cadae62f69a |
| apps/api/src/mysql-crawler-runtime-repository.ts | ac4cc7dab79a4baccb55ecaff7582790a67b6eaab616ef096a9b63e2d9e8e518 |
| tests/e2e/m03-05-collection-tasks.spec.ts | 66bcb37988f1c064cff418506013a45b0b44c2d7eed6fa2d38e6a1420964fe96 |
| tests/e2e/m06-03-collection-console.spec.ts | 6ef5270197d6a59ed4e5fabf92f4259c4bf831b8fbc0c891fa48034e8720dd76 |
| tests/e2e/m03-04-playwright-crawler.spec.ts | f49ea67728ed94dab151725403d5cec0e3b46338798d6104cafd879bc2afe287 |
| scripts/lib/ui-phase2-inventory.mjs | fb6f49934ea44c6248dc172d01b86da4d4a0eb7cffca7ed81e6e69d3958a79eb |

## 8. 2026-09-24 O组件当前源码对账

第7节为旧版本指纹快照，保留追溯但不参与当前源码绑定。本节的哈希均由当前LF归一文件直接计算；它们绑定版本身份，不代表本次重新审核API、数据库、权限或运行行为。第2节O组仍匹配的11个候选行号已更新到当前精确位置；17个已不存在的旧候选继续显示为identity-not-found，不拿它们满足覆盖。当前 `CollectionOperationsConsole.vue` 共29个静态候选、5个v-model位置，本次补录之前未归属的18个位置如下。

| 当前源文件 | 当前LF SHA-256 |
| --- | --- |
| apps/web/src/components/CollectionRuntimeSurface.vue | 4808a94cc01371c373139a6134a6f46f0936d82f1ccb263d58bb98dafdbf7f5f |
| apps/web/src/components/CollectionTaskCenter.vue | 6bcf6bdecf1432f02e0d02f11e877bc6e1731793ac762a1cfea27aed696c77de |
| apps/web/src/components/CollectionOperationsConsole.vue | 2072fc208c456f08f3c325c36eae87413048ba93c0b2e50c07dad438eb69e01f |
| apps/web/src/components/CollectionRuntimeCenter.vue | 6cac2faf9677838454ad1471e1fe171b5ca32f0d5459497c99b74882bcfc2b17 |
| apps/web/src/collection-tasks.css | e2bcf0f176fdf670efc402c104fdac4dd2eabbafbbdc4a9d7a21e3c04d90e85f |
| apps/web/src/collection-task-detail.css | cdeb6209781acc6ff747fb4728f9675d69479c53fd3a97dfdb9e0b5c17130544 |
| apps/web/src/styles/platform-operations.css | 2a0a0936d6132cd3fdeb74def417edfd7a038dda43ece9f010b125b62698281b |
| apps/web/src/crawler-runtime.css | 128465547cae7c535c6f8275629b39e7a1ec620d6d73e1f185529563e3ea14cf |
| apps/web/src/components/ConfirmDialog.vue | 3fbdb1841fe1426ecb6a4d808d05d9da8216e501c251b5bf3704b5680af35424 |
| apps/web/src/components/ResponsiveDataView.vue | e848f34bb7500017279b5e39db5b29bad29d222183923cc63ffce164c44b40c7 |
| apps/web/src/components/ResponsiveFilterDrawer.vue | 5eff0a117552e22bf31a0d3761b0613428c777721b8e230b10e76bab39ee0a5f |
| apps/web/src/components/UiStatePanel.vue | 8f0c147245627493cf5d235162b9dc00424875d0296e710f180a3365c603c164 |
| apps/web/src/components/TechnicalDetails.vue | 4e2443f3f7f901c3d1cf14243523956e8705bbd39aed8e0a19d54063220fe82d |
| apps/web/src/api-client.ts | 953c3da783121a797a86ff82e03a968067ae2c694a4fb5f883187b04569fa9ff |
| config/route-catalog.json | eb7071f2a0ced2733110ff51e4852757a8eea5757fe31d399003be5e63e6917b |
| apps/web/src/route-catalog.ts | 6b0d6c7770f26ebf09017c32ce8dec08179d1a9ec1c532b6066ed8efed807956 |
| apps/web/src/router.ts | 67dc541e1856fd5bd30688f9bf64d9e32d66491bb9a1a19d8ce5ef81679162f4 |
| apps/web/src/App.vue | e8ed64e10e641a7988c999c3965c917d4640cd3a4eab213b8f23131641bac531 |
| apps/api/src/collection-task-routes.ts | 74a9af17287692ed20d99b3f5993ad49b07a43ba967801748025a3640a078fbd |
| apps/api/src/collection-task-service.ts | e2be97bceb32547991fe08c629d5459b686bd1672278366e7e3919321af81684 |
| apps/api/src/mysql-collection-task-repository.ts | f2941278cff537ad1d6688989a159b8398db759373bc51379c1f8e7302fcfc47 |
| apps/api/src/collection-console-routes.ts | e728860cac1614245115e5bf43d90ba0ad31115e07e58e845c8b73129962eac2 |
| apps/api/src/collection-console-service.ts | 2567112c398106794d0110afe90d94a8793d67ec168e8461d02e531420483310 |
| apps/api/src/mysql-collection-console-repository.ts | c1adfee1a3f3a8e66765d990e804ba57bc234441b233d8f795db72e0f9605915 |
| apps/api/src/crawler-runtime-routes.ts | 69f5e8f0e9c5529aec86ed8c39ad2638551a4dffb6a1f43469b2b3dba8450477 |
| apps/api/src/crawler-runtime-service.ts | 7dda282fdefdd95a9d49ec4be11cc2f67e723122264da54b5de45cadae62f69a |
| apps/api/src/mysql-crawler-runtime-repository.ts | ac4cc7dab79a4baccb55ecaff7582790a67b6eaab616ef096a9b63e2d9e8e518 |

| 当前candidateId | 行 | 类型 | 当前语义归属 |
| --- | ---: | --- | --- |
| apps/web/src/components/CollectionOperationsConsole.vue#6d3f7d591719f19f.1 | 582 | control | CL52-LOAD / 刷新读取当前固定范围 |
| apps/web/src/components/CollectionOperationsConsole.vue#e0774dcb9c606eef.1 | 625 | control | CL52-SCOPE / resetScope：清除局部范围筛选 |
| apps/web/src/components/CollectionOperationsConsole.vue#002b24e1d917d4a4.1 | 632 | control | CL52-SCOPE / applyScope：提交现有API范围查询 |
| apps/web/src/components/CollectionOperationsConsole.vue#a397ba517c409773.1 | 641 | control | CL52-LOAD / refreshNotice中的重试，复用load |
| apps/web/src/components/CollectionOperationsConsole.vue#c7e32d5d2ec42619.1 | 660 | control | CL52-LOAD / 受状态门控制的重新读取，不显示loading/失权重试 |
| apps/web/src/components/CollectionOperationsConsole.vue#a9b7552ee181c72f.1 | 762 | control | CL52-SOURCE / 展开全部来源或收回前8条，控制对应结果区 |
| apps/web/src/components/CollectionOperationsConsole.vue#4509211b46b0337c.1 | 804 | control | CL52-ROOT / 当前根因存在时清除精确根因筛选 |
| apps/web/src/components/CollectionOperationsConsole.vue#644b6cd23fdb966a.1 | 820 | control | CL52-ROOT / 选择具体真实错误码进入根因下钻，按pressed显当前选择 |
| apps/web/src/components/CollectionOperationsConsole.vue#e4688d99cdaed726.1 | 931 | control | CL52-ATTEMPT / 最近尝试前页；依API总页数及busy禁用 |
| apps/web/src/components/CollectionOperationsConsole.vue#5c6a30d3ce827bee.1 | 942 | control | CL52-ATTEMPT / 最近尝试后页；依API总页数及busy禁用 |
| apps/web/src/components/CollectionOperationsConsole.vue#65c7916ab5f0b4d9.1 | 964 | control | CL52-BATCH / 展开已确认失败与结果未知条目，只披露现有结算事实 |
| apps/web/src/components/CollectionOperationsConsole.vue#3d7519a5ffaadf88.1 | 978 | event-binding | CL52-BATCH / 死信选择change转toggleDeadLetter；单项状态、busy、unknown及20条上限由既有逻辑裁决 |
| apps/web/src/components/CollectionOperationsConsole.vue#935c6c8171139c6b.1 | 988 | event-binding | CL52-BATCH / batchReason受控输入；maxlength/错误清理不另算写操作 |
| apps/web/src/components/CollectionOperationsConsole.vue#9233c1fc5a4723d0.1 | 1013 | control | CL52-BATCH / previewBatchReplay：先校验并冻结目标、影响和原因，再打开确认 |
| apps/web/src/components/CollectionOperationsConsole.vue#ead51c4255c6e1f0.1 | 1043 | control | CL52-DEAD / 开放与已重放死信前页，清当前页外选择 |
| apps/web/src/components/CollectionOperationsConsole.vue#19e60ba8660b9f22.1 | 1054 | control | CL52-DEAD / 开放与已重放死信后页，清当前页外选择 |
| apps/web/src/components/CollectionOperationsConsole.vue#9215901b5115628c.1 | 1072 | event-binding | CL52-BATCH / ConfirmDialog cancel与confirm分别走现有取消/确认所有者 |
| apps/web/src/components/CollectionOperationsConsole.vue#4640753c7de49660.1 | 1072 | dialog-component-call | CL52-BATCH / 破坏性影响确认共享调用；要求确认短语与影响勾选 |

静态回归应核对当前29个candidateId、行号、类型及console当前hash；其中11个沿用第2节原语义并更新行号，本节补18个原先未归属位置。第8.1节将17个已被当前候选替代的旧O身份单独归档，不覆盖新分母。静态对账、源hash与历史隔离均不代表浏览器交互、服务端权限/审计、真实Worker重放或生产验收；第5/6节所有既有限制和CL-G退出条件仍有效。

### 8.1 P52已替代的旧O身份（历史）

以下17个第2节早期O签名已不在当前源码，现行29候选由第8节逐项覆盖。旧身份仅保留历史追溯，不计当前覆盖；语义相近仅作台账交叉索引，不证明运行行为等价。

#### CollectionOperationsConsole.vue

| 旧candidateId | 原始语义 | 当前候选交叉索引 |
| --- | --- | --- |
| O:f04d44ed4df285ab.1 | CL52-LOAD / 刷新 | #6d3f7d591719f19f.1 / CL52-LOAD |
| O:c28b2fc7235cdb49.1 | CL52-SCOPE / resetScope | #e0774dcb9c606eef.1 / CL52-SCOPE |
| O:43ad97abb073c16e.1 | CL52-SCOPE / 原生submit | #002b24e1d917d4a4.1 / CL52-SCOPE |
| O:5cb1142ec0759d3e.1 | CL52-LOAD / hint重试 | #a397ba517c409773.1 / CL52-LOAD |
| O:ea08550bb35442f9.1 | CL52-LOAD / 失败快照重读 | #c7e32d5d2ec42619.1 / CL52-LOAD |
| O:f596c7474d4b8232.1 | CL52-SOURCE / 全部与前8项 | #a9b7552ee181c72f.1 / CL52-SOURCE |
| O:0db0b4127120a05a.1 | CL52-ROOT / 清除精确根因 | #4509211b46b0337c.1 / CL52-ROOT |
| O:e1cacfb14abb0a4c.1 | CL52-ROOT / 精确错误码切换 | #644b6cd23fdb966a.1 / CL52-ROOT |
| O:9a34a1e60386c3be.1 | CL52-ATTEMPT / 前页 | #e4688d99cdaed726.1 / CL52-ATTEMPT |
| O:a8016a8969f38074.1 | CL52-ATTEMPT / 后页 | #5c6a30d3ce827bee.1 / CL52-ATTEMPT |
| O:30995dc421725b22.1 | CL52-BATCH / 失败清单展开 | #65c7916ab5f0b4d9.1 / CL52-BATCH |
| O:104c5add10ee67a1.1 | CL52-BATCH / checkbox变更与选择上限 | #3d7519a5ffaadf88.1 / CL52-BATCH |
| O:713c88750f4f0639.1 | CL52-BATCH / previewBatchReplay | #9233c1fc5a4723d0.1 / CL52-BATCH |
| O:13685210dcee03e5.1 | CL52-DEAD / 前页 | #ead51c4255c6e1f0.1 / CL52-DEAD |
| O:7b21c2da3342a42a.1 | CL52-DEAD / 后页 | #19e60ba8660b9f22.1 / CL52-DEAD |
| O:39535e218053c768.1 | CL52-BATCH / cancel与confirmBatchReplay | #9215901b5115628c.1 / CL52-BATCH |
| O:f843252676c8b85b.1 | CL52-BATCH / 影响确认调用 | #4640753c7de49660.1 / CL52-BATCH |

## 9. P53 CollectionRuntimeCenter 当前源码增量（2026-09-24）

第2节R表中的4个仍存在身份继续沿用既有语义并由审计器标为line-moved；第9.2节归档8个已不存在的旧签名且不抵扣当前覆盖。本节补齐 `CollectionRuntimeCenter.vue` 当前另外8个位置。回收入口打开确认窗而非直接POST；筛选重置、分页及原生技术披露分别按当前实现登记。旧合同中的全局过期租约回收范围、结果未知后禁止重提、服务端授权及幂等语义保持不变。

| 当前candidateId | 行 | 类型 | 当前语义归属 |
| --- | ---: | --- | --- |
| apps/web/src/components/CollectionRuntimeCenter.vue#b3aff7d1ec82177c.1 | 417 | control | CL53-CURRENT-LOAD / 手动重读；刷新或回收中禁用 |
| apps/web/src/components/CollectionRuntimeCenter.vue#7287ecd28dcaceb5.1 | 420 | control | CL53-CURRENT-RECOVER / 打开过期租约全局回收确认；状态未知、无快照风险或忙碌时禁用 |
| apps/web/src/components/CollectionRuntimeCenter.vue#764f755fb3d8ba7c.1 | 553 | control | CL53-CURRENT-FILTER / 提交当前状态与搜索草稿；读写忙碌时禁用 |
| apps/web/src/components/CollectionRuntimeCenter.vue#06482162d2eef909.1 | 554 | control | CL53-CURRENT-FILTER / 恢复全部状态和空搜索并按第一页重读 |
| apps/web/src/components/CollectionRuntimeCenter.vue#7219dcd9d87bc4b0.1 | 680 | control | CL53-CURRENT-PAGE / 读取前页；首末边界或忙碌时禁用 |
| apps/web/src/components/CollectionRuntimeCenter.vue#28a360589b0e3c7f.1 | 688 | control | CL53-CURRENT-PAGE / 读取后页；服务端total_pages边界或忙碌时禁用 |
| apps/web/src/components/CollectionRuntimeCenter.vue#b917496c3d588d7b.1 | 700 | event-binding | CL53-CURRENT-RECOVER / 转发共享确认窗取消/确认至本页状态所有者 |
| apps/web/src/components/CollectionRuntimeCenter.vue#bc8824b8df3a0c77.1 | 700 | dialog-component-call | CL53-CURRENT-RECOVER / 共享确认窗声明仅回收服务端确认为过期的档案租约 |

同一ConfirmDialog位置分别形成事件绑定和弹窗调用两个候选；因此本节8个候选落在7个不同源码位置。当前LF指纹仍以第8节对应文件行绑定，不重复制造哈希声明。

以上仅为源位置和既有合同的静态对账，不是确认回收的真实端到端测试，也不改变生产爬虫运行态或部署状态。

### 9.2 P53已替代的旧R身份（历史）

以下第2节早期R签名已不在当前源码，现行12个候选由第9节当前表逐项覆盖。交叉索引只表示相关入口/处理边界；源码改为先开确认窗，不能将旧直接操作身份解释为等价运行证据。

#### CollectionRuntimeCenter.vue

| 旧candidateId | 旧源码位置 / 类型 | 原始语义 | 当前候选交叉索引 |
| --- | --- | --- | --- |
| R:9dee0a9f3983a0d5.1 | control / 278 | CL53-LOAD / 刷新 | #b3aff7d1ec82177c.1 / CL53-CURRENT-LOAD |
| R:f2f6bbdea261f58a.1 | control / 281 | CL53-RECOVER / 过期回收确认 | #7287ecd28dcaceb5.1 / CL53-CURRENT-RECOVER，现为打开确认窗 |
| R:36c7b60823abfadf.1 | control / 410 | CL53-FILTER / 原生submit | #764f755fb3d8ba7c.1 / CL53-CURRENT-FILTER |
| R:2f1b49bdefe2e793.1 | control / 411 | CL53-FILTER / resetFilters | #06482162d2eef909.1 / CL53-CURRENT-FILTER |
| R:053cd828dd3324d8.1 | control / 532 | CL53-PAGE / 前页 | #7219dcd9d87bc4b0.1 / CL53-CURRENT-PAGE |
| R:b7a08810a69e9930.1 | control / 540 | CL53-PAGE / 后页 | #28a360589b0e3c7f.1 / CL53-CURRENT-PAGE |
| R:44209f4edee14e6e.1 | event-binding / 552 | CL53-RECOVER / cancel、recover事件 | #b917496c3d588d7b.1 / CL53-CURRENT-RECOVER |
| R:4806dd12035653ce.1 | dialog-component-call / 552 | CL53-RECOVER / 全局过期集合确认窗 | #bc8824b8df3a0c77.1 / CL53-CURRENT-RECOVER |

## 10. P51 采集任务当前页面动作归组（2026-09-26）

`action-reviews/P51.json` 将 `/platform-admin/collection` 当前 `CollectionRuntimeSurface.vue` 与 `CollectionTaskCenter.vue` 的26个扫描候选逐项映射到既有CL51合同，覆盖采集页签导航、列表读取、筛选分页、空队列恢复、桌面/移动详情、失败重读、详情键盘/关闭、恢复入口、技术披露及人工重放确认。完整任务列表只映射当前API返回页；页面搜索仍只过滤当前页。P51的写操作仅为既有 dead_letter 人工重放：确认事件调用既有 `/platform/collection/tasks/{id}/replay`，请求只提交 `reason` 并沿用共享 Idempotency-Key；服务端创建新任务并保留历史。共享确认窗内部控件、移动记录抽屉内部状态、真实权限/数据库/Worker与外部采集不冒领为本地源映射证据。

`tests/unit/ui-phase2-p51-action-map.test.mjs` 校验26个候选唯一归属、当前源哈希、重放写边界和未验收状态。用户剩余页面视觉自动通过已单独登记；P51动作审批、全状态读屏、真实 collection:replay/RBAC、MySQL、Worker终态与正式M07-03生产验收仍未通过。

## 11. P52 采集总览当前页面动作归组（2026-09-26）

`action-reviews/P52.json` 将 `/platform-admin/collection/overview` 当前 `CollectionRuntimeSurface.vue` 与 `CollectionOperationsConsole.vue` 的32个扫描候选逐项映射到既有CL52合同，覆盖采集页签导航、服务端范围/根因读取、来源/尝试/死信技术披露、独立分页及批量重放预览与共享确认事件。来源目录前8项/全部展开单独登记为本地披露；移动详情及确认窗的内部控件仍归各自共享组件合同。总览写边界仅限当前页面开放死信选择上限20条、至少2字符且最多500字符原因、冻结批次，以及既有逐条 `/platform/collection/tasks/{task_id}/replay` POST；body只含reason并使用既有任务级幂等键。未知结果不自动重发，逐条成功仅表示创建新任务，不代表采集执行成功。

`tests/unit/ui-phase2-p52-action-map.test.mjs` 校验32个候选唯一归属、范围/分页边界、冻结及未知写结果策略和未验收状态。视觉按用户授权对剩余页面自动通过单独记录；P52动作审批、真实platform:operate/collection:replay与RBAC、MySQL聚合/幂等、Worker终态、共享控件内部验收及正式M07-03生产验收仍未通过。该静态映射不执行重放、不改变API或部署。

## 12. P53 网页采集运行页当前页面动作归组（2026-09-26）

`action-reviews/P53.json` 将 `/platform-admin/collection/browser-runtime` 的 `CollectionRuntimeCenter.vue` 12个当前扫描候选逐项映射到既有CL53合同：读取/状态面重读、运行搜索与状态提交、筛选重置、独立分页、过期档案续期任务导航、运行技术标识、回收确认窗打开及确认事件。回收按钮只打开确认窗；只有共享确认窗confirm事件进入既有 `POST /platform/crawler-runtime/recover-expired`，body为空对象，cancel只关闭确认窗。继续保留Origin/幂等/`collection:replay`、服务端执行时全局过期租约范围、未知结果禁止重提和成功后重新读取；不将回收误述为OS浏览器停止或采集业务恢复。

`tests/unit/ui-phase2-p53-action-map.test.mjs` 校验12个源码候选唯一归属、筛选/续期导航契约、确认窗与真实写入分离，以及生产和权限验收状态边界。视觉按用户授权自动通过；动作审批、真实collection:replay/RBAC、Origin/幂等审计、MySQL租约、Python/OS浏览器状态、外部登录、真实回收及正式M07-03生产验收仍未通过。该静态映射不执行租约回收，也不改变运行合同。
