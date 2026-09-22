# P36 组织令牌 C 方向生产实施

## 已实施

- `OrganizationAdminCenter.vue` 为组织令牌路由增加独立的 `org-admin-center--token-review` 生产作用域，避免影响组织资料、成员、角色和审批页面。
- `OrganizationTokenPanel.vue` 将真实 DOM 顺序收口为“令牌生命周期记录 → 组织安全边界 → 创建组织令牌”；视觉顺序与键盘顺序一致。
- `organization-admin.css` 增加 P36 蓝白证据台样式：蓝色组织标题、扁平统计带、白色生命周期记录、四字段筛选、分页、一次性明文区、安全边界和移动端单列创建区；保留原筛选、创建、复制、轮换、撤销、查询同步和错误契约。
- 未修改令牌 API、字段、scope 列表、权限判断、审计原因、明文生命周期或后端写入规则。

## 验证

- `node --test tests/unit/ui-phase2-org-token-production-composition.test.mjs`：3/3 通过。
- `npx playwright test tests/e2e/m06-01-organization-admin.spec.ts --grep "organization tokens" --project=desktop-chromium --project=mobile-390 --workers=1`：4/4 通过。
- `npm run typecheck:web`、`npm run format:check`、`git diff --check`：通过。

P36 旧的完整历史图证回放仍包含既有父组件、共享弹窗和 CSS 源指纹漂移失败；本批不重写历史哈希，也不把该回放失败归因于当前生产布局调整。

## 未覆盖

本批未验证真实会话、RBAC、MySQL 计数、真实凭据创建/轮换/撤销、审计写入、系统剪贴板或正式 M07-03 生产证据；本地 E2E 使用隔离夹具，不等同生产验收。
