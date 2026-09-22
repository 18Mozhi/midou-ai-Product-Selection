# P34 审批模板 C 方向生产实施

## 已实施

- 保持 `OrganizationAdminCenter.vue` 与 `OrganizationApprovalPanel.vue` 的真实读取、URL 查询恢复、分页、模板版本差异、技术详情和失败/权限/限流反馈合同不变。
- `organization-admin.css` 以现有 `.org-approval-governance` 子树为范围，收口蓝色组织标题、只读边界说明、审批统计、记录/模板目录、白色详情区、版本差异、分页、空态、焦点态和 390px 单列布局。
- 使用 CSS 子树范围隔离，不修改 P34 历史父级/子级源码快照、API 字段或审批决策能力；审批动作仍回到原业务工作台。

## 组件边界

- `OrganizationAdminCenter`：负责组织数据读取、错误状态、路由视图和权限边界。
- `OrganizationApprovalPanel`：负责审批记录与模板版本两个只读视图、筛选、分页、URL 状态和差异事实。
- `OrganizationApprovalFirstFailure`：负责首次读取失败、限流和追踪编号反馈，保留温和权限/内容不展示文案。

## 验证

- `node --test tests/unit/ui-phase2-org-approvals-query.test.mjs tests/unit/ui-phase2-org-approvals-template-keyboard.test.mjs`：12/12 通过；依赖历史来源指纹的旧 P34 replay 套件仍保留其既有失败，不将旧图稿失败归因于本批 CSS。
- `npx playwright test tests/e2e/m06-01-organization-admin.spec.ts --grep "approval governance|member choices" --project=desktop-chromium --project=mobile-390`：验证审批记录/模板筛选、分页、URL 恢复、版本差异和技术详情。
- `npm run typecheck:web`、`npm run format:check`、`git diff --check`：通过。

## 未覆盖

本批未提供审批模板创建/编辑/发布或审批决定入口；真实 RBAC、数据库审批写入、长期超时和正式 M07-03 生产证据仍待。
