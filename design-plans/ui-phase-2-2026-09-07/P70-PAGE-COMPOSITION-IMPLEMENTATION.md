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

- 提交/build SHA：`ca5364d35f8e05feb736d09366ae9aa1b0283422`，已推送 `main`。
- `python scripts/deploy-baota.py`：成功；22 个工作区构建通过，M07-03 六对象预检通过，上传临时包已删除。
- 线上 `/api/v1/health/ready=ready`、`/api/v1/health/available=available`，`/api/v1/health/version.build_sha` 与提交一致。
- `/platform-admin/crawler-scheduler` 返回 HTTP 200；专属页面 JS（15,514 bytes）、CSS（23,836 bytes）及证据子组件 JS（3,224 bytes）均 HTTP 200。
- 部署由固定宝塔脚本完成；无需用户手工重启。本次未调用调度读取/恢复等受保护业务接口，也未触发真实恢复。

全 73 页阶段目标继续。页面与本地夹具不证明生产 RBAC、真实回收/审计或正式 M07-03 验收；M07-03 输出是部署预检，不是正式生产验收。
