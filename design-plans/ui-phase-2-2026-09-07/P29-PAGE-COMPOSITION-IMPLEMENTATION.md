# P29 组织资料 C 方向生产实施

## 已实施

- `OrganizationAdminCenter.vue` 在组织概览资料路由启用生产范围标记，并让该页使用唯一 `h1`。
- 保留组织摘要、资料、工作区读取，以及六个资料字段、变更原因、`expected_version` 和 `PATCH /org/admin/profile` 保存合同。
- `organization-admin.css` 增加生产范围内的蓝白组织身份、事实摘要、资料阅读卡、版本化编辑表单、状态提示、焦点态和手机单列布局；不改变接口、权限或数据库。
- 修复写入已被服务接受、随后资料 GET 失败时仍显示成功的 OG-G02：分别显示写入/读取请求编号与“不要再次提交”；保存表单暂时禁用，直到用户通过“刷新数据”成功核对最新资料。刷新只执行现有 GET，不重放 PATCH。

## 验证

- `node --test tests/unit/organization-profile-page-preview.test.mjs`：通过。
- `node scripts/verify-organization-profile-page-preview.mjs --capture-review r2`：1440/390 双端各 5 项检查，每组 1 次精确版本化保存拦截，截图已刷新。
- `npm run typecheck:web`、`npm run format:check`、`npm run build:web`：通过。
- `tests/e2e/m06-01-organization-admin.spec.ts` 新增浏览器闭环：模拟 PATCH 接受、写后 GET 的三次既有安全重试均失败、用户手动 GET 成功；断言两个请求编号、表单禁用与恢复期间恰好一次 PATCH。该测试为本地拦截 fixture，不代表生产服务验收。

## 未覆盖

本批未验证真实会话、RBAC、并发冲突策略、跨组织切换、读屏或正式 M07-03 生产证据；本地 fixture 不等同生产验收。恢复 GET 若仍失败，用户需继续刷新核对；没有自动重试写入。
