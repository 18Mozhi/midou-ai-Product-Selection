# M05-04 SSE 与重放架构

M05-03 生成站内通知后，使用 `realtime_events` 保存单调递增 BIGINT 游标和通知最小载荷；`notification_id` 唯一约束保证事件投影可重放。SSE `/api/v1/realtime/events` 在认证和 `notification:read` 授权后，只查询当前 organization_id、workspace_id、recipient_id，支持 `Last-Event-ID` 请求头或 `last_event_id` 查询参数、有限重放、心跳与连接到期重连。

浏览器使用带 HttpOnly 会话 Cookie 的 EventSource，保存最后游标并在 `notification.changed` 时重新读取通知 API；业务事实仍以 API/MySQL 为准，SSE 只发失效提示，不携带敏感字段。重放超过上限在建立流前返回 409，客户端刷新事实后重连；连接上限返回 503。

浏览器把 `open/error` 观测限定记录在当前标签页的 `sessionStorage`：首次进入重连状态时计一次重连，并立即重新读取通知事实作为一次降级轮询；同一重连阶段的重复 `error` 不重复累计，下一次 `open` 后才允许记录新的重连。系统状态页展示连接事件中的重连比例和降级轮询次数，并明确该口径不代表全站、其他标签页或其他用户。指标不上传后端、不写 MySQL，也不包含通知内容、身份或请求标识。

当前实现明确属于宝塔 S0 单机：Node API 轮询 MySQL 持久事件并维护进程内连接计数，没有宣称多节点广播或 10,000 用户能力。P08 软件完成不扩展这一能力声明。
