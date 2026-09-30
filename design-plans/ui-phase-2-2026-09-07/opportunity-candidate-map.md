# P15/P18 机会共享入口候选映射

2026-09-07；草稿起点main/181ab16，本批main/a329cfd重新核对并补齐关联合同；产品指纹c4c1cd7f5470ab3896d355c7e16e49f7b5e291e48809e18eeabbf18198766183。12个已读组件、111个当前控件/事件候选一一归属；完整candidateId为apps/web/src/components/文件.vue#尾键。源码行号辅助定位，业务语义以[机会合同](opportunity-contract-review.md)为准。转发事件和提交按钮不重复算业务能力；此表不冻结全站分母，不表示全部已运行。

2026-09-28更新：人工决定原生 dialog 的标题ID从 `opportunity-decision-title` 独立为 `opportunity-decision-dialog-title` 后，其 `dialog-definition` 与 `@cancel` 当前签名分别更新为 `21d6397072095d87.1`、`e6463826c649de97.1`；对应人工决定 close 与容器合同继续保持原归属。

2026-09-30更新：P18 成本复核取消清空原因草稿并返回对应“驳回/通过”触发器焦点；同步更新 RQ 当前候选签名及行位置。当前实现与双端挂载 Vue 回归见 [P18 action review](action-reviews/P18.json)；触发器替换、读屏与真机验证仍开放。

2026-09-28键盘边界更新：三个原生 dialog 增加 `@keydown="containDialogTab"` 后，其当前 `dialog-definition` / `event-binding` 候选分别更新为 ERP `196c12d0f18ac5ee.1` / `56857391914c319d.1`、创建 `304e73ffea549836.1` / `67aec29022637161.1`、决定 `9b17e07a48f24205.1` / `674ff3412f0b8645.1`。它们仍归属既有容器、关闭/键盘边界，不新增业务动作。

| 文件:行                             | 候选尾键           | 语义归属                                                             |
| ----------------------------------- | ------------------ | -------------------------------------------------------------------- |
| AutomaticSelectionReadinessPanel:58 | 0d20f52ad0f021a6.1 | OP-SETUP-NEXT                                                        |
| AutomaticSelectionReadinessPanel:65 | 859c5c25e4210185.1 | OP-SCORE-RULES                                                       |
| AutomaticSelectionReadinessPanel:75 | 1581dd93c745443c.1 | OP-SETUP-DETAILS                                                     |
| AutomaticSelectionReadinessPanel:83 | a21355b49f292586.1 | OP-SETUP-STEP                                                        |
| OpportunityAiPanel:31               | 8ff0dc0eb124658f.1 | OP-AI-QUEUE                                                          |
| OpportunityAiPanel:40               | 3fc618c0a253e761.1 | OP-AI-RETRY                                                          |
| OpportunityAiPanel:86               | 378bcfa62fdb2a15.1 | OP-AI-REVIEW.approved                                                |
| OpportunityAiPanel:89               | ccfc7a9546285067.1 | OP-AI-REVIEW.rejected                                                |
| OpportunityCostReviewQueue:127      | fa1b671cb5e1bc8c.1 | OP-COST-REVIEW-OPEN.rejected                                         |
| OpportunityCostReviewQueue:134      | 224f4955ed7d6f48.1 | OP-COST-REVIEW-OPEN.approved                                         |
| OpportunityCostReviewQueue:110      | 3fe574c620a554f9.1 | OP-COST-REVIEW-SUBMIT                                                |
| OpportunityCostReviewQueue:151      | 66ceb3eced93eb5b.1 | OP-COST-REVIEW-CANCEL                                                |
| OpportunityCostReviewQueue:120      | 8c06fd5c1d000db0.1 | OP-COST-REVIEW-SUBMIT                                                |
| OpportunityDecisionPanel:62         | 97f09d6274473315.1 | OP-DECISION-ANCHOR                                                   |
| OpportunityDecisionPanel:96         | 4c415989b6830734.1 | OP-GATES-DETAILS                                                     |
| OpportunityDecisionPanel:115        | 1755c866489f4c76.1 | OP-DECISION-OPEN.adopt                                               |
| OpportunityDecisionPanel:116        | c5f40664f410ee40.1 | OP-DECISION-OPEN.observe                                             |
| OpportunityDecisionPanel:117        | 6cfe6545a209df42.1 | OP-DECISION-OPEN.reject                                              |
| OpportunityDecisionPanel:125        | e28c61b56c99b993.1 | OP-EARLY-DECISION-DETAILS                                            |
| OpportunityDecisionPanel:127        | 690b264d43e01055.1 | OP-DECISION-OPEN.observe                                             |
| OpportunityDecisionPanel:128        | a2dfed9751073c3d.1 | OP-DECISION-OPEN.reject                                              |
| OpportunityDecisionPanel:140        | 7ee1cf6f73d304fe.1 | OP-BLOCKER-TASK                                                      |
| OpportunityDecisionPanel:144        | 91b42518b9942791.1 | OP-EVIDENCE-TASK                                                     |
| OpportunityDecisionPanel:154        | b016bc2c6e34bc74.1 | OP-BLOCKERS-DETAILS                                                  |
| OpportunityDecisionPanel:171        | ad67a1fb638ba1e7.1 | OP-BLOCKER-TASK                                                      |
| OpportunityDetailInsights:67        | e05349e8d6e988e6.1 | OP-DOWNSTREAM-RETRY                                                  |
| OpportunityDetailInsights:75        | effae781320f38ae.1 | OP-COMPETITOR-DISCOVER                                               |
| OpportunityDetailInsights:83        | 886e2ed7a10d72e3.1 | OP-SUPPLIER-DISCOVER                                                 |
| OpportunityDetailInsights:91        | aa54925800e77301.1 | OP-COMPETITORS-NAV                                                   |
| OpportunityDetailInsights:92        | 146cf1d351c32a6f.1 | OP-SOURCING-NAV                                                      |
| OpportunityDetailInsights:123       | b0a01bc78d278471.1 | OP-SCORE-RULES                                                       |
| OpportunityDetailInsights:124       | 0ea181124012f39d.1 | OP-SCORE-QUEUE                                                       |
| OpportunityDetailInsights:214       | e05349e8d6e988e6.2 | OP-DOWNSTREAM-RETRY                                                  |
| OpportunityDetailInsights:222       | 389b0cedfcdcb05c.1 | OP-COMPETITOR-DISCOVER                                               |
| OpportunityDetailInsights:230       | 98f83f73900ff6d1.1 | OP-COMPETITORS-NAV                                                   |
| OpportunityEvidencePanel:36         | e7987d558e66f413.1 | OP-EVIDENCE-ORIGINAL                                                 |
| OpportunityEvidencePanel:55         | a7e87a4faa602b0d.1 | OP-EVIDENCE-COLLAPSE                                                 |
| OpportunityEvidencePanel:58         | 562017be17eba5c3.1 | OP-EVIDENCE-MORE                                                     |
| OpportunityFeedbackPanel:65         | d2e988e8912be681.1 | OP-FEEDBACK-SUBMIT                                                   |
| OpportunityFeedbackPanel:118        | 78c5b5b15ae0a028.1 | OP-FEEDBACK-SUBMIT                                                   |
| OpportunityFeedbackPanel:140        | 3ecf9559a5eb9abf.1 | OP-FEEDBACK-AUDIT                                                    |
| OpportunityLineagePanel:73          | 5abdd0792f0f00a2.1 | OP-LINEAGE-TECHNICAL                                                 |
| OpportunityLineagePanel:79          | 709fca4084db47ee.1 | OP-LINEAGE-NAV                                                       |
| OpportunityLineagePanel:83          | fa9946cc7d514a7e.1 | OP-LINEAGE-FAILURES                                                  |
| OpportunityListPanel:176            | 1f137eb293b286d0.1 | OP-VIEW：四实例                                                      |
| OpportunityListPanel:187            | ebed9d735d2650ea.1 | OP-FILTER-APPLY                                                      |
| OpportunityListPanel:230            | 3cacb9b51913365b.1 | OP-FILTER-APPLY                                                      |
| OpportunityListPanel:233            | 55d7dcd38e3f0b22.1 | OP-FILTER-RESET                                                      |
| OpportunityListPanel:283            | 2995ff91584f5d46.1 | OP-RECOVER/OP-EMPTY-CREATE/OP-SETUP-NEXT/OP-VIEW/OP-FILTER-RESET转发 |
| OpportunityListPanel:337            | 49aa86998e70364c.1 | OP-BATCH-OPEN.assign                                                 |
| OpportunityListPanel:344            | a1959483e41eb1bf.1 | OP-BATCH-OPEN.review                                                 |
| OpportunityListPanel:351            | b113acbf01a0938d.1 | OP-BATCH-OPEN.archive                                                |
| OpportunityListPanel:300            | bf27afc54dc87ac9.1 | OP-SELECT                                                            |
| OpportunityListPanel:314            | e16bf068f58122c0.1 | OP-DETAIL-NAV                                                        |
| OpportunityListPanel:349            | 30387aeecee66240.1 | OP-PAGE-PREV                                                         |
| OpportunityListPanel:351            | 7090c56fb876cebe.1 | OP-PAGE-NEXT                                                         |
| OpportunityListPanel:392            | 18a777cbd9195919.1 | OP-IMAGE-LOAD-FAILURE                                                |
| OpportunityProfitPanel:54           | 2bab3ff056a52675.1 | OP-COST-RULES                                                        |
| OpportunityProfitPanel:121          | fbf7d2a587c0931b.1 | OP-COST-REVIEW-SUBMIT转发                                            |
| OpportunityProfitPanel:84           | aa3f50e6ccf98cb4.1 | OP-PROFIT-RETRY                                                      |
| OpportunityProfitPanel:159          | 21c282e197f8be16.1 | OP-COST-SUBMIT                                                       |
| OpportunityProfitPanel:223          | 1dfebd67b12367cb.1 | OP-COST-REVIEWER-RETRY                                               |
| OpportunityProfitPanel:233          | d25bbd68583e5a3d.1 | OP-COST-SUBMIT                                                       |
| OpportunityProfitPanel:245          | f8671d189e947071.1 | OP-PROFIT-QUEUE                                                      |
| OpportunityWorkspace:668            | 169dd3f4eac94585.1 | OP-JOURNEY-NAV                                                       |
| OpportunityWorkspace:670            | bbd1b04e367f3e80.1 | OP-TREND-RULES-NAV                                                   |
| OpportunityWorkspace:672            | 98ee78e079ff2f4c.1 | OP-ERP-OPEN                                                          |
| OpportunityWorkspace:679            | d9bac0eae791bdd6.1 | OP-CREATE-OPEN                                                       |
| OpportunityWorkspace:691            | 43e671d75fd48bea.1 | OP-RETURN                                                            |
| OpportunityWorkspace:776            | 5eb2834c0e9007bc.1 | 列表apply/batch/create/setup/page/reset/view/selectedIds转发         |
| OpportunityWorkspace:720            | 7219811dcc02cc91.1 | OP-DETAIL-RETRY                                                      |
| OpportunityWorkspace:739            | e5851472e99b48d6.1 | OP-RUNTIME-DETAILS                                                   |
| OpportunityWorkspace:749            | 6bbaa8f037121cf9.1 | OP-DECISION-OPEN/OP-EVIDENCE-TASK转发                                |
| OpportunityWorkspace:761            | f563427d32a93860.1 | OP-MANUAL-COLLECTION-DETAILS                                         |
| OpportunityWorkspace:764            | 0027d6cd14c50e46.1 | OP-COMPETITOR-DISCOVER                                               |
| OpportunityWorkspace:771            | 927ece864672036d.1 | OP-SUPPLIER-DISCOVER                                                 |
| OpportunityWorkspace:778            | 145043f313e0dfef.1 | OP-SCORE-RULES                                                       |
| OpportunityWorkspace:783            | 8dfb1ee903d0b053.1 | OP-TAB：四主分区                                                     |
| OpportunityWorkspace:793            | badd0afd80b50ce6.1 | OP-MORE-ANALYSIS                                                     |
| OpportunityWorkspace:795            | 1aef42d09991a143.1 | OP-TAB：六辅助分区                                                   |
| OpportunityWorkspace:807            | 65bed8657e147596.1 | 竞品/供应采集、评分、下游重读转发                                    |
| OpportunityWorkspace:827            | 3e5dca6610ac19d8.1 | OP-FEEDBACK-SUBMIT转发                                               |
| OpportunityWorkspace:1081           | 2e0effa3fc3ac854.1 | 成本提交/复核/利润重算/复核人GET重试转发                             |
| OpportunityWorkspace:846            | 76ae53c237c00264.1 | AI排队/重读/复核转发                                                 |
| OpportunityWorkspaceDialogs:90      | 56857391914c319d.1 | OP-ERP-CLOSE：Escape                                                 |
| OpportunityWorkspaceDialogs:147     | 67aec29022637161.1 | OP-CREATE-CLOSE：Escape                                              |
| OpportunityWorkspaceDialogs:210     | 377ceb35fb7127cd.1 | OP-DECISION-CLOSE：Escape                                            |
| OpportunityWorkspaceDialogs:90      | 56857391914c319d.1 | OP-ERP-CLOSE                                                         |
| OpportunityWorkspaceDialogs:147     | 67aec29022637161.1 | OP-CREATE-CLOSE                                                      |
| OpportunityWorkspaceDialogs:210     | 377ceb35fb7127cd.1 | OP-DECISION-CLOSE                                                    |
| OpportunityWorkspace:1019           | c46fc24a5bfcc314.1 | 创建/决定/ERP浏览器/文件导入转发                                     |
| OpportunityWorkspace:899            | 2f4e238755b201b9.1 | OP-BATCH-CANCEL：Escape                                              |
| OpportunityWorkspace:980            | 2f4e238755b201b9.1 | OP-BATCH-CANCEL                                                      |
| OpportunityWorkspace:1023           | 64891e806e385e12.1 | OP-BATCH-CANCEL                                                      |
| OpportunityWorkspace:987            | b4d79d3e558083d3.1 | OP-BATCH-SUBMIT                                                      |
| OpportunityWorkspace:1024           | c70ff783b9d26396.1 | OP-BATCH-SUBMIT                                                      |
| OpportunityWorkspace:987            | b4d79d3e558083d3.1 | OP-BATCH-SUBMIT                                                      |
| OpportunityWorkspace:943            | 1fec9eace35dae6b.1 | OP-AI-REASON-SUBMIT/CANCEL转发                                       |
| OpportunityWorkspaceDialogs:51      | 674fd720e5afc0a1.1 | OP-ERP-BROWSER                                                       |
| OpportunityWorkspaceDialogs:210     | 5f89285e7e07f9b4.1 | OP-DECISION-EXCLUDED：P15不适用                                      |
| OpportunityWorkspaceDialogs:210     | 377ceb35fb7127cd.1 | OP-DECISION-EXCLUDED：P15不适用                                      |
| OpportunityWorkspaceDialogs:57      | 072a94228fa0ed02.1 | OP-ERP-CLOSE                                                         |
| OpportunityWorkspaceDialogs:82      | a8109ecf87f0762f.1 | OP-ERP-FILE                                                          |
| OpportunityWorkspaceDialogs:89      | 598ca963b90371ed.1 | OP-HELPER-DOWNLOAD                                                   |
| OpportunityWorkspaceDialogs:90      | 71b07908a7d1f426.1 | OP-ERP-CLOSE                                                         |
| OpportunityWorkspaceDialogs:93      | 429c64115868d9c6.1 | OP-ERP-BROWSER                                                       |
| OpportunityWorkspaceDialogs:128     | 92c0e7988ecb5b9b.1 | OP-CREATE-SUBMIT                                                     |
| OpportunityWorkspaceDialogs:113     | 93e4be8029abb2a0.1 | OP-CREATE-CLOSE                                                      |
| OpportunityWorkspaceDialogs:129     | 87e5a2bcb170606c.1 | OP-CREATE-CLOSE                                                      |
| OpportunityWorkspaceDialogs:158     | 439b2aeecca24b47.1 | OP-CREATE-SUBMIT                                                     |
| OpportunityWorkspaceDialogs:218     | 9e848d25400514bc.1 | OP-DECISION-SUBMIT                                                   |
| OpportunityWorkspaceDialogs:150     | 5e85f75285d7eb96.1 | OP-DECISION-CLOSE                                                    |
| OpportunityWorkspaceDialogs:164     | d594d7628cde3706.1 | OP-DECISION-CLOSE                                                    |
| OpportunityWorkspaceDialogs:167     | ced3effe8f7058f1.1 | OP-DECISION-SUBMIT                                                   |
| OpportunityWorkspaceDialogs:150     | 2f7a15b104750d49.1 | OP-DETAIL-NAV                                                        |

### P18 当前详情目录与父子事件接线

以下条目核对机会详情分区目录拆分后的实际 Vue 渲染点；桌面和移动按钮由同一 `items` 集驱动并调用 `setTab`，移动 `summary` 只展开分区入口；父子接线、弹窗组合与状态恢复是既有动作关系，不增加写入或权限语义。

| 当前candidateId                                                            |   行 | 类型                  | 既有语义归属                                        |
| -------------------------------------------------------------------------- | ---: | --------------------- | --------------------------------------------------- |
| apps/web/src/components/OpportunityWorkspace.vue#8b803ab2032008cb.1        | 1088 | event-binding         | OP-DETAIL-RETRY；secondary继续既有OP-RETURN行为     |
| apps/web/src/components/OpportunityWorkspace.vue#ca5be0ff28a9202d.1        | 1099 | event-binding         | OP-TAB select事件转发到setTab                       |
| apps/web/src/components/OpportunityWorkspace.vue#0a05ec1cf1820fcb.1        | 1184 | event-binding         | 成本提交/复核/利润重算/复核人GET重试转发            |
| apps/web/src/components/OpportunityWorkspace.vue#613df9c64125db86.1        | 1243 | event-binding         | 创建/决定/ERP浏览器/文件导入转发                    |
| apps/web/src/components/OpportunityWorkspace.vue#3f329a786800deea.1        | 1243 | dialog-component-call | 三类业务弹窗集合调用                                |
| apps/web/src/components/OpportunityDetailNavigation.vue#7d9ee3ad6dce3b52.1 |   27 | control               | OP-TAB：动态分区选择；桌面列表按钮                  |
| apps/web/src/components/OpportunityDetailNavigation.vue#ca5e938b0c51ecf6.1 |   41 | control               | OP-MORE-ANALYSIS；移动分区目录展开，不选中或改写tab |
| apps/web/src/components/OpportunityDetailNavigation.vue#7d9ee3ad6dce3b52.2 |   46 | control               | OP-TAB：动态分区选择；移动列表按钮                  |

## 八个弹窗定义/调用候选

以下混合真实定义、组件调用及原因helper调用，不可按8个独立弹窗计数。四个本地原生dialog展开ERP1、创建1、决策3、批量3；另有共享原因框AI两变体及共享高级筛选，合计11个调用方业务变体。成本复核是内联表单。

| 文件:行                             | 候选尾键           | 定义/调用                   |
| ----------------------------------- | ------------------ | --------------------------- |
| OpportunityListPanel.vue:186        | 3b502c874c5bc655.1 | 共享筛选抽屉                |
| OpportunityWorkspace.vue:1019       | 67266c4b90185a39.1 | 三类业务弹窗集合调用        |
| OpportunityWorkspace.vue:899        | acc11467e72e9b66.1 | 本地批量原生dialog；三变体  |
| OpportunityWorkspace.vue:943        | 38deb219e719849f.1 | 共享原因框组件调用          |
| OpportunityWorkspace.vue:505        | 36cdbd1cb98185c2.1 | AI原因helper调用；通过/驳回 |
| OpportunityWorkspaceDialogs.vue:90  | 196c12d0f18ac5ee.1 | ERP导入原生dialog           |
| OpportunityWorkspaceDialogs.vue:147 | 304e73ffea549836.1 | 机会创建原生dialog          |
| OpportunityWorkspaceDialogs.vue:210 | 5f89285e7e07f9b4.1 | 人工决策原生dialog；三变体  |
| OpportunityWorkspaceDialogs.vue:210 | 377ceb35fb7127cd.1 | 决策dialog字段无效捕获反馈 |
| OpportunityWorkspaceDialogs.vue:218 | 9e848d25400514bc.1 | OP-DECISION-SUBMIT：决定表单提交及必填校验 |
| OpportunityWorkspaceDialogs.vue:218 | 9e848d25400514bc.1 | 决策表单无效事件反馈      |

### P18 AI 原因共享组件源候选

以下绑定本页 AI 通过/驳回两调用实际共用的 `AuditedReasonDialog` 当前组件源位，不将其推定为其他页面的全局交互验收。

| 文件:行                       | 候选尾键           | P18来源语义                    |
| ----------------------------- | ------------------ | ------------------------------ |
| AuditedReasonDialog.vue:74    | 0a9c82c5c5fb1fd7.1 | 共享原因框组件调用             |
| AuditedReasonDialog.vue:74    | 0b86489e495d6b17.1 | 共享原因框组件调用             |
| AuditedReasonDialog.vue:83    | 87015cbdd947096a.1 | 共享原因框组件调用             |
| AuditedReasonDialog.vue:89    | f850a4abcc7ccc3a.1 | 共享原因框组件调用             |
| AuditedReasonDialog.vue:109   | c921f4233ae348c6.1 | 共享原因框组件调用             |
| AuditedReasonDialog.vue:135   | 8724bc1f65aaf63a.1 | 共享原因框组件调用             |
| AuditedReasonDialog.vue:136   | e7e63c4215a43738.1 | 共享原因框组件调用             |
| OpportunityWorkspace.vue:551  | b74012fbdb739187.1 | AI原因helper调用；通过/驳回    |
| OpportunityWorkspace.vue:564  | ca674a075f274bff.1 | AI原因helper调用；通过/驳回    |
| OpportunityWorkspace.vue:1012 | b413cc394b21a4ed.1 | OP-AI-REASON-SUBMIT/CANCEL转发 |
| OpportunityWorkspace.vue:1012 | 3d03bfde11490c97.1 | 共享原因框组件调用             |

## 2026-09-29 P18 子工作面当前候选补齐

按当前 Vue 实际源码补齐此前因组件重组、模板文案和事件形态变化而漏记的候选。重复出现的采集/导航/证据入口仍指向同一语义动作，不额外推断 API、权限或业务能力。当前 source candidate ID 为准，旧行号表仅保留历史定位。此映射不代表相应动作已通过真实后端/RBAC或生产验收。

| 文件:行                                                   | 候选尾键           | 语义归属                                    |
| --------------------------------------------------------- | ------------------ | ------------------------------------------- |
| apps/web/src/components/OpportunityAiPanel.vue:93         | cc97e6c5522bd2f4.1 | OP-AI-SELECT                                |
| apps/web/src/components/OpportunityAiPanel.vue:113        | fb635cc3de2bd568.1 | OP-AI-RETRY                                 |
| apps/web/src/components/OpportunityAiPanel.vue:184        | 3077acae8d0bdc66.1 | OP-AI-REVIEW.approved                       |
| apps/web/src/components/OpportunityAiPanel.vue:192        | e3360973174294b7.1 | OP-AI-REVIEW.rejected                       |
| apps/web/src/components/OpportunityAiPanel.vue:245        | 0b2e20b6822ebc67.1 | OP-AI-PROVENANCE                            |
| apps/web/src/components/OpportunityDetailInsights.vue:75  | 823a2e6e9e462fb3.1 | OP-DOWNSTREAM-RETRY                         |
| apps/web/src/components/OpportunityDetailInsights.vue:89  | 5d78f9c7cf57f959.1 | OP-COMPETITOR-DISCOVER                      |
| apps/web/src/components/OpportunityDetailInsights.vue:100 | c53985022ad43912.1 | OP-COMPETITORS-NAV                          |
| apps/web/src/components/OpportunityDetailInsights.vue:114 | 1ad80d71bafd937b.1 | OP-DOWNSTREAM-RETRY                         |
| apps/web/src/components/OpportunityDetailInsights.vue:133 | 0be29a576704bd69.1 | OP-SUPPLIER-DISCOVER                        |
| apps/web/src/components/OpportunityDetailInsights.vue:146 | c4c3fd475e0d1c74.1 | OP-SOURCING-NAV                             |
| apps/web/src/components/OpportunityDetailInsights.vue:184 | d4469c78907c9fa4.1 | OP-SCORE-RULES                              |
| apps/web/src/components/OpportunityDetailInsights.vue:185 | 9fdf677303995f04.1 | OP-SCORE-QUEUE                              |
| apps/web/src/components/OpportunityDetailInsights.vue:221 | 5342f1a44ac80aa7.1 | OP-INSIGHT-EVIDENCE-NAV                     |
| apps/web/src/components/OpportunityDetailInsights.vue:228 | 98182a987b29c689.1 | OP-MARKET-NAV                               |
| apps/web/src/components/OpportunityDetailInsights.vue:306 | 739121b4ce61f692.1 | OP-INSIGHT-EVIDENCE-NAV                     |
| apps/web/src/components/OpportunityDetailInsights.vue:341 | f633bc087f211562.1 | OP-DOWNSTREAM-RETRY                         |
| apps/web/src/components/OpportunityDetailInsights.vue:397 | fc5eacd76d7e40ea.1 | OP-COMPETITOR-TECHNICAL                     |
| apps/web/src/components/OpportunityDetailInsights.vue:408 | 5d78f9c7cf57f959.2 | OP-COMPETITOR-DISCOVER                      |
| apps/web/src/components/OpportunityDetailInsights.vue:421 | b80c9168117e53bb.1 | OP-COMPETITORS-NAV                          |
| apps/web/src/components/OpportunityDetailInsights.vue:460 | 739121b4ce61f692.2 | OP-INSIGHT-EVIDENCE-NAV                     |
| apps/web/src/components/OpportunityDetailInsights.vue:467 | 15eee7cac0d36322.1 | OP-PROFIT-NAV                               |
| apps/web/src/components/OpportunityFeedbackPanel.vue:114  | 328bc3468a9f0a9c.1 | OP-FEEDBACK-OPEN                            |
| apps/web/src/components/OpportunityFeedbackPanel.vue:117  | dfd58b6726ca69c4.1 | OP-FEEDBACK-CLOSE                           |
| apps/web/src/components/OpportunityFeedbackPanel.vue:125  | 37589cdee716e3d4.1 | OP-FEEDBACK-SUBMIT                          |
| apps/web/src/components/OpportunityFeedbackPanel.vue:242  | 7b1e773c20a35bff.1 | OP-FEEDBACK-RETRY                           |
| apps/web/src/components/OpportunityFeedbackPanel.vue:247  | 4285afbe44e1cffc.1 | OP-FEEDBACK-SUBMIT                          |
| apps/web/src/components/OpportunityFeedbackPanel.vue:292  | 30b9a96f71641024.1 | OP-FEEDBACK-AUDIT                           |
| apps/web/src/components/OpportunityLineagePanel.vue:109   | 51a16cdff8c0fca2.1 | OP-LINEAGE-TECHNICAL                        |
| apps/web/src/components/OpportunityLineagePanel.vue:136   | 77d46341d92ff39a.1 | OP-LINEAGE-NAV                              |
| apps/web/src/components/OpportunityLineagePanel.vue:144   | 59608f8fc36f7c0f.1 | OP-LINEAGE-CORRELATION                      |
| apps/web/src/components/OpportunityWorkspace.vue:1483     | aad81bdc3f7ba55d.1 | 竞品/供应采集、评分、下游重读、页签选择转发 |
| apps/web/src/components/OpportunityWorkspace.vue:1374     | b391bf25870010b2.1 | OP-FEEDBACK-SUBMIT/RETRY转发                |
| apps/web/src/components/OpportunityWorkspace.vue:1405     | 2aa4cc1a9f90b8fd.1 | AI排队/重读/复核转发                        |
| apps/web/src/components/OpportunityWorkspace.vue:1514     | 557b69e18caa81e6.1 | OP-AI-REASON-SUBMIT/CANCEL转发              |
| apps/web/src/components/OpportunityWorkspace.vue:1514     | df416310b2ec158b.1 | 共享原因框组件调用                          |
