# P30 成员与邀请 · MEMBERS-C-r1

状态：C 方向独立审核稿，具体页面未获审；不是实际 Vue 改造、生产验证或部署报告。

[打开交互原型](index.html)。直接打开，无需服务；顶部“审核场景”切换状态和查看请求意图，不连接 API、不发送邮件。

## 设计与目检

使用 frontend-design：蓝色页内目录、白色成员工作区优先，邀请独立后置；取代旧的上方双卡加底部大表。桌面成员行依次为身份/状态、角色/团队/范围、角色分配与状态操作。手机依序堆叠，筛选折叠但已选摘要保留，邀请与成员可用目录定位。目录不是其他组织后台页面的完成证明。

C 色板：#254a9c / #193b80 蓝目录、#202c3d 正文、#58677b 辅助、#edf1f6 底色、#dbe1e9 分隔、白内容面；Microsoft YaHei UI / Microsoft YaHei，无旧衬线/奶油配色。控件至少16px与44px热区，辅助至少13px；仅按钮短反馈且遵循 reduced-motion。

四种原因窗突出目标成员/邮箱、动作影响与版本，底部确认/取消保留。截图目检覆盖桌面成员分列、手机长页及角色窗；测试发现手机打开筛选后输入可能意外收起，原型修正当前open读取及脱离节点toggle回写，重测后才采最终图。此修复未改生产Vue。

## 每项控件与实际合同

| 控件 | 范围与请求 |
| --- | --- |
| 搜索/状态/角色/团队/排序/重置 | 姓名或邮箱子串；有效状态；既有角色；已加载团队；姓名/加入时间/状态排序。改筛选重置页码，不发新API |
| 上一页/下一页 | 已加载items本地10条一页，页码被结果页数约束；不是服务器全量分页 |
| 成员技术详情 | 折叠成员ID、version、加入时间；不是编辑个人账号 |
| 行角色选择 | 选择本身不写入；固定五角色，不是创建或自定义角色权限 |
| 分配角色 | 原因窗确认后POST /org/admin/members/:id/roles，body=role_code/expected_version/reason |
| 禁用/恢复成员 | 原因窗确认后POST /org/admin/members/:id/actions，body=action/expected_version/reason；恢复成员不解除账号锁定 |
| 邀请邮箱/角色/原因 | 换行、逗号、分号拆分，trim、小写、去重；每合法邮箱单独POST /org/admin/invitations，body=email/role_code/reason |
| 创建邀请 | 邮箱格式与254长度边界、原因1–500；非法邮箱本地结果，逐条成功/失败，不是整批原子 |
| 待接受/已失效 | pending_delivery或pending_acceptance且期限未来；expired/revoked或期限已到归失效；原返回status仍保留 |
| 撤销邀请 | 待接受记录原因窗，POST /org/admin/invitations/:id/actions，body=action:revoke/expected_version/reason |
| 原因输入/确认 | 源UI至少2字、初值动作名称，提案另加500上限对齐服务；选择角色在开窗前锁定 |
| 取消/关闭/Escape | 不提交，回到原触发按钮；Tab/Shift+Tab循环含确认禁用分支 |
| 确认后的错误 | 沿源逻辑先关原因窗再写入，错误在父页面；重开为默认原因，不承诺失败原因恢复 |
| 刷新/重新加载 | GET /org/admin/summary及/org/admin/members；本稿仅记读取意图，不制造重读成功 |
| 目录 | 页内成员/邀请锚点、选中反馈与焦点，不跨页发请求 |
| 审核场景 | 非业务功能，可切47场景并查看意图日志 |

五角色沿现有member、selection_manager、procurement_member、organization_admin、auditor。角色分配在实际仓库中替换已有角色，不是累加授权。成员读取membership:read、邀请/状态membership:manage、角色分配role:manage，父摘要另要求organization:manage；按钮可见不能证明后端权限。自身禁用与最后活动管理员、当前组织归属/版本/幂等均留在既有后端，不改规则。

## 数据与提案边界

- 原m06-01 E2E变量通过AST提取3条成员与2条邀请。摘要128成员与本页3条不一致保留；不补造125人。11人分页、长内容、停用、扩展邀请和失败均标合成。
- 有效状态优先成员关系非active，其次账号locked/disabled；同时展示两层事实，恢复关系不冒充解锁账号。
- 固定离线时钟2026-09-08T00:00Z；到期项进入失效分组但pending_delivery原标签不伪改。创建待投递不等于邮件已发出，更不等于接受。
- 真实inviteMembers惰性执行复现部分失败只保留失败/无效邮箱；403分支中断后丢失尚未处理尾部，且最终汇总覆盖notice（OG-G02）。本稿保留失败和未处理项属于提案；真实403整页归属、恢复再处理和跨组织仍未验。
- 原因源UI没有maxlength；本稿500限制为待审改进。源选择仅缺键初始化可能陈旧、源确认后关闭及默认原因重开，不以提案宣称OG-G01/OG-G03已解决。
- 默认按钮只记录意图，不改变成员或邀请事实；hold/complete是显式合成逐条结果控制。合成动作成功仅表明写响应，未重读时仍保留原事实。没有真实请求编号、事务、邮件、审计或权限结果。
- 筛选、Tab、草稿只存当前页面内存，不写URL/持久化；重新加载丢弃。未证明实际Vue KeepAlive、跨组织或异步迟到结果安全。

## 全部审核图

47场景 × 桌面1440/手机390 = **94 PNG**，含2张非业务审核工具图。页面为整页截图；原因窗为视口截图，便于判断遮罩与底部操作。悬停、按下、焦点由浏览器真实触发，忙碌禁用由合成状态展示。

| 场景 | 桌面 | 手机 |
| --- | --- | --- |
| 成员目录 | [查看](1440-normal.png) | [查看](390-normal.png) |
| 姓名搜索 | [查看](1440-search.png) | [查看](390-search.png) |
| 锁定账号筛选 | [查看](1440-filter_locked.png) | [查看](390-filter_locked.png) |
| 角色筛选 | [查看](1440-filter_role.png) | [查看](390-filter_role.png) |
| 团队筛选 | [查看](1440-filter_team.png) | [查看](390-filter_team.png) |
| 筛选无结果 | [查看](1440-filter_empty.png) | [查看](390-filter_empty.png) |
| 成员列表为空 | [查看](1440-members_empty.png) | [查看](390-members_empty.png) |
| 11人合成分页 | [查看](1440-multipage.png) | [查看](390-multipage.png) |
| 第二页 | [查看](1440-page_two.png) | [查看](390-page_two.png) |
| 长姓名与邮箱 | [查看](1440-long_member.png) | [查看](390-long_member.png) |
| 成员停用且账号锁定 | [查看](1440-disabled_locked.png) | [查看](390-disabled_locked.png) |
| 多角色与多范围 | [查看](1440-multiple_roles.png) | [查看](390-multiple_roles.png) |
| 筛选展开 | [查看](1440-filters_open.png) | [查看](390-filters_open.png) |
| 首次读取 | [查看](1440-loading.png) | [查看](390-loading.png) |
| 服务错误 | [查看](1440-error.png) | [查看](390-error.png) |
| 服务不可用 | [查看](1440-blocked.png) | [查看](390-blocked.png) |
| 登录失效 | [查看](1440-expired.png) | [查看](390-expired.png) |
| 无权访问 | [查看](1440-forbidden.png) | [查看](390-forbidden.png) |
| 请求频繁 | [查看](1440-rate_limited.png) | [查看](390-rate_limited.png) |
| 后台刷新 | [查看](1440-refreshing.png) | [查看](390-refreshing.png) |
| 刷新失败保留成员 | [查看](1440-refresh_error.png) | [查看](390-refresh_error.png) |
| 邀请记录为空 | [查看](1440-invite_empty.png) | [查看](390-invite_empty.png) |
| 失效邀请 | [查看](1440-invite_expired.png) | [查看](390-invite_expired.png) |
| 等待接受 | [查看](1440-invite_acceptance.png) | [查看](390-invite_acceptance.png) |
| 已撤销邀请 | [查看](1440-invite_revoked.png) | [查看](390-invite_revoked.png) |
| 到期边界 | [查看](1440-invite_boundary.png) | [查看](390-invite_boundary.png) |
| 邀请草稿 | [查看](1440-invite_form.png) | [查看](390-invite_form.png) |
| 无效邮箱与去重 | [查看](1440-invite_invalid.png) | [查看](390-invite_invalid.png) |
| 逐条部分失败 | [查看](1440-invite_partial.png) | [查看](390-invite_partial.png) |
| 邀请处理中 | [查看](1440-invite_busy.png) | [查看](390-invite_busy.png) |
| 403中断及未处理项 | [查看](1440-invite_interrupted.png) | [查看](390-invite_interrupted.png) |
| 创建待投递 | [查看](1440-invite_success.png) | [查看](390-invite_success.png) |
| 禁用原因窗 | [查看](1440-reason_disable.png) | [查看](390-reason_disable.png) |
| 恢复原因窗 | [查看](1440-reason_restore.png) | [查看](390-reason_restore.png) |
| 角色原因窗 | [查看](1440-reason_role.png) | [查看](390-reason_role.png) |
| 撤销原因窗 | [查看](1440-reason_revoke.png) | [查看](390-reason_revoke.png) |
| 原因过短 | [查看](1440-reason_short.png) | [查看](390-reason_short.png) |
| 长原因 | [查看](1440-reason_long.png) | [查看](390-reason_long.png) |
| 确认后处理中 | [查看](1440-action_busy.png) | [查看](390-action_busy.png) |
| 确认后冲突 | [查看](1440-action_conflict.png) | [查看](390-action_conflict.png) |
| 自身禁用拒绝 | [查看](1440-self_forbidden.png) | [查看](390-self_forbidden.png) |
| 最后管理员拒绝 | [查看](1440-last_admin.png) | [查看](390-last_admin.png) |
| 技术详情 | [查看](1440-technical.png) | [查看](390-technical.png) |
| 悬停 | [查看](1440-hover.png) | [查看](390-hover.png) |
| 按下 | [查看](1440-pressed.png) | [查看](390-pressed.png) |
| 键盘焦点 | [查看](1440-focus.png) | [查看](390-focus.png) |
| 非业务审核工具 | [查看](1440-controls.png) | [查看](390-controls.png) |

## 如何复验

仓库根目录运行：

```powershell
node scripts/verify-ui-phase2-members-c.mjs --capture
node scripts/verify-ui-phase2-members-c.mjs
```

capture更新永久截图/证据；无参数先核验源/数据/PNG SHA，再跑交互，不重写图。依赖复用现有Playwright/TypeScript，无安装或服务启动。

实际Vue函数/computed在惰性ref/api环境执行：四版本body与取消、邀请小写去重/部分失败/403丢尾、状态优先级、筛选/10条分页。实际服务代码校验固定角色、邮箱、原因以及动作字段；未执行MySQL事务或真实API。角色替换、自身/最后管理员为源码阅读事实，不是本批后端集成测试。

双端检查47场景字号/热区/标签与ID、无横向溢出、四原因窗边界、取消/Escape/关闭/首尾Tab/焦点、精确提交body及错误后重开、筛选/分页/折叠摘要、邀请顺序部分失败/权限中断/完成、到期分组、目录、刷新意图与重载不存草稿。768/1024只检查正常/长成员/多角色/角色窗/长原因，非全断点验收。HTTP请求、console/pageerror、Cookie/localStorage/sessionStorage均0，browser/context在finally关闭。

## 仍待完成

具体P30图审；OG-G01–G06相关真实结果、403恢复/未处理尾部、角色选择重读、关闭/切范围/迟到返回、并发版本/幂等/最后管理员、邮件投递，以及全主题/密度/角色/原生200%/手机软键盘和真实Vue/API/MySQL/生产均待办。下一P32工作区；P31已有48图但仍待审，不能用本批替代全73页工作。

未改生产apps/API/OpenAPI、数据库/迁移、权限、环境/依赖和部署，无重启要求。94PNG、原型、README/evidence及两脚本是永久审核交付；无临时测试文件/下载/日志/服务遗留。
