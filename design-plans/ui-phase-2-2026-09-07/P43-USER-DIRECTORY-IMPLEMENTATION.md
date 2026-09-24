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
- 两张真实路由截图固定于 `tests/e2e/m06-01-platform-accounts.spec.ts-snapshots/p43-user-directory-{desktop-chromium,mobile-390}-win32.png`；只使用拦截的本地账号样例。
- `npm run typecheck:web`、`npm run build:web`、`npm run verify:docs`、`npm run format:check`、`npm run verify:frontend-budget`（202 项资源）和 `npm run verify:static-analysis` 均通过。
- 构建只验证静态包；回归未创建、修改或停用真实账号，不代表生产权限或真实数据验收。

## 运维

仅前端 Vue/CSS 与设计/回归文档变化；无 API/Node/Python 配置变更，不要求重启 Node 或 Python。部署仍使用项目固定宝塔脚本；线上需要以部署后 BUILD_SHA、live/ready、路由和静态资源返回结果核验。
