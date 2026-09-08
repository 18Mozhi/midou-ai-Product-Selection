# 用户与平台管理员 C 方向审核稿

版本：USER-ADMIN-C-r1；日期：2026-09-09；具体图稿待用户审核，未部署。

[打开用户管理交互稿](index.html?mode=users) · [打开管理员交互稿](index.html?mode=admins) · [证据清单](evidence.json)

P43 52 场景、P44 59 场景，共111场景；1440/390双端222主图＋34长弹窗下部，共256PNG。不是256个页面，也不计作全73页完成。18张早期C结构研究保持独立，本包补足两页具体目录、详情三分区、各11原因、创建与角色比较的审核材料。

## 设计计划与取舍

frontend-design 技能把本页主线从长详情卡片堆叠改为“账号身份—组织关系—平台权限—登录安全”。蓝色 #254a9c 承担导航/账号身份；白色 #ffffff 承担工作内容；冷灰 #edf1f6 区分页面背景；正文 #202c3d、次级 #58677b、风险 #8c3c32。中文使用本机 Microsoft YaHei UI，邮箱/身份使用 Bahnschrift；30/24/20/16/14字号层级，内容左对齐。没有外部字体、图标资源、依赖安装或装饰动效。

```text
蓝色管理目录 | P43 五列用户目录 / P44 三列可授权账号目录
                              └ 桌面详情 / 手机预览 → 账号详情
蓝色账号身份与分区导航 | 组织关系：已有关系 + 加入其他组织内联表单
                       平台权限：三种角色逐项授予/撤销
                       登录安全：会话记录 + 独立安全操作
                                             └ 改密表单 → 原因确认
P44 目录下方：独立角色来源的只读权限对比，不代替账号授权
```

与早期研究提议不同，本次保留手机预览再进详情、详情内联组织授权，以当前合同为依据，不把“移动直进详情/独立授权窗”视作已批准行为。详情三分区和新的视觉布局仍是提案；不改变后端字段或角色种类。视觉复核缩小身份栏邮箱字号，避免短邮箱末尾孤字；六个授予/撤销原因变体的底层角色状态与操作方向一致。

请审核：身份栏是否占空间、详情三分区是否清楚、列表密度、组织/平台权限区分、安全影响文案、原因确认目标及手机下部操作。选择 C 不等于批准本批具体稿。

## 事实与提案边界

- 原 overview 与角色目录从现有 m06-01-platform-accounts E2E AST 提取：全局用户18/正常16/管理员2，users、admins各1条；角色目录3条、能力合并7种。普通用户 Chrome 会话详情及管理员空关系/空会话详情独立提取，不拼接为同一账号事实。附加12行、长文本、角色前态、失败、停用和关系变体为合成。
- 原用户详情夹具中的关系缺 organization_id。原型保留缺失并注明源规则无法排除它，不能把“同名组织候选仍可选”当现实业务可重复加入。合成授权场景才补明确关联ID，原夹具不改。
- GET /api/v1/platform/accounts query/status固定最多200，无分页。用户按更新时间；管理员数组由users LEFT JOIN角色返回，包含无平台角色账号，不等于管理员总数。筛选本地仅模拟邮箱包含，不证明真实SQL/转义/排序/权限。
- 详情 GET /api/v1/platform/accounts/users/{id} 返回 user/memberships/sessions；平台角色来自选中列表记录，不在详情响应中猜造。详情最多100会话，只按返回status=active计数；列表另外检查expires_at，不能强行对齐。真实业务数据库不是本地演示数据。
- POST users 创建保持五字段，空org/platform为null，不新增reason。P44默认运营管理员，仍允许改普通用户或其他固定角色；加入组织时初始组织角色仅member/organization_admin。12–128临时密码，首次改密/MFA只是现有服务要求，本次未执行。
- 加入其他组织仅active且不存在任何已有关系（含停用关系），五种组织角色；body为organization_id/role_code/reason。该表单按源父函数原样传递reason，后端trim；不把它等同共享原因窗已trim的body。邮箱验证/组织有效性/重复关系仍由真实后端核验。
- 11原因变体：停用/恢复2、三角色各授予/撤销6、单/全部会话2、改密1。均POST；status body为status/reason；角色为role_code/enabled/reason；会话为session_id（单ID或null）/reason；密码为temporary_password/reason。共享原因trim后2–300，不增expected_version。
- 强制改密源码同时撤销活动会话、要求首次改密并将账号status设为active；图稿明确这项影响，未修改业务。真实服务惰性验证自我停用与撤销自己超级管理员拒绝，不代表真实鉴权或MySQL审计通过。
- 真详情 composable 惰性执行已验证旧GET不覆盖新账号、关闭/换路由失效。真实 resetPassword 原因回调读取当前selected和密码的漂移已复现；本稿锁定确认快照、关闭后清空临时密码及迟到结果保护，仅提案，不是生产修复。原四类已保护写操作不能因此宣称所有创建/密码生命周期已解决。
- P44比较使用真实组件computed所对应的合并/差异/分组/搜索规则，目录来自原角色夹具；persistSelection=false，不写P45的五个URL参数。默认两角色6差异，同角色0差异/全部3；本次交互已验证。不把只读比较当赋权界面。

## 如何试用

直接双击HTML；从蓝色目录切换用户/管理员，点击账号详情或手机预览，再进入三个分区。审核场景选择器在底部；模态打开时先关闭最上层窗口或按Escape。状态覆盖见下方全图索引。

点击确认只记录内存请求意图，不发送网络请求；处理中可展开弹窗内“离线模拟结果”选择返回或失败。写成功不会自动把旧事实改成已同步；必须真实环境重读验证。关闭不等于取消后台写入，本原型没有真实后台。

密码仅来自合成值/手工输入，不进入任何存储；取消/完成清空属于提案。内存审查日志将password替换成省略标记，待处理请求仅在内存持有。不要用本地稿输入真实密码或客户数据。

## 复验与未覆盖

```powershell
node scripts/verify-ui-phase2-user-admin-c.mjs --capture
node scripts/verify-ui-phase2-user-admin-c.mjs
```

第一条生成永久交付截图；第二条重跑源数据一致性、源/PNG哈希、精确文件清单及全部离线交互。引用上一批的organizations.css作为C基础样式，已纳入源指纹；不要单独移动本文件夹。

已覆盖双视口两页创建五字段/默认角色、11原因精确body/path、五组织角色、必填与密码长度、无效原因、停用/结束会话按钮、取消/迟到归属、改密快照、原因失效零写入、嵌套Escape与Tab、邮箱URL筛选、比较重置/搜索/分组不持久化、字段label/重复ID/横向溢出/44px控件及16px表单字体。另有759/760/768/1024局部检查，HTTP/console/pageerror/存储为0。

未覆盖：挂载Vue与真实API/MySQL/RBAC/邮件/MFA/审计，完整前进后退/KeepAlive/所有读写竞态、实际读取超时/取消、全主题密度、200条压力、200%原生缩放、软键盘和辅助技术实测。列表刷新/详情重试是本地夹具演示；状态截图不是这些生产路径的通过证据。角色目录空/失败是明确视觉提案，不虚构后台成功。

生产Vue、接口、配置、环境变量、数据库结构、权限和依赖未改；OpenAPI、env、迁移和重启不适用。自有浏览器在finally关闭，没有临时文件/开发服务。全部图和源码为永久审核交付。具体审图、正式Vue、完整73页及BaoTa部署/签收仍待完成；下一页面P45平台权限比较。

## 全图索引

### P43 用户管理

- [1440 / list](1440-users--list.png)
- [1440 / many](1440-users--many.png)
- [1440 / long](1440-users--long.png)
- [1440 / empty](1440-users--empty.png)
- [1440 / filtered_empty](1440-users--filtered_empty.png)
- [1440 / disabled](1440-users--disabled.png)
- [1440 / loading](1440-users--loading.png)
- [1440 / error](1440-users--error.png)
- [1440 / timeout](1440-users--timeout.png)
- [1440 / refresh_error](1440-users--refresh_error.png)
- [1440 / filter](1440-users--filter.png)
- [1440 / columns](1440-users--columns.png)
- [1440 / compact](1440-users--compact.png)
- [1440 / preview](1440-users--preview.png)
- [1440 / technical](1440-users--technical.png)
- [1440 / detail](1440-users--detail.png)
- [1440 / detail / 滚动下部](1440-users--detail-bottom.png)
- [1440 / detail_loading](1440-users--detail_loading.png)
- [1440 / detail_error](1440-users--detail_error.png)
- [1440 / memberships](1440-users--memberships.png)
- [1440 / memberships / 滚动下部](1440-users--memberships-bottom.png)
- [1440 / no_memberships](1440-users--no_memberships.png)
- [1440 / no_memberships / 滚动下部](1440-users--no_memberships-bottom.png)
- [1440 / membership_error](1440-users--membership_error.png)
- [1440 / membership_error / 滚动下部](1440-users--membership_error-bottom.png)
- [1440 / roles](1440-users--roles.png)
- [1440 / disabled_roles](1440-users--disabled_roles.png)
- [1440 / security](1440-users--security.png)
- [1440 / no_sessions](1440-users--no_sessions.png)
- [1440 / expired_session](1440-users--expired_session.png)
- [1440 / password](1440-users--password.png)
- [1440 / password_error](1440-users--password_error.png)
- [1440 / password_invalid](1440-users--password_invalid.png)
- [1440 / create](1440-users--create.png)
- [1440 / create_org](1440-users--create_org.png)
- [1440 / create_error](1440-users--create_error.png)
- [1440 / create_busy](1440-users--create_busy.png)
- [1440 / write_busy](1440-users--write_busy.png)
- [1440 / write_error](1440-users--write_error.png)
- [1440 / write_read_error](1440-users--write_read_error.png)
- [1440 / reason_invalid](1440-users--reason_invalid.png)
- [1440 / self_refusal](1440-users--self_refusal.png)
- [1440 / focus](1440-users--focus.png)
- [1440 / hover](1440-users--hover.png)
- [1440 / pressed](1440-users--pressed.png)
- [1440 / reason_disable](1440-users--reason_disable.png)
- [1440 / reason_restore](1440-users--reason_restore.png)
- [1440 / reason_grant_operations](1440-users--reason_grant_operations.png)
- [1440 / reason_revoke_operations](1440-users--reason_revoke_operations.png)
- [1440 / reason_grant_security](1440-users--reason_grant_security.png)
- [1440 / reason_revoke_security](1440-users--reason_revoke_security.png)
- [1440 / reason_grant_super](1440-users--reason_grant_super.png)
- [1440 / reason_revoke_super](1440-users--reason_revoke_super.png)
- [1440 / reason_session](1440-users--reason_session.png)
- [1440 / reason_sessions](1440-users--reason_sessions.png)
- [1440 / reason_reset_password](1440-users--reason_reset_password.png)
- [390 / list](390-users--list.png)
- [390 / many](390-users--many.png)
- [390 / long](390-users--long.png)
- [390 / empty](390-users--empty.png)
- [390 / filtered_empty](390-users--filtered_empty.png)
- [390 / disabled](390-users--disabled.png)
- [390 / loading](390-users--loading.png)
- [390 / error](390-users--error.png)
- [390 / timeout](390-users--timeout.png)
- [390 / refresh_error](390-users--refresh_error.png)
- [390 / filter](390-users--filter.png)
- [390 / columns](390-users--columns.png)
- [390 / compact](390-users--compact.png)
- [390 / preview](390-users--preview.png)
- [390 / technical](390-users--technical.png)
- [390 / detail](390-users--detail.png)
- [390 / detail / 滚动下部](390-users--detail-bottom.png)
- [390 / detail_loading](390-users--detail_loading.png)
- [390 / detail_error](390-users--detail_error.png)
- [390 / memberships](390-users--memberships.png)
- [390 / memberships / 滚动下部](390-users--memberships-bottom.png)
- [390 / no_memberships](390-users--no_memberships.png)
- [390 / no_memberships / 滚动下部](390-users--no_memberships-bottom.png)
- [390 / membership_error](390-users--membership_error.png)
- [390 / membership_error / 滚动下部](390-users--membership_error-bottom.png)
- [390 / roles](390-users--roles.png)
- [390 / roles / 滚动下部](390-users--roles-bottom.png)
- [390 / disabled_roles](390-users--disabled_roles.png)
- [390 / disabled_roles / 滚动下部](390-users--disabled_roles-bottom.png)
- [390 / security](390-users--security.png)
- [390 / security / 滚动下部](390-users--security-bottom.png)
- [390 / no_sessions](390-users--no_sessions.png)
- [390 / no_sessions / 滚动下部](390-users--no_sessions-bottom.png)
- [390 / expired_session](390-users--expired_session.png)
- [390 / expired_session / 滚动下部](390-users--expired_session-bottom.png)
- [390 / password](390-users--password.png)
- [390 / password_error](390-users--password_error.png)
- [390 / password_invalid](390-users--password_invalid.png)
- [390 / create](390-users--create.png)
- [390 / create_org](390-users--create_org.png)
- [390 / create_error](390-users--create_error.png)
- [390 / create_busy](390-users--create_busy.png)
- [390 / write_busy](390-users--write_busy.png)
- [390 / write_busy / 滚动下部](390-users--write_busy-bottom.png)
- [390 / write_error](390-users--write_error.png)
- [390 / write_error / 滚动下部](390-users--write_error-bottom.png)
- [390 / write_read_error](390-users--write_read_error.png)
- [390 / write_read_error / 滚动下部](390-users--write_read_error-bottom.png)
- [390 / reason_invalid](390-users--reason_invalid.png)
- [390 / self_refusal](390-users--self_refusal.png)
- [390 / self_refusal / 滚动下部](390-users--self_refusal-bottom.png)
- [390 / focus](390-users--focus.png)
- [390 / hover](390-users--hover.png)
- [390 / pressed](390-users--pressed.png)
- [390 / reason_disable](390-users--reason_disable.png)
- [390 / reason_restore](390-users--reason_restore.png)
- [390 / reason_grant_operations](390-users--reason_grant_operations.png)
- [390 / reason_revoke_operations](390-users--reason_revoke_operations.png)
- [390 / reason_grant_security](390-users--reason_grant_security.png)
- [390 / reason_revoke_security](390-users--reason_revoke_security.png)
- [390 / reason_grant_super](390-users--reason_grant_super.png)
- [390 / reason_revoke_super](390-users--reason_revoke_super.png)
- [390 / reason_session](390-users--reason_session.png)
- [390 / reason_sessions](390-users--reason_sessions.png)
- [390 / reason_reset_password](390-users--reason_reset_password.png)

### P44 平台管理员管理

- [1440 / list](1440-admins--list.png)
- [1440 / many](1440-admins--many.png)
- [1440 / long](1440-admins--long.png)
- [1440 / empty](1440-admins--empty.png)
- [1440 / filtered_empty](1440-admins--filtered_empty.png)
- [1440 / disabled](1440-admins--disabled.png)
- [1440 / loading](1440-admins--loading.png)
- [1440 / error](1440-admins--error.png)
- [1440 / timeout](1440-admins--timeout.png)
- [1440 / refresh_error](1440-admins--refresh_error.png)
- [1440 / filter](1440-admins--filter.png)
- [1440 / columns](1440-admins--columns.png)
- [1440 / compact](1440-admins--compact.png)
- [1440 / preview](1440-admins--preview.png)
- [1440 / technical](1440-admins--technical.png)
- [1440 / detail](1440-admins--detail.png)
- [1440 / detail / 滚动下部](1440-admins--detail-bottom.png)
- [1440 / detail_loading](1440-admins--detail_loading.png)
- [1440 / detail_error](1440-admins--detail_error.png)
- [1440 / memberships](1440-admins--memberships.png)
- [1440 / memberships / 滚动下部](1440-admins--memberships-bottom.png)
- [1440 / no_memberships](1440-admins--no_memberships.png)
- [1440 / no_memberships / 滚动下部](1440-admins--no_memberships-bottom.png)
- [1440 / membership_error](1440-admins--membership_error.png)
- [1440 / membership_error / 滚动下部](1440-admins--membership_error-bottom.png)
- [1440 / roles](1440-admins--roles.png)
- [1440 / disabled_roles](1440-admins--disabled_roles.png)
- [1440 / security](1440-admins--security.png)
- [1440 / no_sessions](1440-admins--no_sessions.png)
- [1440 / expired_session](1440-admins--expired_session.png)
- [1440 / password](1440-admins--password.png)
- [1440 / password_error](1440-admins--password_error.png)
- [1440 / password_invalid](1440-admins--password_invalid.png)
- [1440 / create](1440-admins--create.png)
- [1440 / create_org](1440-admins--create_org.png)
- [1440 / create_error](1440-admins--create_error.png)
- [1440 / create_busy](1440-admins--create_busy.png)
- [1440 / write_busy](1440-admins--write_busy.png)
- [1440 / write_error](1440-admins--write_error.png)
- [1440 / write_read_error](1440-admins--write_read_error.png)
- [1440 / reason_invalid](1440-admins--reason_invalid.png)
- [1440 / self_refusal](1440-admins--self_refusal.png)
- [1440 / focus](1440-admins--focus.png)
- [1440 / hover](1440-admins--hover.png)
- [1440 / pressed](1440-admins--pressed.png)
- [1440 / reason_disable](1440-admins--reason_disable.png)
- [1440 / reason_restore](1440-admins--reason_restore.png)
- [1440 / reason_grant_operations](1440-admins--reason_grant_operations.png)
- [1440 / reason_revoke_operations](1440-admins--reason_revoke_operations.png)
- [1440 / reason_grant_security](1440-admins--reason_grant_security.png)
- [1440 / reason_revoke_security](1440-admins--reason_revoke_security.png)
- [1440 / reason_grant_super](1440-admins--reason_grant_super.png)
- [1440 / reason_revoke_super](1440-admins--reason_revoke_super.png)
- [1440 / reason_session](1440-admins--reason_session.png)
- [1440 / reason_sessions](1440-admins--reason_sessions.png)
- [1440 / reason_reset_password](1440-admins--reason_reset_password.png)
- [1440 / comparison](1440-admins--comparison.png)
- [1440 / compare_all](1440-admins--compare_all.png)
- [1440 / compare_search](1440-admins--compare_search.png)
- [1440 / compare_group](1440-admins--compare_group.png)
- [1440 / compare_empty](1440-admins--compare_empty.png)
- [1440 / roles_error](1440-admins--roles_error.png)
- [1440 / roles_empty](1440-admins--roles_empty.png)
- [390 / list](390-admins--list.png)
- [390 / many](390-admins--many.png)
- [390 / long](390-admins--long.png)
- [390 / empty](390-admins--empty.png)
- [390 / filtered_empty](390-admins--filtered_empty.png)
- [390 / disabled](390-admins--disabled.png)
- [390 / loading](390-admins--loading.png)
- [390 / error](390-admins--error.png)
- [390 / timeout](390-admins--timeout.png)
- [390 / refresh_error](390-admins--refresh_error.png)
- [390 / filter](390-admins--filter.png)
- [390 / columns](390-admins--columns.png)
- [390 / compact](390-admins--compact.png)
- [390 / preview](390-admins--preview.png)
- [390 / technical](390-admins--technical.png)
- [390 / detail](390-admins--detail.png)
- [390 / detail / 滚动下部](390-admins--detail-bottom.png)
- [390 / detail_loading](390-admins--detail_loading.png)
- [390 / detail_error](390-admins--detail_error.png)
- [390 / memberships](390-admins--memberships.png)
- [390 / memberships / 滚动下部](390-admins--memberships-bottom.png)
- [390 / no_memberships](390-admins--no_memberships.png)
- [390 / no_memberships / 滚动下部](390-admins--no_memberships-bottom.png)
- [390 / membership_error](390-admins--membership_error.png)
- [390 / membership_error / 滚动下部](390-admins--membership_error-bottom.png)
- [390 / roles](390-admins--roles.png)
- [390 / roles / 滚动下部](390-admins--roles-bottom.png)
- [390 / disabled_roles](390-admins--disabled_roles.png)
- [390 / disabled_roles / 滚动下部](390-admins--disabled_roles-bottom.png)
- [390 / security](390-admins--security.png)
- [390 / security / 滚动下部](390-admins--security-bottom.png)
- [390 / no_sessions](390-admins--no_sessions.png)
- [390 / no_sessions / 滚动下部](390-admins--no_sessions-bottom.png)
- [390 / expired_session](390-admins--expired_session.png)
- [390 / expired_session / 滚动下部](390-admins--expired_session-bottom.png)
- [390 / password](390-admins--password.png)
- [390 / password_error](390-admins--password_error.png)
- [390 / password_invalid](390-admins--password_invalid.png)
- [390 / create](390-admins--create.png)
- [390 / create_org](390-admins--create_org.png)
- [390 / create_error](390-admins--create_error.png)
- [390 / create_busy](390-admins--create_busy.png)
- [390 / write_busy](390-admins--write_busy.png)
- [390 / write_busy / 滚动下部](390-admins--write_busy-bottom.png)
- [390 / write_error](390-admins--write_error.png)
- [390 / write_error / 滚动下部](390-admins--write_error-bottom.png)
- [390 / write_read_error](390-admins--write_read_error.png)
- [390 / write_read_error / 滚动下部](390-admins--write_read_error-bottom.png)
- [390 / reason_invalid](390-admins--reason_invalid.png)
- [390 / self_refusal](390-admins--self_refusal.png)
- [390 / self_refusal / 滚动下部](390-admins--self_refusal-bottom.png)
- [390 / focus](390-admins--focus.png)
- [390 / hover](390-admins--hover.png)
- [390 / pressed](390-admins--pressed.png)
- [390 / reason_disable](390-admins--reason_disable.png)
- [390 / reason_restore](390-admins--reason_restore.png)
- [390 / reason_grant_operations](390-admins--reason_grant_operations.png)
- [390 / reason_revoke_operations](390-admins--reason_revoke_operations.png)
- [390 / reason_grant_security](390-admins--reason_grant_security.png)
- [390 / reason_revoke_security](390-admins--reason_revoke_security.png)
- [390 / reason_grant_super](390-admins--reason_grant_super.png)
- [390 / reason_revoke_super](390-admins--reason_revoke_super.png)
- [390 / reason_session](390-admins--reason_session.png)
- [390 / reason_sessions](390-admins--reason_sessions.png)
- [390 / reason_reset_password](390-admins--reason_reset_password.png)
- [390 / comparison](390-admins--comparison.png)
- [390 / compare_all](390-admins--compare_all.png)
- [390 / compare_search](390-admins--compare_search.png)
- [390 / compare_group](390-admins--compare_group.png)
- [390 / compare_empty](390-admins--compare_empty.png)
- [390 / roles_error](390-admins--roles_error.png)
- [390 / roles_empty](390-admins--roles_empty.png)
