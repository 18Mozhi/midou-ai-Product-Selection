# M08-02 Redis 单实例韧性

## 范围与非目标

ScoutOps 在当前惠州单台服务器上只运行一个由宝塔管理的 Redis。Redis 仍只承担缓存、队列/租约、限流和 SSE 协调；MySQL 是业务与审计事实源。模块不启用 Sentinel、Redis Cluster、副本、备用服务器或负载均衡，也不形成高可用或容量承诺。

生产合同固定为：仅绑定 `127.0.0.1`、protected-mode 开启、AOF `appendonly yes` + `appendfsync everysec`、保留 RDB save 规则、`maxmemory 512mb`、`maxmemory-policy noeviction`、`maxclients 512`。512 MiB 与 512 个连接是当前 16 GiB 单机中为 MySQL、Node、Crawler 和文件处理保留余量的保护上限，不是用户容量结论；最终容量边界只能由 M08-06 实测形成。

## 数据、服务、API 与权限

迁移 `0031_redis_resilience_m08_02` 以 MySQL 5.7/utf8mb4 保存平台级观测、读取审计、request_id 与 trace_id。平台级对象的 organization_id/workspace_id 为空；任何业务 Redis 键仍必须沿用 M00-04 的组织/工作区命名合同。

`evaluateRedisResilience` 对不可用、加载中、AOF/RDB 关闭或失败、无内存上限、非 noeviction、无连接上限、内存/连接越线、拒绝连接与淘汰键失败关闭。`GET /api/v1/platform/operations/redis` 只返回脱敏资源数字和结论，要求 `platform:operate` 并与观测一起写入审计；不返回主机、端口、密码、原始键或队列载荷。

## 页面依据

页面读取并落实 `images-html/01_72_page_concepts/61_平台运营-概览.jpg`、`64_系统监控.jpg`、`69_异常告警.jpg` 与 `images-html/02_high_resolution_core_pages/10_霓虹科技平台驾驶舱_dashboard.png`：深海蓝运维驾驶舱、结论先行、四项资源卡、持久化状态、边界和告警列表；桌面与 390px 均保留文字、数值、时间和恢复动作，状态不只依赖颜色。

## 失败与恢复边界

Redis 不可用时 API readiness 保持失败，依赖 Redis 的新异步操作停止；已持久化的 MySQL 事实、审计和 Outbox 不得被改写为成功。恢复只能由宝塔执行配置备份、有限重启、PING、持久化状态、组织隔离 set/get/TTL/delete、API、Worker 与 Crawler 核验。该恢复不保护整机、磁盘或机房故障。
