# P70 采集调度 C 方向生产 Vue 实施

## 范围

已将自动通过的 C 方向接入真实 `/platform-admin/crawler-scheduler`：桌面/手机采用蓝色单机边界说明与白色证据区，分别呈现结论与发现、运行资源、来源并发与排队、完成回执、活动租约及 24 小时样本。页面控制器继续负责既有读取、筛选、分页和恢复动作；只新增展示用 `CrawlerSchedulerEvidence` 组件及页面专属样式，并隐藏重复页级标题。

保留原 GET、15 秒单飞读取、失败快照/追踪、来源筛选分页、过期租约及来源熔断确认对话框与既有 POST/幂等键。未改变 API、调度策略、Worker/Python、数据库、审计、权限、配置、迁移或恢复合同；预览与验证不提交真实恢复操作。

## 本地验证

- `node --test tests/unit/scheduler-page-preview.test.mjs`：2/2。
- `node --test tests/m08-05/crawler-single-host-scheduler.test.mjs`：15/15。
- `node scripts/verify-scheduler-page-preview.mjs`：1440/390px × 两种动效共 144 项、52 次本地 GET，0 次写请求、无截图。
- `node scripts/run-playwright-projects.mjs tests/e2e/m08-05-crawler-scheduler.spec.ts`：桌面 7/7、390px 手机 7/7。
- `npm run typecheck:web` 与相关文件 Prettier 检查通过。

## 提交与部署

提交/build SHA、宝塔部署及线上只读核验将在代码部署完成后补记。全 73 页阶段目标继续；页面与本地夹具不证明生产 RBAC、真实回收/审计或正式 M07-03 验收。
