# M08-02 Redis 单实例韧性

## 范围与非目标

ScoutOps 在当前惠州单台服务器上只运行一个由宝塔管理的 Redis。Redis 仍只承担缓存、队列/租约、限流和 SSE 协调；MySQL 是业务与审计事实源。模块不启用 Sentinel、Redis Cluster、副本、备用服务器或负载均衡，也不形成高可用或容量承诺。

生产合同固定为：仅绑定 `127.0.0.1`、protected-mode 开启、AOF `appendonly yes` + `appendfsync everysec`、保留 RDB save 规则、`maxmemory 512mb`、`maxmemory-policy noeviction`、`maxclients 512`。512 MiB 与 512 个连接是当前 16 GiB 单机中为 MySQL、Node、Crawler 和文件处理保留余量的保护上限，不是用户容量结论；最终容量边界只能由 M08-06 实测形成。

## 数据、服务、API 与权限

迁移 `0031_redis_resilience_m08_02` 以 MySQL 5.7/utf8mb4 保存平台级观测、读取审计、request_id 与 trace_id。平台级对象的 organization_id/workspace_id 为空；任何业务 Redis 键仍必须沿用 M00-04 的组织/工作区命名合同。

`evaluateRedisResilience` 对不可用、加载中、AOF/RDB 关闭或失败、无内存上限、非 noeviction、无连接上限、内存/连接越线、拒绝连接与淘汰键失败关闭。`GET /api/v1/platform/operations/redis` 只返回脱敏资源数字和结论，要求 `platform:operate` 并与观测一起写入审计；不返回主机、端口、密码、原始键或队列载荷。

运行探针不再等待断线 Redis 的无限重连：每次运维读取创建一个关闭自动重连的短生命周期 Redis 探针连接，成功后读取有界事实并立即关闭，连接失败则立即形成 `available=false` 的有界快照，由同一评估规则返回 `blocked` 并写入 MySQL 观测与审计。该探针不复用 Worker/队列的长连接状态，也不会因共享客户端处于重连中而把已恢复实例继续误报为不可用。MySQL、鉴权或审计依赖失败统一返回 `503 redis_resilience_dependency_unavailable`，错误体保留 request_id/trace_id，且不回显驱动错误、SQL、主机、连接信息或凭证。

响应同时返回 `max_memory_policy` 与实例运行秒数，页面把策略、内存水位和累计 `evicted_keys` 组合为淘汰风险解释。淘汰数是当前实例运行期累计事实，不是当前分钟增量。

键空间热点采用独立的受限采样合同：只执行 `SCAN MATCH scoutops:v1:*`，固定最多收集 128 个键、每轮 `COUNT 32`，并以最多 16 个并发读取 `MEMORY USAGE`。服务端验证 `scoutops:v1:<purpose>:org:<organization>:ws:<workspace>:<resource>` 结构，只聚合为 `cache/queue/rate/sse` 和 `collection_ready/collection_task/other` 固定分类，返回采样键数、字节数、样本内占比、截断和失败计数。原始键、组织/工作区标识、资源原文、值、TTL、哈希和载荷都不进入 DTO 或审计。

该榜单的事实名称是“键空间占用热点”，只代表受限样本的内存占比。当前生产策略固定 `noeviction`，没有可信 LFU 访问频率；页面和 API 均返回 `access_frequency_available=false`，不能把内存占比、最近访问或键数量描述为高频热键。采样失败只使 `keyspace_sample.status=unavailable/partial`，不会把已成功读取的 Redis 持久化、资源和淘汰事实降格为不可用。

## 页面依据

页面落实信号账页的结论先行、四项资源账格、持久化状态、边界和告警列表；不再使用旧深海蓝霓虹驾驶舱。桌面与 390px 均保留文字、数值、时间和恢复动作，状态不只依赖颜色。

刷新链路固定为单飞：同一页面只允许一个在途请求，按钮以 disabled/aria-busy 呈现；每次请求使用同一组前后端关联 ID，15 秒后主动取消。已有成功快照时，刷新中继续显示旧事实；超时、429 或 503 只显示“刷新未完成”通知并保留旧结论。401/403 仍清除旧数据并进入登录失效或无权限状态，避免越权保留。页面卸载会取消在途请求，迟到响应不能覆盖新页面状态。

## 失败与恢复边界

Redis 不可用时 API readiness 保持失败，依赖 Redis 的新异步操作停止；已持久化的 MySQL 事实、审计和 Outbox 不得被改写为成功。恢复只能由宝塔执行配置备份、有限重启、PING、持久化状态、组织隔离 set/get/TTL/delete、API、Worker 与 Crawler 核验。该恢复不保护整机、磁盘或机房故障。

提交 `cb81e04381c8424057c481853bceac749592cc6c` 已在当前惠州单机完成生产验证：Redis 7.4.7 仅监听 `127.0.0.1:6379`，AOF everysec、RDB、512 MiB/noeviction 与 512 连接上限生效；5%/25%/100% 各观察 1,800 秒后收敛到一个 4101 API，4103 停止且 Nginx 无上游池。schema v1 证据 SHA-256 为 `7baf6a349f410431c7c655cf8e5fdda8eda7a5b335e62ee1ecef052dcb56482a`；这只证明单机资源保护与恢复链路，不形成负载均衡、高可用或容量声明。
