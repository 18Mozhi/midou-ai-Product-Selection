# M08-01 宝塔单机运行手册

## 固定边界

- 拓扑：`single_host`
- 主机数：1
- 负载均衡：关闭
- 备用服务器：不使用
- 生产管理：只允许宝塔
- 容量结论：`unverified`

## 宝塔配置

在当前 Node API 项目的受限环境中配置：

```text
RUNTIME_TOPOLOGY_MODE=single_host
RUNTIME_NODE_ID=api-primary
RUNTIME_HOST_ID=huizhou-single-host
RUNTIME_NODE_REGION=惠州
RUNTIME_NODE_ZONE=primary
RUNTIME_NODE_HEARTBEAT_MS=30000
RUNTIME_NODE_STALE_AFTER_SECONDS=90
RUNTIME_HEALTH_PROBE_INTERVAL_MS=30000
RUNTIME_HEALTH_PROBE_TIMEOUT_MS=5000
RUNTIME_HEALTH_PROBE_WINDOW_MINUTES=60
RUNTIME_HEALTH_PROBE_RETENTION_HOURS=72
SINGLE_SERVER_PRODUCTION_EVIDENCE_FILE=./.artifacts/verification/m08-01-single-server-production-evidence.json
```

修改后必须通过宝塔重启 Node API。不得用 systemd、面板外 PM2、crontab 或 Docker Compose 创建生产进程。

## 验收步骤

1. 先以 `product_scout` 业务账号依次应用 MySQL 5.7 迁移 `0062_runtime_process_restart_observations.up.sql`、`0063_runtime_health_endpoint_probes.up.sql`，再在宝塔确认网站、Node API、Node Worker、Python Crawler、MySQL、Redis 均属于当前主机且状态正常。
2. 确认宝塔网站只反代本机一个稳定 API 上游，后端端口不向公网开放；SSE 关闭代理缓冲。
3. 请求 `/api/v1/health/live`、`/api/v1/health/ready` 和 `/api/v1/health/nodes`。
4. 用具有 `platform:operate` 的账号读取 `/api/v1/platform/operations/topology`，确认审计写入。
5. 由宝塔有限任务签发 schema v1 的生产证据，文件权限保持 0600，不写入 Git。
6. 在运行拓扑确认每类队列显示基础/有效优先级、实际调度延迟、老化进度、独立并发、超时与重试策略；让隔离队列等待至最大老化增益后，页面应显示“饥饿风险”。模拟失败时应出现队列熔断或疑似卡死告警，状态文件写入失败不得增加业务失败计数。
7. 让隔离 Worker 返回一个带稳定 `error_code` 和白名单业务对象 ID 的失败结果，确认最近一分钟告警显示精确队列、对象类型和可用详情入口；技术详情显示错误码，状态文件和 API 不得出现原始 payload、Cookie、Token 或任意外部地址。没有对象 ID 的失败只显示队列。
8. 至少间隔一个五分钟桶读取两次运行拓扑，确认 API/Worker 的 24 小时趋势显示真实观测数和新增重启数；监督器重新启动后必须显示计数器重置，而不是负增量。
9. 等待至少两个连续探测周期，确认 `live`、`ready`、`available` 各自显示真实样本数、超时数与 P50/P95/P99。隔离验证中让一个请求超过超时门，确认只新增超时样本且页面不出现响应正文、主机或凭证。
10. 执行 `node scripts/verify-single-server-production.mjs --production` 和 `npm run verify:module -- M08-01`。

当前生产验收已通过：构建 `b55f7f814d7153e6a4a7958eb41a9bf6ff1e60e8`、证据 SHA-256 `0c7cd53311f9c778407e699747bc8d9b9d27b1fad18635fee1c05ff54a74e13c`、run_id/trace_id `fa76e44f-53d7-49da-8884-bac921aad580`。永久路由为本机 4101 单上游，4103 候选已停止。

视觉验收由宝塔有限任务在 Linux Chromium 上执行：桌面与 390px 两个项目的四张基线先更新、再无更新复跑，两轮均为 4/4 通过；取回基线后已恢复原宝塔任务并删除临时源码、脚本和归档。

## 故障演练

- 暂停验收隔离实例的心跳，确认超过阈值后为 stale/503，再恢复并回到 ready。
- 使用错误主机 ID 的隔离探针，确认返回 `api_host_identity_mismatch`。
- 验证公开健康响应不含 node_id、host_id、build_sha、路径或凭证。
- 验证 Nginx 仍为单上游，不出现 upstream 池、权重、hash 或多主机配置。
- 将隔离测试队列保持等待，确认有效优先级按快照中的老化间隔增长；达到最大老化增益且实际调度延迟仍大于零时出现饥饿风险，任务开始运行后不再把该队列标为饥饿。
- 让采集任务处理返回 `source_changed` 与真实任务 ID，确认告警关联“采集任务”队列并直达该任务；再返回无任务 ID 的同类错误，确认页面不复用旧对象冒充本次关联。

## 回滚

1. 只通过宝塔把 Node API 切回已验证版本。
2. 保持 `RUNTIME_TOPOLOGY_MODE=single_host`，不得回写 S1/S2 或多主机值。
3. 让宝塔网站继续只反代本机稳定 API，验证 TLS、ready 和 SSE 重连。
4. 保留运行节点、心跳、平台审计与生产证据。
5. 旧版不读取 `runtime_process_restart_observations` 时可先保留新表；只有确认不再需要重启趋势历史后才执行 `0062_runtime_process_restart_observations.down.sql`。`0030` down 迁移只用于完全撤销且没有下游依赖的情况；执行前必须完成备份，并由宝塔有限任务运行。
6. 旧版不读取 `runtime_health_endpoint_probes` 时可先保留样本表；只有明确放弃连续健康历史并完成备份后才执行 `0063_runtime_health_endpoint_probes.down.sql`。
