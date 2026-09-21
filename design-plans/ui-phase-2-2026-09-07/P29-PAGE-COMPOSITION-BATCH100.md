# P29 实际 Vue C 组合 · 批100

## 审核范围

本批使用实际 `/org-admin` 与 `OrganizationAdminCenter` 的资料页，仅在本地审核层重构组织头部、事实摘要、资料阅读与内联编辑表单。

## 保留的合同

- 保留摘要、资料和工作区三项既有读取。
- 保存仍是 `PATCH /org/admin/profile`，保留六个资料字段、变更原因和 `expected_version`。
- 未改生产组件、接口、权限、数据库或部署。

## 本地核验

`node --test tests/unit/organization-profile-page-preview.test.mjs` 通过。

`node scripts/verify-organization-profile-page-preview.mjs --capture-review r1` 在 1440/390 通过各 5 项检查；每组拦截一次精确版本化保存合同并生成双端永久审核图。

## 未覆盖

未验证真实会话、RBAC、背景刷新、失败/冲突、跨组织切换、读屏、其他组织后台页面或生产环境；本批不构成生产验收。
