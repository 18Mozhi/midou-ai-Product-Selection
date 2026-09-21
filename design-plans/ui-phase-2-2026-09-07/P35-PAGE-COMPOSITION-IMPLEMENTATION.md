# P35 组织数据 C 方向生产实施

## 已实施

- `OrganizationAdminCenter.vue` 在组织数据路由启用生产范围标记，并让该页使用唯一 `h1`。
- `OrganizationDataPanel.vue` 迁移到已审核的蓝白数据账本构图，保留工作区比较、导出履历、筛选、分页及“尚未生成/0 行”事实区分。
- `organization-admin.css` 增加生产范围内的桌面/手机 C 方向样式、焦点态和触控尺寸，不改变组织数据读取或导出只读合同。

## 验证

- `node --test tests/unit/organization-data-page-preview.test.mjs`：通过。
- `node scripts/verify-organization-data-page-preview.mjs --capture-review r2`：1440/390 双端各 6 项检查，4 次本地 GET，零写入；截图与 manifest 已刷新。
- `npm run typecheck:web`、`npm run format:check`、`npm run build:web`：通过。

## 未覆盖

本批未验证真实会话、RBAC、数据库计数、导出创建/下载/删除、失败状态、读屏或正式 M07-03 生产证据；本地 fixture 不等同生产验收。
