# M08-01 S0 单机运行基线

## 范围

ScoutOps 长期只运行在当前惠州单台服务器上，所有生产对象继续由宝塔管理。M08-01 提供当前 Node API 的稳定身份、心跳、失败关闭健康接口、受 `platform:operate` 保护的审计运维视图，以及宝塔单上游 Nginx 的生产证据门。

本模块不启用负载均衡、不创建备用服务器、不把同机候选发布槽当成第二节点，也不声明多节点、高可用或 10,000 用户能力。`capacity_claim` 固定为 `unverified`。

## 运行合同

1. 宝塔 Node API 使用稳定的 `RUNTIME_NODE_ID` 和 `RUNTIME_HOST_ID`，启动后写入 `runtime_nodes` 与追加心跳。
2. 健康判定只接受配置中的当前节点和当前主机；历史节点、同机候选槽或不同主机身份不能替代它。
3. 心跳过期、节点停止、身份不匹配或没有记录时，`GET /api/v1/health/nodes` 返回 503；ready 时返回 200。
4. 公开健康接口只返回状态和计数，不返回节点、主机、构建或内部端口。
5. `GET /api/v1/platform/operations/topology` 要求 `platform:operate`，读取同步写入 `runtime_topology_views` 和平台审计。
6. API、Worker、Crawler、MySQL、Redis 与文件目录保持本机私有；公网只通过宝塔网站 Nginx 进入。

## 数据与兼容

`0030_load_balancing_m08_01.up.sql` 已在生产 MySQL 5.7 执行，文件名和校验和作为历史事实保持不变。运行节点、心跳和读取审计表继续使用；其中 `load_balancer_observations` 为停用兼容表，单机运行代码不再读取或写入它。不得为了改名重写已执行迁移。

## 失败和回滚

- Node API 心跳停止：健康门变为 stale/503，在宝塔检查项目和日志后恢复。
- 主机身份错误：健康门变为 blocked，修复宝塔受限环境中的稳定 ID 后重启 Node API。
- Nginx/TLS 失败：生产证据不得签发；只通过宝塔修复网站配置。
- 应用回滚：在宝塔切回已验证版本并保留心跳、审计和证据记录；数据库 down 迁移仅在确认没有下游依赖且完成备份后执行。

## 明确限制

单机运行门通过只证明当前服务器和当前 API 可用，不保护整机、磁盘、网络或机房故障。停机恢复依赖宝塔重启和现有同机加密恢复能力。
