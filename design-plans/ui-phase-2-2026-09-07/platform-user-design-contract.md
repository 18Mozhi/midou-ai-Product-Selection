# P43 用户管理设计事实与局部动作合同

依据：main/1ad9db7；产品源码与H02提交5192de2相同。本批只交P43规格与独立C研究，不宣称W05八页或全站语义分母完成。API均使用既有客户端的/api/v1前缀，角色平台:superadmin以实际代码字符串platform:superadmin为准。

## 1. 候选归属（33个直接候选，不是业务动作分母）

文件别名均在apps/web/src/components：U=PlatformUserRecords.vue，V=PlatformUserDetailDialog.vue，A=PlatformAccountDialogs.vue，F=PlatformUserMembershipForm.vue。下表sig必须与扫描器逐对象一致；重复sig用文件名区分。父PlatformAccountCenter、NavigationShell、ResponsiveDataView、TableViewControls、ResponsiveFilterDrawer等共享入口尚需W05全族合同补齐，不把33项当P43全部运行时动作。

| 文件 | candidate sig | 归属/真实语义 |
| --- | --- | --- |
| U | b77b1781563a48b8.1 | PA43-DETAIL 桌面打开 |
| U | 18553297e6cbdd0a.1 | PA43-DETAIL 移动从预览进入详情并关闭预览 |
| U | 1c008f867673db60.1 | PA43-TECH 移动技术信息展开 |
| V | 316970a74be81a74.1 | 用户详情原生dialog定义 |
| V | c396c48b2557ec90.1 | PA43-DETAIL Escape取消 |
| V | 1070c07ce059b6fa.1 | PA43-DETAIL 页首关闭 |
| V | 2964730aa12dbf82.1 | PA43-MEMBERSHIP 子表单提交转发 |
| V | 16892f77d1719620.1 | PA43-SESSION 单会话撤销 |
| V | 3d1d03659c4b6766.1 | PA43-ROLE 三角色各授予/撤销，共六变体 |
| V | 5477852d3db05f5c.1 | PA43-STATUS 停用/恢复登录 |
| V | eca5d0ed53a62ef0.1 | PA43-PASSWORD 打开改密 |
| V | f3c55863d4631fd4.1 | PA43-SESSION 全部撤销 |
| V | d7deda0f60ef7bb1.1 | PA43-DETAIL 页尾关闭 |
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

## 2. 父级动作与真实写入

| actionId | 当前入口/请求 | 成功与失败边界 |
| --- | --- | --- |
| PA43-FILTER/RESET/REFRESH | applyFilters/resetFilters/load → GET /platform/accounts?query&status | query/status进URL，无分页；总量来自summary，结果来自users；失败有快照时保留旧值 |
| PA43-CREATE | openCreateUser(false)/createUser → POST /platform/accounts/users | 五字段；空organization_id/platform_role_code转null；无reason字段；成功关闭并重读，错误留在窗内 |
| PA43-DETAIL | openUserDetail → GET /platform/accounts/users/{userId} | H02代次/身份/路由保护；成功user/memberships/sessions，不泄漏敏感原文 |
| PA43-STATUS | toggleUser → POST users/{id}/status | status=disabled/active，reason；服务端禁止停用自己；停用撤销活动会话 |
| PA43-ROLE | role → POST users/{id}/platform-role | role_code、enabled、reason；固定三角色；禁止撤销自己的超级管理员；非active前端禁用 |
| PA43-MEMBERSHIP | addMembership → POST users/{id}/memberships | organization_id、五选一role_code、reason；后台检查active/已验证/组织/关系；当前写后重开读取selected，未验归属 |
| PA43-PASSWORD | openPassword/resetPassword → POST users/{id}/password | temporary_password、reason；撤销活动会话，要求首次改密；前端密码关闭后保留待验 |
| PA43-SESSION | revokeSessions → POST users/{id}/sessions/revoke | session_id为单ID或null、reason；成功重读详情；回调是否仍属于窗口未验 |

users短路径均相对/platform/accounts。所有写入仍由既有Origin/Idempotency-Key/服务端能力校验和审计执行。浏览器中的无副作用C原型不证明这些真实合同已执行。

## 3. 弹窗与变体

现有四个原生定义：用户详情、新建、密码、共享原因。P43原因窗展开为11种：停用/恢复2、三角色授予/撤销6、单/全部会话2、密码重置1。组织编辑/状态原因不属于本页，W05全族另补。加入组织当前为详情内联表单；移动记录预览为ResponsiveDataView自建role=dialog，不能当作useModalDialog的同一实现。

C原型提议将组织授权改为独立模态、移动直接开详情；这些是待审展示变化，不是已获准正式设计。全部动作继续只演示本地反馈，表单不产生网络、存储、下载、邮件或数据库副作用。每条固定角色按钮可打开对应原因窗，但18张图没有覆盖11种原因文案、全部禁用/错误/加载状态或完整按钮六态，不因此提高全站覆盖率。

## 4. 事实纠偏与未完成项

- 旧PAGES及旧概念图的分页、批量分配/导出、编辑邮箱等没有本页现有入口；不补造。当前本页规格优先描述真实合同；PAGES参与全局指纹，R01统一纠偏与增量采证，不单改指纹。
- 列表返回最多200；管理员数组可能包含未赋平台角色用户，不能据名称推断为纯管理员集合。账号总量不能取过滤数组长度。
- PA-D01–PA-D04原未关闭项仍有效。本批未修改父级写回调、密码清理、刷新权限失败、URL历史或移动预览实现，未重跑H02产品回归。
- C合成身份字母图标只是从邮箱生成的装饰，不是新增个人姓名/头像字段。合成组织、角色、安全完成状态、会话用于布局示意，不能把样例之间的组合规律当成后端推导规则。
- 正式三主题/两密度、全部断点/缩放/软键盘、屏幕阅读器、真实后端角色与生产尚未验证；W05剩P38–P42/P44/P45七份规格及全族共享清单尚缺。

## 5. 源与证据

C的evidence.json记录设计源、此批实际读取的P43产品入口及账号路由/服务LF哈希，18张图的像素哈希、视口、场景、时间、浏览器和sourceRevision。只读--check在源或图片变化后失败关闭；不是全站baseline/coverage的替代。正式研究入口及复验命令见[README](design/account-direction-c/README.md)。本地33候选与9绑定通过扫描器逐对象核对；不修改生成器来匹配手工表。
