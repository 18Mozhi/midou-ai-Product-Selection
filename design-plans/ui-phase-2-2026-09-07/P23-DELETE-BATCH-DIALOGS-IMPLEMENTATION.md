# P23 删除与批量操作窗 C 方向接入

## 实施范围

按全阶段视觉自动通过授权，将 `TASK-C-forms-r2` 中 P23 删除窗及五种批量操作窗的蓝白结构接入真实 `/tasks` Vue：任务目标、选择/可执行/跳过摘要、既有操作字段、独立滚动正文与固定操作区。批量取消使用实色红色确认按钮；无可执行项时给出就地说明并保持确认禁用。同步修正任务行打开菜单被后续行遮挡导致删除项不可点击的问题。

目录视觉通过 `.task-workspace--all:not(.task-detail-route)` 和 `directoryPresentation` 限定于 P23 全部任务；P13 `/work` 与 P24 详情沿用旧排版/行为。组件职责未改变：`TaskWorkspace` 持有权限、任务目标、表单值与现有请求，`TaskBatchActions` 通过现有 typed props/emits 显示状态并回传意图。

## 保留的运行合同

- 删除仍使用 `DELETE /tasks/{taskId}`、当前目标的 `expected_version` 及去空白的必填删除原因；审计记录仍保留。取消、Escape、忙碌保护和目标快照逻辑不变。
- 批量仍为暂停、继续、延期、调整负责人和取消，仅对当前符合状态条件的已选任务逐项操作；不符合项跳过，采集关联仅展示、不联动底层任务。
- 原因上限500字；延期的日期字段、转交的工作区成员列表与权限仍使用当前合同。逐项 expected_version、原因/期限/负责人快照、失败计数和单飞保护不变。
- 未增加 API、字段、权限、数据库、配置、依赖或服务。

## 验证

- P23 删除窗及五批量变体真实 Vue E2E：桌面 Chromium 2/2、390px 手机 2/2；包含目标显示、各动作字段/资格计数、无资格禁用、取消红色按钮、触控高度/视口内底栏和取消零写入。
- 完整 `m05-01-business-tasks.spec.ts`：桌面 Chromium 20/20、390px 手机 20/20；本地隔离 HTTP fixture，不证明真实 DB/RBAC/审计。
- `node --test` 的 P13/P23/P24 页面预览合同 3/3；`npm run build:web`、`npm run typecheck:web`、`npm run verify:frontend-budget`（202 assets）、`npm run verify:static-analysis`（446 files）、`npm run format:check`、`npm run verify:docs`（73 routes/60 protected/6 roles/153 files）、`npm run verify:runtime-docs` 与 `git diff --check` 均通过。

## 未完成边界

本批只完成 P23 删除/批量确认窗的 C 构图和代表性双端回归，不将 P23 整页、全部按钮六态、筛选/分页、导出视图、读屏、真实角色权限或正式 M07-03 标成完成。生产部署仍受发布归属清单门禁约束。
