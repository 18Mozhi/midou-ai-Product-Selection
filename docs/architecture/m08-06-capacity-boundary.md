# M08-06 S0 单机容量边界架构

## 范围冻结

M08-06 收口容量状态的软件合同：规划用户数 100、规划并发区间 5–20 都不是承诺，默认且已完成的软件状态为 `capacity_claim=unverified`。只有另行执行可选同提交生产测量且事实全部通过，才允许显示 `measured_single_host_limited`；该测量不属于软件完成门。不建设负载均衡、备用服务器、多节点或 10,000 用户能力。

容量告警和阻断项同时返回原因、处置动作与责任角色。责任角色固定为已经持有 `platform:operate` 的 `platform_operations_admin`，页面显示“平台运维管理员”；系统没有值班人或单一负责人事实时不得编造具体姓名。

## 事实链与失败关闭

宝塔有限任务固定按 5→10→20 并发逐档执行，每档生产测量不少于 `CAPACITY_BOUNDARY_STAGE_SECONDS=60` 秒；每个虚拟用户顺序完成一次 TLS 核心读和一次签名持久写，同一轮用户并发发起。生产发布包不依赖 `.git` 元数据，任务在测量前必须确认宝塔受限环境注入的 `BUILD_SHA`、本机宝塔 Nginx TLS `/api/v1/health/version` 返回的构建和 MySQL 中 `healthy` 发布记录三者一致。任务把聚合事实写入 MySQL 5.7 的 `capacity_boundary_observations`；API 只读取最新 `production_benchmark`，用固定停止线重新判定，并把每次读取和 `request_id`/`trace_id` 写入平台审计。页面上的规划数永远与实测数分开。低档位越线即停止：若固定并发 5 未通过，证据保持 `blocked/unverified`；若至少一个档位通过，证据只签发最后通过档位，并在 `boundaryStop` 和审计中保留下一个失败档位的完整指标与失败码，API 以 `warning/shed_background` 明确不得继续扩大。不得跳档、缩短到 60 秒以下、把失败档位计入容量声明，或用规划值、截图及旧提交窗口补足。

停止线为读 P95 300 ms、写 P95 600 ms、错误率 1%、异步滞后 60 秒、归一化主机负载 85%、可用内存 1024 MB、可用磁盘 4096 MB。接近停止线进入 `warning` 并降载后台工作；越线进入 `blocked` 并停止新增后台工作。既有 Node Worker、Python Crawler、MySQL 和 Redis 仍由宝塔管理，不增加守护进程。

归档与恢复签认只验证 M08-04 已存在的加密归档和隔离恢复事实。POST 操作要求 `platform:operate`、同源和 Idempotency-Key，事务写入 `capacity_boundary_drills`、`capacity_boundary_operations` 与 `platform_audit_events`，不返回凭证、路径、SQL 或客户载荷。

页面读取采用单飞控制：浏览器 15 秒停止等待，API 14 秒失败关闭；客户端断开或超时会向 service/repository 传递取消信号，取消后的读取不得提交成功观测或审计。已有成功快照时，限流、超时、证据暂缺和依赖故障显示独立可重试告警，不把旧事实替换成空白；401/403 则清除受保护数据。MySQL 等依赖错误统一为脱敏 `capacity_boundary_dependency_unavailable`，不得返回连接地址、SQL 或凭证。签认在一次结果不确定的用户操作中复用同一 Idempotency-Key，并由页面重复提交守卫保证只发一个 POST；成功消息不被随后失败的 GET 覆盖。URL 查询参数不能伪造 `verifying` 状态或阻止真实读取。

## 页面与图片

实现前已读取 `images-html/README.txt`、`manifest.json` 与对应图片。页面采用 `61_平台运营-概览.jpg` 的总览层级、`63_采集任务监控.jpg` 的队列/任务状态、`64_系统监控.jpg` 的资源水位、`65_日志中心.jpg` 的关联标识、`66_安全审计.jpg` 的演练签认、`69_异常告警.jpg` 的失败关闭列表，并沿用 `10_霓虹科技平台驾驶舱_dashboard.png` 的深色霓虹驾驶舱。桌面显示结论、四项 KPI、资源/韧性双栏与 finding；390px 折叠为卡片，但不隐藏风险、数值、时间或操作入口。图片仅提供布局与状态，不是生产事实。

## 数据与合同

容量采集以 UTC 写入 `capacity_boundary_observations.observed_at`。读取最新 `production_benchmark` 时，仓储在 MySQL 5.7 内把 `DATETIME(3)` 格式化为带 `Z` 的毫秒级文本，再做 ISO 解析；不得直接把驱动按主库 `system_time_zone` 构造的 `Date` 当作证据时间，避免刚签发的证据因时区偏移被误判为未来或过期。

- `capacity_boundary_observations`：同提交生产基线和 API 复核观测。
- `capacity_boundary_drills`：已验证的归档/隔离恢复签认。
- `capacity_boundary_operations`：幂等响应事实。
- GET `/api/v1/platform/operations/capacity`：平台运维容量事实。
- POST `/api/v1/platform/operations/capacity/drills`：只签认 `archive_recovery`。

MySQL 固定 5.7/utf8mb4。长期运行和有限任务只能由宝塔创建、展示、停止、重启和取证；当前生产始终使用单一 4101 Node 上游，不创建第二后端或负载均衡。
