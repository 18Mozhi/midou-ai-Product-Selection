# M06-05 宝塔运维与回滚

1. 在宝塔备份 MySQL 后执行 `0023_open_platform_m06_05.up.sql`。
2. 在宝塔 Node API 与 Node Worker 项目设置 `OPEN_API_*`、`WEBHOOK_DELIVERY_*`；两者必须使用同一 `CREDENTIALS_MASTER_KEY` 和 `CREDENTIALS_MASTER_KEY_VERSION`。保存后重启 API 与 Worker，配置不是动态读取。
3. Web 站点反向代理需同时放行 `/api/v1` 与 `/open/v1` 到同一 Node API；不得新增面板外服务。
4. 用平台安全管理员访问 `/platform-admin/open-platform`。创建/轮换密钥后立即保存一次性明文；日志和工单只记录 Client 前缀或 Webhook 指纹。
5. 调用 `/open/v1/status` 时发送 `Authorization: Bearer <secret>`、当前 Unix 秒 `X-ScoutOps-Timestamp` 和每请求唯一 nonce。收到 409 时不得复用 nonce；429 按分钟窗口退避。
6. 在宝塔 Worker 日志按 request_id/trace_id 排查投递；死信只能从页面携带原因重放。目标 DNS 解析到任何私网地址都会被阻止。

调节：默认 Client 有效期 90 天、配额 60/min（最大 1000/min）、时间容差 300 秒、nonce 保留 600 秒、投递轮询 2000ms、lease 60 秒、超时 10000ms。修改后必须重启对应宝塔 Node 项目。

回滚：先停止开放入口和 Worker 投递，回退 Web/API/Worker；确认无需保留 Client、Webhook、usage 与投递审计后，执行 `0023_open_platform_m06_05.down.sql`。该 down 会删除 M06-05 表，属于数据删除操作，必须先导出审计与死信证据。若需保留历史，只回退代码并停用端点，不执行 down。
