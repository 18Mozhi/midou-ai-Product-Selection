# P41 创建组织 C 方向生产实施

## 已实施

- `OrganizationCreationWizard.vue` 已接入已确认的 C 构图：桌面蓝色组织身份/步骤栏与白色表单工作区；700px 以下改为蓝色顶部进度、单列字段和底部可达操作。
- 组织名称、标识、首位管理员均有清晰名称和就近帮助；确认页继续展示实际输入及创建影响。保留字段约束、标识末尾连字符现有合同、可用管理员选项、默认当前超级管理员、两步校验、失败重试与取消草稿行为。
- `PlatformAccountCenter.vue` 为组织创建复用现有的 `useUserCreationOwner` 归属守卫。请求发出后仍继续事务；如果用户关闭或离开该创建路由，迟到的成功/失败不再更新旧弹窗、触发旧概览重读或接管新路由。

## 组件边界

- `PlatformAccountCenter` 负责账号读取、API 写入、路由和写入结果归属。
- `OrganizationCreationWizard` 只负责两步表单展示和原生约束校验；保持现有 props（open、busy、错误、用户、表单）与 emits（close、submit、clearError），不增加内部 API 或跨组件共享状态。

## 验证

- `node --test tests/unit/ui-phase2-organization-create-production-composition.test.mjs tests/unit/ui-phase2-organization-create-preview.test.mjs tests/unit/ui-phase2-organization-list-preview.test.mjs`：11/11 通过，验证生产结构、字段约束、创建归属守卫及冻结历史设计证据。
- `npx playwright test tests/e2e/m06-01-platform-accounts.spec.ts --grep "creates organization with audited idempotent request|organization creation keeps API failures inside the wizard and supports retry|organization creation keeps a late response from taking over a newer route" --project=desktop-chromium --project=mobile-390 --workers=1`：使用拦截 API 的隔离夹具覆盖创建、失败重试与关闭后迟到响应。
- 定向 E2E：桌面 Chromium 与 390px 移动端共 6/6 通过；未创建真实组织。
- `npm run typecheck:web`、`npm run format:check`、`npm run verify:docs`、`npm run verify:static-analysis`、`npm run build:web` 与 `git diff --check` 均通过。
- `npm run verify:frontend-budget` 仍报告全局入口 CSS `index-3FlW1W8G.css` 为 129451 bytes，超过现有 122880 bytes 门槛；本次 P41 样式被构建为独立 `OrganizationCreationWizard-iRZRwtrt.css`（5966 bytes），未调整无关全局样式或预算阈值。
- BaoTa 部署成功，部署脚本确认临时发布包已删除；生产 `BUILD_SHA=1c5a61206d2b09d2a83313989942736af591f411`。线上 `/api/v1/health/live`、`/api/v1/health/ready`、P41 深链接及向导/父页面 JS、CSS 资源均返回 200；ready 报告 MySQL、Redis、supervisor 可用。仅为只读运行核验，不执行真实组织创建，也不等于正式 M07-03 验收。

## 未覆盖

自动化不会创建真实组织、数据库行、管理员关系或组织数据范围。真实 MySQL 事务、审计和 RBAC 仍需现有生产验收流程证明；本批没有改变 API、OpenAPI、数据库、权限、配置或依赖。
