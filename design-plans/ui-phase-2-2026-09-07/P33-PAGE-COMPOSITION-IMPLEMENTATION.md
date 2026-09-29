# P33 团队管理 C 方向生产实施

## 已实施

- `OrganizationAdminCenter.vue` 在 `/org-admin/teams` 路由启用 P33 生产范围标记，并将页面标题提升为唯一 `h1`。
- `OrganizationTeamPanel.vue` 的现有团队目录、状态筛选、搜索/排序、创建表单、团队详情、成员分配/移除、空态和技术详情继续作为真实交互入口；本批不改 props、接口字段、审计原因或成员范围边界。
- `organization-admin.css` 增加蓝色治理标题、白色团队工作区、统计带、目录/详情双栏、移动端单列、焦点环、禁用态与空态样式；不提供服务端尚未支持的负责人变更、流程变更或归档入口。

## 组件边界

- `OrganizationAdminCenter`：负责组织数据读取、路由视图和写入函数绑定。
- `OrganizationTeamPanel`：负责团队筛选、目录选择、创建表单、详情和成员动作的本地呈现与状态。
- `AuditedReasonDialog`：负责成员动作和创建动作的原因确认，沿用现有 Teleport、焦点和审计合同。

## 创建成功但列表重读失败

- 创建 POST 已成功时仍关闭创建表单并保留创建成功回执；同时在团队台显示独立读取失败提示，分别呈现写入与读取 request ID。
- “重新读取团队列表”只执行现有组织摘要/团队/成员 GET 链，不重复 POST；读取成功后清除提示，普通读取失败时保留旧列表与恢复入口。
- 401/403 仍遵从父页面既有失败处理并隐藏团队内容；不把权限拒绝当作可重试的普通读取失败。
- 当前实现没有更改请求字段、API、权限、审计、幂等或数据结构。

## 验证

- `node --test tests/unit/ui-phase2-teams-review.test.mjs tests/unit/ui-phase2-teams-fields.test.mjs`：通过。
- `node scripts/run-playwright-projects.mjs tests/e2e/m06-01-organization-admin.spec.ts --grep "team creation keeps its receipt when list refresh fails and retry only rereads"`：desktop-chromium 与 mobile-390 均通过；故障注入证明创建仅提交一次、失败回执并存、显式恢复后目录更新。
- `npx playwright test tests/e2e/m06-01-organization-admin.spec.ts --grep "organization teams|member choices" --project=desktop-chromium --project=mobile-390`：验证团队目录、筛选、分页、创建、成员动作和空态。
- `npm run typecheck:web`、`npm run format:check`、`git diff --check`：通过。

## 未覆盖

本批未改变或宣称完成真实会话、RBAC、团队/成员写入、邮件投递、生产规模容量和正式 M07-03 证据；本地 fixture 与拦截写入只证明前端合同，不等同生产验收。
