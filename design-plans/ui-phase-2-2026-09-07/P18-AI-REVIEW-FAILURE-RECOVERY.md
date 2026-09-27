# P18 AI 抽检失败原因恢复

## 范围

修复 `OpportunityWorkspace.reviewAi()` 在 AI 结果抽检失败时原因窗先关闭、原因草稿丢失、服务端操作提示只显示在被模态遮住的页面区域的问题。

- 抽检失败后仅在仍处于发起操作的机会详情且 AI 分区可见时重新打开原因窗；继续使用相同的结果 ID 与 approved/rejected outcome。
- 精确保留本次提交的原因文本，并把现有 API 客户端解析出的 `action_hint` 作为模态内 `role="alert"` 呈现，并与原因文本框关联。
- 失败后不会自动再次 POST；用户显式确认后才产生下一次请求，取消会结束恢复循环。机会或分区改变时不会把旧结果的原因窗重开到当前视图。
- 共享 `AuditedReasonDialog` 的错误提示是可选属性，其他调用者行为不变。

## 不变边界

请求路径仍为 `POST /api/v1/ai-analyses/{id}/reviews`，请求体仍为 `{ outcome, notes }`；`opportunity:decide`、同源、幂等键、服务端审计/Outbox与AI原文不可改写合同没有变化。本次不声称修复未知提交结果、服务端冲突恢复或真实 RBAC/数据库行为。

## 验证

`tests/e2e/m04-07-ai-analysis.spec.ts` 新增 actual-Vue 控制响应回归，覆盖 approved/rejected；服务端夹具首次返回503并验证原因/提示恢复且无自动重放，显式再次确认才产生第二个准确 body。桌面 Chromium 与390px手机4/4，完整 M04-07 E2E 10/10，Web类型检查通过。隔离夹具只验证浏览器交互，不代表真实服务端事务、幂等或生产验收。
