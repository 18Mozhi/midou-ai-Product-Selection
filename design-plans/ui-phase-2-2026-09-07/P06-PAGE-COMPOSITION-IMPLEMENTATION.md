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
| 格式、完整生产构建、前端预算及发布前项目门禁 | 提交/发布前结果补记于本文 |

浏览器测试使用隔离路由与合成 token；未对真实邮件链接或用户密码发起请求，不构成真实改密、账户授权或正式 M07-03 签收证明。

## 提交与部署

本记录随 P06 代码提交。提交 SHA、固定宝塔部署结果、线上 build SHA、深链和资源核验在部署完成后补记。生产仍由现有宝塔网站和受管 Node/Python 项目管理；部署器的既有迁移白名单照常执行，本批没有新增迁移。
