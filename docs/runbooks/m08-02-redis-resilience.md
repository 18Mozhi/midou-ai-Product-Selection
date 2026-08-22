# M08-02 Redis 单实例韧性 Runbook

## 配置与门禁

应用侧水位来自 `REDIS_MEMORY_WARNING_PERCENT`、`REDIS_MEMORY_STOP_PERCENT`、`REDIS_CONNECTION_WARNING_PERCENT`、`REDIS_CONNECTION_STOP_PERCENT`；warning 必须小于 stop。生产证据文件由 `REDIS_RESILIENCE_PRODUCTION_EVIDENCE_FILE` 指向忽略目录，最长有效期由 `REDIS_RESILIENCE_EVIDENCE_MAX_AGE_MINUTES` 控制。修改后在宝塔重启 Node API；真实密码只在宝塔受限环境。

先执行 `npm run build`、`node --test tests/m08-02/redis-single-instance-resilience.test.mjs`、`node scripts/verify-redis-resilience-production.mjs --preflight`。生产配置和恢复证据签发后再执行 `node scripts/verify-redis-resilience-production.mjs --production` 与 `npm run verify:module -- M08-02`。

## 宝塔变更与重启

1. 在宝塔有限任务中确认 Redis 只监听本机、当前服务由宝塔管理，并保存 `/www/server/redis/redis.conf` 的权限受限备份与 SHA-256。
2. 精确设置 `appendonly yes`、`appendfsync everysec`、保留现有 RDB save 规则、`maxmemory 512mb`、`maxmemory-policy noeviction`、`maxclients 512`；不得修改 requirepass、bind 或无关配置。
3. 先执行 Redis 配置解析检查，再仅通过宝塔重启 Redis。异常时立即恢复备份并由宝塔回滚重启。
4. 重启后验证 PING、AOF/RDB 状态、上限、拒绝连接/淘汰键、随机组织范围 set/get/TTL/delete 清理、API readiness、Worker 与 Crawler 健康。
5. 生产证据只记录脱敏状态、数字、构建身份、时间与 request_id/trace_id，权限 0600；不得记录密码、连接 URL、实际业务键或载荷。

当前已验证基线为提交 `cb81e04381c8424057c481853bceac749592cc6c`、单一 4101 API、停止的 4103 候选及 Redis 生产证据 SHA-256 `7baf6a349f410431c7c655cf8e5fdda8eda7a5b335e62ee1ecef052dcb56482a`。后续调整 Redis 配置、应用构建或运行拓扑后必须重新签发同提交证据并重跑 `npm run verify:module -- M08-02`；不得把发布期临时灰度保留为负载均衡。

## 告警与降载

- 内存或连接达到 75%：warning，检查缓存增长、队列积压、SSE 与连接泄漏。
- 达到 90%、出现拒绝连接、淘汰键、AOF/RDB 错误或加载未完成：blocked，停止新异步任务并通过宝塔恢复。
- 页面“淘汰键”是当前实例运行期累计值，不是当前分钟增量；结合实例运行天数与内存水位判断影响。“键空间占用热点”只对 `scoutops:v1:*` 最多采样 128 个键，以 `MEMORY USAGE` 汇总固定用途/资源类别；不得手工运行无界 `KEYS *`，也不得从采样内存占比推断访问频率。`partial` 表示部分键在采样期间已过期或读取失败，`unavailable` 表示 SCAN/采样命令不可用；两者不覆盖独立的持久化、内存水位和淘汰事实。
- 页面和审计不应出现 Redis 原始键、组织/工作区标识、TTL、键哈希或值。若发现这些字段，立即停止发布并回滚应用包；无需修改 Redis 配置或清理任何业务键。
- Redis 恢复不等于任务自动成功；Worker 依赖 MySQL 状态、租约和幂等规则继续处理。

## 回滚

1. 保留失败证据，不执行 `FLUSHALL`、通配删除或手工清除来源不明的键。
2. 在宝塔有限任务恢复变更前的 `redis.conf` 精确备份并核对 SHA-256。
3. 只通过宝塔重启 Redis；核对 PING、持久化、隔离读写清理、API、Worker 和 Crawler。
4. 应用回滚到上一构建并在宝塔重启受影响项目；数据库迁移已有观测时保留表，不用删审计掩盖失败。确认没有下游引用时才执行 `0031_redis_resilience_m08_02.down.sql`。
