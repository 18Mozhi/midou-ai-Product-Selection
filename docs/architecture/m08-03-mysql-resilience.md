# M08-03 MySQL 5.7 单主韧性架构

M08-03 只覆盖惠州当前单机上的一个宝塔 MySQL 5.7 主实例。系统不建设读副本、负载均衡或备用服务器，也不据此给出容量承诺。MySQL 继续是业务事实源；API 读取全局变量、全局状态、主状态、同机数据文件系统容量及 M07-04 恢复演练记录，输出脱敏的 `single_primary` 结论。

页面布局依据 `images-html/61_平台运营-概览.jpg` 的结论优先层级、`images-html/64_系统监控.jpg` 的指标分组、`images-html/69_异常告警.jpg` 的告警列表和 `images-html/10_霓虹科技平台驾驶舱_dashboard.png` 的深蓝驾驶舱视觉。桌面与 390px 均保留完整状态和事实边界。

页面将观测窗口内的慢查询速率、慢查询门禁严重度、实例启动后的累计 `Innodb_row_lock_waits` 与当前运行线程分开展示。累计行锁等待只能提示需要结合长事务日志调查，不能被描述为当前查询延迟或当前仍在等待的事务数。

`platform:operate` 是服务端权限门；每次读取把观测、查看记录和平台审计写入同一 MySQL 事务，并保留 `request_id`、`trace_id`。API 不返回主机、端口、账号、密码、数据目录、binlog 文件名或 SQL 文本。

页面首次进入时读取当前事实；已有成功快照后的手动刷新采用单飞控制，同一时刻只允许一个请求。API 在 14 秒后中止仍未完成的事实读取并返回 503 `mysql_resilience_read_timeout`，浏览器保留 15 秒兜底取消，并以同一 `request_id`/`trace_id` 关联提示。429、503 与前端超时只作为本次刷新失败，不得清空最后一次已验证的 MySQL 事实；401、403 必须清空内存快照，避免权限撤销后继续展示平台数据。组件卸载会取消在途请求，迟到响应不得覆盖后续页面状态；repository 在事务阶段检查中止信号并回滚，超时读取不得在锁释放后补写观察、查看或审计成功记录。

MySQL 连接拒绝、连接重置、连接超时、协议连接丢失和 MySQL `ER_*` 依赖错误由 operations 路由统一映射为 503 `mysql_resilience_dependency_unavailable`。错误响应只保留标准关联 ID、稳定错误码与宝塔处置提示，不回显驱动错误、SQL、连接信息或凭证；非依赖型编程错误继续上抛，不被伪装成可恢复故障。

异步恢复复用现有 Worker/Crawler 租约、幂等和重试，不新增守护进程。配置、重启、备份、恢复和定时任务全部由宝塔管理。

生产灰度的单行耐久写继续保持 `sync_binlog=1`、ROW binlog 和 600ms P95 门槛。`0032a_compact_release_write_probe_m08_03` 让新样本使用自增 BIGINT 主键及 BINARY sample/build/nonce 键，避免历史发布积累的宽随机 UUID 索引继续放大 fsync 尾延迟；旧 `deployment_release_write_probes` 表及其失败/通过历史只读保留，不迁移、不删除。该变化不改变签名 canonical、HTTP 路由、202 语义、每样本单语句持久化或候选持久化数量一致性。
