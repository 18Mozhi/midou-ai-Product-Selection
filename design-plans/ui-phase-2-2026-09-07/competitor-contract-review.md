# P19/P20 竞品列表与规则合同复核

2026-09-09增量实施：见[CP-B02/B03结果归属修复](COMPETITOR-BOUNDARY-REVIEW.md)。Vue现在使用读代次拒绝旧列表/详情的成功与失败回调，采集固定提交对象并按对象保存待确认任务，原对象外不展示其反馈或启动轮询；卸载清理读代次/待确认项。API/表单/权限/业务字段及template均未变。以下行号与SHA为首次核对历史位置，稳定候选签名仍可追踪当前源；CP-G04/05仅上述部分已修，其余KeepAlive/history/scope、弹窗并存、删除与规则重入缺口保持待验。

2026-09-28增量实施；规格/源码合同与隔离Vue验证，不是正式设计或生产验收。当前 `CompetitorMonitor.vue` LF SHA256 为 `803f24f65034b6943cdda4974d7bd0de8dd91b3cb93b86f065e140dbab811318`；P19/P20动作映射源指纹已同步。CP-G01键盘/焦点、CP-G02事实呈现及本次CP-G04读取生命周期/路由query已由下方记录逐项跟踪；不代表全部设计、权限或生产通过。当前工作树清单绑定历史HEAD 060e0b5、全局指纹caf0574f33b1c91a446e6a7784bc954fc6d926d44ba5b349df538190304eff8d；其余旧图是否有效需E01校验，不能由本合同推定。

2026-09-27 CP-G02修复：列表页规则GET失败现在保留“规则状态暂不可用”而不是伪装为0条；详情不展示0条生效规则，并可只重读规则。详情生效数只含`status=enabled`且作用域匹配的全局/当前竞品规则。价格规则不再借用当前选中币种：全局规则标“规则未记录币种”，指定对象规则注明币种来自对应目标的最新快照；未采到币种如实显示。未增加规则币种字段、API、阈值算法或写入。`tests/e2e/m04-05-competitors.spec.ts`覆盖混合状态/不同目标币种和读取失败恢复，桌面与390px各23项通过。CP-G02局部关闭；CP-G03–G07及真实RBAC、业务数据与生产验收仍开放。

## 1. 真实入口与边界

config/route-catalog.json → NavigationShell.vue → navigation-shell-route-state.ts surfaceProps → CompetitorMonitor.vue。P19为list、P20为rules，均competitor:read、reset_on_scope；同一组件的静态导入归属[P19,P20]是超集，不能给每项动作自动乘以2。API使用api-client，后端competitor-routes→competitor-service→mysql-competitor-repository；创建验证任务走business-task-routes的task:create，不继承competitor:manage。

复核36个本地控件/事件候选、3个弹窗定义、10处v-model。这里只归并本组件和实际共享状态入口，不声称全站壳层/动态角色分母已冻结。旧源码映射仍按actions/dialogs生成记录保留，人工结论在本文独立维护，不把生成物reviewStatus直接改passed。

## 2. 候选到语义动作映射

下表candidate后缀均以`apps/web/src/components/CompetitorMonitor.vue#`为前缀。行号/SHA绑定本次源码；重复桌面/移动入口保留独立来源但共享业务语义。

| 行 | candidate后缀 | 语义ID / 页面 | 行为 |
| --- | --- | --- | --- |
| 651 | 1b193ec9f175425c.1 | CP-RULE-OPEN / P20 | 管理者页首新建/首条规则 |
| 654 | d17349bf034941db.1 | CP-RULE-BACK / P20 | RouterLink /competitors |
| 657 | f006bd8812c49ea9.1 | CP-STATE-PRIMARY/SECONDARY / P20 | 按状态恢复或导航，两个事件分别验 |
| 688 | 5c8a7bc537511253.1 | CP-RULE-OPEN / P20 | 真空规则列表的新建入口 |
| 701 | 0d2355591b57c284.1 | CP-RULE-NAV / P19 | 无启用规则且manager时进入P20 |
| 701 | 6f1c1026f48433b0.1 | CP-RULE-READ-RETRY / P19 | 只重读规则GET，不写入 |
| 709 | c626005c766fe7b8.1 | CP-CREATE-OPEN / P19 | 有启用规则的页首创建 |
| 712 | ec64e194fee06bf8.1 | CP-CREATE-OPEN / P19 | 无启用规则的次级创建 |
| 715 | 908bdb9143e5350e.1 | CP-RULE-NAV / P19 | 包含只读者的规则入口 |
| 732 | 8d078d22d63338ea.1 | CP-STATE-PRIMARY/SECONDARY / P19 | 空态manager创建，其他恢复/导航 |
| 741 | ec3b988601b97577.1 | CP-SEARCH-CLEAR/EMPTY-SECONDARY / P19 | 清搜索；manager创建或只读刷新 |
| 753 | 0832ce1b3b353933.1 | CP-DETAIL / P19 | v-for实际对象逐项读取、选中及URL |
| 773 | e39ead97fb52b914.1 | CP-SOURCE / P19 | 新窗口打开真实商品URL |
| 778 | 3d04d80f54cd9d35.1 | CP-COLLECT / P19 | 管理者、active、无busy/pending可执行 |
| 793 | 301ee04052a2735e.1 | CP-RULE-NAV-CURRENT / P19 | 带当前competitor进入P20 |
| 795 | d176f11e3e762c47.1 | CP-TOGGLE / P19桌面 | status/revision启停 |
| 797 | 219a5337696882de.1 | CP-DELETE-OPEN / P19桌面 | 选择删除对象并清原因 |
| 802 | 6bc70845bac2b99a.1 | CP-MORE / P19移动 | 原生details开合 |
| 803 | d176f11e3e762c47.2 | CP-TOGGLE / P19移动 | 与桌面同一合同，独立可达性 |
| 805 | 219a5337696882de.2 | CP-DELETE-OPEN / P19移动 | 同上，不能漏移动入口 |
| 858 | c14a7d89545c4bbd.1 | CP-SOURCE-FIRST / P19 | 无快照时外部来源补充入口 |
| 917 | 3edcc1c1730d78dd.1 | CP-TASK-LINK / P19 | 本次已建任务/tasks?task=id |
| 921 | 9f03a53fb65e7c6b.1 | CP-TASK-CREATE / P19 | task:create，按变化建验证任务 |
| 952 | 9deedc4f8d67733e.1 | CP-HELP / P19 | 原生帮助details开合 |
| 969 | e6be6aad71e6c32f.1 | CP-CREATE-STEP/SUBMIT / 创建表单 | 前两步本地，第三步POST |
| 975 | 933d6f0c73f9a623.1 | CP-CREATE-CLOSE / 创建表单 | 关闭、step归1、去create query |
| 1041 | 76ebcf7c57bc49e4.1 | CP-CREATE-CLOSE / 创建表单 | 第一步取消 |
| 1043 | 4ae114e438c807d5.1 | CP-CREATE-PREVIOUS / 创建表单 | 第2/3步本地回退 |
| 1044 | d32ececd9e3b4c22.1 | CP-CREATE-STEP/SUBMIT / 创建表单 | submit按钮，表单handler驱动 |
| 1051 | 225c721c3e09266a.1 | CP-CREATE / P19 | 三步；无/有机会ID；字段非法、busy、失败/重试；取消归step1但实例字段保留 |
| 1051 | 0a5942425b87d8da.1 | CP-CREATE-OPEN/CLOSE / P19 | 原生具名dialog；cancel与Tab边界键盘事件 |
| 1058 | 0effcb12f0e7344b.1 | CP-RULE-SUBMIT / 规则表单 | POST明确阈值 |
| 1064 | ad5c3e206797e35f.1 | CP-RULE-CLOSE / 规则表单 | 关闭且去competitor query |
| 1107 | c40c87a6e5ef3e66.1 | CP-RULE-CLOSE / 规则表单 | 取消同合同 |
| 1108 | 108089b4d17a2d6e.1 | CP-RULE-SUBMIT / 规则表单 | busy禁用的submit |
| 1141 | 9538d57155059acf.1 | CP-RULE / P20 | 全局/指定对象×数值/库存；方向约束、数值0/小数、错误/busy；取消清query，新打开重置默认 |
| 1141 | eaaea75753101b7d.1 | CP-RULE-OPEN/CLOSE / P20 | 原生具名dialog；cancel与Tab边界键盘事件 |
| 1119 | 33765167c1ac37f5.1 | CP-DELETE-SUBMIT / 删除表单 | DELETE + trim原因/revision |
| 1125 | 8436b1677c6263f6.1 | CP-DELETE-CLOSE / 删除表单 | 删除选择归null，无DELETE |
| 1147 | a94cde21d7759e06.1 | CP-DELETE-CLOSE / 删除表单 | 取消同合同 |
| 1148 | 9d23c498e72940a2.1 | CP-DELETE-SUBMIT / 删除表单 | busy禁用的submit |
| 1204 | 6a4b5c16df993837.1 | CP-DELETE / P19 | 原因空白/有效、当前/冲突revision、失败/重试；取消不写、重开清原因；已用标题关联提供可访问名称 |
| 1204 | ef60f454df6c8376.1 | CP-DELETE-OPEN/CLOSE / P19 | 原生具名dialog；cancel与Tab边界键盘事件 |
| 1219 | 9738acdb81108bf8.1 | CP-DELETE-CLOSE / 删除表单 | 删除选择归null，无DELETE |
| 1241 | 5433acf9dddc7c6a.1 | CP-DELETE-CLOSE / 删除表单 | 取消同合同 |

v-model分别为695 query；954 URL、962 market、970 opportunity_id、978 title；1037规则目标、1044 metric、1051 direction、1061 threshold；1105 deleteReason。全局keydown还支持Escape按删除→规则→创建顺序关闭，不在36个模板候选中；需单独验键盘及缓存生命周期，不能漏计。

UiStatePanel primary：empty+manager打开当前模式创建，expired到/login?return_to=当前fullPath，forbidden到/home，其余load。secondary：empty+manager load、empty只读/home、error history.back，其余/home。共用事件根据实际状态展开，不把一个候选视为一种固定副作用。

## 3. 弹窗、字段与请求合同

| 语义dialogId | 来源行/candidate后缀 | 变体与关闭 |
| --- | --- | --- |
| CP-CREATE | 929 / de57fe420db167ea.1 | 三步；无/有机会ID；字段非法、busy、失败/重试；取消归step1但实例字段保留 |
| CP-RULE | 1018 / b3cda3ddc35e3a69.1 | 全局/指定对象×数值/库存；方向约束、数值0/小数、错误/busy；取消清query，新打开重置默认 |
| CP-DELETE | 1204 / 6a4b5c16df993837.1 | 原因空白/有效、当前/冲突revision、失败/重试；取消不写、重开清原因；已用标题关联提供可访问名称 |

URL与字段maxlength/pattern见P19/P20。通用post设置busy及notice，finally恢复busy；没有底层early-busy guard，DOM禁用不证明所有竞态已解决。关闭表单不是取消服务器操作，不能把失败文案“未写入”当作网络异常下的事务证明。

| 语义操作 | 实际请求（省略统一/api/v1前缀） | 必要保持项 |
| --- | --- | --- |
| 创建竞品 | POST /competitors；market/product_url/title；opportunity_id仅非空时加 | 不由前端推导provider/source/external_id；服务端验证并排队 |
| 立即采集 | POST /competitors/{id}/collect；{} | 返回task_id/status供轮询；不把accepted当成功快照 |
| 暂停/恢复 | POST /competitors/{id}/actions；status/expected_revision | active↔paused；冲突由服务端拒绝 |
| 删除 | DELETE /competitors/{id}；expected_revision/reason.trim() | 服务端deleted_at/status=paused/revision+1，历史不删 |
| 新规则 | POST /competitor-monitor-rules；competitor_id/null、metric、direction；仅数值加threshold_value | 不添加currency、revision、status或权限字段；服务端enabled/revision1 |
| 验证任务 | POST /tasks；title最多200、description、priority=high、due_at=null | description锁定竞品、change、字段、变化、证据和时间；不改快照 |

API路由写入均经同源、session scope、capability、幂等键；api-client写入不自动重试，每次用户重试独立产生键，测试只断言存在，不声称跨点击去重。取消和GET不持久写入本页业务，但跨页面目的地可能发请求。所有实际生产写入仍需隔离对象与清理方案。

## 4. 永久回归及证据口径

扩展现有tests/e2e/m04-05-competitors.spec.ts，复用原setup/item/envelope，不复制一套实现。新增7个实例：CP01×1、CP02×2、CP03×1、CP04×1、CP05×1、CP06×1；与原11例共18。准确执行结果记录PROGRESS，不由文档把计划用例标passed。

- UI2-CP01：创建前两步/关闭零写入、字段在实例内保留、409保留确认步、显式重试POST的精确字段及幂等键。
- UI2-CP02：库存指定对象不发送阈值，数值全局发送null目标和number阈值；409保留输入，成功模拟关窗并反馈。
- UI2-CP03：删除取消零写入，重开原因清空，409原因保留，DELETE使用trim及当前revision；未覆盖删除成功事务。
- UI2-CP04：暂停态按钮禁用，恢复请求传revision7，冲突后仍不能采集；不声称已执行实际来源采集。
- UI2-CP05：规则取消去深链query、再次新建恢复全局/price/decrease/1；关闭零写入。
- UI2-CP06：没有competitor:manage但有task:create可按变化创建任务；准确title/description/priority/due_at，单条变化转成真实合同链接；没有访问目标任务页面。

fixture响应不模拟持久化写后列表，成功关窗不等于数据库提交。取消零写入结论来自捕获本页API写请求，不是数据库审计。既有轮询与只读测试复用，但真实RBAC、组织隔离、Outbox、通知、事务、源条款及公开采集另验。

## 5. 未关闭项与退出条件

以下是当前源码可定位缺口或待验证风险，不把未复现项称为已确认运行缺陷。不得因本批18例通过删除这些项。

| ID | 当前证据/风险 | 后续退出条件 |
| --- | --- | --- |
| CP-G01 | 已按本批接入项目 `useModalDialog` 原生模态原语；三窗具名、Tab/Shift+Tab 边界循环、Escape/关闭返焦、创建步骤焦点迁移和错误首焦点均有真实 Vue 回归 | 实际 Vue E2E `UI2-CPG01` 覆盖按钮与 query 打开、三类弹窗的错误恢复与关闭；桌面/手机完整 M04-05 结果见 `PROGRESS.md`。仅关闭键盘/焦点子项，不代表全部弹窗视觉组合、读屏、真实写入或生产权限验收 |
| CP-G02 | **已关闭（2026-09-27）**：详情仅计启用且作用域适用规则；价格币种注明来自指定目标最新快照或规则未记录；列表规则读取失败有独立反馈与只读重试 | 实际Vue桌面/手机E2E覆盖全局、不同目标USD/CAD、停用目标规则与列表读取失败/只重试GET；不代表真实API/权限或生产验收 |
| CP-G03 | **局部修正（本地Vue）**：API仍只返回最近100条；超过窗口时页面将末项标为“窗口最早快照”，并明确它不是全部历史的首个基线。全历史首个基线仍未由详情API提供 | 101条计数/100条返回的真实Vue桌面与390px E2E 验证了窗口边界文案；不扩查询、不改API/存储。若要展示真正的历史首个基线，须另行明确并评审API契约，不在本视觉批次擅自扩大 |
| CP-G04 | **已关闭（2026-09-28，本地Vue合同）**：KeepAlive停用会清理采集详情轮询并使在途GET代次失效；重新激活按当前URL/scope重读。竞品、搜索、创建及规则query均能从路由变化反向同步到页面状态；现有A→B及A→B→A旧成功/404保护继续保留 | `UI2-CP-G04`桌面与390px覆盖缓存离开超过轮询周期/返回重读、detail query切换、搜索query、创建/规则表单开闭；完整30项竞品/并发套件双端通过。scope reset由`reset_on_scope`缓存键切换触发旧实例卸载；真实登录会话/跨组织RBAC仍独立待验 |
| CP-G05 | **局部修复（2026-09-28）**：公共POST与create/remove/createRule/toggle/task入口函数级防重；创建/规则/删除按弹窗代次、删除按目标ID归属回执。创建/删除中关闭不撤销已发请求，旧成功通过页面状态提示，不覆盖新表单/对象。P20双query并窗仍待处理 | 桌面/390px实际Vue用例覆盖重复form submit、创建关窗重开、A删除等待中切B并重开删除窗；源码验证器确认只发一条规则POST。不能据此宣称P20双query语义、真实HTTP幂等、后端任务/数据库、权限或生产验收通过 |
| CP-G06 | **本地Vue已修复**：删除写入成功与列表重读结果分开；刷新失败提示“删除已确认、列表未更新”，网络无响应时说明结果未知并要求关闭弹窗重读后再操作 | 双端回归覆盖DELETE成功/GET失败与DELETE网络中断；隔离API不代表真实数据库或服务端审计。真实生产/RBAC仍未验收 |
| CP-G07 | **密度子项已局部接入（2026-09-28）**：P19/P20真实Vue样式接入项目标准/紧凑间距 token，操作按钮最小高度保持44px；真实Vue测试验证桌面与390px下间距变化。 | 页面最终图与余下视觉、全角色/真实后端、辅助技术、三主题，以及生产链仍待逐项审核验收；本次代码与E2E不代表CP-G07或P19/P20整体关闭 |

CP-G03本轮修正了被截断快照窗口的标签与说明，但未解决全历史首个基线未被详情API提供的问题。此前CP-G04完成KeepAlive读取生命周期与路由query回显；CP-G05仍有异常双query优先级未决。CP-G06已在本地Vue区分删除已确认后的刷新失败与写入结果未知；CP-G07及余下弹窗、生产证据仍须推进。需改变业务/API/持久化边界时先评审精确影响，其余局部可逆修复按用户“剩余视觉自动通过”授权继续；P19/P20不能仅追加测试数量，必须推进剩余缺口或正式设计交付。
