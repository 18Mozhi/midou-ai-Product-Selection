# P10–P12 外观、个人中心与首页合同复核

2026-09-08 P12首页C提案：[HOME-C-r1](design/home-direction-c/README.md)32场景/64图。真实HomeDashboardService对明确合成行排序；真实Vue createRule/resumeRule在内存替身上生成十市场POST/首条PATCH。执行当前load确认规则读取失败会清空并自动展开首次设置、缺automatic_selection会回退未配置/零，两者仍为known-gap-not-fixed。图稿的未知值保护、busy/焦点、过期/无权限恢复均未迁入Vue，不算UI2-A10–A12或生产通过。

2026-09-08 P11四分区C提案：[PERSONAL-C-sections-r2](design/personal-sections-direction-c/README.md)31场景/62图覆盖权限、安全、通知、资产，旧资料批24图不变。当前notification-service.validatePreferences拒绝email_enabled=true（503 mail_provider_pending），与UI2-A05模拟邮件保存成功不同；本稿从真实函数提取拒绝结果，不以夹具覆盖后端。mysql-auth-repository仅active会话撤销affectedRows=1，已撤销/过期按钮虽被当前Vue呈现，点击应失败而非删除。新分区错误/未知值禁用、busy与密码错误焦点仅为待审行为改进，未更新真实Vue源或UI2-A07–09验收状态。

2026-09-08 P11首批C提案：[PERSONAL-C-profile-r1](design/personal-direction-c/README.md)新增12场景/24图，账号壳层与基本资料表单先行。四非资料分区8图仅导航审阅，业务内容明确未实现；不计完整P11。源码AST与UI2-A04夹具深比较，七字段+expected_version及邮箱不提交、本地失败保留/刷新回填已覆盖；未改变实际源合同、矩阵、审批或写入竞态待验项。

状态：S03局部语义复核，非全站运行分母冻结或用户设计通过。基线main / `915ee71`；产品源指纹仍为 `c4c1cd7f5470ab3896d355c7e16e49f7b5e291e48809e18eeabbf18198766183`。逐页规格见page-specs/P10.md–P12.md。本文件独立保存人工结论，不覆写生成清单或历史PAGES。

## 1. 入口与依赖

| 页面 | 实际调用链 | 不能混淆的边界 |
| --- | --- | --- |
| P10 `/settings/theme` | App→ThemeStudio→design/theme；ui-preference-routes→preferences服务 | 无前置sessionRequired，但API需要会话与偏好范围；theme PUT落库，density只在模块内存/DOM即时生效 |
| P11 `/me` | 路由会话守卫→App的AccountShell→PersonalCenter；personal-center-routes/service；authorization/auth/notification接口 | 当前使用account壳层，不是蓝图旧段落写的成员壳层。profile仅需本人会话；资产和通知等有各自范围要求 |
| P12 `/home` | NavigationShell→HomeDashboard→HomeAutomationOverview；home-dashboard-routes/service；trend-routes | 读取首页需task:read和真实组织/工作区；监控规则读需trend:read，创建/恢复需trend:manage |

P11的五个分区来自query section；AccountShell只接受profile/permissions/security/notifications/assets，否则回profile。PersonalCenter的旧局部Tab仅在accountShell=false时出现，P11实际使用外层链接导航。P12推荐队列来自automatic_selection.recommended_items，其他待办过滤掉actions中的opportunity，再并入health；changes/follows虽返回但当前没有逐项呈现，只进入total。不能把接口数组存在写成页面展示完成。

## 2. 51 个局部控件候选

前缀T=ThemeStudio、P=PersonalCenter、A=AccountShell、H=HomeDashboard、O=HomeAutomationOverview，文件均为apps/web/src/components/{名称}.vue。候选键可按此前缀还原actions.json完整candidateId；行号只是定位。actionId采用本地稳定语义名，下文各表已写全，不用“按钮N”代替。

| 候选键 | 行 | actionId | 触发 / 条件 / 结果 |
| --- | --- | --- | --- |
| T#9b4b982bf643379f.1 | 123 | AC-ROOT | 品牌→`/` |
| T#4a092ea79d6c2f5a.1 | 126 | AC-PROFILE | →`/me` |
| T#ad505ab637ba2e57.1 | 127 | AC-MFA | →`/security/mfa` |
| T#826731794907a876.1 | 128 | TH-ROUTE | 当前主题链接→自身路径 |
| T#5587941412d5210f.1 | 183 | AC-LOGIN | expired→`/login` |
| T#78d551a8e1f6be17.1 | 184 | AC-CONTEXT | blocked→`/select-context` |
| T#615525e93bd0aa8d.1 | 185 | TH-LOAD | 其他错误→load；刷新最新偏好 |
| T#b5fc72dd64e3a6e6.1 | 200 | TH-PREVIEW | 3主题实例→choose；saving时handler返回 |
| T#e717723479d58780.1 | 222 | TH-DENSITY | 2密度实例→chooseDensity；saving时handler返回 |
| T#b13c528391353263.1 | 237 | TH-RESTORE | dirty时restore；仅撤销theme，不撤销density |
| T#38740096ebfd6c5f.1 | 238 | TH-SAVE | dirty且非saving→PUT；成功saved，失败分态 |
| A#dfb70bc4ca0070a5.1 | 25 | AC-ROOT | 品牌→`/` |
| A#0f58e919e43acff5.1 | 30 | AC-CONTEXT | →`/select-context` |
| A#1f54ecd0f870df67.1 | 34 | AC-SECTION | 5链接实例→`/me?section=…`，不是局部Tab |
| A#508ee18711ffdef2.1 | 42 | TH-ROUTE | →`/settings/theme` |
| A#aa62e5d933afce98.1 | 46 | AC-ROOT | 面包屑应用入口→`/` |
| P#50ca10b185d1647b.1 | 291 | PC-LOAD | 顶部刷新→load |
| P#835072c0eb99454f.1 | 303 | PC-LOAD | profile失败→重新加载 |
| P#1076771cfdefa098.1 | 307 | PC-LEGACY-TAB | 非accountShell才渲染，5局部Tab；P11不重复计算这套导航实例 |
| P#955fa769b3cd8fe0.1 | 322 | PC-SAVE-PROFILE | profile表单submit→saveProfile |
| P#a0c7836a08f38875.1 | 352 | PC-SAVE-PROFILE | 上述表单按钮，合并同一业务动作 |
| P#f395dfc785eeb3e5.1 | 373 | PC-ORG-TOKENS | capability含organization_token:manage→`/org-admin/tokens` |
| P#df188704ef470c64.1 | 382 | AC-MFA | 安全分区→独立MFA页 |
| P#d11c87e9c1045850.1 | 384 | PC-PASSWORD | 安全表单submit→changePassword |
| P#7872fbd4ec279ff5.1 | 407 | PC-PASSWORD | 上述表单按钮；不是第二次写入 |
| P#065748ba997faf11.1 | 416 | PC-REVOKE | 每条会话→DELETE；成功局部移除该id |
| P#a5a06b2da05ee49b.1 | 421 | PC-PREFERENCES | 通知表单submit→savePreferences |
| P#6dacbeb2eac421c9.1 | 432 | PC-PREFERENCES | 上述表单按钮 |
| P#d31010912340ba44.1 | 438 | PC-TREND | 关注记录→`/trends?topic={id}` |
| P#fe2ef7002fcbab8c.1 | 446 | PC-DECISION | 决策记录→`/opportunities/{opportunity_id}` |
| P#ee2568a050e8c314.1 | 456 | PC-TASK | 任务记录全部→`/tasks`，当前没有详情id或mine筛选 |
| H#2471b33884e5515b.1 | 247 | HD-LOAD | 非ready/empty→UiStatePanel primary→load |
| H#5d17be0355b745f2.1 | 272 | HD-RULES | →`/trends?section=rules` |
| H#2fdb8b56f02fb5d4.1 | 275 | HD-OPPORTUNITIES | →`/opportunities`，无view参数 |
| H#169dd3f4eac94585.1 | 278 | HD-START | →`/opportunities/start`，非本页直接创建 |
| H#6baee2bd21cfaaf6.1 | 293 | HD-RESUME | not_configured且pausedRules有值且可管理→恢复第一条；busy禁用 |
| H#d396a13adfe5024b.1 | 301 | HD-SETUP | 可管理且无暂停规则→切setupOpen；局部折叠，不清表单 |
| H#eb4229f8bc621174.1 | 304 | HD-RULES | 无管理能力→查看规则 |
| H#10318724b151ee94.1 | 308 | HD-CREATE-RULE | setupOpen且可管理→createRule |
| H#a3f78d5afc916240.1 | 382 | HD-CREATE-RULE | 上述submit按钮；busy禁用 |
| H#76f38bef42464794.1 | 395 | HD-OPPORTUNITIES | 全部推荐计数链接→`/opportunities`，不假设与下方view链接相同 |
| H#9a0707498a265485.1 | 397 | HD-RECOMMENDATION | 每条推荐→服务端item.route |
| H#8ff687f70195e1ba.1 | 419 | HD-CANDIDATES | 无推荐且rule_candidate_count>0→规则候选view |
| H#ebc903bac2284608.1 | 424 | HD-EVIDENCE | 无推荐/规则候选且awaiting_evidence_count>0→采集中view |
| H#7a7b103459397eaa.1 | 442 | HD-WORK-HEALTH | 非机会待办及health各记录→item.route |
| H#d033e930df518c8e.1 | 459 | HD-TRUTH | 原生details摘要→只切显示，无请求 |
| O#4a67e5db61801646.1 | 22 | HD-RECOMMENDED-VIEW | →`/opportunities?view=recommended` |
| O#94e724cc55ab8a3c.1 | 26 | HD-CANDIDATES | →`/opportunities?view=rule_candidates` |
| O#490c957ac97ec485.1 | 30 | HD-EVIDENCE | →`/opportunities?view=evidence_pending` |
| O#df3fb85e49a879f8.1 | 34 | HD-RULES | →`/trends?section=rules` |
| O#07fccd037ce99d72.1 | 41 | HD-RUNTIME | 原生details→运行计数/时间，无请求 |

### 2.1 P12 HomeDashboard 当前源码位置（2026-09-24）

旧H行仍保留原语义历史；当前组件有18个扫描候选。以下表覆盖每个当前位置，包含读取恢复、路由入口、内联规则、列表路由和只读数据说明。对应的失败态和默认值仍按第3/5节标注为已知缺口，不以这份源映射代替修复或产品行为验收。

#### H

| 当前签名.序号 | 行 | 类型 | 当前语义归属 |
| --- | ---: | --- | --- |
| 68febff0d855d919.1 | 267 | control | HD-CURRENT-READ / 已有快照读取失败时由用户显式重读 |
| 2471b33884e5515b.1 | 270 | event-binding | HD-CURRENT-READ / UiStatePanel主操作事件转给首页load |
| 5d17be0355b745f2.1 | 297 | control | HD-CURRENT-RULES / 打开既有规则页 |
| 2fdb8b56f02fb5d4.1 | 300 | control | HD-CURRENT-OPPORTUNITIES / 查看完整推荐清单 |
| 169dd3f4eac94585.1 | 303 | control | HD-CURRENT-START / 导航至独立创建选品流程 |
| cb01c1a61d2872cd.1 | 318 | control | HD-CURRENT-RESUME / 仅恢复第一条已暂停规则；提交中禁用 |
| 094ecf5aedd69025.1 | 326 | control | HD-CURRENT-SETUP / 在符合状态及能力条件时展开或收起本地首次设置表单 |
| 473fa4f4d2c5e48b.1 | 335 | control | HD-CURRENT-RULES-READ / 规则读取错误时由有管理能力者重读 |
| eb4229f8bc621174.1 | 336 | control | HD-CURRENT-RULES / 无管理能力时只提供规则页查看入口 |
| 68febff0d855d919.2 | 340 | control | HD-CURRENT-READ / 首页/规则状态不完整时显式重新读取 |
| 26550e015743f49c.1 | 346 | form-event | HD-CURRENT-CREATE / 受控首次规则表单阻止原生提交并调用既有createRule |
| a3f78d5afc916240.1 | 435 | control | HD-CURRENT-CREATE / 表单提交按钮；提交中禁用 |
| 8386b9138fc27b68.1 | 448 | control | HD-CURRENT-OPPORTUNITIES / 查看全部推荐数量对应的列表 |
| 9a0707498a265485.1 | 452 | control | HD-CURRENT-RECOMMENDATION / 按服务端返回的item.route打开单条推荐 |
| 673c9efc952a0fcb.1 | 478 | control | HD-CURRENT-CANDIDATES / 仅存在规则候选时进入候选进度视图 |
| e7ad539389d8518c.1 | 483 | control | HD-CURRENT-EVIDENCE / 无推荐/规则候选且有待采集证据时进入采集进度视图 |
| 7a7b103459397eaa.1 | 504 | control | HD-CURRENT-WORK / 使用本人事项或健康记录提供的原始路由 |
| d033e930df518c8e.1 | 521 | control | HD-CURRENT-TRUTH / 原生details披露来源计数/时间和非自动采纳说明，不发请求 |

| 当前源文件 | 当前LF SHA-256 |
| --- | --- |
| apps/web/src/components/HomeDashboard.vue | 495943920cb36dc4686350857e4e00c65da0a207b393b2b9283b9e4449fdacb0 |

### 2.2 P11 PersonalProfilePanel 当前源码位置（2026-09-24）

旧P11表描述PersonalCenter父级行为；本节只登记当前资料子组件的9个静态候选。表单阻止浏览器原生提交并向父级发出submit，字段只发updateField；实际PATCH仍归PersonalCenter/composable，未在此子组件发请求。邮箱是只读事实，不作为候选或资料更新字段；手机号验证状态也只展示当前服务端事实，不表示本次输入已验证。

#### apps/web/src/components/personal-center/PersonalProfilePanel.vue

| 当前签名.序号 | 行 | 类型 | 当前语义归属 |
| --- | ---: | --- | --- |
| eb06bfc56733f195.1 | 27 | form-event | PC-CURRENT-SAVE / 阻止原生表单提交并向父级发出submit意图 |
| a009961494d9e9f6.1 | 45 | event-binding | PC-CURRENT-USERNAME / 更新登录用户名草稿；保存中禁用 |
| 85e98ee3a227ab53.1 | 62 | event-binding | PC-CURRENT-DISPLAY-NAME / 更新必填显示名称草稿；保存中禁用 |
| c3282a4a6e5e0694.1 | 76 | event-binding | PC-CURRENT-AVATAR / 更新头像HTTPS地址草稿；保存中禁用 |
| 606f704e56cefdda.1 | 91 | event-binding | PC-CURRENT-PHONE / 更新手机号草稿；验证状态单独显示且不由输入伪造 |
| 710e66a207790a9d.1 | 108 | event-binding | PC-CURRENT-LOCALE / 更新当前语言选项草稿；保存中禁用 |
| dabba198cd2f2993.1 | 122 | event-binding | PC-CURRENT-TIMEZONE / 更新必填时区草稿；保存中禁用 |
| 927fb4495afb35c9.1 | 135 | event-binding | PC-CURRENT-REASON / 更新必填修改原因草稿，输入上限300字符 |
| 9f646e1e9f714001.1 | 161 | control | PC-CURRENT-SAVE / 提交资料；保存中禁用并显示处理中状态 |

| 当前源文件 | 当前LF SHA-256 |
| --- | --- |
| apps/web/src/components/personal-center/PersonalProfilePanel.vue | 5342047bd8fe79d5756cf13b86d2481bc329f279d0900da69a067845bd2cccf5 |

本节只提供当前静态位置和既有父子事件边界；API字段、expected_version、服务端验证与资料读写合同仍以第3节和真实路由/服务为准，不由子组件映射推导新业务行为。

### 2.3 P11 PersonalSecurityPanel 当前源码位置（2026-09-24）

本组件把MFA路由、密码表单、设备会话读取状态和撤销意图呈现出来；密码字段更新、改密和撤销事件均交由PersonalCenter/usePersonalCenter处理。`writesBusy`在父级包含资料、偏好、改密及会话撤销写入，子组件据此禁用密码字段/提交和撤销按钮；此处不把按钮文案当成后端会话语义证明。

#### apps/web/src/components/personal-center/PersonalSecurityPanel.vue

| 当前签名.序号 | 行 | 类型 | 当前语义归属 |
| --- | ---: | --- | --- |
| df188704ef470c64.1 | 41 | control | PC-SEC-CURRENT-MFA / 前往独立MFA管理页面 |
| dc5d22c3a87ae385.1 | 44 | form-event | PC-SEC-CURRENT-PASSWORD / 阻止原生提交并向父级发出改密意图 |
| 5c2165d671fbd739.1 | 48 | event-binding | PC-SEC-CURRENT-CURRENT-PASSWORD / 更新当前密码草稿；写入忙碌时禁用 |
| 25ca5cb1035e2e53.1 | 59 | event-binding | PC-SEC-CURRENT-NEW-PASSWORD / 更新新密码草稿；写入忙碌时禁用 |
| d4f7ed296afcee0c.1 | 70 | event-binding | PC-SEC-CURRENT-CONFIRM-PASSWORD / 更新本地确认草稿；写入忙碌时禁用 |
| bc7ca7fd3084258d.1 | 80 | control | PC-SEC-CURRENT-PASSWORD / 向父级提交改密意图；所有写入忙碌时禁用 |
| a5059536719adc96.1 | 106 | event-binding | PC-SEC-CURRENT-SESSION-READ / 呈现会话分区读取状态并转发重试 |
| 7b6cd9865a93baa7.1 | 124 | control | PC-SEC-CURRENT-SESSION-REVOKE / 转发指定会话ID撤销意图；读取未就绪或写入忙碌时禁用 |

| 当前源文件 | 当前LF SHA-256 |
| --- | --- |
| apps/web/src/components/personal-center/PersonalSecurityPanel.vue | 24ca6d5a80e5edb05a98ffdf8dcc8ededc32b14eb43b41dff07bec6cf409d43b |

静态映射不替代服务端或真实会话验收；当前撤销入口仍未按session.status隐藏非活动项且没有二次确认，保留为第3/5节所述待验行为。

五文件没有本地dialog定义/确认调用候选；资料、密码、通知、首页规则均为内联form。主题选择使用自定义radio按钮，不是v-model字段。PersonalCenter有15个v-model位置、HomeDashboard有7个，共22个输入位置；另邮箱是disabled展示输入。P12共享UiStatePanel在部分错误态生成secondary但调用方无监听，属于共享消费者缺口，不加进上述五文件51项分母。

## 3. 写入与状态连续性

| 动作 | 实际输入、请求与成功结果 | 重设计必须保留或补验 |
| --- | --- | --- |
| TH-SAVE | PUT /me/ui-preferences `{theme,expected_version}`；版本取最近saved结果 | 三兼容ID不改；无density字段。applyTheme预览立即写scoutops:ui-theme缓存，服务器保存是另一层事实 |
| TH-RESTORE | selected=saved.theme或deep-ocean，再applyTheme | 不恢复密度。主题saving时该按钮未额外禁用，撤销与保存完成竞态待验；不把按钮可点等同安全完成 |
| PC-SAVE-PROFILE | PATCH /me/profile：username/display_name/avatar_url/phone/locale/timezone/reason及profile.version→expected_version | 7输入；邮箱disabled不提交。服务端校验HTTPS、手机号、用户名及版本；无短信验证API，手机号变化仍未验证 |
| PC-PREFERENCES | PUT /me/notification-preferences：expected_version与in_app/email/task/approval/competitor五个_enabled布尔值 | 返回替换preferences。无免打扰时段、无热点/异常额外开关，不按旧蓝图凭空增加字段 |
| PC-PASSWORD | POST /me/password `{current_password,new_password}`；确认值只本地比较，成功replace/login | 三输入required/minlength12；确认字段不发送；父级writesBusy阻止并行个人资料/偏好/改密/会话写入。具体会话失效范围以服务端行为为准；不新增身份流程 |
| PC-REVOKE | DELETE /me/sessions/{id}；成功filter本地sessions | 当前未按session.status过滤撤销按钮，无二次确认弹窗；真实会话撤销只能用隔离身份验 |
| HD-CREATE-RULE | POST /trends/monitoring-rules，7输入生成name/include_keywords/negative_keywords/market/language/category/notification_channel/collection_interval_minutes/recommendation_min_source_count | 关键词按英文逗号、中文逗号或换行拆分，trim并去空，不自行去重。空名称用首关键词，空分类null，渠道in_app，语言按市场现有映射 |
| HD-RESUME | PATCH /trends/monitoring-rules/{id}：status=enabled、expected_version、原collection_interval_minutes和recommendation_min_source_count | 仅暂停目录第一条；前端不可擅自扩为全部恢复。成功重读首页/规则，不表示采集已完成 |

主题来源source/default、organization_id/workspace_id/version来自真实偏好结果；主题名/颜色待新方向确定，可以重做外观但不重命名兼容ID。当前三个主题都是light，density标准/紧凑由preferredDensity内存保存，行政壳层强制compact；刷新不保证恢复此前密度。预览中的87分、18.4%、96%等为写死样例，不是当前业务事实，新稿必须显式标明示例。

PersonalCenter先请求profile，成功立即ready，再Promise.allSettled等四个分区全部返回；不是每区完成即单独呈现。sequence保护整轮load结果，但call每次仍可写requestId，写入没有同类归属/忙碌保护。失败区回退空或默认对象，只有汇总notice；不能说分区有独立错误/重试或默认通知值已被服务器确认。截图中的空会话/资产不得替代失败证据。

首页先读summary后等规则GET结束；规则错误catch置[]且无单独错误。summary缺automatic_selection时计算默认not_configured/0，并不证明真实未配置；not_configured且可管理且rules为空会自动展开设置。创建成功关表单但不清setupForm，重读失败也不能抹掉已创建的事实。源代码没有本页轮询/页面激活scope watcher，KeepAlive下跨范围/返回更新需单独验证，不能从任务页修复推断首页已覆盖。

## 4. 可执行验证卡与范围

| caseId | 验证步骤与断言 | 本批证据 / 尚未覆盖 |
| --- | --- | --- |
| UI2-A01 | 密度compact不变更dirty、不PUT；主题预览→撤销不改变density；刷新恢复standard，主题缓存恢复saved | 新独立E2E；不证明服务器跨会话持久化 |
| UI2-A02 | 两次主题保存精确body与幂等键，版本5→6；重新加载匹配保存结果 | 新E2E仅拦截响应，不证明数据库事务 |
| UI2-A03 | PUT409冲突→刷新GET新主题/版本9→重新选→PUT携带9 | 新E2E；并行窗口真实竞争、保存中撤销未覆盖 |
| UI2-A04 | 资料成功、三个租户分区403、会话空；仍可PATCH资料、准确字段/版本且零成员navigation GET | 新E2E；没有宣称失败区的空/default展示正确，也不是实际RBAC证明 |
| UI2-A05 | 五通知开关准确PUT，第一次版本7，第二次使用返回8；邮件开/关提示分别验证 | 新E2E；没有发送邮件或验证投递 |
| UI2-A06 | 主题401/403/429/503/invalid-theme、慢保存/撤销、radio方向键及焦点 | 待补；旧m02-01-theme-studio只覆盖常规预览/保存、scope受阻、密度 |
| UI2-A07 | P11五query分区/非法值、手机六图标链接可访问名、返回/刷新连续性 | 待补；m02-03-navigation-shell只有账户壳层局部证据 |
| UI2-A08 | 资料格式/版本冲突/双提交；改密不一致零POST、成功会话失效；会话撤销取消/失败/成功 | 待补；tests/unit/personal-center.test.mjs及m01-01 auth测试不能替代Vue全链 |
| UI2-A09 | 分区延迟/失败不伪空、未知通知状态不误保存；首次load/再次load/写入返回时事实与requestId同源 | 待补；UI2-A04只证明资料可用，不证明所有分区状态安全 |
| UI2-A10 | 首页四计数和两details、推荐与候选/采集互斥入口，item.route与排序结果不变；仅投影为空时诚实空态 | 复用m02-06-home-mobile；本批未重跑首页，changes/follows缺少呈现保留缺口 |
| UI2-A11 | 首次规则7输入→精确POST及返回；暂停规则只恢复首条且完整PATCH；无manage能力零写；失败保留 | 待补；依trend-routes真实合同，不触发真实第三方采集 |
| UI2-A12 | 规则GET失败不冒充无规则、summary缺字段、首页401/403恢复动作、跨范围/缓存/迟到响应 | 待补；原首页测试不能证明这些分支已完成 |

测试文件为tests/e2e/ui-phase2-account-contracts.spec.ts，具体运行结果以PROGRESS本批记录为准。所有API响应来自本地隔离夹具，未知业务能力不自动启用。真实写入只在明确隔离账号/组织/工作区完成，清理按ID核对；不改普通用户资料/密码/MFA，不向真实用户发邮件，不恢复生产采集规则作试验。

## 5. 新设计前必须处理的缺口

- **分区事实性**：P11的`Promise.allSettled`后失败区赋空/default而没有逐区error，P12规则GET catch赋[]。需先补失败回归，再设计可区分加载/失败/真实空的分区；不更改API或默认业务偏好。
- **可访问名称**：AccountShell移动样式`.account-sidebar a span { display: none; }`，AppIcon为aria-hidden，链接自身无aria-label。需核实实际移动可访问树并补名称；不能只看图标可见就通过键盘/读屏验收。
- **交互语义**：ThemeStudio role=radio按钮只有click、无方向键或roving tabindex；获审实现须选原生radio或补完整键盘合同。多个表单错误没有字段关联，PersonalCenter错误也用统一success色notice；不把旧色彩视为新设计约束。
- **恢复语义**：ThemeStudio把rate_limited和blocked等统一呈现“尚未选择组织与工作区”，不一定符合真实原因；HomeDashboard给所有错误primary“重新读取”，secondary无监听。新稿必须基于真实错误而非假动作提供恢复。
- **数据范围与层级**：P11没有申请权限、取消收藏、最近浏览或免打扰实际控件；P12没有逐条变化/关注区，资产任务链接也未指向详情。明确缺口后审核相应现有入口呈现，不凭蓝图添加业务字段/能力。

正式图应分别覆盖P10三主题/两密度、P11五分区及资料成功/部分失败、P12运行/需检查/未配置/暂停/表单/空队列与错误。全部桌面/移动，控件和内联表单状态另计。三个页面的最终图、Vue新布局和生产验证仍待完成；本批只增加规格、合同、测试及索引，不改生产源码、主题令牌、API、数据库、依赖或配置。
