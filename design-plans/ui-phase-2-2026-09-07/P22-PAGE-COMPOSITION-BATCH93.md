# P22 实际 Vue C 组合 · 批93

## 审阅范围

此批只为 `/sourcing/cost-rules` 的真实 `CostRuleConsole` 注入本地审核 CSS。蓝白工作台呈现成本规则身份、准备度、版本目录、显式费用、换算依据、审批链和读取失败；手机按准备度、版本、费用、来源和审批链渐进阅读。

## 保留的真实边界

- 保留 `GET /cost-rules` 和现有规则筛选、选择、分页、角色/能力判断；本地审核只拦截读取响应。
- active 规则只代表费用版本生效，不代表任何机会已通过成本/利润质量门。
- 每项费用、汇率日期与来源都是规则事实；空费用并没有被补作零或默认费用。
- 审批、发布、回滚仍受现有状态、角色和 `expected_revision` 约束；本稿没有提交任何动作。

## 验证与素材

运行 `node --test tests/unit/cost-rule-page-preview.test.mjs` 与 `node scripts/verify-cost-rule-page-preview.mjs --capture-review r1`。实际 Vue 在 1440/390、两种动效设置下完成 32 项检查，0 本地写入、0 页面错误；`output/playwright/p22-page-composition-r1` 含双端 4 张 PNG 和 6 个来源哈希。

审核仅覆盖 active 规则、草稿目录与读取失败；不代表新草稿表单、七类操作窗、实际审批/发布/回滚、真实角色、读屏或生产验收。
