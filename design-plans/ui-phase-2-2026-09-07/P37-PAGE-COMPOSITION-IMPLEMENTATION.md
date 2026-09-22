# P37 组织审计 C 方向生产实施

## 已实施

- `OrganizationAdminCenter.vue` 为审计路由增加独立的 `org-admin-center--audit-review` 生产作用域。
- `OrganizationAuditPanel.vue` 将真实 DOM 顺序收口为“查询筛选 → 已加载汇总 → 审计时间线与详情”，保留精确筛选、页内搜索、追加游标、系统事件折叠、脱敏上下文和复制请求/追踪 ID。
- `organization-audit.css` 增加蓝白审计台：桌面左侧查询栏、右侧统计和时间线/详情；1250px 以下查询栏上移，900px 以下列表与详情纵向排列，手机字段单列并限制列表局部滚动。
- 未新增编辑、删除、导出、重放或审计写入能力；未修改 API、筛选字段、游标、权限和脱敏规则。

## 验证

- `node --test tests/unit/ui-phase2-org-audit-production-composition.test.mjs`：3/3 通过。
- `npx playwright test tests/e2e/m06-01-organization-admin.spec.ts --grep "organization audit" --project=desktop-chromium --project=mobile-390 --workers=1`：11 passed、1 skipped（权限场景按既有夹具跳过）。
- `node --test tests/unit/ui-phase2-org-audit-production-composition.test.mjs`：3/3 通过。
- `npm run typecheck:web`、`npm run format:check`、`git diff --check`：通过。

历史 P37 图证和父级源指纹仅作为设计与行为参考，不在本批改写；本批只记录真实 Vue 生产作用域和当前布局。

## 未覆盖

本批未验证真实会话、RBAC、MySQL 双表归并、真实游标权限、系统剪贴板、完整屏幕阅读器/200% 缩放或正式 M07-03 生产证据。
