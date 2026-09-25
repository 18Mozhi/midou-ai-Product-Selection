# P43 用户管理设计事实与局部动作合同

2026-09-09增量：[USER-ADMIN-C-r1](design/user-admin-direction-c/README.md)补P43/P44联合111场景/256图；下文18图为早期研究。当前保留移动预览与内联组织授权，不把早期提议当批准。真实服务/composable/成员候选/比较函数惰性验证，resetPassword原因确认读当前selected和passwordForm的漂移已复现；原型快照/清空/迟到保护非生产修复。改密后status恢复active的仓库事实写入图稿影响说明。业务请求字段、角色及权限规则不改，完整真实验收和具体图审待办。

依据：main/1ad9db7；产品源码与H02提交5192de2相同。本批只交P43规格与独立C研究，不宣称W05八页或全站语义分母完成。API均使用既有客户端的/api/v1前缀，角色平台:superadmin以实际代码字符串platform:superadmin为准。

## 1. 候选归属（33个直接候选，不是业务动作分母）

文件别名均在apps/web/src/components：U=PlatformUserRecords.vue，V=PlatformUserDetailDialog.vue，A=PlatformAccountDialogs.vue，F=PlatformUserMembershipForm.vue，M=PlatformAdminRecords.vue，R=PlatformRoleComparison.vue，G=PlatformAccountGlobalRail.vue。下表sig必须与扫描器逐对象一致；重复sig用文件名区分。父PlatformAccountCenter、ResponsiveDataView、TableViewControls、ResponsiveFilterDrawer等现已由[W05全族合同](platform-account-contract-review.md)补齐局部候选；NavigationShell仍归W01共享壳层，不把33项当P43全部运行时动作。

| 文件 | candidate sig | 归属/真实语义 |
| --- | --- | --- |
| U | b77b1781563a48b8.1 | PA43-DETAIL 桌面打开 |
| U | 18553297e6cbdd0a.1 | PA43-DETAIL 移动从预览进入详情并关闭预览 |
| U | 1c008f867673db60.1 | PA43-TECH 移动技术信息展开 |
| V | 316970a74be81a74.1 | 用户详情原生dialog定义 |
| V | c396c48b2557ec90.1 | PA43-DETAIL Escape取消 |
| V | 2964730aa12dbf82.1 | PA43-MEMBERSHIP 子表单提交转发 |
| V | 2a92366d39ac198e.1 | PA43-DETAIL 错误重试 |
| V | 02668382bdda9d3b.1 | PA43-DETAIL 错误关闭 |
| A | 96a5d8f14ce43590.1 | 新建用户原生dialog定义 |
| A | 9e8b9d6531d0203d.1 | PA43-CREATE Escape取消 |
| A | f76649b0950ec968.1 | PA43-CREATE form提交 |
| A | c3a13fcf7d0fc151.1 | PA43-CREATE 按钮取消 |
| A | 472f3632b99eae63.1 | PA43-CREATE 按钮提交 |
| A | 0a0c76ebc577d650.1 | 密码表单原生dialog定义 |
| A | 04769fc3148b559f.1 | PA43-PASSWORD Escape取消 |
| A | 22727b212f0b7505.1 | PA43-PASSWORD form提交到原因窗 |
| A | 0fbdc8b9a1396e9c.1 | PA43-PASSWORD 按钮取消 |
| A | 9ad3d7837ab53f7c.1 | PA43-PASSWORD 按钮进入原因窗 |
| A | 8cb5dc651024abe9.1 | 共享原因原生dialog定义 |
| A | bd4ff44ef0d1442c.1 | 原因窗Escape取消，不写入 |
| A | 4a0496f0cb3d6338.1 | 原因窗form确认 |
| A | b313681d9ad25f0e.1 | 原因value/input转发，不是v-model |
| A | 07d6870e96868709.1 | 原因窗按钮取消 |
| A | 7819d63c0a94ede2.1 | 原因窗按钮确认 |
| F | e88849ecc037f9c2.1 | PA43-MEMBERSHIP form提交 |
| F | 505257661bdbe17b.1 | PA43-MEMBERSHIP 按钮提交 |

这四文件有9处v-model：A新建五字段+密码一字段，F组织/角色/原因三字段；父query/status另计。33候选包含4个dialog定义；多次渲染、转发与form/button不能简单相加为独立业务操作。

### 1.1 2026-09-24 PlatformUserDetailDialog 当前源码映射

上表V组保留1ad9db7时期身份用于追溯，不作为当前组件完整覆盖。本表逐项记录当前15个候选的身份、行号、种类和动作所有者；原数据接口、服务端权限、原因、幂等和审计语义不因源映射而改变。

#### apps/web/src/components/PlatformUserDetailDialog.vue

| 当前签名.序号 | 行 | 类型 | 当前语义归属 |
| --- | ---: | --- | --- |
| 316970a74be81a74.1 | 44 | dialog-definition | PA43-CURRENT-DETAIL / 原生账号详情窗口定义 |
| c396c48b2557ec90.1 | 44 | event-binding | PA43-CURRENT-CLOSE / Escape关闭并交给父级归属保护 |
| 03bf338e0dc8663a.1 | 58 | control | PA43-CURRENT-SECTION / 滚动到组织关系分区 |
| f575608b4ce38790.1 | 59 | control | PA43-CURRENT-SECTION / 滚动到平台权限分区 |
| 04d8d432043cc06f.1 | 60 | control | PA43-CURRENT-SECTION / 滚动到登录安全分区 |
| 2086f54419d742e3.1 | 69 | control | PA43-CURRENT-CLOSE / 工具栏关闭详情 |
| 2964730aa12dbf82.1 | 115 | event-binding | PA43-CURRENT-MEMBERSHIP / 转发加入组织表单提交和当前用户ID |
| d7a92de7086fdce6.1 | 148 | control | PA43-CURRENT-ROLE / 授予或撤销一个固定平台角色，busy/非活动账号禁用 |
| 86b2bcafa2c5529c.1 | 185 | control | PA43-CURRENT-SESSION / 撤销单个活动会话 |
| a187b4fc34f4ab4e.1 | 199 | control | PA43-CURRENT-STATUS / 停用或恢复登录 |
| 8406f17273df6864.1 | 207 | control | PA43-CURRENT-PASSWORD / 打开既有强制改密确认流程 |
| f1dd7ea535b03340.1 | 210 | control | PA43-CURRENT-SESSION / 撤销当前用户全部会话 |
| 138b8370ecdca0d1.1 | 218 | control | PA43-CURRENT-CLOSE / 页尾关闭详情 |
| 2a92366d39ac198e.1 | 226 | control | PA43-CURRENT-RETRY / 详情加载失败后重试现有读取 |
| 02668382bdda9d3b.1 | 227 | control | PA43-CURRENT-CLOSE / 详情加载错误态关闭窗口 |

| 当前源文件 | 当前LF SHA-256 |
| --- | --- |
| apps/web/src/components/PlatformUserDetailDialog.vue | 87e0b0906fded03d7c5337dafa5e6bfc801a2367d12deb652cc36f0f88d32d9a |

### PA43旧用户详情身份归档

以下七条旧用户详情按钮身份已由1.1节当前源码映射替代，仅保留追溯，不计当前覆盖。

| source | signature | 旧语义 |
| --- | --- | --- |
| apps/web/src/components/PlatformUserDetailDialog.vue | 1070c07ce059b6fa.1 | PA43-DETAIL 旧页首关闭 |
| apps/web/src/components/PlatformUserDetailDialog.vue | 16892f77d1719620.1 | PA43-SESSION 旧单会话撤销 |
| apps/web/src/components/PlatformUserDetailDialog.vue | 3d1d03659c4b6766.1 | PA43-ROLE 旧角色授予/撤销 |
| apps/web/src/components/PlatformUserDetailDialog.vue | 5477852d3db05f5c.1 | PA43-STATUS 旧停用/恢复登录 |
| apps/web/src/components/PlatformUserDetailDialog.vue | eca5d0ed53a62ef0.1 | PA43-PASSWORD 旧打开改密 |
| apps/web/src/components/PlatformUserDetailDialog.vue | f3c55863d4631fd4.1 | PA43-SESSION 旧全部会话撤销 |
| apps/web/src/components/PlatformUserDetailDialog.vue | d7deda0f60ef7bb1.1 | PA43-DETAIL 旧页尾关闭 |

## 2. 父级动作与真实写入

| actionId | 当前入口/请求 | 成功与失败边界 |
| --- | --- | --- |
| PA43-FILTER/RESET/REFRESH | applyFilters/resetFilters/load → GET /platform/accounts?query&status | query/status进URL，无分页；总量来自summary，结果来自users；失败有快照时保留旧值 |
| PA43-CREATE | openCreateUser(false)/createUser → POST /platform/accounts/users | 五字段；空organization_id/platform_role_code转null；无reason字段；成功关闭并重读，错误留在窗内 |
| PA43-DETAIL | openUserDetail → GET /platform/accounts/users/{userId} | H02代次/身份/路由保护；成功user/memberships/sessions，不泄漏敏感原文 |
| PA43-STATUS | toggleUser → POST users/{id}/status | status=disabled/active，reason；服务端禁止停用自己；停用撤销活动会话 |
| PA43-ROLE | role → POST users/{id}/platform-role | role_code、enabled、reason；固定三角色；禁止撤销自己的超级管理员；非active前端禁用 |
| PA43-MEMBERSHIP | addMembership → POST users/{id}/memberships | organization_id、五选一role_code、reason；后台检查active/已验证/组织/关系；写反馈及重读前检查捕获的窗口代次/账号/路由 |
| PA43-PASSWORD | openPassword/resetPassword → POST users/{id}/password | temporary_password、reason；撤销活动会话，要求首次改密；关闭及成功后清理前端临时密码，失败时保留供修正 |
| PA43-SESSION | revokeSessions → POST users/{id}/sessions/revoke | session_id为单ID或null、reason；原因确认及写反馈/成功重读均检查窗口归属；全部会话时序实例不代表每个业务变体验收 |

users短路径均相对/platform/accounts。所有写入仍由既有Origin/Idempotency-Key/服务端能力校验和审计执行。浏览器中的无副作用C原型不证明这些真实合同已执行。

## 3. 弹窗与变体

现有四个原生定义：用户详情、新建、密码、共享原因。P43原因窗展开为11种：停用/恢复2、三角色授予/撤销6、单/全部会话2、密码重置1。组织编辑/状态原因不属于本页，W05全族另补。加入组织当前为详情内联表单；移动记录预览为ResponsiveDataView自建role=dialog，不能当作useModalDialog的同一实现。

C原型提议将组织授权改为独立模态、移动直接开详情；这些是待审展示变化，不是已获准正式设计。全部动作继续只演示本地反馈，表单不产生网络、存储、下载、邮件或数据库副作用。每条固定角色按钮可打开对应原因窗，但18张图没有覆盖11种原因文案、全部禁用/错误/加载状态或完整按钮六态，不因此提高全站覆盖率。

## 4. 事实纠偏与未完成项

- 旧PAGES及旧概念图的分页、批量分配/导出、编辑邮箱等没有本页现有入口；不补造。当前本页规格优先描述真实合同；PAGES参与全局指纹，R01统一纠偏与增量采证，不单改指纹。
- 列表返回最多200；管理员数组可能包含未赋平台角色用户，不能据名称推断为纯管理员集合。账号总量不能取过滤数组长度。
- 初次研究未修改产品。后续PA-D01增量已保护状态/平台角色/会话/组织关系四类写反馈和对应原因确认，见[W05合同2.1](platform-account-contract-review.md#21-用户详情写入反馈归属增量)及PROGRESS实际验证；密码/创建/组织回调、原因窗自动关闭、权限失败与移动预览等剩余项继续待验，不把局部归属保护当全族关闭。
- C合成身份字母图标只是从邮箱生成的装饰，不是新增个人姓名/头像字段。合成组织、角色、安全完成状态、会话用于布局示意，不能把样例之间的组合规律当成后端推导规则。
- 正式三主题/两密度、全部断点/缩放/软键盘、屏幕阅读器、真实后端角色与生产尚未验证。后续W05事实批已补P38–P42/P44/P45七份规格和父/共享候选合同；不等于正式新图、运行时分母或全部行为已通过，当前边界见全族合同。

## 5. 源与证据

C的evidence.json记录设计源、此批实际读取的P43产品入口及账号路由/服务LF哈希，18张图的像素哈希、视口、场景、时间、浏览器和sourceRevision。只读--check在源或图片变化后失败关闭；不是全站baseline/coverage的替代。正式研究入口及复验命令见[README](design/account-direction-c/README.md)。本地33候选与9绑定通过扫描器逐对象核对；不修改生成器来匹配手工表。

## 1.2 2026-09-25 当前父级与目录工作区候选接续

P43动作映射使用本合同作为单一语义源。下表接续共享父组件与目录工作区的当前候选；P39/P40旧归属保留在各自合同中，以下键仅标识P43消费边界，按路由条件将组织/P41与管理员/P44/P45入口明确排除。

### apps/web/src/components/PlatformAccountCenter.vue

| 当前签名 | P43当前语义合同键 |
| --- | --- |
| adcd96ea7cc90712.1 | P43-CURRENT-adcd96ea7cc90712.1 · 仅权限路由显示管理员管理入口，P43不触发 |
| bcd4023ebe5d9ca9.1 | P43-CURRENT-bcd4023ebe5d9ca9.1 · 权限目录的角色刷新入口仅归P45 |
| 280136c1a545dff9.1 | P43-CURRENT-280136c1a545dff9.1 · 组织创建路由入口归P41 |
| 1516ea5a6c3b1540.1 | P43-CURRENT-1516ea5a6c3b1540.1 · 用户路由打开新建用户窗 |
| 8f18fbff9e2c1c99.1 | P43-CURRENT-8f18fbff9e2c1c99.1 · 用户目录页头读取/刷新 |
| c4cfef52bcc169fb.1 | P43-CURRENT-c4cfef52bcc169fb.1 · 权限角色目录首读错误重试归P45 |
| c526b71b2b59e702.1 | P43-CURRENT-c526b71b2b59e702.1 · 权限角色目录空态重试归P45 |
| 8458edc51af426a6.1 | P43-CURRENT-8458edc51af426a6.1 · 目录筛选刷新导航详情事件由父级接线 |
| 5db731eeed33ba4f.1 | P43-CURRENT-5db731eeed33ba4f.1 · 组织向导事件接线只归P41 |
| 2dcca5d38d8e9ea8.1 | P43-CURRENT-2dcca5d38d8e9ea8.1 · 新建改密共享原因事件父级接线；改密关闭走清理处理器 |
| 316b73a793573a29.1 | P43-CURRENT-316b73a793573a29.1 · 共享账号弹窗组件调用身份，不另计业务动作 |
| 6f151cbab1f5518e.1 | P43-CURRENT-6f151cbab1f5518e.1 · 组织详情事件接线只归P42 |
| 39ba950db197263c.1 | P43-CURRENT-39ba950db197263c.1 · 组织详情弹窗调用身份只归P42 |
| 39878a11789ae9ce.1 | P43-CURRENT-39878a11789ae9ce.1 · 用户详情事件父级接线 |
| cab997ead119619a.1 | P43-CURRENT-cab997ead119619a.1 · 用户详情弹窗组件调用身份 |

### apps/web/src/components/PlatformAccountDirectoryWorkspace.vue

| 当前签名 | P43当前语义合同键 |
| --- | --- |
| 29448f61eb8ffc80.1 | P43-CURRENT-29448f61eb8ffc80.1 · 平台账号工作区组织导航 |
| 968274c5acaf5a33.1 | P43-CURRENT-968274c5acaf5a33.1 · 平台账号工作区用户导航 |
| e400286c7cd59e44.1 | P43-CURRENT-e400286c7cd59e44.1 · 平台账号工作区管理员导航 |
| 9c9141422bfd2c11.1 | P43-CURRENT-9c9141422bfd2c11.1 · 组织记录手动读取归P40 |
| 03d32a05b1b3fd19.1 | P43-CURRENT-03d32a05b1b3fd19.1 · 响应式筛选抽屉容器 |
| 2d610959fc00fb96.1 | P43-CURRENT-2d610959fc00fb96.1 · 筛选表单提交到父级applyFilters |
| e9658d470d4cbeaf.1 | P43-CURRENT-e9658d470d4cbeaf.1 · 搜索按钮提交同一用户筛选表单 |
| 20080e701de7f5cb.1 | P43-CURRENT-20080e701de7f5cb.1 · 重置用户query/status |
| 322a4ac62ce3a305.1 | P43-CURRENT-322a4ac62ce3a305.1 · 用户目录首读失败重试 |
| 86ea70e081f1f8e3.1 | P43-CURRENT-86ea70e081f1f8e3.1 · 用户筛选空态清除筛选 |
| f68d2406f8c1db70.1 | P43-CURRENT-f68d2406f8c1db70.1 · 组织目录空态创建归P40 |
| 8871f6d994e9fced.1 | P43-CURRENT-8871f6d994e9fced.1 · 组织行详情事件归P40 |
| 44e761922e1da1d0.1 | P43-CURRENT-44e761922e1da1d0.1 · 用户行详情事件转发 |
| 86ea70e081f1f8e3.2 | P43-CURRENT-86ea70e081f1f8e3.2 · 管理员空态筛选归P44 |
| 38003e3f7b002f71.1 | P43-CURRENT-38003e3f7b002f71.1 · 管理员创建入口归P44 |
| 103fa7d7798d62d6.1 | P43-CURRENT-103fa7d7798d62d6.1 · 管理员行详情转发归P44 |

| 当前父/工作区源文件 | 当前LF SHA-256 |
| --- | --- |
| apps/web/src/components/PlatformAccountCenter.vue | eda65671ef8a8cb49af3de234a552ec96db0571a82b68f39ea533b6b72a27213 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | bee80399a3beb012f7b114d95be365486e754fee03e2c307bee8c5432bad5c08 |

其余四个直接页面组件沿用本合同已有当前候选记录；P43.json另固定六个组件的当前LF指纹。源位置数不等于唯一按钮或业务动作数。
## P44 当前来源补映射

以下候选属于 `/platform-admin/admins` 实际渲染的管理员列表、只读角色比较和全局账号目录导航。它们沿用本文件的 P43-CURRENT 源身份约定；管理员/比较/全局侧栏的独立页面语义键使用 P44-CURRENT。此补映射只建立源候选到现行合同的可追溯性，不表示按钮六态、动作批准或生产权限验收通过。

| 源候选 | P44 当前语义合同 | 页面边界 |
| --- | --- | --- |
| M | b77b1781563a48b8.1 | P44-CURRENT-b77b1781563a48b8.1 · 桌面管理员账号详情入口，触发父级既有详情读取 |
| M | 18553297e6cbdd0a.1 | P44-CURRENT-18553297e6cbdd0a.1 · 移动管理员预览转详情，先关闭预览再发同一详情意图 |
| M | 1c008f867673db60.1 | P44-CURRENT-1c008f867673db60.1 · 管理员账号技术详情展开，仅展开已有标识 |
| R | e4a2fbf8875f3488.1 | P44-CURRENT-e4a2fbf8875f3488.1 · 嵌入式角色比较重置，本地状态、不写URL、不调用写API |
| G | 29448f61eb8ffc80.1 | P44-CURRENT-29448f61eb8ffc80.1 · 管理员页全局组织导航，保持既有路由守卫 |
| G | ffed2dd7f439c4b0.1 | P44-CURRENT-ffed2dd7f439c4b0.1 · 管理员页全局用户导航，保持既有路由守卫 |
| G | e400286c7cd59e44.1 | P44-CURRENT-e400286c7cd59e44.1 · 管理员页全局管理员导航，当前页导航、不新增权限 |
