# P02 登录 C 方向实际 Vue 实施记录

## 范围与视觉

`/login` 已在真实 `LocalIdentity.vue` 中改为独立的蓝色安全步骤边界与白色身份工作区。桌面显示身份核验、按需验证、安全设置三步；手机隐藏侧栏并采用单列表单。登录、MFA 挑战和种子安全设置分别有自己的标题、字段、忙碌/错误反馈、键盘焦点和辅助入口；本页无弹窗。可见正文与辅助文字按项目 17px 底线处理。用户已确认继续按 C 方向实施，剩余页面视觉自动通过。

## 保留的认证合同与敏感信息边界

- 普通登录仍为 `POST /auth/login {identifier,password}`；账号必填 2–254，密码必填 12–128。
- 后端返回 `mfa_required` 时清除普通密码并显示挑战；挑战只提交 `POST /auth/mfa/totp/verify {code}`，code 必填 6–32，挑战凭证仍由服务端 cookie 管理。
- 后端返回 `security_setup.required` 时清除普通密码输入值并进入受限安全设置。首次密码更新仍提交 `POST /me/password {current_password,new_password}`；成功后要求使用新密码重新登录，再按服务器返回状态绑定 TOTP 并确认 `{code}`，恢复码仅按响应显示。
- 安全设置未完成前不进入业务。没有变更 API、OpenAPI、数据库、权限、运行配置、依赖、路由或邮件流程；不声称真实身份服务/MFA/权限通过。
- 离开 MFA 挑战或安全设置时清理对应挑战码、密码、密钥和恢复码；成功挑战清码后才继续既有 redirect / `/me/landing` 规则。

## 本地验证

- `npm run typecheck:web`：通过。
- `node --test tests/m02-02/auth-onboarding-contract.test.mjs tests/unit/login-page-preview.test.mjs`：4/4 通过。
- `node scripts/run-playwright-projects.mjs --grep "M01-01|P02 completes|first-time security setup|stale MFA state|M02-02.A07/A15 login" --workers=1 --update-snapshots=all`：桌面 Chromium 7/7、390px 手机 7/7 通过；覆盖 `/login` 双端、匿名安全入口、管理员登录跳转、原生 MFA 校验、完整种子链、过期挑战与手机触控热区。
- 测试截图基线新增登录、MFA challenge、种子设置与完成状态的 Win32 桌面/手机样例；仅供本地合成浏览器证据，不含真实账号。

## 部署与生产边界

本地构建、提交、推送、宝塔部署与线上 GET-only smoke 将在同一轮部署后补录。生产身份写入、真实 MFA/Cookie/RBAC、真实账号权限和正式 M07-03 验收不由本地拦截式 E2E 或静态资源访问证明。应用服务是否重启以固定宝塔部署脚本实际结果为准；本次无环境变量或后端运行契约变化。
