# P24 实际 Vue C 组合 · 批95

## 审核范围

本批以实际 `/tasks/:taskId` 路由、`TaskWorkspace` 与 `TaskDetailPanel` 为来源，建立隔离的 Vue 审核层：蓝色详情标题、任务事实、阻塞/负责人、采集关联、技术详情、动作区、活动与评论，以及“更新进度”表单和直达不存在任务状态。

生产脚本、路由、权限判断、成员目录读取、版本冲突字段及 API 合同没有改动。审核夹具只拦截本地浏览器请求；进度提交是一次本地响应，不能代表数据库写入或生产验收。

## 保留的合同

- 详情仍通过 `GET /tasks/{taskId}` 读取，成员名仍通过 `GET /tasks/member-options` 读取。
- 进度动作仍由既有 `TaskDetailPanel` emit 到 `TaskWorkspace`，提交 `POST /tasks/{taskId}/actions`，字段为 `action=progress`、`expected_version`、`progress_percent`、`progress_note`。
- 读取 404 保持既有“任务不存在或已删除”语义；没有把它混同为列表空状态。
- 操作按钮继续由现有 `canUpdate`、`canAssign` 与任务终态判断控制。

## 本地核验

`node --test tests/unit/task-detail-page-preview.test.mjs` 通过。

`node scripts/verify-task-detail-page-preview.mjs --capture-review r1` 在 1440/390 与减少/正常动效下通过 32 项检查；每组一次本地拦截的进度写入，精确核对既有请求体；产出 6 张 PNG 与 5 个来源哈希。

## 未覆盖

未验证真实会话、RBAC、数据库写入、版本冲突、其余动作提交、读屏、真机触控和生产部署。本批仅为审核稿，不可作为生产验收或部署依据。
