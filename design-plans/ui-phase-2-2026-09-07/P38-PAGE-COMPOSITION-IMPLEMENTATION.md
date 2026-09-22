# P38 平台运行概览 C 方向生产实施

## 已实施

- `PlatformDashboard.vue` 增加独立的 `platform-dashboard--review` 生产作用域，保留窗口选择、刷新、超时、快照保留、权限状态、趋势、来源健康和管理入口合同。
- `platform-dashboard.css` 将真实首页收口为蓝色管理操作栏与白色事实工作区：待办/关注、平台事实、常用入口、任务趋势、来源健康、系统检查、后台任务和异常清单保持事实优先；桌面左栏、1100px 以下上移、700px 以下单列。
- 保留真实 `/platform/dashboard` 读取、12 秒超时、当前窗口归属、401/403/429/空态和来源渐进展开；未新增 API、字段、权限或写入动作。

## 验证

- `node --test tests/unit/ui-phase2-platform-overview-production-composition.test.mjs`：3/3 通过。
- `npx playwright test tests/e2e/m06-02-platform-dashboard.spec.ts --grep "platform cockpit|platform window|bounded timeout" --project=desktop-chromium --project=mobile-390 --workers=1`：5 passed、1 skipped（既有权限夹具）。
- `node --test tests/unit/ui-phase2-platform-overview-production-composition.test.mjs`：3/3 通过。
- `npm run typecheck:web`、`npm run format:check`、`git diff --check`：通过。

同文件更宽的 `platform completion` 组合还会进入 P56/P55 下游路由；该组合出现 4 个既有标题不匹配，未归因于 P38，也未用它替代 P38 直接场景证据。

历史 P38 图证、窗口同步和平台壳层回放不重写；本批只接入真实 `PlatformDashboard.vue` 的生产 C 作用域和布局样式。

## 未覆盖

本批未验证真实 RBAC、MySQL 指标、真实来源/采集写入、全主题密度、KeepAlive 历史生命周期或正式 M07-03 生产证据。
