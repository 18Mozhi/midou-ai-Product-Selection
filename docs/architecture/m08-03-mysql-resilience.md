# M08-03 MySQL 5.7 单主韧性架构

M08-03 只覆盖惠州当前单机上的一个宝塔 MySQL 5.7 主实例。系统不建设读副本、负载均衡或备用服务器，也不据此给出容量承诺。MySQL 继续是业务事实源；API 读取全局变量、全局状态、主状态、同机数据文件系统容量及 M07-04 恢复演练记录，输出脱敏的 `single_primary` 结论。

页面布局依据 `images-html/61_平台运营-概览.jpg` 的结论优先层级、`images-html/64_系统监控.jpg` 的指标分组、`images-html/69_异常告警.jpg` 的告警列表和 `images-html/10_霓虹科技平台驾驶舱_dashboard.png` 的深蓝驾驶舱视觉。桌面与 390px 均保留完整状态和事实边界。

`platform:operate` 是服务端权限门；每次读取把观测、查看记录和平台审计写入同一 MySQL 事务，并保留 `request_id`、`trace_id`。API 不返回主机、端口、账号、密码、数据目录、binlog 文件名或 SQL 文本。

异步恢复复用现有 Worker/Crawler 租约、幂等和重试，不新增守护进程。配置、重启、备份、恢复和定时任务全部由宝塔管理。

生产灰度的单行耐久写继续保持 `sync_binlog=1`、ROW binlog 和 600ms P95 门槛。`0032a_compact_release_write_probe_m08_03` 让新样本使用自增 BIGINT 主键及 BINARY sample/build/nonce 键，避免历史发布积累的宽随机 UUID 索引继续放大 fsync 尾延迟；旧 `deployment_release_write_probes` 表及其失败/通过历史只读保留，不迁移、不删除。该变化不改变签名 canonical、HTTP 路由、202 语义、每样本单语句持久化或候选持久化数量一致性。
