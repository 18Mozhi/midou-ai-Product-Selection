# M08-06 S0 单机容量边界架构

## 范围冻结

M08-06 只收口惠州当前单台宝塔服务器的实测容量边界：规划用户数为 100、规划并发区间为 5–20，但两者都不是承诺。只有同提交生产基线实测到的档位，并且读写 P95、错误率、异步滞后、主机资源、归档和隔离恢复全部通过，才允许显示 `measured_single_host_limited`。不建设负载均衡、备用服务器、多节点或 10,000 用户能力。

## 事实链与失败关闭

宝塔有限任务固定按 5→10→20 并发逐档执行，每档生产测量不少于 `CAPACITY_BOUNDARY_STAGE_SECONDS=60` 秒；每个虚拟用户顺序完成一次 TLS 核心读和一次签名持久写，同一轮用户并发发起。任务把聚合事实写入 MySQL 5.7 的 `capacity_boundary_observations`；API 只读取最新 `production_benchmark`，用固定停止线重新判定，并把每次读取和 `request_id`/`trace_id` 写入平台审计。页面上的规划数永远与实测数分开。低档位越线即停止，证据过期、没有实测并发、任一性能或资源门失败、归档或恢复未验证时都失败关闭，不得跳档、缩短到 60 秒以下、用规划值/截图或旧提交窗口补足。

停止线为读 P95 300 ms、写 P95 600 ms、错误率 1%、异步滞后 60 秒、归一化主机负载 85%、可用内存 1024 MB、可用磁盘 4096 MB。接近停止线进入 `warning` 并降载后台工作；越线进入 `blocked` 并停止新增后台工作。既有 Node Worker、Python Crawler、MySQL 和 Redis 仍由宝塔管理，不增加守护进程。

归档与恢复签认只验证 M08-04 已存在的加密归档和隔离恢复事实。POST 操作要求 `platform:operate`、同源和 Idempotency-Key，事务写入 `capacity_boundary_drills`、`capacity_boundary_operations` 与 `platform_audit_events`，不返回凭证、路径、SQL 或客户载荷。

## 页面与图片

实现前已读取 `images-html/README.txt`、`manifest.json` 与对应图片。页面采用 `61_平台运营-概览.jpg` 的总览层级、`63_采集任务监控.jpg` 的队列/任务状态、`64_系统监控.jpg` 的资源水位、`65_日志中心.jpg` 的关联标识、`66_安全审计.jpg` 的演练签认、`69_异常告警.jpg` 的失败关闭列表，并沿用 `10_霓虹科技平台驾驶舱_dashboard.png` 的深色霓虹驾驶舱。桌面显示结论、四项 KPI、资源/韧性双栏与 finding；390px 折叠为卡片，但不隐藏风险、数值、时间或操作入口。图片仅提供布局与状态，不是生产事实。

## 数据与合同

- `capacity_boundary_observations`：同提交生产基线和 API 复核观测。
- `capacity_boundary_drills`：已验证的归档/隔离恢复签认。
- `capacity_boundary_operations`：幂等响应事实。
- GET `/api/v1/platform/operations/capacity`：平台运维容量事实。
- POST `/api/v1/platform/operations/capacity/drills`：只签认 `archive_recovery`。

MySQL 固定 5.7/utf8mb4。长期运行和有限任务只能由宝塔创建、展示、停止、重启和取证；临时灰度的 4101/4103 不构成负载均衡，晋级后恢复单一 4101。
