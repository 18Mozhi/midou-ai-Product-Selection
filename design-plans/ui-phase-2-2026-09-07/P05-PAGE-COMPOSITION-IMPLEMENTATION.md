# P05 邮箱验证页 C 方向生产 Vue 实施

## 实施范围

将 `/verify-email` 从通用身份营销卡片中拆出为独立的蓝色验证边界与白色结果区，覆盖桌面/手机、加载、成功、错误、限流、服务受阻及无 token / `state=expired` 页面态。明确区分“注册邮件进入受控投递队列”和“身份服务确认邮箱已验证”：只有携带 token 且确认接口成功才显示验证完成。错误态使用告警语义并保留服务端说明、请求标识和链路标识；键盘焦点可见、主要操作最小高度 44px。主要操作的局部选择器保持高于共享主题按钮默认值，防止主题色覆盖 C 方向蓝色。

## 保留的合同与安全边界

- 仍由初始 `verify` mode 且 URL 有 token 时自动调用 `POST /auth/email-verification/confirm`，请求体严格为 `{ token }`；无 token 为零请求。
- 不展示 token，不把 `state=expired` 页面参数解释为服务端真实令牌失效，也不把注册排队受理误报为邮箱已验证。
- 成功后不自动登录，只保留显式“返回登录”；本页不增加重发动作、输入字段、API、权限、持久化或邮件 Provider 行为。
- 未更改 OpenAPI、路由、API、数据库、迁移、配置、环境变量、依赖、后端或运行服务。

## 验证

| 检查 | 结果 |
| --- | --- |
| P05 + 注册后邮件受理实际 Vue E2E，桌面 Chromium | 3/3 通过 |
| 同一组实际 Vue E2E，390px 手机 | 3/3 通过 |
| E2E 内容 | 注册受理与邮箱验证成功分离；缺 token 零 POST；`state=expired` 不提交；token 单次请求体精确 `{ token }`、页面不回显；服务端失败不再显示加载标题；显式返回登录；横向无溢出、操作高度不少于 44px 且主按钮计算颜色为批准的蓝色 |
| 注册后验证页桌面/手机视觉基线 | 按新 C 页面构图更新；未放宽差异阈值 |
| 单元/身份合同 | 邮箱验证预览与 M02-02 合同 3/3 通过；P02–P07 共用身份动作源映射 35/35、18 项 setup/source 检查通过 |
| `npm run typecheck:web`、`npm run build` | Web 类型检查通过；格式化后的最终构建 22/22 工作区通过 |
| 文档/计划/格式/静态/发布门禁 | `verify:docs`、`verify:plans`、`format:check`、`verify:runtime-docs`、`verify:static-analysis`、`verify:frontend-budget`（205 assets）、`verify:release-matrix` 均通过 |
| 完整 M02-02 E2E 文件回归 | 10/11 桌面用例通过；余下失败在登录后 `/select-context` 的既有 `m02-02-login.png` 快照（预期 1280×882、实际 1280×733），该路由/组件与本次改动无关，未改写其基线。P05 与注册后邮件受理的相关桌面/手机专项仍各 3/3 通过 |

浏览器网络仅在本地拦截，token 仅为合成测试数据。线上核验只执行 GET，不向生产确认接口提交 token。

## 提交与部署

P05 页面实现提交为 `6be50711ea35005fc0059300218e0666f643184a`；生产只读检查发现全局 `signal-ledger` 按钮主题权重覆盖了 P05 蓝色，最小修正提交为 `9df27897dbfbea8b78c72668f0c45d4236a05569`。二者均已推送 `main`。固定宝塔部署脚本最终返回 `status=deployed`、`build_sha=9df27897dbfbea8b78c72668f0c45d4236a05569`、`M07-03 preflight_passed`；发布归属精确覆盖 2 个提交/17 个路径，服务器临时上传包已删除。

| 生产只读核验 | 结果 |
| --- | --- |
| `/api/v1/health/live`、`ready`、`available`、`version` | 全部 HTTP 200；live/version 的 build SHA 均为 `9df27897dbfbea8b78c72668f0c45d4236a05569`；ready 的 MySQL/Redis/supervisor available，available 的 API/worker available |
| `/verify-email` 深链 | HTTP 200；浏览器正常挂载验证页 |
| 懒加载资源 | `LocalIdentity-BV-EWj5k.js` 与 `LocalIdentity-bVD3VL9V.css` 均 HTTP 200，线上 SHA-256 与本地构建一致（JS `14befcc21a0873423339ed3de153c2d0fd8cb202b78aeabf730d00bde14297c7`；CSS `3440d05bed979f409cb49c6dfd5a56ca82b58154dc4e8ee9b7d3e67844c55558`） |
| 生产 Chromium，1440px / 390px | 两端 HTTP 200；页面无横向溢出、主要按钮高 44px 且实际蓝色为 `rgb(23, 72, 160)`；token 未展示、无非 GET 请求、无页面异常 |

无需人工额外重启；固定宝塔脚本负责受管发布，前端静态资源随现有站点更新。未新增服务、环境变量或迁移。线上只读核验不能证明真实邮件投递、有效单次令牌、账号验证写入、生产 RBAC 或正式 M07-03 签收。
