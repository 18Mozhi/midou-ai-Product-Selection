# M00-04 Redis 基座 Runbook

## 配置与验证

本地与宝塔受限环境使用 `REDIS_HOST`、`REDIS_PORT`、`REDIS_PASSWORD`、`REDIS_CONNECT_TIMEOUT_MS`。密码不得进入日志、浏览器或 Git。先运行 `npm run build` 与 `node --test tests/m00-04/redis-foundation.test.mjs`，再运行 `node scripts/verify-redis-live.mjs`；真实门禁会创建一个带随机验证组织的 5 秒缓存键，读回后在 `finally` 删除。

完整模块命令：`npm run verify:module -- M00-04`。输出必须包含 request_id/trace_id；连接不可用返回 blocked（退出码 2），不得降级为 passed。

## 宝塔启动、告警与恢复

生产 Redis 只能由宝塔 Redis 服务创建和管理。修改连接配置后，在宝塔重启使用 Redis 的 Node API/Worker/Crawler；M00-04 当前仅库和验收脚本使用，接入运行进程后以对应服务启动时读取为准。不可用时停止依赖 Redis 的新操作，检查宝塔服务状态、端口、密码和日志，再执行 PING、组织隔离 set/get/TTL/delete 验收；禁止用 systemd、独立 PM2 或屏外 Docker Compose 替代。

告警不得包含连接 URL、密码、原始键值或其他组织标识；只记录状态、延迟、模块 ID、request_id、trace_id 和受影响能力。

## 回滚

1. 在宝塔恢复上一构建与上一组受限 Redis 环境变量，并重启受影响项目。
2. 确认无新代码仍使用 `scoutops:v1` 合同后，按具体变更逐键自然过期；不得执行通配删除或 `FLUSHALL`。
3. 若已应用 MySQL 目录迁移且没有下游引用，执行 `0004_m00_04_redis_namespace_catalog.down.sql`。
4. 再运行上一版本的真实连接与组织隔离验收，并保留回滚审计。
