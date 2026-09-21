# P35 实际 Vue C 组合 · 批104

## 审核范围

本批使用实际 `/org-admin/data` 与 `OrganizationDataPanel`，仅在本地审核层重构数据账本身份、规模摘要、工作区比较与导出履历。

## 保留的合同

- 保留组织摘要和组织数据读取。
- 保留“数量不等于数据质量”的事实边界。
- 导出履历保持只读：本批不创建、下载或删除导出；`row_count=null` 显示“尚未生成”，0 显示“0 行”。

## 本地核验

`node --test tests/unit/organization-data-page-preview.test.mjs` 通过。

`node scripts/verify-organization-data-page-preview.mjs --capture-review r1` 在 1440/390 各通过 6 项检查，生成工作区比较与导出履历的双端永久审核图；每组四个本地读取、零写入。

## 未覆盖

未验证真实会话、RBAC、数据库计数、创建/下载导出、失败状态、读屏、完整 URL 历史或生产环境；本批不构成生产验收。
