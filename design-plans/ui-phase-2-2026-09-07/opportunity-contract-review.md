# P15/P18 机会列表与详情 · 源码合同复核

2026-09-08 P15图稿接续：[OPPORTUNITY-C-r1](design/opportunity-direction-c/README.md)126图待审；本批不覆盖P18。永久助手实际执行confirmBatch复现selectedIds两项、当前items一项时body只含一项，OP06进入“已隔离复现、未修Vue/未真实验收”；提案分别展示有效范围和本页外选择。原activeFilterCount使用可变草稿、列表图片无error handler亦保留待修边界。创建/三批量/URL/ERP文件输入及rowFacts已与源执行结果核对，不等于后端事务/权限/ERP服务通过。

日期：2026-09-07；N02；复核起点main/a329cfd。产品源码指纹仍为c4c1cd7f5470ab3896d355c7e16e49f7b5e291e48809e18eeabbf18198766183，inventory --check通过。既有候选草稿经当前源码/清单核对后纳入本批，不改生成清单或全站通过计数。

此文是后续重设计的真实合同，不是最终视觉稿或全量运行验收。两页分别见[列表规格](page-specs/P15.md)、[详情规格](page-specs/P18.md)；[104项候选逐行表](opportunity-candidate-map.md)保留所有候选尾键和位置。12个组件中的事件转发、表单submit与按钮可归并为一个动作，但每个实际入口仍需审图；8个弹窗定义/调用候选不等于8个独立业务弹窗。

## 1. 真实装配与数据边界

route-catalog/App → OpportunityWorkspace（无opportunityId为P15，有ID为P18）→ List/Decision/Insights/Profit/CostReview/AI/Evidence/Feedback/Lineage/Dialogs；AutomaticSelectionReadinessPanel在列表共享配置检查中使用。OpportunityMobileShell不属于这12个组件的映射范围，不把文件名相似自动当作调用证据。全局壳层、ResponsiveFilterDrawer、UiStatePanel、AuditedReasonDialog及helper需要按调用方另行复核，不能由本地104项宣称全站完整。

所有以下API前缀为`/api/v1`，经现有api-client发送；会话决定组织/工作区。机会读取需opportunity:read；创建、批量、决定、补数任务、经营复盘和AI写入需opportunity:decide。成本写入及复核需cost:confirm；竞品采集需competitor:manage；供应采集需supplier_quote:manage。后端写入校验Origin、幂等键和当前权限，不能用前端隐藏代替。源文件：apps/api/src/opportunity-routes.ts、opportunity-service.ts、mysql-opportunity-repository.ts，以及profit、scoring、ai-analysis、erp-product-import、competitor、sourcing各域真实路由/服务。

| 读取 | 当前调用及结果 | 失败边界 |
| --- | --- | --- |
| 列表 | GET /opportunities，page/page_size=20/selection_view加七个非空筛选；data数组+meta.total | 全局loading/ready/empty/expired/forbidden/blocked/error；失败不是零机会 |
| 成员 | 列表后GET /opportunities/member-options，即使只读也读取 | API错误保留机会，选项清空并显示批量指派不可用；不代表真的没有成员 |
| 配置就绪 | GET /opportunity-score-rules、/cost-rules、/competitor-monitor-rules | allSettled投影五步；依赖失败available=false，不伪装五步为0个配置，也不证明单个商品质量门已通过 |
| 详情/利润 | GET /opportunities/:id，随后GET /opportunities/:id/profit-analysis | 两者都是主加载必需项；利润失败当前会阻断整个详情，不应误写成独立降级已完成 |
| 成本复核人 | cost:confirm时GET /cost-input-reviewers | 失败回退空选项，当前缺独立错误/重试；OP09待验 |
| AI | GET /opportunities/:id/ai-analyses | 独立loading/ready/error；失败与尚无分析有不同文案，可重试 |
| 下游 | 按读/管理能力GET /competitors及/sourcing/searches，再在浏览器按opportunity_id或input_type/input_ref过滤返回数组 | 独立loading/ready/error；当前计数只来自返回数组，不能另称全库精确总量；任一已请求依赖失败使本区error |

## 2. 所有本地语义动作归属

下表中的OP语义键与候选映射对应；“展示/跳转”不带新增持久化。复合行覆盖同组所有变体，但不能用一个变体测试替代其他变体。

| 语义键 / 动作 | 可见或前置条件 | 当前handler、请求和结果 |
| --- | --- | --- |
| OP-VIEW / OP-FILTER-APPLY / OP-FILTER-RESET / OP-PAGE-PREV / OP-PAGE-NEXT | 列表四视图；页边界禁用前后页 | setSelectionView/applyListFilters/resetListFilters/goListPage，更新URL并重读，不新建视图对象 |
| OP-SELECT / OP-DETAIL-NAV | all且canDecide显示逐行勾选；所有列表行可进详情 | 选中ID仅内存；RouterLink携带from=route.fullPath |
| OP-JOURNEY-NAV / OP-TREND-RULES-NAV | 列表canDecide | 到/opportunities/start（P16）或/trends?section=rules（P14）；不直接创建机会 |
| OP-SETUP-NEXT / OP-SETUP-STEP / OP-SETUP-DETAILS / OP-SCORE-RULES | 配置检查适用于recommended/rule_candidates；详情也有评分规则入口 | 跳第一未完成步骤或各step.route；详情展开只读；评分页P17是配置动作，不是本页评分排队 |
| OP-RECOVER / OP-EMPTY-CREATE | 取决于状态、视图、canDecide及已有筛选 | all空且可写可手工创建；非all空去配置或全部；有条件可重置；错误主行动重读。共享状态组件的每个事件需单独核对，详情只有primary监听 |
| OP-CREATE-OPEN / CLOSE / SUBMIT | 手工入口在all且canDecide；初次挂载create=1或source_topic_id可预填打开 | create→POST /opportunities `{name,market,category:空转null,source_topic_id:空转null}`；201后关闭并导航返回id的详情；失败保留，取消不写，父表单未重置 |
| OP-ERP-OPEN / CLOSE / BROWSER / FILE / OP-HELPER-DOWNLOAD | all且canDecide | 打开导入；browserBridge请求erp.products.read(limit)；或选JSON即persistErpProducts；POST /imports/erp-products；下载既有助手zip是独立链接 |
| OP-BATCH-OPEN.assign/review/archive / CANCEL / SUBMIT | all且canDecide且有selectedIds；指派还需负责人 | openBatch重置原因/负责人；confirmBatch取当前items中的选中项，POST /opportunities/batch `{action,items:[{id,expected_version}],reason:trim,assignee_id:指派ID或null}`；成功清选择、关闭、重读及affected_count提示 |
| OP-RETURN / OP-RUNTIME-DETAILS | 详情 | 返回from经safeOpportunityReturnPath检查的本地路径，否则/opportunities；运行信息折叠只展示版本/时间 |
| OP-TAB / OP-MORE-ANALYSIS | 详情十分区 | 四主tab overview/evidence/profit/risk；更多六项market/competition/ai/lineage/feedback/decisions；setTab用router.replace，overview省略tab参数 |
| OP-GATES-DETAILS / OP-EARLY-DECISION-DETAILS / OP-BLOCKERS-DETAILS / OP-DECISION-ANCHOR | 质量门、阻断事实及redecision_ready | 展开或页内定位，不写入。anchor目标仅在可写且canAdopt时存在，其他状态需检查OP09 |
| OP-DECISION-OPEN.adopt/observe/reject / CLOSE / SUBMIT | canDecide；采纳只在selection_stage=recommended且all_passed时出现；其他候选观察/驳回在提前处理内 | startDecision清原因；decide→POST /opportunities/:id/decisions `{action,reason:原输入,expected_version:detail.version}`；服务端trim/校验原因，成功关闭并重读；不修改原始评分/证据 |
| OP-BLOCKER-TASK / OP-EVIDENCE-TASK | 当前阻断有task_id则查看；无任务且canDecide可建 | 已有任务链接/tasks?task=id；新建POST /opportunities/:id/evidence-completion-tasks `{expected_version}`，201新建或200复用；重读后到/tasks/:task_id?from=当前完整URL |
| OP-MANUAL-COLLECTION-DETAILS / OP-COMPETITOR-DISCOVER / OP-SUPPLIER-DISCOVER | 当前非recommended可展开手工工具；概览也有能力限定入口 | 竞品POST /opportunities/:id/competitor-discovery `{}`；供应POST /sourcing/searches `{input_type:'opportunity',input_ref:id}`；显示返回task_id，不冒充已采集完成 |
| OP-DOWNSTREAM-RETRY / OP-COMPETITORS-NAV / OP-SOURCING-NAV | 下游失败可重读；按读/管理能力展示链接 | loadDownstream；导航/competitors或/sourcing，当前不带本机会筛选参数 |
| OP-SCORE-QUEUE | canDecide且非busy | POST /opportunities/:id/score-runs `{expected_version}`；重读并提示排队，需后续刷新读取实际结果 |
| OP-COST-RULES / OP-COST-SUBMIT / OP-PROFIT-QUEUE | 费用规则链接；cost:confirm可填成本/重算 | POST /opportunities/:id/cost-inputs，见字段表；提交只是双人复核申请。利润POST /opportunities/:id/profit-runs `{platform,expected_version}`；不保证立即生成可靠利润 |
| OP-COST-REVIEW-OPEN.approved/rejected / CANCEL / SUBMIT | 条目item.can_review决定是否出现；提交要求trim原因≥2且非busy | 内联表单；POST /opportunities/:id/cost-input-reviews/:reviewId/actions `{decision,reason,expected_version:条目version}`；成功load，批准才可能生效并触发计算，驳回保留原输入 |
| OP-AI-QUEUE / RETRY / REVIEW.approved/rejected / REASON-SUBMIT/CANCEL | 生成/复核canDecide；待复核result可审；重读不需写权限 | 生成POST /opportunities/:id/ai-analyses `{expected_version}`，load后切ai；复核先共享原因框，POST /ai-analyses/:resultId/reviews `{outcome,notes}`，成功load并切ai |
| OP-EVIDENCE-ORIGINAL / MORE / COLLAPSE | 有证据则原文，超过20条可渐进展开 | API原顺序slice；每次+20，收起20；id或证据引用变化重置。外链target=_blank、noopener noreferrer；不新建后台分页 |
| OP-FEEDBACK-SUBMIT / AUDIT | canDecide可见表单；事实/校准只读 | POST /opportunities/:id/operating-feedback，见字段表；只更新detail.operating_feedback、清source_ref/notes，不自动更新规则或决定；审计details只展开 |
| OP-LINEAGE-TECHNICAL / NAV / FAILURES | 实际血缘节点/失败码 | 展开真实ID/请求/trace或RouterLink node.route；缺节点不补造 |

## 3. 输入与11个业务弹窗变体

12组件共41个v-model源码位置：List7、Profit9、Feedback11、CostReview1、Workspace7、Dialogs6。Workspace的5个是向弹窗转发model，因此不能宣称41个独立用户字段。原生勾选、文件输入、动态tab/菜单另由动作映射覆盖。

| 表单/变体 | 字段、当前校验及状态 |
| --- | --- |
| D-OP-FILTER（共享抽屉1） | q≤200、market≤40、decision_status（仅all可见）、coverage_status、blocking_reason、lifecycle_status、owner_id共7项；草稿与URL分开，应用/重置才改URL；桌面内联、移动共享抽屉，具体断点随共享组件复核 |
| D-OP-CREATE（本地1） | name required≤200、market required≤40、category≤80、source_topic_id≤36；后端名称trim、市场格式/大写、主题UUID与当前范围验证。取消保留父级草稿，提交失败不关闭，成功到返回id。初焦点当前为关闭按钮，并非名称输入 |
| D-OP-ERP（本地1） | limit初始200、number required 1–500；文件接受JSON数组或list，选择即写入，不等待浏览器读取按钮；file模式使用固定ERP来源网址与当前ISO时间。browser模式传items/source_url/captured_at/total，120秒超时；登录打开/失效/助手不可用有不同提示。取消/关闭不代表中断正在运行的bridge或服务器事务 |
| D-OP-DECISION.adopt / observe / reject（本地3） | required原因≤1000；父级传原输入，后端去空白；每次start重置，取消零写；请求失败保留，成功重读关闭。标题按动作变化；当前和DecisionPanel重复使用opportunity-decision-title，完整可访问名称未通过 |
| D-OP-BATCH.assign / review / archive（本地3） | 原因required≤1000，JS还检查trim；assign负责人required；另两种发null。每次打开清草稿，取消零写；失败保留、成功关闭并清选择。服务端单批1–50、唯一UUID与各自正版本；页面每页20。当前预览selectedIds.length和提交current items交集可能不一致，不能以此宣称跨页选择已正确支持 |
| D-OP-AI.approved / rejected（共享原因2） | useAuditedReason默认trim≥2；先关闭原因框再发POST，失败不会自动恢复原框和原因；不同于人工决定“失败保留”的合同。原始AI输出不改写 |
| 成本确认（内联，不是弹窗） | platform required≤80、input_type三种sale_price/purchase_price/logistics、amount required≥0 step0.000001、currency required≤3、source_type required≤80、source_ref_id required≤255、evidence_id required≤36、observed_at required datetime-local、reviewer_id required。POST含以上9项及expected_version，amount转Number/time转ISO；另一人复核是服务端规则，不由UI推断；重算是type=button，不触发表单required校验 |
| 成本复核（内联两变体，不加弹窗数） | 一个reason绑定，required/minlength=2/maxlength=1000且提交trim≥2，approved/rejected两动作；打开清原因、取消清review.id；成功load不主动清当前review.id，状态/权限变化后旧表单需OP09补验 |
| 经营反馈（内联） | period_start/end、sales_units、revenue_amount、ad_spend_amount、returned_units、purchase_lead_time_days、actual_profit_amount、currency、source_ref、notes共11项；数值/日期及来源必填，notes≤1000，交期0–3650，利润可负；父级增加observed_at、币种大写、expected_version。服务端仍验证时间范围、实际退货等事实合法性，不新增校准规则 |

原生四个定义展开8个本地业务变体，加共享AI两变体、共享筛选一项为11。三个主业务dialog在OpportunityWorkspaceDialogs、批量在Workspace。Esc/取消/初焦点/Tab循环/焦点归还/忙碌关闭/成功失败都必须按实际调用方验；本轮测试不覆盖所有上述链。

## 4. URL、缓存、范围与真实状态

- URL保存view及7筛选、page；view缺省recommended，legacy scope=all也映射all；无效页码转1。应用筛选重建query并清分页与其他无关参数；重置只保留非默认view。切view清选中ID/page，非all还清decision_status。翻页或应用筛选目前不清selectedIds。
- 详情tab用replace、返回携带from；safeOpportunityReturnPath只检查字符串单斜杠开头且非双斜杠，不是完整路由白名单或权限保证。直达、不存在、无权和异常from需补验。
- 初次挂载才处理create=1/source_topic_id预填；复用缓存页的后续query变化不一定重新打开创建框。watch ID会清detail并load，query watch仅当前列表路径生效；未见请求归属token/Abort或明确组织/工作区watch，迟到响应与范围切换需复现，不宣称已有TaskWorkspace同级保护。
- AI与下游失败保留各自旧数组；AI articles在error分支外仍可渲染旧记录。详情profit是必需读取，reviewer选项失败静默空。未知错误文案“未写入任何状态”不是后端无写的证据，网络丢响应时必须核对结果/幂等，不根据文案判断事务。
- 成本默认时间取UTC ISO截断后交datetime-local，再按本地时间解析成ISO；存在时区偏移风险，OP09需跨时区定向验证。无业务授权不改变历史金额或时间。
- 只读模式无创建/批量/决定/AI写入，但UI仍读取成员选项和AI；可见、禁用、服务端拒绝要分层验证。成本、竞品、供应三域能力不能用opportunity:decide一项替代。

## 5. 可执行验收卡与未覆盖项

永久测试入口：tests/e2e/ui-phase2-opportunity-contracts.spec.ts；既有tests/e2e/m04-02-opportunities.spec.ts作列表/详情/移动/URL/证据局部回归。每例真实执行结果见PROGRESS，不从文件存在推断通过。新增测试只截获本地API，使用既有字段和合法隔离ID；不证明真实事务、跨租户拒绝、AI提供方或ERP账号可用。

| caseId | 步骤与必须结果 | 本批状态 |
| --- | --- | --- |
| UI2-OP01 | all→手工添加→空提交零POST/定位name→填字段→Escape归还→重开保留→提交；准确四字段、201返回ID导航、详情重读 | 新永久测试 |
| UI2-OP02.assign/review/archive | 同一当前页选两条→开框→取消零写/归还→重开草稿清空→required阻止空提交→准确ID/version/trim原因/assignee或null→成功清选择重读 | 新永久测试3例；不证明跨页选择或服务端整批事务 |
| UI2-OP03.observe/reject | 非推荐不能采纳→提前处理→取消→重开清原因→空提交零写→503保留原因且不自动重放→显式重试→准确原始原因/version及独立幂等键→历史显示返回事实 | 新永久测试2例；用原生dialog定位，未认证重复ID的名称正确 |
| UI2-OP04 | 只读直达tab=ai→连续503耗尽客户端重试→独立error不是empty，主体可见→显式重试200[]才显示尚无分析，全程零业务写入 | 新永久测试；不证明真实RBAC |
| UI2-OP05 | all→ERP→取消零写→重开→选择内存JSON list样例即发一次导入，精确items/source_url/captured_at→关闭并显示返回计数，仍在列表 | 新永久测试；无真实助手/ERP/持久化，不产生本地JSON文件 |
| OP06 列表范围与批量边界 | page1选A→page2选B→打开确认→比较文案计数和POST实际items；再筛选隐藏A或全部、取消/重试；应先明确当前有效范围，不笼统承诺所有选中对象。准确复现后按现有业务边界最小修复，若需新增跨页选择规则先确认 | 待复现/修复/回归，不算跨页通过 |
| OP07 竞态与缓存 | 延迟旧详情/AI/下游→切新ID/组织/工作区/离开→释放响应；写入延迟期间关闭再打开/连点；失败重读前后核对版本/关联对象。旧范围不得覆盖新页，也不能把已提交任务视为被Esc撤销 | 待真实状态模拟与必要修复 |
| OP08 弹窗与无障碍 | 各11变体按键盘打开、Tab/ShiftTab、Esc、归还；唯一标题ID，字段错误关联aria-describedby/invalid、忙碌理由、错误在弹窗内可达；200%缩放/软键盘/长原因不遮挡 | 待全变体；本批仅局部焦点/required/取消证据 |
| OP09 利润/复核/AI状态 | profit失败与reviewer失败分别重试；双人复核、过期、他人/自己、旧version；跨时区输入；AI复核失败原因恢复及旧记录归属；redecision锚点存在性 | 待验；不新增费用、复核资格或AI权限规则 |
| OP10 全动作真实链与图审 | 采纳质量门允许/拒绝、补数新建/复用、评分/利润/AI排队、竞品/供应采集、经营反馈与血缘、ERP桥接和错误、真实DB/RBAC、同版本双视口/主题/密度及生产隔离清理 | 后续按域复用现有测试再补缺，最终图和用户审核均待完成 |

## 6. 本批交付边界

本批补P15/P18独立规格、候选语义及字段/弹窗合同、永久隔离回归。产品Vue/CSS、已有测试、API、权限、数据库、配置、依赖和源码指纹不变；Feature Map只加复核索引。无需部署或重启。规格累计21份、余52份只是文档产出，不改变G0未冻结、G1–G5待验与用户通过0。下一步N03补P16；OP06–OP10保留待办，不因本批测试通过注销。
