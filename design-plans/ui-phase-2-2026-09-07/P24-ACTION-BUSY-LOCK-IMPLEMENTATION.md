# P24 单项动作弹窗提交中锁定

日期：2026-09-29

## 问题与边界

P24 原动作窗在 `TaskWorkspace.submitTaskAction()` 等待 POST 期间，只禁用了确认按钮；字段、右上关闭、返回和 Escape 仍可操作。请求体在提交时已经构造，之后修改的进展或原因不会改变已发送请求，但仍留在页面状态中，容易造成“修改已提交”或“关闭撤销请求”的错觉。

## 实施

- `TaskActionDialog` 继续只接收父组件 `busy`，不拥有 API 或写入状态。
- transfer、delay、progress 的百分比/说明、pause/cancel/transfer 原因等当前活动字段均绑定 `disabled=busy`。
- 关闭与返回按钮在请求期间禁用；原生 dialog `cancel` 仍阻止默认关闭，但 busy 时不发出 close 事件。
- 确认按钮保持现有“正在提交…”文案与禁用行为。
- API 路径、action、`expected_version`、理由/期限/成员/进度字段及成功/失败处理均未改变；不尝试中止或撤回已经发送的请求。

## 验证

`tests/e2e/m05-01-business-tasks.spec.ts` 的“P24 action dialog locks fields and dismissal while its write is pending”使用真实挂载 Vue 页面和延迟的本地 `/tasks/{taskId}/actions` 回应，覆盖 progress 变体的精确请求体、字段及关闭按钮禁用、Escape 不收窗、成功响应后收窗。desktop Chromium 与 mobile-390 各 1/1 通过。另生成并人工查看两张实际忙碌态视觉参考图；它们不是像素回归断言，以免突破仓库规定的 E2E realism mocked-screenshot 比例门：

- `tests/e2e/m05-01-business-tasks.spec.ts-snapshots/p24-action-pending-busy-desktop-chromium-win32.png`
- `tests/e2e/m05-01-business-tasks.spec.ts-snapshots/p24-action-pending-busy-mobile-390-win32.png`

本地 fixture 不证明生产网络、真实用户/RBAC、数据库写入或其他四种动作的失败恢复；这些仍需各自的运行证据。
