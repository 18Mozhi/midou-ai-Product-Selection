# P06 重置密码 · C 方向生产 Vue 实施记录

## 实施范围

已将已通过的 P06 蓝色边界、白色单字段工作区接入实际 `/reset-password` 路由，在 `LocalIdentity.vue` 中隔离旧身份营销布局，并以独立 `local-identity-reset.css` 实现桌面居中内容、手机单列和可见键盘焦点。成功、过期、请求失败、限流/受阻和提交中各有文字反馈；过期链接不再展示可提交表单，改为引导使用既有找回密码入口；204 成功后只提供显式返回登录。

## 保留的合同与安全边界

- 仍使用 `POST /auth/password-reset/confirm`，请求体严格为 `{ token, new_password }`；token 从当前 URL 读取，但从不渲染到页面。
- 唯一密码字段使用 `required`、`minlength=12`、`maxlength=128` 与 `autocomplete="new-password"`，不新增确认密码、浏览器存储、接口字段或重发动作。
- 缺 token 仍把空 token 提交给服务端判断；URL `state=expired` 与服务端实际失败响应分开呈现。
- 204 成功只报告密码已更新，不自动登录或导航；成功/失败按现有身份页反馈合同展示。
- 没有 API、OpenAPI、数据库、迁移、权限、配置、环境变量、依赖或服务契约变化。

## 验证

| 验证 | 结果 |
| --- | --- |
| P06 浏览器 E2E，桌面 Chromium + 390px 手机 | 6/6 通过：单字段精确请求、处理中禁用、204 成功且不自动跳转、过期不提交并回到找回密码、503 错误提示/关联编号及 token 不展示 |
| `npm run typecheck:web` | 通过 |
| `node --test tests/unit/reset-password-page-preview.test.mjs tests/m02-02/auth-onboarding-contract.test.mjs` | 3/3 通过 |
| `node scripts/verify-ui-phase2-identity-review.mjs` | 6 个身份路由映射、每页 34 个真实模板源候选及 18 项 setup/source 检查通过 |
| 22 工作区完整构建、`npm run verify:frontend-budget` | 22/22 工作区通过；205 个前端构建资源通过预算门 |
| `npm run format:check`、`verify:docs`、`verify:plans`、`verify:runtime-docs`、`verify:static-analysis`、`verify:release-matrix` | 全部通过；文档覆盖 153 项，静态分析 435 个文件，M07-01 校验通过 |
| `npm run verify:security-gate` | 未能运行到策略检查：`git ls-files` 输出超过 Node 同步子进程缓冲上限并返回 `ENOBUFS`；不是安全门通过或发现结果 |

浏览器测试使用隔离路由与合成 token；未对真实邮件链接或用户密码发起请求，不构成真实改密、账户授权或正式 M07-03 签收证明。

## 提交与部署

代码、测试和本实施记录已提交并推送到 `main`，代码 commit/build SHA：`1f6b3a82c206365df6cb4b7dc01b37e860557c8f`。`python scripts/deploy-baota.py` 返回 `status=deployed`，预检模块 M07-03 返回 `preflight_passed`，服务器临时上传包已删除。发布归属校验精确覆盖 1 个提交、15 个路径。没有新增迁移文件；部署器照项目既有迁移 allowlist 执行。

线上只读复核：`/api/v1/health/live`、`ready`、`available`、`version` 全部 HTTP 200；`live` 与 `version` 的 build SHA 均为 `1f6b3a82c206365df6cb4b7dc01b37e860557c8f`，ready 报告 MySQL/Redis/supervisor available，available 报告 API/worker available。`/reset-password?token=synthetic-deploy-check` 返回 HTTP 200。生产 Chromium 双视口 1440/390 验证标题、单字段和样式可用，均无横向溢出、按钮高于 44px、token 未渲染且未发出非 GET 请求。线上 `LocalIdentity-Cqwg4TLT.js`（26,673 bytes，SHA-256 `70efea60842660d079eeb429915d2ff09942832878db9806e76aeedd6102a58d`）与 `LocalIdentity-C8P1-EKr.css`（9,069 bytes，SHA-256 `443d9bfa738182abc56a17e525cf2c441453741a3d73ef419f0f6aa116261b1c`）均 HTTP 200，哈希与本地构建完全一致。

浏览器使用合成 URL token，仅执行页面 GET，不提交密码或触发重置。线上检查证明当前构建、静态路由和资源一致，不证明真实用户收到邮件、token 有效、账号密码确已修改、生产 RBAC 或正式 M07-03 用户签收。无需额外手工重启；按项目规则服务与资源切换由固定宝塔部署脚本/受管项目完成，未新增常驻服务、环境变量或人工启动进程。
