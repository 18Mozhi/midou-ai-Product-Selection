# B1c · 采集任务、总览与浏览器运行合同

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
| S:3c465962052e3b24.1 | control / 12 | CL-NAV / 总览 |
| S:ebad8fdaf536f0e3.1 | control / 16 | CL-NAV / 任务页 |
| S:404044c1ac23071f.1 | control / 20 | CL-NAV / 浏览器运行 |
| T:d1849db8e18799fd.1 | control / 488 | CL51-LOAD / 保留快照刷新 |
| T:a0dc06b99ac90370.1 | control / 491 | CL51-LINK / 浏览器运行 |
| T:2f2f0f3ceae01eac.1 | event-binding / 494 | CL51-LOAD / 状态面primary |
| T:4ec44b3c83794aca.1 | control / 503 | CL51-LOAD / 错误重读 |
| T:7e6436ac5e8e9b15.1 | event-binding / 539 | CL51-FILTER / changeStatus |
| T:dfaa056b9550313b.1 | control / 616 | CL51-DETAIL / 桌面查看push task |
| T:5efbd64729e57af0.1 | control / 661 | CL51-DETAIL / 关闭移动记录后开完整详情 |
| T:1c008f867673db60.1 | control / 671 | CL51-TECH / 移动技术详情 |
| T:680ca05fdeabfdbf.1 | control / 698 | CL51-PAGE / 前页 |
| T:cda5e997a43d64c9.1 | control / 702 | CL51-PAGE / 后页 |
| T:b6414d02a0f96150.1 | event-binding / 711 | CL51-DETAIL / 遮罩mousedown.self关闭 |
| T:472cf13bb7c4d799.1 | dialog-definition / 712 | CL51-DETAIL / loading、error、loaded容器 |
| T:86cb88a88c044c05.1 | event-binding / 712 | CL51-DETAIL / detailKeydown Tab/Escape |
| T:33bc529b8390aa3d.1 | control / 731 | CL51-DETAIL / 失败后读取当前task |
| T:e2f1f3476ece93e2.1 | control / 732 | CL51-DETAIL / 失败关闭 |
| T:30e32a01e61d8558.1 | control / 744 | CL51-DETAIL / 已加载关闭 |
| T:96164ff76e31b8d8.1 | control / 774 | CL51-RECOVER / 重放原因区锚点 |
| T:9334ac0d41264e22.1 | control / 775 | CL51-RECOVER / 凭证、来源或总览链接 |
| T:d499af7185a1f039.1 | control / 798 | CL51-TECH / robots判定展开 |
| T:79686f2d00e174f0.1 | control / 857 | CL51-TECH / 完整技术标识 |
| T:5046ae27ac1c3e07.1 | control / 896 | CL51-REPLAY / 确认预览 |
| T:acbca874b622fd25.1 | event-binding / 908 | CL51-REPLAY / cancel、replay |
| T:e9f14f18f727a992.1 | dialog-component-call / 908 | CL51-REPLAY / 共享确认调用 |
| O:f04d44ed4df285ab.1 | control / 361 | CL52-LOAD / 刷新 |
| O:2506d9788c717641.1 | dialog-component-call / 365 | CL52-SCOPE / 移动筛选抽屉 |
| O:9ba7fa048065cd28.1 | form-event / 366 | CL52-SCOPE / applyScope |
| O:c28b2fc7235cdb49.1 | control / 402 | CL52-SCOPE / resetScope |
| O:43ad97abb073c16e.1 | control / 405 | CL52-SCOPE / 原生submit |
| O:5cb1142ec0759d3e.1 | control / 414 | CL52-LOAD / hint重试 |
| O:ea08550bb35442f9.1 | control / 433 | CL52-LOAD / 失败快照重读 |
| O:3a14c060674cdbaa.1 | control / 443 | CL52-LINK / 响应links六类目标 |
| O:f6229375f6be78df.1 | control / 486 | CL52-SOURCE / 桌面技术展开 |
| O:1c008f867673db60.1 | control / 529 | CL52-SOURCE / 移动技术展开 |
| O:f596c7474d4b8232.1 | control / 534 | CL52-SOURCE / 全部与前8项 |
| O:0db0b4127120a05a.1 | control / 575 | CL52-ROOT / 清除精确根因 |
| O:e1cacfb14abb0a4c.1 | control / 590 | CL52-ROOT / 精确错误码切换 |
| O:1c008f867673db60.2 | control / 600 | CL52-ROOT / 原始错误码 |
| O:f6229375f6be78df.2 | control / 638 | CL52-ATTEMPT / 桌面技术展开 |
| O:1c008f867673db60.3 | control / 685 | CL52-ATTEMPT / 移动技术展开 |
| O:9a34a1e60386c3be.1 | control / 700 | CL52-ATTEMPT / 前页 |
| O:a8016a8969f38074.1 | control / 711 | CL52-ATTEMPT / 后页 |
| O:30995dc421725b22.1 | control / 729 | CL52-BATCH / 失败清单展开 |
| O:660c7a198b93551d.1 | control / 737 | CL52-BATCH / 安全重放区展开 |
| O:104c5add10ee67a1.1 | event-binding / 743 | CL52-BATCH / checkbox change与20项上限 |
| O:713c88750f4f0639.1 | control / 759 | CL52-BATCH / previewBatchReplay |
| O:9ebd065e5010fd46.1 | control / 767 | CL52-DEAD / 链接单任务详情重放 |
| O:1c008f867673db60.4 | control / 771 | CL52-DEAD / 技术详情 |
| O:13685210dcee03e5.1 | control / 788 | CL52-DEAD / 前页 |
| O:7b21c2da3342a42a.1 | control / 799 | CL52-DEAD / 后页 |
| O:39535e218053c768.1 | event-binding / 816 | CL52-BATCH / cancel、confirmBatchReplay |
| O:f843252676c8b85b.1 | dialog-component-call / 816 | CL52-BATCH / 影响确认调用 |
| R:9dee0a9f3983a0d5.1 | control / 278 | CL53-LOAD / 刷新 |
| R:f2f6bbdea261f58a.1 | control / 281 | CL53-RECOVER / 过期回收确认 |
| R:25af292333a00121.1 | event-binding / 291 | CL53-LOAD / 状态面primary |
| R:a9a0bd7b83bfaa17.1 | control / 374 | CL53-RENEW / blocked_login任务链接 |
| R:cbea42c5b9e6a6b3.1 | form-event / 388 | CL53-FILTER / applyFilters |
| R:36c7b60823abfadf.1 | control / 410 | CL53-FILTER / 原生submit |
| R:2f1b49bdefe2e793.1 | control / 411 | CL53-FILTER / resetFilters |
| R:1c008f867673db60.1 | control / 500 | CL53-DETAIL / 移动技术展开 |
| R:053cd828dd3324d8.1 | control / 532 | CL53-PAGE / 前页 |
| R:b7a08810a69e9930.1 | control / 540 | CL53-PAGE / 后页 |
| R:44209f4edee14e6e.1 | event-binding / 552 | CL53-RECOVER / cancel、recover |
| R:4806dd12035653ce.1 | dialog-component-call / 552 | CL53-RECOVER / 全局过期集合确认 |

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
| O:754 | batchReason | trim≥2、原始≤500；非冻结快照 |
| R:392 | queryDraft | 提交到query后请求，≤160 |
| R:399 | status | 查询提交生效，不立即GET |

O:743的checkbox另外由:checked/:disabled及@change转发到toggleDeadLetter；状态非open/batchBusy禁用，不能把这个输入漏在10个v-model之外。ConfirmDialog共享影响勾选仅在destructive=true时出现，不能一概计入三个调用；T未传该prop，默认false，实际只输入“确认重放”。R也未传该prop，P53复核确认只输入“确认回收”。共享签认输入不在局部v-model数量内；O依其destructive调用保留影响勾选，不跨页套用。

T详情loading/error/loaded、死信确认；O范围抽屉、来源/尝试记录详情、批量确认；R运行记录详情、租约回收确认分别出桌面/移动及全部适用状态图。原生details/summary不是模态，仍需展开/折叠与键盘验收。当前共享记录抽屉无完整Tab闭环的源码保证，实际验证不能只断言role存在。

## 4. 读写合同与真实统计

| 页面 / 操作 | 实际合同 | 不可误报 |
| --- | --- | --- |
| T列表 | GET tasks?page&page_size=50&status；文本只筛当前页；meta.total服务端 | 四项摘要均当前页，不能画成平台总量 |
| T详情 | GET tasks/{UUID}；每条子查询事实、尝试/事件/死信 | 空成功、无新内容、解析失败不同；缺result_kind不补猜 |
| T或O单任务重放 | POST tasks/{id}/replay reason；collection:replay、Origin、Idempotency-Key | dead_letter锁定后新建scheduled任务，旧任务/尝试保留；不是恢复成功 |
| O总览 | GET console范围、时间、两页码与精确错误；读有审计 | sources仅provider过滤；各统计表时间字段不同；root只数死信且不被当前error筛掉 |
| O批量 | 最多20当前开放项；确认时复制items，串行单任务POST | 不整批回滚，reason在各次循环读取；失败未必全部继续留在新页选择 |
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
| CL-G01 | 三页preserve；仅卸载abort，无deactivated/全面代次，快速查询/历史变化可能失配 | 可控迟到读/写、同路由及跨页返回、组织/角色变化；当前CL51只覆盖task移除 |
| CL-G02 | T重放写反馈可能在关闭/换任务后设置旧详情；O批原因未冻结、过滤可变；R回收再刷新提示覆盖 | 精确body/目标/幂等/调用次数，离开与部分成功不误导；先复现不猜新业务规则 |
| CL-G03 | T loading/error标题关联缺失，loading无常驻关闭；共享移动抽屉及二级转详情焦点 | 真实键盘、Tab循环、Escape、焦点返回、错误关联与读屏可达，不能靠CSS或脚本改DOM绕过 |
| CL-G04 | T状态下拉缺automatically_replayed；空服务端结果隐藏筛选；O ready未计attempts | 核对真实可达数据/过滤合同，分别复现并修必要呈现；不改任务状态机 |
| CL-G05 | 三页初次与刷新失权的处理不同；路由能力与API能力不同 | 六角色真实允许/拒绝、当前快照安全展示和跨范围隔离，不能用Mock权限冒充 |
| CL-G06 | 指标范围、登录期限与真实运行含义不同 | 正式新图明确范围/时间/未知，真实API与SQL核对，不新增假指标 |
| CL-G07 | 全新结构、全按钮/弹窗/主题/密度与生产仍未交 | 正式审图→Vue→全量适用行为→宝塔同SHA→用户签收；高影响最终提交按具体授权 |

已有J07/PR-G01业务差异按原合同独立决策，本批不处理或默认解决。每项仍可在已知权限下开展的事实/隔离验证继续推进，不能以本批两修复替代全阶段。

## 7. 来源指纹

以下LF归一SHA-256绑定本批最终源文件；不是声称这些工作树修改已包含于起点提交。仅哈希相符证明来源一致，不证明界面或接口已执行。图与生产证据仍须另行采集。

| 源路径（仓库根相对） | LF SHA-256 |
| --- | --- |
| apps/web/src/components/CollectionRuntimeSurface.vue | f0420048e7dcdc8f0106f7c10644aee298c4b8204c9cbd378dfe2034a79f9335 |
| apps/web/src/components/CollectionTaskCenter.vue | 1e2c3b8ae78152dc01991641730fcfe5f8e835395c6919bb674875e7c6fa79ed |
| apps/web/src/components/CollectionOperationsConsole.vue | 0e22a3d1ae404c05b96b321424be8489c6c3bd21f2223e33af09c3eebef3b856 |
| apps/web/src/components/CollectionRuntimeCenter.vue | e6829b2cc84321af56e830cbd60839eafa89f23937cb44eeccf6b79e2428b3b4 |
| apps/web/src/collection-tasks.css | 7219c3d2c3261327c8373e0d59d1cb5c748fe4400722b99684afb91c9c60a0b4 |
| apps/web/src/collection-task-detail.css | cdeb6209781acc6ff747fb4728f9675d69479c53fd3a97dfdb9e0b5c17130544 |
| apps/web/src/styles/platform-operations.css | 7fd76092fe05dfaac21310794381af649eeecf2421c5d136162b19e1335f86f9 |
| apps/web/src/crawler-runtime.css | 3d6f9d1a19357079254d606047176d243bef82e4f9bdd76dec86fd6dfadcbd2a |
| apps/web/src/components/ConfirmDialog.vue | 6bc5c8473243a8647d901aa0c748640857474f864e7a7636cd10636dbf85db4b |
| apps/web/src/components/ResponsiveDataView.vue | 28fa47d1a8beac1666c0cf8be1316484abd39729682a68adb4fed803742f2aaa |
| apps/web/src/components/ResponsiveFilterDrawer.vue | daa1cda68e206b85f5cfa687ae9ee70795a20e2a67d79501cc22fbf53c162a39 |
| apps/web/src/components/UiStatePanel.vue | 8f0c147245627493cf5d235162b9dc00424875d0296e710f180a3365c603c164 |
| apps/web/src/components/TechnicalDetails.vue | f4a499a068700cb49cb6f7467c6969309636c87a093356b634771b5d1a1aebb0 |
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
| tests/e2e/m03-05-collection-tasks.spec.ts | 9218c2552339e5c25f2920f9fc340d9b546e89621c0978f4208179ae66151afd |
| tests/e2e/m06-03-collection-console.spec.ts | 66d280b839d4a9b203fa165fa56e7aaa02a9b120e304bb69b752752c9fd57a41 |
| tests/e2e/m03-04-playwright-crawler.spec.ts | 8f648aee8d5cb1cdffc4534be30e5e64c18702567aeb3cb953cd6db7f5db695b |
| scripts/lib/ui-phase2-inventory.mjs | fb6f49934ea44c6248dc172d01b86da4d4a0eb7cffca7ed81e6e69d3958a79eb |
