# P03 注册 C 方向实际 Vue 实施记录

## 范围与视觉

`/register` 已在 `LocalIdentity.vue` 中从共用登录模板拆为独立注册页面：蓝色注册说明区、白色三字段工作区、就近帮助文案、内联错误反馈、明确的返回登录和安全说明入口。桌面采用宽版边界，390px 下字段纵向排列、操作热区至少 44px；键盘焦点清晰，禁用、悬停、按下和减少动态效果均有对应样式。没有弹窗，也没有增加社交、手机号或企业注册。

用户已统一通过剩余页面视觉；本页方向按 C 批准执行。此记录只覆盖 P03 页面与实际浏览器交互，不代表账号业务、生产邮件或完整第二阶段验收。

## 保留的业务合同

- 必填邮箱、原生 `email` 类型、最大 254 字符。
- 密码及确认密码均为必填 12–128 字符；确认值仅在浏览器本地比较。
- 不一致时显示内联错误且不发请求。
- 成功只调用既有 `POST /auth/register`，请求体严格为 `{email, password}`。201 后切换到现有待验证画面，地址仍为 `/register`，不表示验证邮件送达、邮箱已验证或已登录。
- 失败沿用身份 API 的用户提示、操作建议及请求/链路编号；不推断重复邮箱结果。
- 未修改后端、OpenAPI、权限、数据库、配置、依赖或真实邮件投递。

## 本地验证

- `node --test tests/unit/register-page-preview.test.mjs tests/m02-02/auth-onboarding-contract.test.mjs`：4/4 通过。
- `node scripts/run-playwright-projects.mjs --grep "registration and email confirmation|P03 registration" --workers=1`：桌面 Chromium 与 390px 移动项目各 2/2 通过；覆盖原生字段边界、确认密码零写、准确注册 payload、待验证同 URL、服务失败追踪、字段保留、局部返回登录及手机热区/无横向溢出。
- 上述浏览器验证更新了一张过时的移动端待验证截图基线；只刷新既有 P05 蓝色主按钮基线。
- `npm run build`：22 个工作区通过。
- `node scripts/verify-ui-phase2-identity-review.mjs`：P02–P07 各 45 个源控件候选、18 项源检查通过。

## 部署与生产边界

部署前记录：待提交后填写 commit/build SHA、宝塔部署结果、线上 health/version、`/register` 深链与 JS/CSS 哈希核对，以及 1440/390 GET-only 只读检查。生产检查不提交注册数据，不证明真实邮件投递、账号创建/验证、权限或正式 M07-03 验收。

## 运行和维护

仅新增局部 Vue/CSS，不改变环境变量、配置、接口或运行服务。生产静态资源通过项目固定 `python scripts/deploy-baota.py` 流程更新；部署脚本按现有流程管理 Nginx reload 与 Node 受控重启。没有服务需由本页单独添加或长期驻留。
