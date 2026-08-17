# M05-04 SSE 与重放架构

M05-03 生成站内通知后，使用 `realtime_events` 保存单调递增 BIGINT 游标和通知最小载荷；`notification_id` 唯一约束保证事件投影可重放。SSE `/api/v1/realtime/events` 在认证和 `notification:read` 授权后，只查询当前 organization_id、workspace_id、recipient_id，支持 `Last-Event-ID` 请求头或 `last_event_id` 查询参数、有限重放、心跳与连接到期重连。

浏览器使用带 HttpOnly 会话 Cookie 的 EventSource，保存最后游标并在 `notification.changed` 时重新读取通知 API；业务事实仍以 API/MySQL 为准，SSE 只发失效提示，不携带敏感字段。重放超过上限在建立流前返回 409，客户端刷新事实后重连；连接上限返回 503。

当前实现明确属于宝塔 S0 单机：Node API 轮询 MySQL 持久事件并维护进程内连接计数，没有宣称多节点广播或 10,000 用户能力。P08 软件完成不扩展这一能力声明。
