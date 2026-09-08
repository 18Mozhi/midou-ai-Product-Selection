# B2b · 内容、通知与接口证据合同

F04b后续：共享AuditedReasonDialog仅补局部Tab循环并更新该文件当前hash，旧值在e414e0e。platform-message-management现有发布用例补实际原因窗首焦点和禁用/启用提交下的双向边界，之后继续原准确发布请求验证；不等于取消发布、全部受众/角色或真实投递已验。详见共享入口合同第11节。

2026-09-08；起点main/b4bdcf1。覆盖[P56](page-specs/P56.md)、[P57](page-specs/P57.md)、[P63](page-specs/P63.md)，共用父入口与[P61](page-specs/P61.md)交叉复核。本批事实合同及正文阅读修复不是正式风格、全部行为、生产或用户签收；无新正式图，未代选A/B/C。

## 1. 生产者、范围与实际含义

| 入口 | 数据与动作链 | 必须保留的事实 |
| --- | --- | --- |
| P56 content | PlatformManagementCenter → usePlatformContentList/Review → platform-dashboard routes/service → readManagement(content)/moderateTrend | query影响摘要；status只再限制列表。20条服务端页；四状态可读、三状态可写。同步更新趋势表、trend_events、审计和幂等结果，不是正文CMS或等待Worker |
| P57 notifications | 父入口 → NotificationManagement → Workbench/Operations/双Pagination；Editor；readManagement(notifications)/messageManagement/create/update/action | 投递20条与消息10条分开；消息不受query/category影响；全局模板/渠道/偏好与筛选计数分开。人工发布同步写站内事实，不走Worker |
| P63 api-coverage | 父apiDomain映射 → readManagement(api_coverage) → readApiCoverageDashboard/buildApiCoverageDashboard | superadmin；每次读包内OpenAPI/metadata/角色目录/报告，按method/path匹配；current不等于全维通过或发布SHA匹配 |
| P61 status（已有规格复用） | 同父入口 → usePlatformStatus → readManagement(status) | 保留独立状态请求控制、拓扑及浏览器标签页观测；本批不改或重复算新增规格 |

P56/P57 API检查platform:operate，P63检查platform:superadmin；目录角色声明不替代实际服务授权。四路由均preserve，P63无独立navigation菜单；关闭的/platform-admin/email只做不存在/不可用验证，不恢复邮件生产入口。GET management这些分支不应套用dashboard read自带审计合同。

## 2. 人工消息与审核写链

| 动作 | 请求及约束 | 成功/失败边界 |
| --- | --- | --- |
| CT56-REVIEW | PATCH /platform/management/content/{id}；status active/irrelevant/stale、expected_version正整数、reason trim后2–300 | 同源、platform:operate、Idempotency-Key；行锁版本/存在性、趋势状态及事件、审计/幂等同事务。入口禁同状态不等于弹窗select或服务也拒绝同状态 |
| PN57-SAVE 新建 | POST /platform/management/messages →201；标题2–200、正文2–2000、四category/三severity/三受众、站内渠道 | 创建draft版本1；不会发布。新建函数不接收人工reason，不借旧文档补强制原因字段 |
| PN57-SAVE 编辑 | PATCH /platform/management/messages/{id}，完整消息值、expected_version、reason2–300 | 仅draft，404不存在/409版本或状态冲突；发布和取消后的消息不可编辑 |
| PN57-PUBLISH/CANCEL | POST /platform/management/messages/{id}/actions，action/expected_version/reason | 已draft且版本一致；取消仅改草稿并审计，无已发布撤回。发布无目标409；邮件启用503，不能用UI绕过 |
| PN57-BODY | 本地details/summary展开原body | 新增纯阅读，无请求/存储/鉴权/状态改写；三行摘要保留，全文展开后不截断 |

消息三写路由同源、会话、platform:operate、幂等事务。发布受众为active用户+active成员+active组织+组织默认工作区；按最早符合条件的成员关系去重，组织范围限制该组织。选择器最多200组织/500用户，不保证每个active账号都有可投递成员关系；不是实时受众预检。发布代码不检查notification_preferences，手工平台消息与Worker订阅模板不是同一判定。若要统一订阅规则，须独立业务决定，本批不改。

发布事务写notifications、站内delivered记录、realtime_events、已published outbox及消息状态/审计/幂等结果。成功文案数量来自API返回而非前端估算；不把同步站内写入包装成邮件到达或Worker完成。邮件字段在共享源码保留但页面禁用，服务拒绝kind=email/email_enabled=true，历史API存在不代表网页入口开放。

## 3. 共享控件与弹窗消费者

| 消费场景 | 子控件/变体 | 验收归属 |
| --- | --- | --- |
| 三页Filter | query/status、submit/reset；ResponsiveFilterDrawer按钮/关闭/遮罩/Escape/Tab圈定/submit.capture自动关窗 | P56状态、P57类型、P63运行结果分别有选项和范围，不只验一次通用表单 |
| P56内容及P57投递详情 | ResponsiveDataView摘要按钮→抽屉；关闭/Escape/遮罩、technical summary；P56另有三审核按钮 | 两个生产调用场景，邮件第三场景关闭。初焦点/返回与Tab圈定缺口独立记录 |
| P56七列、P57六列 | TableViewControls列设置、逐列checkbox、至少留一列、冻结、standard/compact | 不是后端字段裁剪或持久偏好。P63自有表格不消费此组件，勿虚构列设置入口 |
| P56审核 | 原生dialog、状态select、原因textarea、取消/确认、Escape | 三目标、四原状态及移动详情到审核的焦点；同form与按钮不重复计业务 |
| P57编辑 | 原生dialog新建/编辑×三受众，渠道字段、保存/关闭/Escape | 10个本地表单绑定；来源选择200/500上限、邮件禁用、错误关联和忙状态待全验 |
| P57发布/取消 | AuditedReasonDialog共享定义、两个有效动态标题；邮件retry/suppress为关闭入口历史分支 | 取消原因窗零POST，提交后异步归属/防重待验；不得将所有脚本调用当独立窗口定义 |
| P57全文 | 原生details/summary，每个消息独立开关、三状态可读 | Enter开、Space关、原文不截断、焦点保留、零写入；正常摘要不默认展开 |
| P63证据 | 当前无局部交互候选；五维证据span的title及CSS卡片 | title不等于可键盘/触屏访问的详情，正式稿必须补可达阅读；此处没有详情dialog |

## 4. 已复现、本批变化及剩余验收

原版三状态长消息都只能看三行，无已发布/取消全文入口；三个隔离桌面用例在可见高度断言处失败，裁切差值300px。中间尝试直接显示全文，定向3项和模块17项通过；进一步核对runbook的紧凑长卡要求后改为保留摘要并增加原生全文披露。最终测试加入键盘开关、全文高度、页面横溢、编辑可用状态及零业务写入；中间通过不能充当最终版本证据，最终结果见PROGRESS。

| 缺口ID | 源码依据与下一可执行验证 | 状态 |
| --- | --- | --- |
| PN-G01 读取范围/生命周期 | content/notifications有独立controller/sequence/15秒；P63通用load没有同等归属保护，preserve离开未必unmount；通知refreshing早退与跨域切换、历史恢复需受控延迟验证 | 未验，不套用P54/P55新snapshot修复 |
| PN-G02 写反馈与防重 | submitReview/saveMessage/messageAction在await后访问共享窗口/消息；load可吞错，成功提示覆盖读失败；Workbench不接busy，编辑保存无函数级saving早退 | 待复现，不能通过关闭窗口取消已发事务 |
| PN-G03 表单/模态 | 错误写到父message，原生dialog内无专属错误；移动详情发审核再关闭涉及双焦点；shared详情无Tab圈定；原因窗无最大300输入约束 | 待局部复现/无障碍验收，不借本批正文修复大改公共组件 |
| PN-G04 查询、空态与读取说明 | P56摘要受query非status；P57筛选不影响messages，空时辅助区整体隐藏；首次失败也说保留旧数据；P63零匹配无明确空态 | 待正式信息布局及准确反馈，不擅自扩展SQL过滤 |
| PN-G05 受众及受限功能 | 选择器200/500、有效成员范围、订阅不参与人工发布；告警返回50但只显示6；邮件关闭 | 保留实际业务规则；需要变更须明确决定，UI图不能捏造全部可达 |
| PN-G06 接口证据边界 | current只依schema/policy/method-path指纹/数量；证据详情仅title；角色期望源于forbiddenCapabilities，不是实时授权 | 结构验证与真实接口/版本证明分开；不伪造发布验收 |
| PN-G07 历史数字/证据 | 当前目录225路径/258操作；tests/m06-02/api-coverage-dashboard.test.mjs首例仍固定223/256，旧runbook数量及可信范围已在本批纠偏 | 不无依据把旧测试计通过，旧断言维护另验；文档纠偏不等于后端全套通过 |
| PN-G08 正式设计与真实验收 | 三页仍无正式新图，F00-1.18-r1未获审；数据库、审计、收件人、全角色/读屏与生产未验 | G0未冻结、G1–G5待验，61份规格不是重设计完成率 |

P63额外只读内存检查直接转译当前TypeScript，不读取可能陈旧dist，也不落盘：10组输入覆盖current的部分证据、missing/invalid、指纹/schema/数量/policy不匹配、单操作ID不匹配、零查询结果但目录统计不变。调用使用自造报告而非真实生产报告；输出曾将组数误标11，按实际1+7+1+1调用应为10，不能当11条独立测试。

## 5. 局部候选与字段绑定

10个局部Vue合计63个控件/事件/模态定义或调用候选，16个v-model位置包含2个父级转发，不等于16个独立输入；原生审核/编辑的事件与定义、提交form与按钮，以及关闭邮件/复用P61分支均单列，不能直接作为去重业务动作分母。新增正文summary一项，旧动作签名保留；全局actions/dialogs/coverage历史源不在此处手改。

### apps/web/src/components/PlatformManagementCenter.vue

| 签名.序号 | 行 | 类型 | 语义/范围 |
| --- | --- | --- | --- |
| 2f53f8bf6591930e.1 | 383 | control | PN57-NEW 新通知草稿 |
| 5eebd25c337b0a2c.1 | 386 | control | EMAIL-CLOSED 关闭路由保留分支 |
| 62c28f83dd77541b.1 | 387 | control | CT56/PN57/AC63/P61-LOAD 按域刷新 |
| 3a1faf0f5682bde3.1 | 392 | event-binding | CT56/PN57/AC63-FILTER 父转发 |
| 79f3cfdde95076be.1 | 414 | control | CT56/PN57/AC63/P61-RETRY 非loading重读 |
| dd1ae8b1dd3126a2.1 | 423 | event-binding | EMAIL-CLOSED 草稿转发 |
| f2761a2c8d2de54d.1 | 432 | event-binding | CT56-REVIEW 内容行审核；email-action在本分支无生产触发 |
| d5eb4065543ab970.1 | 442 | event-binding | CT56-PAGE 父转发 |
| 280c245be99b4194.1 | 448 | event-binding | PN57 编辑/发布/取消及双分页父转发 |
| 1cb3318f1d3fb321.1 | 459 | event-binding | EMAIL-CLOSED 邮件行转发 |
| 528025bcfd01008c.1 | 477 | control | P61 拓扑关联链接（复用记录） |
| 5ec3f86a53bdd26b.1 | 485 | control | P61 动态节点链接（复用记录） |
| 1c29b9e693b1be23.1 | 520 | control | P61 异常处理链接（复用记录） |
| 4c8c3c0ab5222aee.1 | 575 | control | P61 采集任务关联（复用记录） |
| 0e70539c0b003023.1 | 584 | control | P61 来源配置关联（复用记录） |
| 1c008f867673db60.1 | 590 | control | SHARED-TECH 请求编号披露 |
| ca5a09f3ba2d41f2.1 | 595 | dialog-definition | CT56-REVIEW 原生审核定义 |
| 13361d81d5bab45e.1 | 595 | event-binding | CT56-CANCEL 原生Escape事件 |
| bc72ebe875dbe028.1 | 596 | form-event | CT56-CONFIRM 审核form |
| 55da33db3f9ca4bf.1 | 616 | control | CT56-CANCEL 取消审核 |
| 642126a04c8cf655.1 | 617 | control | CT56-CONFIRM 提交按钮（同form） |
| d0dbab0cf156eec0.1 | 621 | event-binding | PN57-EDITOR 编辑器保存/关闭调用 |
| 2c3cf7108ad053c1.1 | 630 | event-binding | SHARED-REASON 原因提交/取消转发 |
| 4b3a546a74b4e7c1.1 | 630 | dialog-component-call | SHARED-REASON 同组件调用候选，不重复业务计数 |
| b285a03c301c82db.1 | 239 | dialog-script-call | EMAIL-CLOSED 重试/抑制原因变体 |
| f85ae0968844933a.1 | 318 | dialog-script-call | PN57-PUBLISH/CANCEL 发布/取消原因变体 |

### apps/web/src/components/PlatformManagementFilter.vue

| 签名.序号 | 行 | 类型 | 语义/范围 |
| --- | --- | --- | --- |
| ef05faf55a95a9e3.1 | 12 | dialog-component-call | CT56/PN57/AC63-FILTER 移动筛选调用 |
| b0cd0b7f407d1c7c.1 | 13 | form-event | CT56/PN57/AC63-FILTER 表单提交 |
| 9e678b77e73d5618.1 | 61 | control | CT56/PN57/AC63-FILTER 筛选按钮（同form） |
| 790334fe5c024f7f.1 | 62 | control | CT56/PN57/AC63-RESET 清空读取 |

### apps/web/src/components/PlatformManagementRecordList.vue

| 签名.序号 | 行 | 类型 | 语义/范围 |
| --- | --- | --- | --- |
| 8a99fcbf66489c03.1 | 75 | control | CT56-REVIEW desktop active |
| 7c7221d887da19c4.1 | 81 | control | CT56-REVIEW desktop irrelevant |
| 668b99a263ed84a6.1 | 87 | control | CT56-REVIEW desktop stale |
| 456551eceb771f7f.1 | 133 | control | CT56-REVIEW mobile active并关闭详情 |
| d84e8cde45e4e349.1 | 142 | control | CT56-REVIEW mobile irrelevant并关闭详情 |
| b64b166846728769.1 | 152 | control | CT56-REVIEW mobile stale并关闭详情 |
| 1c008f867673db60.1 | 164 | control | CT56-TECH 内容ID/版本 |
| 9af5f9dbe2a91364.1 | 218 | control | EMAIL-CLOSED desktop retry |
| 372de81aab2cb631.1 | 226 | control | EMAIL-CLOSED desktop suppress |
| 316dcafef0b88f9e.1 | 278 | control | EMAIL-CLOSED mobile retry |
| b6cb512d02e6e29b.1 | 288 | control | EMAIL-CLOSED mobile suppress |
| 1c008f867673db60.2 | 302 | control | EMAIL-CLOSED 邮件技术信息 |

### apps/web/src/components/PlatformContentPagination.vue

| 签名.序号 | 行 | 类型 | 语义/范围 |
| --- | --- | --- | --- |
| 3a1c06036af4d8a4.1 | 15 | control | CT56-PAGE 上一页 |
| ab6f56976164b3f3.1 | 22 | control | CT56-PAGE 下一页 |

### apps/web/src/components/PlatformMessageWorkbench.vue

| 签名.序号 | 行 | 类型 | 语义/范围 |
| --- | --- | --- | --- |
| f095166e216904be.1 | 37 | control | PN57-BODY 完整正文原生展开/收起，三状态 |
| 2ae2df8d01820411.1 | 69 | control | PN57-EDIT 草稿编辑 |
| 1161d842890c2c3d.1 | 70 | control | PN57-PUBLISH 草稿发布；邮件变体关闭 |
| 5c263905603687c7.1 | 73 | control | PN57-CANCEL 取消草稿而非撤回 |

### apps/web/src/components/PlatformMessageEditor.vue

| 签名.序号 | 行 | 类型 | 语义/范围 |
| --- | --- | --- | --- |
| c18fb34a85c44a13.1 | 20 | dialog-definition | PN57-EDITOR 新建/编辑定义 |
| 2412ed75f6e08a76.1 | 20 | event-binding | PN57-CLOSE Escape事件 |
| ff3f7c9094488d9f.1 | 26 | form-event | PN57-SAVE 表单提交 |
| c6a9a644f04c8e3f.1 | 32 | control | PN57-CLOSE 顶部关闭 |
| 358517db18f8c7cb.1 | 117 | control | PN57-CLOSE 底部取消 |
| d55ba76cf5f7483a.1 | 118 | control | PN57-SAVE 保存按钮（同form） |

### apps/web/src/components/PlatformNotificationManagement.vue

| 签名.序号 | 行 | 类型 | 语义/范围 |
| --- | --- | --- | --- |
| 3007e82db0685abe.1 | 21 | event-binding | PN57-EDIT/PUBLISH/CANCEL 工作台转发 |
| d5b397392cb4b109.1 | 29 | event-binding | PN57-MESSAGE-PAGE 草稿分页转发 |
| 21e70175990c8170.1 | 37 | event-binding | PN57-PAGE 投递分页转发 |

### apps/web/src/components/PlatformNotificationOperations.vue

| 签名.序号 | 行 | 类型 | 语义/范围 |
| --- | --- | --- | --- |
| bf271304a21c8a72.1 | 83 | control | PN57-LINK /me 当前操作者偏好 |
| 656bc15c15ec0ab7.1 | 95 | control | PN57-LINK /platform-admin/governance |
| 2f1d0bb94a278adc.1 | 112 | control | PN57-LINK 同治理页另一个调用点 |
| 1c008f867673db60.1 | 185 | control | PN57-TECH 移动投递技术字段 |

### apps/web/src/components/PlatformNotificationPagination.vue

| 签名.序号 | 行 | 类型 | 语义/范围 |
| --- | --- | --- | --- |
| 3a1c06036af4d8a4.1 | 17 | control | PN57-PAGE/MESSAGE-PAGE 上一页，两消费者 |
| ab6f56976164b3f3.1 | 24 | control | PN57-PAGE/MESSAGE-PAGE 下一页，两消费者 |

### apps/web/src/components/ApiCoverageDashboard.vue

| 签名.序号 | 行 | 类型 | 语义/范围 |
| --- | --- | --- | --- |

局部无交互候选；其字段与证据仍按P63逐项审核。

### 输入/转发绑定

| 文件 | 行 | v-model表达式 | 参数 |
| --- | --- | --- | --- |
| apps/web/src/components/PlatformManagementCenter.vue | 392 | query | query |
| apps/web/src/components/PlatformManagementCenter.vue | 392 | status | status |
| apps/web/src/components/PlatformManagementCenter.vue | 600 | reviewStatus | 默认 |
| apps/web/src/components/PlatformManagementCenter.vue | 606 | reviewReason | 默认 |
| apps/web/src/components/PlatformManagementFilter.vue | 14 | query | 默认 |
| apps/web/src/components/PlatformManagementFilter.vue | 26 | status | 默认 |
| apps/web/src/components/PlatformMessageEditor.vue | 35 | form.title | 默认 |
| apps/web/src/components/PlatformMessageEditor.vue | 44 | form.body | 默认 |
| apps/web/src/components/PlatformMessageEditor.vue | 55 | form.category | 默认 |
| apps/web/src/components/PlatformMessageEditor.vue | 63 | form.severity | 默认 |
| apps/web/src/components/PlatformMessageEditor.vue | 71 | form.audience_type | 默认 |
| apps/web/src/components/PlatformMessageEditor.vue | 78 | form.organization_id | 默认 |
| apps/web/src/components/PlatformMessageEditor.vue | 90 | form.user_id | 默认 |
| apps/web/src/components/PlatformMessageEditor.vue | 100 | form.in_app_enabled | 默认 |
| apps/web/src/components/PlatformMessageEditor.vue | 107 | form.email_enabled | 默认 |
| apps/web/src/components/PlatformMessageEditor.vue | 111 | form.reason | 默认 |

## 6. 引用版本指纹

以下33份文件以UTF-8读取、CRLF归一为LF后计算SHA-256。只绑定所读版本；不能证明所有运行时交互和报告语义已通过。图片/生产信息必须另有真实采证。

| 文件 | LF SHA-256 |
| --- | --- |
| apps/web/src/components/PlatformManagementCenter.vue | 57c60bbdc5e61f63762057c3c217016e4fa1a0594ab3c368ffee003e748d9615 |
| apps/web/src/components/PlatformManagementFilter.vue | b1e608502ee29df66c4f813c38a6593ffc4c8bc5770183cfdfafbf968db689d9 |
| apps/web/src/components/PlatformManagementRecordList.vue | 3ec74f90ff5740a58f70ea98fdc9c76835da9d223f01dd31d23ffd6a7cf78bfc |
| apps/web/src/components/PlatformContentPagination.vue | 2c59ac9fa920dd095d36718eb86638a58abaebc6dd99bd8b73e869af5a0e6402 |
| apps/web/src/components/PlatformMessageWorkbench.vue | 7863a19cace6a921628b2e33e66434a5662868d8a33351abc1ef3d129a7382c2 |
| apps/web/src/components/PlatformMessageEditor.vue | 8bafb3374f744389257c36a27580dbf768a9b4a0991fa0ce748889bb2c093cea |
| apps/web/src/components/PlatformNotificationManagement.vue | a91ffa14ffdbd1f17b01f0877b745288d96c4ea8574449721edbc61883f1cb18 |
| apps/web/src/components/PlatformNotificationOperations.vue | 18c8b856cc26ed7aa7bf45f7375645ea23a5914b50425d84ee03efc17268cc6c |
| apps/web/src/components/PlatformNotificationPagination.vue | 6116c32da6df91e40433fd5f4e4f9cc82c59d20b5726df52ebfdafcaf08b1606 |
| apps/web/src/components/ApiCoverageDashboard.vue | dfa6e82e10a8410c3ad761bf8d0f9c56bb018a29c3f9ba935a67014c16d1a126 |
| apps/web/src/components/ResponsiveDataView.vue | 28fa47d1a8beac1666c0cf8be1316484abd39729682a68adb4fed803742f2aaa |
| apps/web/src/components/ResponsiveFilterDrawer.vue | daa1cda68e206b85f5cfa687ae9ee70795a20e2a67d79501cc22fbf53c162a39 |
| apps/web/src/components/TableViewControls.vue | d0611b8367773f915a885c6c09f34c958fed67e7b99110abec20bb0febeea9ff |
| apps/web/src/components/AuditedReasonDialog.vue | 270b84d19094e57b101a8e4efb1317b19785c87d30b8b452ee5b78e8f1378d00 |
| apps/web/src/components/use-platform-content-list.ts | 48005b5d0b70e22358f7aba27048717b980701ae2fcaaab52b32943a65770ff9 |
| apps/web/src/components/use-platform-content-review.ts | e700d67e95e44859d7283b7370ad4690fd13cf341cb87a1e556a414ede9dbfe2 |
| apps/web/src/components/use-platform-notification-list.ts | 2e697d3a5f53cdfded5335bc693fcd9f7ed1a7d9f8b2dc0a543708269bfdc61b |
| apps/web/src/components/use-platform-status.ts | 735f0c250153e075fdf39ca40c5c47b63b7aa30dfe85e1c9f9381bc7e56d068a |
| apps/web/src/components/platform-management-presentation.ts | 1d5bfec09dfc7efb63cc6d31bdbc924b35eb1d4092fe1e20fa60d779bd259133 |
| apps/web/src/use-modal-dialog.ts | 08bfc1db3703e25927576eacaca733cfb8cc16d4d90e8aa2741a72d138fdf74f |
| apps/web/src/use-audited-reason.ts | 113c2329aa046ce187ad1d834d92918391ef9c8ff79ed37c919c87e7e57f6bb8 |
| apps/api/src/platform-dashboard-routes.ts | 1b84b99708bf4610259b42dd48987831229560cf5653b15b98b3cc1d30284f30 |
| apps/api/src/platform-dashboard-service.ts | 568938e88c90615410a7c43224004930936165e91a4172afafc7ce2ff4d8428e |
| apps/api/src/mysql-platform-dashboard-repository.ts | b290af1c03b2767c79bb565f9ec256550250acc4be0cc787de12b81e9b8dcd28 |
| apps/api/src/api-coverage-dashboard.ts | 9a52518c7c47f26156bda290e7f6614e417e31760652cc73b4f37dd415a90b4c |
| config/route-catalog.json | d02ade33d087f133ddada8c087085e12c1d321b72f35cd1ef6ffb155076e8150 |
| config/api-coverage-metadata.json | 7fc9976841e840120ac355c555abe3ecceb4b387c95320098bc2c5d16e3b79d4 |
| docs/openapi.yaml | addefb086b2afae6c477be3d97a02fab3343b74ab46433829c8a4f6ddc0b6d46 |
| tests/e2e/platform-message-management.spec.ts | e73f8e2ce373e2f4ac2a4fc6207c3772c84cb3159855e219b447be5ecfaf5f72 |
| tests/e2e/m06-02-platform-dashboard.spec.ts | dc949ced1becd59f1e0c7bf98b9fe0ab126e5b59744cb197d70c65ec861bbc66 |
| tests/unit/platform-content.test.mjs | b59646a32e72b3142d04fb2ead2a1e126dd5e5394466929e63bccbe443bd83ad |
| tests/unit/platform-notification-operations.test.mjs | 366dc7309b7def6692fb8edd0861d37e3da3a82b3a713a9b0aa7004e2e3d2f75 |
| tests/m06-02/api-coverage-dashboard.test.mjs | b3a63610a59ed07a73a1598e469c0823c88da72f3436b3d7a9c48588935c93cf |
