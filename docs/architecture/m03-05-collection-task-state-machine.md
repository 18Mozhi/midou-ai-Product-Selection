# M03-05 采集任务状态机架构

## 范围与事实源

M03-05 交付组织/工作区范围化的任务、子查询、执行尝试、租约、重试、死信、人工重放、事件与 Outbox。MySQL 5.7 是唯一事实源，Redis 只提供就绪信号和同范围短租约协调；Redis 丢失或重复信号不能创建、完成或覆盖任务。

本模块不编造真实来源请求：M03-07 才把已批准 Provider 的真实执行器接入 `CollectionTaskExecutor`。M03-06 才保存原始证据、规范化记录和字段溯源。当前实时集成验证使用事务内合成执行器，只验证状态机合同，不伪装成生产采集。

## 状态、失败与覆盖

- 主路径：`draft → scheduled → queued → leased → running → parsing → validating → persisted → succeeded | succeeded_empty | completed_with_warnings`。
- 可重试网络、超时、DNS、解析和校验故障最多总尝试 4 次，按 1/5/15 分钟加最多 20% 抖动进入 `retry_scheduled`，第四次进入 `dead_letter`。
- `rate_limited` 严格使用来源给出的未来 reset 时间；登录、会话、验证码、robots 与权限问题不自动重试或绕过。
- 多来源结果逐项保留。无任何可用结果为 `succeeded_empty / insufficient`；有可用结果但必需来源、字段、失败或受阻不完整时为 `completed_with_warnings`；必需覆盖全部满足才为 `succeeded / complete`。
- `insufficient` 是下游硬边界，不得形成自动“推荐”。
- 必需来源的登录、验证码、robots、权限或解析漂移错误不能降级成普通空成功：执行器抛出统一业务错误，由状态机落到对应受阻或终止状态；仅非必需来源允许保留单项失败并继续其他来源。来源正常返回零条记录时仍按事实记录 `succeeded_empty`。

## 并发、幂等与审计

调度和领取均使用 `SELECT ... FOR UPDATE`。租约令牌只在 Worker 内存中存在，MySQL 保存带域分离的 SHA-256 摘要；任务详情和 API 永不返回令牌或内部 `target_json`。到期 `leased/running` 任务由调度器回收并按同一退避规则处理。

队列领取前包含重试耗尽自愈：历史异常记录若保持 `queued` 且 `attempt_count >= 4`，Worker 会以系统身份转入 `dead_letter` 并保留事件、Outbox 与死信审计；正常领取查询只接受 `attempt_count < 4`，因此单条坏记录不能形成队头阻塞。

每次状态变化在同一事务写 `collection_task_events` 和 `collection_task_outbox`，保留 organization/workspace、request_id/trace_id、操作主体和脱敏元数据。死信重放只允许 `collection:replay`，要求同源 Origin、Idempotency-Key 和 2–500 字原因；新任务复制内部子查询，原任务改为 `manually_replayed`，全部历史不覆盖。

浏览器凭证续期是独立的系统恢复路径：安全管理员成功轮换经过格式、域名和有效期校验的凭证后，仍在执行期的 blocked browser job 原位重新排队；已经处于 `blocked_login` 的任务，以及历史上因旧映射落成 `succeeded_empty` 或 `completed_with_warnings` 且存在登录受阻作业的任务，改为 `automatically_replayed`，复制全部子查询创建新 `scheduled` 任务并写事件与 Outbox。原任务、尝试、作业和错误均不覆盖；新任务再次验证真实登录，失败时重新受阻。

## 页面与权限

采集任务桌面端保留队列表格；390px 改为状态、覆盖与证据摘要卡片，详情抽屉保留子查询计数、缺失字段和进入完整任务详情的操作。完整任务、组织、工作区、错误与请求标识仅归入“技术详情”。

`/platform-admin/collection` 展示任务状态、覆盖、子查询、尝试和事件，`/platform-admin/collection/browser-runtime` 保留 M03-04 底层运行视图。列表、详情和人工重放均由服务端校验 `collection:replay`；前端菜单和按钮不是权限边界。页面覆盖加载、空、错误、过期、无权、依赖受阻、恢复、桌面与 390px。

## 回滚

先在宝塔停止统一 Node 后端与 Python Crawler，确认没有有效任务租约并备份。先执行 `0049_credential_renewal_auto_replay.down.sql`，再按需执行 `0016e_collection_tasks_m03_05.down.sql`，随后回退本模块代码、OpenAPI 与配置并由宝塔启动旧版本。回滚 M03-05 会删除任务、尝试、事件、Outbox 和死信历史，必须经过生产变更审批；不得在 Worker 运行时执行。
