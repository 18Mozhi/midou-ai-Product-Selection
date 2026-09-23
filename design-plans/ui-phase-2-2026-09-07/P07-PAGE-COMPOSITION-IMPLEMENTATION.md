# P07 MFA 安全设置 · C 方向生产 Vue 实施记录

## 实施范围

已将用户通过的 C 方向接入真实 `/security/mfa`，由 `LocalIdentity.vue` 在 MFA 管理模式渲染蓝色安全边界、白色内容工作区，并与旧身份营销布局隔离。页面把 MFA 读取、启用状态、分步绑定、确认后的恢复码以及危险停用分别表达；读取失败保持未知状态并提供明确重读入口，不把失败伪装为“未启用”。P07 样式从全局入口拆为身份组件的延迟 CSS 资源，避免影响不相关路由和首屏 CSS 预算。恢复码只在服务端确认响应实际返回后显示，不新增二维码或复制/下载功能。

共享的 `security-setup` 首次 MFA 设置使用同一处理器和请求合同，本轮一并增加原生表单必填约束、字段长度边界、忙碌禁用与重复提交保护。其他身份模式仍使用原有模板与行为。

## 保留的合同与安全边界

- `GET /me/mfa` 读取 `totp_enabled`。
- `POST /me/mfa/totp/enrollment` 仍发送 `{ current_password }`。
- `POST /me/mfa/totp/confirm` 仍发送 `{ code }`，恢复码依真实响应呈现。
- `DELETE /me/mfa/totp` 仍发送 `{ current_password, code }`；服务端成功后按既有合同撤销会话。前端停留当前页并明确给出手动返回登录入口，不声称本地模拟能证明 Cookie 撤销。
- 未改 API、OpenAPI、数据库、字段/请求结构、权限、配置、环境变量、依赖或迁移。
- 离开组件、确认成功和停用成功时清除对应敏感本地输入；确认后的恢复码离开组件或停用后清理。所有浏览器测试只使用合成 MFA 材料与隔离路由夹具。

## 视觉与交互

- 蓝色焦点、默认/悬停/按下/禁用/忙碌反馈，至少 44px 控件高度，字段字号不低于 16px；移动端单列，窄屏安全换行；尊重减少动态偏好。
- MFA 管理页面请求失败显示追踪编号及手动重读，重新加载中不展示不确定的安全状态。
- 普通绑定、验证码确认、停用均有原生必填/长度验证和单飞保护；空字段不发请求，忙碌期间按钮禁用。
- 首次安全设置与 MFA 管理共用操作器；其表单校验只收紧前端空值/长度检查，不改变服务端输入合同。

## 验证

| 验证                                                                                                   | 结果                                                                                                       |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `node scripts/verify-ui-phase2-identity-review.mjs`                                                    | 6 个身份路由映射，每页 27 个源候选通过                                                                     |
| `node scripts/verify-ui-phase2-identity-source.mjs`                                                    | 18 项身份 setup/source 合同检查通过                                                                        |
| `npx --no-install playwright test tests/e2e/m01-02-mfa.spec.ts --project=desktop-chromium --workers=1` | 7/7 通过；包括按钮悬停/按下、原生校验、精确请求和单飞、读取失败重试、首次安全设置、停用结果                |
| `npx --no-install playwright test tests/e2e/m01-02-mfa.spec.ts --project=mobile-390 --workers=1`       | 7/7 通过                                                                                                   |
| MFA 页面/API/TOTP 定向单测                                                                             | 7/7 通过                                                                                                   |
| `npm run build`                                                                                        | 22/22 工作区通过（含前端类型检查及生产构建）                                                               |
| `npm run verify:frontend-budget`                                                                       | 205 个构建资源通过；P07 CSS 随懒加载身份页拆分                                                             |
| 格式、文档、计划、静态分析、runtime 文档与 M07-01 release matrix                                       | 全部通过                                                                                                   |
| 安全门 `npm run verify:security-gate`                                                                  | 未能运行到策略检查：Node `spawnSync git ENOBUFS`，读取全仓文件清单超过子进程默认缓冲上限；不是安全发现结果 |

本地浏览器拦截夹具与源码 setup 测试不验证生产账号、MFA 种子真实性、Cookie/会话撤销、真实 RBAC、SQL 审计或正式 M07-03。全站 73 页完成目标仍开放。

## 提交与线上部署

代码、测试与实施记录以 commit/build SHA `3925719f65062687506e0b58ff1098d7fd7fd8b5` 提交并推送到 `main`；通过 `python scripts/deploy-baota.py` 按固定宝塔网站与受管 Node/Python 对象发布。部署器前置归属检查精确覆盖 1 个提交、15 个路径；M07-03 部署预检通过，22 工作区本地构建通过，部署命令返回 `status=deployed`，服务器临时上传包已删除。

线上只读复核：`/api/v1/health/live`、`ready`、`available`、`version` 均 HTTP 200；版本 SHA 与本次提交一致。`/security/mfa` 深链返回 HTTP 200；懒加载 `LocalIdentity-Cxxk2hfy.js`（22,915 bytes）与 `LocalIdentity-DiXI0H4Y.css`（5,513 bytes）均 HTTP 200，均包含 P07 标记。部署器还通过 `/login`、未知路径 404 和 browser-helper 资源核验。此项证明部署版本/路由/资源可取，不是登录后 MFA 业务验收。

本批不含迁移文件或 SQL；固定部署器仍按项目既有 allowlist 调用幂等迁移 runner，运行成功，不把它描述为本批新增数据库迁移。未通过生产账号执行 MFA 绑定/停用，未验证 Cookie 撤销、真实 MFA 种子、生产 RBAC 或正式 M07-03 用户签收。全部服务继续由宝塔管理；没有新增运行服务、环境变量或人工启动进程。
