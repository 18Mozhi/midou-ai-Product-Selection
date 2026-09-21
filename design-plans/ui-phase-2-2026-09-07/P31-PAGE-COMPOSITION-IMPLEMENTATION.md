# P31 角色与资源授权 C 方向生产实施

## 已实施

- `OrganizationAdminCenter.vue` 在角色与授权路由启用生产范围标记，并让该页使用唯一 `h1`。
- `OrganizationRolePanel.vue` 保留角色、当前授权、成员、工作区、授权目标和资源授权读取；角色分配仍位于成员页，资源目标仍从详情复制 UUID。
- `organization-admin.css` 增加生产范围内的蓝白角色身份、事实摘要、角色目录、能力矩阵、数据范围、授权目录与授权详情布局，以及禁用、危险、焦点和手机单列状态；本批不打开创建、延期或撤销写入。

## 验证

- `node --test tests/unit/role-page-preview.test.mjs`：通过。
- `node scripts/verify-role-page-preview.mjs --capture-review r2`：1440/390 双端各 6 项检查，12 次本地读取，零写入；角色矩阵与资源授权截图已刷新。
- `npm run typecheck:web`、`npm run format:check`、`npm run build:web`：通过。

## 未覆盖

本批未验证真实会话、RBAC、创建/延期/撤销、原因窗、读取失败、跨组织切换、读屏或正式 M07-03 生产证据；本地 fixture 不等同生产验收。
