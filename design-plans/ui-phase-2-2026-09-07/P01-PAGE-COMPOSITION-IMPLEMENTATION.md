# P01 根入口 C 方向实际 Vue 实施记录

## 2026-10-01 · 重试控件状态与在途反馈双端回归

现有重试按钮 CSS 没有改动；`m00-01-runtime.spec.ts` 现在实测默认蓝色、hover 深蓝、3px 键盘焦点和pressed更深蓝，并在重试 GET 挂起时确认页面回到loading且操作按钮隐藏，释放后只进入一次既有服务端目标。桌面 Chromium 与390px手机各通过。P01动作审阅把可见状态映射到已批准C方向，并将源码不存在的disabled变体列为不适用。受控回包仅为实际Vue本地交互/视觉证据，不替代真实会话、RBAC、读屏或生产验收；无运行行为/API/权限变更。

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
- 实际重试按钮检查默认、hover 深蓝、pressed 深色、3px 键盘焦点以及44px最小热区；重试GET挂起时回到loading并隐藏按钮。`m00-01-runtime.spec.ts`完整5项在桌面Chromium与390px手机各5/5通过，P01 route-scoped palette 单测通过；测试使用本地隔离响应，不访问生产账号。

## 生产与验收边界

页面视觉按用户“剩余页面视觉通过”的授权自动登记为已同意。固定宝塔脚本已成功部署 build SHA `de035c93b9e4ca7c7e74393a5dd085a5bac2cdca`；脚本回执为 `deployed`，网站、Node、Python 包均按项目固定目录发布，临时上传包已删除。

生产只读核验：`/api/v1/health/live`、`ready`、`available` 均 HTTP 200；live 的 `build_sha` 与上述提交一致。`/` 返回 HTTP 200，引用的 JS `index-BKco_TWp.js`、CSS `index-DZmb6GGd.css` 均 HTTP 200，线上 SHA-256 分别为 `D5AE2F0E5618C056DC9CF50D4CE25E3C29BAF1181EE4736BE59872AC71B97BF4`、`06BD3C12EADC67FD927980328BCA15164497DE07C68E6A3FA9E718B7FB307618`，与本地构建文件一致。匿名真实浏览器访问 `/` 后只发出一次 `GET /api/v1/me/landing`，收到预期 401 并进入 `/login`；页面无 JS 异常，静态资源无失败。没有使用账号或执行身份写入。

此 smoke 证明本次版本、静态资产与匿名路由边界已上线，不代表真实会话落点、目标角色权限或正式 M07-03 验收通过；这些仍需独立证据。

## 2026-10-04 · 已完成页面自动同意

用户已授权“完成的页面自动同意”。本页按现有设计稿、真实 Vue 双端浏览器回归、根路由 401 转登录与既有宝塔只读核验完成自动同意。当前复跑的 P01 根入口回归为桌面 4/4、390px 手机 4/4。此同意限于 P01 页面构图与已覆盖的本地交互，不把真实登录角色、所有服务端目标权限或正式 M07-03 验收改记为通过；动作审计仍保留其独立权限边界。
