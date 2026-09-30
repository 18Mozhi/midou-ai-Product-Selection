# P26 通知弹窗失败反馈与焦点

日期：2026-09-30  
范围：`/notifications` 的消息详情 workflow 操作失败和通知偏好保存失败。

## 本批交付

- 复现详情 workflow 与偏好 PUT 返回 409 时，只在页面顶部显示错误；原生弹窗挡住页面通知，用户无法在当前操作上下文看到失败原因。
- 按当前请求所有权，将既有 `ApiClientError.actionHint` 和 `requestId` 分别保存在详情/偏好错误状态中；不合并到另一个通知对象或另一个偏好窗口。
- 原弹窗内以 `role="alert"` / `aria-live="assertive"` 呈现错误，弹窗 `aria-describedby` 指向当前提示；等待 Vue 更新后将焦点移至提示。请求编号使用弹窗内折叠区显示。
- 两个原生对话框启用现有 `useModalDialog` 的 Tab/Shift+Tab 环绕。关闭、切换详情、偏好窗开关及显式重试清掉所属旧错误。
- 冲突不清除用户已编辑的偏好，不伪造字段校验；偏好邮件固定关闭、请求体中的 `expected_version`、详情 action/version、已读及处理规则保持原样。

## 验证

- `tests/unit/notification-page-preview.test.mjs` 与 `tests/unit/ui-phase2-notification-ownership.test.mjs`：29/29。
- `tests/e2e/m05-03-notifications.spec.ts` 新增真实 Vue 受控冲突场景：桌面 Chromium 与 390px 移动端各 2/2。检查提示留在所属 dialog、焦点交接、`aria-describedby`、焦点环绕、请求编号展开及偏好草稿保留。
- 受控 409 回包只验证客户端渲染；不证明生产通知 API、RBAC、审计、MySQL、读屏器或 M07-03。

## 明确未变更

没有修改 API/OpenAPI、权限、数据库、通知邮件策略、自动已读、workflow 动作、偏好草稿与提交合同；页面列表/详情读取错误仍走页面级反馈。
