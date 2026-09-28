# P47 首次读取状态接入生产 Vue

## 改动范围

将 [P47 首次读取审核稿](P47-LOADING-REVIEW.md) 的加载状态接入真实 `ProviderAdapterCenter.vue`：首次读取时显示来源目录专属标题与说明、白色紧凑状态区域和静态骨架；无记录、进度百分比或完成时间会被虚构。加载期间继续保留 `UiStatePanel` 的 `aria-live="polite"`、`aria-busy="true"` 和装饰骨架 `aria-hidden`。

生产 CSS 仅在活动 P47 页面 `.adapter-center--c` 内作用于 `data-kind="loading"`；不改共享 `UiStatePanel`、其它状态或其它页面。页面现有刷新按钮反馈和已加载目录快照不变；错误态标题/说明、关联号、重试 GET、12 秒读取边界、权限与依赖状态均保持原样。

适配归档预览 helper：旧审核提交的历史组件仍可按原规则生成两条提案属性；当前生产组件若已含正式等待/错误文案则转换保持幂等，避免重复 Vue 属性。历史 PNG、清单与原提交源码指纹未刷新或覆盖。

## 验证

- `node --test tests/unit/ui-phase2-provider-adapter-loading.test.mjs`：3/3 通过，覆盖当前生产模板、归档提案幂等与历史证据完整性。
- `npx --no-install playwright test tests/e2e/m03-03-provider-adapter.spec.ts --project=desktop-chromium --project=mobile-390 --workers=1 --grep "P47 initial loading state"`：实际 Vue 桌面/390px 各 1/1 通过；等待中核对标题、说明、骨架、无假目录数据、ARIA 与样式，解除受控读取后核对正常目录恢复。
- 完整 `m03-03-provider-adapter.spec.ts` 桌面/390px 共20/20通过；`npm run build:web`（含Web类型检查及浏览器helper构建）、`npm run verify:frontend-budget`（202资源）、`npm run verify:static-analysis`、`npm run format:check`、`npm run verify:docs`、`npm run verify:plans` 与 `git diff --check` 通过。
- 本批之前启动的全量 `npm run verify:functional` 仍在 Node 单测阶段失败，含与本次无关的历史源码指纹失配。本页归档 loading 转换重复属性缺陷已由本批单测修正；全量总门未在本批完成后重跑，不据此宣称全项目总门通过。

## 发布记录

功能提交 `c06c8187351d083f9dcc8992369b09b3304cd1c5` 已推送并通过固定 `python scripts/deploy-baota.py` 发布；部署脚本返回 `deployed`，build SHA 与该提交一致，脚本内公网版本/健康和路由验证通过，上传临时包已删除。仅 P47 前端样式/文案与本页测试/文档变化，无数据库迁移、配置变更或服务运行参数变化。

## 未覆盖

隔离本地响应不证明真实登录、P47权限、供应商目录、健康探针、跨页在途检查锁或 M07-03 正式生产验收；不新增 API、OpenAPI、数据库、环境变量、依赖、写入行为或后台服务。生产发布继续遵守项目宝塔部署流程。
