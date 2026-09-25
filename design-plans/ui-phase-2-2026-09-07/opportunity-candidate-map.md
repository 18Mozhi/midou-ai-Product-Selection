# P15/P18 机会共享入口候选映射

2026-09-07；草稿起点main/181ab16，本批main/a329cfd重新核对并补齐关联合同；产品指纹c4c1cd7f5470ab3896d355c7e16e49f7b5e291e48809e18eeabbf18198766183。12个已读组件、104个控件/事件候选一一归属；完整candidateId为apps/web/src/components/文件.vue#尾键。源码行号辅助定位，业务语义以[机会合同](opportunity-contract-review.md)为准。转发事件和提交按钮不重复算业务能力；此表不冻结全站分母，不表示全部已运行。

| 文件:行 | 候选尾键 | 语义归属 |
| --- | --- | --- |
| AutomaticSelectionReadinessPanel:58 | 0d20f52ad0f021a6.1 | OP-SETUP-NEXT |
| AutomaticSelectionReadinessPanel:65 | 859c5c25e4210185.1 | OP-SCORE-RULES |
| AutomaticSelectionReadinessPanel:75 | 1581dd93c745443c.1 | OP-SETUP-DETAILS |
| AutomaticSelectionReadinessPanel:83 | a21355b49f292586.1 | OP-SETUP-STEP |
| OpportunityAiPanel:31 | 8ff0dc0eb124658f.1 | OP-AI-QUEUE |
| OpportunityAiPanel:40 | 3fc618c0a253e761.1 | OP-AI-RETRY |
| OpportunityAiPanel:86 | 378bcfa62fdb2a15.1 | OP-AI-REVIEW.approved |
| OpportunityAiPanel:89 | ccfc7a9546285067.1 | OP-AI-REVIEW.rejected |
| OpportunityCostReviewQueue:76 | aa698411d908f10b.1 | OP-COST-REVIEW-OPEN.rejected |
| OpportunityCostReviewQueue:77 | 2ad8a0f45b085121.1 | OP-COST-REVIEW-OPEN.approved |
| OpportunityCostReviewQueue:79 | dcb42c2584efb46b.1 | OP-COST-REVIEW-SUBMIT |
| OpportunityCostReviewQueue:85 | 030d4f76526e6970.1 | OP-COST-REVIEW-CANCEL |
| OpportunityCostReviewQueue:86 | 8c06fd5c1d000db0.1 | OP-COST-REVIEW-SUBMIT |
| OpportunityDecisionPanel:62 | 97f09d6274473315.1 | OP-DECISION-ANCHOR |
| OpportunityDecisionPanel:96 | 4c415989b6830734.1 | OP-GATES-DETAILS |
| OpportunityDecisionPanel:115 | 1755c866489f4c76.1 | OP-DECISION-OPEN.adopt |
| OpportunityDecisionPanel:116 | c5f40664f410ee40.1 | OP-DECISION-OPEN.observe |
| OpportunityDecisionPanel:117 | 6cfe6545a209df42.1 | OP-DECISION-OPEN.reject |
| OpportunityDecisionPanel:125 | e28c61b56c99b993.1 | OP-EARLY-DECISION-DETAILS |
| OpportunityDecisionPanel:127 | 690b264d43e01055.1 | OP-DECISION-OPEN.observe |
| OpportunityDecisionPanel:128 | a2dfed9751073c3d.1 | OP-DECISION-OPEN.reject |
| OpportunityDecisionPanel:140 | 7ee1cf6f73d304fe.1 | OP-BLOCKER-TASK |
| OpportunityDecisionPanel:144 | 91b42518b9942791.1 | OP-EVIDENCE-TASK |
| OpportunityDecisionPanel:154 | b016bc2c6e34bc74.1 | OP-BLOCKERS-DETAILS |
| OpportunityDecisionPanel:171 | ad67a1fb638ba1e7.1 | OP-BLOCKER-TASK |
| OpportunityDetailInsights:67 | e05349e8d6e988e6.1 | OP-DOWNSTREAM-RETRY |
| OpportunityDetailInsights:75 | effae781320f38ae.1 | OP-COMPETITOR-DISCOVER |
| OpportunityDetailInsights:83 | 886e2ed7a10d72e3.1 | OP-SUPPLIER-DISCOVER |
| OpportunityDetailInsights:91 | aa54925800e77301.1 | OP-COMPETITORS-NAV |
| OpportunityDetailInsights:92 | 146cf1d351c32a6f.1 | OP-SOURCING-NAV |
| OpportunityDetailInsights:123 | b0a01bc78d278471.1 | OP-SCORE-RULES |
| OpportunityDetailInsights:124 | 0ea181124012f39d.1 | OP-SCORE-QUEUE |
| OpportunityDetailInsights:214 | e05349e8d6e988e6.2 | OP-DOWNSTREAM-RETRY |
| OpportunityDetailInsights:222 | 389b0cedfcdcb05c.1 | OP-COMPETITOR-DISCOVER |
| OpportunityDetailInsights:230 | 98f83f73900ff6d1.1 | OP-COMPETITORS-NAV |
| OpportunityEvidencePanel:36 | e7987d558e66f413.1 | OP-EVIDENCE-ORIGINAL |
| OpportunityEvidencePanel:55 | a7e87a4faa602b0d.1 | OP-EVIDENCE-COLLAPSE |
| OpportunityEvidencePanel:58 | 562017be17eba5c3.1 | OP-EVIDENCE-MORE |
| OpportunityFeedbackPanel:65 | d2e988e8912be681.1 | OP-FEEDBACK-SUBMIT |
| OpportunityFeedbackPanel:118 | 78c5b5b15ae0a028.1 | OP-FEEDBACK-SUBMIT |
| OpportunityFeedbackPanel:140 | 3ecf9559a5eb9abf.1 | OP-FEEDBACK-AUDIT |
| OpportunityLineagePanel:73 | 5abdd0792f0f00a2.1 | OP-LINEAGE-TECHNICAL |
| OpportunityLineagePanel:79 | 709fca4084db47ee.1 | OP-LINEAGE-NAV |
| OpportunityLineagePanel:83 | fa9946cc7d514a7e.1 | OP-LINEAGE-FAILURES |
| OpportunityListPanel:176 | 1f137eb293b286d0.1 | OP-VIEW：四实例 |
| OpportunityListPanel:187 | ebed9d735d2650ea.1 | OP-FILTER-APPLY |
| OpportunityListPanel:230 | 3cacb9b51913365b.1 | OP-FILTER-APPLY |
| OpportunityListPanel:233 | 55d7dcd38e3f0b22.1 | OP-FILTER-RESET |
| OpportunityListPanel:244 | 35fbcba5eab1163b.1 | OP-RECOVER/OP-EMPTY-CREATE/OP-SETUP-NEXT/OP-VIEW/OP-FILTER-RESET转发 |
| OpportunityListPanel:289 | e4d77eb7a4a580f1.1 | OP-BATCH-OPEN.assign |
| OpportunityListPanel:290 | 08f90a95059f6dac.1 | OP-BATCH-OPEN.review |
| OpportunityListPanel:291 | 120a674bf7e0ed5a.1 | OP-BATCH-OPEN.archive |
| OpportunityListPanel:300 | bf27afc54dc87ac9.1 | OP-SELECT |
| OpportunityListPanel:314 | e16bf068f58122c0.1 | OP-DETAIL-NAV |
| OpportunityListPanel:349 | 30387aeecee66240.1 | OP-PAGE-PREV |
| OpportunityListPanel:351 | 7090c56fb876cebe.1 | OP-PAGE-NEXT |
| OpportunityProfitPanel:54 | 2bab3ff056a52675.1 | OP-COST-RULES |
| OpportunityProfitPanel:121 | fbf7d2a587c0931b.1 | OP-COST-REVIEW-SUBMIT转发 |
| OpportunityProfitPanel:126 | fcdcabfef1ea3474.1 | OP-COST-SUBMIT |
| OpportunityProfitPanel:158 | b2258379fb999070.1 | OP-COST-SUBMIT |
| OpportunityProfitPanel:159 | aff5d679009764bc.1 | OP-PROFIT-QUEUE |
| OpportunityWorkspace:668| 169dd3f4eac94585.1 | OP-JOURNEY-NAV |
| OpportunityWorkspace:670| bbd1b04e367f3e80.1 | OP-TREND-RULES-NAV |
| OpportunityWorkspace:672| 98ee78e079ff2f4c.1 | OP-ERP-OPEN |
| OpportunityWorkspace:679| d9bac0eae791bdd6.1 | OP-CREATE-OPEN |
| OpportunityWorkspace:691| 43e671d75fd48bea.1 | OP-RETURN |
| OpportunityWorkspace:697| 0951033614435a4e.1 | 列表apply/batch/create/setup/page/reset/view/selectedIds转发 |
| OpportunityWorkspace:720| 7219811dcc02cc91.1 | OP-DETAIL-RETRY |
| OpportunityWorkspace:739| e5851472e99b48d6.1 | OP-RUNTIME-DETAILS |
| OpportunityWorkspace:749| 6bbaa8f037121cf9.1 | OP-DECISION-OPEN/OP-EVIDENCE-TASK转发 |
| OpportunityWorkspace:761| f563427d32a93860.1 | OP-MANUAL-COLLECTION-DETAILS |
| OpportunityWorkspace:764| 0027d6cd14c50e46.1 | OP-COMPETITOR-DISCOVER |
| OpportunityWorkspace:771| 927ece864672036d.1 | OP-SUPPLIER-DISCOVER |
| OpportunityWorkspace:778| 145043f313e0dfef.1 | OP-SCORE-RULES |
| OpportunityWorkspace:783| 8dfb1ee903d0b053.1 | OP-TAB：四主分区 |
| OpportunityWorkspace:793| badd0afd80b50ce6.1 | OP-MORE-ANALYSIS |
| OpportunityWorkspace:795| 1aef42d09991a143.1 | OP-TAB：六辅助分区 |
| OpportunityWorkspace:807| 65bed8657e147596.1 | 竞品/供应采集、评分、下游重读转发 |
| OpportunityWorkspace:827| 3e5dca6610ac19d8.1 | OP-FEEDBACK-SUBMIT转发 |
| OpportunityWorkspace:835| a91f12f030c2fe66.1 | 成本提交/复核/利润重算转发 |
| OpportunityWorkspace:846| 76ae53c237c00264.1 | AI排队/重读/复核转发 |
| OpportunityWorkspace:883| ebc2bd495e3582f5.1 | 创建/决定/ERP浏览器/文件导入转发 |
| OpportunityWorkspace:899| 2f4e238755b201b9.1 | OP-BATCH-CANCEL：Escape |
| OpportunityWorkspace:906| 44686188d9948fca.1 | OP-BATCH-SUBMIT |
| OpportunityWorkspace:938| 64891e806e385e12.1 | OP-BATCH-CANCEL |
| OpportunityWorkspace:939| c70ff783b9d26396.1 | OP-BATCH-SUBMIT |
| OpportunityWorkspace:943| 1fec9eace35dae6b.1 | OP-AI-REASON-SUBMIT/CANCEL转发 |
| OpportunityWorkspaceDialogs:44 | f9352d9bba967662.1 | OP-ERP-CLOSE：Escape |
| OpportunityWorkspaceDialogs:51 | 674fd720e5afc0a1.1 | OP-ERP-BROWSER |
| OpportunityWorkspaceDialogs:57 | 072a94228fa0ed02.1 | OP-ERP-CLOSE |
| OpportunityWorkspaceDialogs:82 | a8109ecf87f0762f.1 | OP-ERP-FILE |
| OpportunityWorkspaceDialogs:89 | 598ca963b90371ed.1 | OP-HELPER-DOWNLOAD |
| OpportunityWorkspaceDialogs:90 | 71b07908a7d1f426.1 | OP-ERP-CLOSE |
| OpportunityWorkspaceDialogs:93 | 429c64115868d9c6.1 | OP-ERP-BROWSER |
| OpportunityWorkspaceDialogs:100 | 364dc8e63849b27f.1 | OP-CREATE-CLOSE：Escape |
| OpportunityWorkspaceDialogs:107 | 781b6e8e908ba7ac.1 | OP-CREATE-SUBMIT |
| OpportunityWorkspaceDialogs:113 | 93e4be8029abb2a0.1 | OP-CREATE-CLOSE |
| OpportunityWorkspaceDialogs:129 | 87e5a2bcb170606c.1 | OP-CREATE-CLOSE |
| OpportunityWorkspaceDialogs:130 | ff7a5f3105576981.1 | OP-CREATE-SUBMIT |
| OpportunityWorkspaceDialogs:137 | f3f35ebc7969e030.1 | OP-DECISION-CLOSE：Escape |
| OpportunityWorkspaceDialogs:144 | 10c891f118c2001b.1 | OP-DECISION-SUBMIT |
| OpportunityWorkspaceDialogs:150 | 5e85f75285d7eb96.1 | OP-DECISION-CLOSE |
| OpportunityWorkspaceDialogs:164 | d594d7628cde3706.1 | OP-DECISION-CLOSE |
| OpportunityWorkspaceDialogs:167 | ced3effe8f7058f1.1 | OP-DECISION-SUBMIT |

## 八个弹窗定义/调用候选

以下混合真实定义、组件调用及原因helper调用，不可按8个独立弹窗计数。四个本地原生dialog展开ERP1、创建1、决策3、批量3；另有共享原因框AI两变体及共享高级筛选，合计11个调用方业务变体。成本复核是内联表单。

| 文件:行 | 候选尾键 | 定义/调用 |
| --- | --- | --- |
| OpportunityListPanel.vue:186 | 3b502c874c5bc655.1 | 共享筛选抽屉 |
| OpportunityWorkspace.vue:883| 4f1225f6705d3e1d.1 | 三类业务弹窗集合调用 |
| OpportunityWorkspace.vue:899| acc11467e72e9b66.1 | 本地批量原生dialog；三变体 |
| OpportunityWorkspace.vue:943| 38deb219e719849f.1 | 共享原因框组件调用 |
| OpportunityWorkspace.vue:505| 36cdbd1cb98185c2.1 | AI原因helper调用；通过/驳回 |
| OpportunityWorkspaceDialogs.vue:44 | 1ed288cd855ce1c0.1 | ERP导入原生dialog |
| OpportunityWorkspaceDialogs.vue:100 | ac06eb6f17f7829e.1 | 机会创建原生dialog |
| OpportunityWorkspaceDialogs.vue:137 | 8b4dc3f5856d3c5a.1 | 人工决策原生dialog；三变体 |
