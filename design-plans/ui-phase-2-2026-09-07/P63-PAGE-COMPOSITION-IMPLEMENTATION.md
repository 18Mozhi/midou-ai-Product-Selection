# P63 接口覆盖证据 · C 方向生产 Vue 实施

批153按已批准的 C 方向重做 `/platform-admin/api-coverage` 页面。蓝色报告身份与目录关联边界、全目录事实统计/分布和只读操作证据使用独立工作区；每条操作按真实接口字段显示路径、权限/角色、数据源及消费者声明。原生键盘可操作的 details 展示五项适用性、状态、测试 ID、最近结果和请求/追踪编号。移动端单列展示，超长路径及 operation ID 可换行。缺失、无效、过期报告、无结果及最多 300 项返回分别呈现。

保留原 `PlatformManagementCenter` 路由、`api-coverage` 到 API `api_coverage` 映射、`platform:superadmin` 权限、既有 GET/query/status 与报告数据字段；没有接口、OpenAPI、环境变量、数据库、依赖或授权规则变更。`current` 只表示 method/path 目录报告可关联，不表示构建身份、元数据/权限新鲜度或逐维验证通过；拒绝、受阻和未执行未被包装为成功。

## 本地验证

- P63 实际 Vue 报告状态矩阵：4 组（1440/390px × reduced/default motion），80 项检查、24 次本地 GET；current、missing、invalid、outdated、wrong-operation-id；无写入、下载或外网请求。
- P63 双端定向 E2E：桌面 Chromium、390px mobile 各 1/1；合成夹具覆盖 258 项目录及查询/统计边界。
- `tests/unit/api-coverage-page-preview.test.mjs` 与 `tests/m06-02/api-coverage-dashboard.test.mjs`：6/6。
- `npm run typecheck:web`、`npm run build:web`、`npm run build`（22 工作区）、`npm run verify:docs`、`npm run verify:static-analysis` 通过；代码格式检查修正后复验。
- `npm run verify:frontend-budget` 仍失败：入口 CSS 129451/122880 bytes、NavigationShell JS 52528/51200 bytes；未改动共享壳层以扩大预算优化范围。
- 未将其他 M06-02 页面标题断言失败计入本页验收；P63 定向 E2E 为通过。本地合成数据不能证明真实受限生产报告、SQL/RBAC 或正式 M07-03 验收。

## 部署状态

宝塔固定部署脚本首轮已成功执行，线上 `BUILD_SHA=aa8e7c4da4d6ac1da2e2df3217ce26cb0fa8555e`，与 P63 实施提交一致；2026-09-23 按用户要求以当前同步 HEAD `9e92680460a34cf32898c4246c041afb36c3af22` 再次执行部署，22 工作区构建通过，线上 `/api/v1/health/live`、`ready`、`version` 与 `/platform-admin/api-coverage` 均 HTTP 200，version SHA 匹配，`ApiCoverageDashboard` 与 `ApiCoverageOperationCard` 的 JS/CSS 四项静态资源均 HTTP 200，部署临时包已删除。`node scripts/verify-baota-deployment.mjs --production` 因缺少 `.artifacts/verification/baota-production-evidence.json` 返回 blocked；正式 M07-03 签收未完成。没有新增宝塔服务或数据库迁移；未使用生产 superadmin 会话读取真实受限报告，也未把本地合成数据、健康检查或静态资源可达表述为生产报告、SQL/RBAC 验收。
