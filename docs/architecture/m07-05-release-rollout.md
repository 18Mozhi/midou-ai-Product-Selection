# M07-05 发布与回滚架构

## 范围与事实边界

M07-05 在惠州当前 S0 主机内使用两个宝塔 Node 项目：`product-scout-api` 的 4101 端口是发布槽 A，`product-scout-api-canary` 的 4103 端口是发布槽 B。首次发布以 4101 为稳定回滚目标、4103 为候选；发布成功后两槽角色互换，下一版本部署到非当前槽，因此“稳定”始终指上一已签发构建而不是固定端口。两者只绑定 `127.0.0.1`，公网仍只有宝塔网站的 80/443。它不是备用服务器、多节点、高可用或 10,000 用户架构；两个进程共享同一主机、MySQL、Redis 和文件存储，主机故障会同时影响它们。

`deployment_releases` 保留构建 SHA、配置指纹、迁移版本与发布状态；`deployment_release_gates` 按当前 release 记录 preflight、备份、迁移、5%、25%、100%、自动停止与回滚事实；`deployment_release_gate_events` 是追加式审计。`deployment_release_write_probes` 保存每个候选写样本的 release、build、sample、nonce 哈希、request_id、trace_id 与时间。GET `/api/v1/platform/operations/releases` 只允许 `platform:operate`，只返回脱敏发布事实，不暴露主机配置、面板凭证、日志路径或元数据。

真实 MySQL 验收使用 MySQL `UTC_TIMESTAMP(3)` 的执行时刻创建唯一 release 探针，使它不受宝塔任务进程本地时区影响，并在验收事务内成为当前发布，再验证 verified → blocked 的失败关闭转换；固定历史时间或把 JavaScript 本地时间直接写入排序字段会被已有生产发布遮蔽，禁止使用。验收结束无论成功或失败都按唯一 actor/release 清理用户、写探针、gate、release 和审计探针，不改真实发布记录。

Playwright 默认继续使用本地开发端口 4101/5173；宝塔模块验收必须通过 `PLAYWRIGHT_API_PORT`、`PLAYWRIGHT_WEB_PORT` 和同值 `APP_PORT` 选择未占用的隔离端口。临时 API/Web 只服务本次浏览器门，不能复用生产 API、不能注册为生产服务，并由 Playwright 在命令结束时关闭。

## 流量、指标与失败关闭

宝塔手工发布任务执行 `scripts/run-baota-release-rollout.mjs`。任务将候选构建身份与 `/health/version` 对齐，验证最近 M07-04 隔离恢复及 `0026`、`0027` 迁移，然后由宝塔 Nginx 以 `$request_id` 分流 5% → 25% → 100%。生产每阶段至少 1,800 秒。默认 1 秒采样提高低流量 S0 的候选 P95 样本分辨率，不能缩短观察时间、改变分流比例或放宽停止阈值。真实采样来自 Nginx `mdzx_upstream_timing` 日志并按候选上游地址筛选；读 P95 只使用 `/api/v1/health/live` 的 GET/HEAD，写 P95 与持久化一致性只使用 `/api/v1/platform/operations/releases/write-probe` 的写请求，5xx 比例仍覆盖阶段内全部候选请求。任务同时发送这两个安全探针，弥补 S0 无客户请求时的最低样本，但不把探针数量冒充用户流量。

写探针只接受 `RELEASE_PROBE_SIGNING_KEY` 生成的 HMAC-SHA256 签名。代理安全的 canonical payload 固定覆盖时间戳、唯一 nonce、release_id 和 sample_id；宝塔 Nginx 会生成 32 位十六进制 `$request_id` 并覆盖 `X-Request-ID`，所以 request_id/trace_id 不参与签名，但 API 必须接受 UUID 或该受限代理格式并保存实际传入的追踪字段。默认只接受 60 秒时间窗口。API 不接收浏览器会话或 `platform:operate` 作为替代授权，也不保存签名或原始 nonce。每个有效样本只执行一条带唯一键的 InnoDB autocommit INSERT，一次提交同时形成持久化与审计事实。每阶段候选写路由必须全部返回 202，且候选构建新增的持久化样本数必须与候选 Nginx 写样本数完全一致；401、遗漏写入或数量不一致均失败关闭。这样测量真实 MySQL 写提交，同时避免用密码重置业务链的三次独立提交放大同机磁盘周期性 fsync 延迟。当前单机共享 MySQL 经明确授权采用 `innodb_flush_log_at_trx_commit=2`、`sync_binlog=1`，并通过 `binlog-ignore-db=product_scout` 排除 ScoutOps binlog；mysqld 进程故障仍由操作系统页缓存保留 redo，但主机或操作系统故障最多可能丢失约 1 秒已提交事务。现有本地账号 `product_scout@127.0.0.1` 经明确授权增加全局只读 `REPLICATION CLIENT`，仅用于发布任务执行 `SHOW MASTER STATUS` 验证该合同，不授予 `SUPER`。600ms 门槛保持不变，发布任务必须在 preflight 和生产证据中验证该合同，配置漂移时失败关闭。

任一阶段候选读或写样本不足、5xx 不低于 1%、读 P95 高于 300ms、写 P95 高于 600ms、或真实 MySQL 待处理队列延迟高于 60 秒，任务立即将 Nginx 全量指回本次 `RELEASE_STABLE_API_PORT`，写入 `automatic_stop` 和 `rollback` 审计并把 release 标记为 `rolled_back`。缺指标和空值不能按 0 通过。成功后 100% 仍指向候选槽，下一次发布将本次候选槽作为稳定端口、另一个槽作为新候选。

## 数据迁移与回滚

迁移 `0026_release_rollout_m07_05.up.sql` 与 `0027_release_write_probe_m07_05.up.sql` 兼容 MySQL 5.7/utf8mb4。应用回滚不删除 gate/event/probe 审计。只有确认无发布记录依赖后才能先执行 `0027`、再执行 `0026` 的 down migration；执行前必须先导出发布审计。回滚配置时由宝塔任务写入 0% candidate 分流、执行 Nginx `-t` 后由宝塔 Nginx reload，不使用 systemd、独立 PM2、宿主 crontab 或面板外服务。
