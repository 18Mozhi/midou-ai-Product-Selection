# P43 用户目录 C 方向真实 Vue 实施

## 改动范围

- `/platform-admin/users` 现在把既有全平台账号汇总和账号二级导航放入复用的 `PlatformAccountGlobalRail`，右侧/下方白色工作区承载用户目录标题、邮箱与状态筛选、更新时间和真实账号记录。
- 使用页面专属 `PlatformAccountUsersC.css` 处理桌面双栏与 760px 以下单列布局、蓝色身份栏、字段/按钮层级、可见键盘焦点及移动触控尺寸；P40 组织页、P44 管理员比较及 P42 组织详情样式不随该选择器改变。
- 全局数字继续标明“正常/全部”“可登录/全部”“平台管理员”，其来源仍为未筛选的平台汇总；目录搜索仍只查询既有账号列表。

## 保持不变

- 账号目录 GET、现有 `query` / `status` URL 读写、筛选和清空行为均保留。
- 创建用户字段、角色选项、组织关系校验、密码限制、请求体/幂等键、权限和审计原因未改；创建、详情、安全操作仍由原组件与父级持有。
- 手机端保留现有“账号记录预览 → 打开账号详情”流程；没有切换为 C 研究稿中提议的直达详情，也没有改变组织授权入口或新增业务按钮。
- 未改 API/OpenAPI、后端、数据库、权限规则、环境、依赖、路由或部署拓扑。真实 MySQL 写入、RBAC、审计和正式 M07-03 验收不由本批证明。

## 验证

- `tests/e2e/m06-01-platform-accounts.spec.ts` 在桌面 Chromium 与 390px 手机运行完整 100 项，通过。新增结构断言覆盖蓝色汇总栏、当前导航、用户目录标题、可见按钮/链接/筛选控件至少 44px，以及桌面/手机无横向溢出。
- 桌面与 390px 手机真实路由渲染已人工核对；因该 E2E 使用拦截的本地账号样例，不保留 Mock 截图基线，避免被发布真实性门禁误计为真实服务端截图证据。
- `npm run typecheck:web`、`npm run build:web`、`npm run verify:docs`、`npm run format:check`、`npm run verify:frontend-budget`（202 项资源）和 `npm run verify:static-analysis` 均通过。
- 固定宝塔部署已完成，生产 `/api/v1/health/version` 返回 build SHA `149238e17975520a8077814248042676d9d67378`，ready=`ready`、available=`available`；`/platform-admin/users`、入口 JS/CSS、P43 专属组件 JS/CSS 与目录工作区 JS 均 HTTP 200，P43 专属 CSS 含本批样式标记。
- E2E 写入使用本地夹具；本次只做生产版本、健康状态、深链和静态资源核验，未执行真实账号写入，不代表生产 RBAC、MySQL 数据、审计或正式 M07-03 验收。

## 运维

仅前端 Vue/CSS 与设计/回归文档变化；无 API、环境或依赖合同变化。部署使用项目固定宝塔脚本完成；后续代码发布仍须以同提交 BUILD_SHA、健康状态、深链及页面专属静态资源进行核验。
