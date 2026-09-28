# P21/P22 供应与费用规则合同复核

2026-09-07；从main/3a886d3干净起点开始。本文是源码事实、页面规格和局部隔离Vue回归，不是最终新稿、真实数据库或生产验收。全局生成清单仍绑定060e0b5/caf0574f33b1c91a446e6a7784bc954fc6d926d44ba5b349df538190304eff8d；本批产品修复后旧全局证据不能自动称为当前有效，提交后须按源变化刷新。下表以本批工作树LF源码为准，使用现有scanSource只读复核；不覆写生成物审核状态。

## 1. 入口、事实及版本

route-catalog → NavigationShell → surfaceProps：P21 SourcingWorkspace，P22 CostRuleConsole，均reset_on_scope。P21 API sourcing-routes→sourcing-service→mysql-sourcing-repository；成本子面板与P22走profit-routes→profit-service→mysql-profit-repository。P21浏览需sourcing:read，写入supplier_quote:manage；P22浏览opportunity:read，规则写入opportunity:approve；成本提交/重算cost:confirm。审批需本人真实selection_manager/organization_admin，复核按服务端can_review及指定复核人，不能只凭角色名称推断。

| 源码简称 | 文件（apps/web/src/components/下） | 本批LF SHA256                                                    |
| -------- | ---------------------------------- | ---------------------------------------------------------------- |
| SW       | SourcingWorkspace.vue              | cf43c75418e76ffc758811796243e8924fbbe6af7cf25a26bff163dda0559d25 |
| SD       | SourcingWorkspaceDialogs.vue       | 291b46c28f8f14fdb3a3477b17d06dee7d18bd561fbc854bf76cd36d7f2b96b0 |
| SP       | SourcingComparisonPanel.vue        | 5513507982cab3db9388917868feae9fe3d9e28eb423abc8065c679b414914bd |
| SC       | SourcingCostConfirmationPanel.vue  | 99ff2ace736c0f05862e792a569200faa8c69a8f73c5fac6a282e069adb925b6 |
| CR       | CostRuleConsole.vue                | 1eab3c325b67e47a3ed475be19a25891019258ce7fd2a75a184bd26cfa6cd7b3 |
| PP       | OpportunityProfitPanel.vue         | c1d0e8d44af82ed7305481a9d8299c05fd0737e65ded0987a412aa36b5334dd6 |
| RQ       | OpportunityCostReviewQueue.vue     | 9a3e9de6a888e26f91fa138f5507179d8cea3d97446efe7fdb711831cb581b47 |

2026-09-29源码续记：当前 `SourcingCostConfirmationPanel` 已向共享 `OpportunityProfitPanel` 传入复核人加载/错误/追踪状态，并转发 `retry-reviewers` 到 `loadReviewers(currentScope())`；因此 P21 的复核人失败重试入口可达，不再作为 P18 专属排除。同步映射机会版本重读、利润数据重读、双人复核提交与利润重算控件；仅确认当前源码归属，不代表真实 API、RBAC 或生产验收。

2026-09-29 P22续记：CostRuleConsole 两个弹窗现均通过 `useModalDialog` 开启焦点环绕，触发器卸载时回到页面标题；写入期间字段与关闭入口锁定，拒绝响应留在弹窗并需显式重试。新建表单错误与动作错误分别就近关联；P22 当前 Vue 键盘/409/单飞状态有桌面及手机 E2E 覆盖。此处只更新源码与局部浏览器证据，P21四窗、RQ、完整读屏、真实权限/生产审批仍未验收。

局部共80个控件/事件候选、7个弹窗定义/调用候选、44处v-model。SP与QualityGateSetupSummary只有呈现/slot，无本地交互候选；共享UiStatePanel和useModalDialog行为按实际调用方检查，不在此重复全站盘点。PP/RQ与P18共享，以下仅记录P21调用合同，不重复加算全站分母。

## 2. 全部控件与事件候选

candidateId完整格式为源码文件路径加`#`及下表后缀；同语义的form提交/按钮/关闭入口分别保留。纯表单提交拦截、事件转发不直接等于独立业务写入。

| 源  | 行  | candidate后缀      | 语义与触发结果                              |
| --- | --- | ------------------ | ------------------------------------------- |
| SW  | 386 | 4c5b0e4130d85030.1 | SC-NAV sourcing                             |
| SW  | 387 | 4862df3dce4b0f1c.1 | SC-NAV cost-rules                           |
| SW  | 401 | 32fc6740cd676281.1 | SC-S-OPEN 管理者创建                        |
| SW  | 428 | 307f53938ca7e688.1 | SC-STATE 主/次恢复或创建                    |
| SW  | 437 | 4ded8067979a3682.1 | SC-SEARCH-CLEAR / 空筛选次动作              |
| SW  | 449 | 95c07db60d43a586.1 | SC-DETAIL 读对象并同步record                |
| SW  | 471 | 100e00b6d8cb9e4a.1 | SC-REFRESH 管理者POST当前对象               |
| SW  | 474 | dd2297ed2ff6c2a5.1 | SC-NAV cost-rules含from                     |
| SW  | 652 | 1e3fc27654fc0776.1 | SC-DELETE-OPEN 管理者选中目标               |
| SW  | 538 | a9d2be84fdbc9665.1 | SC-NAV 受权采集明细                         |
| SW  | 559 | 46efe1c7f3d39475.1 | SC-ERP 原始ERP新窗口                        |
| SW  | 576 | 8fb00fc320cdc059.1 | SC-SELECT 勾选与实际最多五项同步            |
| SW  | 628 | 792656883236da58.1 | SC-SOURCE 原始商品新窗口                    |
| SW  | 632 | 1a57994baa2329f6.1 | SC-QUOTE-OPEN 管理者无quote                 |
| SW  | 634 | 6ec48a1f9259ef0d.1 | SC-PURCHASE-OPEN 管理者已有quote            |
| SW  | 650 | 658745acd55fced2.1 | SC-COMPARE 至少2项且非busy                  |
| SW  | 828 | 0e42b816192eb48e.1 | SD九个事件转发、删除原因更新                |
| SW  | 828 | 5aab87e8ea0ee176.1 | 四窗共享调用，不另外计为第五个业务窗         |
| SW  | 642 | e60a87b8bebccb4b.1 | SC-G02 独立读取对比历史失败及重试事件转发   |
| SP  | 61  | 49464ad9054e6202.1 | SC-G02 重试对比历史 GET 按钮                |
| SD  | 128 | e761df41504fce67.1 | SC-S-CLOSE Escape                           |
| SD  | 135 | 2cd14710e221241b.1 | SC-S-SUBMIT 表单                            |
| SD  | 104 | e3badf15ec2af147.1 | SC-S-CLOSE X                                |
| SD  | 134 | 62730beed005a395.1 | SC-S-CLOSE 取消                             |
| SD  | 135 | 7a0fba6035dcdf87.1 | SC-S-SUBMIT 按钮                            |
| SD  | 187 | 0a2fd5d5c73aa500.1 | SC-QUOTE-CLOSE Escape                       |
| SD  | 194 | 00dca39bee5ea478.1 | SC-QUOTE-SUBMIT 表单                        |
| SD  | 151 | bbe2d6bcbbb332dc.1 | SC-QUOTE-CLOSE X                            |
| SD  | 206 | 830881852f5cf052.1 | SC-QUOTE-CLOSE 取消                         |
| SD  | 207 | 6d422d5b42df032c.1 | SC-QUOTE-SUBMIT 按钮                        |
| SD  | 271 | 33659286562fda16.1 | SC-PURCHASE-CLOSE Escape                    |
| SD  | 278 | d990de8d6f06fa26.1 | SC-PURCHASE-SUBMIT 表单                     |
| SD  | 226 | 9ce7604ffb1d3c16.1 | SC-PURCHASE-CLOSE X                         |
| SD  | 266 | 23fa0ead54c8b92d.1 | SC-PURCHASE-CLOSE 取消                      |
| SD  | 267 | bead229bf1acdb7a.1 | SC-PURCHASE-SUBMIT 按钮                     |
| SD  | 352 | 6f31ea2421d022b2.1 | SC-DELETE-CLOSE Escape                      |
| SD  | 359 | 8a8ef03aa897476d.1 | SC-DELETE-SUBMIT 表单                       |
| SD  | 292 | c748a332b4a8b069.1 | SC-DELETE-CLOSE X                           |
| SD  | 311 | 0a71f3799436c08c.1 | SC-DELETE-CLOSE 取消                        |
| SD  | 312 | 9d23c498e72940a2.1 | SC-DELETE-SUBMIT 按钮                       |
| SC  | 127 | bb5d5e072948baa9.1 | SC-NAV 机会利润详情                         |
| SC  | 286 | 857740e31a8963ec.1 | 成本提交/复核/重算及读取重试事件转发        |
| SC  | 279 | 289c8e971f49889b.1 | SC-COST-READ-RETRY 机会版本重读              |
| CR  | 534 | ae99ecef74f5d4d3.1 | SC-R-BACK 安全from                          |
| CR  | 535 | 5e3909def7e4baa9.1 | SC-R-CREATE 管理者非ready或active           |
| CR  | 547 | b2df3db97280e7e2.1 | SC-R-STATE 首条创建/刷新/返回               |
| CR  | 574 | ed4cdadd71405209.1 | SC-R-CREATE ready且无active                 |
| CR  | 582 | 6a49826ecb55d1fd.1 | SC-R-BACK 准备度返回                        |
| CR  | 586 | e4a92ae55317039d.1 | SC-R-SEARCH 表单只阻止提交导航              |
| CR  | 598 | 0aca31814d8e2a23.1 | SC-R-RESET 清筛选                           |
| CR  | 604 | c4344a6ce7acbca8.1 | SC-R-SELECT 本地选择与URL                   |
| CR  | 623 | 83d11b8719b1c99d.1 | SC-R-PAGE-PREV 页码边界                     |
| CR  | 625 | bd43d7b540116c32.1 | SC-R-PAGE-NEXT 页码边界                     |
| CR  | 658 | 9e33896b68e8e4fe.1 | SC-R-SOURCE 已保存来源新窗口                |
| CR  | 672 | 55f48a15788735d1.1 | SC-R-SUBMIT draft                           |
| CR  | 680 | ea3ec6b286c61f0c.1 | SC-R-APPROVE selection_manager              |
| CR  | 687 | eac5ef200003454a.1 | SC-R-REJECT selection_manager               |
| CR  | 695 | 6ac633aba6b533bd.1 | SC-R-APPROVE organization_admin             |
| CR  | 702 | 5d293fdba6594665.1 | SC-R-REJECT organization_admin              |
| CR  | 711 | 513ba8c3e39973c0.1 | SC-R-PUBLISH approved                       |
| CR  | 718 | fab085a093adfa3a.1 | SC-R-ROLLBACK active且有有效目标            |
| CR  | 774 | f7f89c631a4cfd69.1 | SC-R-CREATE-DEFINITION 新建草稿弹窗          |
| CR  | 774 | 5db2d0d00a28d18b.1 | SC-R-CREATE-CLOSE 原生cancel                |
| CR  | 783 | c099eb06e95d2212.1 | SC-R-CREATE-SUBMIT 表单                     |
| CR  | 795 | f2cd423a0267e8bf.1 | SC-R-CREATE-CLOSE X                         |
| CR  | 864 | 4fa3694ad39564c9.1 | SC-R-CREATE-CLOSE 取消                      |
| CR  | 865 | bdb318fcff422d4c.1 | SC-R-CREATE-SUBMIT 按钮                     |
| CR  | 946 | 5de98ef30653ebcb.1 | SC-R-ACTION-DEFINITION 七类动作弹窗          |
| CR  | 946 | 6c29bff30f6c9e9d.1 | SC-R-ACTION-CLOSE 原生cancel                |
| CR  | 959 | b65ab0647ba3d0fd.1 | SC-R-ACTION-SUBMIT submitAction 表单        |
| CR  | 968 | 89388d2e7acd060d.1 | SC-R-ACTION-CLOSE X                         |
| CR  | 908 | ca4f082d1ca76f11.1 | SC-R-ACTION-CLOSE 取消                      |
| CR  | 909 | 1b870bc1240e4ab6.1 | SC-R-ACTION-SUBMIT 按钮                     |
| PP  | 54  | 2bab3ff056a52675.1 | SC-NAV 管理费用规则                         |
| PP  | 121 | fbf7d2a587c0931b.1 | SC-COST-REVIEW 转发                         |
| PP  | 135 | 21c282e197f8be16.1 | SC-COST-SUBMIT 表单                         |
| PP  | 84  | aa3f50e6ccf98cb4.1 | SC-COST-READ-RETRY 利润数据重读              |
| PP  | 233 | d25bbd68583e5a3d.1 | SC-COST-SUBMIT 指定复核人且非busy           |
| PP  | 245 | f8671d189e947071.1 | SC-COST-RECALCULATE 排队                    |
| PP  | 223 | 1dfebd67b12367cb.1 | SC-COST-REVIEWER-RETRY 指定复核人名单重试    |
| RQ  | 107 | 9e1d20d4dd860bdc.1 | SC-COST-REVIEW rejected打开                 |
| RQ  | 108 | 8cc90a8748defa76.1 | SC-COST-REVIEW approved打开                 |
| RQ  | 110 | 3fe574c620a554f9.1 | SC-COST-REVIEW 表单提交                     |
| RQ  | 119 | 7c728ed5ba0c7cd7.1 | SC-COST-REVIEW-CANCEL                       |
| RQ  | 120 | 8c06fd5c1d000db0.1 | SC-COST-REVIEW 提交按钮                     |

## 3. 弹窗与输入分母

| 源  | 行  | dialog候选后缀     | 变体                                                 |
| --- | --- | ------------------ | ---------------------------------------------------- |
| SW  | 654 | fca0d2d5d8880776.1 | 四窗共享调用，不另外计为第五个业务窗                 |
| SD  | 128 | d6b978b68b9e050e.1 | 搜索四类输入，字段标签随类型变                       |
| SD  | 187 | d730100a2a0668bc.1 | 报价证据确认                                         |
| SD  | 271 | 3bc48926013530b0.1 | 采购MOQ/原因                                         |
| SD  | 352 | 7532644429232b14.1 | 记录原因软删                                         |
| CR  | 742 | 0cffdbc28160492d.1 | 新建草稿、人工/自动成本可选字段                      |
| CR  | 871 | 69fe3471229b26ea.1 | 操作确认弹窗定义；各操作变体另由独立状态与角色行映射 |

44处v-model：SW query(423)；SD searchForm.input_type/input_ref(114/123)，quote.specification/moq/lead_time_days/location/confidence_value/stability_status/risk_level/observed_at/evidence_id(160/162/164/166/169/176/183/190/194)，purchaseForm.quantity/reason(250/258)，deleteReasonModel(304)；CR search/statusFilter(577/580)，form.market/platform/version_code/name/effective_from(747/748/752/756/757)，platform_fee/payment_fee/tax/fulfillment/currency/logistics(762/771/780/789/797/805)，automatic_product_family/conversion_rate/conversion_effective_on/conversion_source_url(816/823/832/838)，rollbackTargetId/actionReason(881/890)；PP costForm.platform/input_type/amount_value/currency/source_type/source_ref_id/evidence_id/observed_at/reviewer_id(128/130/138/144/145/146/147/148/150)；RQ review.reason(82)。字段分支不是新增持久化字段；只读文本与progress不算按钮。

SD四个原生dialog均通过useModalDialog调用showModal，首次打开聚焦首个控件，Tab/Shift+Tab保持在弹窗内，Escape与显式关闭沿父级既有处理并将焦点返还页面标题；关闭不取消已发送写入。P21双端E2E覆盖四窗键盘边界、关闭返焦及busy防重复请求；这不等同于完整读屏或生产权限验收。CR同样复用useModalDialog；复杂变体仍需辅助技术验收。

## 4. 请求与持久化事实

- POST /sourcing/searches只由当前页面发input_type/input_ref，后端另可接受collection_task_id但此页面不发。写入先同源、鉴权、幂等；无合法来源条款时不能排队。当前无轮询，不能把后端投影当成浏览器自动刷新。
- POST /sourcing/quotes包含candidate_id及九个显式报价字段；不可编辑商品原始价格/币种。后端确认检查candidate与证据归属，旧quote.is_current归零，新增quote_version；返回id/candidate_id/quote_version/status=confirmed。当前unknown稳定性/风险在服务端允许，不能在测试中自行收紧。
- POST /sourcing/comparisons为name/quote_ids，2–5唯一ID且当前范围is_current=1；历史GET按已保存ID读取，后来旧版仍可能保留。POST /sourcing/purchase-tasks为quote_id/quantity/trim原因，后端数量≥当前MOQ，返回queued并写Outbox，不证明采购执行完成。
- POST /cost-rules包含市场/平台/版本/名称/生效日、fee_lines、conversion_rates和automatic_scope。四项必需费用显式输入，0有效；可选物流空省略，汇率空数组，自动范围默认null。规则创建不检查不存在active；插入新draft，不更新现行版。前端恢复入口完全复用该既有合同。
- POST /cost-rules/:id/actions必含action/reason/expected_revision；审批/拒绝带本人approval_role，回滚带target_rule_id。服务端真实角色校验、事务revision、双角色审批和同市场/平台目标约束不变。规则双角色与成本双人不能混写。
- P21成本写入分别为/opportunities/:id/cost-inputs、cost-input-reviews/:reviewId/actions、profit-runs；expected_version来自机会或review，不是费用revision。指定另一名cost:confirm成员，pending成本不激活；通过才替换当前成本并排队。PP/RQ只发事件，父SC决定实际URL与版本。

## 5. 复现、修复与局部回归

UI2-SC01先失败：已显示“成本规则已生效”，但“新建规则版本”不存在；原因是页首仅非ready、准备度仅无active时显示入口，两个分支共同排除了active。CR仅改为canManage且(非ready或active)，保留原handler、默认空费率和权限；SC01再验取消焦点、重开清草稿、四显式0、准确POST及返回draft。SC02只读active仍无写入口；SC03单角色批准请求、409原因保留和取消无自动重放。

UI2-SC04四实例核对四类输入required、取消清query但保留当前草稿、只发input_type/input_ref，前端不trim，由既有服务处理。SC05采购显示v2、100 MOQ、99禁提交、取消重开及100/trim原因/准确quote_id，响应queued。SC06先失败：第六checkbox显示checked，selectedQuotes仍五项；SW.choose增加event并将原生checked同步到实际集合，无算法/接口改变。修复后核对1项禁保存、2项可保存、5项上限与精确quote IDs。

这九个新增实例复用原两个E2E文件的导航和夹具，不新增依赖，不改已有用例预期或截图基线。最终运行结果见PROGRESS；成功fixture不证明真实SQL、审计/Outbox、RBAC或采集。取消零写入仅指当前测试捕获的业务POST，没有声称整个应用或真实数据库零写入。

与旧生成清单相比，CR创建候选524从2c957c49de664b62.1→5e3909def7e4baa9.1，后续候选行号+4；SW选择候选574从221a8fab4df9f057.1→当前576/8fb00fc320cdc059.1，其余template行号+2。对应SC-R-CREATE/SC-SELECT语义不换ID；其余局部候选签名不变。全局源指纹、其他页人工引用和受关联图库在产品提交后按真实影响刷新，不仅替换SHA。

## 6. 未关闭项及完成边界

| ID     | 证据与边界                                                                                                                                                                                                                                                                                                                                | 退出条件                                                                                                                 |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| SC-G01 | 当前缺失报价预填1/7/80；稳定性选项/API为variable，但SW标签字典为volatile                                                                                                                                                                                                                                                                  | 核实预填是否符合业务期望；先复现真实variable展示，按确认范围处理，不用历史默认充当证据                                   |
| SC-G02 | 比较历史读取已独立降级：失败不阻断找货列表/详情；可重试错误仅重试GET，401/403不提供重试，刷新失败保留既有成功历史。桌面/手机 E2E 各16项通过；详情失败及其他恢复边界仍未解决                                                                                                                                                               | 保持历史可选读取合同；后续独立验证详情失败、读代次/迟到响应及恢复，不扩大到写入或权限行为                                |
| SC-G03 | 2026-09-28：SW 找货/报价/采购/删除及比较/重采集写入口增加函数级 busy 守卫；四弹窗提交以弹窗代次与路由代次隔离迟到成功/失败，关闭重开和重复 `requestSubmit` 双端回归通过。2026-09-29：成本面板三类 POST 按机会范围同步互斥；换机会后的迟到回执不污染当前状态；写成功回执与随后 GET 失败分开显示。成本表单重复提交仅一条请求，已由双端实 Vue 测试验证。已发请求不会被关窗/换机会撤回。 | 剩余 SW/SC 父层读取与 KeepAlive/scope、真实后端/RBAC及操作后数据事实；不把客户端关闭或代次保护当成服务端撤销/幂等证据 |
| SC-G04 | P22 两窗已加入焦点环绕/返焦、写入中锁定、就近错误说明与忙碌反馈，桌面及手机 E2E 覆盖草稿和动作窗局部路径；P21 的 SD 四窗、RQ 内联表单取消/成功归属未全验                                                                                                                                                                                              | 完成 P21 四窗、RQ 键盘/错误可达/移动键盘及辅助技术验证；P22 仍需完整读屏与真实审批环境验证                              |
| SC-G05 | 成本子面板机会版本/利润/复核人 GET 现按机会 ID 与请求代次归属；同机会保留已成功利润快照，切换机会清旧快照，并可独立重读。父层搜索列表/详情/比较、CR，以及路由反向同步、KeepAlive、范围与多标签仍未全验                                                                                                                                 | 对父层迟到200/404、离开返回、scope切换和history按实际对象归属处理；不以成本子面板测试或壳层缓存配置替代证据               |
| SC-G06 | 对比历史“现行报价”标签可能指向旧报价版本；费用规则准备度可能取首active而非当前市场。刷新/删除及成本写入成功回执现保留在后续读取之外；成本刷新失败另列读错误                                                                                                                                                                | 核对历史报价版本语义及多市场展示；不改历史数据或算法                                                                    |
| SC-G07 | 成本观测时间默认UTC截断供datetime-local；P21表单复核人空/切机会草稿/错误权限可见待验                                                                                                                                                                                                                                                      | 测非UTC初始值与新输入，另一名活动复核人、字段隔离和真实鉴权；不以原报价时间测试覆盖成本时间                              |
| SC-G08 | 正式新图、三主题/两密度、全角色、真实后端/生产和用户审核未完成                                                                                                                                                                                                                                                                            | 按P21/P22及PLAN全链交付；本批规格和局部修复不标全页或第二阶段完成                                                        |
