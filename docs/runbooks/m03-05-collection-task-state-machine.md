# M03-05 采集任务状态机运维手册

此批正式发布从干净且与远端 main 等同的提交运行账号协调器 `--collection-controls-node --expected-previous-sha <运行基线> --expected-module-sha256 <旧任务状态机哈希>`。只替换四个固定的 Worker/来源模块、仅重启 Node；其后用 `--collection-controls-frontend --expected-previous-sha <运行基线>`，在同一发布锁下核对已安装模块再变更静态文件，不重启服务。回退 Node 使用 `--collection-controls-node-rollback` 和当前状态机哈希，由本地固定 Git 基线重建并逐项对照旧哈希；不在服务器留备份。没有迁移或配置变更。

> 账号模式自动采集波次：规则和全量入口发现任一计划、排队、执行、重试或限流中的采集任务就暂停创建下一波，不写入新任务，也不推进原游标。非空用索引短路查询，不取切换记录的写锁；空队列在原共享生产者锁后再次检查，避免两个入口同时生成下一波。恢复后仍按原调度周期，不批量补建错过的周期。当前任务的执行、原任务重试和下游完成步骤不变。无新参数、并发或迁移。正式应用需发布 Worker 并重启 `ai选品` Node。

> 账号采集租约：Worker 使用同一 MySQL 驱动绑定时间写入和校验租约截止时间，校验时取新时间，不使用轮询开始时间。开始、Redis 协调冲突处理、续租和结果锁仍校验原账号、尝试次数与令牌；到期仍拒绝。无新配置、迁移或并发变更。后续获准发布时仅需加载 Worker 模块并重启既有 `ai选品` Node；上线后核对真实 Amazon 任务是否进入执行、创建浏览器作业并保存结果，本地模拟不作为正式采集成功。

> 2026-10-18 同档任务增加有界后续链路优先，每20次提交领取后留一次原FIFO轮次；入队和领取先无锁排序、再按同范围主键锁定复核。原优先级、情报摄取及单机租约保留，无新配置或迁移。见 `docs/selection-completion-scheduling.md`；发布后重启唯一Node项目ai选品。

> 2026-10-18 自动情报来源恢复可按审计停用区间创建一次关联补采，原failed_terminal终态不改，手工死信回放权限不扩大。每30秒最多20个并遵守现有全局积压预算，失败只回滚补偿批次。见 `docs/intelligence-source-recovery.md`；发布后重启唯一Node项目ai选品，无数据库迁移。

## 宝塔配置与启动

生产继续使用宝塔面板中的 Node API、Node Worker、Python Crawler、MySQL 5.7 与 Redis，不新增 systemd、独立 PM2、宿主机 crontab 或屏外 Docker 服务。

- `COLLECTION_TASK_POLL_MS`：Node Worker 调度轮询间隔，默认 2000 ms。
- `COLLECTION_TASK_LEASE_SECONDS`：MySQL 与 Redis 协调租约，默认 120 秒；必须长于稳定心跳窗口。
- 总尝试次数 4 次、1/5/15 分钟退避和最多 20% 抖动是锁定业务规则，不通过环境变量调整。

配置在进程启动时读取，修改后必须在宝塔重启 Node Worker。API 代码或任务监控合同变更时再重启 Node API。M03-07 接入真实执行器前，不应启动生产任务轮询；M03-05 只提供可验证的执行引擎。

## 发布与验证

在 390px 分别打开部分完成与死信卡片，确认覆盖、证据、缺失字段可读，并可从抽屉进入完整任务详情执行既有安全重放；完整 UUID 只应在展开“技术详情”后出现。

1. 备份 MySQL，确认使用 `product_scout` 业务账号、MySQL 5.7 与 utf8mb4。
2. 停止统一 Node 后端与 Python Crawler，执行 `0016e_collection_tasks_m03_05.up.sql` 与 `0049_credential_renewal_auto_replay.up.sql`；已有状态机表时只应用未执行的 0049。
3. 复用现有依赖构建，运行 `npm run verify:module -- M03-05`；验收包含状态规则、API 合同、真实 MySQL/Redis 事务、桌面和 390px 浏览器状态。
4. 真实状态机验收必须使用执行时当前时间作为租约基准，不能使用历史固定时间；否则生产 Worker 会按真实时钟将刚创建的验收租约回收为过期租约并返回 `collection_task_lease_invalid`。
5. 由宝塔启动 Node API。Node Worker 的真实采集轮询须等 M03-07 Provider 执行器完成后再启用。
6. 在 `/platform-admin/collection` 核对总数超过 50 时可到达末页、全部状态可筛选、文本筛选明确限定当前页、刷新/离线/15 秒超时保留既有事实；打开任务后 URL 必须包含 `task`，刷新可恢复详情，Escape 和返回可关闭且焦点回到触发入口。再核对任务、覆盖、子查询结果数、缺失字段、起止耗时、尝试、事件及死信重放；RSS 子查询应按真实完成事件分别显示“空成功”“无新内容”或“解析失败”，旧任务没有该事件元数据时不补猜分类。失败任务的下一步入口应按状态指向浏览器档案、来源设置、来源健康或原有确认重放。M03-04 运行记录位于子页 `/platform-admin/collection/browser-runtime`。
7. 用同一 actor、任务和 Idempotency-Key 并发提交两次死信重放。两次都必须返回 200 且结果任务 ID 相同；原任务、死信、尝试、事件和原因仍可查。`scripts/verify-collection-task-live.mjs` 在真实 MySQL 5.7 与 Redis 上覆盖该并发合同。

### UI 第二阶段：详情历史返回

任务详情还在读取时使用浏览器后退，移除或使 `task` 查询无效后必须取消并作废当前详情读取；迟到的成功或非重试失败不能重新打开详情、写入旧错误或恢复页面滚动锁。再次前进应重新请求对应任务，关闭后正确移除 `task`。`tests/e2e/m03-05-collection-tasks.spec.ts` 的 UI2-CL51 使用隔离响应覆盖上述两种终态；不等于重放POST、全部KeepAlive生命周期或真实后端已验。

此变更只涉及Web详情读取归属，无API、状态机、SQL或配置变化；随既有宝塔发布流程更新静态包。没有因这两行UI修复而要求新迁移或单独重启Worker/Python；实际整体发布仍按部署器的停启与迁移预检执行，不能绕过统一发布流程。

## 故障与恢复

- Worker 每次轮询先回收过期租约，并将仍处于 `queued` 且已耗尽 4 次尝试的历史异常任务自动转入 `dead_letter`；写入 `collection_attempt_overflow`、任务事件、Outbox 和死信记录后，继续领取 `attempt_count < 4` 的新任务，避免一个损坏任务阻塞整条采集队列。
- `retry_scheduled`：核对 `available_at` 和 attempt_count，等待锁定退避；不得手工提前改库。
- `rate_limited`：遵守来源 reset 时间，不改造成固定快速重试。
- `blocked_login/blocked_captcha/blocked_robots`：停止自动执行，核对合法账户、来源政策和人工恢复条件；不得绕过。
- 单一来源失败：先在任务详情核对每条 `collection.subquery.completed` 事件；同一尝试中的其他来源应继续并各自留下结果或错误。若后续来源没有事件，优先按 MySQL 写入故障处理，不能把缺失结果解释为真实空结果。
- RSS 结果判断：`empty_success` 表示响应与 Feed 合同有效但没有条目；`no_new_content` 表示解析结果全部关联到既有不可变证据；`parse_failed` 表示载荷未通过当前解析合同。三者以 `collection.subquery.completed.metadata_json.result_kind` 为准，不能只看结果数或 HTTP 200 推断。
- `blocked_login` 且存在续期任务：由安全管理员轮换对应凭证。续期任务会自动完成，旧任务标记“凭证续期后已自动重放”，新任务进入 scheduled；应继续核对新任务是否真实通过登录，禁止把轮换 HTTP 200 当成目标站登录成功。
- `dead_letter`：修复原因后由具备 `collection:replay` 的人员填写原因并人工重放；新旧任务必须同时可查。
- 租约过期或 Redis 协调冲突：调度器把 MySQL 租约回收为重试或死信；用 request_id/trace_id 关联 Worker、事件和 Outbox。
- MySQL 或 Redis 不可用：停止领取新任务，在宝塔恢复依赖后重试；Redis 恢复不能作为任务完成依据。

## 回滚

在宝塔停止统一 Node 后端与 Python Crawler，确认没有有效租约并备份，先执行 0049 down，再按需执行 M03-05 down。回退代码/config 后由宝塔恢复旧版本。不得单独删除任务表、Redis 宽泛 key 前缀或历史审计；验收产生的探针数据由验证脚本按精确 ID 在 finally 清理。
如果任务已开始但浏览器作业仍未创建，执行器的账号模式租约锁也必须与状态机使用同一驱动 DATETIME 时钟。已有四个覆盖模块时，用 `--collection-executor-only --expected-previous-sha <运行基线> --expected-module-sha256 <旧执行器哈希>` 独立替换执行器并仅重启 Node；`--collection-executor-rollback` 接收当前执行器哈希并由同一 Git 基线恢复。两条路径均保留原四个覆盖模块，不改库或配置。

如果正式日志显示 MySQL 1052，先只用 `EXPLAIN INSERT … SELECT … ON DUPLICATE KEY UPDATE` 验证歧义，不发送实际写入。用 `--collection-browser-only --expected-previous-sha <运行基线> --expected-module-sha256 <旧浏览器作业客户端哈希>` 单独发布，`--collection-browser-rollback` 用当前模块哈希精确回退。正式前端发布同时核对四个原覆盖模块、执行器及浏览器作业客户端。它不改变可用性状态；只在双服务可用且新鲜调度快照仅显示背压、没有其他故障迹象时，允许静态维护入口发布和验收。

1688 来源健康优先显示本次熔断后的实际探测；如果探测早于本次熔断，后台改为显示触发本次熔断的运行原因，而不是复用旧探测。验证码、登录失效进入星星的共享节点操作；限流等待后重检，网络故障先检查连通性。后两种都不提示重登或操作验证码，也不解除熔断。

`--collection-executor-lock-only --expected-previous-sha <运行基线> --expected-module-sha256 <时钟修复版执行器哈希>` 保留任务排他锁，把账号归属及切换行改为共享锁，避免不同任务仅因同一切换记录相互排队；不改变归属、租约或结果契约。仅重启 Node。内部 Worker 日志 `internal_failure_diagnostic` 显示 Amazon 已知校验类型及阶段，不记录凭证、原始异常、SQL 或采集内容。`--collection-executor-lock-rollback` 使用当前模块哈希，对照时钟修复版本取回原件，保留已通过的时钟与浏览器作业修复。
`--collection-evidence-only --expected-previous-sha <运行基线> --expected-module-sha256 <旧证据持久化哈希>` 只发布证据校验和其 Worker 调用方。账号采集用已声明的账号身份做格式校验，仍须通过数据库中的现行任务租约、子任务和封存归属校验；无账号上下文的旧调用仍校验组织和工作区，禁止写入占位归属。仅重启 Node，`--collection-evidence-rollback` 使用当前持久化哈希从固定 Git 基线恢复这两个模块。

`--collection-rank-only --expected-previous-sha <运行基线> --expected-module-sha256 <当前任务状态机哈希>` 发布账号候选排名：同一条 SQL 预先计算并去重补齐任务集合，再按原优先级、账号公平、阶段、现有结果与 FIFO 顺序领取。锁内仍复核任务归属、状态和租约，不改领取数或并发。仅重启 Node；`--collection-rank-rollback` 使用当前状态机哈希恢复先前查询，但保留时钟与证据修复。用同一只读快照比较所选任务、查询时间和声明锁持有，不仅凭全库计数判断项目效果。
