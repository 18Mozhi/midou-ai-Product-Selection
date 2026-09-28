# P24 单项动作弹窗提交中锁定

日期：2026-09-29

## 延伸：五种动作失败保留与显式重试

已将 API 失败的 `action_hint` 与请求编号放回当前单项动作弹窗，草稿与动作目标保持不变；用户可核对并自行再次提交。没有自动重放 POST、没有中止已发请求，也没有更改 `action`、`expected_version`、字段名、权限或服务端合同。关闭并返回入口只在空闲时清除本地错误反馈。

`tests/e2e/m05-01-business-tasks.spec.ts` 现在逐项验证 pause、cancel、delay、transfer、progress：延迟 409 期间所有当前字段及关闭/返回不可操作、Escape 不收窗；失败后错误提示与请求编号在原窗可见、原字段内容完整保留且控件恢复，明确重试发送相同请求体，成功再关闭。每项的桌面和390px手机实际Vue测试各通过。失败态参考图共10张，保存在 `tests/e2e/m05-01-business-tasks.spec.ts-snapshots/p24-action-{pause,cancel,delay,transfer,progress}-failed-{desktop-chromium,mobile-390}-win32.png`。它们是单独保留的视觉参考，不是像素断言，也不由回归 spec 自动重拍，以免提高 mock 截图比例。

这些受控浏览器回执证明本地交互和请求快照，不证明生产会话/RBAC/数据库或真实版本冲突处理；其余 P24 页面状态与 M07-03 仍独立开放。

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

本地 fixture 不证明生产网络、真实用户/RBAC、数据库写入或服务端冲突处理。最初仅测 progress 在途成功；五种变体409失败恢复现已由上方延伸段落单独覆盖。
