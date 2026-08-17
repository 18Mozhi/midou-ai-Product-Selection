# M05-04 SSE 与重放运行及回滚

迁移后在宝塔面板重启唯一的“ai选品”统一后端。内部 API 读取 `REALTIME_POLL_MS`、`REALTIME_HEARTBEAT_MS`、`REALTIME_REPLAY_LIMIT`、`REALTIME_MAX_CONNECTION_SECONDS`、`REALTIME_MAX_CONNECTIONS`。修改后必须重启“ai选品”；反向代理需关闭 `/api/v1/realtime/events` 缓冲并允许连接时间略高于配置的 55 秒。

用合法会话连接并检查 `content-type: text/event-stream`、`retry: 3000`、心跳和递增 id。带最后 id 重连只能收到后续当前接收人事件。409 表示重放窗口超限，刷新通知列表后移除旧游标；503 表示 S0 连接上限，客户端等待重连。不要通过提高连接数宣称多节点容量。

回滚前在宝塔重启或停止“ai选品”以关闭连接，再移除前端 EventSource 和 SSE 路由。无保留事件时执行 `0018d_realtime_sse_m05_04.down.sql`；通知表、Outbox 和审计不回滚。若只回滚 API 代码，保留 realtime_events 不影响 M05-03 通知投影。
