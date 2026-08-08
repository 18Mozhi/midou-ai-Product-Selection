# M07-05 发布与回滚架构

## 范围与事实边界

M07-05 在惠州当前 S0 主机内使用两个宝塔 Node 项目：`product-scout-api` 的 4101 端口是发布槽 A，`product-scout-api-canary` 的 4103 端口是发布槽 B。首次发布以 4101 为稳定回滚目标、4103 为候选；发布成功后两槽角色互换，下一版本部署到非当前槽，因此“稳定”始终指上一已签发构建而不是固定端口。两者只绑定 `127.0.0.1`，公网仍只有宝塔网站的 80/443。它不是备用服务器、多节点、高可用或 10,000 用户架构；两个进程共享同一主机、MySQL、Redis 和文件存储，主机故障会同时影响它们。

`deployment_releases` 保留构建 SHA、配置指纹、迁移版本与发布状态；`deployment_release_gates` 按当前 release 记录 preflight、备份、迁移、5%、25%、100%、自动停止与回滚事实；`deployment_release_gate_events` 是追加式审计。GET `/api/v1/platform/operations/releases` 只允许 `platform:operate`，只返回脱敏发布事实，不暴露主机配置、面板凭证、日志路径或元数据。

## 流量、指标与失败关闭

宝塔手工发布任务执行 `scripts/run-baota-release-rollout.mjs`。任务将候选构建身份与 `/health/version` 对齐，验证最近 M07-04 隔离恢复和 `0026` 迁移，然后由宝塔 Nginx 以 `$request_id` 分流 5% → 25% → 100%。生产每阶段至少 1,800 秒。真实采样来自 Nginx `mdzx_upstream_timing` 日志并按候选上游地址筛选；读样本为 GET/HEAD，写样本为 POST/PUT/PATCH/DELETE。任务同时发送安全的 live 读探针与枚举安全的不存在账号密码重置写探针，弥补 S0 无客户请求时的最低样本，但不把探针数量冒充用户流量。

任一阶段候选读或写样本不足、5xx 不低于 1%、读 P95 高于 300ms、写 P95 高于 600ms、或真实 MySQL 待处理队列延迟高于 60 秒，任务立即将 Nginx 全量指回本次 `RELEASE_STABLE_API_PORT`，写入 `automatic_stop` 和 `rollback` 审计并把 release 标记为 `rolled_back`。缺指标和空值不能按 0 通过。成功后 100% 仍指向候选槽，下一次发布将本次候选槽作为稳定端口、另一个槽作为新候选。

## 数据迁移与回滚

迁移 `0026_release_rollout_m07_05.up.sql` 兼容 MySQL 5.7/utf8mb4。应用回滚不删除 gate/event 审计。只有确认无发布记录依赖后才能执行 down migration；执行前必须先导出发布审计。回滚配置时由宝塔任务写入 0% candidate 分流、执行 Nginx `-t` 后由宝塔 Nginx reload，不使用 systemd、独立 PM2、宿主 crontab 或面板外服务。
