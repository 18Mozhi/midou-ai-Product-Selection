# P59 安全中心 C 方向生产 Vue 接入

状态：C 方向页面组合已接入实际 Vue，双端业务回归通过；本提交部署后再做线上 build SHA 与静态资源核验。用户已授权“完成的页面自动同意”，本页按该授权将已批准的 C 方向整页布局和所覆盖控件视觉视为通过，不再等待逐图确认。此项不扩展为真实 RBAC、SQL 审计或安全运营验收。

## 页面与组件边界

- `SecurityOperationsCenter.vue`：保持现有只读查询编排、四类 RouterLink、五个数据视图及双分页；更新为单一页面 H1、调查导航、全平台背景摘要和白底调查工作区。
- P59 延迟加载的页面 CSS 隐藏通用页面标题，避免重复可访问 H1；不修改 NavigationShell 共享逻辑。
- `ResponsiveDataView.vue`：新增可选 `appearance="security"` 外观标记，只供 P59 五个详情消费者使用；Teleport 手机详情通过专属 class 使用蓝色标题、白色证据字段、灰色技术区和蓝色焦点，不改详情逻辑或其他消费者样式。
- `security-operations-c.css`：页面作用域 C 样式；桌面保留独立表格/冻结列/原生技术展开，手机采用常驻 2×2 调查导航和单列详情；不更改共享全局主题或其他页面。

## 保留的产品合同

- `/api/v1/platform/security/operations` 的 GET 路径、参数、20 条分页、时间窗与筛选含义、`platform:secure` 权限和成功读取审计副作用均未变。
- 事件、会话、凭证、组织令牌和平台审计仍是五个独立集合；凭证与令牌继续独立分页。没有添加安全对象写操作、密钥复制或导出。
- 原组件的读取代次/超时、URL历史、迟到结果隔离、移动详情焦点、列表空态和敏感字段隐藏保持不变。
- 没有新增依赖、环境变量、API字段、数据库迁移或后台服务；OpenAPI 和运行参数说明不适用。

## 验证

- P59 页面审核宿主的单元/结构/焦点/lifecycle 合计 37 项通过。
- `tests/e2e/m06-04-security-operations.spec.ts`：desktop Chromium 与 390px 手机各 6 项通过；涵盖四类导航、筛选、独立数据集合、详情/技术字段、零摘要历史记录、空态、403/503和无写请求。
- `node scripts/verify-security-page-preview.mjs`：1440/390 双端98项检查通过；`node scripts/verify-security-detail-preview.mjs`：390/760/761/1440与两种动效模式共752项详情检查通过，零图片输出。
- `npm run typecheck:web`、`npm run build:web`、`npm run verify:docs`、`npm run format:check`、`npm run verify:plans`、`npm run verify:runtime-docs`、`npm run verify:static-analysis` 与 `npm run verify:release-matrix` 均通过。
- `npm run verify:frontend-budget` 仍报告现有全局超限：主 CSS 129451/122880 bytes、NavigationShell JS 51825/51200 bytes；P59 使用独立延迟页面 CSS，未改动 NavigationShell。部署脚本的 22 工作区发布构建及线上核验仍待运行。

## 未声明完成的边界

本地 E2E 使用隔离响应，不证明真实 MySQL、RBAC、读取审计或真实生产数据。正式 M07-03 签收继续依赖 `.artifacts/verification/baota-production-evidence.json`；缺失时不能宣称正式生产验收完成。其他未迁移页面及 73 页整体目标继续。
