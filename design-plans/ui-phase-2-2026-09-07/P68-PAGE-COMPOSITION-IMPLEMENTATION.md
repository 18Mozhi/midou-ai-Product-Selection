# P68 MySQL 运行 C 方向生产 Vue 实施

## 范围

将已自动通过的 C 方向结构接入 `/platform-admin/mysql` 真实 Vue 页面：桌面采用蓝色工作区身份/目录与白色证据区，手机采用单列证据；区分 MySQL 单主运行边界、发现、资源使用、慢查询近似速率、累计与瞬时计数、同机恢复证据，以及持久化实值与合同目标。

保留现有 GET `/api/v1/platform/operations/mysql`、15 秒超时、单飞刷新、`platform:operate` 页面权限、失败分类、成功快照与请求追踪归属。未修改 API、服务端/MySQL 策略、数据库、审计、密钥、SQL/配置操作、备份或恢复流程；未新增依赖。

## 验证

- `node --test tests/unit/mysql-page-preview.test.mjs`：3/3。
- `node scripts/verify-mysql-page-preview.mjs`：1440/390px × reduced/no-preference 共 180 项、52 次本地 GET；无截图、无写请求。
- `node scripts/run-playwright-projects.mjs tests/e2e/m08-03-mysql-resilience.spec.ts`：桌面 3/3、手机 3/3。
- `npm run typecheck:web` 通过。
- `npm run build:web` 通过；部署脚本中的 22 工作区构建和 M07-03 preflight（6 个部署对象）通过。`npm run verify:docs`、`format:check`、`verify:static-analysis`、`verify:plans`、`verify:runtime-docs`、`verify:release-matrix`、发布归属检查通过。

## 提交与部署

- 代码提交/构建版本：`caf6b7f320e531e876986d9afbfb4df6627337fd`，已推送 `main`。
- 已通过 `python scripts/deploy-baota.py` 部署到项目固定宝塔目录；脚本停止并启动宝塔 Node 项目以完成受控迁移/部署流程，生产包临时文件已删除。未新增本任务专属数据库迁移。
- 线上 `health/ready=ready`、`health/available=available`、`health/version.build_sha` 与代码提交一致；`/platform-admin/mysql` 返回 HTTP 200。
- P68 专属资源返回 HTTP 200：`/assets/MySqlResilienceCenter-CKZOq6do.js`（12,952 bytes）、`/assets/MySqlResilienceCenter-CW4KI6qI.css`（23,773 bytes）。已检查 CSS 含 `.mysql-resilience--c`、`p68-boundary`，JS 含页面标题与同机恢复区标记。
- 部署由固定脚本处理；无需用户手工重启。涉及真实线上 MySQL/权限/审计/恢复的确认仍由独立运维流程负责，本次没有调用受保护的 MySQL 页面接口。

## 明确边界

本地 E2E 使用测试样例，不执行真实 MySQL 检查；页面与资源可达不等同于生产 RBAC、SQL 审计、真实恢复演练或正式 M07-03 验收通过。全站 73 页阶段目标继续。
