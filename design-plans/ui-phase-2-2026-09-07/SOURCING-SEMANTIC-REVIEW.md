# P21 货源发现 · 逐动作与既有图稿对账

[成本与复核控件审核](SOURCING-COST-CONTROL-REVIEW.md)。2026-09-09 P21成本与复核：8控件变体新增80双端图；本包65主场景695PNG、59变体544双端状态实例。五语义组新增26代表槽，累计150映射、20待适用性核对；驳回额外变体不新增动作。成本busy与找货独立，机会/复核版本分别使用，取消/换结论不撤回已发请求；无源禁用条件不编造图。13组源隔离、smoke和完整capture通过，具体批准/真实Vue/部署仍待。 以下计数为历史批次。

[导航与恢复状态审核](SOURCING-NAVIGATION-RECOVERY-REVIEW.md)。2026-09-09 P21导航与恢复：新增230PNG（28控件变体双端四态224图＋3场景6图），包现65主场景615PNG、51控件变体464双端状态实例。8导航和2恢复代表组新增40槽，累计124已映射、46待补；额外来源、query和角色/主次恢复不增加动作分母。源恢复实际load与通用标签差异已明示，原型不伪造登录/权限/返回能力，加载/失败隐藏旧记录和删除入口。11组源隔离与完整capture通过，具体批准/真实Vue/部署未完成。 以下计数为历史批次。

[主操作状态审核](SOURCING-MAIN-STATE-REVIEW.md)。2026-09-09：主操作新增96张双端图；本包62主场景385PNG、23控件变体240双端状态实例。8语义组增加36代表槽，第二采购来源/其他记录/已勾选为3额外变体，不新增业务动作；累计84代表槽已绑定、86待补。局部/读取控件没有源码禁用或busy条件的，不编造图或减分母。仅离线提案，未提升批准、改生产或部署。 下方数字保留历史批次语境。

2026-09-09最新：[关闭与取消图](SOURCING-SECONDARY-STATE-REVIEW.md)新增96张，P21包现289图；累计48代表槽映射、122待补。四个取消额外变体不新增业务动作，父请求关闭锁为待审提案。下方历史数字保留原批次语境。

2026-09-09后续：[四个提交按钮状态审核](SOURCING-CONTROL-STATE-REVIEW.md)新增48图，当前193PNG；24代表槽已映射，146待补。以下145图/170槽和“未改图”是上一批来源对账记录，不作为当前覆盖计数。具体控件仍未批准，真实生产未改。

状态：来源已核对、具体设计待审核。本批关联既有图片，没有新增或修改图稿，也未改变真实 Vue 或部署。P16 的整体布局批准不扩展为 P21 批准。

## 本页覆盖口径

- 6 个真实组件的 54 个源位置归为 38 个语义组：31 个路由动作、7 个装配或窗口定义关联。共享利润及复核组件的 10 个源位置与已有页面去重，全站本批增加 44 个独立源位置。
- 25 个 v-model 输入、12 个结构容器单列；4 个窗口是现有 div role=dialog，不是 4 个已实现的原生模态。成本提交与复核为内联表单，不额外计弹窗。
- 8 个导航组仅 disabled/busy 标为导航不适用；其余 23 个动作按六态留档，共 **170 个代表视觉槽尚未逐 selector 绑定**。不因已有整页图就宣称每个按钮六态完成。
- 既有 62 场景、145 PNG：双端整页/模态 124 张、长表单下部 9 张、选择边界/MOQ/通用焦点悬停 8 张、平板 4 张。通用主按钮焦点图不替代本页所有动作证据。
- 离线原型的 28 个 DOM 动作标记包含提案内容页签，不是当前 Vue 的 31 个动作分母；38 组也不是 38 次独立业务写入。

依据：[机器动作清单](action-reviews/P21.json)、[真实来源合同](sourcing-cost-contract-review.md)、[页面规格](page-specs/P21.md)、[原型与全部图册](design/sourcing-direction-c/README.md)。

## 逐动作对应

下表双端链接仅是该组的代表上下文图；完整相关场景列在第四列。不是逐控件裁图、全状态证明或用户通过记录。准确源位置、权限、事件转发及剩余缺口见机器清单。

| 动作 ID | 语义 / 类型 | 真实条件与处理 | 相关场景 | 代表上下文图 |
| --- | --- | --- | --- | --- |
| SC-NAV-SELF | 供应商找货页签（navigation） | 本地无条件；适用父层条件见routeApplicability；RouterLink /sourcing，不强制保留q/record | workspace | [桌面](design/sourcing-direction-c/1440-workspace.png) / [手机](design/sourcing-direction-c/390-workspace.png) |
| SC-NAV-RULES | 费用规则页签（navigation） | 本地无条件；适用父层条件见routeApplicability；RouterLink /sourcing/cost-rules；不带from | workspace | [桌面](design/sourcing-direction-c/1440-workspace.png) / [手机](design/sourcing-direction-c/390-workspace.png) |
| SC-S-OPEN | 发起找货（local） | v-if:canManage；openSearch只检查canManage并showSearch=true/replace create=1；不重置form | search-keyword、search-image、search-opportunity、search-product_url | [桌面](design/sourcing-direction-c/1440-search-keyword.png) / [手机](design/sourcing-direction-c/390-search-keyword.png) |
| SC-STATE | 整页状态主次操作（read） | v-if:state !== 'ready'；primary empty+manager打开搜索，其余load；secondary empty清query，其余load；expired/forbidden不跳登录或home | empty、loading、error、expired、forbidden、rate-limited | [桌面](design/sourcing-direction-c/1440-empty.png) / [手机](design/sourcing-direction-c/390-empty.png) |
| SC-SEARCH-RECOVERY | 空筛选恢复（read） | v-else-if:!filteredItems.length；primary resetQuery；secondary manager openSearch否则load | search-empty | [桌面](design/sourcing-direction-c/1440-search-empty.png) / [手机](design/sourcing-direction-c/390-search-empty.png) |
| SC-DETAIL | 选择找货记录（read） | v-else: && v-for:item in filteredItems；切对象先清selectedQuotes；GET /sourcing/searches/:id，成功replace record并清create | workspace、keyword-record、detail-error | [桌面](design/sourcing-direction-c/1440-workspace.png) / [手机](design/sourcing-direction-c/390-workspace.png) |
| SC-REFRESH | 重新采集（write） | v-else: && v-if:selected && v-if:canManage；POST /sourcing/searches/:id/refresh {}，成功只排队；notice后load会清空 | workspace、queued、running、failed | [桌面](design/sourcing-direction-c/1440-workspace.png) / [手机](design/sourcing-direction-c/390-workspace.png) |
| SC-NAV-RULES-CONTEXT | 当前找货费用规则（navigation） | v-else: && v-if:selected；RouterLink /sourcing/cost-rules?from=route.fullPath | workspace、cost-missing | [桌面](design/sourcing-direction-c/1440-workspace.png) / [手机](design/sourcing-direction-c/390-workspace.png) |
| SC-DELETE-OPEN | 打开删除确认（local） | v-else: && v-if:selected && v-if:canManage；deleting=selected；此入口不重置旧deleteReason，不发DELETE | delete | [桌面](design/sourcing-direction-c/1440-delete.png) / [手机](design/sourcing-direction-c/390-delete.png) |
| SC-NAV-COLLECTION | 受权采集明细（navigation） | v-else: && v-if:selected && v-if:selected.collection_progress && v-if:canInspectCollection；仅collection_progress且canInspectCollection；/platform-admin/collection?task=collection_task_id | platform-inspect | [桌面](design/sourcing-direction-c/1440-platform-inspect.png) / [手机](design/sourcing-direction-c/390-platform-inspect.png) |
| SC-ERP | ERP原页面（navigation） | v-else: && v-if:selected && v-if:selected.erp_reference；selected.erp_reference.source_url新窗口noopener noreferrer，不当作确认报价 | erp | [桌面](design/sourcing-direction-c/1440-erp.png) / [手机](design/sourcing-direction-c/390-erp.png) |
| SC-SELECT | 选择报价对比（local） | v-else: && v-if:selected && v-for:item in candidates && v-if:canManage && item.quote；只接受有quote的候选；最多五个quote.id，取消选择；原生checked同步实际集合 | select-one、select-two、select-five | [桌面](design/sourcing-direction-c/1440-select-one.png) / [手机](design/sourcing-direction-c/390-select-one.png) |
| SC-SOURCE | 原始商品页（navigation） | v-else: && v-if:selected && v-for:item in candidates；item.original_url新窗口noopener noreferrer；来源事实不是报价提交 | workspace、missing-quote | [桌面](design/sourcing-direction-c/1440-workspace.png) / [手机](design/sourcing-direction-c/390-workspace.png) |
| SC-QUOTE-OPEN | 打开报价确认（local） | v-else: && v-if:selected && v-for:item in candidates && v-if:canManage && !item.quote；openQuote依候选预填，缺MOQ/交期/可信度用1/7/80；时间按本地时区转换；无quote才显示 | quote、quote-defaults | [桌面](design/sourcing-direction-c/1440-quote.png) / [手机](design/sourcing-direction-c/390-quote.png) |
| SC-PURCHASE-OPEN | 打开采购任务（local） | v-else: && v-if:selected && v-for:item in candidates && v-else-if:canManage；已有quote才可打开；锁定candidate.quote，重置MOQ数量和默认原因 | purchase | [桌面](design/sourcing-direction-c/1440-purchase.png) / [手机](design/sourcing-direction-c/390-purchase.png) |
| SC-COMPARE | 保存报价对比（write） | v-if:canManage && selectedQuotes.length；POST /sourcing/comparisons {name,quote_ids}；按钮>=2且非busy；成功清选择并load | select-one、select-two、select-five、comparison | [桌面](design/sourcing-direction-c/1440-select-one.png) / [手机](design/sourcing-direction-c/390-select-one.png) |
| SC-DIALOG-WIRING | 四窗调用与事件装配（wiring） | v-if:canManage；v-if:canManage；SW传递四窗props；八动作事件转发，update-delete-reason仅编辑本地输入，不触发删除提交 | search-keyword、quote、purchase、delete | [桌面](design/sourcing-direction-c/1440-search-keyword.png) / [手机](design/sourcing-direction-c/390-search-keyword.png) |
| SC-S-DIALOG | 找货窗口定义（wiring） | v-if:showSearch；自定义div role=dialog；父SW canManage才挂载；定义关联至现有关闭/提交，不是额外写入 | search-keyword、search-image、search-opportunity、search-product_url、search-error、search-busy | [桌面](design/sourcing-direction-c/1440-search-keyword.png) / [手机](design/sourcing-direction-c/390-search-keyword.png) |
| SC-S-CLOSE | 找货关闭/Escape/取消（local） | v-if:showSearch；v-if:showSearch；v-if:showSearch；closeSearch隐藏并清create；草稿保留；源忙碌仍可关，焦点仅局部Escape，不证明取消服务端请求 | search-keyword、search-image、search-opportunity、search-product_url、search-error、search-busy | [桌面](design/sourcing-direction-c/1440-search-keyword.png) / [手机](design/sourcing-direction-c/390-search-keyword.png) |
| SC-S-SUBMIT | 找货最终提交（write） | v-if:showSearch；v-if:showSearch；form/create与submit同一提交；POST /sourcing/searches仅input_type/input_ref原值；源shared post无函数级busy守卫，真实幂等/异步归属待验 | search-keyword、search-image、search-opportunity、search-product_url、search-error、search-busy | [桌面](design/sourcing-direction-c/1440-search-keyword.png) / [手机](design/sourcing-direction-c/390-search-keyword.png) |
| SC-QUOTE-DIALOG | 报价窗口定义（wiring） | v-if:quoteCandidate；自定义div role=dialog；父SW canManage才挂载；定义关联至现有关闭/提交，不是额外写入 | quote、quote-defaults、quote-error、quote-busy | [桌面](design/sourcing-direction-c/1440-quote.png) / [手机](design/sourcing-direction-c/390-quote.png) |
| SC-QUOTE-CLOSE | 报价关闭/Escape/取消（local） | v-if:quoteCandidate；v-if:quoteCandidate；v-if:quoteCandidate；quoteCandidate=null；源忙碌仍可关，焦点仅局部Escape，不证明取消服务端请求 | quote、quote-defaults、quote-error、quote-busy | [桌面](design/sourcing-direction-c/1440-quote.png) / [手机](design/sourcing-direction-c/390-quote.png) |
| SC-QUOTE-SUBMIT | 报价最终提交（write） | v-if:quoteCandidate；v-if:quoteCandidate；candidate_id及九个quote字段，observed_at转UTC；不发送原始price/currency修改；源shared post无函数级busy守卫，真实幂等/异步归属待验 | quote、quote-defaults、quote-error、quote-busy | [桌面](design/sourcing-direction-c/1440-quote.png) / [手机](design/sourcing-direction-c/390-quote.png) |
| SC-PURCHASE-DIALOG | 采购窗口定义（wiring） | v-if:purchaseCandidate；自定义div role=dialog；父SW canManage才挂载；定义关联至现有关闭/提交，不是额外写入 | purchase、purchase-error、purchase-busy | [桌面](design/sourcing-direction-c/1440-purchase.png) / [手机](design/sourcing-direction-c/390-purchase.png) |
| SC-PURCHASE-CLOSE | 采购关闭/Escape/取消（local） | v-if:purchaseCandidate；v-if:purchaseCandidate；v-if:purchaseCandidate；purchaseCandidate=null；源忙碌仍可关，焦点仅局部Escape，不证明取消服务端请求 | purchase、purchase-error、purchase-busy | [桌面](design/sourcing-direction-c/1440-purchase.png) / [手机](design/sourcing-direction-c/390-purchase.png) |
| SC-PURCHASE-SUBMIT | 采购最终提交（write） | v-if:purchaseCandidate；v-if:purchaseCandidate；POST /sourcing/purchase-tasks {quote_id,quantity:Number,reason:trim}；数量>=MOQ且trim原因至少2字按钮才可提交；源shared post无函数级busy守卫，真实幂等/异步归属待验 | purchase、purchase-error、purchase-busy | [桌面](design/sourcing-direction-c/1440-purchase.png) / [手机](design/sourcing-direction-c/390-purchase.png) |
| SC-DELETE-DIALOG | 删除窗口定义（wiring） | v-if:deleting；自定义div role=dialog；父SW canManage才挂载；定义关联至现有关闭/提交，不是额外写入 | delete、delete-error、delete-busy | [桌面](design/sourcing-direction-c/1440-delete.png) / [手机](design/sourcing-direction-c/390-delete.png) |
| SC-DELETE-CLOSE | 删除关闭/Escape/取消（local） | v-if:deleting；v-if:deleting；v-if:deleting；deleting=null，原因未清空；源忙碌仍可关，焦点仅局部Escape，不证明取消服务端请求 | delete、delete-error、delete-busy | [桌面](design/sourcing-direction-c/1440-delete.png) / [手机](design/sourcing-direction-c/390-delete.png) |
| SC-DELETE-SUBMIT | 删除最终提交（write） | v-if:deleting；v-if:deleting；DELETE /sourcing/searches/:id仅trim原因；不编revision，trim为空handler早退；源shared post无函数级busy守卫，真实幂等/异步归属待验 | delete、delete-error、delete-busy | [桌面](design/sourcing-direction-c/1440-delete.png) / [手机](design/sourcing-direction-c/390-delete.png) |
| SC-NAV-OPPORTUNITY | 机会利润详情（navigation） | 本地无条件；适用父层条件见routeApplicability；/opportunities/:id?tab=profit&from=/sourcing；不保留record | cost-missing、cost-calculated | [桌面](design/sourcing-direction-c/1440-cost-missing.png) / [手机](design/sourcing-direction-c/390-cost-missing.png) |
| SC-COST-WIRING | P21机会成本父处理器（wiring） | 本地无条件；适用父层条件见routeApplicability；SC负责cost-inputs/profit-runs及cost-input-reviews/actions真实URL，机会与review版本分别使用 | cost-missing、cost-review-approved | [桌面](design/sourcing-direction-c/1440-cost-missing.png) / [手机](design/sourcing-direction-c/390-cost-missing.png) |
| SC-NAV-PROFIT-RULES | 利润面板费用规则（navigation） | 本地无条件；适用父层条件见routeApplicability；固定/sourcing/cost-rules，不带from；只在机会成本面板装配时出现 | cost-missing | [桌面](design/sourcing-direction-c/1440-cost-missing.png) / [手机](design/sourcing-direction-c/390-cost-missing.png) |
| SC-COST-REVIEW-WIRING | 共享复核事件上送（wiring） | 本地无条件；适用父层条件见routeApplicability；PP仅透传RQ的reviewCost payload，P21由SC.reviewCost处理，不套用P18父层 | cost-review-approved、cost-review-rejected | [桌面](design/sourcing-direction-c/1440-cost-review-approved.png) / [手机](design/sourcing-direction-c/390-cost-review-approved.png) |
| SC-COST-SUBMIT | 提交双人成本复核（write） | v-if:canConfirmCost；v-if:canConfirmCost；canConfirmCost控制form，busy或reviewer空禁用；costForm九字段+expected_version=机会version；提交后未立即成为当前成本 | cost-missing、cost-reviewers-empty、cost-submit-error | [桌面](design/sourcing-direction-c/1440-cost-missing.png) / [手机](design/sourcing-direction-c/390-cost-missing.png) |
| SC-COST-RECALCULATE | 利润重算排队（write） | v-if:canConfirmCost；canConfirmCost且非busy按钮；SC只POST {platform,expected_version:机会version}到profit-runs | cost-recalculating、cost-missing | [桌面](design/sourcing-direction-c/1440-cost-recalculating.png) / [手机](design/sourcing-direction-c/390-cost-recalculating.png) |
| SC-COST-REVIEW-OPEN | 通过/驳回内联表单（local） | v-for:item in reviews && v-if:item.can_review；v-for:item in reviews && v-if:item.can_review；item.can_review控制两个入口；beginReview写id/decision并清reason，不立即审批 | cost-review-approved、cost-review-rejected、cost-overdue | [桌面](design/sourcing-direction-c/1440-cost-review-approved.png) / [手机](design/sourcing-direction-c/390-cost-review-approved.png) |
| SC-COST-REVIEW-SUBMIT | 提交复核结论（write） | v-for:item in reviews && v-if:review.id === item.id；v-for:item in reviews && v-if:review.id === item.id；reason.trim长度>=2；payload reviewId/decision/trim reason/expectedVersion=item.version；SC映射expected_version到review动作API | cost-review-approved、cost-review-rejected | [桌面](design/sourcing-direction-c/1440-cost-review-approved.png) / [手机](design/sourcing-direction-c/390-cost-review-approved.png) |
| SC-COST-REVIEW-CANCEL | 取消内联复核（local） | v-for:item in reviews && v-if:review.id === item.id；只清review.id，不发请求，不保证旧在途响应不会影响新表单 | cost-review-approved、cost-review-rejected | [桌面](design/sourcing-direction-c/1440-cost-review-approved.png) / [手机](design/sourcing-direction-c/390-cost-review-approved.png) |

## 恢复与权限，不能照搬其他页面

| 边界 | 当前源行为 | 设计审核要求 |
| --- | --- | --- |
| 整页 empty 主操作 | 管理者打开找货；其他情况 load | 按身份分别呈现，不虚构只读创建 |
| 整页 empty 次操作 | resetQuery；其他状态次操作 load | expired/forbidden 当前也 reload，不借用 P19 的登录/首页处理 |
| 空筛选 | 主操作 resetQuery；次操作管理者打开找货，否则 load | 需分别绑定按钮、焦点及恢复后状态 |
| 比较历史失败 | 列表与历史在同一 try；历史失败会阻断列表 | 独立降级是待审提案，SC-G02 未修 |
| 找货与报价写入 | supplier_quote:manage | 不能用 cost:confirm 代替 |
| 成本提交与重算 | cost:confirm | 复核人的每条动作另依 item.can_review |
| 采集明细 | platform:operate 或 platform:superadmin | 不对普通用户绘制可访问管理详情的假入口 |
| 重新采集 | 请求排队，随后 load；当前无定时 GET 轮询 | 不将排队/在途提示写成采集完成或自动持续刷新 |

## 表单、对象及版本的真实边界

搜索仅发 input_type/input_ref，四种类型不等于上传图片能力；关闭保留草稿。报价发送 candidate_id 加现有九个确认字段，不编辑原 price/currency。缺失时预填 MOQ=1、交期=7、可信度=80 只是当前表单默认，不是外部事实。

选择对比最多 5 个，保存入口要求至少 2 个；第六选择回同步到已接受集合。采购数量按当前报价 MOQ，提交数量与 trim 原因；排队不代表已采购、付款或供应商接单。删除只发送 trim 原因，没有凭空增加版本字段。update-delete-reason 关联提交组仅表示输入由该 payload 消费，**不表示输入变化会调用 DELETE**。

P21 成本父面板并非 P18 的父处理器。成本确认使用机会 expected_version，复核使用条目自己的 expectedVersion，重算仍使用机会版本；不能互相替换。已保存比较引用保存时的报价版本，不自动变成今天的现行报价。规格提示只处理格式，不换算单位或推断等价。

## 图稿提案与未修问题

现有离线原型的原生 dialog、完整焦点循环/归还、在途关闭锁定、独立降级和更准确提示，均是提案；源 Vue 仍为自定义窗口和局部 Escape/初始焦点。关闭不表示撤回已发请求。以下旧合同缺口全部保留，不通过这次清单归档关闭：

| 缺口 | 未完成事项 |
| --- | --- |
| SC-G01 | 缺失报价默认值的业务确认；variable 与 volatile 展示差异 |
| SC-G02 | 比较历史失败阻断、详情失败及恢复边界 |
| SC-G03 | 函数级重入、提交中关闭/重开/切对象及共享 busy |
| SC-G04 | 四窗和内联表单完整键盘、错误关联、回焦及辅助技术 |
| SC-G05 | 读代次/迟到响应、反向路由、KeepAlive、范围及多标签 |
| SC-G06 | 历史报价语义、多市场准备度，refresh/delete/成本成功提示被 load 清空 |
| SC-G07 | 成本 datetime-local 的 UTC 默认值、复核人为空及切机会草稿归属 |
| SC-G08 | 完整逐控件/主题密度/角色、真实后端与生产、用户审核及实施 |

## 本批验证与下一步

已运行真实 setup 隔离验证 9 组，以及既有离线原型只读复验（62 场景/145 PNG、双端与多屏宽、HTTP/页面错误 0）。没有重新生成图片，也没有把历史 E2E 当成本批真实 Vue 验收。动作审计现 22 页、479 个去重源位置、426 个语义组；全站分母未冻结，完整页面批准仍为 0。

下一步按以上动作细化默认、悬停、焦点、按下、禁用及提交中；优先找货、报价、采购、删除四窗和对象归属。170 槽是待逐项适用性复核及取证的清单，不是已完成量。P22 费用规则独立核对。没有改接口、数据库、配置、权限、依赖或生产；无需重启。
