# 个人中心四分区 · PERSONAL-C-sections-r2

状态：C方向已选，具体稿待审核；独立HTML，不是实际Vue或生产验收。

[打开交互稿](index.html) · [源与截图证据](evidence.json) · [上一批资料与壳层](../personal-direction-c/README.md) · [P11规格](../../page-specs/P11.md)

## 本批交付

31场景×1440/390，共62张整页图。补齐权限、安全、通知和资产的实际内容布局，不再使用上一批四分区导航占位。上一批24图和其历史边界说明原样保留，两份HTML尚未合并为真实个人中心。

frontend-design用于建立C方向蓝色账号目录与白色工作面：权限分角色/范围/操作，安全分MFA/改密/设备，通知分渠道及事件五开关，资产分三个来源目录。手机保留六个可读入口，表单单列，无固定底栏遮挡；正文16px、辅助13px、操作区域至少44px。

数据边界：偏好version7及五布尔值来自UI2-A05；中文映射从PersonalCenter实际函数推导。角色、范围、设备、资产记录是明确合成的合同形状样例，依据sessionSummary及MySqlPersonalCenterRepository字段，不代表真实用户授权、在线设备或历史决策。样例时间固定2026-09-07，不作为当前生产事实。

## 逐项动作

| 分区/动作 | 本稿合同 |
| --- | --- |
| 我的权限 | 角色、数据范围与可执行动作只读；未知角色/范围/能力保留当前中文fallback，不显示假授权编辑。只有capability包含organization_token:manage时显示/org-admin/tokens。 |
| MFA | /security/mfa独立页面，当前页不推断是否已绑定，不展示恢复码。 |
| 改密 | 当前/新/确认三个密码框required、minlength12；不一致在确认框关联错误并返焦（待审可达性改进）。POST只包含current_password/new_password，确认值不提交；成功对应replace /login。 |
| 密码演示 | 输入只存在隔离浏览器内存和password字段；诊断只保留字段名，不记录密码值。预设值为明确演示字符串，不能输入真实密码。本稿不真正改密、撤销全部会话或跳转。 |
| 撤销会话 | 每条按钮走DELETE /me/sessions/{id}，无新确认弹窗。成功只移除该id；失败保留。当前UI对三状态都显示按钮，后端只有active可成功，其余保留失败/刷新提示，不能全部模拟成功。 |
| 通知保存 | PUT /me/notification-preferences，五布尔值与expected_version，不新增热点、异常、免打扰或额外渠道。成功按返回版本继续，失败保留输入和旧版本。 |
| 邮件受阻 | 实际validatePreferences对email_enabled=true返回503/mail_provider_pending，提示关闭邮件并使用站内；本稿调用真实校验函数提取该结果。原UI2-A05测试模拟邮件成功与真实后端不同，不作为能力证据。关闭邮件后可演示站内偏好保存。 |
| 资产链接 | 关注→/trends?topic=id；决策→/opportunities/{opportunity_id}；本人任务→/tasks，不擅自改为详情或mine筛选。没有取消关注、搜索、分页等新动作。 |
| 刷新/失败重试 | 调用意图保留profile先读、再四分区的既有读取集合，不新增单区API；本地计时仅演示，不验证真实allSettled/超时或取消。 |
| 账号目录 | 同/me查询分区；基本资料仍指向/me?section=profile，本HTML记录目标，资料图在上一批交付。外观/范围/根链接不更改。 |

## 明确标识的待审改进

分区加载、真实空和读取失败分开，失败时不展示默认通知或空资产；通知未知时不开放保存。安全会话读取失败时，账号级MFA/改密入口仍存在。以上需要将来修改Vue状态模型，目前源码仍用allSettled后的空/default回退，不能声称已实现。

保存/撤销忙碌态和局部禁用、密码错误关联与返焦只在提案中演示，真实源码仍缺写入忙碌/归属保护；需要真实Vue red→fix→green与重复提交/晚到响应测试。计时器世代清理用于切换审核场景，不是业务竞态已修复的证据。

空权限的“当前响应未返回条目”仅用于明确empty场景，不能替代服务端权限验证。已撤销/过期会话按钮当前存在的可用性问题保留为后续真实实现审阅项，不擅自新增会话状态规则。

## 全部图

| 场景 | 图 |
| --- | --- |
| permissions | [1440](1440-permissions.png) · [390](390-permissions.png) |
| permissions-token | [1440](1440-permissions-token.png) · [390](390-permissions-token.png) |
| permissions-empty | [1440](1440-permissions-empty.png) · [390](390-permissions-empty.png) |
| permissions-loading | [1440](1440-permissions-loading.png) · [390](390-permissions-loading.png) |
| permissions-error | [1440](1440-permissions-error.png) · [390](390-permissions-error.png) |
| permissions-fallback | [1440](1440-permissions-fallback.png) · [390](390-permissions-fallback.png) |
| security | [1440](1440-security.png) · [390](390-security.png) |
| security-empty | [1440](1440-security-empty.png) · [390](390-security-empty.png) |
| security-loading | [1440](1440-security-loading.png) · [390](390-security-loading.png) |
| security-error | [1440](1440-security-error.png) · [390](390-security-error.png) |
| security-mismatch | [1440](1440-security-mismatch.png) · [390](390-security-mismatch.png) |
| security-password-busy | [1440](1440-security-password-busy.png) · [390](390-security-password-busy.png) |
| security-password-failed | [1440](1440-security-password-failed.png) · [390](390-security-password-failed.png) |
| security-password-success | [1440](1440-security-password-success.png) · [390](390-security-password-success.png) |
| security-revoke-busy | [1440](1440-security-revoke-busy.png) · [390](390-security-revoke-busy.png) |
| security-revoke-failed | [1440](1440-security-revoke-failed.png) · [390](390-security-revoke-failed.png) |
| security-revoked-retry-failed | [1440](1440-security-revoked-retry-failed.png) · [390](390-security-revoked-retry-failed.png) |
| security-expired-retry-failed | [1440](1440-security-expired-retry-failed.png) · [390](390-security-expired-retry-failed.png) |
| security-revoked | [1440](1440-security-revoked.png) · [390](390-security-revoked.png) |
| notifications | [1440](1440-notifications.png) · [390](390-notifications.png) |
| notifications-loading | [1440](1440-notifications-loading.png) · [390](390-notifications-loading.png) |
| notifications-error | [1440](1440-notifications-error.png) · [390](390-notifications-error.png) |
| notifications-edited | [1440](1440-notifications-edited.png) · [390](390-notifications-edited.png) |
| notifications-mail-blocked | [1440](1440-notifications-mail-blocked.png) · [390](390-notifications-mail-blocked.png) |
| notifications-saving | [1440](1440-notifications-saving.png) · [390](390-notifications-saving.png) |
| notifications-saved | [1440](1440-notifications-saved.png) · [390](390-notifications-saved.png) |
| notifications-save-failed | [1440](1440-notifications-save-failed.png) · [390](390-notifications-save-failed.png) |
| assets | [1440](1440-assets.png) · [390](390-assets.png) |
| assets-empty | [1440](1440-assets-empty.png) · [390](390-assets-empty.png) |
| assets-loading | [1440](1440-assets-loading.png) · [390](390-assets-loading.png) |
| assets-error | [1440](1440-assets-error.png) · [390](390-assets-error.png) |

## 验证与使用

仓库根目录运行 `node scripts/verify-ui-phase2-personal-sections-c.mjs`：只读核对真实源/数据/图哈希，执行通知版本与邮件503、改密本地校验和字段形状、三会话状态撤销结果、权限链接条件、三资产落点、四分区失败与恢复、双端布局/热区。加 `--capture` 才刷新本目录永久62PNG及证据。现有依赖直接复用，浏览器finally关闭，不启动服务，HTTP/storage写入为0。

未覆盖：真实API/数据库/邮件投递/会话撤销、认证/六角色、真实密码策略、写入竞态、浏览器历史、全主题/密度/读屏/200%缩放和生产验收。没有新增生产环境变量、API/OpenAPI、依赖、数据库或权限；不改Vue、旧图、coverage及审批，无需生产重启。两批P11首轮图稿仍需审阅、整合及完整实现，完整73页目标保持。
