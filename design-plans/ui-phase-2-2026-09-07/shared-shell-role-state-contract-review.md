# F04a 共享壳层、发现、角色与状态入口合同复核

2026-09-08 主题C提案：[THEME-C-r1](design/theme-direction-c/README.md)新增18场景/36图，非模态命名区域、三主题ID保留、新C配色/名称待审。永久助手执行真实主题控制器已复现UI2-SH03缺口：后一次PUT成功为cloud-white/version2，前一次迟到失败仍恢复deep-ocean，两请求expected_version均1；未修复，不将knownGap断言计作该卡通过。图稿不改原Vue、源表指纹或审批；键盘/关闭提议及真实跨壳层/卸载竞态继续待验。

2026-09-08 发现入口C提案：[DISCOVERY-C-r1](design/discovery-direction-c/README.md)新增29场景/68图，覆盖下文Discovery搜索/创建的筛选、短词、最近使用、状态恢复与关闭合同。UI2-DI夹具和真实状态枚举由永久助手推导并深比较；本地计时模拟不替代UI2-DI真实HTTP/重试/权限验收。原源指纹、矩阵与用户审批未改，未修改生产Vue；上一导航批发现待办现有独立图稿，但仍未集成或获审。

2026-09-08 C方向导航主体：[SHELL-C-nav-r1](design/shell-direction-c/README.md)新增25场景×双端50图，绑定下文shell菜单/路由/守卫/范围动作；移动导航原生抽屉和单一更多高亮为待审结构，不改本表真实源指纹。Theme/Discovery只标记入口与未实现说明，仍需独立C图稿与完整合同闭环；不能把此HTML证据算作UI2-SH01–SH06整卡通过、真实权限或Pxx业务截图。

日期：2026-09-08；F04a起点main/fa63241，原始交付b8773d6/498607f。第2/3节现行源绑定已随F04b修复更新；初始、读取修复、焦点修复表分别由498607f、243941a、3c1ebae追溯，当前搜索与恢复增量见第10节。第8–10节都是局部运行证据，静态绑定不自动冻结G0，也不是正式设计、真实权限、生产或用户审核证明。

## 1. 范围与证据分层

- NavigationShell三壳层由App根据route.meta.shell装配；共享入口不是新增Pxx。OrganizationRolePanel属于P31，NotFoundPage属于P73，UiStateShowcase属于P72/DEV query。73路由编号不变。
- 70=32+9+19+3+6+1。一个事件候选可包含多个监听，一个v-for候选可渲染多个按钮，一个业务动作也可有表单/按钮或桌面/移动多个入口；数量不作为业务分母。
- P72/P73沿用[state-recovery-contract-review](state-recovery-contract-review.md)中的ST/NF语义ID；新表只是当前稳定源绑定，不替代旧八态表和历史修复证据。P31沿用[页面规格](page-specs/P31.md)与[组织治理合同](organization-governance-contract-review.md)的父级写入语义，不把父子emit各算一次授权写入。
- 静态表、隔离Vue、真实后端、生产最终执行和用户审批分别记账。下文caseId为完整验收卡；第8/9节只关闭各批实际覆盖的子场景，其余仍待完成，不把局部回归提升为整卡或全站通过。

## 2. 当前源码指纹

LF归一SHA256。六个候选文件完整扫描；辅助文件只沿相关调用链审阅，整文件hash用于漂移检测，不表示全文件业务审计。API路由hash不在Web扫描范围，永久测试直接读文件校验，不以not-in-web-scan状态冒充运行成功。

| 文件 | SHA256 |
| --- | --- |
| apps/web/src/components/DiscoveryOverlay.vue | 6d1fcfa002f10f3fcea31818c60f7ea93b9f91715b81b0a1a1faf7b38181cb27 |
| apps/web/src/components/NavigationShell.vue | 4490c21cd477e2874dd9f2eb3c0cafafa2e88baf46620d2a0eb31a3f4e53d2bc |
| apps/web/src/components/NotFoundPage.vue | 2629b1167336513955c9a1af7459d8e18d357f7e1fb03f240629f97b0501bf7b |
| apps/web/src/components/OrganizationRolePanel.vue | aaaf903611aad9a0af38a2da040780c1904003841aa63a2b9faaa6a47d002415 |
| apps/web/src/components/UiStateShowcase.vue | c4a94d839ff7d4e1e3a10f6458facb150e2b499fbcc84cf411fdd8daecba3e30 |
| apps/web/src/use-modal-dialog.ts | 08bfc1db3703e25927576eacaca733cfb8cc16d4d90e8aa2741a72d138fdf74f |
| apps/web/src/use-navigation-discovery.ts | e6ffdb0cc734f35f7461fb4f67d4c8c632f3de83168f7d3a2b99d0928db05f94 |
| apps/web/src/use-navigation-shell-theme.ts | b3ee6f650feaa2fdbdc905ffddefe231df099596866a492418c098b5012b0c56 |
| apps/web/src/navigation-memory.ts | af064b6f6418d131862cb6a99c5c6d979f0539af1235102a9b81e0e4a4faab8f |
| apps/web/src/navigation-shell-permissions.ts | 8ae667b142516d55b6d58a864911752b46534bbf63de634ebb8e62f9f7b14fe1 |
| apps/web/src/navigation-shell-route-state.ts | 40673a441c63fc8e251c3e1e82a0c4024fb5520596a3eb714583e52b8fb4f974 |
| apps/web/src/components/OrganizationAdminCenter.vue | 7ba04fb90083af7d2f7f395ed8399d9d2db7f4a282cb2f39f56e2d6989fe60ea |
| apps/web/src/App.vue | e8ed64e10e641a7988c999c3965c917d4640cd3a4eab213b8f23131641bac531 |
| apps/web/src/router.ts | 67dc541e1856fd5bd30688f9bf64d9e32d66491bb9a1a19d8ce5ef81679162f4 |
| apps/api/src/discovery-routes.ts | 7c281090d8f7e76121b0abcdf1c88b40d066cdcad38f5d9a4e6e2df29d886579 |

## 3. 全70项稳定候选映射

表内源位置是可复核身份；语义ID中花括号是运行时维度，不是已展开的完整分母。案例组的具体步骤见第6节。所有定义/组件调用/工具调用均单独标明，不能与control相加声称按钮总数。

### apps/web/src/components/DiscoveryOverlay.vue

| candidateId | 行 | 类型 | 语义归属 | 真实动作与边界 | 待验组 |
| --- | --- | --- | --- | --- | --- |
| apps/web/src/components/DiscoveryOverlay.vue#fc9fbb3a461cfbb6.1 | 249 | dialog-definition | discovery.dialog | 原生dialog定义；search/create两个模式，复用同一实例 | UI2-DI01–DI06 |
| apps/web/src/components/DiscoveryOverlay.vue#002b8e0f6dc06a65.1 | 249 | event-binding | discovery.close.escape/backdrop; discovery.focus.cycle | cancel经handleCancel.preventDefault；仅mousedown.self.prevent取消遮罩默认抢焦；keydown Tab在可见可用首末控件循环 | UI2-DI01–DI06 |
| apps/web/src/components/DiscoveryOverlay.vue#3886e9e1d2205bab.1 | 265 | control | discovery.close.button | 关闭按钮emit close；三种关闭入口分别验证返焦 | UI2-DI01–DI06 |
| apps/web/src/components/DiscoveryOverlay.vue#6e4c847155323708.1 | 267 | form-event | discovery.search | submit.prevent调用search；与Enter入口共用动作，短查询给本地字段提示 | UI2-DI01–DI06 |
| apps/web/src/components/DiscoveryOverlay.vue#422ce833775d95d6.1 | 270 | event-binding | discovery.search | input keydown.enter.prevent调用search；搜索关键词关联queryError和aria-invalid，合法重试清除错误 | UI2-DI01–DI06 |
| apps/web/src/components/DiscoveryOverlay.vue#372af47cc630ef33.1 | 316 | event-binding | discovery.retry.{mode}; discovery.close.state | UiStatePanel primary转search或loadActions，新读清旧关联标识；secondary显式关闭，不假称申请权限 | UI2-DI01–DI06 |
| apps/web/src/components/DiscoveryOverlay.vue#2954096bdfc7268c.1 | 343 | control | discovery.result.navigate.{resourceType} | RouterLink到服务端item.route；普通点击先关闭，修饰键/非左键保留窗口语义 | UI2-DI01–DI06 |
| apps/web/src/components/DiscoveryOverlay.vue#eabfc750d1907e5d.1 | 354 | control | discovery.quick.navigate.{actionId} | 记录当前组件最近ID；普通点击关闭并导航item.route，不提前创建对象 | UI2-DI01–DI06 |
| apps/web/src/components/DiscoveryOverlay.vue#65142520df6ee647.1 | 373 | control | discovery.notifications | member底部链接去/notifications；普通点击关闭弹窗 | UI2-DI01–DI06 |

### apps/web/src/components/NavigationShell.vue

| candidateId | 行 | 类型 | 语义归属 | 真实动作与边界 | 待验组 |
| --- | --- | --- | --- | --- | --- |
| apps/web/src/components/NavigationShell.vue#d597913db5935f66.1 | 349 | control | shell.brand | 按三种shell跳转/home、/org-admin或/platform-admin | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#4406969a265df88c.1 | 368 | control | shell.menu.toggle | menuOpen取反；控制role-navigation，不写业务数据 | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#8dd0e178ad9b3805.1 | 380 | control | shell.theme.toggle | themeOpen取反；是浮层开关，不是原生dialog | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#3e7327184ae485df.1 | 384 | control | discovery.open.search | member搜索入口；openDiscovery(search) | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#a7c175d8d28f0e5d.1 | 387 | control | shell.platform.organization.new | platform_admin且platform:superadmin时导航到创建组织页，不在此创建 | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#144c13fb8312e48f.1 | 394 | control | shell.organization.members | organization_admin壳层且guard.roles含organization_admin时导航成员页，不发送邀请 | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#4a47ef3decd65106.1 | 402 | control | discovery.open.create | member快捷入口；openDiscovery(create)，不创建实体 | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#5f177f6584a8f0d2.1 | 411 | control | shell.notifications | member导航/notifications | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#834cb169e185e0d1.1 | 413 | control | shell.account | 导航/me，目标为AccountShell | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#31e4cab37308ba7f.1 | 454 | control | shell.navigation.group.toggle | 原生details/summary；按动态group展开，搜索时自动open | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#b78108402d8cae8b.1 | 459 | control | shell.navigation.item | 按授权items导航；同时关闭menuOpen并清空menuQuery | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#3afd6f3de7d5759c.1 | 472 | control | shell.platform.return.context | 平台返回先选范围；return_to为最近成员路由，from为当前fullPath | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#a37faaadc1909cc4.1 | 478 | control | shell.organization.return.member | 组织壳层返回getLastMemberRoute() | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#3eee0be2f448f7bb.1 | 484 | control | shell.member.enter.organization | member且guard.roles含organization_admin才显示 | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#8ca53865fab9dca4.1 | 490 | control | shell.member.enter.platform | member且guard.platform_roles非空才显示；导航不是授权证明 | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#ff6d5fbc586803ed.1 | 508 | control | shell.gate.technical.toggle | requestId/traceId存在时披露故障详情 | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#5587941412d5210f.1 | 512 | control | shell.gate.login | 导航读取expired时去/login；当前代码不附带return_to | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#35c184e325be143b.1 | 513 | control | shell.gate.context | context_required去/select-context | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#31a7202bbbcbf38a.1 | 515 | control | shell.gate.home | 导航读取forbidden去/home | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#b83ca94093e36cba.1 | 516 | control | shell.gate.retry | 非loading且非前三类恢复链接时load()；重读/me/navigation | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#be9e2c92e3dca900.1 | 521 | control | shell.breadcrumb.navigate | breadcrumbTrail产生path才可导航；无path只显示文本 | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#827ec3c5575d94f5.1 | 563 | control | shell.context.disclose | 上下文原生details；非机会ID页面，响应式可见性另验 | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#3a4be4a53966fde8.1 | 592 | control | shell.operations.navigate | 平台运维二级导航固定十项目；链接展示不代替目标路由权限 | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#6d2a591c632f75fb.1 | 612 | control | shell.surface.missing.return | 无selectedSurfaceComponent时去items[0].path或/ | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#6ba08dfa7cf297ec.1 | 622 | control | shell.route.forbidden.return | ready但routeAllowed=false时去items[0].path或/home | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#5689a1a88f3983e9.1 | 623 | control | shell.route.forbidden.permissions | 导航/me?section=permissions，不直接申请或修改权限 | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#155e2256621bdcb3.1 | 628 | control | shell.navigation.item | 移动primaryItems=items前四项；同导航语义的另一个渲染点，此处不清menuQuery | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#0b2e86222c168adc.1 | 634 | control | shell.menu.open | 移动更多仅设置menuOpen=true，不等于toggle | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#8c3e23399022ee54.1 | 645 | control | shell.theme.choose.{themeId} | 三主题动态按钮；member/org版本化保存，platform只本地应用；见主题边界 | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#f8690b21af426414.1 | 660 | control | shell.theme.settings | 导航/settings/theme；此链接本身没有关闭themeOpen处理 | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#c5cd954168e369ca.1 | 665 | event-binding | discovery.close | DiscoveryOverlay的close事件转closeDiscovery()，清discoveryMode | UI2-SH01–SH06 |
| apps/web/src/components/NavigationShell.vue#5e8a6b546ab251fb.1 | 665 | dialog-component-call | discovery.dialog | DiscoveryOverlay组件调用；搜索/创建两变体，与定义非重复业务弹窗 | UI2-SH01–SH06 |

### apps/web/src/components/NotFoundPage.vue

| candidateId | 行 | 类型 | 语义归属 | 真实动作与边界 | 待验组 |
| --- | --- | --- | --- | --- | --- |
| apps/web/src/components/NotFoundPage.vue#ad49e2f05ad189d6.1 | 46 | control | NF-BRAND | 沿用state-recovery合同：品牌导航/home | NF03/NF04 |
| apps/web/src/components/NotFoundPage.vue#0b84761726a96f8e.1 | 78 | control | NF-RETURN | 沿用原ID：router.resolve最近有效路由；未登记/解析失败回/home | NF03/NF04 |
| apps/web/src/components/NotFoundPage.vue#7ed277e44773eac9.1 | 81 | control | NF-HOME | 沿用原ID：最近目标path非/home时另显/home链接 | NF03/NF04 |

### apps/web/src/components/OrganizationRolePanel.vue

| candidateId | 行 | 类型 | 语义归属 | 真实动作与边界 | 待验组 |
| --- | --- | --- | --- | --- | --- |
| apps/web/src/components/OrganizationRolePanel.vue#24237df37bd7b7e4.1 | 266 | control | role.section.{section} | roles/scopes/grants三分区本地切换，保留各区局部状态 | UI2-RP01–RP05 |
| apps/web/src/components/OrganizationRolePanel.vue#f7e8f2a9a0457015.1 | 293 | control | role.select.{roleCode} | 选角色模板仅更新selectedRoleCode；不是赋予角色 | UI2-RP01–RP05 |
| apps/web/src/components/OrganizationRolePanel.vue#23a85da051801987.1 | 322 | control | role.capability.technical.toggle | 原生details披露所选角色技术能力名称 | UI2-RP01–RP05 |
| apps/web/src/components/OrganizationRolePanel.vue#be3f3fa4fcf2fb2c.1 | 358 | control | role.capability.filter.reset | 清capabilityQuery与capabilityGroup；不改roleQuery | UI2-RP01–RP05 |
| apps/web/src/components/OrganizationRolePanel.vue#5235116f7947ac74.1 | 433 | control | role.scope.filter.reset | 清scopeQuery与scopeFilter | UI2-RP01–RP05 |
| apps/web/src/components/OrganizationRolePanel.vue#0aac14fac3c56e10.1 | 468 | control | grant.create.form.toggle | canManage时创建/取消内联表单；隐藏本身不清父级grantForm | UI2-RP01–RP05 |
| apps/web/src/components/OrganizationRolePanel.vue#27eeda4bb377f413.1 | 473 | form-event | grant.create.submit | form submit emit createGrant；父级校验、POST、刷新与审计反馈 | UI2-RP01–RP05 |
| apps/web/src/components/OrganizationRolePanel.vue#f0c0d3b1c8ae684b.1 | 493 | event-binding | grant.create.type.change | emit updateGrantType；父级替换类型并将actions设该类型首个动作 | UI2-RP01–RP05 |
| apps/web/src/components/OrganizationRolePanel.vue#b75d50f1f8f0cc17.1 | 538 | control | grant.create.submit | 默认submit按钮；busy或actions空时禁用，与表单同一业务提交 | UI2-RP01–RP05 |
| apps/web/src/components/OrganizationRolePanel.vue#8bd3f7b2e5dcb44f.1 | 545 | control | grant.status.select.{status} | all/active/expired/revoked；emit updateGrantStatus，父级页码重置1并读取 | UI2-RP01–RP05 |
| apps/web/src/components/OrganizationRolePanel.vue#a162032f86484b89.1 | 570 | control | grant.select.{grantId} | 本地选中当前页授权；不调用授权修改接口 | UI2-RP01–RP05 |
| apps/web/src/components/OrganizationRolePanel.vue#5f937fb211eb5840.1 | 624 | control | grant.technical.toggle | 披露资源与授权ID，不是打开另一个弹窗 | UI2-RP01–RP05 |
| apps/web/src/components/OrganizationRolePanel.vue#201e6ad7077e4318.1 | 628 | form-event | grant.expiry.submit | active且canManage的内联表单；emit grant/reason/expires_at给父级PATCH；2026-09-10字段说明改变AST标签签名，日期min反映既有后端严格延期规则 | UI2-RP01–RP05 |
| apps/web/src/components/OrganizationRolePanel.vue#8c59567be7cef9a3.1 | 674 | control | grant.expiry.submit | 默认submit按钮；busy禁用，与延期表单同动作 | UI2-RP01–RP05 |
| apps/web/src/components/OrganizationRolePanel.vue#5be3d5846e4138fa.1 | 675 | control | grant.revoke.request | active且canManage；emit revokeGrant，父级先询问审计原因后POST | UI2-RP01–RP05 |
| apps/web/src/components/OrganizationRolePanel.vue#bf5c2f057a07f3f3.1 | 689 | control | grant.page.previous | 有grantMeta.total时上一页；busy或page<=1禁用 | UI2-RP01–RP05 |
| apps/web/src/components/OrganizationRolePanel.vue#085ead5af6973fef.1 | 697 | control | grant.page.next | 下一页；busy或page>=pageCount禁用 | UI2-RP01–RP05 |
| apps/web/src/components/OrganizationRolePanel.vue#a6d03f8144116449.1 | 708 | control | grant.create.form.open | grantTotal=0且canManage时打开首条授权表单，不直接POST | UI2-RP01–RP05 |
| apps/web/src/components/OrganizationRolePanel.vue#cd26859a239383fd.1 | 713 | control | grant.status.all | grantTotal>0但当前meta.total为空时重读全部状态；busy禁用 | UI2-RP01–RP05 |

### apps/web/src/components/UiStateShowcase.vue

| candidateId | 行 | 类型 | 语义归属 | 真实动作与边界 | 待验组 |
| --- | --- | --- | --- | --- | --- |
| apps/web/src/components/UiStateShowcase.vue#a51b976ddba112e1.1 | 98 | control | ST-HOME | 沿用state-recovery合同：品牌导航/home | ST05/ST06 |
| apps/web/src/components/UiStateShowcase.vue#7f48e1357c8dae41.1 | 106 | control | ST-SELECT.{kind} | 八态选择；query合法同态不增加history，initialState存在则不接管query | ST05/ST06 |
| apps/web/src/components/UiStateShowcase.vue#659be34503b475d2.1 | 117 | control | ST-OPEN | 仅dialogOpen=true，打开演示确认 | ST05/ST06 |
| apps/web/src/components/UiStateShowcase.vue#b2a9d9fdd632dd45.1 | 126 | event-binding | ST-PRIMARY.{kind}/ST-SECONDARY.{kind} | UiStatePanel两个事件绑定在同一候选；按既有八态表执行本地示例或导航 | ST05/ST06 |
| apps/web/src/components/UiStateShowcase.vue#5cb580b48eea94d3.1 | 151 | event-binding | ST-CANCEL/ST-CONFIRM | 关闭演示；confirm额外confirmed=true，不执行授权撤销 | ST05/ST06 |
| apps/web/src/components/UiStateShowcase.vue#2067b78f30a4668d.1 | 151 | dialog-component-call | ST-DEMO-CONFIRM | ConfirmDialog演示调用变体；与共享定义归一，不是useModalDialog消费者 | ST05/ST06 |

### apps/web/src/use-modal-dialog.ts

| candidateId | 行 | 类型 | 语义归属 | 真实动作与边界 | 待验组 |
| --- | --- | --- | --- | --- | --- |
| apps/web/src/use-modal-dialog.ts#524dddb64d598a2e.1 | 14 | dialog-script-call | modal.native.lifecycle | showModal工具调用位置；不是业务动作或某一个弹窗变体，逐调用方展开 | UI2-SM01–SM02 |

## 4. 扫描器不计入70项的输入与动态状态

NavigationShell有1处v-model：menuQuery，只过滤当前已授权菜单的label/group，items少于8不渲染输入。原生details、RouterLink与动态菜单项已在候选表记录，仍须展开实际角色/屏幕/分组。

DiscoveryOverlay有4处v-model：query、resourceType、status、assignee。query由search() trim并检查至少2字；输入声明maxlength=100，但键盘handler自身没有最大长度检查。对象类型为空时状态禁用；切类型清状态，非task/opportunity清负责人；负责人trim后仅适用类型发送。创建模式不显示这四字段。打开/切模式清结果、请求标识与提示，不清query/筛选/最近动作；最近五个action ID仅当前组件内存，不是持久偏好。

OrganizationRolePanel有14处v-model（资源类型是:value加@change，另已计入候选表）：

| 位置族 | 绑定 | 语义与校验 |
| --- | --- | --- |
| 角色目录 | roleQuery | 本地按角色名/描述/翻译能力过滤；选中不存在时回退首条可见角色 |
| 能力矩阵 | capabilityQuery、capabilityGroup | 本地能力名/代码与业务域；矩阵只读，不编辑权限模板 |
| 成员范围 | scopeQuery、scopeFilter | 本地成员姓名/邮箱/团队与scope；own/team/workspace/organization可重叠，不将四项人数相加当唯一总人数 |
| 授权搜索 | grantQuery | 只过滤当前props.grants页；跨页搜索不是现有功能 |
| 创建内联表单 | grantForm.workspace_id、resource_id、grantee_membership_id、actions、reason、expires_at | required工作区/UUID/目标/原因/日期；动作checkbox按类型动态展开；原因trim、最多500字符；busy或无动作禁提交 |
| 延期内联表单 | grantMutation.reason、grantMutation.expires_at | active且canManage才可见；原因required/trim/500，日期required；选中授权改变时重置为当前时间+7天，不是当前到期日 |

表单的min/max时间在RolePanel初始化时计算；父级validateGrantExpiry提交时按当前时间检查未来且不超过30天，转ISO发送。不要仅凭HTML静态min/max声称时间边界完整正确。内联隐藏、切分区、换角色不自动清创建草稿；父级成功创建才重置指定字段、页码和状态。尚未实测的长驻/跨范围草稿与提交读失败场景保留待验。

## 5. 实际调用链、变体与已知限制

### 壳层和发现

NavigationShell的load在mounted、显式重试及shell变化时GET /me/navigation?shell=...。shell变化清旧guard并进入loading，同时关闭旧菜单/主题/发现层；读取以世代、AbortSignal和捕获的shell校验归属，卸载也取消。App同一NavigationShell分支仍没有shell key，未通过重建全App替代必要读取。权限源为member/org的guard.capabilities或平台的platform_capabilities；组织壳层无organization_admin角色时，空能力路由仍拒绝。实际API授权不由这些前端判断代替。

主题member/org通过GET /me/ui-preferences取version后PUT {theme, expected_version}；平台chooseTheme(persist=false)只applyTheme，不调用上述保存。异步读取有sequence判定，保存成功/失败处理没有同类序号判定；快速两次保存与迟到失败的恢复待复现。主题浮层不是dialog；当前toggle缺aria-expanded/controls，外观设置链接没有显式关层处理，读屏、Escape、点外部和导航关闭分别待验，不能只凭视觉浮层推定模态语义。

Discovery有两业务变体discovery.dialog.search/create；search GET /me/global-search带q/limit=10及适用筛选，不发送组织/工作区ID。真实路由从会话解析范围，先authorize task:read，再向DiscoveryService传scope与capabilities；结果级隔离仍需服务/真实后端证明。quick-actions GET带shell，后端先guardNavigationShell并选择相应capabilities。当前生产壳层只给member展示搜索/快捷创建；组件支持三种shell并不表示三种壳层都有此UI入口。

F04b已确认修复前结果导航不关闭、旧搜索可覆盖新结果。现在结果、快捷动作和通知RouterLink的普通左键/键盘点击经navigateAway发close；修饰键或非左键不强制关闭，快捷项仍先更新当前组件最近ID。父级route.fullPath变化也关闭发现层，覆盖浏览器返回等非链接路径。get在同一个归属检查后同步更新标识、结果与状态；新读取、非法短查询、open/mode/shell变化和卸载均失效旧读取并取消，nextTick开窗延续也检查世代。第8/9节分别记录旧搜索及旧快捷读取的局部场景；Ctrl/Meta+K全部输入目标边界、跨组织真实权限仍待验。

### P31授权写入与模态

资源类型及最小动作来自父级resourceActions：task、opportunity、competitor、sourcing，不新增候选类型。RolePanel的canManage只来自authorization.capabilities中role:manage，不从角色目录或平台身份推断。

- 创建：父级createResourceGrant检查busy、日期和去重后的非空actions，POST /org/{organizationId}/resource-grants；trim原因、日期转ISO；成功重置资源/目标/原因/动作与日期，页码1/status=all并后台load。刷新失败和成功提示如何共存须复测，不能只验POST响应。
- 延期：emit完整selectedGrant及原因/日期，父级PATCH /org/{organizationId}/resource-grants/{grantId}/expiry，body为expected_version、trim reason、ISO expires_at。模板名称叫“延长”，前端仅检查未来30天，并没有与原到期时间比较；不擅自改成仅可加长的新业务规则。
- 撤销：父级auditedReason→共享AuditedReasonDialog→非空原因后POST /org/{organizationId}/resource-grants/{grantId}/revoke，带expected_version/reason。变体grant.revoke.reason属于该父级调用，取消不写；不能把创建或延期内联表单标成模态。共享原因框定义与其他组织调用已在原组织合同记录，不重复增加源分母。
- 状态/分页由父级updateResourceGrantStatus/Page调用load；局部grantQuery不发送后端。刷新期间守卫与busy不是同一状态，需查快速翻页/切状态并发归属。

### 状态与工具

P72八态行为沿用原ST表，loading不显示操作；error/blocked重试是本地恢复示例，确认只是关闭并confirmed=true。ConfirmDialog演示不是原生useModalDialog调用方。P73只有三个导航候选；组件本身不请求业务API，导航离开后的身份检查或目标取数不包含在“零API”结论内。navigation-memory接受单斜线而非//开头，存储键未按身份/范围分区；不能将这个检查夸大为完整URL安全或跨账号隔离证明。

App仅DEV条件导入UiStateShowcase/VerificationFramework，NavigationShell glob显式排除二者；本批不构建、不检生产bundle，因此不声称当前生产不可达已验证。P72使用具体URL和DEV query分开验收，P73用实际未知路径，不请求字面量通配路由。

useModalDialog保存打开前焦点，nextTick后showModal；关闭时close后nextTick返焦；cancel.preventDefault后请求父级关闭；unmount只close，没有显式返焦。原生dialog负责模态机制，但不证明全部消费者的首焦点/Tab循环/遮罩关闭均合格。当前文字引用清单为21个Vue文件：ApprovalWorkspace、AuditedReasonDialog、AutomationRuleCenter、CommercialOperationsCenter、CostRuleConsole、DiscoveryOverlay、NotificationCenter、OpportunityWorkspace、OpportunityWorkspaceDialogs、OrganizationCreationWizard、PlatformAccountDialogs、PlatformGovernanceCenter、PlatformManagementCenter、PlatformMessageEditor、PlatformOrganizationDetailDialog、PlatformUserDetailDialog、ReportCenter、ScoreRuleConsole、TaskBatchActions、TaskDetailPanel、TaskWorkspace。此为候选消费者索引，仍要按实际useModalDialog调用、open表达式和触发源逐项展开；不是21个已验证业务弹窗。

## 6. F04b可执行验收卡（局部结果见第8–11节）

所有卡先在真实Vue+隔离响应验证，写入不触碰生产；真实后端与六角色验证另记。默认1440/390串行，其余适用断点、200%缩放/三主题/两密度及读屏分别保留，不由两视口测试自动覆盖。

| caseId | 入口/操作 | 必须验证的结果与边界 |
| --- | --- | --- |
| UI2-SH01 | 三壳层与六互斥角色，品牌/分组/运维/面包屑/移动前四项 | 从当前目录和实际能力生成允许/拒绝集合；无权路由不能靠直达绕过，不以superadmin覆盖其他角色 |
| UI2-SH02 | 顶部菜单toggle、移动更多、搜索分组、菜单项导航 | 更多只open，menu项关闭并清query；动态分组/空结果/焦点/aria-expanded及局部滚动正确；桌面移动重复入口同语义 |
| UI2-SH03 | 三主题在三壳层选择、失败、连点与迟到响应 | 平台不PUT偏好；member/org expected_version与恢复正确；不让较早响应覆盖较新选择；先复现再局部修复 |
| UI2-SH04 | member↔org↔platform、选择范围与返回、同组件换shell | 实际路由/guard/缓存数据属于新范围，不带旧授权；返回参数来自现有记忆规则；切换缺少明确产品规则时暂停决策 |
| UI2-SH05 | 导航loading/expired/forbidden/conflict/rate/blocked及routeAllowed拒绝 | 恢复链接与load请求准确，技术标识可披露；“已连接”文案只代表导航读取不能冒充SSE/所有依赖健康 |
| UI2-SH06 | 主题浮层与导航/上下文details键盘遍历 | 明确非模态语义，名称、展开状态、可见焦点、关闭/离开后的焦点可用；不凭加aria冒充可达性通过 |
| UI2-DI01 | 搜索四类型、空类型、负责人、状态及Enter/submit | trim/最小长度、类型切换清筛选、limit10及参数；非法输入不发送无效请求；长输入与字段错误关联 |
| UI2-DI02 | 搜索结果、快捷入口、通知点击，同路由与跨路由 | href与实际落点准确，未在此创建实体；模态不会挡住目的页；显式复现是否缺少关闭，不假设路由自动销毁 |
| UI2-DI03 | search/create分别开窗、Tab反向Tab、Escape/关闭/遮罩 | 首焦点、模态约束、三取消路径返焦、内层点击不误关；遮罩mousedown与返焦顺序按浏览器事件验证 |
| UI2-DI04 | 双搜索、切模式、关窗重开、切范围，延迟成功/失败反序 | 结果/请求标识/错误归当前请求；旧响应不得污染新场景，发起/取消记录有据 |
| UI2-DI05 | 两模式loading/empty/error/expired/forbidden/blocked | retry调用与当前模式一致，错误不显示旧成功；无权/过期的“重新加载”不冒称重新登录或已申请权限 |
| UI2-DI06 | 快捷项0/1/多项、近期五项、卸载后重进、Ctrl/Meta+K | 只展示返回入口，近期顺序为组件内存；键盘行为和展示角色范围准确；真实鉴权另验 |
| UI2-RP01 | 三分区、角色/能力/范围搜索及reset，空目录与零授权 | 固定模板不赋权；两种空态独立；范围计数可重叠，current-page搜索不能冒充全库 |
| UI2-RP02 | 四资源类型、动作checkbox、必填/非法UUID/日期、取消重开 | 切类型重置首个动作；无动作/处理中禁提交；草稿保留按现合同；精确POST且防重 |
| UI2-RP03 | active/expired/revoked、role:manage有无、延期及撤销原因窗 | 读写可见性、PATCH/POST和版本/原因准确；取消零撤销写入；409/403与二次提交、返焦分别验 |
| UI2-RP04 | 21条跨页、状态空、当前页搜索、连续翻页与换组织 | meta.total分页不取列表长度；selectedGrant和草稿归属不串；迟到列表不能覆盖新范围 |
| UI2-RP05 | 写成功后刷新失败、长驻日期、延期选中项变化 | 不把已写入误作未提交重写；成功/读取错误分别可见；不将+7天默认或静态min/max解释为完整业务延期规则 |
| UI2-SM01 | 逐21个候选消费者解析实际open/trigger/close关系 | 建每个dialogId/业务变体、首焦点、Tab/Shift+Tab/Escape/遮罩/返焦用例；工具位置不得代替每调用方通过 |
| UI2-SM02 | 关闭后同tick重开、组件卸载、多个模态、触发器移除 | 先复现生命周期/焦点竞争，明确当前应激活对象；无背景交互泄漏、不错误恢复到已失效触发器 |
| ST05/ST06 | 沿用原状态合同的正式图/辅助技术与全调用方叠加 | 本表不注销旧未验项；示例confirm与真实授权撤销严格分开 |
| NF03/NF04 | 沿用原合同生产响应/DEV绕过/bundle与六角色返回 | 404文案不证明HTTP404；存储异常与跨身份/范围返回分开核查 |

已读的现有入口：m02-05-discovery.spec.ts含过滤参数/Escape、快捷入口href及返焦、过期/空态的隔离测试；没有据此证明点击结果后的路由关闭或反序请求。m06-01-organization-admin.spec.ts的角色相关块含过滤、21条分页与三类授权写payload断言；不能替代真实审计、全角色、写后读失败或当前重测。m02-03-navigation-shell.spec.ts是壳层补测入口；ui-phase2-state-recovery-contracts.spec.ts及旧ST/NF用例按原合同复用。所有文件在tests/e2e下；本批不更新视觉快照或将旧fixture结果改标production。

## 7. 机械校验与交接

本批永久测试读取六文件完整候选集合，核对本表70个ID无遗漏/重复、精确行/类型/源hash；验证重复渲染/双提交入口归并及ST/NF旧语义沿用，19处v-model输入另核对。全站当前扫描可变，但任何新候选都必须得到稳定去向，不能通过固定总数漏掉新入口。只读对账成功与unreferenced=0仅表示支持的源引用齐全；动态实例、业务语义、后端、焦点/状态和用户审批仍未冻结或通过。

命令：node --test tests/unit/ui-phase2-contract-audit.test.mjs tests/unit/ui-phase2-inventory.test.mjs；node scripts/audit-ui-phase2-contracts.mjs；npm run verify:docs；npm run verify:runtime-docs；npm run format:check。实际结果见[PROGRESS](PROGRESS.md)。默认构建清单工具有写入副作用，本批不运行其默认模式，不重写旧baseline、actions、dialogs、coverage或图hash。

初始F04a批次没有产品或临时服务改动；后续F04b产品修复、运行验证及清理以第8节和PROGRESS为准。正式方向F00-1.18-r1仍待用户意见；获审后按F05代表页正式新图→Vue→测试继续，全73页目标不缩减。

## 8. F04b发现与壳层运行修复

从main/498607f开始，在真实Vue中使用隔离接口响应复现三项失败：UI2-DI02搜索结果已导航但dialog仍open；UI2-DI04旧成功覆盖已显示的新结果；UI2-SH04切平台后navigation请求记录仍只有member。三个red用例均在原代码下失败，修复后同三项通过，不通过更改期望或接受截图消除失败。

只修改DiscoveryOverlay与NavigationShell的读取归属、导航关层和shell重读；未改查询参数、搜索范围、快捷动作目录、权限规则、字段、主题持久化、任何业务写入或后端。AbortSignal是已有API客户端支持的浏览器选项，不是新接口字段/环境变量。取消减少失效请求的等待，世代检查保证即使取消未阻止响应到达也不覆盖当前状态。

243941a初批永久用例tests/e2e/ui-phase2-discovery-shell-contracts.spec.ts新增14参数化场景（现行扩充见第9节）：

- UI2-DI02四项：搜索结果、快捷项、通知导航关层；同URL结果通过Enter关闭且不新增history条目。这些动作没有产生浏览器观测到的业务非GET请求；不证明目标任务/通知业务详情或真实数据库验收。
- UI2-DI04六项：新搜索、关窗重开、切快捷创建，分别交付旧成功/403；当前链接仍可见、旧结果/拒绝提示不可见。新搜索两例故意剥离传输AbortSignal，保留真实浏览器fetch与响应拦截，确保旧响应确实到达后仍被忽略，不仅依赖网络取消。
- UI2-SH04四项：member→platform允许/拒绝均实际再GET；平台读取延迟时浏览器返回member，旧平台成功/403不替换新member。后两例也让传输忽略AbortSignal并等待旧requestfinished。只验证这两个壳层的隔离响应合同，不宣称六角色或跨组织真实授权通过。

旧源/表保留在498607f：NavigationShell旧LF hash为993d7e1a7dc50f7dab6f839428afd3e5d15fac45b0eff9e762392024d47eab92，DiscoveryOverlay为c3c3355805f8cf1c2bff0e52608f3b85d31b972e9372343fc4f0fb68edc75ff3。新增click改变Discovery三个候选签名，语义ID不变：e0665fe11ae1b034.1→2954096bdfc7268c.1；2f43790e18f7de54.1→eabfc750d1907e5d.1；f86ceb84c9007570.1→65142520df6ee647.1。其余38个两组件候选仅行号移动；第2/3节经当前AST重新核对，不按最近行号猜配。全局历史baseline、截图和用户审批不更新。

验证顺序与结果在PROGRESS记录：red三项→修复定向三项→新增合同→原导航/搜索→移动端→相关单测/构建/文档门。没有接受任何新视觉快照。此次只关闭上述子场景；主题反序保存、完整焦点/遮罩、quick-actions迟到回写、组织壳层/真实跨范围、全部原生模态消费者与正式设计仍保留待验。

本地构建后页面才能带入将来的标准宝塔发布，本批不部署。API/OpenAPI、DB、.env、依赖及服务器运行参数均未变，无当前重启操作；今后发布仍按既有部署器及宝塔重启要求，不另造纯前端上传参数。临时验证根为output/playwright/ui-phase2-discovery-shell-20260908，精确清理结果见PROGRESS，旧26批材料不动。

## 9. F04b发现弹窗焦点与快捷读取增量

起点main/243941a，原五项red真实Vue测试失败：search/create遮罩关闭后打开前控件不再聚焦；两模式首控件Shift+Tab不能落到末控件；搜索框无障碍名称实际为“⌕ Enter”而非可理解的搜索名称。原生dialog的存在不代表这些交互已通过。

仅DiscoveryOverlay修复：mousedown.self.prevent先判断遮罩本身再阻止默认焦点动作，保持mousedown取消时机、内层点击和字段聚焦；handleTab沿项目已有首末循环方式，仅在open的本dialog处理Tab，逐次收集可见、非disabled且tabIndex非负的控件，首项Shift+Tab到末项、末项Tab到首项。Escape继续由原useModalDialog.handleCancel处理；没有改全站模态工具、权限、业务字段或共享其他消费者。查询框新增aria-label“搜索关键词”，输入长度、过滤和提交合同不变。

同一永久E2E新增17项，现共31项：DI03两模式×Escape/关闭按钮/遮罩共6项返焦及无导航/无观测非GET；两模式首焦点和双向首末Tab共2项；内层标题/字段点击保持弹窗和正常输入共2项；DI01搜索框可理解名称1项；DI04快捷读取切search、重开create、SPA去/me卸载×迟到成功/403共6项。快捷六项剥离目标读取的传输AbortSignal并等待原requestfinished，验证真正迟到响应而非仅取消；search转态不先关闭原生dialog，卸载用真实个人中心RouterLink，不用硬刷新销毁旧请求凑通过。旧读取逻辑无需再次修改。

本次只覆盖Chromium 1440/390及文中隔离状态，不代表屏幕阅读器实测、所有浏览器、200%缩放、全主题/密度、所有动态错误控件或其他原生模态调用方。Ctrl+K从create切search已测，Meta组合及全部编辑目标边界、真实组织/工作区切换、六角色权限和生产仍待验。对这些发现入口没有观测到业务写入，不推定/me业务全链通过。

第2/3节按当前AST重绑Discovery9项及完整LF hash，候选总数仍70。243941a中的旧hash为919da075bf5a2ff859c51b86bc3686d9d873c833f713e0d7dfb48e363e3133bf；三签名变化：dialog定义ceb391d01220c696.1→fc9fbb3a461cfbb6.1，事件f3760e448f9f16ab.1→002b8e0f6dc06a65.1，输入96a9bdb48fa13865.1→f528731fca76dfda.1。原取消语义保留，并显式登记新增discovery.focus.cycle；其余六项仅行号变化，不将Tab监听伪装成新增业务写入。历史图和全局清单/审核状态不更新。

五red修复后原五项通过，再跑31项现行合同+25项原模块的桌面/移动回归；原图基线未接受新快照，具体结果和清理见PROGRESS。临时根output/playwright/ui-phase2-discovery-focus-20260908单独跟踪；之前被拒绝清理的材料不重试。无生产、SQL、API/OpenAPI、配置/.env、依赖或部署器变更，无当前重启；全部正式设计与用户审核仍待F00方向。

## 10. F04b搜索校验、状态恢复与近期入口

产品起点3c1ebae，计划提交7a7feac保留原在途E2E；原三个red已取得失败终态。DiscoveryOverlay只修三处：短查询继续沿用trim后至少2字符规则，但改用关联输入的queryError/aria-invalid/aria-describedby和alert，清除旧标识与提示、失效旧读取并聚焦输入；合法再提交或重开时清本地错误。每次GET开始清旧request/trace标识。UiStatePanel调用方明确secondary-label为关闭并响应secondary；不再显示无handler的申请权限、返回上一页或调整筛选，不改变共享状态组件或添加业务能力。

本批永久E2E新增24项，使本文件共55项：短输入三类3；旧请求失败→非法输入→合法修正1；非法输入失效真实迟到成功1；四类型/全部类型及trim/状态/负责人准确参数1；两模式×401/403/409/429/500/503重试12；无权次按钮真实关闭返焦1；两模式空态关闭2；两条真实快捷入口重排、去重、路由返回与卸载重进1；Ctrl/Meta+K保留搜索输入及平台壳层不打开2。服务端权限、SQL和范围隔离没有由这些fixture证明。

DI06使用真实目录task/sourcing两条，不编第六条；最近五项上限仍是源码边界，测试不声称已证明所有五条的跨角色排序。两种快捷键覆盖成员触发按钮、搜索编辑框和平台壳层；组织壳层、所有输入目标、读屏、其他浏览器和生产仍待验。历史单入口、空入口场景与本次两入口是分别记录的局部证据，不注销整张DI06卡。

第2/3节按AST重绑九项；旧LF hash为0c87aed8077f0fc34773a49a6f031c47c382ccf0b83de4d1add972e71b9f8fb2，旧表在3c1ebae。三签名变更：form a53c50f6e3c9041c.1→6e4c847155323708.1；input f528731fca76dfda.1→422ce833775d95d6.1；状态监听85469c2445124f8e.1→372af47cc630ef33.1。搜索与重试语义保留，显式新增discovery.close.state，其余六项仅行号变化；共享候选总数仍70。具体测试终态、全站只读对账及清理见PROGRESS，不更新旧图、生成清单或审批值。

## 11. F04b共享审计原因窗的实际调用方

从main/e414e0e干净起点，只改AuditedReasonDialog局部键盘行为，不改useModalDialog或五个父级业务逻辑。两个真实组织入口在修复前都复现首控件Shift+Tab没有回到取消按钮。新增handleTab仅在当前打开的dialog处理Tab；逐次选择可见、非disabled且tabIndex非负的button/textarea，在首项反向/末项正向时阻止默认行为并切换焦点。保持原生cancel和父级关闭、初始草稿、最短原因、提交emit以及遮罩不关闭的既有语义，没有新增持久化、API或安全规则。

当前五个模板消费者为OrganizationAdminCenter、OpportunityWorkspace、PlatformDataCenter、PlatformLogCenter、PlatformManagementCenter，已分别沿ask→useAuditedReason→共享窗→finish→父级handler核对。最后一个父级不是单独的通知子组件；这五个父级不等同五个业务变体，更不等同全部21个原生模态候选文件。实际运行覆盖如下：

| 父级 / 业务变体 | 本批永久浏览器证据 | 仍未证明 |
| --- | --- | --- |
| OrganizationAdminCenter / 撤销邀请、撤销指定资源授权 | m06-01新增10项：各自Escape/顶部/底部取消、返焦/重开初值3，禁用/启用末项双向Tab1，空白不可提交、trim准确版本体、持有响应时父级busy阻止再触发1 | 其他成员/团队/工作区原因变体、409/403恢复、跨组织和真实撤销 |
| OpportunityWorkspace / AI抽检通过、驳回 | m04-07新增2项，空初值恢复、两种提交可用态首末边界、Escape返焦且无观测非GET | 真正复核POST、人工复核权限及分析结果写后读 |
| PlatformDataCenter / 受控数据导出 | m06-02现有数据导航用例增加打开、首焦点/首末边界、保留默认草稿、取消返焦 | 本批未执行导出POST，不证明文件/筛选异步归属 |
| PlatformLogCenter / 日志导出 | m06-02原日志用例补焦点边界，再继续原导出body和download验证 | 真实服务器导出、重试key、离开后下载归属 |
| PlatformManagementCenter / 发布通知 | platform-message-management原用例补焦点边界，随后继续原发布body与返回反馈 | 取消发布、所有受众、真实投递及实际授权 |

新helper audited-reason-focus只操作实际页面中的dialog，并在原draft恢复后返回；记录自身期间无非GET，不能冒充后续取消/提交/后端全链断言。取消及版本化写入由具体业务测试承担。组织用例Control+Enter无提交的检查仅说明该键不触发写入，不声称新增快捷提交功能。

源绑定：六个AuditedReason候选仍全部在日志合同表归属LG62-REASON；定义f5d988e572723a07.1→b4d0faa980ae141b.1、事件a3b55671f26dcb41.1→feaf794106e5776d.1，其余四项只行移动。旧LF hash为10f0be448391f280f1d5f4164a9426f0f7c928d00c92128b15c8fdcd275843ee，现270b84d19094e57b101a8e4efb1317b19785c87d30b8b452ee5b78e8f1378d00；原表和四份合同hash由e414e0e追溯。本批不是给第2/3节额外添加六项以重复计数。新增单测要求当前六项集合/行/hash/原语义及四份当前源hash一致；旧全局清单与审批不更新。

定向组织10项、其他父级5项已通过；完整四模块桌面/移动、构建、对账与清理终态见PROGRESS。临时根output/playwright/ui-phase2-audited-modal-20260908与过去29批分开登记。全主题、读屏、200%缩放、多个/叠加弹窗、生命周期竞态、所有业务变体及其他原生消费者仍待验；正式风格与全73路由设计/实现/生产/用户审核未完成。
