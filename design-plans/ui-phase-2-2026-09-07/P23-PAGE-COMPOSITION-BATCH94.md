# P23 实际 Vue C 组合 · 批94

## 审阅范围

此批仅为 `/tasks` 的真实 `TaskWorkspace(mode=all)` 与 `TaskListPanel` 注入本地审核模板和 CSS。蓝白布局为“工作区目录 → 本人优先摘要 → 状态/搜索/排序 → 任务记录与分页”；手机将任务目录作为独立工作面，不复用 `/work` 的个人工作口径。

## 保留的真实边界

- 保留 `GET /tasks` 全范围列表、`GET /tasks/summary` 当前 actor 摘要及 `GET /tasks/member-options` 的独立读取。
- 摘要仅用于提示当前成员优先事项，不能被解释为目录总数；目录总数仍来自列表元数据。
- 保留既有状态、query、sort、page、选择、详情、创建和批量操作合同；本次审核没有写入任务。
- 导出视图仍是独立 `view=exports` 分支，不混入业务任务目录。

## 验证与素材

运行 `node --test tests/unit/all-task-page-preview.test.mjs` 与 `node scripts/verify-all-task-page-preview.mjs --capture-review r1`。实际 Vue 在 1440/390、两种动效设置下完成 28 项检查，0 本地写入、0 页面错误；`output/playwright/p23-page-composition-r1` 含双端 4 张 PNG 和 6 个来源哈希。

审核仅覆盖默认目录和读取失败；不代表导出视图、创建/编辑/删除/批量弹窗、真实权限、读屏或生产验收。
