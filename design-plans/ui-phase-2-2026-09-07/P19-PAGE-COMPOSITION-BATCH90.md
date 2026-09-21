# P19 实际 Vue C 组合 · 批90

## 审阅范围

此批只为 `/competitors` 的真实 `CompetitorMonitor.vue` 注入本地审阅 CSS：目录与事实详情改为蓝白工作区，桌面将对象选择与当前证据并列，手机依次呈现选择、当前快照、变化、证据和帮助。生产组件、`competitor.css`、API、权限、路由和部署均未修改。

## 保留的真实边界

- 列表、详情与规则仍是 `GET /competitors`、`GET /competitors/{id}`、`GET /competitor-monitor-rules`；本地审核拦截了这些响应。
- `current_price === null` 仍显示“价格未采到”，无首个快照仍是“等待首次采集”，不把缺失补为零。
- `competitor:manage` 仍控制采集、启停、删除和新增；`task:create` 仍独立控制验证任务。
- 仅命中显式阈值的真实变化才关联告警与任务；本图中的“等待人工验证”只是变化结论，不是自动决策。

## 验证与素材

运行 `node --test tests/unit/competitor-page-preview.test.mjs` 与 `node scripts/verify-competitor-page-preview.mjs --capture-review r1`。实际 Vue 在 1440/390、两种动效设置下完成 32 项检查，0 本地写入、0 页面错误；`output/playwright/p19-page-composition-r1` 含双端 6 张 PNG 和 5 个来源哈希。

审核仅覆盖默认详情、帮助展开和读取失败；不代表创建/删除/规则弹窗、采集、权限、真实外部来源、读屏或生产验收。
