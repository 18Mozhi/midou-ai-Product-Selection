# B3c · 调度与容量合同复核

2026-09-11 共享复制增量：TechnicalDetails 的哈希行已更新为当前实现；其余历史描述不扩大为最新验收。复制拒绝现有就地反馈、重试和迟到结果隔离，见 [共享复制反馈复核](TECHNICAL-COPY-FEEDBACK-REVIEW.md)。无 API、权限或复制内容调整。

## 2026-09-09 · P71 C方向具体稿补充

[CAPACITY-C-r1](design/capacity-direction-c/README.md)：82场景175PNG、38数据集。蓝色运行边界、白色返回声明/停止事实、性能参考和恢复签认，资源绝对值替代伪占比。指标warning不必有下一档失败，blocked不必是5档未通过；policy未在DTO返回，合同参考与本次阈值不混淆。两类原请求详情和finding披露保留，新增已有降载actions展开；确认词无勾选框/新原因，预览不锁定数据库记录。统一忙碌、ID归属及独立结果是离线提案，真实Vue未改。

五组源隔离/静态检查、七相关旧hash保持。源evaluate接受21上限语义和7/null下一档边界；源签认只校验恢复flags，陈旧/性能阻断但flags为真仍会向仓储传递，且不传观测ID。repository独立选最新已核验行；隔离替身证据不证明真实并发、事务锁、同提交/新鲜度绑定、权限或幂等持久化。SC-G05/06已有更多事实和图，不关闭规则/实现门；SC-G01/07/08及具体审核、全站实现部署签收待办。下一盘点73路由图稿和审核缺口；不执行生产测量、签认、恢复或部署。历史P70“下一P71”为当时状态。

## 2026-09-09 · P70 C方向具体稿补充

[SCHEDULER-C-r1](design/scheduler-direction-c/README.md)：92场景197PNG、36数据集，来源清单/过期快照、资源/回执、档案/租约与小时桶分区。两确认分别显示来源UUID/代码或过期槽位类型/任务/时间，null影响未知而不是0；预览不锁定服务器提交时结果。无勾选框、词trim、初始取消/返焦/Tab/Escape、长手机窗和独立写/读反馈只在离线原型验证。统一忙碌锁、逐对象未知key和POST权限失效清快照也是提案，不擅自改真实规则。

五组真实源隔离/静态检查覆盖九查询转换、evaluator/hostProbe、两恢复repository/service、Vue GET/POST与原派生函数及路由/确认静态绑定；八相关历史hash保持。复现POST/GET交叉、读取早退及请求ID覆盖；未执行真实SQL/并发/幂等持久化/权限/审计/Worker/Python/恢复。SC-G02/03/04/06已有首轮图证据，不关闭真实实现门禁；SC-G01/05/07/08与具体审核、全站实施部署签收仍待办，下一P71。下面“未选A/B/C”和“正式图待交”为历史状态，不能覆盖当前C方向已选但具体稿未批准的事实；历史合同/hash不重写。

起点main/c831885干净工作树。交付[P70](page-specs/P70.md)及[P71](page-specs/P71.md)，事实规格71→73/73；不等于73页正式图或全新Vue交付。F00-1.18-r1未获审，未选A/B/C；G0分母、G1–G5和用户通过状态不改变。

## 1. 入口、消费者与生产者

NavigationShell按route-catalog surface懒加载两组件；platform_admin/preserve，目录operate/superadmin，API会话和platform:operate。两GET private/no-store、14秒API与15秒浏览器边界；GET亦写观测和审计，不是数据库零写入。POST校验Origin和Idempotency-Key，客户端POST不自动重试，不能用GET重试规则解释恢复。P61为共享运维入口，已有规格复用，无新增导航或端点。

P70同一只读repeatable-read连接读取九组事实，后续另事务记录观测；来源enabled及LEAST(concurrency,1)，四状态到期任务按来源去重。5000条providerSamples按provider/finished_at排序的混合集合并非每来源完整24小时窗口；当前等待分位可包含未来任务0等待，sample_count只计已完成duration。趋势总量含运行中、活动槽位关联最多100，不能推成无截断全历史或实际OS进程关联。Linux/proc匹配计数与非Linux1/1占位要区分。

Worker先资源门，再recoverExpired/queueReady/claim，再Redis协调/执行/complete或fail；state-machine在同一事务建立全局Worker与来源槽位，原心跳/释放链保留。provider-source-executor遇open来源阻断该子查询，运行结果独立累计/清零熔断；特殊acceptanceRun分支不被本轮UI拿来绕过。Python lease_client经内部job acquire发送completion_spool，completion_receipts只汇总受限根JSON与隔离区、保留期和可用磁盘；内部service校验后仓储先写水位，再领取/空返回。P70只读最新水位，没有回执上传、下载、删除或重放按钮。

P71repository仅取最新production_benchmark而无SHA筛选，UTC文本解析与stop编码还原后service按policy评价并写api_view/审计。签认先验证kind/reason和snapshot两恢复flag；repository查actor/route/key重放，否则锁取最新已核验行，写drills/operations/审计，不运行压测或恢复。实际签认不调用完整evaluate或同提交检查。缺口不得靠文档将目标说成已实现，也不在本轮擅自改变持久化/安全规则。

## 2. 确认、字段和影响范围

三业务变体均复用ConfirmDialog：过期槽位“确认回收”、当前来源“确认解除”、archive_recovery“确认签认”；均未传destructive，只有确认词而无勾选框。取消按钮初始焦点、Escape/遮罩取消、Tab圈定、关闭返焦、body滚动锁；三个调用不应同时打开造成固定ID重复，需后续生命周期验证。模态关闭不等于POST被取消，父组件请求继续。

过期预览是最新快照的槽位/类型/关联任务数/时间；未知快照目前落到“没有过期”文案，真实事务重新按now筛<=到期，只删scheduler slots。来源恢复只对所选UUID；enabled且open时要求健康ready且checked_at>opened_at，关闭计数/错误并审计。来源弹窗当前未展示所选code，待补对象身份。容量签认body固定archive_recovery和现有中文原因，确认词不是原因输入。

本地绑定P70 providerQuery/providerFilter；共享typedText在三变体启用，acknowledged只在destructive分支存在，本批实际调用不启用；共4处源码绑定不等于4个同时可见字段。两页没有业务form、列设置、下载、编辑或菜单。TechnicalDetails为P70三处/P71两处调用，只传requestId，复制是剪贴板副作用；shared timer/异常链未改。

## 3. 已实现与仍需关闭

两项最小修复均先red再绿：P70不再以隐藏query阻止初始GET，真实无快照回收仍可进入recovering；P71 operationMessage脱离data条件，保留独立读取与操作提示，无快照失败和权限失效也可见。UI2-SC70精确一GET且不触发截获调度写请求；UI2-SC71验证取消、初始焦点、确认词、两409提示、无虚假成功、固定body及同key重试。它们只证明夹具下Vue，不证明实际数据库操作或完整无障碍。

| 缺口 | 当前边界 | 后续关闭证据 |
| --- | --- | --- |
| SC-G01 请求生命周期 | P70仅unmount取消GET、P71无unmount取消；preserve重新激活及POST迟到未验 | 离开/返回、会话变更、延迟/取消和请求归属隔离测试 |
| SC-G02 交叉操作与结果 | 两恢复各自防重但非统一互斥；POST与刷新可交叉；成功后GET可能单飞早退 | 可控pending/终态、不同来源交错和写成功读失败/401403测试 |
| SC-G03 确认身份与预览 | 来源弹窗不显示code；无快照过期预览误用0文案 | 所选对象、未知影响、预览刷新/失效、取消/词输入逐变体图和测试 |
| SC-G04 样本事实 | P70混合5000样本、当前等待与完成样本不一致；非Linux计数是占位 | 真实隔离样本与UI标签对照，不改队列/业务算法凑数 |
| SC-G05 容量可信边界 | 最新DB行≠GET核验同提交；签认flags≠完整评价；warning文案不覆盖全部原因 | 先确定身份/时效/记录绑定契约，获必要授权后后端/迁移及端到端验证；不得仅改claim |
| SC-G06 可访问性与语义 | P70来源progress无名称，容量资源条封顶非比例，旧徽标可与blocked冲突 | 定向名称/单位/状态实例，键盘/读屏/主题/缩放和正式图 |
| SC-G07 共享与权限 | 共享复制拒绝、焦点返还与多实例；P70 POST权限失败保留数据 | 真实权限边界、复制失败、模态生命周期，不以一个取消用例抵扣 |
| SC-G08 运维/图包 | 蓝图旧禁止独立Python与当前AGENTS固定Python对象冲突；容量runbook历史release根不适用 | 按当前AGENTS做部署前身份核验，修订相关旧运行文本后再执行；全正式图/生产/用户签收仍待完成 |

上述缺口不是本轮新增能力申请，也不阻塞独立事实规格；涉及安全/数据契约的修复需先取得明确规则，不能擅自改变。历史生产verified不改为本轮通过；不执行真实回收、签认、健康检查、恢复、压测、迁移、部署。

## 4. 控件候选逐项归属

23局部候选（P70=16，P71=7），共享7，共30；包含事件和模态调用的重复来源，不冻结为去重业务动作分母。

| 源码候选 | 行 | 类型 | 语义与副作用 |
| --- | --- | --- | --- |
| apps/web/src/components/CrawlerSchedulerCenter.vue#8fbfd1dda992c36b.1 | 399 | control | SC70-LOAD GET（自身有审计） |
| apps/web/src/components/CrawlerSchedulerCenter.vue#3c7b3b6045a144ee.1 | 401 | control | SC70-EXPIRED 打开确认，无立即写入 |
| apps/web/src/components/CrawlerSchedulerCenter.vue#4f73abdd0d99fc21.1 | 422 | control | SC70-LOAD 保留快照重试 |
| apps/web/src/components/CrawlerSchedulerCenter.vue#ae52c30c28ab3a05.1 | 436 | control | SC70-LOAD 首次失败重试 |
| apps/web/src/components/CrawlerSchedulerCenter.vue#0767d27629b787d7.1 | 494 | event-binding | SC70-FILTER code包含，本地并回第一页 |
| apps/web/src/components/CrawlerSchedulerCenter.vue#1b581569d5d9e0d4.1 | 503 | event-binding | SC70-FILTER 运行范围，本地并回第一页 |
| apps/web/src/components/CrawlerSchedulerCenter.vue#c07df29b8de46d08.1 | 557 | control | SC70-PROVIDER 打开当前来源确认 |
| apps/web/src/components/CrawlerSchedulerCenter.vue#dac6cbc2991374ba.1 | 566 | control | SC70-DETAIL 原生最近错误披露 |
| apps/web/src/components/CrawlerSchedulerCenter.vue#d868a97237e89c1c.1 | 578 | control | SC70-PAGE 本地上一页 |
| apps/web/src/components/CrawlerSchedulerCenter.vue#3a29e19ec40c7562.1 | 582 | control | SC70-PAGE 本地下一页 |
| apps/web/src/components/CrawlerSchedulerCenter.vue#a00a70cca22f9831.1 | 745 | event-binding | SC70-EXPIRED cancel本地/confirm POST |
| apps/web/src/components/CrawlerSchedulerCenter.vue#b107542a89a71d5c.1 | 745 | dialog-component-call | SC70-EXPIRED 同一确认调用，不重复算动作 |
| apps/web/src/components/CrawlerSchedulerCenter.vue#3c382eda5cb1d9ce.1 | 755 | event-binding | SC70-PROVIDER cancel本地/confirm POST |
| apps/web/src/components/CrawlerSchedulerCenter.vue#9e9fa4a77b724507.1 | 755 | dialog-component-call | SC70-PROVIDER 同一确认调用，不重复算动作 |
| apps/web/src/components/CapacityBoundaryCenter.vue#d0414c44eef669b6.1 | 234 | control | SC71-LOAD GET（自身有审计） |
| apps/web/src/components/CapacityBoundaryCenter.vue#811287f91562f61d.1 | 236 | control | SC71-ATTEST 打开确认 |
| apps/web/src/components/CapacityBoundaryCenter.vue#4f73abdd0d99fc21.1 | 257 | control | SC71-LOAD 保留快照重试 |
| apps/web/src/components/CapacityBoundaryCenter.vue#26fe2d5165472bca.1 | 273 | control | SC71-LOAD 首次失败重试 |
| apps/web/src/components/CapacityBoundaryCenter.vue#bad94329bde0aecb.1 | 413 | event-binding | SC71-ATTEST cancel本地/confirm POST |
| apps/web/src/components/CapacityBoundaryCenter.vue#0db1bef96a99927a.1 | 413 | dialog-component-call | SC71-ATTEST 同一确认调用，不重复算动作 |
| apps/web/src/components/TechnicalDetails.vue#b3ffca8eb967d682.1 | 36 | control | 共享原生披露 |
| apps/web/src/components/TechnicalDetails.vue#c19091da9e2471f1.1 | 43 | control | 复制请求编号至剪贴板，非业务POST |

### 绑定位置

| 文件 | 属性行 | 绑定 | 条件 |
| --- | --- | --- | --- |
| apps/web/src/components/CrawlerSchedulerCenter.vue | 495 | providerQuery | 当前相应组件分支 |
| apps/web/src/components/CrawlerSchedulerCenter.vue | 503 | providerFilter | 当前相应组件分支 |
| apps/web/src/components/ConfirmDialog.vue | 113 | acknowledged | destructive时；本批三变体不启用 |
| apps/web/src/components/ConfirmDialog.vue | 118 | typedText | 当前相应组件分支 |

## 5. 源码指纹

24份LF归一SHA256仅绑定本批复核源码；不会刷新旧图或全局历史hash以冒充重采证。细节以实际代码为准，指纹本身不是语义测试。

| 文件 | SHA256 |
| --- | --- |
| apps/web/src/components/CrawlerSchedulerCenter.vue | ba09a7dbe0d342554b96ed281218fc9fec91d3370435f2266fcabe04c27dda72 |
| apps/web/src/components/CapacityBoundaryCenter.vue | 9f5072b4b48f8364545b6c28cea90848c65f150c64eeab6ea4a7148005a556b4 |
| apps/web/src/components/ConfirmDialog.vue | 6bc5c8473243a8647d901aa0c748640857474f864e7a7636cd10636dbf85db4b |
| apps/web/src/components/TechnicalDetails.vue | 4e2443f3f7f901c3d1cf14243523956e8705bbd39aed8e0a19d54063220fe82d |
| apps/web/src/api-client.ts | 953c3da783121a797a86ff82e03a968067ae2c694a4fb5f883187b04569fa9ff |
| apps/web/src/ui/state-contract.ts | 9c912b4c0507506484cf04b623839869022fdc68eb6ee332e3cb638dee3b267a |
| apps/web/src/components/NavigationShell.vue | 993d7e1a7dc50f7dab6f839428afd3e5d15fac45b0eff9e762392024d47eab92 |
| config/route-catalog.json | d02ade33d087f133ddada8c087085e12c1d321b72f35cd1ef6ffb155076e8150 |
| apps/api/src/crawler-scheduler-service.ts | 58848de6850d5068bc56ea0dbcd077257d82150f75837c08dcfb1f9368a60e99 |
| apps/api/src/crawler-scheduler-repository.ts | 4ff9fdb39e15222c140cbcbb08d06675faf79b55d692eec41a13479743bcacef |
| apps/api/src/crawler-scheduler-routes.ts | 5f5cd36668fe4dfe66e6ae1e171ca7a420143144a9b6ae063daf7c19694c9bc5 |
| apps/api/src/crawler-scheduler-probe.ts | 994f9497dfeff1a044935cc95296a572d5a810065b20fc2196f511d0b03e1e0e |
| apps/api/src/capacity-boundary-service.ts | 2d104fe212fd98d36603e834e97f338eaea3ecbbe1d23fec6538fad64e06cd01 |
| apps/api/src/capacity-boundary-repository.ts | 7c392fa5f2f4b0540b5cf09f1874743b9a305f6e32dc64687e73e65c4e7e73c2 |
| apps/api/src/capacity-boundary-routes.ts | caed60893160639b6919a7e0d44c264ef7e972fc83f04ad44d58297a9753cca6 |
| apps/api/src/server.ts | 1bd6af66a766dd867bbb8aeac6ea3ec34b796858c6e9a59cd5133a4793869d81 |
| apps/worker/src/collection-task-worker.ts | 2bb4ec70ccc04ae872abb781cab8ca2c75ebc54284df6e3795c401ce3dc95ff5 |
| apps/worker/src/collection-task-state-machine.ts | 8bda5b0796853bc7103c6301bcdb07d09ff0ba3bb9f0c0e0ee46a48fd0f9adbd |
| apps/worker/src/provider-source-executor.ts | 212b643454f71b12acd038c2fc479665a60037d054df3c1198755c24ab105d67 |
| apps/api/src/crawler-runtime-routes.ts | 69f5e8f0e9c5529aec86ed8c39ad2638551a4dffb6a1f43469b2b3dba8450477 |
| apps/api/src/crawler-runtime-service.ts | 7dda282fdefdd95a9d49ec4be11cc2f67e723122264da54b5de45cadae62f69a |
| apps/api/src/mysql-crawler-runtime-repository.ts | ac4cc7dab79a4baccb55ecaff7582790a67b6eaab616ef096a9b63e2d9e8e518 |
| apps/crawler/scoutops_crawler/lease_client.py | 8c80eb5d4608f136b814a609ee8f7160f1d394ae5ce87bb01c2f682cb168e1d4 |
| apps/crawler/scoutops_crawler/completion_receipts.py | 7b1e52924659aaffa65d9957db8c5ce5c1963e8b4ee98b8cb82187f11c4f25c2 |

## 6. 验证与交接

定向两项16.5秒通过；最终两模块desktop-chromium/mobile-390共24项57.9秒通过，部分旧用例主动切390，不把全部desktop项目说成固定桌面。未接受或更新截图基线。单测首轮29过2失败，均为架构文档已不含旧霓虹图片文件名的历史断言；已将其替换为当前信息合同及新增回归约束，保留状态/权限/回退等检查，定向2项及完整31项通过。不是放宽产品状态或接受失败快照。

完整构建、质量门及临时材料状态以PROGRESS本批记录为准；新配置、API字段/OpenAPI、数据库迁移、Worker/Python行为、依赖和生产运行均未改，无当前独立重启要求。固定宝塔部署器及其当次迁移/停启预检仍是后续发布路径，不另建Web-only上传链。

## 7. 抽离证据组件的技术详情源码映射（2026-09-24）

P70活动租约区的原生details只按需展示当前已返回的任务UUID、进程标识及存在时的运行UUID，不触发读取、恢复或其他写操作。P71发现区的原生details只展示发现代码和责任角色代码，不触发容量查询、签认、测量或恢复。

| 当前candidateId | 行 | 类型 | 当前语义归属 |
| --- | ---: | --- | --- |
| apps/web/src/components/CrawlerSchedulerEvidence.vue#1d663944bdde1289.1 | 132 | control | P70-SCHEDULER-LEASE-TECH / 展开当前活动租约的技术标识 |
| apps/web/src/components/CapacityBoundaryEvidence.vue#1c008f867673db60.1 | 192 | control | P71-CAPACITY-FINDING-TECH / 展开当前发现的代码与责任角色 |

| 当前源文件 | 当前LF SHA-256 |
| --- | --- |
| apps/web/src/components/CrawlerSchedulerEvidence.vue | 5202b663d54be0d34bb32aaf6b3ffadd632530cf72c40305a74f4ddf08564ee2 |
| apps/web/src/components/CapacityBoundaryEvidence.vue | b815e48915ae9a72d1972d7ef7eebda8b91f5299041ca3028b8af65ef933fbd9 |

## 8. 调度来源健康导航（2026-09-24）

熔断来源行的“前往来源健康”是指向 `/platform-admin/providers/adapters?provider_id=<当前来源ID>` 的 RouterLink。调度页上的链接只负责导航；目标页目前未读取 `provider_id` 查询参数，也不自动选择该来源或执行健康检查。健康检查仍由目标页独立的显式按钮触发。本映射不改变现有目标页行为。

| 当前candidateId | 行 | 类型 | 当前语义归属 |
| --- | ---: | --- | --- |
| apps/web/src/components/CrawlerSchedulerCenter.vue#c198ccff780259e3.1 | 585 | control | SC70-HEALTH-NAV / 导航至已登记适配器路由，不代表健康检查已执行 |

## 9. 已替代源码身份归档

以下八个早期身份已不匹配当前 Vue 源码；P70/P71 新组件与导航映射见第7/8节，共享确认窗继续由现有共享组件合同覆盖。仅保留追溯，不计当前源码覆盖。

| candidateId | 旧行 | 语义 |
| --- | ---: | --- |
| apps/web/src/components/CrawlerSchedulerCenter.vue#6162438a51ad9c44.1 | 554 | SC70-HEALTH 旧来源健康链接 |
| apps/web/src/components/CrawlerSchedulerCenter.vue#1d663944bdde1289.1 | 706 | SC70-DETAIL 旧租约技术披露 |
| apps/web/src/components/CapacityBoundaryCenter.vue#1c008f867673db60.1 | 394 | SC71-DETAIL 旧发现信息披露 |
| apps/web/src/components/ConfirmDialog.vue#0f50ae650a1895b3.1 | 91 | 共享旧遮罩取消 |
| apps/web/src/components/ConfirmDialog.vue#47b44d75a30b19d9.1 | 92 | 共享旧alertdialog定义 |
| apps/web/src/components/ConfirmDialog.vue#30a3b6ddc206839e.1 | 92 | 共享旧Escape/Tab处理 |
| apps/web/src/components/ConfirmDialog.vue#d1b7ac74d4f4ffc3.1 | 123 | 共享旧取消按钮 |
| apps/web/src/components/ConfirmDialog.vue#3003ba3e33804f38.1 | 124 | 共享旧确认按钮 |
