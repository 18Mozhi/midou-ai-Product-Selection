# F03 自动化与报表局部交互合同

2026-09-10 P27真实读取修复：[列表、详情与草稿归属](P27-READ-OWNERSHIP-REVIEW.md)。同批首错即失效，旧回包不覆盖新列表/详情/诊断，刷新不重置后来草稿，销毁后只读回包不再落地；初次深链仍正常。22项源码测试、18项真实Vue双端场景，旧122/208/114图随源码复核，不新增视觉批准。只改组件script，接口与写入流程不变；写回执/跨范围/完整视觉与全站部署继续待，未部署。

2026-09-08报表增量：[P28 REPORT-C-r1](design/report-direction-c/README.md)90PNG，41场景双端加8长窗底部；蓝色类型目录、白报表与独立导出队列、唯一详情窗。源Vue脚本惰性执行验证三个CSV body、无body重建、新ID/query/null/0/到期，真实SQL与服务经惰性依赖验证团队口径和409/410/503顺序。不是挂载Vue、真实DB/Worker/文件或生产证明。原团队汇总/明细及旧ETA差异保留；status=expired但时间未到的UI允许/API拒绝差异显式演示，不改合同。窗内错误与读数层级仅提案；RP-G01–G04、F03-G05仍待办。下文“P28尚未出稿”为上一批历史状态，当前已有独立稿但未获审。

2026-09-08设计增量：[P27 AUTOMATION-C-r1](design/automation-direction-c/README.md)122图。源Vue脚本在惰性环境检查五body/模板/循环/六类预览归属/URL及忙碌取消；实际服务校验器、预览SQL构造、Worker重试与死信失败分支有离线证据，不是真实Vue/数据库/审计/投递。列表dead_letter与详情succeeded、命中17但空样本均保留。原failureReason对action_failed一律承诺重试与终态冲突；图稿按终态解释，不改变实际代码。分区编辑器/窗内错误/打开及失败滚动重置、编辑不改启停为提案，AR-G01–G03及F03-G05保持待办。P28报表尚未出本方向业务稿，不把P27图重复计为P28。

日期2026-09-08；产品起点3aaf061（产品源4b83588）。P27/P28的规格、动作归属与风险记录，不是全站G0冻结或正式设计通过。依据AGENTS→Feature Map automationRules/reportsExports→route-catalog→NavigationShell→真实组件、API路由/服务/仓储及既有m05-05/m05-06测试；概念图仅作历史参照，不把旧布局或概念字段当新合同。

## 1. 逐源码候选映射

AR=apps/web/src/components/AutomationRuleCenter.vue，RP=apps/web/src/components/ReportCenter.vue。完整候选ID为文件路径#sig。当前33候选：30个控件/事件、3个dialog定义；AR10处v-model，RP无表单输入。v-for模板、规则、执行和导出行按语义变体展开，不按示例记录数增加分母。定义和cancel事件归同一弹窗，form和submit按钮归同一保存动作。

| 文件 | 行 | sig | 语义动作或弹窗 |
| --- | --- | --- | --- |
| AR | 393 | d27de6387d58944c.1 | AR-CREATE；打开空表单 |
| AR | 423 | 6a22c249121aeb4d.1 | AR-LOAD；错误重读 |
| AR | 468 | 5b19eec3cd4a60d0.1 | AR-DETAIL；rule深链→GET |
| AR | 469 | 110dd4ce491d067b.1 | AR-EDIT；rule/action编辑 |
| AR | 470 | 7d3171303da98576.1 | AR-STATUS；暂停/恢复 |
| AR | 476 | 08d127ded2ba2429.1 | D-AR-EXECUTIONS；原生模态 |
| AR | 476 | ae7f95f10a94c968.1 | AR-DETAIL-CLOSE；Escape |
| AR | 483 | aef9c00aea0c46b8.1 | AR-DETAIL-CLOSE；关闭按钮 |
| AR | 492 | 573d41c8d777efee.1 | AR-TASK；真实人工任务链接 |
| AR | 496 | eb58830acad203db.1 | AR-NOTIFICATION；触发通知 |
| AR | 505 | 1c008f867673db60.1 | AR-TECH；执行错误/资源标识 |
| AR | 512 | a6561f91cc94ec7b.1 | D-AR-EDITOR；新建/编辑两变体 |
| AR | 512 | 35756ebc6c836998.1 | AR-EDITOR-CLOSE；Escape |
| AR | 517 | 926c2e079c31814f.1 | AR-SAVE；表单submit |
| AR | 522 | 742531071607ff73.1 | AR-TEMPLATE；三模板草稿 |
| AR | 631 | 3e0160425e8092a0.1 | AR-SAMPLE；预览来源链接 |
| AR | 643 | 2354c8e95ace6cd1.1 | AR-EDITOR-CLOSE；取消 |
| AR | 644 | 180c3b124eda84e8.1 | AR-PREVIEW；只读POST |
| AR | 646 | ea72a6477a8776b1.1 | AR-SAVE；新建/编辑提交按钮 |
| RP | 295 | 97351e6d4fd4cc45.1 | RP-CREATE；CSV入队 |
| RP | 298 | 333b03bc402fcd48.1 | RP-TYPE；三类报表URL |
| RP | 310 | 1c008f867673db60.1 | RP-TECH；请求关联标识 |
| RP | 333 | 97ed4772fb320d6c.1 | RP-LOAD；错误重读 |
| RP | 402 | aa7c04ce54cf7cb5.1 | RP-REFRESH；后台保留显示 |
| RP | 405 | 48c7e8b38910554f.1 | RP-TASKS；导出任务视图 |
| RP | 425 | 6008f8ab717efc14.1 | RP-DOWNLOAD；有效文件GET |
| RP | 431 | 2c6e73d043155b49.1 | RP-REGENERATE；列表重建 |
| RP | 439 | 9455978516828e94.1 | RP-DETAIL；export深链 |
| RP | 444 | 771186d2cb192900.1 | D-RP-EXPORT；导出生命周期 |
| RP | 444 | 92b76ba5cca9c487.1 | RP-CLOSE；Escape |
| RP | 451 | ec6fb3ba685c67a6.1 | RP-CLOSE；关闭按钮 |
| RP | 508 | 7ca6d136d071985b.1 | RP-REGENERATE；详情重建 |
| RP | 516 | 1c008f867673db60.2 | RP-TECH；导出错误码 |

## 2. 输入、接口与副作用

AR的10处v-model为form的name/trigger_event_type/condition_severity/action_type/owner_id/action_assignee_id/action_title/rate_limit_count/rate_limit_window_minutes，以及editReason。触发器4项、严重程度4项、安全动作2项；任务事件禁止创建任务。name/title最多200字符；负责人是当前范围成员；次数1–1000、分钟1–1440，原初值20/60。编辑原因UI500、服务1000，记录差异不擅自更改。description来自模板展开，当前请求会携带但服务不消费；规格不发明description存储列。

| 动作 | 实际接口（省略/api/v1） | 请求与结果边界 |
| --- | --- | --- |
| AR-LOAD | GET /automations + /tasks/member-options | 当前组织/工作区规则与合法成员；不是全站运行权限证据 |
| AR-DETAIL | GET /automations/:id | 返回最近100执行；链接只使用实际资源/通知ID |
| AR-PREVIEW | POST /automations/preview | 完整规则字段，notify_owner时assignee=null；Origin/team:manage校验，只读，不创建审计/执行/通知/任务 |
| AR-SAVE新建 | POST /automations | 完整规则，201；创建active，界面不是草稿保存 |
| AR-SAVE编辑 | PATCH /automations/:id | 完整规则+expected_version/reason，版本锁/历史/审计 |
| AR-STATUS | POST /automations/:id/actions | action=pause/resume、expected_version、现有固定人工原因；无新确认窗 |
| RP-TYPE/LOAD | GET /reports/:type + /report-exports | 无日期条件；导出最近100项，不把无分页当全历史 |
| RP-CREATE | POST /report-exports | report_type、format=csv；202异步入队，不代表文件已生成 |
| RP-DETAIL | GET /report-exports/:id | 当前范围详情，404与其他失败分别提示 |
| RP-REGENERATE | POST /report-exports/:id/regenerate | 无新业务body；过期/最终失败创建新queued记录，保留旧记录 |
| RP-DOWNLOAD | GET /report-exports/:id/download | succeeded且未过期；Cookie、request/trace ID，原始字节，私有no-store |

全部请求使用现有api-client。写入客户端给幂等键，服务端独立做会话、范围、权限、Origin和版本校验；preview虽用POST仍只读。GET/HEAD当前最多3次安全重试（0/150/400ms），下载网络失败测试必须等重试耗尽，不能把第二次自动请求当用户手工重试。Worker/文件系统和持久化结果不由本地fixture证明。

## 3. 本批预览修复与永久验证

AR01先在原实现证明修改次数后旧preview仍存在；AR02先证明关闭/重建表单后旧请求仍填入新窗。修复增加表单/打开状态/编辑对象/URL的同步失效序号，预览使用现有request并在成功、错误、finally副作用前检查归属；旧请求不覆盖新预览或新忙碌状态，不改API、限流、业务条件、主题或共享helper。不取消/重放创建、编辑或暂停恢复事务。

AR03校验required不发POST、模板可调整、task.created回落notify_owner、精确创建body和幂等头；AR04校验暂停/恢复沿返回版本和原固定原因。RP01仅是受控详情迟到后的历史关闭用例，未复现问题不意味着整个ReportCenter读取安全；本批不改RP产品代码。RP02读失败耗尽安全重试后人工再下，核验建议文件名与CSV实际字节并delete临时下载；RP03保留null平均数/时间、真实空态和CSV精确类型。已有用例覆盖详情/编辑/模板、报告切换、重建来源、深链及任务中心。结果记PROGRESS，不因测试文件存在预先标passed。

## 4. 仍未关闭的事项

| ID | 尚未完成/验证 | 后续退出证据 |
| --- | --- | --- |
| AR-G01 | 创建/编辑/预览错误主要在窗外notice；全部Tab边界、字段错误关联、忙碌取消/重开 | 每窗真实交互、错误可达、保留草稿和焦点；不把局部返回焦点当全部无障碍 |
| AR-G02 | 规则列表/详情读取、同路由多实例缓存及写后重读的全生命周期归属 | 成功/失败/迟到/离开/切范围受控验证，禁止旧结果改新页；预览局部序号不自动覆盖这些链 |
| AR-G03 | 编辑冲突、成员失效、所有触发/严重程度组合、预览样本窗口措辞 | 真实服务合同逐字段验证；不改样本SQL或规则业务以配合图 |
| RP-G01 | api内部notice/requestId及详情、后台重读、KeepAlive/离开/跨范围完整归属 | 全部成功/错误/并发顺序测试；一个关闭后迟到用例不是全验 |
| RP-G02 | 重建并发不同记录、模态内错误、跨页写后打开新详情、边界时刻过期 | 固定时钟/受控事务、错误及焦点、重复提交和旧记录不变证据 |
| RP-G03 | 组内全部导出状态、无ETA/多样本、长邮箱、200%缩放和全部断点 | 正式设计→Vue→交互逐状态图，不复用示例数量当分母 |
| RP-G04 | 团队成员数枚举组织活动成员但任务只算当前工作区；泛化“当前工作区”文案不够精确 | 新稿明确拆开人数与任务口径；若要改成员集合或查询，需用户确认业务规则后另做 |
| F03-G05 | 两页正式全新图、所有动作/弹窗真实后端、生产部署与签收 | 经方向审核的完整图→Vue→真实隔离数据→宝塔→用户；G0未冻结、审核0 |

## 5. 当前局部源码证据

UTF-8、LF标准化SHA-256；源改变后必须重新扫描本表及重验相关用例，不只改hash。全局baseline/图库仍绑定已验证4b83588，当前预览修复提交后再按影响更新，不能让旧证据伪装成新源码验证。

| 文件（apps/web/src/） | LF SHA-256 |
| --- | --- |
| components/AutomationRuleCenter.vue | 6c86e3399434253686d4257e7ee65eb2bb37da3b405cb89f226ef15002232be4 |
| components/ReportCenter.vue | 51f40d277f36a2a21810167b18bdd0fa91949bee7074398a646399f2c958251a |
| automation-rules.css | c006390dfdc5cc15371067d6f713ff18a2503c86693aa37e0e2a320cf5dd31f2 |
| report-center.css | 5c6b36025fbfed41a243557ac4d73b463fc1dd71d8b895c14f91c7506b49b8c1 |
| use-modal-dialog.ts | 08bfc1db3703e25927576eacaca733cfb8cc16d4d90e8aa2741a72d138fdf74f |
| api-client.ts | 953c3da783121a797a86ff82e03a968067ae2c694a4fb5f883187b04569fa9ff |
