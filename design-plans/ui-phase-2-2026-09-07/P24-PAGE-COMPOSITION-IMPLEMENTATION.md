# P24 任务详情 C 方向生产实施

## 范围

本批将任务卷宗 C 方向迁移到真实 `/tasks/:taskId` 路由、`TaskWorkspace.vue` 与 `TaskDetailPanel.vue`：任务详情标题、事实、进度、处理时限、负责人、阻塞上下文、采集关联、技术详情、动作区、活动/评论及动作弹窗。

## 保留的运行合同

- 详情继续通过 `GET /tasks/{taskId}` 与 `GET /tasks/member-options` 读取。
- 进度动作仍由现有 `TaskDetailPanel` emit 到 `TaskWorkspace`，提交 `POST /tasks/{taskId}/actions`，保留 `action=progress`、`expected_version`、`progress_percent`、`progress_note`。
- 404 继续显示“任务不存在或已删除”，不与列表空状态混同。
- 操作按钮继续由 `canUpdate`、`canAssign` 与任务终态判断控制；本批不新增 API、权限或数据库字段。

## 实施内容

- 在生产组件上启用 `task-workspace--review` C 方向作用域。
- 统一蓝色任务标题、白色事实网格、浅蓝阻塞区、动作区、技术详情、活动评论与危险操作焦点状态。
- 补齐桌面/移动任务卷宗、直达不存在状态和进度/转交/期限/取消弹窗的响应式视觉层。

## 验证证据

- `node --test tests/unit/task-detail-page-preview.test.mjs`：通过。
- `node scripts/verify-task-detail-page-preview.mjs --capture-review r2`：1440/390、reduced/no-preference 四组共32项检查通过，生成6张审阅图，进度合同每组精确拦截一次。
- Web 类型检查、格式检查、生产构建与宝塔部署在本批提交前完成。

## 未覆盖边界

真实会话、RBAC、数据库写入、版本冲突、其余动作提交、读屏完整回归、真机触控和正式 M07-03 生产证据不在本批假设为已验收。
