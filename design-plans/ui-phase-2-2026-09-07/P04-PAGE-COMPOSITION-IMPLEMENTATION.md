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
- P04/P05/P06及原M02-02找回用例定向 E2E：桌面 7/7、390px mobile 7/7。先前筛选词过宽时也执行了无关 UI2-CP04 竞争监控手机用例，该项以“恢复监控”严格匹配到两个按钮而失败；精确身份页回归通过，未触碰竞争监控代码。
- `npm run build`：22/22工作区构建通过；`verify:docs`、`verify:plans`、`format:check`、`verify:runtime-docs`、`verify:static-analysis`、`verify:release-matrix`、`verify:frontend-budget` 与身份控件映射门均通过。

## 部署与生产核验

代码提交 `93b70fe963c6348d818373a8fb6a95ee07260898` 已推送并按固定 `python scripts/deploy-baota.py` 部署；宝塔预检 `preflight_passed`、6个既有对象，脚本结果 `deployed`，构建 SHA 与提交一致。上传临时包已由脚本删除。依部署脚本流程 Nginx 配置测试/重载且 Node 项目受控停启；本批没有 Python 代码、后端契约或数据库变化。

生产 `GET` 检查均为 HTTP 200：`/api/v1/health/live`、`/ready`、`/available`、`/version` 及 `/forgot-password`；live/version 的 build SHA 为 `93b70fe963c6348d818373a8fb6a95ee07260898`，MySQL、Redis、supervisor、API 与 worker 状态均为 available。实际生产 Playwright 在1440px和390px各加载 P04：页面与身份 JS/CSS HTTP 200、找回标题/邮箱类型与约束正常、主按钮 `rgb(23,72,160)` 且48px高、无横向溢出、无浏览器异常、无任何非GET API请求。生产身份资源 SHA-256 与本地构建逐字匹配：`LocalIdentity-CpynZBDH.js` `cbfc99e049500fd5e9189d2d6c497188dd0d9e57506039cbdfbd428febdc2e45`；`LocalIdentity-1815kNiR.css` `79cae1c99b5c196ec126d214d49d566bb39beaef522c0367eee4def3f6d013bb`。

所有线上交互核验只读浏览器页面，没有提交邮箱、发送邮件或验证账号重置。上述证据证明部署版本、页面和资产可达，不证明真实邮件送达、账户存在、有效重置令牌、密码变更或正式 M07-03 验收。

## 不在本次范围

没有修改后端路由、OpenAPI、数据库、邮件提供方、频率限制、权限、认证或部署配置。生产页面的只读可达性与静态资产检查不能证明重置邮件真实投递、邮箱/账号存在或密码重置成功；正式 M07-03 与全73页目标继续。
