# P10 外观偏好 C 方向生产 Vue 实施

## 范围

将已获用户整体授权的 P10 C 方向落到 `/settings/theme` 实际 Vue 页面。删除旧的纸张侧栏和示例业务指标面板，改为蓝色个人设置栏、明确的服务器/本地预览状态、主题与会话密度选择、就地保存操作和错误恢复区域。桌面三主题并排、密度两选项并列；手机均转为单列，底部操作可触达。

## 保留合同

- 路由 `/settings/theme` 与 `GET /me/ui-preferences`、`PUT /me/ui-preferences` 不变。
- 主题仍只提交 `{ theme, expected_version }`，使用原 request ID/幂等键、服务端版本锁与审计流程；三个主题 ID 和本地预览缓存行为不变。
- 密度仍仅更新当前会话/DOM，不加入 PUT、数据库或持久化字段。
- 撤销仅还原最近服务器返回的主题，不重置密度；409 版本冲突要求重新读取后再选择，不自动覆盖。
- 401、403、`preference_scope_required`、版本冲突、429、网络/服务错误分开展示；网络或限流不再伪称缺少组织/工作区。
- API、OpenAPI、权限、数据库/迁移、主题全局令牌、配置、依赖和后端均未改变。

## 实施内容

- `ThemeStudio.vue` 作为页面控制器保留读取、主题预览/保存、撤销、状态和恢复入口；使用 typed props/events 的 `PreferenceRadioGroup.vue` 分别承载主题和密度选择。
- 单选组支持方向键及 Home/End、roving tabindex 和可见焦点。保存期间两个组与撤销按钮均禁用，关闭原先保存中仍能撤销造成的状态竞态。
- 新样式仅作用于 P10，使用现有语义颜色令牌、零渐变、无模拟业务数值；不再生成离线模板替换生产模板。
- `verify-theme-page-preview.mjs` 直接运行生产 Vue 文件并拦截本地测试 API。

## 验证

- 直接生产 Vue 浏览器矩阵：1440/390 × reduced/no-preference，4组、72项断言；8次拦截 PUT 均仅为预期主题版本写入，密度选择不产生写入。
- P10 E2E：桌面 Chromium 6/6，390px mobile 6/6；覆盖主题更新、范围错误与追踪展开、单选键盘、保存中锁定、429 独立状态、会话密度。
- M02-01 API/领域/合同与 P10 组件定向测试：9/9；主题合同及 P10 实际模板测试：3/3。
- Web TypeScript 检查通过；全仓 22 workspace 构建通过。
- `format:check`（587 个生产文件）、`verify:docs`（73路由/60受保护/6角色/153文件）、runtime-docs、static-analysis（433文件）、frontend budget（203 assets）、release matrix（M07-01）通过。
- `design-quality-gate` 与 `theme-and-icon-completion` 汇总检查仍报告仓库其他页面的既有 11/12px 文本、旧 `!important` 和硬编码颜色（如 `approval-workspace.css`、`automatic-selection.css`）；本页自己的 CSS 语义令牌/无 `!important` 断言与 P10 定向验证通过，未扩改无关页面。

## 部署与边界

- 代码提交 `c3d2315eead08fa6d27d7a800b6730c3649c7ad4` 已推送 `main` 并由 `python scripts/deploy-baota.py` 部署；脚本回报临时上传包已删除。
- 线上 `/api/v1/health/live`、`/api/v1/health/ready`、`/api/v1/health/version` 与 `/settings/theme` 均 HTTP 200；版本 build SHA 为 `c3d2315eead08fa6d27d7a800b6730c3649c7ad4`，ready 的 MySQL/Redis/supervisor 均为 `available`。
- P10 生产资源 `ThemeStudio-CIwOO5Ow.js` 与 `ThemeStudio-CJJY9j6a.css` 均 HTTP 200，远端 SHA-256 分别与本地构建匹配：`ba5f9ea27ea980bbd59c686d9675b93107224b4bd7cedfbe270ba8fd79d7eed6`、`0822c4640992549077aeb261273a257e6d4ab2f0bb970295efe29fbe1ce97076`。
- 本次仅前端代码变化，没有新增数据库迁移、配置变更或服务端行为。固定部署器按既有流程停止并启动宝塔 Node 项目、执行其固定迁移 allowlist 检查、测试并重载 Nginx，同时重新申明 Python 项目配置；没有手工额外重启。部署后线上 readiness 恢复正常，因此本次无需再补做重启。后续即使只改 Vue/CSS，也应按固定宝塔发布流程执行，不要绕过部署器做静态文件热拷贝。

隔离 API 夹具和无登录深链检查不证明真实会话、生产 RBAC、MySQL 审计或真实偏好写入。P10 页面完成不代表其余路由或全73页目标完成。
