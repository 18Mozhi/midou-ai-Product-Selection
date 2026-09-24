# P23 创建与编辑任务弹窗 C 方向实施

## 范围

将 C 方向创建/编辑弹窗接入真实 `/tasks` Vue：桌面标题区、字段分组、双列次级字段、独立滚动正文与固定操作区；手机改为单列，操作始终可见。按用户 2026-09-24“剩下的全部通过”视觉授权自动通过本批既定 C 方向，不代表产品行为、真实权限或生产验收通过。

## 保留的运行合同

- 原 `POST /tasks` 与 `PATCH /tasks/{taskId}` 不变；请求字段仍为 `title`、`description`、`priority`、`due_at`。编辑继续带原 `assignee_id`、`expected_version` 与固定原因。
- 标题仍必填且最多200字符；说明仍最多5000字符；优先级选项、期限空值序列化和原生表单校验不变。
- 原取消/Escape关闭及在途 busy 禁用保持；新增关闭图标只调用同一 `closeTaskEditor`，返回焦点仍由现有 modal composable 管理。
- API 错误在原有 `actionHint` 和 `request_id` 基础上增加弹窗内提示，保留草稿并允许重试；不更改状态码分类、重试策略或 API 调用。

## 验证

- `node --test tests/unit/all-task-page-preview.test.mjs`：1/1。
- `npm run typecheck:web`：通过。
- 新增弹窗用例桌面 Chromium/390px 手机 4/4；完整 `m05-01-business-tasks.spec.ts` 桌面/390px 各18/18。
- `npm run build:web`、`npm run verify:frontend-budget`（202 assets）、`npm run format:check`、`npm run verify:static-analysis`、`npm run verify:docs`（73 routes）及 `npm run verify:runtime-docs` 均通过。

## 未覆盖

本批只覆盖创建/编辑弹窗，不将删除、批量操作、详情动作、导出视图或读取状态标为已完成。测试写入均由本地 Playwright 路由拦截，不证明 MySQL、RBAC、审计或正式 M07-03。尚未部署：固定部署脚本的发布归属清单仍绑定 `29bfbaa8`，提交头为 `f3004c1f`；必须先按授权更新归属绑定并重新核验后才可发布。本批仅静态前端，成功发布时无需重启 Node/Python。
