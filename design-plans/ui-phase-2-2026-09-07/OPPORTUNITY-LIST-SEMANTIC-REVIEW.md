# P15 选品机会：逐项审核与实施边界

基线 `55453ceb`。C方向已选，具体页面稿待审；本轮核对入口、字段、弹窗与既有图，不修改生产，不追加重复图片。

## 看图与审核顺序

[126张图及交互稿](design/opportunity-direction-c/README.md) · [桌面跨页选择](design/opportunity-direction-c/1440-cross-page.png) · [手机列表](design/opportunity-direction-c/390-all.png) · [手机指派失败](design/opportunity-direction-c/390-assign-failed.png) / [下部操作区](design/opportunity-direction-c/390-assign-failed-lower.png) · [完整逐项JSON](action-reviews/P15.json)

按四队列 → 七筛选 → 配置检查 → 行与分页 → 选择范围 → 三批量 → 手工添加 → ERP审核。126图是60场景双端120主图加6长弹窗下部，不是126业务动作。本轮目检桌面跨页和手机指派失败下部两张；没有重采图或宣称全图已目检。

## 实际范围

/opportunities没有opportunityId，父装配OpportunityWorkspace → OpportunityListPanel/AutomaticSelectionReadinessPanel，以及OpportunityWorkspaceDialogs。四文件共67源位置、35组：27页面动作、6转发/定义、2排除；50位置与P18共源，全局只新增17唯一源位置。20模型绑定包含父转发与详情排除，不是20独立用户字段。

读取需opportunity:read，写入口需opportunity:decide，真实服务权限仍须另验。路由reset_on_scope存在；不能凭局部无组织watcher断言父级没有范围隔离。P18十分区/决策/AI及共用弹窗中的hasDetail分支明确排除，只指正常列表入口；缓存与跨路由残留继续验。

## 每个动作的合同与看图位置

同一form submit和提交按钮合并语义，但各源码入口在JSON逐项保留。下表只列代表图，全部变体/异常图见图册与JSON；代表图不抵扣按钮六态。

| 动作 | 条件 | 当前行为 | 代表图 |
| --- | --- | --- | --- |
| `OP-JOURNEY-NAV` 创建选品入口 | 无opportunityId且canDecide，四视图均可见 | RouterLink /opportunities/start；只是P16导航，不执行手工create | [recommended](design/opportunity-direction-c/1440-recommended.png) / [手机](design/opportunity-direction-c/390-recommended.png) |
| `OP-TREND-RULES-NAV` 管理选品规则 | 列表且canDecide | RouterLink /trends?section=rules，非本页建规则或触发采集 | [recommended](design/opportunity-direction-c/1440-recommended.png) / [手机](design/opportunity-direction-c/390-recommended.png) |
| `OP-ERP-OPEN` 打开ERP导入 | 列表all且canDecide；无busy禁用 | showErpImport=true；不清limit，默认200 | [all](design/opportunity-direction-c/1440-all.png) / [手机](design/opportunity-direction-c/390-all.png) |
| `OP-CREATE-OPEN` 打开手工添加 | 可见入口列表all且canDecide；挂载create=1或source_topic_id也可打开 | showCreate=true；父form取消保留；挂载预填name/market/category/source_topic_id，后续query不重新执行预填 | [all](design/opportunity-direction-c/1440-all.png) / [手机](design/opportunity-direction-c/390-all.png) |
| `OP-VIEW` 切换四队列 | 四实例；相同view早退；切换不以busy禁用 | setSelectionView清selectedIds，保留其他query，清scope/page；离开all清decision_status，默认recommended省略view | [recommended](design/opportunity-direction-c/1440-recommended.png) / [手机](design/opportunity-direction-c/390-recommended.png) |
| `OP-FILTER-APPLY` 应用七字段筛选 | form提交；七字段非空才入query，不受busy统一锁定 | applyListFilters重建query，保留非默认view，清page和其他query；相同fullPath直接load；保留selectedIds | [filter-open](design/opportunity-direction-c/1440-filter-open.png) / [手机](design/opportunity-direction-c/390-filter-open.png) |
| `OP-FILTER-RESET` 重置筛选 | type=button，四视图可用 | 七字段置空，query仅非默认view；同URL直接load；selectedIds不清 | [filtered](design/opportunity-direction-c/1440-filtered.png) / [手机](design/opportunity-direction-c/390-filtered.png) |
| `OP-RECOVER` 状态面板主次行动 | state!=ready；loading共享面板不显示操作；主次由kind/标签控制 | primary:empty非all去nextSetupPath，empty all可写打开创建，否则apply；secondary:empty有草稿筛选reset，无筛选all则apply、非all去all，其余reset | [empty-filtered](design/opportunity-direction-c/1440-empty-filtered.png) / [手机](design/opportunity-direction-c/390-empty-filtered.png) |
| `OP-SELECT` 逐行选择 | ready all且canDecide；没有全选按钮 | 按selectedIds是否含id切换新数组，非读取event.checked；只内存，翻页/筛选保留，切view清空 | [all](design/opportunity-direction-c/1440-all.png) / [手机](design/opportunity-direction-c/390-all.png) |
| `OP-DETAIL-NAV` 查看机会详情 | 每个可读行；按钮文案依view变化 | /opportunities/{item.id}?from=route.fullPath；即使文案审阅并采纳也不直接POST | [recommended](design/opportunity-direction-c/1440-recommended.png) / [手机](design/opportunity-direction-c/390-recommended.png) |
| `OP-PAGE-PREV` 上一页 | ready列表；page<=1禁用 | goListPage检查1..pageCount；保留query，第一页省略page；不清selectedIds | [all](design/opportunity-direction-c/1440-all.png) / [手机](design/opportunity-direction-c/390-all.png) |
| `OP-PAGE-NEXT` 下一页 | ready列表；page>=pageCount禁用 | goListPage边界检查并保留query；page_size20，total来自API，不是当前行数 | [all](design/opportunity-direction-c/1440-all.png) / [手机](design/opportunity-direction-c/390-all.png) |
| `OP-SETUP-NEXT` 配置下一步 | 仅recommended/rule_candidates显示面板；available且!allReady且nextStep | 第一项!ready的step.route；是配置缺项，不是单机会质量门 | [recommended](design/opportunity-direction-c/1440-recommended.png) / [手机](design/opportunity-direction-c/390-recommended.png) |
| `OP-SCORE-RULES` 配置未知时查看规则 | 配置available=false | RouterLink /opportunities/scoring-rules，不写规则或重算评分 | [setup-unknown](design/opportunity-direction-c/1440-setup-unknown.png) / [手机](design/opportunity-direction-c/390-setup-unknown.png) |
| `OP-SETUP-DETAILS` 展开配置检查 | available时原生details | 只展开readiness.steps，不触发新GET或modal | [recommended](design/opportunity-direction-c/1440-recommended.png) / [手机](design/opportunity-direction-c/390-recommended.png) |
| `OP-SETUP-STEP` 逐项配置链接 | available展开且当前step !ready | RouterLink step.route，已ready项无该链接 | [setup-open](design/opportunity-direction-c/1440-setup-open.png) / [手机](design/opportunity-direction-c/390-setup-open.png) |
| `OP-BATCH-OPEN.assign` 打开批量指派 | ready all且canDecide且selectedIds.length>0，按钮没有busy锁 | openBatch('assign')清reason/assignee并showBatch=true | [assign-open](design/opportunity-direction-c/1440-assign-open.png) / [手机](design/opportunity-direction-c/390-assign-open.png) |
| `OP-BATCH-OPEN.review` 打开批量复核 | ready all且canDecide且selectedIds.length>0，按钮没有busy锁 | openBatch('review')清reason/assignee并showBatch=true | [review-open](design/opportunity-direction-c/1440-review-open.png) / [手机](design/opportunity-direction-c/390-review-open.png) |
| `OP-BATCH-OPEN.archive` 打开批量归档 | ready all且canDecide且selectedIds.length>0，按钮没有busy锁 | openBatch('archive')清reason/assignee并showBatch=true | [archive-open](design/opportunity-direction-c/1440-archive-open.png) / [手机](design/opportunity-direction-c/390-archive-open.png) |
| `OP-BATCH-CANCEL` 关闭批量弹窗 | canDecide原生dialog；取消/Escape无busy阻止 | handleBatchCancel→showBatch=false；取消按钮同样关闭，不清选择，不撤销write | [assign-open](design/opportunity-direction-c/1440-assign-open.png) / [手机](design/opportunity-direction-c/390-assign-open.png) |
| `OP-BATCH-SUBMIT` 提交当前有效批量范围 | JS当前items交集非空且trim原因非空；assign HTMLrequired负责人；按钮busy禁用但handler无busy早退 | POST /opportunities/batch，一次构建action/items{id,expected_version}/trim reason/assignee_id(assign为ID否则null)；成功关窗清选择load并显示affected_count | [assign-edited](design/opportunity-direction-c/1440-assign-edited.png) / [手机](design/opportunity-direction-c/390-assign-edited.png) |
| `OP-ERP-CLOSE` 关闭ERP导入 | 标题关闭/取消/Escape均未busy禁用 | erpImportOpen=false，limit仍保留；不终止120秒bridge监听或已发POST | [erp-open](design/opportunity-direction-c/1440-erp-open.png) / [手机](design/opportunity-direction-c/390-erp-open.png) |
| `OP-ERP-BROWSER` 从浏览器读取ERP并导入 | 数量native required1–500；提交按钮busy禁用；函数无busy早退 | browserBridge('erp.products.read',{limit:Number(erpImportLimit)})，同window/type/requestId匹配，120000ms超时；再POST /imports/erp-products items/source_url/captured_at/可选total；成功关窗load及返回计数 | [erp-edited](design/opportunity-direction-c/1440-erp-edited.png) / [手机](design/opportunity-direction-c/390-erp-edited.png) |
| `OP-ERP-FILE` 选择JSON立即导入 | accept JSON文件；有首个file即执行；不依赖form数量required或浏览器读取按钮 | 解析数组或parsed.list，persistErpProducts；固定source_url=https://medou.medouai.com/#/ProductList及当前ISO，不带total；无file返回 | [erp-open](design/opportunity-direction-c/1440-erp-open.png) / [手机](design/opportunity-direction-c/390-erp-open.png) |
| `OP-HELPER-DOWNLOAD` 下载浏览器助手 | ERP窗中的独立a；不是submit | href /browser-helper/scoutops-browser-helper.zip，无target或download属性 | [erp-open](design/opportunity-direction-c/1440-erp-open.png) / [手机](design/opportunity-direction-c/390-erp-open.png) |
| `OP-CREATE-CLOSE` 关闭手工添加 | 关闭/取消/Escape无busy禁用 | createOpen=false，父form不清；取消不发POST但不取消已经发送的请求 | [create-open](design/opportunity-direction-c/1440-create-open.png) / [手机](design/opportunity-direction-c/390-create-open.png) |
| `OP-CREATE-SUBMIT` 保存手工候选 | native name/market required，按钮busy禁用；函数无busy/capability早退 | POST /opportunities {name,market,category:空转null,source_topic_id:空转null}；201成功close并push返回id详情；不清form，失败保留 | [create-open](design/opportunity-direction-c/1440-create-open.png) / [手机](design/opportunity-direction-c/390-create-open.png) |

## 六业务弹窗与输入

| 消费者 | 字段与真实边界 | 审核入口 |
| --- | --- | --- |
| 共享筛选 | market≤40、decision_status仅all显示、coverage_status、blocking_reason、lifecycle_status、owner_id、q≤200；草稿非URL | [桌面](design/opportunity-direction-c/1440-filter-edited.png) / [手机下部](design/opportunity-direction-c/390-filter-edited-lower.png) |
| 手工添加 | name required≤200、market required≤40默认US、category≤80、source_topic_id≤36；取消保留，成功到返回ID详情 | [桌面](design/opportunity-direction-c/1440-create-edited.png) / [手机](design/opportunity-direction-c/390-create-edited.png) |
| ERP | limit number required1–500默认200；文件change立即导入，不等待form提交；关闭不取消bridge/POST | [桌面](design/opportunity-direction-c/1440-erp-open.png) / [手机](design/opportunity-direction-c/390-erp-open.png) |
| 批量指派 | 原因required≤1000且trim非空，负责人required真实成员ID | [桌面](design/opportunity-direction-c/1440-assign-edited.png) / [手机](design/opportunity-direction-c/390-assign-edited.png) |
| 批量复核 | 原因同上，assignee_id=null；进入validating并安排人工复核，不改采纳结论 | [桌面](design/opportunity-direction-c/1440-review-edited.png) / [手机](design/opportunity-direction-c/390-review-edited.png) |
| 批量归档 | 原因同上，assignee_id=null；归档非删除，可按lifecycle_status查到 | [桌面](design/opportunity-direction-c/1440-archive-edited.png) / [手机](design/opportunity-direction-c/390-archive-edited.png) |

扫描得17结构容器/35消费者场景关联，包含P18排除、form、aside与集合调用，不是17或35业务弹窗。原共享筛选桌面内联、760px及以下overlay；C稿桌面也按需modal是待审布局变化。useModalDialog负责show/close/Escape/焦点归还，没有请求取消或busy守卫；原生模态能力不能替代每个消费者的失败/忙碌/重开验证。

## 必须区分的事实与提案

1. 批量范围：真实confirmBatch只提交当前items与selectedIds交集。永久助手本轮再验记忆2项、提交1项；C稿明确本页可执行及未包含数。未新增跨页写入规则，Vue未修。
2. 迟到批量成功：本轮惰性VM直接执行源码，review请求发往A后关闭弹窗，重开archive并选B。旧成功仍将showBatch设false并清B选择；新B原因草稿保留。最初body仍为A/review/原原因，区别于P13逐项循环等待后改body的问题。应冻结本次操作身份并核对结果归属，但这是实施待验项，不是已完成产品保护。
3. 隐藏筛选：实际syncListRoute接受view=recommended与decision_status=rejected，虽然字段只在all显示，load仍发送所有非空filters。切view会清该字段不等于深链已清。需在不改变筛选业务规则前提下明确呈现与迁移处理。
4. 状态恢复：非all空态primary去配置，all空态可写才打开手工；空态secondary按草稿条件清除或去all。异常primary沿共享文案但实际apply，secondary显示返回机会列表但实际reset；不能宣称重新登录/返回工作台已正确接线。
5. 配置/列表：五步配置检查不是单个机会五质量门；配置任一依赖失败是未知，成员API失败是名单不可用，不能都解释成零数据。特定amazon phone_case成本条件不泛化为所有类目。null分数是未知，不填0；真实列表缺少图片error handler。
6. ERP/手工：文件选择立即写入与浏览器bridge两链分开；browser保留total，file使用固定来源URL/当前ISO且不带total。未知write异常文案未写入任何状态不证明没有事务；关闭、超时或丢响应不能当取消。P16创建选品只是第三条导航流程，禁止合并成手工POST。

## 已验证、未验证与下一步

本轮buildOpportunityDesignData重新执行四view事实、手工四字段、三批量body、URL四类变更、ERP文件及范围缺口。额外直接提取confirmBatch/openBatch/syncListRoute作延迟Promise与隐藏筛选隔离验证，零HTTP、SQL、浏览器或文件写入。源hash、候选精确合同别名、每个forward事件/handler/目标、20模型/17结构/35场景关联最小检查通过。

27页面动作×6=162代表视觉槽仍未逐selector映射；三主题/两密度、全部动态行/按钮/输入/状态、真实Vue/权限/事务/ERP/缓存生命周期与具体批准尚未完成。图稿的有效范围、就地错误、忙碌保护和焦点设计未迁入Vue。完整全站目标仍在进行；下一P16/P17源语义和既有缺口，按获审具体页再实现，不重复要求用户选择C。

无产品API/OpenAPI、后端/Worker/Python、数据库/迁移、权限、依赖、env/配置、宝塔发布变更；无需配置或重启。没有创建临时文件或进程。最终工具验证与提交证据记录于[PROGRESS](PROGRESS.md)，源码合同仍以[原机会合同](opportunity-contract-review.md)为准。
