# M08-01 S0 单机运行基线

## 范围

ScoutOps 长期只运行在当前惠州单台服务器上，所有生产对象继续由宝塔管理。M08-01 提供当前 Node API 的稳定身份、API 与 Worker 分层健康、统一 Worker 队列调度、受 `platform:operate` 保护的审计运维视图，以及宝塔单上游 Nginx 的生产证据门。

本模块不启用负载均衡、不创建备用服务器、不把同机候选发布槽当成第二节点，也不声明多节点、高可用或 10,000 用户能力。`capacity_claim` 固定为 `unverified`。

## 运行合同

1. 宝塔 Node API 使用稳定的 `RUNTIME_NODE_ID` 和 `RUNTIME_HOST_ID`，启动后写入 `runtime_nodes` 与追加心跳。
2. 健康判定只接受配置中的当前节点和当前主机；历史节点、同机候选槽或不同主机身份不能替代它。
3. 心跳过期、节点停止、身份不匹配或没有记录时，`GET /api/v1/health/nodes` 返回 503；ready 时返回 200。
4. 公开健康接口只返回状态和计数，不返回节点、主机、构建或内部端口。
5. `GET /api/v1/platform/operations/topology` 要求 `platform:operate`，读取同步写入 `runtime_topology_views` 和平台审计。
6. API、Worker、Crawler、MySQL、Redis 与文件目录保持本机私有；公网只通过宝塔网站 Nginx 进入。
7. `/health/live`、`/health/ready`、`/health/available` 分别表示进程存活、同步依赖就绪、后台业务可处理；三者不得相互替代。
8. Worker 的所有处理器注册到同一个优先级调度器。调度器执行全局并发配额，积压超过可用槽位时形成背压，并将等待数、最长延迟、一分钟失败率和队列摘要原子写入受限运行目录。
9. Worker 调度心跳过期或停止时业务可用性失败关闭；连续重启、背压和最近失败进入运维告警，但不会把任务载荷、Cookie、Token 或原始错误对象写入状态文件。

## 数据与兼容

`0030_load_balancing_m08_01.up.sql` 已在生产 MySQL 5.7 执行，文件名和校验和作为历史事实保持不变。运行节点、心跳和读取审计表继续使用；其中 `load_balancer_observations` 为停用兼容表，单机运行代码不再读取或写入它。不得为了改名重写已执行迁移。

## 失败和回滚

- Node API 心跳停止：健康门变为 stale/503，在宝塔检查项目和日志后恢复。
- Worker 调度心跳过期：`/health/available` 返回 503；在宝塔检查统一 Node 后端和 `/www/wwwroot/ai选品/runtime/worker-scheduler.json`，不得另起 Worker 绕过并发门。
- 队列背压：先按优先级下钻失败队列和依赖；只有确认 CPU、内存、磁盘及站点配额允许后才调整 `WORKER_MAX_CONCURRENCY`。
- 主机身份错误：健康门变为 blocked，修复宝塔受限环境中的稳定 ID 后重启 Node API。
- Nginx/TLS 失败：生产证据不得签发；只通过宝塔修复网站配置。
- 应用回滚：在宝塔切回已验证版本并保留心跳、审计和证据记录；数据库 down 迁移仅在确认没有下游依赖且完成备份后执行。

## 明确限制

单机运行门通过只证明当前服务器和当前 API 可用，不保护整机、磁盘、网络或机房故障。停机恢复依赖宝塔重启和现有同机加密恢复能力。

## 生产验收

提交 `b55f7f814d7153e6a4a7958eb41a9bf6ff1e60e8` 已在当前惠州单机完成 5%/25%/100% 各 1,800 秒观察；三段错误率和异步滞后均为 0。晋级后公网只通过宝塔 Nginx 的本机 4101 单上游进入，4103 候选已由宝塔停止。schema v1 生产证据 SHA-256 为 `0c7cd53311f9c778407e699747bc8d9b9d27b1fad18635fee1c05ff54a74e13c`，模块验收 run_id/trace_id 为 `fa76e44f-53d7-49da-8884-bac921aad580`；容量结论仍为 `unverified`。
