# P25/P26 审批、通知动作与弹窗合同

2026-09-08通知设计增量：[P26 NOTIFICATION-C-r1](design/notification-direction-c/README.md)98图。源Vue函数/校验器验证六类body、自动read/已读不写、query/closeDetail/来源；惰性SQL检查list先分组再分页、summary与markAll接收范围，SSE适配器检查失效回读和重连守卫，均未访问实际服务。白收件箱与正文/处理分区、两窗顶部错误和手机首屏为新提案；偏好忙碌取消可关、详情忙碌不可关保留源码差异。原夹具独立响应不造一致快照，扩展态显式合成。没有修改真实Vue、AN-G02/G03/G05/G06结论、邮件/权限或审核；后续仍需真实API/数据库/并发/SSE/全主题密度与生产签收。

2026-09-08设计增量：[P25 APPROVAL-C-r1](design/approval-direction-c/README.md)94图。源函数VM复现AN-G01全部刷新回pending、模板/发起/发布失败写页级notice；五body、字段校验器、compare diff和两scope SQL构造有惰性验证，未接DB。宽阅读/四窗、显式空筛选、就近错误、固定标题为原型提案，不修改真实Vue、候选/旧图、权限/升级规则或AN-G关闭状态。原夹具版本、升级与同ID名称差异明示；P26通知及完整审核/实现/生产继续待办。

2026-09-07，PLAN 1.10 F02。从a4e0eed干净工作树开始，先读AGENTS→Feature Map的approvalWorkflow/notifications/realtimeSse→蓝图6.3→真实Vue/路由/服务/仓储与既有测试。本文是局部源码合同，不是最终设计、冻结后的全站动作分母或生产通过证明。

## 1. 来源与口径

入口：apps/web/src/components/ApprovalWorkspace.vue（AW）、ApprovalQueuePanel.vue（AQ）、NotificationCenter.vue（NC）；辅助approval-workspace-types.ts、use-modal-dialog.ts、api-client.ts、approval-workspace.css、notification-center.css和realtime-client-metrics.ts。服务链为apps/api/src/{approval,notification}-{routes,service}.ts及mysql-{approval,notification}-repository.ts；M05-04只失效通知并重新读取，不推断采集或审批已完成。

三组件scanSource共65个候选：59控件/事件、6弹窗定义，17处v-model；动态v-for不按当前示例条数膨胀。候选sig不是业务actionId，需与下表角色/handler/真实状态结合。旧全站1377/100仍为历史候选口径。本批源修复不更改API、权限、SQL、审批门槛、邮件Provider、依赖或环境变量。

## 2. 逐源码候选映射

候选完整ID为`apps/web/src/components/<文件名>#<sig>`，下表保留当前行号辅助定位；稳定业务ID为AN-A-*审批、AN-N-*通知、AN-TECH技术展开。D标记弹窗定义，不作为额外业务动作。父组件的队列事件与子组件具体入口共享业务语义，不双计。

| 文件 | 行 | sig | 稳定语义 / 实际行为 |
| --- | --- | --- | --- |
| AW | 443 | fe72f1f58d04daa7.1 | AN-A-TEMPLATE-OPEN；管理模板 |
| AW | 446 | e11c8bef75450e78.1 | AN-A-REQUEST-OPEN；已发布模板后发起 |
| AW | 447 | 21acc635baa945ea.1 | AN-A-TEMPLATE-OPEN；首模板入口 |
| AW | 454 | 1c008f867673db60.1 | AN-TECH；页级requestId |
| AW | 501 | fa9213ee10c4bdaa.1 | AN-A-LOAD；错误重读 |
| AW | 503 | 8b14c8822fa2158e.1 | AN-A-QUEUE/FILTER/DETAIL/REQUEST-OPEN/TEMPLATE-OPEN；父委托 |
| AW | 524 | 59336a98bd70e13c.1 | AN-A-NOTICE-CLOSE；仅清详情错误 |
| AW | 527 | c4a35037858480fb.1 | AN-A-PAGE；上一页 |
| AW | 529 | a0fa8a0a8fe3a4f1.1 | AN-A-PAGE；下一页 |
| AW | 531 | 1e3aa75fca121f17.1 | D-AN-APPROVAL；详情原生模态 |
| AW | 531 | 1dba0cb0b0844a3c.1 | AN-A-CLOSE/FOCUS；cancel、遮罩边界、Tab循环 |
| AW | 540 | ed72f74cfb2fdb73.1 | AN-A-CLOSE；关闭详情、清approval |
| AW | 545 | 618d905faa5eb354.1 | AN-A-NAV-RESOURCE；decision_context真实route |
| AW | 551 | 5201b6777ca22abe.1 | AN-A-NAV-RETURN；限定通知返回 |
| AW | 678 | 861502a87911f91f.1 | AN-A-NAV-EVIDENCE；逐requirement真实route |
| AW | 774 | 86c54779008e879e.1 | AN-A-DECIDE-REJECT；当前版本+原因 |
| AW | 776 | 3cfff8f4c2f74d66.1 | AN-A-DECIDE-APPROVE；当前版本+原因 |
| AW | 781 | 1c008f867673db60.2 | AN-TECH；资源/节点编号 |
| AW | 802 | 21471c244422699b.1 | D-AN-TEMPLATE；模板草稿 |
| AW | 802 | e5e612ec729070f4.1 | AN-A-TEMPLATE-CLOSE；Escape |
| AW | 807 | a85a9e0937dede29.1 | AN-A-TEMPLATE-SUBMIT/INVALID；POST草稿、展开必填 |
| AW | 825 | 5f8fcd4eeb82af58.1 | AN-A-TEMPLATE-FIELDS；审批人与超时接收人展开 |
| AW | 844 | 33ba0693d19eb13e.1 | AN-A-TEMPLATE-CLOSE；取消保留草稿 |
| AW | 845 | 19071354ae303ee4.1 | AN-A-TEMPLATE-SUBMIT；原生submit |
| AW | 854 | c02233bb6662b1ab.1 | AN-A-PUBLISH-OPEN；仅draft条目 |
| AW | 858 | e6808d6bed4a59f1.1 | D-AN-PUBLISH；版本与原因 |
| AW | 858 | 27fc15dca539791e.1 | AN-A-PUBLISH-CLOSE；Escape清目标/原因 |
| AW | 859 | 132a2f4c870f90da.1 | AN-A-PUBLISH-SUBMIT；POST reason/expected_revision |
| AW | 875 | 227faf6f0cfb499d.1 | AN-A-PUBLISH-CLOSE；返回清目标 |
| AW | 876 | d5e7aa36e90f904e.1 | AN-A-PUBLISH-SUBMIT；原生submit |
| AW | 880 | 5eec193b0a9499f7.1 | D-AN-REQUEST；发起审批 |
| AW | 880 | a05288e1768f6320.1 | AN-A-REQUEST-CLOSE；Escape |
| AW | 881 | 1c352b89a4148f40.1 | AN-A-REQUEST-SUBMIT/INVALID；POST、展开必填 |
| AW | 897 | bfb5c0c0da487c90.1 | AN-A-REQUEST-FIELDS；资源编号展开 |
| AW | 902 | 74e09fbb8250bf10.1 | AN-A-REQUEST-CLOSE；取消保留草稿 |
| AW | 903 | 0afc0196f9054ef3.1 | AN-A-REQUEST-SUBMIT；原生submit |
| AQ | 35 | 6880c779fd5e9fc3.1 | AN-A-QUEUE；decidable |
| AQ | 38 | 216e8feb5a6089d0.1 | AN-A-QUEUE；requested |
| AQ | 43 | 473bb9f13020ffe6.1 | AN-A-FILTER；四状态按钮 |
| AQ | 59 | 64616041c6d5fc5e.1 | AN-A-REQUEST-OPEN；空队列有模板 |
| AQ | 62 | 3f91c4917c0bca2a.1 | AN-A-TEMPLATE-OPEN；空队列无模板 |
| AQ | 68 | 134055fa33da350e.1 | AN-A-DETAIL；每个真实审批对象 |
| NC | 401 | 9b4302ca61b627ec.1 | AN-N-PREF-OPEN；busy禁用 |
| NC | 402 | fd5620d41b8a74b5.1 | AN-N-ALL-READ；当前接收范围全部 |
| NC | 408 | 1c008f867673db60.1 | AN-TECH；页级requestId |
| NC | 427 | bfefb7250e532e63.1 | AN-N-FILTER-CATEGORY；五项 |
| NC | 441 | cafe657338aefab6.1 | AN-N-UNREAD；URL unread=1/API true |
| NC | 445 | 106ed8618827fe65.1 | AN-N-FILTER-STATUS；四项 |
| NC | 480 | 6a22c249121aeb4d.1 | AN-N-LOAD；重读列表/summary/preferences |
| NC | 487 | d953dfdf4cb40b85.1 | AN-N-DETAIL；打开，未读时自动read |
| NC | 509 | 01c7bba15fa9f7ce.1 | AN-N-PAGE；上一页 |
| NC | 511 | bd5dbf08f126da53.1 | AN-N-PAGE；下一页 |
| NC | 513 | 1eb1c4db747d37c9.1 | D-AN-NOTIFICATION；消息详情 |
| NC | 513 | a81227b33b62c0a9.1 | AN-N-CLOSE-DETAIL；Escape，busy不关闭 |
| NC | 520 | 24417e6753ed4eb7.1 | AN-N-CLOSE-DETAIL；按钮同busy边界 |
| NC | 547 | 9c8237833082965f.1 | AN-N-SOURCE；站内来源+from |
| NC | 550 | d0ef81cb0803db4e.1 | AN-N-START；仅open |
| NC | 558 | 7490571390181453.1 | AN-N-CLOSE；非closed |
| NC | 566 | 696dcabbd8c2d73e.1 | AN-N-REOPEN；closed |
| NC | 574 | 1c008f867673db60.2 | AN-TECH；资源/根因键 |
| NC | 591 | b332799077351299.1 | D-AN-PREFERENCES；偏好 |
| NC | 591 | bcb7add4c71c18a6.1 | AN-N-PREF-CLOSE；Escape |
| NC | 597 | 72947e74a11b9abc.1 | AN-N-PREF-SAVE；PUT expected_version |
| NC | 608 | 25755513ca77e550.1 | AN-N-PREF-CLOSE；取消保留当前ref |
| NC | 609 | 0285caea2e8607bf.1 | AN-N-PREF-SAVE；原生submit |

## 3. 字段绑定与真实请求

AW的11处绑定为reason；templateForm.name/resource_type/node_name/sla_minutes/approver_id/escalation_assignee_id；publishReason；requestForm.template_id/resource_id/title。requestForm.resource_type由已发布模板派生，没有可独立编辑的字段。NC六处为unread和preferences.in_app_enabled/email_enabled/task_enabled/approval_enabled/competitor_enabled；AQ无v-model。

| 操作 | 路径与方法（均/api/v1前缀） | 实际请求与边界 |
| --- | --- | --- |
| 模板草稿 | POST /tasks/approval-templates | name、resource_type、nodes:[{name,approver_id,sla_minutes,escalation_assignee_id}]；单节点UI，服务端1–10；草稿不生效 |
| 模板发布 | POST /tasks/approval-templates/:id/actions | reason.trim、expected_revision；没有额外action字段，发布锁版本 |
| 发起审批 | POST /tasks/approvals | template_id、resource_type、resource_id.trim、title.trim；锁模板版本，资源存在/范围由服务端验证 |
| 审批决定 | POST /tasks/approvals/:id/actions | action=approve/reject、reason、expected_version；task:assign且当前审批人，事务审计/历史不可变 |
| 自动已读/处理 | POST /notifications/:id/actions | action=read/start/close/reopen、expected_version；打开未读才read，处理不改变read_at，不变更关联业务状态 |
| 全部已读 | POST /notifications/actions | 无body、无筛选参数；当前组织/工作区/接收人所有delivered未读通知 |
| 偏好保存 | PUT /me/notification-preferences | 当前偏好对象、email_enabled=false、expected_version=version；服务端只接收五布尔值和expected_version，拒绝邮件true |

写入继续通过api-client附带Origin/幂等/请求追踪和会话；权限在API独立校验。列表GET、详情GET、summary、偏好GET分别遵循P25/P26规格，不把GET当作批准或发送。所有生产写入验收仍需明确隔离对象；本批只用本地真实Vue与可控API合同数据。

## 4. 弹窗与可复现修复

- D-AN-APPROVAL：aside原先只有role=dialog，无首焦点/Escape/焦点循环。AN01先失败后改为原生dialog+既有useModalDialog，局部Tab边界显式循环，真实遮罩坐标才关闭。AN04保证409原因提示在模态内可读且草稿保留，重开清错误。不修改共享helper，其他消费者不自动算通过。
- D-AN-TEMPLATE / D-AN-REQUEST：AN02两实例先证明提交后required所在details仍关闭；表单invalid捕获只打开最近details，保留原生required、字段值及服务端校验。模板的审批人select嵌套选项会参与label文本，测试复用现有部分标签匹配，不通过改字段文案解决定位问题。
- D-AN-PUBLISH：嵌在模板窗上层，原因和expected_revision保留现有合同；忙碌关闭、焦点回到发布触发按钮及失败提示仍待全变体测试。
- D-AN-NOTIFICATION：AN03先复现关闭按钮disabled但Escape仍关闭，后补closeDetail的busy保护；受控在途成功后显示结果、只发送一次精确start/version，再允许Escape。跨路由或偏好草稿异步归属未随这一行修复。
- D-AN-PREFERENCES：邮件固定false、取消不写入；失败关联、处理中取消与SSE覆写待后续复验。

## 5. 剩余缺口与关闭条件

| ID | 待验证/未完成 | 下一步与完成证据 |
| --- | --- | --- |
| AN-G01 | 审批全部筛选刷新默认pending、历史导航不同步、分页保留详情、页面级计数措辞 | 按真实URL和服务端范围先复现，保持现有业务筛选定义；每项定向回归 |
| AN-G02 | 审批读取无归属/取消；通知loadGeneration只护部分成功，meta/错误/详情和自动read迟到可能覆盖新页 | 同源乱序、关闭/切范围/离开缓存页用受控请求复现；不取消已提交事务或自动重放 |
| AN-G03 | 模板/发起/发布/偏好忙碌取消、双提交与跨窗结果归属；SSE可覆盖偏好草稿 | 按当前UI/服务合同确定窗口所有权，成功/失败/迟到分别测试；有行为歧义先确认 |
| AN-G04 | 原生窗外页级提示、字段错误关联、深链关闭的无触发器焦点、长内容/叠加窗 | 每窗可见错误、键盘和焦点回归，辅助技术实测；本批只闭环审批详情错误与局部焦点 |
| AN-G05 | 汇总原始通知与分组总量区别、根因详情数量、自动已读/全部已读范围、来源返回与无效ID | 固定真实隔离数据检验API/数据库范围与UI，不把PAGES概念文案当新增业务 |
| AN-G06 | SSE缓存页生命周期、游标跨范围、重连/回退表现 | 复用m05-04并补实际场景，当前S0边界不变，不虚称固定轮询或多节点容量 |
| AN-G07 | 全新正式风格、全部视口/主题/密度/动效、所有动作/弹窗真实后端和生产签收 | 经用户定向后交图→Vue→同版本证据；G0未冻结、用户通过0，本文件不关全站门 |

## 6. 局部源证据

按UTF-8、LF标准化源码计算。若以下任一源改变，重新扫描对应表，不只替换哈希冒充复验。全局清单在本批开始时`--check`真实失败于baseline过期；R00还需以稳定产品提交刷新，历史图库保持原始来源身份。

| 文件 | LF SHA-256 |
| --- | --- |
| AW | 0ffbb3bd12ea11fe31c30ae37555450ca4bd8c26604790fb62c7c0e118138177 |
| AQ | 247bddb44d67264787f8331e8eb1c872049edc97c72114c847849745a5822075 |
| NC | 9b39758c091e24df6a49d9edfbc5684faa1ad1531a1c0930b09b5fb2cba85ddc |
| approval-workspace.css | 3baa1bd6bd42b620024d8b0930e018e985929df2dce6b4a904333417c5ac2053 |
| notification-center.css | 3b76371449dfee575dfc3cbe52e73425b3517d1f0f544e8116ce30f8bc56e386 |
| use-modal-dialog.ts | 08bfc1db3703e25927576eacaca733cfb8cc16d4d90e8aa2741a72d138fdf74f |
| approval-workspace-types.ts | 85f49803b54e30f8543d7256ce27630001c943aea86baac8a84d45591f9f9792 |
| realtime-client-metrics.ts | 2a1da843a954e98bb6f2e500b692f635194fc1dfe669dabfeb94c26d1185ff93 |

永久回归：tests/e2e/m05-02-approval-workflow.spec.ts的AN01/AN02/AN04及原有用例；m05-03-notifications.spec.ts的AN03及原有用例；受影响m05-04-realtime.spec.ts。实际运行结果只记录PROGRESS，不预先写passed。设计图和最终实现图未产出，不以测试夹具截图冒充生产图。

### 2026-09-08 R00全局来源关联

全局清单已通过生成器与只读校验，绑定产品提交`4b835881c081af808713c76af323d866993f44c9`、指纹`fad2a485b462fd89b20dca92bda5b944683bea63cbc263c5ad3d64b4f60fb591`。本表65个局部候选仍按当前源码解释；R00没有再次修改产品或重跑未变化的AN业务回归。

历史`dialog-1`在ApprovalWorkspace旧495行，候选`92496ba501468962.1`是带role=dialog的aside；当前531行原生dialog候选为`1e3aa75fca121f17.1`，业务语义仍为D-AN-APPROVAL。因标签和事件合同改变，生成器保留`unresolved-source-changed-or-removed`而不自动认定相同，历史自动对应数从704变为703；本段给出人工来源对应，不将源码对应升级为全变体验收。G0归并冻结时须消费该人工记录，不能把旧详情删掉或遗漏当前原生模态。
