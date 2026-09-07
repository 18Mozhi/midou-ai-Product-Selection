# P17 评分规则：逐动作、弹窗及输入合同

日期：2026-09-07；盘点基线main / 4e5e8f5，产品源e1f7a9272b5017307754fa60aa691a8bb43b8329；源指纹c4c1cd7f5470ab3896d355c7e16e49f7b5e291e48809e18eeabbf18198766183。这是R01/S03局部语义复核，不是最终设计、全页验收或G0冻结。

## 1. 真实范围与依据

路由 `/opportunities/scoring-rules` → NavigationShell → ScoreRuleConsole。下表S行号均指 `apps/web/src/components/ScoreRuleConsole.vue`，25个控件/事件候选逐行对应actions.json；3个native dialog在dialogs.json独立对应，展开为7个业务变体。QualityGateSetupSummary只呈现父组件事实，按钮由父组件slot提供；UiStatePanel的primary事件由本页load消费，共享壳层/状态板的内部控件不重复纳入这25项。

读取与写入经api-client；HTTP路由在scoring-routes.ts，服务校验在scoring-service.ts，真实状态转换在mysql-scoring-repository.ts。三个弹窗复用use-modal-dialog.ts，后端按会话解析组织/工作区并检查能力；前端隐藏只证明呈现，不证明RBAC安全。

## 2. 25个源码候选的完整局部映射

语义ID前缀统一为 `scoring.`；`{action}`只指submit/approve/reject/activate/rollback。表单事件与submit按钮是同一业务动作的不同源码位置，不能重复计算行为。

| 组件行 | 语义ID | 现有入口与结果 |
| --- | --- | --- |
| S396 | create.open | canDecide且非ready时顶部入口；不等于已加载可创建 |
| S404 | list.retry | UiStatePanel primary→load；读取目录，无业务写入 |
| S413 | create.open | empty且canDecide，创建首个草稿 |
| S430 | create.open | ready覆盖说明内入口；是否缺项不影响canDecide门 |
| S459 | preview.open | canApprove，draft/pending_approval/approved；GET第1页 |
| S466 | action.submit.open | canDecide且draft，begin清原因/目标/错误 |
| S468 | action.approve.open | canApprove且pending_approval |
| S473 | action.reject.open | canApprove且pending_approval |
| S478 | action.activate.open | canApprove且approved |
| S480 | action.rollback.open | canApprove且active |
| S491 | create.close | cancelCreate→closeCreate，关闭并清错误，不清草稿 |
| S498 | create.submit | createValidation无错且canDecide；正权重维度POST |
| S504 | create.close | 标题关闭按钮，现有busy期间仍可关闭 |
| S567 | create.close | 取消按钮，与标题关闭同合同 |
| S568 | create.submit | 同表单提交；busy或createValidation禁用 |
| S574 | preview.close | cancelPreview→closePreview，清错误，不取消GET |
| S587 | preview.close | 标题关闭按钮 |
| S594 | preview.retry | loadPreview(previewRule)，明确重试第1页而非失败页 |
| S657 | preview.previous | page≤1或previewing禁用；GET上一页 |
| S664 | preview.next | page×page_size≥total或previewing禁用；GET下一页 |
| S675 | action.{action}.close | cancelAction→closeAction；关闭清错误，重开清原因/目标 |
| S682 | action.{action}.submit | runAction→POST actions；expected_revision来自选中快照 |
| S690 | action.{action}.close | 标题关闭按钮；busy期间未锁定 |
| S710 | action.{action}.close | 取消按钮；不提交、不改变规则 |
| S711 | action.{action}.submit | 同表单提交；busy禁用；原生required仍生效 |

## 3. 7个业务弹窗变体与请求

| dialogId | 定义 | 请求和允许状态 | 成功结果与风险边界 |
| --- | --- | --- | --- |
| scoring.create | S491 | POST /opportunity-score-rules，decide；字段version_code/name/dimensions/thresholds | 关闭、清空表单、重读目录；不是直接生效 |
| scoring.preview | S574 | GET /opportunity-score-rules/{id}/preview?page=N&page_size=20，approve；draft/pending_approval/approved | 只读预览；不创建运行/队列或更新历史；本地测试不能证明数据库无写入 |
| scoring.action.submit | S675 | POST /opportunity-score-rules/{id}/actions；draft→pending_approval | reason、action、expected_revision；成功重读 |
| scoring.action.approve | S675 | 同端点；pending_approval→approved | 仅批准，不等于当前生效 |
| scoring.action.reject | S675 | 同端点；pending_approval→rejected | 必填原因；无前端重提入口 |
| scoring.action.activate | S675 | 同端点；approved→active | 真实仓库将旧active停用并queueAll；不能当普通只读操作 |
| scoring.action.rollback | S675 | 同端点；active，加target_rule_id | 原规则rolled_back、当前工作区approved/retired目标转active并queueAll；返回目标规则，不是返回原规则 |

所有POST经共享客户端附加幂等键，后端要求同源、权限和版本；事务审计及Outbox由后端执行。页面没有独立“停用”动作，retired由启用替代时产生，不能因蓝图出现“停用”就编造按钮或API。

## 4. 静态控件扫描之外的输入模型

actions扫描不将普通v-model输入当独立动作，不能因此遗漏它们。9个v-model源码位置在展开8维表单后共有30个输入实例：版本代码、名称、两个阈值，加8×权重/证据组/必填，再加生命周期原因及回滚目标。回滚目标只在对应变体出现。

| 输入 | 实际校验/取值 | 设计与验收边界 |
| --- | --- | --- |
| version_code/name | required，长度64/160；服务端版本代码限制A–Z/a–z/0–9/点/下划线/短横线，服务端trim | 浏览器没有同等pattern；不能写成前端已拦全部格式 |
| recommend_min/observe_min | 初始null；0–100、step0.01；推荐必须大于观察 | 不提供默认业务值；小数/边界完整矩阵仍待补 |
| dimension.weight | 八个既有代码；0–100、step0.01；仅正权重提交；至少两维，总计四舍五入两位后100 | 不为了“配置已覆盖”自行给风险权重或重新分配权重 |
| dimension.evidence_group | market/competition/cost/other，初始other | 名称和实际枚举对应，不推测来源证据 |
| dimension.required | 初始false，至少一个已启用维度必填 | 零权重必填项不满足正权重维度要求 |
| reason | 所有生命周期动作required、最长1000；服务端trim并拒绝空白 | 原生required不等于纯空白字符串有效性已验证 |
| target_rule_id | rollback独有required；下拉来自当前目录approved/retired | 后端再次限制同工作区；UI选项测试不证明真实隔离 |

取消创建保留草稿，成功才resetForm；生命周期每次begin清空原因和目标，不能为“统一弹窗”擅自改成相同草稿规则。

## 5. 错误、读取和无障碍边界

- createError/actionError/previewError位于各自弹窗内role=alert，并展示关联ID；409版本冲突不自动改selected.revision，需要关闭并刷新目录后重新选择。重新提交仍带旧版本时不能绕过服务端拒绝。
- 共享客户端对安全GET的可重试错误最多尝试3次（0/150/400ms），POST不自动重试。测试503必须耗尽3次后才可断言最终错误，再执行用户“重试预览”。
- loadPreview每次清空旧preview，失败后不会保留上页列表；重试按钮回第1页。关闭不abort在途GET，忙碌时禁止新loadPreview；关闭/重开及迟到响应仍待竞态验证。
- busy只保护post期间。标题关闭、取消、Escape未统一锁定；请求完成后的load不在busy锁内。不能宣称完整重复提交/提交中重开合同已通过。
- **设计前必须补齐的显示缺口：** 接口有missing_fields，但当前预览模板未逐项渲染；page_summary.unchanged也没有摘要项。新设计应使用真实字段补足缺失项说明，不把当前“数据不足”当成缺失原因已展示。
- 无障碍技能要求表单错误与字段关联；当前summary/alert未通过aria-describedby关联到输入，缺少显式aria-invalid。需在正式表单重设计时补齐并验证，当前测试只证明错误可见、原生必填及焦点，不宣称WCAG全项通过。

## 6. 本轮验证入口与覆盖界限

新增 `tests/e2e/ui-phase2-scoring-contracts.spec.ts`，保留原m04-03-scoring及图源不动；11项参数化真实Vue隔离响应测试：

| caseId | 本地验证内容 | 仍未证明 |
| --- | --- | --- |
| UI2-S01 ×5 | 各动作的必填、初焦点、取消无写入/焦点归还、重开清原因、精确路径/字段/revision/幂等键、成功重读；回滚只选允许目标 | 真实事务、审计、queueAll和其他租户拒绝 |
| UI2-S02 | 创建阈值关系、两维、权重总计、必填提示、取消保留、正权重精确POST、成功重置 | 所有边界值、失败恢复、真正持久化 |
| UI2-S03 | 409错误留在弹窗且保留原因；整页刷新后使用新revision，不静默覆盖 | 并发真实客户端、成功重试与幂等重放 |
| UI2-S04 | 三次503耗尽后可见错误、手动重试、20/1分页与total21、首末页禁用、全过程零POST、关闭焦点归还 | 后端无写事务、失败页重试、关闭竞态及missing_fields可读性 |
| UI2-S05 ×3 | read/decide/approve三组合×七状态的全部入口数量与无操作状态 | 真实用户角色、服务端鉴权和能力动态撤销 |

既有m04-03测试提供目录覆盖、缺风险未就绪、空态及机会评分解释等其他证据。还需处理全键盘循环、错误字段关联、长内容、三主题/两密度、所有断点、版本与网络竞态、真实后端/生产以及用户设计审核。局部25候选的源码对应不等于完整P17运行时分母冻结。
