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
SINGLE_SERVER_PRODUCTION_EVIDENCE_FILE=./.artifacts/verification/m08-01-single-server-production-evidence.json
```

修改后必须通过宝塔重启 Node API。不得用 systemd、面板外 PM2、crontab 或 Docker Compose 创建生产进程。

## 验收步骤

1. 在宝塔确认网站、Node API、Node Worker、Python Crawler、MySQL、Redis 均属于当前主机且状态正常。
2. 确认宝塔网站只反代本机一个稳定 API 上游，后端端口不向公网开放；SSE 关闭代理缓冲。
3. 请求 `/api/v1/health/live`、`/api/v1/health/ready` 和 `/api/v1/health/nodes`。
4. 用具有 `platform:operate` 的账号读取 `/api/v1/platform/operations/topology`，确认审计写入。
5. 由宝塔有限任务签发 schema v1 的生产证据，文件权限保持 0600，不写入 Git。
6. 执行 `node scripts/verify-single-server-production.mjs --production` 和 `npm run verify:module -- M08-01`。

视觉验收由宝塔有限任务在 Linux Chromium 上执行：桌面与 390px 两个项目的四张基线先更新、再无更新复跑，两轮均为 4/4 通过；取回基线后已恢复原宝塔任务并删除临时源码、脚本和归档。

## 故障演练

- 暂停验收隔离实例的心跳，确认超过阈值后为 stale/503，再恢复并回到 ready。
- 使用错误主机 ID 的隔离探针，确认返回 `api_host_identity_mismatch`。
- 验证公开健康响应不含 node_id、host_id、build_sha、路径或凭证。
- 验证 Nginx 仍为单上游，不出现 upstream 池、权重、hash 或多主机配置。

## 回滚

1. 只通过宝塔把 Node API 切回已验证版本。
2. 保持 `RUNTIME_TOPOLOGY_MODE=single_host`，不得回写 S1/S2 或多主机值。
3. 让宝塔网站继续只反代本机稳定 API，验证 TLS、ready 和 SSE 重连。
4. 保留运行节点、心跳、平台审计与生产证据。
5. `0030` down 迁移只用于完全撤销且没有下游依赖的情况；执行前必须完成备份，并由宝塔有限任务运行。
