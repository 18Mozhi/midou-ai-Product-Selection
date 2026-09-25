# W05 平台八页事实、控件与弹窗合同

2026-09-11 共享复制增量：TechnicalDetails 的哈希行已更新为当前实现；其余历史描述不扩大为最新验收。复制拒绝现有就地反馈、重试和迟到结果隔离，见 [共享复制反馈复核](TECHNICAL-COPY-FEEDBACK-REVIEW.md)。无 API、权限或复制内容调整。

历史依据：main/c5d647c，2026-09-08实际源码核对；本批补七份规格及父/共享清单，复用P43，不宣称正式设计、完整运行时验证或生产通过。范围P38–P45，路由/组件见各页规格；API以下短路径均由既有客户端加/api/v1。全局导航属于W01共享壳层，本合同不代替NavigationShell及全站G0。2026-09-24用户已统一批准73页视觉方向；G0源语义、完整运行时和生产门仍分别核验。

## 1. 数量口径与源码别名

11个本族Vue文件共112个静态候选、23处v-model；其中P43四文件33候选/9绑定复用[用户合同](platform-user-design-contract.md)，本表补其余79候选/14绑定。四个跨模块共享组件另有16候选/1绑定，总计该历史快照核对128候选/24绑定。该数字保留为当时的静态清单，不是当前Vue分母或128个业务动作；当前候选与指纹以[当前合同接续](platform-account-current-contract.md)的118候选/38源表为准。form/button、事件转发、定义/调用均可能归并；v-for实例、权限/状态及嵌套关系仍需运行时扩展，不能凭静态数量冻结G0。

别名全部位于apps/web/src/components/：D=PlatformDashboard.vue，C=PlatformAccountCenter.vue，O=PlatformOrganizationRecords.vue，M=PlatformAdminRecords.vue，W=OrganizationCreationWizard.vue，G=PlatformOrganizationDetailDialog.vue，R=PlatformRoleComparison.vue；P43既有A=PlatformAccountDialogs.vue、U=PlatformUserRecords.vue、V=PlatformUserDetailDialog.vue、F=PlatformUserMembershipForm.vue。共享S=ResponsiveDataView.vue、Q=ResponsiveFilterDrawer.vue、T=TableViewControls.vue、X=TechnicalDetails.vue。sig只在所属文件内唯一，不跨文件相加去重。

### 1.1 本族新增79候选的逐对象归属（历史快照）

此表保持2026-09-08初始归属的语义记录；其中`PlatformAccountCenter.vue`有23个旧签名已在当前源码中不存在，见1.6。它们不计入当前候选覆盖；当前118候选及源码身份以[当前合同接续](platform-account-current-contract.md)和后续精确增量为准，不推定23条旧身份与新签名一一对应。

| 文件 | candidate sig | 归属/真实语义 |
| --- | --- | --- |
| D | 41083a84c60ec185.1 | PA38-WINDOW 时间窗change→URL replace→load |
| D | 15e83f4e8898e4d7.1 | PA38-REFRESH 页头刷新 |
| D | 17f7411f1727355d.1 | PA38-REFRESH 首读失败重试 |
| D | 5587941412d5210f.1 | PA38-LOGIN expired时跳/login |
| D | 3569d8f0f015857e.1 | PA38-REFRESH 快照刷新失败重试 |
| D | 65c09ba74ca8870b.1 | PA38-COLLECTION 跳/platform-admin/collection |
| D | d1c0b626714a7ff9.1 | PA38-ROOTCAUSE 跳collection/overview?root_cause=1 |
| D | 52444eba9c2a98bc.1 | PA38-ORGANIZATIONS 规模区跳组织列表，superadmin限定 |
| D | c4dfc8f822a18263.1 | PA38-USERS 规模区跳用户列表，superadmin限定 |
| D | 06b4b917d7a90e96.1 | PA38-SOURCES 规模区跳providers/sources |
| D | 348b42f6f4eb388b.1 | PA38-COLLECTION 规模区跳采集任务 |
| D | 9ae1b37e258dde35.1 | PA38-DATA 跳/platform-admin/data |
| D | f84b8209be451866.1 | PA38-ORGANIZATIONS 常用入口，superadmin限定 |
| D | 5074531b9e5b8a16.1 | PA38-SOURCES 常用来源入口 |
| D | 1ce54f6253c32ad1.1 | PA38-QUEUE 常用collection/overview入口 |
| D | ba487bb14816185a.1 | PA38-SOURCES 无趋势时配置来源入口 |
| D | 2e8c2f831b1b02a5.1 | PA38-QUEUE 无趋势时查看队列入口 |
| D | 1c008f867673db60.1 | PA38-TECH 来源预览ID/code展开，无复制 |
| D | d604390773d9cd06.1 | PA38-PROVIDERS 展开/收起全部来源，本地 |
| D | 1c008f867673db60.2 | PA38-TECH 告警org/workspace ID展开，无处理告警 |
| C | adcd96ea7cc90712.1 | PA45-ADMINS 跳管理员管理 |
| C | bcd4023ebe5d9ca9.1 | PA45-REFRESH 刷新角色目录 |
| C | 280136c1a545dff9.1 | PA-ORG-CREATE 非P45页头打开组织向导 |
| C | 1516ea5a6c3b1540.1 | PA-USER-CREATE 新用户/管理员，admins默认运营角色 |
| C | c4cfef52bcc169fb.1 | PA45-REFRESH 角色首读错误重试 |
| C | c526b71b2b59e702.1 | PA45-REFRESH 空角色目录重新检查 |
| C | 5db731eeed33ba4f.1 | PA41 向导clearError/close/submit事件集合 |
| C | 559dcb14c786950e.1 | PA43窗口事件集合：创建、密码、原因、关闭、reason更新 |
| C | 1fff4198190d6ece.1 | 同上一项AccountDialogs组件调用，非新增业务动作 |
| C | 39878a11789ae9ce.1 | PA43 close/retry/status/role/membership/password/session转发 |
| C | cab997ead119619a.1 | 同上一项用户详情组件调用 |
| C | 6f151cbab1f5518e.1 | PA42 close/retry/clear-feedback/save/toggle-status事件转发，非新增动作 |
| C | 39ba950db197263c.1 | 同上一项PlatformOrganizationDetailDialog调用 |
| O | 6923b73e52535ef3.1 | PA-ORG-DETAIL 桌面详情；busy禁用 |
| O | 2a07373cb016b4b5.1 | PA-ORG-DETAIL 移动预览→详情并close预览 |
| O | 1c008f867673db60.1 | PA-ORG-TECH 预览UUID展开 |
| M | b77b1781563a48b8.1 | PA43-DETAIL 桌面管理员账号详情 |
| M | 18553297e6cbdd0a.1 | PA43-DETAIL 移动预览→详情并close预览 |
| M | 1c008f867673db60.1 | PA44-TECH 预览用户UUID展开 |
| W | 0b065ffdf54ab12b.1 | PA41-DIALOG 原生向导定义 |
| W | faacd7ed42835c46.1 | PA41-CANCEL 原生cancel→父关闭 |
| W | dbb9c697adbd2614.1 | PA41-CANCEL 按钮取消，step回1 |
| W | d4a2da9643d6151e.1 | PA41-BACK 返回上一步清错误 |
| W | 10583294b61e5704.1 | PA41-NEXT reportValidity后进入确认 |
| W | 8f34ceeac7432a4a.1 | PA41-CREATE 最终submit按钮 |
| G:31 | f1666fd06fb5d95e.1 | dialog-definition | PA42-DIALOG 原生组织详情定义 |
| G:31 | 452d85f008176563.1 | event-binding | PA42-CLOSE Escape→父关闭/回列表 |
| G:58 | e86ba35d079de0d3.1 | control | PA42-CLOSE missing返回列表 |
| G:94 | 305725c44ab6a8ed.1 | control | PA42-CLOSE 页首关闭 |
| G:165 | 1c008f867673db60.1 | control | PA42-TECH slug/UUID展开 |
| G:193 | 02668382bdda9d3b.1 | control | PA42-CLOSE 页尾关闭 |
| R | e4a2fbf8875f3488.1 | PA45-RESET 比较重置，P44共享但不写URL |

### 1.2 共享16候选及调用差异

| 文件 | candidate sig | 归属/真实语义 |
| --- | --- | --- |
| S | 6da4dad42cb34c8d.1 | PA-S-PREVIEW 移动每条记录打开预览 |
| S | 847801b2ac6e7a17.1 | PA-S-CLOSE 页首关闭与返回触发器焦点 |
| Q | 28fb788b88500472.1 | PA-Q-KEY 外包装键盘处理 |
| Q | e03968eb8d9e92a8.1 | PA-Q-KEY Teleport后键盘处理 |
| Q | 483082db5a776bf3.1 | PA-Q-CLOSE 筛选遮罩关闭 |
| Q | df1390feb7424a07.1 | PA-Q-CLOSE 筛选页首关闭 |
| Q | cd956325fcd081da.1 | PA-Q-CLOSE 捕获form submit先关闭抽屉 |
| Q | 7e0fa28eaeb1cc09.1 | PA-Q-OPEN 手机筛选触发按钮调用show |
| T | e2fd0d02cbd9f684.1 | PA-T-COLUMNS 原生details列设置 |
| T | 921f4be18a3fe814.1 | PA-T-COLUMN 每列checked/change，至少留一列 |
| T | d09cd5524db7bee5.1 | PA-T-FREEZE 冻结/取消首个可见列 |
| X | b3ffca8eb967d682.1 | PA-X-EXPAND 请求/链路/技术项原生展开 |
| X | c19091da9e2471f1.1 | PA-X-COPY 每项复制系统剪贴板，1500ms反馈 |

S/T本族四类消费者为D来源健康、O组织记录、U用户记录、M管理员记录；动态列数分别4/5/5/3，T从实际th读取，不把这四组扩成四个不同共享组件。Q由父C调用，非P45筛选区使用；X在D失败态与ready观测footer调用，其props当前只给requestId；局部原生技术details没有自动获得X复制能力。

### 1.4 2026-09-24 当前源位置补记

上表新增8个当前候选，来自 P39 第二组三条导航（仅 `!adminListRoute` 分支）、筛选抽屉调用/提交、组织详情子组件调用/事件及共享筛选触发。三条导航仍归并到既有 PA-NAV 组；抽屉、form 与详情事件是容器/提交/转发，不因此增加业务写动作。依据 `PlatformAccountCenter.vue` 与 `ResponsiveFilterDrawer.vue` 当前模板和 handler 定义；此补记只校准静态源身份，不代表完整变体、读屏、RBAC或生产验收。

为 `PlatformOrganizationDetailDialog.vue` 当前14个静态候选补齐8个当前位置；旧记录中6个仍匹配身份继续保留，7个已失效身份仅用于追溯。missing态和保存后回读警告中的“重新加载”均是父级重读意图；表单提交与提交按钮归并为同一保存意图，组织状态按钮只把目标交给父级原因窗，不在本组件内写入。名称、时区、保留天数仍受控于既有字段合同。本节的精确位置与指纹只证明静态映射，不代表弹窗交互、服务端校验、RBAC或生产验收。

| 组件行 | candidate sig | kind | 当前语义 |
| --- | --- | --- | --- |
| G:50 | 106fea94b943db73.1 | control | PA42-RETRY missing态重新加载组织列表 |
| G:62 | ed675af42a95eee6.1 | form-event | PA42-SAVE 表单提交意图，实际保存由父级处理 |
| G:102 | e9b3a32bc524be8e.1 | event-binding | PA42-INPUT 组织名称受控输入并清理旧反馈 |
| G:116 | e2d410a205d6addc.1 | event-binding | PA42-INPUT 时区受控输入并清理旧反馈 |
| G:129 | f5028ff7b6963e7c.1 | event-binding | PA42-INPUT 保留天数受控输入并清理旧反馈 |
| G:155 | 9135d46a904a737d.1 | control | PA42-RETRY 保存成功后重新读取组织资料 |
| G:182 | c912786107f1a3c8.1 | control | PA42-STATUS 将停用/恢复目标交给父级原因窗 |
| G:194 | 1c447b2a32d2d030.1 | control | PA42-SAVE submit按钮，与form提交归并 |

#### PlatformOrganizationDetailDialog.vue 当前源码指纹

| 文件 | SHA-256 |
| --- | --- |
| apps/web/src/components/PlatformOrganizationDetailDialog.vue | 99466d18329d4315db351e535f52214ae0c14d9d8cec8fc47307d41b4afb487e |

#### 1.5 P42旧组织详情身份（历史）

下列七个 G 组件签名只保留早期身份供追溯；替代身份见上方当前源码表，不计入当前候选覆盖。此静态归档不等于弹窗交互、接口、RBAC或生产验收。

| 旧candidateId | 原始语义 | 当前替代身份 |
| --- | --- | --- |
| apps/web/src/components/PlatformOrganizationDetailDialog.vue#6fbf23d3aefd32ed.1 | PA42-RETRY missing重新读取概览 | G#106fea94b943db73.1 PA42-RETRY |
| apps/web/src/components/PlatformOrganizationDetailDialog.vue#806c920618d07330.1 | PA42-SAVE form→原因确认 | G#ed675af42a95eee6.1 PA42-SAVE |
| apps/web/src/components/PlatformOrganizationDetailDialog.vue#c86975c19b2b8d14.1 | PA42-INPUT name清反馈 | G#e9b3a32bc524be8e.1 PA42-INPUT |
| apps/web/src/components/PlatformOrganizationDetailDialog.vue#68c23982ea6f10d3.1 | PA42-INPUT timezone清反馈 | G#e2d410a205d6addc.1 PA42-INPUT |
| apps/web/src/components/PlatformOrganizationDetailDialog.vue#1ddc3f63c9d2ad7d.1 | PA42-INPUT retention清反馈 | G#f5028ff7b6963e7c.1 PA42-INPUT |
| apps/web/src/components/PlatformOrganizationDetailDialog.vue#758ab89691c1c72b.1 | PA42-STATUS 停用/恢复进入原因窗 | G#c912786107f1a3c8.1 PA42-STATUS |
| apps/web/src/components/PlatformOrganizationDetailDialog.vue#b8fc8632d25866fd.1 | PA42-SAVE submit按钮，与form归并 | G#1c447b2a32d2d030.1 PA42-SAVE |

Q动态`:role="overlay ? 'dialog' : 'group'"`未被当前扫描器识别为dialog-definition；已人工补记移动筛选模态，不能据零定义漏验。Q以760px matchMedia切换，离开移动关闭；submit捕获立即收起，不等待查询结果，重置type=button不触发这条关闭路径；取消保留父字段。S初始聚焦关闭按钮，close返焦点，但源码没有显式Tab循环、背景inert或KeepAlive离开清理；selectedKey所指记录临时消失后又回来也需复验，不直接推断安全。

T只在组件内保存hiddenColumns索引/freezeFirst/density；默认全显示、冻结、standard，至少一可见列。改变列结构只清越界索引，语义换列/缓存复用需验；不是后端分页/排序/持久化偏好。基础控件min-height=36，是否被生产令牌/选择器覆盖需实际computed检查，不称已满足44。X复制没有catch及卸载清理timer；本批不调用真实剪贴板，不宣称复制错误/迟到反馈已处理。

### 1.3 输入绑定（24处，不以事件扫描替代）

| 文件 | v-model表达式 | 当前合同 |
| --- | --- | --- |
| D | windowCode | 四个固定窗；change读API并替换URL |
| C | query | URL初始化/服务截断120；提交trim |
| C | status | URL初始化/服务截断30；选项按真实路由 |
| A | userForm.email | 原生邮箱、后台normalize |
| A | userForm.temporary_password | 新建12–128；不落浏览器存储 |
| A | userForm.platform_role_code | 三固定平台角色或空 |
| A | userForm.organization_id | 概览组织选项或空 |
| A | userForm.organization_role_code | 初始组织member/organization_admin |
| A | passwordForm.temporary_password | 改密12–128，再进原因窗 |
| W | form.name | 必填2–120 |
| W | form.slug | 必填2–63；首位字母/数字，末位连字符当前允许 |
| W | form.initial_admin_user_id | 可选已有active用户，空取操作者 |
| G | form.name | 必填2–120 |
| G | form.timezone | 必填≤64，后端不做IANA目录校验 |
| G | form.data_retention_days | v-model.number，整数30–3650 |
| F | form.organization_id | 可加入的active组织且无既有关系 |
| F | form.role_code | member/selection_manager/procurement_member/organization_admin/auditor |
| F | form.reason | trim后2–300，内联表单而非共享原因窗 |
| R | differencesOnly | 默认true；P45映射show_all |
| R | compareLeft | 默认platform_operations_admin |
| R | compareRight | 默认platform_security_admin |
| R | capabilityQuery | 名称/编码包含过滤，最多80 |
| R | capabilityGroup | 本地中文分组，初始化最多40 |
| T | density | standard/compact，当前实例，不写URL/API |

共享原因textarea是value/input转发，属于A的候选b313681d9ad25f0e.1，不是漏掉的第25处v-model；列开关为checked/change也非v-model。原生select弹层不作为产品业务弹窗。

### 1.6 P39账号中心早期身份归档（历史）

以下23个C身份属于初始源码快照，当前`PlatformAccountCenter.vue`中均已无该签名。当前合同接续基于真实源码扫描确定候选集，但没有为这23个旧控件逐条声明一一替代项；因此这里只保留旧语义和追溯身份，不推定按钮/导航/筛选/父级事件仍按旧实现运行。P39当前刷新增量见第9节。

#### PlatformAccountCenter.vue

| 旧candidateId | 初始快照语义 |
| --- | --- |
| C#eedb593a22243281.1 | PA-REFRESH 刷新账号，refreshing/busy禁用 |
| C#6d8a89fda1f94214.1 | PA-NAV-ORG 跳P40 |
| C#454d991f8fed8550.1 | PA-NAV-USER 跳P43 |
| C#4681ec75ac4845ca.1 | PA-NAV-ADMIN 跳P44 |
| C#3ba83336a51e7303.1 | PA-FILTER-DRAWER 共享筛选调用，不是独立业务写窗 |
| C#e112a995ce86318a.1 | PA-FILTER form→applyFilters |
| C#ebbfe99328a93a8a.1 | PA-FILTER 搜索submit按钮，与form归并 |
| C#08063437101eb52f.1 | PA-RESET 重置query/status；无条件/刷新时禁用 |
| C#6a22c249121aeb4d.1 | PA-REFRESH 账号首读错误重试 |
| C#d4e23c718ed64cd0.1 | PA-RESET 组织筛选空态清除 |
| C#9ea6aa71cb45580a.1 | PA-ORG-CREATE P40无组织空态新建 |
| C#15769a468957ac3f.1 | PA-ORG-DETAIL 组织记录事件转发 |
| C#df9b0cebe8f296a1.1 | PA43-DETAIL 用户记录事件转发 |
| C#d4e23c718ed64cd0.2 | PA-RESET 管理员筛选空态清除 |
| C#64fa4a4db515a792.1 | PA-USER-CREATE 管理员空态新建 |
| C#23e58bc5ed3b6439.1 | PA43-DETAIL 管理员记录转同一用户详情 |
| C#4eb362af5381776f.1 | PA42 close/retry/clearFeedback/save/toggleStatus转发 |
| C#c43be07eff2d7020.1 | PA42组织详情组件调用 |
| C#6d8a89fda1f94214.2 | PA-NAV-ORG 同一组织管理路径；`!adminListRoute` 导航分支 |
| C#454d991f8fed8550.2 | PA-NAV-USER 同一用户管理路径；`!adminListRoute` 导航分支 |
| C#4681ec75ac4845ca.2 | PA-NAV-ADMIN 同一管理员管理路径；`!adminListRoute` 导航分支 |
| C#1d3e2d941d1ed0f3.1 | PA-FILTER-DRAWER ResponsiveFilterDrawer调用；共享容器，不另计业务动作 |
| C#636343c5842c998f.1 | PA-FILTER form提交调用applyFilters；搜索与form语义归并 |

### 1.7 P41组织创建向导早期身份归档（历史）

以下四条属于早期 `OrganizationCreationWizard.vue` 快照，当前源码签名已变化。第8节记录现行表单提交事件及三个字段事件；两组映射只按语义归属对照，不宣称逐控件身份连续、创建请求由子组件发出或运行时交互已验收。

| 旧candidateId | 初始快照语义 | 当前语义参照（非一一替代声明） |
| --- | --- | --- |
| apps/web/src/components/OrganizationCreationWizard.vue#fa23daedbd2c0827.1 | PA41-CREATE 表单提交 | 第8节现行表单提交事件映射：向父层转发 submit |
| apps/web/src/components/OrganizationCreationWizard.vue#b18325f688280598.1 | PA41-INPUT 名称变化清错误 | 第8节现行名称字段映射：输入及 clearError 事件 |
| apps/web/src/components/OrganizationCreationWizard.vue#494420d478dadefe.1 | PA41-INPUT 标识变化清错误 | 第8节现行标识字段映射：输入及 clearError 事件 |
| apps/web/src/components/OrganizationCreationWizard.vue#47a9ebd58cf57e57.1 | PA41-INPUT 初始管理员变化清错误 | 第8节现行管理员字段映射：选择及 clearError 事件 |

### 1.8 共享手机详情与筛选旧身份归档（历史）

以下四个共享控件签名来自较早源码快照。现行 `ResponsiveDataView` 的焦点/键盘边界由[共享详情动作归属表](responsive-detail-focus-contract-review.md)独立维护；`ResponsiveFilterDrawer` 的打开触发器仅增补 `aria-controls`。这里保留旧签名供历史追溯，不表示旧候选仍是当前身份，也不把共享组件源级核对扩大为全部页面消费者的生命周期验收。

| 旧candidateId | 旧快照语义 | 当前语义参照 |
| --- | --- | --- |
| apps/web/src/components/ResponsiveDataView.vue#4fa7deb3456a41ae.1 | PA-S-CLOSE 预览Escape | 共享详情动作表：现行键盘候选覆盖 Escape 关闭及 Tab 循环 |
| apps/web/src/components/ResponsiveDataView.vue#53d89072117d7eda.1 | PA-S-CLOSE 遮罩按钮关闭 | 共享详情动作表：现行遮罩关闭候选不进入 Tab 序列 |
| apps/web/src/components/ResponsiveDataView.vue#e23893d134b1daa1.1 | 共享 role=dialog 预览定义 | 共享详情动作表：现行命名详情定义候选 |
| apps/web/src/components/ResponsiveFilterDrawer.vue#beb5f8d5846aa028.1 | PA-Q-OPEN 移动筛选触发按钮 | 当前合同第1.2节：增加 aria-controls 的打开触发候选 |

## 2. 语义动作与真实调用链

| 动作族 | 前置→请求/效果 | 结果与边界 |
| --- | --- | --- |
| PA38读取 | platform:operate；GET /platform/dashboard?window | 返回聚合及request/trace ID；后端另写读取与审计事务，不执行采集控制 |
| PA读取/筛选/刷新 | platform:superadmin；GET /platform/accounts?query&status | 各数组最多200，summary未筛选；无分页参数。query/status同条件主动load，不同条件replace后watch读取 |
| PA45角色读取 | 父GET /platform/roles；本页不读accounts | P45角色空/错独立状态；P44先账号再角色，role失败不清账号事实 |
| PA-ORG-CREATE/PA41 | 原生校验/两步；POST /platform/accounts/organizations | name/slug/可选initial_admin_user_id，成功原子创建默认范围并跳P42；无人工reason |
| PA42-SAVE | 详情三字段→原因；PATCH /platform/accounts/organizations/{id} | name/timezone/data_retention_days/reason，无expected_version；成功load后从数组找组织 |
| PA42-STATUS | 组织状态→原因；POST organizations/{id}/status | active/archived+reason，保存/停用/恢复文案分别验 |
| PA-USER-CREATE | P39/P40/P43或P44创建；POST /platform/accounts/users | 五字段，空组织/平台角色转null，无人工reason；P44默认运营角色但不改接口 |
| PA43详情及写入 | 用户/管理员共享；GET users/{id}，status/platform-role/password/sessions/revoke/memberships写入 | 精确body见既有P43合同；H02守GET展示代次，2.1增量守四类写反馈及对应原因确认；password仍独立待验 |
| PA45比较 | 两角色并集→差异/分组/查询过滤 | 本地计算无写API；P45写五个URL键，P44不写。重置启用只看query/group |
| PA导航/共享 | RouterLink、预览/筛选、本地列工具、技术展开/复制 | 页内展开不等于业务请求；复制有剪贴板副作用；导航可能由新页触发API |

账号写入由既有Origin/Idempotency-Key/鉴权及仓储事务审计约束。蓝图对创建也笼统写“原因”，但真实createOrganization/createUser请求并无人工reason；本批记录差异，沿真实合同设计，不新增字段或修改后端来迎合文案。所有资料、权限、密码及敏感操作仍由服务端裁定，不能让隐藏按钮替代拒绝测试。

### 2.1 用户详情写入反馈归属增量

后续实施起点8503d74，当前产品内容以第7节指纹为准。已有UI2-PA03隔离复现：甲状态写成功后把乙详情换回甲；甲加入组织成功后在乙显示甲的成功提示。新增captureDetailAction复用H02代次、用户及路由，登录状态、平台角色、会话撤销和加入组织四类操作在发起时捕获归属；原因确认前及成功/失败回调均检查仍属该窗口。关闭、重开同ID、换人、路由/KeepAlive离开使其失效。已发写入不取消、不自动重放，原概览刷新继续执行，不将关闭解释为事务撤销。

UI2-PA03现有24个实例：四类各成功/错误×切到乙/停留甲共16；成员关系另有关闭/重开同ID×成功/错误4；平台角色另有共享路由/缓存概览离开与历史返回×成功/错误4。核对写目标/完整body/非空Idempotency-Key/仅一次写、详情GET次数及当前反馈；缓存路径另检查同一DOM节点复用。UI2-PA04核对尚未提交的角色原因窗在路由失效后确认不写。执行结果见PROGRESS，不以用例存在代替通过；真实MySQL/授权/审计、单会话及每个角色全部变体仍分别验收。

创建、强制改密与组织资料/状态的回调没有在本增量修改；共享原因窗跨路由自动关闭也未实现，失效的四类原因动作只能安全地不执行。源码候选与输入未改变，32源指纹中父组件/详情辅助模块按实际复现、修复和复测更新；不把局部通过写成全站G0或正式风格通过。

## 3. 弹窗族、变体与关闭合同

本族六个native dialog定义：W创建组织、G组织详情、V用户详情、A新建用户、A强制改密、A共享原因。C的四个dialog-component-call包括Q筛选和三个Dialog命名组件，不是四个额外业务模态；W命名无Dialog但真实有定义。另有S移动预览和Q动态筛选，列设置/技术信息为details。下表是族，不是全站冻结分母。

| 族 | 调用方/变体 | 进入→提交/失败→取消/返回 |
| --- | --- | --- |
| PA41-DIALOG | P39/P40等页头，P40空态，/new直达；两步/错误/busy | reportValidity后下一步，最终提交；失败留第二步；取消回P40且父字段仍在；成功才清字段并跳P42 |
| PA42-DIALOG | P39/P40组织入口或创建成功/ID直达；正常/missing | 资料form→共享原因；缺失重读概览；关闭回P40；错误/成功在详情，缺计数??1不是事实 |
| PA43-DETAIL | P43/P44，共用GET；loading/error/ready和成员表单 | H02关闭/换路由/KeepAlive离开/卸载使GET失效；错误可重试；其他操作与回调另验 |
| PA43-CREATE | P39概览/用户创建/P44管理员标题与默认角色差异 | 五字段提交，错误留窗；取消关闭不立即清密码；成功关闭但字段仍内存，不能称已修 |
| PA43-PASSWORD | 用户/管理员详情 | 密码form→共享原因→写；失败回密码窗；关闭不写、不立即清密码；成功关闭密码/详情 |
| PA-REASON | 组织3种+用户11种=14种已识别语义变体 | 默认“平台管理员人工操作”，trim2–300；确认先关闭再await action；取消清回调不写。异步后重开/反馈身份需验 |
| PA-S-PREVIEW | 来源/O/U/M四类记录；长字段/技术展开 | 无业务写；U/M/O可进入二级真实详情并关闭预览；Escape/遮罩/关闭焦点独立核对 |
| PA-Q-FILTER | C非权限页；组织/账号/管理员标签和状态选项差异 | 移动开关，desktop内联；submit先收起、失败仍需可恢复；取消保留输入，无业务写 |

14种原因逐项为：组织保存1、停用/恢复2；用户停用/恢复2，运营/安全/超级管理员各授予/撤销6，单会话/全部会话2，强制改密1。加入组织有自己内联reason，不并入共享14；创建两族无reason。每种要覆盖准确主体/影响/权限、自保拒绝、确认中、失败和成功，不因为使用一个定义只拍一次。useModalDialog基于showModal/native cancel和触发器返回，没有显式手写Tab循环；C研究的循环修复不是生产助手改动。

## 4. 当前差异与未关闭项

| ID | 源码证据与风险 | 下一项验收，当前状态 |
| --- | --- | --- |
| PA-D01 | 用户状态/角色/会话/成员关系已增加详情代次、用户、路由归属检查，见2.1；组织保存/改密仍使用实时selected | 四类隔离用例结果见PROGRESS；创建、改密、组织资料/状态及真实后台仍待补，不将整个PA-D01关闭 |
| PA-D02 | 概览200/过滤记录驱动组织详情、??1计数、取消密码保留、角色/账号旧快照、query数组watch单飞 | 路由变化期间旧查询结果不覆盖当前URL并补读最新条件已有桌面/手机E2E；missing与筛选、写成功刷新失败、密码生命周期等其余行为仍待验 |
| PA-D03 | H02用户GET保护不代表所有销毁/角色撤回/其他错误，运营dashboard与superadmin accounts权限不同 | 真实六角色允许/拒绝及审计、壳层销毁、401/403快照和直接深链；未执行 |
| PA-D04 | 现已有P38–P45八份规格和本族候选表；正式布局、完整图片/运行时分母/生产仍缺 | R01与W01/W05正式图→Vue→全验；不重列已补规格为缺失，不把本文当全量通过 |
| PA-W05-A11Y | C查询input只有placeholder；S无显式焦点循环/inert；Q只有局部Tab处理；T基础36px；X无复制异常catch | 真实计算热区、名称、键盘循环/背景可交互、叠加模态、错误关联、clipboard失败/时序；本批只核源码，没有复现结果 |
| PA-W05-HISTORY | D window和R五键仅初始化/向URL写，没有反向route.query watch；C导航去query，S/Q无deactivate清理 | 前进后退/KeepAlive与窗口、筛选、数据观测范围一致；T换列索引及Q取消/提交也验；未执行 |
| PA-W05-FACT | D仅部分字段参与empty；队列柱宽是装饰；admins含未授权用户；角色筛选仅两角色并集、reset禁用条件有限 | 零/缺失/仅趋势/同角色/单角色/过滤外组织/无角色用户用实际字段验证，不造指标或改业务判定 |

除2.1明确列出的用户写归属复现与修复外，其余仍是事实边界及待验条目，不能统称已复现或已修。旧PAGES中分页、独立组织详情、权限保存等拟议描述需R01连同实际源清单/证据统一纠偏；本批不改全局fingerprint或覆盖用户审核记录。没有尚未授权的新API、SQL、依赖、安全规则决定。

## 5. 验证矩阵与证据类型

现有文件：tests/e2e/m06-01-platform-accounts.spec.ts、m06-02-platform-dashboard.spec.ts、m02-03-navigation-shell.spec.ts。前两者内既有覆盖分别含账号/管理员/组织深链、创建失败、角色目录及H02 UI2-PA01/PA02，驾驶舱事实/来源展开/时间窗/超时。这里只核对用例入口与源码，不等于本轮跑过；H02桌面移动各21项通过仅引用PROGRESS历史。

| 待验场景组 | 精确断言与边界 |
| --- | --- |
| 读取与范围 | 四时间窗、null/0/仅trend、运营/超级权限、200上限和summary不随筛选；捕获真实URL/请求/状态 |
| 组织全链 | 列表→两步→最小响应/刷新失败→详情；name/slug边界及Enter、3原因变体、missing/过滤排除；不写生产组织 |
| 账号写归属 | 每种请求先挂起，甲→乙/关闭/离页→旧成功与失败；当前身份/错误无污染，不能自动重发写入或将关闭当撤销 |
| 比较与历史 | 两角色/同/单/空，query/group、reset条件、五URL键前进后退；P44内存与P45持久化区别 |
| 共享控件 | 四记录类型列数、至少一列、冻结首可见列、两密度；移动预览/筛选键盘、遮罩、双层详情焦点、取消/submit区别 |
| 无障碍与视觉 | 1440/390、768/1024及适用邻界、200%缩放、长文本、软键盘、16/13px与44px、三主题；真实屏幕阅读/错误和复制失败独立留证 |
| 正式与生产 | 每页正式图/Vue对照+全部适用变体；真实鉴权/事务/审计及同SHA宝塔证据；未审/未执行不得passed |

本批最初的只读验证器`node scripts/verify-ui-phase2-platform-account-contract.mjs`曾核对15个Vue文件的128历史候选及24绑定。当前实现区分该历史快照与现行源码合同：当前核对118候选、24绑定、38个源指纹，以及八页规格/实际路径和文档链接；历史源清单仍独立固定。脚本不执行API/浏览器/数据库、不写生成清单，不验证业务语义是否正确，也不将任何review状态设为通过。新状态/变体仍须查真实调用链并实际采证，不能靠静态计数替代。

## 6. 交付、使用与未改变范围

P38–P45八份规格都有文件；全站规格48/73，W06八份、W07八份、W08九份共25份尚缺。正式C方向仍pending，关联产品源变化后须实际复验再更新研究证据，结果见PROGRESS，图数不计为新增正式设计；正式全站图、Vue重构、真实角色/业务/生产及用户签收继续按1.16计划。R01全局清单仍旧源，不将局部表自动当全站完成。

初次规格批只改文档/验证器；2.1后续增量修改Vue父入口及详情辅助模块的四类写反馈归属，没有改变CSS、API/OpenAPI、SQL、Node/Worker/Python、依赖或.env，无新运行参数。本批不部署；以后更新Web静态包，正式发布仍按宝塔部署器核对迁移与停启窗口，不新增后端重启需求。永久规格、合同、验证器保留；临时产物及进程、实际检查见PROGRESS，旧16批材料不动。正式图/实现槽位依各页第10节，用户审核需绑定具体新版本。

## 7. 源码指纹（LF SHA-256）

2026-09-09 P45增量：[权限比较C方向图册](design/permission-comparison-direction-c/README.md)，44场景双端88PNG（含2工具图），零业务弹窗。原三角色7能力夹具未改，源computed15种完整行序列、手动watch五URL键/80/40/P44差异，源loadPlatformRoles单飞/12秒abort回调、旧矩阵/时间及惰性仓库active平台参数和投影验证。单非默认角色reset后缺失与权限错误保留旧矩阵已复现；提示、手机说明展开仅提案，未改下面业务源指纹。file URL刷新不是VueRouter前进后退证据，无API/SQL/授权/生产执行；具体稿、PA-W05与完整生命周期/主题密度继续待办。W05八页有首轮稿不等于全站图审或实施完成。

2026-09-09 P43/P44增量：[用户/管理员C方向图册](design/user-admin-direction-c/README.md)，111场景双端222主图＋34长窗下部，共256PNG。原overview/角色及两详情独立提取，缺失关系ID明确；源服务/composable/候选/比较函数惰性验证，源改密回调目标/明文漂移复现。本稿三分区/两页各11原因、角色比较和保护只为提案，不是挂载Vue/API/MySQL/真实鉴权。未改业务源码，下面指纹不更新；具体图审和PA-W05/完整生命周期仍待完成。

2026-09-09 P40/P41/P42增量：[组织管理C方向连贯图册](design/platform-organizations-direction-c/README.md)，46场景双端92主图＋10长弹窗下部，共102PNG。永久source helper提取原overview并惰性执行真实服务及父函数，复现updateOrganization原因回调读取当前selected.id/organizationForm；锁定确认快照及迟到归属仅为原型提案。P41最小响应缺计数、P42列表未含目标明确展示，不变造字段/数量或权限结论。创建/更新/状态/user body定向浏览器验证通过，不是挂载Vue/API/MySQL/审计。P39包中的P41/P42仅路由提示保持历史；本包新增连贯目的页稿，仍不宣称全变体/完整生命周期完成。生产源码未改，下面源指纹不更新。

### P39 C方向后续提案增量 · 2026-09-09

起点main/da750f6，[ACCOUNT-OVERVIEW-C-r1](design/account-overview-direction-c/README.md)交付40场景双端80主图＋6创建局部，共86PNG，含2审核工具图。蓝色全局规模与白色组织-only结果明确区分；五列/冻结/密度、移动筛选和组织预览、P39“新建用户或平台管理员”五字段与三平台角色保留。原三个单条数组与全局3/2、18/16、2不强行对齐，12条仅合成；P41/P42创建/资料/三原因全变体不在此包冒充完成，只验证P39出入口路径。

实际父函数/computed与显式watch惰性执行复现：读在途的新query被单飞跳过；已有事实时权限/网络失败均保留ready；创建成功后回读失败曾被成功message覆盖；旧创建成功曾关闭新创建窗，当前`useUserCreationOwner`隔离替代窗并由`platform-user-creation-owner.test.mjs`覆盖；取消密码仍在内存。2026-09-24修复创建用户后的反馈归属：POST成功但列表GET失败时，仍显示创建成功，同时明确要求手动刷新核对；桌面/手机真实Vue E2E覆盖，未改变请求体或写入流程。其余已复现项仍未关闭。service.overview及真实repository.overview惰性query核对trim120/30、固定200、LIKE转义、组织name/slug而非邮箱、成员/工作区不限定活动状态、summary不随筛选；不是SQL/事务/鉴权执行。对应PA-D02、PA-W05-HISTORY和PA-D03没有关闭。

原型将当前输入与已读范围、写成功与回读失败分别说明，保护旧创建成功/失败不污染新窗并恢复按钮，后台读回保留当前表单；仅为本地提案。Playwright具体双端/焦点/输入/返回/列工具验证见PROGRESS与evidence，原生200%/完整三主题密度/6角色/KeepAlive/已开窗跨断点及真实MFA等仍待办。没有新增API/OpenAPI/.env/权限/schema/依赖，产品源指纹不变。

### P38 C方向后续提案增量 · 2026-09-09

起点main/386336c，[PLATFORM-OVERVIEW-C-r1](design/platform-overview-direction-c/README.md)交付43场景双端86主图＋2异常局部＋3移动来源预览，共91PNG，含2非业务控件板。本页所有真实动作族和共享列设置/首可见冻结/密度/来源预览/请求编号复制保留；蓝目录与白异常优先构图不改权限、读取API或指标分母。用户C方向已选择，但具体P38稿没有获批，本节更新状态优先于第6节初始“方向pending/48规格”历史说明。

源函数惰性验证并复现PA-W05-FACT的仅趋势判空、PA-W05-HISTORY的失败切7d保留24h快照、PA-D03的ready后401/403仍留数据和PA-W05-A11Y的复制reject无catch；不是挂载Vue/真实SQL/授权或完整历史路径。four windows的分钟换算、当前队列无since、open_alerts混合分母、GET写dashboard_views/audit事务由源阅读核对，不冒称DB试验。原provider critical优先却显示未知、parsing/validating回退“其他状态”保留并注明。

本地Playwright验证来源8/15、列至少一列/冻结首可见/两密度、四精确URL、恢复/重复读取/失效响应与复制、三种移动预览关闭/焦点/长内容等，实际结果见PROGRESS/evidence。新增观测范围说明、逐点文本、复制/离开归属和native预览+显式Tab双边界仅提案，源共享组件未改；不将PA-W05或PA-D03整体关闭。完整Vue生命周期、浏览器历史、6角色/3主题/全局密度、原生200%/软键盘、MySQL审计及宝塔仍待验。

本增量只改设计原型、验证脚本和直接相关计划/规格/地图，无新API/OpenAPI/.env/依赖/数据库/权限/重启；永久图不清理，临时与进程收尾见PROGRESS。

追加W05合同门发现仅NavigationShell指纹过期。逐项核对真实load/watch/unmount与既有243941a提交：旧指纹对应243941a父版；该提交增加导航GET的sequence/shell/AbortController归属、切壳重新读取并收起搜索/主题/菜单、全路径改变收起搜索、卸载abort。没有改变PlatformDashboard的load、selectedSurfaceProps或KeepAlive结构，不能把壳层保护当成本页window/401/403风险已修。此处同步单一导航源指纹并记录语义差异；其余31项不变，128候选与24绑定也不变。本轮仅重新核源及合同门，不重跑或冒称此前导航生命周期E2E通过。

下表只锁定本批读取的产品合同源，便于发现后续语义变化；不表示当前线上SHA或全站证据已刷新。验证器检查真实内容，而不是要求未来HEAD永远等于本次起点。

| 文件 | SHA-256 |
| --- | --- |
| apps/web/src/components/PlatformDashboard.vue | 7935e4cdeca4991615f554ff0c66cf5e623454269fa0771ff06b861f15ca5a95 |
| apps/web/src/components/PlatformAccountCenter.vue | 2b41c1f174bf0a1a67c97e8252e1d805a01c559d7bcb6817da80d7affd4b3474 |
| apps/web/src/components/PlatformOrganizationRecords.vue | c818ebc93a17bccc072beb0f6d61c94584435e6bc3a4672a85616cc428794e82 |
| apps/web/src/components/PlatformAdminRecords.vue | 74cf97193f666c9a712ab12e69e450c9cf59297a12fe9c9b8e350aa74560b297 |
| apps/web/src/components/OrganizationCreationWizard.vue | 6e0cefda653491671b244267a3c7a0538fc411ebcfc50ddac8556cf12180b8b0 |
| apps/web/src/components/PlatformOrganizationDetailDialog.vue | cf5d098e4d256b05db24d6f3f2a26d80a9ed411766f0818673cb105f1906c435 |
| apps/web/src/components/PlatformRoleComparison.vue | d97345c58748d4dd480bd80dd0ee7106b411bb1488652a7621a5a3adfc3dd0ba |
| apps/web/src/components/PlatformAccountDialogs.vue | 53b9fc9d719fdc51a57c9c09a62bb379d68be5b3174e9975d531d0a23b7a4829 |
| apps/web/src/components/PlatformUserRecords.vue | a0c8ac35238ff4541ef8f699593d15c8f8ae9c2b85c87c1896f08689d668e228 |
| apps/web/src/components/PlatformUserDetailDialog.vue | 27a70088acf71a873b9617c658fc4fbef2399b28b2d52b1354337b2a48040b24 |
| apps/web/src/components/PlatformUserMembershipForm.vue | 553a0f8ac7e42ac7665785f8701a64c41dec7469c2380e3dd087a11ad7e6f644 |
| apps/web/src/components/ResponsiveDataView.vue | 28fa47d1a8beac1666c0cf8be1316484abd39729682a68adb4fed803742f2aaa |
| apps/web/src/components/ResponsiveFilterDrawer.vue | daa1cda68e206b85f5cfa687ae9ee70795a20e2a67d79501cc22fbf53c162a39 |
| apps/web/src/components/TableViewControls.vue | d0611b8367773f915a885c6c09f34c958fed67e7b99110abec20bb0febeea9ff |
| apps/web/src/components/TechnicalDetails.vue | 4e2443f3f7f901c3d1cf14243523956e8705bbd39aed8e0a19d54063220fe82d |
| apps/web/src/use-modal-dialog.ts | 08bfc1db3703e25927576eacaca733cfb8cc16d4d90e8aa2741a72d138fdf74f |
| apps/web/src/use-platform-user-detail.ts | 8e07ab5f36fb989082d43cda2082e2cafdedadba8ec5c5f5ba3e055859e39e8e |
| apps/web/src/platform-account-types.ts | 7c78cdfd603d8419ee18d7bd5feb12b1d40cbb7bdf102aeaf17a919a7003afe2 |
| apps/web/src/api-client.ts | 953c3da783121a797a86ff82e03a968067ae2c694a4fb5f883187b04569fa9ff |
| apps/web/src/components/NavigationShell.vue | 4490c21cd477e2874dd9f2eb3c0cafafa2e88baf46620d2a0eb31a3f4e53d2bc |
| apps/api/src/authorization-routes.ts | f670a9e21650e2fedd3ea691049de840cb2a47c9c6add471c38eb7e71e208975 |
| apps/api/src/platform-account-routes.ts | 79c273a1492f2cc157c72d82ac6ab2b8a950ccb789696c2329d7a6206fefe226 |
| apps/api/src/platform-account-service.ts | 189fb1cbcafdc119da64433ac1acd9735d4f1a296b2a243c250733df2b08966d |
| apps/api/src/mysql-platform-account-repository.ts | 96cc13077b24ba17643adc9b13ca14cd2e71ea49d3e13d3abceb7b86ed7b87c5 |
| apps/api/src/platform-dashboard-routes.ts | 1b84b99708bf4610259b42dd48987831229560cf5653b15b98b3cc1d30284f30 |
| apps/api/src/platform-dashboard-service.ts | 568938e88c90615410a7c43224004930936165e91a4172afafc7ce2ff4d8428e |
| apps/api/src/mysql-platform-dashboard-repository.ts | b290af1c03b2767c79bb565f9ec256550250acc4be0cc787de12b81e9b8dcd28 |
| apps/api/src/mysql-platform-dashboard-scale-metrics.ts | 75f0800028a81a7456578b65699406b8d52593deb89926c4970a4b7bd9679c00 |
| apps/api/src/mysql-platform-dashboard-collection-metrics.ts | dc37e16179b6c8d57d2b6ffcb23fcfce7d44d950bbfc9263104be1d6d74c438d |
| apps/api/src/mysql-platform-dashboard-risk-metrics.ts | e49abd8f317094b4b34b5fb31f8cb47e9d3cc1dc9cffcd945035c8ecd648f094 |
| apps/api/src/mysql-platform-dashboard-storage-metrics.ts | 16b1b6b5e04ae7b3f4438914cd88b7e985d4a836db42c6e6c1855567de0ca808 |
| config/route-catalog.json | d02ade33d087f133ddada8c087085e12c1d321b72f35cd1ef6ffb155076e8150 |

## 8. P41 OrganizationCreationWizard 当前源码归属（2026-09-24）

当前组件的表单提交只向父层发出`submit`事件；名称、标识和管理员字段由父层传入的`form`对象驱动，字段变更另向父层发出`clearError`。本节只补当前四个源位置和当前指纹，不把表单提交误认作子组件直接请求，不扩大既有校验与组织创建合同。第7节保留旧指纹并按历史范围读取。

| 当前candidateId | 行 | 类型 | 当前语义归属 |
| --- | ---: | --- | --- |
| apps/web/src/components/OrganizationCreationWizard.vue#ffa5038e256f600a.1 | 52 | form-event | PA41-CURRENT-SUBMIT / 表单提交事件转发给父层创建所有者 |
| apps/web/src/components/OrganizationCreationWizard.vue#bc0893035430063c.1 | 68 | event-binding | PA41-CURRENT-INPUT / 组织名称双向输入及错误清除事件 |
| apps/web/src/components/OrganizationCreationWizard.vue#73dff0e93770c698.1 | 82 | event-binding | PA41-CURRENT-INPUT / 组织标识双向输入及错误清除事件 |
| apps/web/src/components/OrganizationCreationWizard.vue#dd8a952068bb7d3e.1 | 103 | event-binding | PA41-CURRENT-INPUT / 首位管理员选择及错误清除事件 |

| 当前源文件 | 当前LF SHA-256 |
| --- | --- |
| apps/web/src/components/OrganizationCreationWizard.vue | 6ec50816ecc69c9b707e5a309ef789129f8fb5f6087bad0c4427709055b03c53 |

## 9. P39 PlatformAccountCenter 当前刷新与目录接线（2026-09-24）

当前账号列表的页头“刷新数据”在父组件调用既有 `load`，刷新中或父级写入繁忙时禁用。目录子组件的 `load` 事件仍由父组件转发到同一 `load` handler；该事件接线不是第二个读取动作。第7节的指纹为历史来源，本节记录当前组件身份与哈希，不表示生产部署或运行时验收。

| 当前candidateId | 行 | 类型 | 当前语义归属 |
| --- | ---: | --- | --- |
| apps/web/src/components/PlatformAccountCenter.vue#8f18fbff9e2c1c99.1 | 689 | control | P39-ACCOUNT-CURRENT-REFRESH / PA-REFRESH；页头账号目录读取，刷新中或写入繁忙时禁用 |
| apps/web/src/components/PlatformAccountCenter.vue#8458edc51af426a6.1 | 732 | event-binding | P39-ACCOUNT-CURRENT-WIRING / PA-REFRESH-WIRING；将目录子组件的 load 意图连接到父级既有读取处理，不另计读取动作 |

| 当前源文件 | 当前LF SHA-256 |
| --- | --- |
| apps/web/src/components/PlatformAccountCenter.vue | eda65671ef8a8cb49af3de234a552ec96db0571a82b68f39ea533b6b72a27213 |

## 10. P41 创建向导逐页动作映射（2026-09-25）

P41 的完整页面级逐候选映射见 `action-reviews/P41.json`。当前范围只包含向导宿主 `PlatformAccountCenter.vue` 与真实两步子组件 `OrganizationCreationWizard.vue`；以当前合同中的精确候选签名核对页面入口、字段变更、下一步/上一步/取消/最终提交、原生 Escape 转发和父级提交接线。P40 筛选/刷新、P42 组织资料/状态、P43/44 用户或管理员操作、P45 角色动作均显式排除，不因共享父文件或同一账号模块而并入 P41。

| 源位置 | 当前身份 | P41语义 |
| --- | --- | --- |
| 组织目录页头 | 已有组织创建入口 | 只导航打开 `/platform-admin/organizations/new`，写入仍归父处理器 |
| P41向导组件调用 | `clear-error`、`close`、`submit` 三个父级事件绑定 | 分别转发给当前错误、取消和原创建所有者 |
| `OrganizationCreationWizard.vue` 原生 dialog | `PA41-DIALOG` | 向导窗口容器，不另计业务动作 |
| P41 form submit 与最终按钮 | `PA41-CURRENT-SUBMIT` + `PA41-CREATE` | 同一组织创建意图；实际请求由父级单飞/归属守卫执行 |
| P41名称、标识、管理员字段 | 三个 `PA41-CURRENT-INPUT` | 编辑字段并清当前错误，不等于创建 |
| P41下一步、上一步、取消和原生 cancel | `PA41-NEXT`、`PA41-BACK`、`PA41-CANCEL` | 原生有效性下一步、返回清错、按钮/Escape返回P40 |

映射只说明当前源码动作边界。用户已授权的视觉自动通过独立记录在 `DESIGN-REVIEW-INDEX.md`；`P41.json` 保持 `actionApproval=pending-user-review`，不声称真实事务、MySQL、RBAC、审计或 M07-03 通过。

## 11. P42 组织详情逐页动作映射（2026-09-25）

P42 的当前逐候选动作映射见 `action-reviews/P42.json`。该页使用 `PlatformOrganizationDetailDialog.vue` 与父级 `PlatformAccountCenter.vue`；保存、停用和恢复沿用当前父级原因窗口及请求所有者。共享 `PlatformAccountDialogs.vue` 中的用户创建和密码重置明确排除，不能因为同一实例挂载就计入P42。

| 当前源文件 | 当前签名 | 合同语义 |
| --- | --- | --- |
| apps/web/src/components/PlatformAccountDialogs.vue | 8cb5dc651024abe9.1 | PA42-REASON 共享原生原因窗定义 |
| apps/web/src/components/PlatformAccountDialogs.vue | bd4ff44ef0d1442c.1 | PA42-REASON Escape取消 |
| apps/web/src/components/PlatformAccountDialogs.vue | 4a0496f0cb3d6338.1 | PA42-REASON form提交父级确认 |
| apps/web/src/components/PlatformAccountDialogs.vue | b313681d9ad25f0e.1 | PA42-REASON 原因文本向父级更新事件 |
| apps/web/src/components/PlatformAccountDialogs.vue | 07d6870e96868709.1 | PA42-REASON 按钮取消 |
| apps/web/src/components/PlatformAccountDialogs.vue | 7819d63c0a94ede2.1 | PA42-REASON 确认按钮 |
| apps/web/src/components/PlatformAccountDialogs.vue | 96a5d8f14ce43590.1 | PA43-CREATE 原生dialog定义 |
| apps/web/src/components/PlatformAccountDialogs.vue | 9e8b9d6531d0203d.1 | PA43-CREATE Escape取消 |
| apps/web/src/components/PlatformAccountDialogs.vue | f76649b0950ec968.1 | PA43-CREATE form提交 |
| apps/web/src/components/PlatformAccountDialogs.vue | c3a13fcf7d0fc151.1 | PA43-CREATE 按钮取消 |
| apps/web/src/components/PlatformAccountDialogs.vue | 472f3632b99eae63.1 | PA43-CREATE 按钮提交 |
| apps/web/src/components/PlatformAccountDialogs.vue | 0a0c76ebc577d650.1 | PA43-PASSWORD 原生dialog定义 |
| apps/web/src/components/PlatformAccountDialogs.vue | 04769fc3148b559f.1 | PA43-PASSWORD Escape取消 |
| apps/web/src/components/PlatformAccountDialogs.vue | 22727b212f0b7505.1 | PA43-PASSWORD form提交到原因窗 |
| apps/web/src/components/PlatformAccountDialogs.vue | 0fbdc8b9a1396e9c.1 | PA43-PASSWORD 按钮取消 |
| apps/web/src/components/PlatformAccountDialogs.vue | 9ad3d7837ab53f7c.1 | PA43-PASSWORD 按钮进入原因窗 |

该映射将native cancel、显式关闭、缺失列表重读、写后资料重读、三项字段输入、单次资料提交意图、技术详情、状态目标选择及共享原因处理分别归属；父子事件逐边连接且不重复计数。C方向视觉属于用户授权自动通过范围，但动作审查仍待单独签收；实际MySQL、RBAC、审计和M07-03验收不由源码映射证明。
