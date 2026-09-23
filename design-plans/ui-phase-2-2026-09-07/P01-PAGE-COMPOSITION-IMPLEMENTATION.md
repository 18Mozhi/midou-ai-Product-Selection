# P01 根入口 C 方向实际 Vue 实施记录

## 页面实施

P01 `/` 已将获批的轻量入口构图接入实际 `LandingRedirectSurface.vue`：独立蓝色入口说明、白色解析区、受阻原因、请求关联编号和单一重新检查按钮；不显示业务侧栏、推测角色、组织数据或成功结论。桌面宽屏居中、手机改为单列；保留系统减少动态效果设置。处理中不渲染操作按钮，关联编号仅在失败/缺少目标时显示。

该 presentational 子组件只接收 `state`、`requestId` 并向上传递 `retry` 事件；`LandingRedirect.vue` 仍单独负责现有 GET 与路由替换。没有增加对话框、表单、业务写入或新的服务状态。

## 保留的路由与读取合同

- 挂载及失败重试仍由既有 API 客户端执行 `GET /me/landing`，保留其 GET 安全重试节奏。
- 服务端返回 `/home` 时仍使用 `navigation-memory` 的最近成员路径；其他服务端目标由原 `router.replace` 处理，不在前端硬编码角色放行。
- `ApiClientError` 的 `expired` 仍替换到 `/login`；缺失 route 与其他错误保持受阻，只有用户显式点“重新检查”才重新读取。
- 没有改变 API、OpenAPI、权限、浏览器存储、路由表、数据库、配置或依赖，也没有修改服务端业务行为。

## 本地验证

- `npm run typecheck:web`：通过。
- `node --test tests/unit/landing-page-preview.test.mjs`：2/2 通过。
- `node scripts/verify-landing-page-preview.mjs`：真实 Vue 审核夹具在 1440/390、reduced/no-preference 下共 48 项检查、24 个被拦截 GET 通过；没有写请求、额外 API 或页面错误。
- `node scripts/run-playwright-projects.mjs --grep "P01 root|P01 failure|P01 missing destination|M00-01.A15 product entry|M02-03 regression: public root resolves" --workers=1`：桌面与 390px 手机均通过，覆盖延迟加载、加载时无操作、受阻重试、缺少路由保持受阻、成员首页落点和过期转登录。
- 实际重试按钮检查 44px 最小热区、hover 深蓝状态、3px 键盘焦点；测试使用本地隔离响应，不访问生产账号。

## 生产与验收边界

页面视觉按用户“剩余页面视觉通过”的授权自动登记为已同意。上线后需在此补记固定宝塔部署与只读生产核验；健康端点和静态页面可达不代表真实会话、角色权限或正式 M07-03 验收。生产 smoke 不执行身份写入。
