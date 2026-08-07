# M00-05 API 基座 Runbook

## 健康与发布检查

`/api/v1/health/live` 只确认进程；`/api/v1/health/ready` 要求 MySQL 与 Redis 均可用。先运行 `npm run build`、`node --test tests/m00-05/api-foundation.test.mjs` 和 `node scripts/verify-api-live.mjs`，再执行 `npm run verify:module -- M00-05`。503 只输出 `dependency_unavailable`、调整提示和 request_id/trace_id。

生产 Node API 只能作为宝塔 Node 项目管理。DB/Redis/构建配置在进程启动时读取，修改后必须在宝塔重启 API。宝塔网站反向代理可用 readiness 做发布检查，但不得把密码、连接 URL 或内部错误写入响应/探针配置。

## 故障与回滚

MySQL 或 Redis 不可用时保留 liveness，readiness 返回 503 并停止新同步流量；在宝塔恢复依赖后重试，不启动面板外替代服务。schema、认证或幂等错误不得通过关闭校验临时放行。

回滚时先恢复上一 API 构建与环境并在宝塔重启，复核 live/ready 和错误信封。确认没有下游幂等记录引用后执行 `0005_m00_05_api_idempotency.down.sql`；回滚迁移前备份，保留操作者、request_id/trace_id 与结果审计。
