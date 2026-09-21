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
11. 在已有成功事实后刷新，确认按钮显示忙状态且不可重复触发，页面继续保留上次观测；让拓扑读取超过 15 秒，确认浏览器主动中止并显示保留提示。首次超时应显示独立超时态，401/403 不得继续显示旧事实。
12. 空队列时确认“等待调度”为 0、主列表显示“当前没有等待、运行或异常队列”，不得把 `due=false` 的轮询抖动显示为等待；展开“查看全部 N 个队列策略”后应展示返回集合全部策略（当前注册表为19种），不截前18项。“仅看运行与异常”也不得隐藏第19项及以后的符合条件队列；切换只影响本地显示，不发调度请求。
13. 在隔离测试环境停止 MySQL 后读取运维拓扑，接口必须返回 503 `runtime_topology_dependency_unavailable`，响应不得包含 SQL、账号、主机或驱动错误；恢复 MySQL 后“重新核验”应返回当前真实事实。

当前生产验收已通过：构建 `b55f7f814d7153e6a4a7958eb41a9bf6ff1e60e8`、证据 SHA-256 `0c7cd53311f9c778407e699747bc8d9b9d27b1fad18635fee1c05ff54a74e13c`、run_id/trace_id `fa76e44f-53d7-49da-8884-bac921aad580`。永久路由为本机 4101 单上游，4103 候选已停止。

视觉验收由宝塔有限任务在 Linux Chromium 上执行：桌面与 390px 两个项目的四张基线先更新、再无更新复跑，两轮均为 4/4 通过；取回基线后已恢复原宝塔任务并删除临时源码、脚本和归档。

## 第二阶段局部UI验证边界

P66批次60通过`node scripts/diagnose-topology-read-lifecycle.mjs`在实际Vue中复现保活离页仍读取、返页不自动重读；成功更新缓存，普通失败保留旧事实，403清除，真实15秒超时仍发生。真正卸载才前端abort；该页后端未接取消信号，不能由浏览器中止推断审计停止。双端18拓扑GET均为本地替身，无生产查询；离页/返页新策略待用户决定，未改代码、配置或权限，无重启要求。

P66批次59补automatic_selection_evaluation的“自动质量评估”名称。C审核中，有href的关联对象为白底蓝色下划线链接，无href保持浅灰纯文字；技术详情仍提供完整对象编号与根因。`node scripts/verify-topology-alert-queue.mjs`用当前Worker转换器及服务的内存输入核对29组、8类告警和原队列筛选，未执行调度或点击真实业务链接，不能作为生产审计/权限证明。无新增配置或独立后端重启要求；不改地址、过滤与调度规则，未部署。

P66批次58补真实节点阻断代码的具体中文标签，并将stale和Worker观测说明改为中性表述。先分别核对结论、运行告警与阻断项；技术详情显示服务原代码，提示保留服务原文。`node scripts/verify-topology-state-matrix.mjs`用当前服务与内存依赖生成18状态样例，不连接SQL/真实探针，不证明生产读取审计。监督器阻断不会覆盖节点结论、API与Worker未来时间策略不改。C标题色与内边距仅审核使用；无新配置、迁移或独立后端重启要求，未部署。

P66批次57为首次加载/错误与保留刷新失败补关联标题、aria-busy和原有polite播报。`node scripts/verify-topology-read-states.mjs`核对真实15秒前端等待、原503/429读取重试次数、401/403清除和旧快照/失败编号分离；全部为本地响应与剪贴板替身，不证明生产权限/审计/探针。C提示区仍审核专用；未改变生产请求或离页策略，无新配置、迁移或后端重启要求，尚未部署。

P66批次56修复重试区移除时的自有焦点交接：顶部“正在刷新…”使用aria-disabled保持焦点，原单飞guard阻止Enter/Space/点击重复派发；用户已移到其他控件时，响应不抢回焦点。`node scripts/verify-topology-read-focus.mjs`为本地双端键盘验证，未改变15秒超时、重试或保活规则。无新配置/迁移，无独立后端重启要求，本批尚未部署。

P66批次55将“快照读取追踪”与“本次失败读取追踪”分开：刷新失败不能覆盖旧观测编号，401/403清除旧事实及快照编号，超时显示本次发出的编号。没有编号的未分类异常不复用旧编号；共享客户端的网络失败仍使用实际发出编号。展开对应追踪可复制，复制失败可手动选取。`node scripts/verify-topology-trace-ownership.mjs`使用本地请求与剪贴板替身验证归属，不证明真实权限或审计；加`--capture-review rN`生成不可覆盖的审核图。无新配置、迁移或后端重启要求，尚未部署；完整C样式仍仅供审核。

UI2-RS66使用当前Worker策略注册表生成隔离响应，验证全部列表、末项策略的键盘展开、收起及刷新后全部due队列；没有启动真实Worker、改策略或调度业务。该修复仅移除前端显示截断，既有排序、过滤、并发、超时、重试和告警判定不变。历史生产记录不证明本次源码已上线，正式全新图与同提交生产验收仍待交。

本次无新配置或迁移；不需要单独重启后端。未来发布仍走固定宝塔 `python scripts/deploy-baota.py` 整体流程，预检已有迁移与停启窗口，不另建前端上传链；Web回退不执行本模块down迁移。

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
