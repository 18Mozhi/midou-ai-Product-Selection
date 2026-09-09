# P16/P17 创建选品与评分规则：逐项审核入口

最新决定：用户已明确“统一五项质量门”，见[J07决定记录](JOURNEY-ADOPTION-DECISION.md)。下文对冲突的源证据仍成立；规则选择已解决，采纳成功稿与前后端实施尚未完成，不再等待重复选择。

基线 `a1e59929`，C方向已选，不等于具体页面或采纳规则已批准。本轮用需求拆解与UI技能路由按真实调用链分类；仅补源语义、图引用与风险证据，不修改产品样式/逻辑。

## 从这里审图

- P16：[96张图与交互稿](design/journey-direction-c/README.md) · [手机候选选择](design/journey-direction-c/390-selected.png) · [采纳规则待定](design/journey-direction-c/1440-adoption-pending.png) · [逐项JSON](action-reviews/P16.json)
- P17：[48张图与交互稿](design/scoring-direction-c/README.md) · [桌面回滚](design/scoring-direction-c/1440-rollback.png) · [手机维度编辑](design/scoring-direction-c/390-create-risk.png) · [逐项JSON](action-reviews/P17.json)

P16按三输入→恢复→来源进展→候选/原文→观察驳回→返回任务/下一次审核。P17按生效版本/配置缺项→八维草稿→影响预览→五生命周期原因审核。144张旧图复用，不生成同类重复图；本轮目检手机候选选择与桌面回滚两图，不宣称全图已目检。

## 数量口径和保护边界

| 项目 | P16 | P17 |
| --- | --- | --- |
| 当前局部源码 | SelectionJourney.vue，10位置 | ScoreRuleConsole.vue，28位置 |
| 显式语义组 | 8页面动作 | 16页面动作+3原生定义关联 |
| 模型绑定 | 5位置；含三种类型/动态候选/三种决定radio | 9位置；展开四基本+八维各三+原因/目标，共30输入实例 |
| 结构容器/场景关联 | 两form+一aside，7关联 | 三dialog+两form+三aside，30关联 |
| 业务弹窗 | 0，决定仍内联 | 7：创建、预览、提交/批准/拒绝/启用/回滚 |
| 未映射代表控件六态槽 | 48 | 96 |

容器、关联、按钮实例、业务弹窗不能混算。两路由均reset_on_scope；P16读取已有active/代次/Abort与缓存激活保护，P17没有同级局部读归属。P16路由要求opportunity:decide，但创建API要task:create、读取API要opportunity:read；组件只接apiBaseUrl，不伪造已分层的前端权限投影。P17真实接收capabilities，decide与approve独立，不把只准提交当可审批。

## P16 创建选品动作

| 动作 | 当前条件与行为 | 代表图 | 未完成 |
| --- | --- | --- | --- |
| `J-NAV-LIST` 返回机会列表 | 页面常驻；不受busy/reading禁用；RouterLink /opportunities，不传from；导航不取消后台任务 | [桌面](design/journey-direction-c/1440-keyword.png) / [手机](design/journey-direction-c/390-keyword.png) | deactivate保护读取，不阻断已发POST；离开后的成功归属必须独立验证。 |
| `J-STATE-RECOVERY` 状态面板主次恢复 | 仅state非ready且非loading；journey或resumeId时主文案重试读取进度；primary有journey走load，否则resumeId走resume，均无则reset；secondary blocked仅解释、forbidden提示能力、其余history.back | [桌面](design/journey-direction-c/1440-restore-failed.png) / [手机](design/journey-direction-c/390-restore-failed.png) | 两个事件均保留；无journey/resumeId时共享重新登录等文案不改变reset行为；恢复副说明不是鉴权修复，真实401/403/存储异常待验。 |
| `J-CREATE` 提交三类选品线索 | !journey内联form；按钮busy||reading禁用；函数!active/busy/reading早退；POST /selection-journeys {input_kind,input_value}原值；stopRead/resumeId清空→busy/loading→202 applyJourney/ready/schedule；只创建旅程，不等于机会 | [桌面](design/journey-direction-c/1440-keyword.png) / [手机](design/journey-direction-c/390-keyword.png) | 源函数隔离证实deactivate后旧成功仍applyJourney并写内存替身活动ID，active=false时不设timer；未认证真实缓存/多标签，原未知错误文案未创建不代表无持久化。 |
| `J-SOURCE` 查看候选原文 | 每条candidates；原生a嵌在radio label；canonical_url原值，target=_blank rel=noopener noreferrer @click.stop；不发业务POST | [桌面](design/journey-direction-c/1440-results.png) / [手机](design/journey-direction-c/390-results.png) | click.stop只停冒泡，不自动证明label默认激活被取消；原型把来源链接与radio分离，仍需实际鼠标/键盘验收。 |
| `J-DECIDE` 保存三种审计决定 | terminal且journey.state!=decided；采纳radio仅selectedCandidate.topic_id可用，提交按钮busy||reading禁用；函数要求active/旅程/非busy/非reading；POST /selection-journeys/{id}/decisions {action,reason,selected_raw_evidence_id}；adopt选中ID或null，observe/reject恒null，不带expected_version；成功applyJourney清reason并stop，不设state=ready | [桌面](design/journey-direction-c/1440-adoption-pending.png) / [手机](design/journey-direction-c/390-adoption-pending.png) | J07直接adopted与P18五门冲突未获决定；adoption-pending不是采纳成功图，也不代表源已禁用。决定失败重试成功仍state=error已隔离复现；来源超时但task运行时提交会受服务拒绝，源UI未禁。 |
| `J-NAV-OPPORTUNITY` 查看返回机会 | journey.decision存在且返回opportunity_id非空；/opportunities/{opportunity_id}，无自动跳转或from；不是无条件创建机会 | [桌面](design/journey-direction-c/1440-adoption-pending.png) / [手机](design/journey-direction-c/390-adoption-pending.png) | 现有合规图样本无采纳成功，只有待定/无链接相关图；不可拿观察夹具造机会链接已通过，P18目标证据待业务规则明确。 |
| `J-NAV-TASK` 打开返回验证任务 | journey.decision存在且verification_task_id非空；/tasks/{verification_task_id}，按实际返回ID；观察/驳回可能产生验证任务 | [桌面](design/journey-direction-c/1440-observe-decided.png) / [手机](design/journey-direction-c/390-observe-decided.png) | 请求成功不证明任务执行或消息送达；没有返回ID不补造。 |
| `J-RESET` 开始下一次 | 有journey时footer，busy禁用且函数早退；reading期间可用；stopRead失效旧GET并清resumeId/journey/state/message/input_value/selectedResultId/活动ID；保留input_kind、decision.action/reason、requestId；不取消后台采集 | [桌面](design/journey-direction-c/1440-running.png) / [手机](design/journey-direction-c/390-running.png) | 重置保留旧原因已确认；原型清理是待审提案，不能扩充浏览器持久化；写入晚到、storage异常与旧requestId展示仍待验。 |

## P17 评分规则动作

| 动作 | 当前条件与行为 | 代表图 | 未完成 |
| --- | --- | --- | --- |
| `scoring.create.open` 打开新规则草稿 | canDecide；非ready顶部、empty首条和ready摘要slot三位置；不要求缺项；openCreate只清createError并showCreate=true；不resetForm，无busy守卫 | [桌面](design/scoring-direction-c/1440-empty.png) / [手机](design/scoring-direction-c/390-empty.png) | 三个入口不能省略；read/approve-only的当前仅可查看文案不代表没有审批能力；页面异常创建入口仍存在。 |
| `scoring.list.retry` 重读版本目录 | state非ready/empty；共享loading无操作，其他错误primary可触发；load GET /opportunity-score-rules；primary统一load，secondary未监听；成功不主动清message，失败不清旧rules | [桌面](design/scoring-direction-c/1440-versions.png) / [手机](design/scoring-direction-c/390-versions.png) | 当前48图无页面级全部错误/恢复图，引用只是相关列表；共享重新登录/返回工作台标签不是实际导航；旧GET结果归属未保护。 |
| `scoring.preview.open` 打开发布影响预览 | canApprove且draft/pending_approval/approved；函数canApprove且!previewing；loadPreview(rule,1)先设置目标/open/busy并清preview/error；GET /opportunity-score-rules/{id}/preview?page=1&page_size=20 | [桌面](design/scoring-direction-c/1440-preview.png) / [手机](design/scoring-direction-c/390-preview.png) | 关闭A读取中再请求B会早退；本轮隔离证实只发A且旧结果存入已关闭预览，不宣称B被读取。无read token/Abort，不当作安全切换已完成。 |
| `scoring.action.submit.open` 打开提交审批原因 | canDecide且draft；button无busy禁用，begin再校验能力但不验证rule.status；begin(rule,'submit')设置selected/action，清reason/targetRuleId/actionError并showAction=true | [桌面](design/scoring-direction-c/1440-submit.png) / [手机](design/scoring-direction-c/390-submit.png) | 不同生命周期需分别审查；打开不执行写入，须required原因及确认。服务端版本/状态/权限另验。 |
| `scoring.action.approve.open` 打开批准原因 | canApprove且pending_approval；button无busy禁用，begin再校验能力但不验证rule.status；begin(rule,'approve')设置selected/action，清reason/targetRuleId/actionError并showAction=true | [桌面](design/scoring-direction-c/1440-approve.png) / [手机](design/scoring-direction-c/390-approve.png) | 不同生命周期需分别审查；打开不执行写入，须required原因及确认。服务端版本/状态/权限另验。 |
| `scoring.action.reject.open` 打开拒绝原因 | canApprove且pending_approval；button无busy禁用，begin再校验能力但不验证rule.status；begin(rule,'reject')设置selected/action，清reason/targetRuleId/actionError并showAction=true | [桌面](design/scoring-direction-c/1440-reject.png) / [手机](design/scoring-direction-c/390-reject.png) | 不同生命周期需分别审查；打开不执行写入，须required原因及确认。服务端版本/状态/权限另验。 |
| `scoring.action.activate.open` 打开启用原因 | canApprove且approved；button无busy禁用，begin再校验能力但不验证rule.status；begin(rule,'activate')设置selected/action，清reason/targetRuleId/actionError并showAction=true | [桌面](design/scoring-direction-c/1440-activate.png) / [手机](design/scoring-direction-c/390-activate.png) | 不同生命周期需分别审查；打开不执行写入，须required原因及确认。服务端版本/状态/权限另验。 |
| `scoring.action.rollback.open` 打开回滚原因 | canApprove且active；button无busy禁用，begin再校验能力但不验证rule.status；begin(rule,'rollback')设置selected/action，清reason/targetRuleId/actionError并showAction=true | [桌面](design/scoring-direction-c/1440-rollback.png) / [手机](design/scoring-direction-c/390-rollback.png) | 不同生命周期需分别审查；目标仅列表approved/retired，旧active变rolled_back，目标active；不是历史评分回退。服务端版本/状态/权限另验。 |
| `scoring.create.close` 关闭创建草稿 | 标题/取消/Escape；busy时未锁；closeCreate关闭并清createError，保留全部form | [桌面](design/scoring-direction-c/1440-create-basics.png) / [手机](design/scoring-direction-c/390-create-basics.png) | 创建取消与生命周期重开清原因不是相同草稿规则；旧成功可能清新编辑，待实例归属验收。 |
| `scoring.create.submit` 保存正权重规则草稿 | canDecide且createValidation空；post全局busy守卫；native required/数值范围；POST /opportunity-score-rules {version_code,name,dimensions:weight>0,thresholds:{recommend_min,observe_min}}；成功关闭resetForm/load并提示仍需审批启用 | [桌面](design/scoring-direction-c/1440-create-basics.png) / [手机](design/scoring-direction-c/390-create-basics.png) | 源六阶段校验隔离通过，不预填业务值；仅初始八维编辑图，完整有效/失败/提交成功图缺失；维度成员对象引用与成功清理/后续load不在busy内待验。 |
| `scoring.preview.close` 关闭影响预览 | 标题/Escape无previewing锁；closePreview设置showPreview=false并清previewError；不取消GET，不清previewRule/preview | [桌面](design/scoring-direction-c/1440-preview.png) / [手机](design/scoring-direction-c/390-preview.png) | 旧GET仍能写preview；已隔离验证，不等于新目标被污染或真实数据库产生写入。 |
| `scoring.preview.retry` 重新试算第1页 | previewError分支按钮；loadPreview要求canApprove&&!previewing；loadPreview(previewRule)默认page=1，清旧内容再GET；不重试失败页码 | [桌面](design/scoring-direction-c/1440-preview-error.png) / [手机](design/scoring-direction-c/390-preview-error.png) | 仅第1页样本图，不覆盖真实第2页失败；missing_fields与page_summary.unchanged源模板未呈现，图也未穷尽缺失组合。 |
| `scoring.preview.previous` 预览上一页 | page<=1或previewing禁用；changePreviewPage(page-1)使用previewRule；loadPreview以page_size20重新试算；函数本身无页码边界校验 | [桌面](design/scoring-direction-c/1440-preview.png) / [手机](design/scoring-direction-c/390-preview.png) | 当前48图只有单页样本，不能用双禁用按钮证明实际第二页导航/返回及内容保持。 |
| `scoring.preview.next` 预览下一页 | page*page_size>=total或previewing禁用；changePreviewPage(page+1)；total与当前items长度分开，不保存试算 | [桌面](design/scoring-direction-c/1440-preview.png) / [手机](design/scoring-direction-c/390-preview.png) | 21条20/1的历史Vue合同测试存在但本轮未重跑，图稿缺真实多页内容；页摘要非全量影响。 |
| `scoring.action.close` 关闭生命周期原因 | 五变体标题/取消/Escape；busy期间可关闭；closeAction只关showAction并清actionError，reason/target/selected保留到下次begin清理；不取消POST | [桌面](design/scoring-direction-c/1440-submit.png) / [手机](design/scoring-direction-c/390-submit.png) | 旧请求成功可关闭新原因窗；全busy关闭与焦点契约仍待实际Vue验证。 |
| `scoring.action.submit` 提交五种生命周期动作 | selected必须存在；按钮busy禁用，post也防重；原因native required≤1000，rollback目标required；runAction无再次能力/状态校验；POST /opportunity-score-rules/{selected.id}/actions {action,reason,expected_revision,...rollback target_rule_id}；成功closeAction/load，再用当前action标签显示完成 | [桌面](design/scoring-direction-c/1440-submit.png) / [手机](design/scoring-direction-c/390-submit.png) | 隔离证实A approve等待时改B reject，旧body仍A/approve/revision3，成功关B并显示拒绝已完成；不是后端真的拒绝。未知post未写入文案非事务证据，成功重读失败也不冒充整链成功。 |

## 字段与弹窗必审项

P16五模型的限制和草稿逐条见JSON：input_kind切换保留input_value；ASIN十位字母数字，URL type=url不强制HTTPS/禁凭证/hash，服务独立验证；results为空才用first_result，单候选自动选，缺topic禁adopt。前端三个决定只发action/reason/selected_raw_evidence_id，不复制P18 expected_version。observe/reject恒null候选ID，可能返回验证任务。当前决定成功不清state错误，reset保留action/reason/requestId；图稿清错清草稿是尚未实施的提案。

P17新草稿阈值为null、权重0、required=false、evidence_group=other，不为绘图推断业务权重。版本/名称长度64/160，阈值0–100 step0.01且推荐大于观察，至少两维正权重、合计按两位舍入100、至少一正权重维度必填。取消保留草稿，成功才reset。八维分区和手机维度选择不是新增八个业务弹窗。

五生命周期共用原因required≤1000；rollback另选approved/retired目标，begin清原因/目标，close只清错误。批准不生效，启用改变活动版本，回滚启用目标但不改历史评分；源没有单独停用按钮。POST busy守卫存在，但关闭/新begin和成功后的load没有统一实例保护。预览只读第20条分页、summary为当前页，缺失值不填0；当前源未显示missing_fields和unchanged摘要，图稿“样本未列出”不等于覆盖真实有值缺失字段。

## 本轮新增证据与实施验收卡

| 边界 | 实际源码隔离结果 | 必须补验 |
| --- | --- | --- |
| P16在途创建 | create后deactivate，再释放202：active=false，仍更新journey并写一次内存替身活动ID；没有安排timer | 不可把GET归属修复当POST也安全；真实KeepAlive/范围切换/其他页或标签活动ID不能被旧返回覆盖 |
| P16旧草稿/错误 | 永久助手再次确认decide成功仍error、reset保留旧原因；三种创建原body、三种决定候选ID及非法URL拒绝均按源执行 | 成功清错、开始下一次草稿策略及字段关联待获审实施；不改变持久化格式 |
| P17迟到动作 | A/revision3 approve请求等待时close再begin B reject；body仍A/approve/原原因，成功却关B并显示“拒绝已完成” | 本次动作/目标快照与结果归属、错误归属和重读结果分别验证；不能宣称服务真的执行了reject |
| P17预览重开 | A GET等待中关闭再请求B，由previewing早退；最终仍A目标/结果且窗关闭，只发一次GET意图 | 保留单飞意图不等于B已打开；补关闭/重开/失活/重试页/请求后分页验收 |
| P17规则校验 | 实际computed经过缺阈值、阈值相等、少于两维、权重90、缺必填、合法六阶段；create仅发送两正权重维度 | 这是惰性源计算/POST替身，不是持久化或完整服务校验；不替代真实审批/queueAll/历史不变证明 |

全部检查在惰性VM中使用合成ID/Promise/内存存储替身，零实际HTTP/SQL/localStorage/浏览器。旧原型与真实Vue E2E引用保留其原证据边界，本轮未重跑未变浏览器/产品测试。最小清单校验已通过当前源hash、合同完整别名、38候选无漏项、14模型、11结构/37关联；不能升级为页面运行通过。

## 尚待决定与交付

P16 J07：当前仓库旅程adopt直接写adopted，未遵守P18五质量门。用户已选择统一，实施需复用P18同一规则与质量门；采纳成功图仍未交付，不偷换成仅建pending。现有GET还可能登记超时blocked事件，零前端POST不等于数据库纯只读。下一优先实施此已授权规则，其他设计审核继续。

P17当前48图缺：列表全部异常恢复、有效完整创建/成功失败、真实多页预览与有值missing_fields、五动作各自失败/长原因和完整主题密度。P16采纳成功/机会链接、两页逐控件六态、完整权限与生命周期也未完成。下一P19/P20源语义及已有缺图；具体稿获审后再进入Vue实现与实际业务验证。全站19页局部语义、54页待同级核对，不是19页已签收。

无API/OpenAPI、后端/Worker/Python、数据库/迁移、权限、env/参数、依赖或宝塔部署修改，无需配置/重启。没有临时文件或服务；JSON/本文为永久审核资料，提交与最终门禁见[PROGRESS](PROGRESS.md)。
