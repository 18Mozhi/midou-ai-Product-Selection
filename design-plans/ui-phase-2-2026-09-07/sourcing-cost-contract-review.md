# P21/P22 供应与费用规则合同复核

2026-09-07；从main/3a886d3干净起点开始。本文是源码事实、页面规格和局部隔离Vue回归，不是最终新稿、真实数据库或生产验收。全局生成清单仍绑定060e0b5/caf0574f33b1c91a446e6a7784bc954fc6d926d44ba5b349df538190304eff8d；本批产品修复后旧全局证据不能自动称为当前有效，提交后须按源变化刷新。下表以本批工作树LF源码为准，使用现有scanSource只读复核；不覆写生成物审核状态。

## 1. 入口、事实及版本

route-catalog → NavigationShell → surfaceProps：P21 SourcingWorkspace，P22 CostRuleConsole，均reset_on_scope。P21 API sourcing-routes→sourcing-service→mysql-sourcing-repository；成本子面板与P22走profit-routes→profit-service→mysql-profit-repository。P21浏览需sourcing:read，写入supplier_quote:manage；P22浏览opportunity:read，规则写入opportunity:approve；成本提交/重算cost:confirm。审批需本人真实selection_manager/organization_admin，复核按服务端can_review及指定复核人，不能只凭角色名称推断。

| 源码简称 | 文件（apps/web/src/components/下） | 本批LF SHA256 |
| --- | --- | --- |
| SW | SourcingWorkspace.vue | f74e7d26c2263d7fc0b49382cad49f360144f38fa28bbf6ccd4a59a3b2099d81 |
| SD | SourcingWorkspaceDialogs.vue | e5bebf9ce4d4c9433bbc1c68a21cecc75f39a287c051f2ce7fb3bef25de901d8 |
| SP | SourcingComparisonPanel.vue | 2712a6fd91e13b1a58a1bddfc6147ec8341d031ae59718c03bc4768f1cd73406 |
| SC | SourcingCostConfirmationPanel.vue | bdf6100c15e5387b9a6e331ca5d684a690a3dea1e1eed0cab8d511b22e0920a4 |
| CR | CostRuleConsole.vue | f04ff78111eb34e394be0862c924b41bd3270f9f8cd2a7697895c6f7954bb4ba |
| PP | OpportunityProfitPanel.vue | a9c768a23befdbee24e875572909069ddeac37e2a3c23fefeb2f2cba69d0c47f |
| RQ | OpportunityCostReviewQueue.vue | e53bc46608bac7f91e1d00123eb4bc086688000c03d2c9ad8f932be2dbc87339 |

局部共77个控件/事件候选、7个弹窗定义/调用候选、44处v-model。SP与QualityGateSetupSummary只有呈现/slot，无本地交互候选；共享UiStatePanel和useModalDialog行为按实际调用方检查，不在此重复全站盘点。PP/RQ与P18共享，以下仅记录P21调用合同，不重复加算全站分母。

## 2. 全部控件与事件候选

candidateId完整格式为源码文件路径加`#`及下表后缀；同语义的form提交/按钮/关闭入口分别保留。纯表单提交拦截、事件转发不直接等于独立业务写入。

| 源 | 行 | candidate后缀 | 语义与触发结果 |
| --- | --- | --- | --- |
| SW | 386 | 4c5b0e4130d85030.1 | SC-NAV sourcing |
| SW | 387 | 4862df3dce4b0f1c.1 | SC-NAV cost-rules |
| SW | 401 | 32fc6740cd676281.1 | SC-S-OPEN 管理者创建 |
| SW | 428 | 307f53938ca7e688.1 | SC-STATE 主/次恢复或创建 |
| SW | 437 | 4ded8067979a3682.1 | SC-SEARCH-CLEAR / 空筛选次动作 |
| SW | 449 | 95c07db60d43a586.1 | SC-DETAIL 读对象并同步record |
| SW | 471 | 100e00b6d8cb9e4a.1 | SC-REFRESH 管理者POST当前对象 |
| SW | 474 | dd2297ed2ff6c2a5.1 | SC-NAV cost-rules含from |
| SW | 478 | 0d91434c5f2ca144.1 | SC-DELETE-OPEN 管理者选中目标 |
| SW | 538 | a9d2be84fdbc9665.1 | SC-NAV 受权采集明细 |
| SW | 559 | 46efe1c7f3d39475.1 | SC-ERP 原始ERP新窗口 |
| SW | 576 | 8fb00fc320cdc059.1 | SC-SELECT 勾选与实际最多五项同步 |
| SW | 628 | 792656883236da58.1 | SC-SOURCE 原始商品新窗口 |
| SW | 632 | 1a57994baa2329f6.1 | SC-QUOTE-OPEN 管理者无quote |
| SW | 634 | 6ec48a1f9259ef0d.1 | SC-PURCHASE-OPEN 管理者已有quote |
| SW | 650 | 658745acd55fced2.1 | SC-COMPARE 至少2项且非busy |
| SW | 654 | c63aa5ea813e730c.1 | SD九个事件转发、删除原因更新 |
| SD | 92 | 0a19bece849d5a46.1 | SC-S-CLOSE Escape |
| SD | 101 | d3c4c7748af92501.1 | SC-S-SUBMIT 表单 |
| SD | 104 | e3badf15ec2af147.1 | SC-S-CLOSE X |
| SD | 134 | 62730beed005a395.1 | SC-S-CLOSE 取消 |
| SD | 135 | 7a0fba6035dcdf87.1 | SC-S-SUBMIT 按钮 |
| SD | 139 | 97f60206694e3a7d.1 | SC-QUOTE-CLOSE Escape |
| SD | 148 | eaa2e41b5101f1f5.1 | SC-QUOTE-SUBMIT 表单 |
| SD | 151 | bbe2d6bcbbb332dc.1 | SC-QUOTE-CLOSE X |
| SD | 206 | 830881852f5cf052.1 | SC-QUOTE-CLOSE 取消 |
| SD | 207 | 6d422d5b42df032c.1 | SC-QUOTE-SUBMIT 按钮 |
| SD | 211 | a203a4a623d55db8.1 | SC-PURCHASE-CLOSE Escape |
| SD | 220 | 986c3be67ec5d768.1 | SC-PURCHASE-SUBMIT 表单 |
| SD | 226 | 9ce7604ffb1d3c16.1 | SC-PURCHASE-CLOSE X |
| SD | 266 | 23fa0ead54c8b92d.1 | SC-PURCHASE-CLOSE 取消 |
| SD | 267 | bead229bf1acdb7a.1 | SC-PURCHASE-SUBMIT 按钮 |
| SD | 280 | 18d830ea30c66eed.1 | SC-DELETE-CLOSE Escape |
| SD | 289 | c5ce1f450e932172.1 | SC-DELETE-SUBMIT 表单 |
| SD | 292 | c748a332b4a8b069.1 | SC-DELETE-CLOSE X |
| SD | 311 | 0a71f3799436c08c.1 | SC-DELETE-CLOSE 取消 |
| SD | 312 | 9d23c498e72940a2.1 | SC-DELETE-SUBMIT 按钮 |
| SC | 127 | bb5d5e072948baa9.1 | SC-NAV 机会利润详情 |
| SC | 134 | e31dcd8852e4566d.1 | 成本提交/复核/重算三个事件转发 |
| CR | 523 | ae99ecef74f5d4d3.1 | SC-R-BACK 安全from |
| CR | 524 | 5e3909def7e4baa9.1 | SC-R-CREATE 管理者非ready或active |
| CR | 536 | b2df3db97280e7e2.1 | SC-R-STATE 首条创建/刷新/返回 |
| CR | 563 | ed4cdadd71405209.1 | SC-R-CREATE ready且无active |
| CR | 571 | 6a49826ecb55d1fd.1 | SC-R-BACK 准备度返回 |
| CR | 575 | e4a92ae55317039d.1 | SC-R-SEARCH 表单只阻止提交导航 |
| CR | 587 | 0aca31814d8e2a23.1 | SC-R-RESET 清筛选 |
| CR | 593 | c4344a6ce7acbca8.1 | SC-R-SELECT 本地选择与URL |
| CR | 612 | 83d11b8719b1c99d.1 | SC-R-PAGE-PREV 页码边界 |
| CR | 614 | bd43d7b540116c32.1 | SC-R-PAGE-NEXT 页码边界 |
| CR | 647 | 9e33896b68e8e4fe.1 | SC-R-SOURCE 已保存来源新窗口 |
| CR | 661 | 55f48a15788735d1.1 | SC-R-SUBMIT draft |
| CR | 669 | ea3ec6b286c61f0c.1 | SC-R-APPROVE selection_manager |
| CR | 676 | eac5ef200003454a.1 | SC-R-REJECT selection_manager |
| CR | 684 | 6ac633aba6b533bd.1 | SC-R-APPROVE organization_admin |
| CR | 691 | 5d293fdba6594665.1 | SC-R-REJECT organization_admin |
| CR | 700 | 513ba8c3e39973c0.1 | SC-R-PUBLISH approved |
| CR | 707 | fab085a093adfa3a.1 | SC-R-ROLLBACK active且有有效目标 |
| CR | 731 | 8dec9b05190c02c6.1 | SC-R-CREATE-CLOSE 原生cancel |
| CR | 738 | 1fcf5a2247b2ad3e.1 | SC-R-CREATE-SUBMIT 表单 |
| CR | 744 | 8695390d77702f3f.1 | SC-R-CREATE-CLOSE X |
| CR | 853 | 4fa3694ad39564c9.1 | SC-R-CREATE-CLOSE 取消 |
| CR | 854 | bdb318fcff422d4c.1 | SC-R-CREATE-SUBMIT 按钮 |
| CR | 860 | 24b49021258ec509.1 | SC-R-ACTION-CLOSE 原生cancel |
| CR | 867 | a8b2803881a9f5ba.1 | SC-R-ACTION-SUBMIT 表单 |
| CR | 873 | 9a6cc342b022be3d.1 | SC-R-ACTION-CLOSE X |
| CR | 897 | ca4f082d1ca76f11.1 | SC-R-ACTION-CLOSE 取消 |
| CR | 898 | 1b870bc1240e4ab6.1 | SC-R-ACTION-SUBMIT 按钮 |
| PP | 54 | 2bab3ff056a52675.1 | SC-NAV 管理费用规则 |
| PP | 121 | fbf7d2a587c0931b.1 | SC-COST-REVIEW 转发 |
| PP | 126 | fcdcabfef1ea3474.1 | SC-COST-SUBMIT 表单 |
| PP | 158 | b2258379fb999070.1 | SC-COST-SUBMIT 指定复核人且非busy |
| PP | 159 | aff5d679009764bc.1 | SC-COST-RECALCULATE 排队 |
| RQ | 76 | aa698411d908f10b.1 | SC-COST-REVIEW rejected打开 |
| RQ | 77 | 2ad8a0f45b085121.1 | SC-COST-REVIEW approved打开 |
| RQ | 79 | dcb42c2584efb46b.1 | SC-COST-REVIEW 表单提交 |
| RQ | 85 | 030d4f76526e6970.1 | SC-COST-REVIEW-CANCEL |
| RQ | 86 | 8c06fd5c1d000db0.1 | SC-COST-REVIEW 提交按钮 |

## 3. 弹窗与输入分母

| 源 | 行 | dialog候选后缀 | 变体 |
| --- | --- | --- | --- |
| SW | 654 | fca0d2d5d8880776.1 | 四窗共享调用，不另外计为第五个业务窗 |
| SD | 92 | 73d110263ae493f0.1 | 搜索四类输入，字段标签随类型变 |
| SD | 139 | aa8a9b645036fe7e.1 | 报价证据确认 |
| SD | 211 | f21fd23c2e4b9d60.1 | 采购MOQ/原因 |
| SD | 280 | d0e8a832293a76e5.1 | 记录原因软删 |
| CR | 731 | 0cffdbc28160492d.1 | 新建草稿、人工/自动成本可选字段 |
| CR | 860 | 777ba93e8ff0f331.1 | submit、两角色approve/reject、publish、rollback共七操作变体 |

44处v-model：SW query(423)；SD searchForm.input_type/input_ref(114/123)，quote.specification/moq/lead_time_days/location/confidence_value/stability_status/risk_level/observed_at/evidence_id(160/162/164/166/169/176/183/190/194)，purchaseForm.quantity/reason(250/258)，deleteReasonModel(304)；CR search/statusFilter(577/580)，form.market/platform/version_code/name/effective_from(747/748/752/756/757)，platform_fee/payment_fee/tax/fulfillment/currency/logistics(762/771/780/789/797/805)，automatic_product_family/conversion_rate/conversion_effective_on/conversion_source_url(816/823/832/838)，rollbackTargetId/actionReason(881/890)；PP costForm.platform/input_type/amount_value/currency/source_type/source_ref_id/evidence_id/observed_at/reviewer_id(128/130/138/144/145/146/147/148/150)；RQ review.reason(82)。字段分支不是新增持久化字段；只读文本与progress不算按钮。

SD以watch→nextTick→requestAnimationFrame聚焦首个控件，Escape只在各自div内处理；没有原生modal背景隔离或完整焦点圈/归还。CR复用useModalDialog，native showModal和cancel preventDefault，busy时拒绝关闭；不能据此推断所有复杂变体已通过辅助技术验证。

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

| ID | 证据与边界 | 退出条件 |
| --- | --- | --- |
| SC-G01 | 当前缺失报价预填1/7/80；稳定性选项/API为variable，但SW标签字典为volatile | 核实预填是否符合业务期望；先复现真实variable展示，按确认范围处理，不用历史默认充当证据 |
| SC-G02 | Feature Map称比较历史失败可选降级，SW.load实际同一try且阻断；详情失败可能保留列表对象 | 独立复现历史/详情失败及恢复，明确错误和空态合同，不能将文档当现实现 |
| SC-G03 | SW/SC无写入函数级busy守卫；SD可忙碌关闭；成本GET/写入共享busy | 复现重复提交、关闭重开/切对象和迟到结果，避免旧写入结果覆盖新上下文；不把关窗当撤销服务端任务 |
| SC-G04 | SD四窗无完整焦点圈/归还，错误在父层；CR字段错误缺字段关联；RQ内联表单取消/成功归属未全验 | 四窗和七操作变体逐项键盘、焦点、错误可达、移动键盘及辅助技术验证 |
| SC-G05 | SW/SC/CR无读版本/abort；路由反向同步、KeepAlive、范围和多标签未全验 | 迟到200/404/写入、离开返回、scope切换和history按实际对象归属处理，不用壳层缓存配置代替证据 |
| SC-G06 | 对比历史称“现行报价”但可含旧版本；准备度取首active而非当前市场；refresh/delete/成本成功提示被load清空 | 核对历史版本语义及多市场展示；操作成功/后续读取失败分开反馈，不改历史数据或算法 |
| SC-G07 | 成本观测时间默认UTC截断供datetime-local；P21表单复核人空/切机会草稿/错误权限可见待验 | 测非UTC初始值与新输入，另一名活动复核人、字段隔离和真实鉴权；不以原报价时间测试覆盖成本时间 |
| SC-G08 | 正式新图、三主题/两密度、全角色、真实后端/生产和用户审核未完成 | 按P21/P22及PLAN全链交付；本批规格和局部修复不标全页或第二阶段完成 |
