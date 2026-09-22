# P23 全部任务目录 C 方向生产实施

## 范围

本批将蓝白“工作区目录 → 本人优先摘要 → 状态/搜索/排序 → 任务记录与分页”迁移到真实 `/tasks` 的 `TaskWorkspace(mode=all)` 与 `TaskListPanel`。

## 保留的运行合同

- 保留 `GET /tasks` 全范围列表、`GET /tasks/summary` 当前 actor 摘要和 `GET /tasks/member-options` 独立读取。
- 摘要只用于提示当前成员优先事项；目录总数继续来自列表元数据。
- 保留状态、query、sort、page、选择、详情、创建和批量操作合同；导出视图仍是独立 `view=exports` 分支。
- 本批不新增 API、权限、数据库字段或任务动作。

## 实施内容

- 在生产 `TaskWorkspace` 上启用 `task-workspace--review` C 方向作用域。
- 统一蓝色目录标题、当前队列摘要、状态筛选、搜索/排序折叠、白色任务记录、进度条、分页和键盘焦点。
- 补齐桌面/移动任务目录及读取失败状态的响应式视觉层。

## 验证证据

- `node --test tests/unit/all-task-page-preview.test.mjs`：通过。
- `node scripts/verify-all-task-page-preview.mjs --capture-review r2`：1440/390、reduced/no-preference 四组共28项检查通过，0 本地写入、0 页面错误，生成4张审阅图。
- Web 类型检查、格式检查、生产构建与宝塔部署在本批提交前完成。

## 未覆盖边界

导出视图、创建/编辑/删除/批量弹窗、真实权限、读屏完整回归和正式 M07-03 生产证据不在本批假设为已验收。
