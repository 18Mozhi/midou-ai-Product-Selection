# M08-03 MySQL 5.7 单主韧性 Runbook

## 适用范围

仅处理惠州当前单机、宝塔管理的 MySQL 5.7 单主。禁止创建读副本、负载均衡、备用服务器、systemd 服务、面板外 PM2、宿主机 crontab 或屏外 Compose。

## 核验与处置

1. 在宝塔有限任务中备份当前 MySQL 配置并记录 SHA-256、权限和时间。
2. 读取版本、`read_only`、`log_bin`、`binlog_format`、`binlog_ignore_db`、`innodb_flush_log_at_trx_commit`、`sync_binlog`、主状态和副本状态；不得打印凭证或数据目录。
3. 只有预检通过时，按 manifest 应用 `ROW`、`innodb_flush_log_at_trx_commit=2`、`sync_binlog=1` 及已评审 I/O 基线。`product_scout` 不得被 binlog 排除。
4. 只通过宝塔重启 MySQL，然后核对 API、Worker、Crawler、受限随机读写清理、慢查询/连接/容量水位。
5. 使用现有宝塔备份任务完成同机独立加密目录副本及隔离恢复库验证；RPO 不超过 15 分钟、RTO 不超过 240 分钟、演练不超过 90 天。
6. 生产证据必须与当前提交一致，且明确 `loadBalancingEnabled=false`、`replicaEnabled=false`、`backupServerUsed=false`、`capacityClaim=unverified`。
7. 应用 `0032a_compact_release_write_probe_m08_03` 后，先以业务账号验证新表的一次签名写入和清理；新灰度只统计 `deployment_release_write_samples`。旧表 `deployment_release_write_probes` 作为历史探针证据只读保留，不允许为降低表大小而直接删除。

## 告警

- 连接、数据盘或慢查询达到 warning：停止扩大异步并发并定位增长来源。
- 行锁等待为实例启动后的累计状态；出现非零值时结合宝塔 MySQL 慢查询日志、当前事务和运行线程判断影响，不得仅凭累计值宣称当前阻塞。
- 达到 stop、MySQL 不可用、主状态不可读、持久化合同错误或恢复证据无效：失败关闭，停止新增高成本任务。
- 不得为了通过门禁放宽阈值或缩短规定观察。

## 回滚

异常时立即在宝塔恢复本次操作前的精确配置备份，并通过宝塔回滚重启 MySQL；随后核对单主、主状态、API/Worker/Crawler、随机读写清理和 M07-04 恢复证据。若异常仅来自紧凑探针迁移，先回滚 API，再执行 `0032a_compact_release_write_probe_m08_03.down.sql`；旧探针表仍可供上一版本使用。保留失败 `request_id`、`trace_id`、配置摘要与重启日志，不删除真实失败记录。
