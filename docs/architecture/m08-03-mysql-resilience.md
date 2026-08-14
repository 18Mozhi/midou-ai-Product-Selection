# M08-03 MySQL 5.7 单主韧性架构

M08-03 只覆盖惠州当前单机上的一个宝塔 MySQL 5.7 主实例。系统不建设读副本、负载均衡或备用服务器，也不据此给出容量承诺。MySQL 继续是业务事实源；API 读取全局变量、全局状态、主状态、同机数据文件系统容量及 M07-04 恢复演练记录，输出脱敏的 `single_primary` 结论。

页面布局依据 `images-html/61_平台运营-概览.jpg` 的结论优先层级、`images-html/64_系统监控.jpg` 的指标分组、`images-html/69_异常告警.jpg` 的告警列表和 `images-html/10_霓虹科技平台驾驶舱_dashboard.png` 的深蓝驾驶舱视觉。桌面与 390px 均保留完整状态和事实边界。

`platform:operate` 是服务端权限门；每次读取把观测、查看记录和平台审计写入同一 MySQL 事务，并保留 `request_id`、`trace_id`。API 不返回主机、端口、账号、密码、数据目录、binlog 文件名或 SQL 文本。

异步恢复复用现有 Worker/Crawler 租约、幂等和重试，不新增守护进程。配置、重启、备份、恢复和定时任务全部由宝塔管理。
