# P62 链路日志 C 方向生产 Vue 接入

## 实施范围

将已通过评审的 P62 蓝色调用链目录、白色事件阅读区和手机单列组合接入真实 `PlatformLogCenter`。链目录只改变当前页面的局部展示选择；各调用链内原有 `ResponsiveDataView` 控件保持挂载，避免切换目录时丢失列/密度等本地状态。页面增加 P62 标识、最多 200 条及调用链可能不完整的事实说明；事件读取区标题层级调整为页面 H1 下的 H2。

新增类型与 `PlatformLogWorkspace` 组件，并用 P62 专属样式完成桌面蓝白分区、移动端单列、焦点与弹窗外观。审核预览现在直接加载生产 Vue 组合，不再用独立的审核组件替换页面内容。

## 保持不变

- GET `/platform/management?domain=logs`、最多 200 条、`status` 来源参数、API/Worker/爬虫来源及时间排序合同不变。
- 真实链路/任务/来源关联链接、读取归属/重试、审计原因与导出合同不变；没有增加时间筛选、分页、执行按钮或新 API。
- 未改变 OpenAPI、数据库、环境变量、权限、依赖或运维服务。
- UI 评审通过只覆盖已展示的设计状态，不代表真实 SQL、RBAC、CSV 下载或正式 M07-03 验收。

## 验证

- `node --test tests/unit/platform-log-page-preview.test.mjs tests/unit/platform-log-read-feedback.test.mjs`
- `node scripts/verify-log-page-preview.mjs`：桌面 51、手机 62 项。
- `node scripts/verify-log-read-lifecycle.mjs`：140 项；`node scripts/verify-log-read-feedback.mjs`：270 项；`node scripts/verify-log-trace-ownership.mjs`：192 项；`node scripts/verify-log-export-reason.mjs`：272 项。
- 定向 P62 双端 E2E：桌面与 390px 手机各 1/1；`npm run typecheck:web` 通过。
- 全量 22 workspace 构建、格式、文档、运行文档与静态分析结果记录于交付计划/发布记录。

## 部署

- commit/build SHA：`44bc87b47239bef78c25a8b1e7fbe6b5a916e29e`，已推送 `main` 并通过 `python scripts/deploy-baota.py` 发布。
- 发布脚本返回 `deployed`，站点、Node、Python 固定目录均为项目规定的宝塔路径，临时包已删除。
- 线上只读核验：`/api/v1/health/ready`、`available`、`version`、`/platform-admin/logs` 及 PlatformLogCenter/PlatformLogWorkspace 专属 JS/CSS 均 HTTP 200；`version.data.build_sha` 与部署 SHA 一致。
- `node scripts/verify-baota-deployment.mjs --production` 仍因缺少 `.artifacts/verification/baota-production-evidence.json` 返回 `production_evidence_missing`。因此仅证明应用发布、健康端点和静态资源可达，不宣称 M07-03 正式签收、生产 SQL/RBAC、真实 CSV 下载或全 73 页验收。
