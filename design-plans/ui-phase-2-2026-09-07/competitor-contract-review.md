# P19/P20 竞品列表与规则合同复核

2026-09-09增量实施：见[CP-B02/B03结果归属修复](COMPETITOR-BOUNDARY-REVIEW.md)。Vue现在使用读代次拒绝旧列表/详情的成功与失败回调，采集固定提交对象并按对象保存待确认任务，原对象外不展示其反馈或启动轮询；卸载清理读代次/待确认项。API/表单/权限/业务字段及template均未变。以下行号与SHA为首次核对历史位置，稳定候选签名仍可追踪当前源；CP-G04/05仅上述部分已修，其余KeepAlive/history/scope、弹窗并存、删除与规则重入缺口保持待验。

2026-09-07；规格/源码合同与隔离Vue验证，不是正式设计或生产验收。产品核对HEAD ff615e3（最近产品变更060e0b5）；CompetitorMonitor.vue的LF源码SHA256为49653e9dbc80617d96f77ac5c89e8a7580d0e732fbe8e54e17ed58757281c0c7。当前工作树清单绑定060e0b5，全局指纹caf0574f33b1c91a446e6a7784bc954fc6d926d44ba5b349df538190304eff8d；其余旧图是否有效需E01校验，不能由本合同推定。

## 1. 真实入口与边界

config/route-catalog.json → NavigationShell.vue → navigation-shell-route-state.ts surfaceProps → CompetitorMonitor.vue。P19为list、P20为rules，均competitor:read、reset_on_scope；同一组件的静态导入归属[P19,P20]是超集，不能给每项动作自动乘以2。API使用api-client，后端competitor-routes→competitor-service→mysql-competitor-repository；创建验证任务走business-task-routes的task:create，不继承competitor:manage。

复核36个本地控件/事件候选、3个弹窗定义、10处v-model。这里只归并本组件和实际共享状态入口，不声称全站壳层/动态角色分母已冻结。旧源码映射仍按actions/dialogs生成记录保留，人工结论在本文独立维护，不把生成物reviewStatus直接改passed。

## 2. 候选到语义动作映射

下表candidate后缀均以`apps/web/src/components/CompetitorMonitor.vue#`为前缀。行号/SHA绑定本次源码；重复桌面/移动入口保留独立来源但共享业务语义。

| 行 | candidate后缀 | 语义ID / 页面 | 行为 |
| --- | --- | --- | --- |
| 651 | 92a11027f1dd1f3c.1 | CP-RULE-OPEN / P20 | 管理者页首新建/首条规则 |
| 654 | d17349bf034941db.1 | CP-RULE-BACK / P20 | RouterLink /competitors |
| 657 | f006bd8812c49ea9.1 | CP-STATE-PRIMARY/SECONDARY / P20 | 按状态恢复或导航，两个事件分别验 |
| 688 | 5c8a7bc537511253.1 | CP-RULE-OPEN / P20 | 真空规则列表的新建入口 |
| 701 | 056cc0832d94cfb3.1 | CP-RULE-NAV / P19 | 无启用规则且manager时进入P20 |
| 709 | 4fe322a77ae77170.1 | CP-CREATE-OPEN / P19 | 有启用规则的页首创建 |
| 712 | 9e3339029c06290e.1 | CP-CREATE-OPEN / P19 | 无启用规则的次级创建 |
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
| 1058 | 0effcb12f0e7344b.1 | CP-RULE-SUBMIT / 规则表单 | POST明确阈值 |
| 1064 | ad5c3e206797e35f.1 | CP-RULE-CLOSE / 规则表单 | 关闭且去competitor query |
| 1107 | c40c87a6e5ef3e66.1 | CP-RULE-CLOSE / 规则表单 | 取消同合同 |
| 1108 | 108089b4d17a2d6e.1 | CP-RULE-SUBMIT / 规则表单 | busy禁用的submit |
| 1119 | 33765167c1ac37f5.1 | CP-DELETE-SUBMIT / 删除表单 | DELETE + trim原因/revision |
| 1125 | 8436b1677c6263f6.1 | CP-DELETE-CLOSE / 删除表单 | 删除选择归null，无DELETE |
| 1147 | a94cde21d7759e06.1 | CP-DELETE-CLOSE / 删除表单 | 取消同合同 |
| 1148 | 9d23c498e72940a2.1 | CP-DELETE-SUBMIT / 删除表单 | busy禁用的submit |

v-model分别为695 query；954 URL、962 market、970 opportunity_id、978 title；1037规则目标、1044 metric、1051 direction、1061 threshold；1105 deleteReason。全局keydown还支持Escape按删除→规则→创建顺序关闭，不在36个模板候选中；需单独验键盘及缓存生命周期，不能漏计。

UiStatePanel primary：empty+manager打开当前模式创建，expired到/login?return_to=当前fullPath，forbidden到/home，其余load。secondary：empty+manager load、empty只读/home、error history.back，其余/home。共用事件根据实际状态展开，不把一个候选视为一种固定副作用。

## 3. 弹窗、字段与请求合同

| 语义dialogId | 来源行/candidate后缀 | 变体与关闭 |
| --- | --- | --- |
| CP-CREATE | 929 / de57fe420db167ea.1 | 三步；无/有机会ID；字段非法、busy、失败/重试；取消归step1但实例字段保留 |
| CP-RULE | 1018 / b3cda3ddc35e3a69.1 | 全局/指定对象×数值/库存；方向约束、数值0/小数、错误/busy；取消清query，新打开重置默认 |
| CP-DELETE | 1080 / 9d3c873673ab0556.1 | 原因空白/有效、当前/冲突revision、失败/重试；取消不写、重开清原因；现缺可访问名称 |

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
| CP-G01 | 三个role=dialog没有统一焦点约束/归还；删除窗缺aria-labelledby；步骤推进未安排新字段焦点 | 增加先失败的实际键盘/焦点用例，按已有modal原语最小实现；三窗、步骤、Escape、错误首焦点与所有打开方式通过 |
| CP-G02 | applicableRules未筛enabled却标生效；ruleText从selected币种显示所有价格规则；list模式规则GET失败静默置空 | 用混合状态/不同币种/读取失败真实合同夹具复现；只修事实呈现，不新增币种字段或更改阈值算法；规则异常不能伪装无规则 |
| CP-G03 | API只返回最新100快照，UI末项被标为最早基线；旧蓝图“最早”与窗口边界有差异 | 超过100快照证据确定预期；先明确展示措辞还是需要后端基线合同，不自行扩大查询上限或改持久结构 |
| CP-G04 | KeepAlive下仅unmounted清timer；load/detail无读版本与abort；query没有路由反向同步 | 复现离开/返回、scope切换、多对象迟到200/404、history；旧读不覆盖当前对象，停用不继续轮询，恢复按当前范围读取 |
| CP-G05 | post/remove无函数级busy guard；窗口可在提交期间关闭，成功回调仍操作当前选择；query可使异常表单并存 | 覆盖双击/Enter、关闭重开、切对象/范围及迟到响应；保留服务端任务真实状态，不把关窗等同撤销写入 |
| CP-G06 | 删除成功先设notice后load清notice；失败副作用表述可能强于证据 | 补成功删除/刷新失败及网络不确定性测试；清楚区分已保存、读取失败、未知结果，不通过乐观文案掩盖 |
| CP-G07 | 缺少页面最终图、全角色/真实后端、辅助技术、三主题/两密度与生产链 | 依PLAN逐页出图审核、实现及真实验收，绑定正确版本；用户签收前不标完成 |

本批不修改以上产品行为；按E03先交付事实规格和局部合同，实际修复逐项复现后单独实施。需改变业务/API/持久化边界时提交精确影响供用户决定，其余局部可逆修复按既有授权继续。P19/P20下一轮不能仅追加测试数量，必须逐项推进这些缺口或正式设计交付。
