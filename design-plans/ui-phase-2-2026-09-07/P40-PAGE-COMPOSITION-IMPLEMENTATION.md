# P40 组织管理列表 C 方向生产实施

## 已实施

- 真实 `PlatformAccountCenter.vue` 在 `/platform-admin/organizations` 路由上增加 `account-center--organization-review` 作用域，保留组织名称/标识搜索、active/disabled/archived 状态筛选、重置、创建组织、详情导航和移动记录预览合同。
- 组织路由沿用 P39 蓝色范围标题与白色事实工作区，同时为筛选查询与组织记录增加蓝色证据边界，避免把用户/管理员字段混入组织列表。
- 未新增 API、分页字段、权限、数据库或写入动作；组织详情仍使用现有父级选择与既有弹窗。

## 验证

- `node --test tests/unit/ui-phase2-platform-organization-list-production-composition.test.mjs`：3/3 通过。
- P39 账号管理壳层双端导航回归 4/4 通过；P40 复用同一真实父级路由和记录组件。
- `npm run typecheck:web`、`npm run format:check`、`git diff --check`：通过。

## 未覆盖

本批未改变或宣称完成真实组织分页、MySQL 过滤/排序、组织创建/编辑/停用写入、跨组织 RBAC、详情历史生命周期或正式 M07-03 证据。
