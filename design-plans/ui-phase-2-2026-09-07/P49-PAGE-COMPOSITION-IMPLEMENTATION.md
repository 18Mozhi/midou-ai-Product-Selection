# P49 1688 启用检查 · C 方向生产 Vue 实施

日期：2026-09-23
范围：`/platform-admin/providers/sources/1688-acceptance` 当前真实 `Alibaba1688AcceptanceCenter` 页面。

## 实施结果

- 按已通过的 C 方向将页面整理为蓝色来源身份/结论轨与白色证据工作区；窄屏收为单列。门禁证据与覆盖诊断分区展示，覆盖不参与门禁计数，服务端 `overall` 原样权威展示。
- 将生产 Vue 拆成页面编排、证据展示、验收运行表单、运行/下一步信息与专用 composable/数据类型。保留原页面现有按钮和页面内表单，没有新增弹窗、轮询、启用操作或功能入口。
- 原 GET 检查、活动组织/工作区选择、12 秒超时、成功后刷新和精确 POST 合同保持不变。202 明确表示排队，不表示浏览器运行结束或来源已启用。
- 读取失败与 POST 结果分开记录；202 后 GET 失败继续显示排队任务、任务编号与独立读取失败提示，同时保留上次成功快照。未知 POST 结果提示任务可能已创建，不自动重发，并锁定再次提交；手动读取不会解除这个锁。
- GET 与组织/工作区读取按请求代次归属，离页/停用时中止旧读，返回后重读，阻止迟到数据覆盖新视图。POST 不因离页而中止；组件卸载后其迟到回执不污染其他页面。
- 状态、读取编号、提交编号分开呈现；范围失败可原位重新读取。组织/工作区字段保留活动范围及默认工作区优先规则，关键词仍最多 200 字。

## 未变更合同

没有修改 API/OpenAPI、请求字段、路由、权限、数据库、环境配置、依赖、worker/crawler 或部署服务拓扑；无运行时重启要求。真实业务抓取、浏览器认证、RBAC、MySQL、生产写入、SC49/PR-G01以及全 73 页面验收不能由本地隔离 E2E 代替。

## 验证

- `1688 acceptance` Playwright：desktop Chromium 3/3、390px mobile 3/3。覆盖原页面事实、精确 202 请求与排队文案、POST 成功但读取 503 后双结果保持、人工重读恢复，以及网络中断时未知结果锁定且不重发。
- `npm run typecheck:web`、`npm run build:web`、`npm run verify:docs`（73 路由）、`npm run format:check`、`npm run verify:runtime-docs`、`npm run verify:static-analysis`、`npm run verify:release-matrix --validate`、`npm run verify:plans` 通过。
- `npm run verify:frontend-budget` 仍失败：全局入口 CSS `129451 > 122880` 字节；这是已记录的共享包预算超限，不是 P49 页面 chunk 的新增失败，本次未擅改其他页面以降低全局包。
- 后续部署只报告 `deploy-baota.py` 的宝塔构建/上传与线上只读健康、深链、静态资源结果。正式 M07-03 证据缺口保持显式，不据本地测试推断通过。
