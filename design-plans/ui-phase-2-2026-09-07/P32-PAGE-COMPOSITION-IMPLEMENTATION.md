# P32 工作区治理 C 方向生产实施

## 已实施

- `OrganizationAdminCenter.vue` 在工作区路由启用生产范围标记，并让该页使用唯一 `h1`。
- `OrganizationWorkspacePanel.vue` 保留已审核的工作区读取、筛选、分页、默认工作区保护、内联创建与归档/恢复动作合同。
- `organization-admin.css` 增加生产范围内的蓝白治理说明、统计、目录、当前详情、默认项保护、表单、焦点态和手机单列布局；不改变创建、归档或恢复接口。

## 验证

- `node --test tests/unit/workspace-page-preview.test.mjs`：通过。
- `node scripts/verify-workspace-page-preview.mjs --capture-review r3`：1440/390 双端各 7 项检查，4 次本地 GET，零写入；截图与 manifest 已刷新。
- `npm run typecheck:web`、`npm run format:check`、`npm run build:web`：通过。

## 未覆盖

本批未验证真实会话、RBAC、工作区创建/归档/恢复写入、失败状态、读屏或正式 M07-03 生产证据；本地 fixture 不等同生产验收。
