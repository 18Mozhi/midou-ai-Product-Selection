# P24 五类动作弹窗 C 方向实施

## 范围

为真实 `/tasks/:taskId` 的暂停、取消、调整期限、转交负责人和更新进度表单接入 C 方向字段/弹窗组织。只调整展示组件边界与视觉，不新增或删除任务动作。

## 组件边界

- `TaskWorkspace.vue`：继续拥有当前任务、权限、动作状态、读取归属、API 请求与 `expected_version`。
- `TaskDetailPanel.vue`：继续呈现任务卷宗/活动，并向父层转发操作意图。
- `TaskActionDialog.vue`：接收任务标题/版本、动作表单、成员选项和 busy 状态；负责字段显示、原生 dialog 生命周期，以及通过 typed emits 请求提交、关闭和表单更新。该组件不调用 API。

## 保留的运行合同

- 动作键仍为 `pause`、`cancel`、`delay`、`transfer`、`progress`。
- 保留必填字段、0–100整数进度、500字原因/进展限制、日期及成员选择字段。
- 任务版本仍从详情当前版本读取并由父组件写入现有动作请求；请求字段/body、权限和后续详情读取不变。
- 返回、Escape关闭及触发控件返焦保留；表单测试不提交请求。
- 未改 API、OpenAPI、数据库、权限、环境或依赖。

## 实施内容

- 将五种表单从 `TaskDetailPanel` 独立为只呈现/转发意图的 `TaskActionDialog`。
- 标题区列出动作类型与任务版本；浅蓝说明区标出具体任务对象与既有版本冲突提示。
- 必填/字数/业务提示紧邻字段，并通过 `aria-describedby` 与输入关联。
- 正文独立滚动、底栏常驻；移动端双操作各保留至少44px目标；取消动作的主提交使用危险红色。

## 验证

- `npm run typecheck:web`：通过。
- P24动作窗定向 E2E：桌面Chromium/390px手机各1/1；覆盖五种变体、字段、焦点返还、底栏与44px控件，0动作写入。
- 完整 `tests/e2e/m05-01-business-tasks.spec.ts`：桌面Chromium与390px手机各23/23。
- `node --test tests/unit/task-detail-page-preview.test.mjs`：1/1。
- `npm run build:web`：通过，543模块。
- `npm run verify:frontend-budget`：通过，202项资源；`npm run verify:static-analysis`：通过，448文件。
- `npm run verify:docs`：通过，73路由/60受保护/6角色/153份文档；`npm run verify:runtime-docs`：通过。
- `npm run format:check`：通过；`git diff --check`：通过。

所有浏览器响应均为隔离本地fixture；不代表真实RBAC、MySQL写入、版本冲突或正式 M07-03 验收。

## 未覆盖边界

真机触控、完整读屏器朗读、真实会话/RBAC、真实动作审计与数据库冲突，以及全 73 路由正式生产验收仍需各自验证。生产部署不由本地E2E或构建通过推定。
