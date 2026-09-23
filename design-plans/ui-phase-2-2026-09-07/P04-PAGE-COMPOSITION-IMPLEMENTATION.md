# P04 找回密码 C 方向生产 Vue 实施记录

## 目标与边界

将已通过的 C 方向落实到真实 `/forgot-password` 页面，以蓝色恢复边界和白色邮箱工作区替代共用身份营销卡片。沿用现有 `LocalIdentity.vue` 的 `submit()` 与 `POST /auth/password-reset/request {email}`；不改 API/OpenAPI、邮件投递、账号存在性判定、权限、存储、环境配置或依赖。不会从生产浏览器提交恢复请求。

## 实现内容

- 新增页面专属 `local-identity-recovery.css`，桌面采用蓝/白分区，手机单列；保留 16px 文本基线、44px 及以上操作目标、键盘焦点、禁用和 reduced-motion 状态。
- 实际 Vue 模式增加恢复页面分支：邮箱 `type=email`、required、maxlength 254；成功仅显示账号枚举安全的通用受理文案；错误、限流和阻断显示现有 action hint/request/trace 标识。
- 返回登录继续使用局部 `switchMode('login')`，不改变 URL；MFA 仍为原有路由入口。
- 202 只表示受理，不宣称邮件已送达、账号存在或密码已改变；无短信、验证码、倒计时、确认弹窗或自动发信行为。
- 同步 P02–P07 共享身份控件映射，当前 40 个源候选均有路由适用性分类；P04 视觉已按用户此前“剩下的全部通过”授权记录为通过，生产/正式 M07-03 仍单独列验收边界。

## 本地验证

- `node --test tests/unit/forgot-password-page-preview.test.mjs tests/m02-02/auth-onboarding-contract.test.mjs`：3/3 通过。
- `node scripts/run-playwright-projects.mjs "--grep=P04 recovery" --workers=1`：桌面 Chromium 2/2、390px mobile 2/2 通过。本地拦截的测试响应验证无效邮箱零 POST、有效邮箱精确发送一次 `{email}`、通用 202、429追踪和局部返回登录；不发送真实邮件。
- `node scripts/verify-ui-phase2-identity-review.mjs`：P02–P07 每路径40源控件映射、共享身份源18项检查通过。
- 完整构建、文档/计划/格式/静态与发布门、commit SHA、部署结果和线上只读 smoke 在部署后补记。

## 部署与生产核验

待代码提交、推送与固定宝塔部署后填写。生产核验仅对健康端点、版本、`/forgot-password` GET 页面和静态资源做只读检查，不执行邮件发送，不声称真实邮箱/账号/重置流程通过。

## 不在本次范围

没有修改后端路由、OpenAPI、数据库、邮件提供方、频率限制、权限、认证或部署配置。生产页面的只读可达性与静态资产检查不能证明重置邮件真实投递、邮箱/账号存在或密码重置成功；正式 M07-03 与全73页目标继续。
