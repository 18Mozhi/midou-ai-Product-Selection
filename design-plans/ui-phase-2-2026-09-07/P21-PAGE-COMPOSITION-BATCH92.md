# P21 实际 Vue C 组合 · 批92

## 审阅范围

此批只为 `/sourcing` 的真实 `SourcingWorkspace`、候选卡和已保存对比注入本地审核 CSS。蓝白工作台按“找货记录 → 采集/候选事实 → 已确认报价 → 已保存对比”排列；手机按记录、当前详情、候选事实、对比历史顺序展开。

## 保留的真实边界

- 保留 `GET /sourcing/searches`、`GET /sourcing/searches/:id`、`GET /sourcing/comparisons` 读取路径，审核中仅本地拦截响应。
- 候选报价、保存对比和到岸成本状态独立；“待费用规则计算”没有被视觉稿解释为利润或已确认成本。
- 无候选仍是没有真实报价，缺失字段继续要求人工带证据确认。
- 候选加入对比最多五家，创建采购任务仍依赖实际已确认 quote；本稿没有提交写入。

## 验证与素材

运行 `node --test tests/unit/sourcing-page-preview.test.mjs` 与 `node scripts/verify-sourcing-page-preview.mjs --capture-review r1`。实际 Vue 在 1440/390、两种动效设置下完成 32 项检查，0 本地写入、0 页面错误；`output/playwright/p21-page-composition-r1` 含双端 4 张 PNG 和 6 个来源哈希。

审核仅覆盖已存在候选、单条保存对比和读取失败；不代表找货/报价/采购/删除弹窗、成本复核、真实权限、真实采集、读屏或生产验收。
