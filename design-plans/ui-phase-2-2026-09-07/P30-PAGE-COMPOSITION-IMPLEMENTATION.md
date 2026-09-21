# P30 组织成员 C 方向生产实施

## 已实施

- `OrganizationAdminCenter.vue` 在成员路由启用生产范围标记，并让该页使用唯一 `h1`。
- `OrganizationMemberPanel.vue` 保留已审核的组织摘要、邀请字段、邀请结果、邀请记录、成员筛选、目录、角色分配与状态动作合同。
- `organization-admin.css` 增加生产范围内的蓝白组织身份、邀请工作区、记录目录、筛选工具栏、成员行、状态标签、焦点态和手机单列布局；不改变邀请、角色或成员状态接口。

## 验证

- `node --test tests/unit/member-page-preview.test.mjs`：通过。
- `node scripts/verify-member-page-preview.mjs --capture-review r2`：1440/390 双端各 6 项检查，邀请写入仅拦截 1 次，截图与 manifest 已刷新。
- `npm run typecheck:web`、`npm run format:check`、`npm run build:web`：通过。

## 未覆盖

本批未验证真实会话、RBAC、邮件投递、角色/成员状态写入、失败状态、读屏或正式 M07-03 生产证据；本地 fixture 不等同生产验收。
