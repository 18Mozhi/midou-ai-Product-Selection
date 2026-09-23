# P23 删除弹窗异步归属修复

## 问题

`TaskWorkspace.removeTask` 发出 DELETE 后，原生 Escape 会调用 `closeDeleteDialog()` 并清空响应式 `deleting`。成功响应随后再读取 `deleting.value.id/version`，形成 `TypeError`，导致来源列表未刷新。这里不会撤销已经发出的服务端请求。

## 修复

- 在等待 DELETE 前捕获本次目标任务、版本和去空白后的原因。
- 后续路径与刷新判断只使用该目标快照，不从弹窗当前状态重取任务。
- 仅当仍打开的是本次目标弹窗时清理其状态；已关闭的窗口不会被回包重开或误清另一个目标。
- 原 `DELETE /tasks/{id}` 路径、`expected_version`、`reason`、授权和成功后的详情返回/列表读取合同保持不变。

## 验证

- 新增 UI2-T07 实际 Vue E2E：挂起 DELETE → Escape 关闭 → 返回成功回包；断言返回来源列表、精确请求体且无 `pageerror`。
- `scripts/verify-ui-phase2-task-list-review.mjs` 将历史缺陷预期改为正向验证：弹窗目标清空后，提交目标仍完成列表刷新。
- `tests/e2e/ui-phase2-task-contracts.spec.ts` 桌面 Chromium 19/19、mobile-390 19/19；任务页面单元测试 2/2、Web 类型检查、`build:web` 与 `verify:frontend-budget`（202项资源）通过。
- 合并运行 M05-01 后观察到 2 项与本补丁无关的失败：旧详情截图高度不一致、未修改的审批通知主题样式变化断言。未更新截图基线或扩大修改范围。
- 此处的 E2E 响应为本地隔离夹具，不证明真实 MySQL、RBAC 或生产写入。

## 边界

未修改 DELETE API、数据库/迁移、权限、审计、弹窗可取消策略、任务筛选或其它任务动作；未取消已发送的网络请求。
