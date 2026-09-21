# P29 组织资料 C 方向生产实施

## 已实施

- `OrganizationAdminCenter.vue` 在组织概览资料路由启用生产范围标记，并让该页使用唯一 `h1`。
- 保留组织摘要、资料、工作区读取，以及六个资料字段、变更原因、`expected_version` 和 `PATCH /org/admin/profile` 保存合同。
- `organization-admin.css` 增加生产范围内的蓝白组织身份、事实摘要、资料阅读卡、版本化编辑表单、状态提示、焦点态和手机单列布局；不改变接口、权限或数据库。

## 验证

- `node --test tests/unit/organization-profile-page-preview.test.mjs`：通过。
- `node scripts/verify-organization-profile-page-preview.mjs --capture-review r2`：1440/390 双端各 5 项检查，每组 1 次精确版本化保存拦截，截图已刷新。
- `npm run typecheck:web`、`npm run format:check`、`npm run build:web`：通过。

## 未覆盖

本批未验证真实会话、RBAC、背景刷新、失败/冲突、跨组织切换、读屏或正式 M07-03 生产证据；本地 fixture 不等同生产验收。
