# P21 供应链找货 C 方向生产实施

## 范围

本批将蓝白找货工作台迁移到真实 `/sourcing` 与 `SourcingWorkspace`：找货记录、采集进度、候选事实、已确认报价、最多五家对比和采购任务入口。

## 保留运行合同

- 保留 `GET /sourcing/searches`、`GET /sourcing/searches/:id`、`GET /sourcing/comparisons` 读取路径。
- 候选报价、保存对比和到岸成本状态独立呈现；“待费用规则计算”不解释为利润或已确认成本。
- 无候选仍表示没有真实报价，缺失规格、交期、地点、可信度或风险时继续要求人工带证据确认。
- 候选加入对比最多五家；创建采购任务仍依赖实际已确认 quote。本批不新增提交写入。

## 实施内容

- 启用 `sourcing-workspace--review` 作用域，并将页面主标题提升为唯一 `h1`。
- 以蓝色说明区、白色/浅蓝台账、横向流程、记录目录、事实详情和对比历史重构桌面与手机布局。
- 保留现有生产组件、数据绑定、操作合同和权限判断，仅调整页面编排、层级、焦点、状态与响应式样式。

## 验证

- `node --test tests/unit/sourcing-page-preview.test.mjs`：2/2 通过。
- `node scripts/verify-sourcing-page-preview.mjs --capture-review r2`：1440/390、reduced/no-preference 共 32 项检查，0 次写入，4 张截图。
- 类型检查、格式检查、生产构建、发布归属校验和宝塔部署在本批提交前完成。

## 未覆盖边界

本批不等同于找货创建/删除、报价确认、对比保存、采购任务写入、真实采集、RBAC、屏幕阅读器/真机验收或正式 M07-03 证据。
