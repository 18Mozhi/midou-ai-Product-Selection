# P40 组织列表当前源码动作映射

2026-09-25。范围限定为真实 `/platform-admin/organizations` 页面：父级路由/查询与表单调用、组织目录子组件、平台目录侧栏、组织记录，以及本页可打开的“新建用户”弹窗。视觉方向依用户授权自动通过；此文只锁定源码语义与当前路由分支，不授予按钮语义、写入、权限或生产验收。

当前源文件由 `scripts/lib/ui-phase2-inventory.mjs#scanSource` 扫描。每个源码候选只出现一次；被目录复用的候选按运行条件映射到当前页动作或显式排除。组件事件转发归入 wiring，不重复算第二次用户动作。

## 当前候选身份

| 源文件 | 当前 candidate signature | 当前语义合同 |
| --- | --- | --- |
| apps/web/src/components/PlatformAccountCenter.vue | adcd96ea7cc90712.1 | PA45-ADMINS · 仅平台权限路由显示管理管理员 |
| apps/web/src/components/PlatformAccountCenter.vue | bcd4023ebe5d9ca9.1 | PA45-REFRESH · 仅平台权限路由读取角色目录 |
| apps/web/src/components/PlatformAccountCenter.vue | 280136c1a545dff9.1 | PA-ORG-CREATE · P40页头进入组织创建路由 |
| apps/web/src/components/PlatformAccountCenter.vue | 1516ea5a6c3b1540.1 | PA-USER-CREATE · P40页头打开新建用户弹窗 |
| apps/web/src/components/PlatformAccountCenter.vue | 8f18fbff9e2c1c99.1 | PA-REFRESH · 账号/用户/管理员页头刷新；P40隐藏 |
| apps/web/src/components/PlatformAccountCenter.vue | c4cfef52bcc169fb.1 | PA45-REFRESH · 仅平台权限读取错误重试 |
| apps/web/src/components/PlatformAccountCenter.vue | c526b71b2b59e702.1 | PA45-REFRESH · 仅平台权限空目录重试 |
| apps/web/src/components/PlatformAccountCenter.vue | 8458edc51af426a6.1 | PA40-WORKSPACE-WIRING · 父页将筛选、刷新、创建与详情意图接到既有处理器 |
| apps/web/src/components/PlatformAccountCenter.vue | 5db731eeed33ba4f.1 | PA40-P41-WIZARD-OUT · 创建组织向导只在P41路由开放 |
| apps/web/src/components/PlatformAccountCenter.vue | 559dcb14c786950e.1 | PA40-USER-DIALOG-WIRING · 新建用户、改密和原因事件父子接线 |
| apps/web/src/components/PlatformAccountCenter.vue | 1fff4198190d6ece.1 | PA40-USER-DIALOG-WIRING · 同一用户弹窗调用的对话框候选身份 |
| apps/web/src/components/PlatformAccountCenter.vue | 6f151cbab1f5518e.1 | PA40-P42-DETAIL-OUT · 组织详情事件由P42路由消费 |
| apps/web/src/components/PlatformAccountCenter.vue | 39ba950db197263c.1 | PA40-P42-DETAIL-OUT · 同一组织详情弹窗调用候选 |
| apps/web/src/components/PlatformAccountCenter.vue | 39878a11789ae9ce.1 | PA40-P43-DETAIL-OUT · 用户详情事件不属于P40列表 |
| apps/web/src/components/PlatformAccountCenter.vue | cab997ead119619a.1 | PA40-P43-DETAIL-OUT · 同一用户详情弹窗调用候选 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | 29448f61eb8ffc80.1 | PA40-OVERVIEW-TABS-OUT · overview分支二级导航，组织目录路由不渲染 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | 968274c5acaf5a33.1 | PA40-OVERVIEW-TABS-OUT · overview分支二级导航，组织目录路由不渲染 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | e400286c7cd59e44.1 | PA40-OVERVIEW-TABS-OUT · overview分支二级导航，组织目录路由不渲染 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | 9c9141422bfd2c11.1 | PA-REFRESH · P40组织记录区手动读取，refreshing/busy时禁用 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | 03d32a05b1b3fd19.1 | PA40-FILTER-DRAWER · 移动筛选抽屉容器，不另计筛选请求 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | 2d610959fc00fb96.1 | PA-FILTER · 组织查询表单提交至父级applyFilters |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | e9658d470d4cbeaf.1 | PA-FILTER · 搜索按钮提交同一组织查询表单 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | 20080e701de7f5cb.1 | PA-RESET · 重置query/status；无筛选或读取中禁用 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | 322a4ac62ce3a305.1 | PA-REFRESH · 首次读取失败后重试既有GET |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | 86ea70e081f1f8e3.1 | PA-RESET · P40筛选无结果时清除组织筛选 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | f68d2406f8c1db70.1 | PA-ORG-CREATE · 无筛选且无组织时进入P41创建路由 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | 8871f6d994e9fced.1 | PA40-ORG-DETAIL-WIRING · 组织记录详情事件传回父页 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | 44e761922e1da1d0.1 | PA40-USER-DETAIL-OUT · P43用户目录记录事件，不在P40组织分支渲染 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | 86ea70e081f1f8e3.2 | PA40-ADMIN-EMPTY-OUT · P44管理员空结果重置，不在P40组织分支渲染 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | 38003e3f7b002f71.1 | PA40-ADMIN-EMPTY-OUT · P44管理员空结果创建，不在P40组织分支渲染 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | 103fa7d7798d62d6.1 | PA40-USER-DETAIL-OUT · P44管理员记录详情，不在P40组织分支渲染 |
| apps/web/src/components/PlatformAccountGlobalRail.vue | 29448f61eb8ffc80.1 | PA-NAV-ORG · 当前平台目录侧栏组织管理路径 |
| apps/web/src/components/PlatformAccountGlobalRail.vue | ffed2dd7f439c4b0.1 | PA-NAV-USER · 平台目录侧栏用户管理路径 |
| apps/web/src/components/PlatformAccountGlobalRail.vue | e400286c7cd59e44.1 | PA-NAV-ADMIN · 平台目录侧栏管理员管理路径 |
| apps/web/src/components/PlatformOrganizationRecords.vue | 6923b73e52535ef3.1 | PA-ORG-DETAIL · 桌面组织行详情入口，busy时禁用 |
| apps/web/src/components/PlatformOrganizationRecords.vue | 2a07373cb016b4b5.1 | PA-ORG-DETAIL · 手机组织预览详情入口并关闭预览 |
| apps/web/src/components/PlatformOrganizationRecords.vue | 1c008f867673db60.1 | PA-ORG-TECH · 原生details展开组织UUID，不发请求 |
| apps/web/src/components/PlatformAccountDialogs.vue | 96a5d8f14ce43590.1 | PA40-USER-DIALOG-WIRING · P40页头打开的新建用户原生dialog |
| apps/web/src/components/PlatformAccountDialogs.vue | 9e8b9d6531d0203d.1 | PA40-USER-DIALOG-WIRING · 新建用户dialog原生cancel事件 |
| apps/web/src/components/PlatformAccountDialogs.vue | f76649b0950ec968.1 | PA-USER-CREATE · 新建用户表单提交至父级现有POST处理 |
| apps/web/src/components/PlatformAccountDialogs.vue | c3a13fcf7d0fc151.1 | PA40-USER-CREATE-CANCEL · 关闭用户创建窗，不提交 |
| apps/web/src/components/PlatformAccountDialogs.vue | 472f3632b99eae63.1 | PA-USER-CREATE · 忙碌时禁用的表单确认提交 |
| apps/web/src/components/PlatformAccountDialogs.vue | 0a0c76ebc577d650.1 | PA40-PASSWORD-OUT · 密码窗属于P43用户/管理员详情 |
| apps/web/src/components/PlatformAccountDialogs.vue | 04769fc3148b559f.1 | PA40-PASSWORD-OUT · P40未提供密码详情入口 |
| apps/web/src/components/PlatformAccountDialogs.vue | 22727b212f0b7505.1 | PA40-PASSWORD-OUT · 密码重置表单不在P40当前路由 |
| apps/web/src/components/PlatformAccountDialogs.vue | 0fbdc8b9a1396e9c.1 | PA40-PASSWORD-OUT · P40未提供密码详情入口 |
| apps/web/src/components/PlatformAccountDialogs.vue | 9ad3d7837ab53f7c.1 | PA40-PASSWORD-OUT · P40未提供密码详情入口 |
| apps/web/src/components/PlatformAccountDialogs.vue | 8cb5dc651024abe9.1 | PA40-REASON-OUT · 原因窗只由P42/P43现有写入动作调用 |
| apps/web/src/components/PlatformAccountDialogs.vue | bd4ff44ef0d1442c.1 | PA40-REASON-OUT · P40未触发共享原因窗 |
| apps/web/src/components/PlatformAccountDialogs.vue | 4a0496f0cb3d6338.1 | PA40-REASON-OUT · 原因确认表单属于已授权操作确认 |
| apps/web/src/components/PlatformAccountDialogs.vue | b313681d9ad25f0e.1 | PA40-REASON-OUT · 原因textarea随父级确认操作变化 |
| apps/web/src/components/PlatformAccountDialogs.vue | 07d6870e96868709.1 | PA40-REASON-OUT · P40未触发共享原因窗 |
| apps/web/src/components/PlatformAccountDialogs.vue | 7819d63c0a94ede2.1 | PA40-REASON-OUT · P40未触发共享原因窗 |

## 页面范围与验证边界

- P40 当前筛选只含组织名称/标识和空、active、archived状态；query/status仍由父页按原URL与GET合同处理。
- 组织创建只导航至P41；组织详情由父级进入P42。P40不执行创建组织、组织修改、启停或删除写入。
- 页头新建用户弹窗可从P40打开；实际表单遵从现有PA-USER-CREATE契约。本页映射弹窗和提交入口，未把来源为P40等页面的共享写入提升为权限/数据库验收。
- 组织/用户/管理员、权限与账号概览同源组件分支已逐候选登记；不适用于P40的分支有明确排除，不外推其他页面完成。
- P40真实Vue图册、六宽度局部浏览器检查和路由拦截E2E是本地实现证据。实际MySQL筛选、真实platform:superadmin、审计/写入、完整App/KeepAlive、生产用户创建和辅助技术仍未验收。
