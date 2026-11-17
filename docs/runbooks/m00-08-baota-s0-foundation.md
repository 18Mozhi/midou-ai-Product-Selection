# M00-08 宝塔 S0 骨架 Runbook

监督器等待退避重启或重启熔断冷却时，必须保留父进程的定时器引用；不能因API退出且Worker等待API就绪而自然结束。宝塔正常停止时取消待启定时器，再处理子进程信号，防止60秒冷却拖住停止。原BACKEND_RESTART_*、BACKEND_CHILD_*策略及就绪门保持；实施与独立进程验证见[重启定时器存活](../backend-restart-timer-lifetime.md)。短暂依赖故障的自然恢复须观察真实结果，不能主动停MySQL制造验收。

完整目录、创建、更新、重启与回滚顺序见 `infra/baota/README.md`。本地运行 `npm run build`、`node scripts/verify-baota-s0.mjs`、`node --test tests/m00-08/baota-s0.test.mjs` 与 `npm run verify:module -- M00-08`。首次整理运行 `python scripts/deploy-baota.py --initialize-layout`，以后更新运行 `python scripts/deploy-baota.py`；服务器不执行 Git 或源码构建。

环境变量和密钥只保存在 `/www/wwwroot/ai选品/config/product_scout.env`。生产设置 `WORKER_SCHEDULER_STATE_FILE=/www/wwwroot/ai选品/runtime/worker-scheduler.json` 与 `BACKEND_SUPERVISOR_STATE_FILE=/www/wwwroot/ai选品/runtime/backend-supervisor.json`；部署脚本必须把 `runtime` 及固定可写子目录保持为 `root:www`、`2770`，让宝塔 `www` 进程写入状态且不向其他用户开放。`WORKER_MAX_CONCURRENCY` 控制统一 Worker 的全局并发配额，`WORKER_SCHEDULER_TICK_MS` 控制到期队列检查频率，`WORKER_SCHEDULER_STALE_AFTER_SECONDS` 控制业务可用性心跳门限。每类队列的独立并发、超时、重试、熔断、老化和卡死阈值由源码声明式注册表锁定，运行拓扑展示实际策略和状态。监督器只有在 API `/health/live` 返回当前 `BUILD_SHA` 且 Worker 写入启动后的新鲜调度快照后，才把子进程标为 `running`；`BACKEND_CHILD_READINESS_TIMEOUT_SECONDS` 与 `BACKEND_CHILD_READINESS_POLL_MS` 分别控制就绪截止时间和探测间隔，超时、同步 spawn 失败或异步 spawn 错误都会进入退避重启与结构化告警。状态文件写入失败只记录 `backend_child_state_write_failed`，不得结束监督主进程。改任一 `WORKER_*` 或 `BACKEND_*` 后在宝塔重启 `ai选品`，改 `CRAWLER_HEARTBEAT_SECONDS` 后重启 `ai选品-python`。发布时分别检查 API live、ready、available、version，系统状态页的 API/Worker 真实就绪时间、最近失败、队列等待数、运行时长、疑似卡死、队列熔断、失败率、背压和连续重启告警，以及 Crawler 最新任务结果、Redis/MySQL 和备份任务。状态文件只包含脱敏调度指标，快照写入失败不得更改业务计数，日志只能从宝塔查看与轮转。

## 短轮询错峰

货源投影、报表导出、自动化规则、竞品监控分别在 Worker 启动后的第 1、3、5、7 个 tick 首次到期。启动 tick 为 250 ms 时，分别为 250 / 750 / 1250 / 1750 ms。自动化规则不再放在最后一个相位，但不提升派发优先级。若 tick 超过 250 ms 或轮询周期容不下八个 tick，继续用旧行为。之后按原配置保证最小间隔，仅在一个 tick 内可回到固定相位时才对齐。不补跑漏过的轮询；并发、优先级、重试、熔断和健康告警逻辑不变。

本地先执行 `npm run build:worker`，再执行 `node --test tests/unit/worker-poll-stagger.test.mjs tests/unit/worker-scheduler.test.mjs`。回放只使用脱敏的历史轮询间隔与执行耗时，不运行实际业务；两组固定输入均须背压减少，且 P95 和最长额外轮询等待不长于无错峰基线。若后续获准发布，需发布 Worker 运行包并由宝塔重启现有 `ai选品` Node 才会生效；不需要配置修改、迁移或重启 Python。生产验收需同时比较背压、四队列共同到期次数和最长实际轮询间隔，不能只看健康状态比例。

仅发布错峰模块时，从与远端 `main` 相同的干净提交执行 `python -B scripts/deploy-account-baota.py --scheduler-stagger-only --expected-previous-sha <后端基底SHA> --expected-module-sha256 <已上线趋势模块SHA256> --expected-scheduler-sha256 <原调度器SHA256> --expected-registry-sha256 <原注册表SHA256>`。入口只写入两个指定 Worker 模块，保留已部署的趋势模块、前端、Python、配置和迁移日志，再重启现有 Node 项目。健康接口仍标识后端基底版本，补丁提交及模块哈希以发布回执为准。

## 回滚

冻结新写入，在本地切到目标提交后重新运行固定目录部署命令；按影响确认后逆序迁移，再从宝塔重启 Node/Python，验证健康、心跳和审计。执行 `0007_m00_08_deployment_releases.down.sql` 前导出发布记录。不得删除 `config/runtime/backups`，不得用面板外进程临时顶替。
