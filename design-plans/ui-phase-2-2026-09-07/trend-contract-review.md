# P14 趋势页动作、弹窗与验收合同

2026-09-08 C提案：[TREND-C-r1](design/trend-direction-c/README.md)146图：68场景双端+10长弹窗下部。助手直接执行现有applyFilters/syncFromRoute和markIrrelevant确认全部状态回active与失败关窗清原因；本稿对应保护未修改真实Vue。TrendRuleDialog.submit/TrendChangeQueue.submitProposal请求与真实validateMonitoringRuleInput重复词400从源码导出；已启用规则无next_collection_at的新稿显示尚未设置，不用旧模板已暂停标签覆盖状态。所有交互只隔离模拟，不注销UI2-TR08–12及真实治理/生产待办。

2026-09-07；N01源码复核；main/bc4ca78。本文件不更改全站生成物和分母。产品指纹c4c1cd7f5470ab3896d355c7e16e49f7b5e291e48809e18eeabbf18198766183。候选来源actions/dialogs.json，源码为唯一语义依据；测试均为真实Vue加隔离响应，不代表生产、DB、审计事务、真实RBAC或用户设计通过。

## 1. 源码与真实边界

按Feature Map趋势域追踪：TrendDashboard → TrendFilterPanel/TrendDetailPanel/TrendEvidenceTimeline/TrendRuleDialog/TrendChangeQueue；shared MonitoringReadinessStrip只展示事实；ResponsiveFilterDrawer负责筛选层；UiStatePanel负责状态文字。服务链trend-routes → TrendService → MysqlTrendRepository；异常走data-quality-routes及createFromTrendEvidence，刷新走provider-source-routes.refreshScope。

- 普通读取trend:read；趋势写入trend:manage，同源Origin、Idempotency-Key，会话解析组织/工作区。立即刷新来源明确允许trend:read，body的organization_id/workspace_id必须匹配会话，不能按按钮字面猜权限。
- 列表page_size=20，服务端分页后本地sortedTopics排序；sort未进入列表请求，不承诺跨页全局排名。复制window.location.href不创建数据库视图。查看规则结果仅取include_keywords[0]作为q，不按精确规则ID筛选。
- 转机会URL为/opportunities?source_topic_id=...&name=...&market=...&category=...，是预填导航，不是POST，也不是/opportunities/start。
- 规则API允许周期15–10080分钟、来源门槛1–10；当前表单只提供15/30/60/180/360/720/1440及1/2/3。只记录事实，不擅自扩展选项或推荐规则。关键词客户端按英文/中文逗号及换行切分、trim/去空，服务端进一步NFKC/小写/空白归一、限20个和每个100字、拒绝重复。通知固定in_app。
- 合并候选只来自当前列表页、同市场/语言、active且非选中主题。提交只提议，确认才执行。服务端版本锁、同范围验证、原主题至少保留一条信号、提议人与决定人不同（含驳回），不能在夹具中证明这些事务完成。

## 2. 拆分前六个本地组件60个候选的历史映射

此表是拆分前候选快照，不作为现行组件来源的完整证明。键为candidateId中#后的稳定尾键，完整键由文件路径加#恢复。W=TrendDashboard、F=TrendFilterPanel、D=TrendDetailPanel、E=TrendEvidenceTimeline、R=TrendRuleDialog、G=TrendChangeQueue，均位于apps/web/src/components。表单submit和提交按钮映射同语义动作，不重复计数；转发组件记录全部事件集合。2026-10-01当前子组件候选见文末。

| 文件:行 | 候选尾键           | 语义ID/入口                                              |
| ------- | ------------------ | -------------------------------------------------------- |
| W:610   | e8d58f837015480a.1 | TR-RULE-OPEN：顶部首条/新增入口                          |
| W:618   | 5abb2c07be024e83.1 | TR-REFRESH-SOURCES                                       |
| W:621   | 2bfafa5dccf5b5ae.1 | TR-TAB-RULES：顶部入口                                   |
| W:624   | c0646bdf3263a017.1 | TR-TAB-TOPICS                                            |
| W:626   | aef07f12388401cc.1 | TR-TAB-RULES：导航入口                                   |
| W:628   | 83125cc8b9f30181.1 | TR-TAB-GOVERNANCE                                        |
| W:640   | 377da84835906aec.1 | TR-FILTER-APPLY/CLEAR/COPY/EDIT/SORT转发                 |
| W:650   | 5646a97e7f9d7b17.1 | TR-RECOVER：empty清除，否则load；隐藏未接线通用次操作   |
| W:666   | 28d08ea282407ca1.1 | TR-TOPIC-SELECT：每个主题实例                            |
| W:692   | a9dcb53568c4deee.1 | TR-PAGE-PREV                                             |
| W:694   | ec3e2e186729ef5d.1 | TR-PAGE-NEXT                                             |
| W:699   | de1bcb04278ad1bc.1 | TR-BACK/FOLLOW/RULE-OPEN/RELEVANCE-OPEN/ANOMALY-OPEN转发 |
| W:735   | a8eb23a11ff39fa0.1 | TR-HELP：原生details展开 [历史身份，仅追溯] |
| W:760   | 5b07ed8ea36a238e.1 | TR-RULE-OPEN：规则标题入口 [历史身份，仅追溯] |
| W:762   | 0d9565586dbfab9d.1 | TR-RELOAD：规则状态恢复；隐藏未接线通用次操作 [历史身份，仅追溯] |
| W:773   | 095a96a218ee248e.1 | TR-RULE-OPEN：规则空态入口 [历史身份，仅追溯] |
| W:821   | 5731738b8db06002.1 | TR-RULE-STATUS：暂停/启用 [历史身份，仅追溯] |
| W:824   | 273b9f9c2069857f.1 | TR-RULE-RESULTS：首关键词筛选 [历史身份，仅追溯] |
| W:726   | 05ccd6821ef51315.1 | TR-PROPOSE/TR-DECIDE转发                                 |
| W:735   | 1c84e99801374a43.1 | TR-D-RULE-CALLER：open/busy/close/submit转发             |
| W:735   | e2a4499152c0f457.1 | TR-D-RULE-COMPONENT：受控规则组件调用                    |
| W:849   | c6ce42d1e09856fa.1 | TR-ANOMALY-SUBMIT表单 [历史身份，仅追溯] |
| W:855   | b5cb028d61878491.1 | TR-ANOMALY-CLOSE：叉号 [历史身份，仅追溯] |
| W:883   | 79e6f49e70b53776.1 | TR-ANOMALY-CLOSE：取消 [历史身份，仅追溯] |
| W:842   | 70140152f0bfc00c.1 | TR-D-ANOMALY 原生模态定义 [历史身份，仅追溯] |
| W:842   | cdba5de18bdf9c12.1 | TR-D-ANOMALY-KEYBOARD：cancel与Tab处理 [历史身份，仅追溯] |
| W:885   | 3ca40e4dc9ea598c.1 | TR-ANOMALY-SUBMIT按钮 [历史身份，仅追溯] |
| W:900   | 60103acec5bdf33b.1 | TR-RELEVANCE-SUBMIT表单 [历史身份，仅追溯] |
| W:908   | 74456cadd4fd8246.1 | TR-RELEVANCE-CLOSE：叉号 [历史身份，仅追溯] |
| W:930   | 90cb939f09706fb5.1 | TR-RELEVANCE-CLOSE：取消 [历史身份，仅追溯] |
| W:932   | 288abda590fb34b7.1 | TR-RELEVANCE-SUBMIT按钮 [历史身份，仅追溯] |
| F:22    | 5dfd077f141d48f4.1 | TR-FILTER-APPLY表单                                      |
| F:24    | be2b881b65e1cc00.1 | TR-FILTER-EDIT.market                                    |
| F:29    | 49faf4c9e9529254.1 | TR-FILTER-EDIT.category                                  |
| F:35    | d6fc8f0fd1a6197f.1 | TR-FILTER-EDIT.status                                    |
| F:42    | 0fb74fcff8527527.1 | TR-FILTER-EDIT.q                                         |
| F:48    | 65cf69becacd32e0.1 | TR-FILTER-SORT                                           |
| F:57    | 3cacb9b51913365b.1 | TR-FILTER-APPLY按钮                                      |
| F:58    | 45fe0a56771e7ccc.1 | TR-FILTER-CLEAR                                          |
| F:59    | 1ad5cc0a1ffb53d8.1 | TR-FILTER-COPY                                           |
| D:35    | e7201768235a6ce7.1 | TR-BACK：只切移动焦点                                    |
| D:51    | 2e0bfe1a9646767e.1 | TR-FOLLOW：关注/取消                                     |
| D:53    | 658c4019fe00727f.1 | TR-RULE-OPEN：详情入口                                   |
| D:60    | 983f4f1540678cfc.1 | TR-OPPORTUNITY-NAV                                       |
| D:61    | 0c3b34e3fa894dd6.1 | TR-RELEVANCE-OPEN.irrelevant                             |
| D:68    | 8449f6b045562349.1 | TR-RELEVANCE-OPEN.active                                 |
| D:104   | ebdc4bab362bae22.1 | TR-ANOMALY-OPEN转发                                      |
| E:60    | dab48a89a829b124.1 | TR-EVIDENCE-ORIGINAL：新窗口noopener/noreferrer          |
| E:61    | 436d7eb2bb10817d.1 | TR-ANOMALY-OPEN：busy/已有工单禁用                       |
| E:88    | 1c008f867673db60.1 | TR-HISTORY-TECHNICAL：原生details                        |
| R:75    | b2c35007732f84af.1 | TR-RULE-SUBMIT表单                                       |
| R:81    | 3886e9e1d2205bab.1 | TR-RULE-CLOSE：叉号                                      |
| R:119    | 1c6857e568a31cf2.1 | TR-RULE-CLOSE：取消                                      |
| W:735   | 1c84e99801374a43.1 | TR-D-RULE-CALLER：open/busy/close/submit转发             |
| W:735   | e2a4499152c0f457.1 | TR-D-RULE-COMPONENT：受控规则组件调用                    |
| R:68    | f6c3de30580fd217.1 | TR-D-RULE 原生模态定义                                   |
| R:68    | 8cead402b77314e2.1 | TR-D-RULE-KEYBOARD：cancel与Tab处理                      |
| R:120    | d47ebd79f8eb69dd.1 | TR-RULE-SUBMIT按钮                                       |
| G:102   | bcbaae66b685ebbe.1 | TR-PROPOSE表单                                           |
| G:107   | f8b877ec4618bce3.1 | TR-PROPOSAL-MODE.merge                                   |
| G:110   | c375aa8bfaab646c.1 | TR-PROPOSAL-MODE.split                                   |
| G:137   | 6af3244e4e31bef4.1 | TR-PROPOSE按钮                                           |
| G:170   | dea3207939a5a086.1 | TR-DECISION-OPEN.reject                                  |
| G:171   | 3b88c0e433b7a2c1.1 | TR-DECISION-OPEN.confirm                                 |
| G:173   | 00ba2050cb620a7e.1 | TR-DECIDE表单                                            |
| G:188   | b722bb8cd6a19824.1 | TR-DECISION-CANCEL                                       |
| G:189   | 4bd2e2d1bd990e41.1 | TR-DECIDE按钮                                            |

18个v-model源码位置未被上述候选完整表达，另外登记：W的anomalySeverity/anomalyReason/relevanceReason；R的name/include_keywords/negative_keywords/market/language/category/collection_interval_minutes/recommendation_min_source_count；G的sourceIds/signalIds/newTitle/newCategory/reason/decision.reason；E的timelineSource。复选项按实际数据展开，不能将动态行数写死。F的五输入已在候选表内；E来源筛选本地改变图表，切主题重置，不发API。

## 3. 弹窗候选、字段和生命周期

| 定义/调用候选                                                              | 业务变体                       | 字段与行为                                                                                                                                                                                                    |
| -------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W:735 #1c84e99801374a43.1 / apps/web/src/components/TrendDashboard.vue#e2a4499152c0f457.1 → R:68 #f6c3de30580fd217.1 | TR-D-RULE | 一个受控调用/一个原生dialog定义，不算两个弹窗；八输入，名称/包含词/市场/语言required；创建成功关闭并load后跳rules；失败保留；取消后重开仍默认US/en-US/60/1 |
| W:842 #70140152f0bfc00c.1                                                  | TR-D-ANOMALY                   | 原生dialog；warning/critical、原因2–500；提交severity/reason，证据/来源身份由URL和服务端关联；失败保留；created=false显示已有工单，当前实例按钮禁用 [历史身份，仅追溯] |
| W:842 #cdba5de18bdf9c12.1 / R:68 #8cead402b77314e2.1                       | TR-D-MODAL-KEYBOARD            | 规则/异常均由useModalDialog打开原生模态，首字段autofocus，正反Tab边界循环；Escape仅非busy关闭；取消/Escape归还触发焦点。异常写入成功后原触发项替换，焦点转到当前视图导航 [历史身份，仅追溯] |
| W:891 #029d267ba5289a36.1                                                  | TR-D-IRRELEVANT / TR-D-RESTORE | 同定义两变体；原生模态；原因2–500；status/reason.trim/expected_version；失败保留弹窗与原因，成功才关闭清空；busy期间叉号/取消/提交/Escape禁用；原因初始获焦、正反向Tab首尾循环，Escape/取消后焦点归还打开按钮 [历史身份，仅追溯] |
| W:891 #ec9cecafc655a0ec.1                                                  | TR-D-RELEVANCE-CANCEL          | 原生`cancel`转handleRelevanceCancel；仅非busy允许Escape关闭，busy保持；映射到TR-RELEVANCE-CLOSE [历史身份，仅追溯] |
| F:21 #574e84bbfac61d8b.1                                                   | TR-D-FILTER（共享）            | P14桌面保持group、手机760px及以下role=dialog；本地Vue桌面/390px E2E核验5字段、关闭初焦点、Tab首尾、Escape/取消归还焦点、submit.capture关闭。该共享实现其他调用方仍需独立验收                                  |

三个本地原生dialog定义、四业务变体加一个共享筛选实例。合并/拆分以及确认/驳回是四种内联表单态，不新建dialogId。相关性、规则及异常弹窗均复用useModalDialog；桌面/390px E2E验证初始焦点、正反向Tab循环、非busy Escape及焦点归还。异常工单成功后原触发项变化，焦点转至当前视图导航。P14共享筛选抽屉的五字段、桌面分组、手机初焦点/边界、Escape/取消返焦及提交关闭已有实际Vue桌面/390px测试，其他共享调用方仍须单独核验。外层全局message不是弹窗内字段错误；不自动登记无障碍整体通过。

## 4. 请求与结果合同

以下路径均相对/api/v1；写入均由api-client生成关联标识和独立幂等键，不自行拼接Cookie或权限。GET有有限安全重试，写入不自动重放。

| 动作                | method/path及准确输入                                                                                                                      | 成功/失败原页行为                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| TR-FOLLOW           | PUT或DELETE /trends/:id/follow；无body                                                                                                     | 使用请求发起主题的返回followed同步该主题详情/列表，不能按回执到达时的selected对象回写；失败保持         |
| TR-RELEVANCE-SUBMIT | POST /trends/:id/relevance；status、reason、expected_version                                                                               | 成功load；当前失败也关窗清空，保留待修                                                                  |
| TR-ANOMALY-SUBMIT   | POST /trends/:topic/evidence/:evidence/quality-issues；severity、reason                                                                    | 201 created=true新工单或200 created=false复用；成功记qualityIssueIds，失败保留输入                      |
| TR-RULE-SUBMIT      | POST /trends/monitoring-rules；八表单字段转数组/null/number，加notification_channel=in_app                                                 | 成功关窗重读转rules；失败留窗；不预填选中主题到规则                                                     |
| TR-RULE-STATUS      | PATCH /trends/monitoring-rules/:id；status、expected_version、collection_interval_minutes、recommendation_min_source_count                 | Object.assign返回规则，后续用新version；当前按钮无busy禁用，需要竞态回归                                |
| TR-PROPOSE          | POST /trends/change-requests；operation、target_topic_id、source_topic_ids、signal_ids、new_title、new_category、expected_versions、reason | merge的signal_ids=[]且新标题/分类null；split的source_topic_ids=[]且显式选证据；成功重读队列，不执行治理 |
| TR-DECIDE           | POST /trends/change-requests/:id/decisions；decision=confirm/reject、reason、expected_version                                              | 成功重读，失败保留内联表单；同人决定由真实后端拒绝                                                      |
| TR-REFRESH-SOURCES  | POST /provider-sources/refresh；organization_id、workspace_id                                                                              | 显示source_count已启动，不表示采集完成；无自动load/轮询新主题                                           |

## 5. 验收卡及明确缺项

新增tests/e2e/ui-phase2-trend-contracts.spec.ts；TR07按confirm/reject展开两例，其余各一例，共8例。结果见PROGRESS，不把表内设计步骤自动记通过。

| caseId   | 验证步骤与断言                                                                                                                    | 层级/边界                                                                                               |
| -------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| UI2-TR01 | 关注→取消，断言PUT/DELETE、无body、独立幂等键及返回followed驱动文字                                                               | 隔离Vue，不证明DB审计                                                                                   |
| UI2-TR02 | 标记取消零写入；标记/恢复分别提交trim原因及当前version，成功重读使用新version                                                     | 隔离Vue；焦点/失败丢草稿仍待修                                                                          |
| UI2-TR03 | 异常失败保留severity/原因，显式重试返回已有工单，验证准确证据URL/body及禁用                                                       | 隔离Vue，不证明服务端去重事务                                                                           |
| UI2-TR04 | 规则取消重开默认值；必填/准确关键词拆分、null分类、数字周期和门槛、固定站内渠道                                                   | 隔离Vue，不证明采集调度                                                                                 |
| UI2-TR05 | 暂停/启用保留周期和门槛，第二次PATCH采用返回version                                                                               | 隔离Vue；快速重复点击未通过                                                                             |
| UI2-TR06 | 拆分选一条实际证据，提交准确IDs/新标题/空分类/null及目标版本，仅进入队列                                                          | 隔离Vue，不证明实际信号移动                                                                             |
| UI2-TR07 | 确认/驳回先取消零写入，再提交对应reason/expected_version，成功状态由重读返回                                                      | 两例隔离Vue；第二管理员和权限拒绝需真实后端                                                             |
| UI2-TR08 | 全部状态URL往返/清除、41条隔离总数下首中末页边界、本页排序作用域与Clipboard拒绝回退；移动筛选五字段、首尾焦点、Escape/提交返焦 | 以上P14子项由实际Vue隔离桌面/390px E2E覆盖；真实API结果、完整共享调用方与生产验收仍待                        |
| UI2-TR09 | 三个本地弹窗初焦点/循环/归还；字段错误关联与弹窗内播报；相关性失败保留；提交关闭/重开/重复点击                                    | 三个弹窗焦点生命周期及异常成功返焦已由桌面/390px实际Vue E2E覆盖；字段错误播报、重复点击和真实服务仍待验 |
| UI2-TR10 | 切主题/筛选/路由/组织后的迟到成功或失败不得覆盖当前范围；治理load失败和规则旧列表不可冒充成功。关注操作切换主题时回执仍归发起主题 | 关注切主题及筛选列表迟到成功/失败由实际Vue隔离桌面/390px E2E覆盖；父级 reset_on_scope 与组织/工作区缓存键已从源码确认。主题详情、治理/规则迟到读取、完整组织工作区E2E和真实写入归属仍待 |
| UI2-TR11 | 真实后端版本冲突、Origin、幂等、同范围、本人提议拒绝、拆分留一信号、异常工单复用；刷新来源read权限及范围错配                      | 待真实隔离服务；不在生产制造外部采集或客户数据                                                          |
| UI2-TR12 | 新布局桌面/移动、三主题两密度、长内容和缩放、全按钮六态及全部变体图，与获审方案逐项对照                                           | C方向已按用户全局授权自动同意；当前Vue实现与各场景/状态图逐项对照仍未完成                              |

其他源码差异：默认status=active仍计入activeFilterCount；缺status不能表达“全部状态”。帮助文字把置信度说成已按数量/新鲜度计算，真实合同仍insufficient_data。治理expected_versions遍历sourceIds，即使切split可能带上此前merge选择的额外版本；服务端只提取所需ID，最终UI应明确状态切换与草稿规则。UiStatePanel次动作没有父监听，expired主动作只load不登录；避免展示无作用的恢复入口。qualityIssueIds只在内存，下次加载不能据此断言服务端没有工单。上述均未因8例合同测试而结案。

## 5. 2026-10-01 当前子组件源码映射

以下候选按实际 SFC 模板与父子事件逐项刷新。既有语义和请求/权限合同不变；拆分前 W 源码身份保留在上述历史表中。候选记录不替代交互审核或生产验收。

| 当前文件:行 | 候选尾键 | 类型/既有语义 |
| --- | --- | --- |
| apps/web/src/components/TrendMetricExplainer.vue:3 | a8eb23a11ff39fa0.1 | TR-HELP：指标说明原生 details |
| apps/web/src/components/TrendRuleList.vue:40 | 3b02a6e70df9b044.1 | TR-RULE-OPEN：规则列表创建入口 |
| apps/web/src/components/TrendRuleList.vue:42 | 1cbaf0990db5c0c8.1 | TR-RELOAD：UiStatePanel 主动作向父级转发 |
| apps/web/src/components/TrendRuleList.vue:53 | c1a0eb5af0495f85.1 | TR-RULE-OPEN：规则空状态创建入口 |
| apps/web/src/components/TrendRuleList.vue:99 | 4a2c7ae1a4a9a7f7.1 | TR-RULE-STATUS：暂停/启用既有规则 |
| apps/web/src/components/TrendRuleList.vue:102 | e5d44b4c01598fac.1 | TR-RULE-RESULTS：查看当前规则结果 |
| apps/web/src/components/TrendEvidenceDialogs.vue:53 | 70140152f0bfc00c.1 | TR-D-ANOMALY：数据质量原生 dialog 定义 |
| apps/web/src/components/TrendEvidenceDialogs.vue:53 | cdba5de18bdf9c12.1 | TR-D-ANOMALY：cancel/Tab 事件接线 |
| apps/web/src/components/TrendEvidenceDialogs.vue:60 | ad9b133941c9fae2.1 | TR-ANOMALY-SUBMIT：表单事件向父级转发 |
| apps/web/src/components/TrendEvidenceDialogs.vue:66 | b5cb028d61878491.1 | TR-ANOMALY-CLOSE：关闭图标 |
| apps/web/src/components/TrendEvidenceDialogs.vue:94 | 79e6f49e70b53776.1 | TR-ANOMALY-CLOSE：取消 |
| apps/web/src/components/TrendEvidenceDialogs.vue:95 | 3ca40e4dc9ea598c.1 | TR-ANOMALY-SUBMIT：提交按钮 |
| apps/web/src/components/TrendEvidenceDialogs.vue:101 | ca1fd5fbbfd39737.1 | TR-D-IRRELEVANT / TR-D-RESTORE：相关性治理原生 dialog 定义 |
| apps/web/src/components/TrendEvidenceDialogs.vue:101 | b4ec9dff70849aea.1 | TR-D-RELEVANCE-CANCEL：Escape/Tab 事件接线 |
| apps/web/src/components/TrendEvidenceDialogs.vue:110 | c5ff238da62218c9.1 | TR-RELEVANCE-SUBMIT：表单事件向父级转发 |
| apps/web/src/components/TrendEvidenceDialogs.vue:118 | 74456cadd4fd8246.1 | TR-RELEVANCE-CLOSE：关闭图标 |
| apps/web/src/components/TrendEvidenceDialogs.vue:140 | 90cb939f09706fb5.1 | TR-RELEVANCE-CLOSE：取消 |
| apps/web/src/components/TrendEvidenceDialogs.vue:141 | 288abda590fb34b7.1 | TR-RELEVANCE-SUBMIT：确认按钮 |
| apps/web/src/components/TrendDashboard.vue:715 | 910372297876da13.1 | TrendRuleList 父级事件绑定 |
| apps/web/src/components/TrendDashboard.vue:741 | 7bfcec2e14d1875c.1 | TrendEvidenceDialogs 父级事件与 v-model 接线 |
| apps/web/src/components/TrendDashboard.vue:741 | b1b89245fcf60bc9.1 | TrendEvidenceDialogs 组件调用 |
