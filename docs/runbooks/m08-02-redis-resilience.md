# M08-02 Redis 单实例韧性 Runbook

## P67 读取状态语义（批64）

首次读取/错误区和保留快照后的刷新失败区均以关联标题命名，并在读取中标明`aria-busy`；这只改善辅助技术语义，不改变GET、15秒、单飞、权限、编号或快照规则。复验`node --test tests/unit/redis-read-regions.test.mjs tests/unit/redis-read-focus.test.mjs tests/unit/redis-trace-ownership.test.mjs tests/unit/redis-page-preview.test.mjs tests/unit/ui-phase2-technical-copy.test.mjs`、`node scripts/verify-redis-read-focus.mjs`、`node scripts/verify-redis-trace-ownership.mjs --capture-review r3`与默认页面验证器。r3审核图为`output/playwright/p67-trace-ownership-r3/index.html`，仅本地替身，不证明真实读屏、权限、Redis或审计。无需重启或环境调整。

## P67 读取追踪修正（批62）

快照读取ID与本次失败读取ID分开；401/403清事实时清旧快照ID，null成功响应显示“本次读取追踪”。每处复制使用自己披露的编号，不重算/生成观测。复验`node --test tests/unit/redis-trace-ownership.test.mjs tests/unit/redis-page-preview.test.mjs tests/unit/ui-phase2-technical-copy.test.mjs`、`node scripts/verify-redis-trace-ownership.mjs`与默认页面验证器。r2审核图在`output/playwright/p67-trace-ownership-r2/index.html`，本地替身不证明真实剪贴板或审计。本轮未部署，不需要重启；未来正式更新静态构建后浏览器重新加载即可，无Redis/后端/env改动。完整保活和真实权限仍待验。

## P67 重试焦点修正（批63）

重试按钮因读取开始而移除时，仅把该按钮本身的键盘焦点转交顶部刷新按钮；用户已移焦、隐藏、断开或inert节点不转交。顶部等待按钮使用`aria-disabled`和`aria-busy`，仍可聚焦；既有单飞守卫拒绝重复请求。`node scripts/verify-redis-read-focus.mjs`使用本地读取替身验证，不证明真实权限或审计。r1审核图在`output/playwright/p67-read-focus-r1/index.html`。无服务重启或环境调整。

## P67 C 审核边界（批61）

最新 r3：`output/playwright/p67-page-composition-r3/index.html`，30图/173来源；仅修截图避让固定导航与超长区域整页取景，没有改运行合同。手机持久化 r2 区域已批准，两个采样异常区域仍待审，原 r1/r2 留作对照。

实际 Vue 审核仅由 `scripts/lib/redis-page-preview.mjs` 插件加载，不进入生产构建。`node scripts/verify-redis-page-preview.mjs` 使用37组本地惰性样例，不访问真实Redis/MySQL；新增26图在 `output/playwright/p67-page-composition-r2/index.html`，r1保留修订对照。首次失败、完整交互/保活、真实权限/恢复及生产仍待验。复验不需配置或重启；`--capture-review rN` 只能新建审核目录。扩展验证存在旧风格文件名与历史外壳指纹断言失败，未提交部署。详见 `design-plans/ui-phase-2-2026-09-07/P67-PAGE-COMPOSITION-BATCH61.md`。

## 配置与门禁

应用侧水位来自 `REDIS_MEMORY_WARNING_PERCENT`、`REDIS_MEMORY_STOP_PERCENT`、`REDIS_CONNECTION_WARNING_PERCENT`、`REDIS_CONNECTION_STOP_PERCENT`；warning 必须小于 stop。生产证据文件由 `REDIS_RESILIENCE_PRODUCTION_EVIDENCE_FILE` 指向忽略目录，最长有效期由 `REDIS_RESILIENCE_EVIDENCE_MAX_AGE_MINUTES` 控制。修改后在宝塔重启 Node API；真实密码只在宝塔受限环境。

先执行 `npm run build`、`node --test tests/m08-02/redis-single-instance-resilience.test.mjs`、`node scripts/verify-redis-resilience-production.mjs --preflight`。生产配置和恢复证据签发后再执行 `node scripts/verify-redis-resilience-production.mjs --production` 与 `npm run verify:module -- M08-02`。

页面回归还必须验证：首屏只产生一组观测/查看/审计；连续点击只保留一个在途请求；刷新期间旧快照可读；15 秒超时、429 与 503 保留旧快照并显示关联 request_id；401/403 不保留旧数据。Redis 断线应在一次请求内返回 `200/blocked` 的脱敏不可用快照，MySQL/鉴权/审计依赖失败应返回 JSON `503 redis_resilience_dependency_unavailable`，不得返回空体 500。

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
- 若页面刷新超过 15 秒仍无结果，先保存 request_id 并在宝塔查看 Node API/MySQL/Redis 日志；不得连续点击制造重复审计。修复后的页面会在 15 秒停止当前浏览器请求并保留最后一次成功事实，服务端迟到事务仍须由 request_id 核对，不能把浏览器取消等同于数据库回滚。

## 回滚

1. 保留失败证据，不执行 `FLUSHALL`、通配删除或手工清除来源不明的键。
2. 在宝塔有限任务恢复变更前的 `redis.conf` 精确备份并核对 SHA-256。
3. 只通过宝塔重启 Redis；核对 PING、持久化、隔离读写清理、API、Worker 和 Crawler。
4. 应用回滚到上一构建并在宝塔重启受影响项目；数据库迁移已有观测时保留表，不用删审计掩盖失败。确认没有下游引用时才执行 `0031_redis_resilience_m08_02.down.sql`。
