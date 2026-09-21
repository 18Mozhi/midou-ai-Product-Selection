# P20 实际 Vue C 组合 · 批91

## 审阅范围

此批仅为 `/competitors/monitoring-rules` 的真实 `CompetitorMonitor.vue` rules 模式注入本地审核 CSS。蓝白布局按“规则作用范围 → 触发条件 → 生效状态”呈现规则目录；手机将一条规则的范围、条件、目标、版本和状态依次排列。

## 保留的真实边界

- 保留先读 `GET /competitors`，再读 `GET /competitor-monitor-rules` 的真实路径，且本地审核拦截这些响应。
- enabled 与非 enabled 状态仍分别为“已生效”“已停用”；全局规则仍明确显示“工作区全部竞品”。
- 仅 `competitor:manage` 可看到创建入口；本页没有被补造的编辑、删除、启停或批量规则操作。
- 价格规则沿用当前选中快照币种的既有显示逻辑；这不宣称全局或不同对象的币种正确性。

## 验证与素材

运行 `node --test tests/unit/competitor-rules-page-preview.test.mjs` 与 `node scripts/verify-competitor-rules-page-preview.mjs --capture-review r1`。实际 Vue 在 1440/390、两种动效设置下完成 36 项检查，0 本地写入、0 页面错误；`output/playwright/p20-page-composition-r1` 含双端 6 张 PNG 和 5 个来源哈希。

审核只覆盖默认规则、空规则和读取失败；不代表新建表单、指定对象/库存变体、真实权限、规则写入、读屏或生产验收。
