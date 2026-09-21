# P28 报表与导出 C 方向生产实施

## 已实施

- `ReportCenter.vue` 迁移到已审核的蓝白报表工作台，使用页面级 `h1`，保留三类报表读取、CSV 创建、详情、下载与重建入口。
- `report-center.css` 增加生产范围内的报表类型导航、统计口径、结论、事实分布、导出生命周期、详情抽屉、禁用与焦点状态，以及手机布局。
- 未新增日期筛选或自定义聚合，不改变 `POST /report-exports` 的 `report_type` 与 `format: csv` 合同。

## 验证

- `node --test tests/unit/report-page-preview.test.mjs`：通过。
- `node scripts/verify-report-page-preview.mjs --capture-review r2`：1440/390、reduced/no-preference 四组共 36 项检查，每组一次精确 CSV 创建拦截，4 张审核图已刷新。
- `npm run typecheck:web`、`npm run format:check`、`npm run build:web`：通过。

## 未覆盖

本批未验证真实会话、RBAC、趋势/团队切换、下载字节、重建、轮询、空/失败状态、Worker、数据库、读屏或正式 M07-03 生产证据；本地 fixture 不等同生产验收。
