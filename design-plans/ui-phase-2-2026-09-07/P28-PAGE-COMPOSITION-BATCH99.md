# P28 实际 Vue C 组合 · 批99

## 审核范围

本批使用实际 `/reports` 与 `ReportCenter`，仅在本地审核层套用蓝白报表工作台：报表类型、结论与统计口径、事实分布、导出生命周期与导出详情。

## 保留的合同

- 保留 `/reports/:type` 的三类既有聚合读取，不新增日期或自定义筛选。
- 保留既有 `POST /report-exports` CSV 创建体：`report_type` 与 `format: csv`。
- 保留详情和下载/重建的原入口；本批未改生产 Vue、API、Worker、权限、数据或部署。

## 本地核验

`node --test tests/unit/report-page-preview.test.mjs` 通过。

`node scripts/verify-report-page-preview.mjs --capture-review r1` 在 1440/390 与 reduced/no-preference 两种动效偏好下通过 36 项检查；每组仅拦截一项 CSV 创建合同，生成默认和详情双端 4 张永久审核图及来源哈希。

## 未覆盖

未验证真实会话、RBAC、趋势/团队切换、下载字节、重建、轮询、空/失败状态、全部键盘边界、Worker、数据库或生产环境；本批不构成生产验收。
