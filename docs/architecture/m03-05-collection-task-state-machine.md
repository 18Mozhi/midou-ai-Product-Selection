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

## 并发、幂等与审计

调度和领取均使用 `SELECT ... FOR UPDATE`。租约令牌只在 Worker 内存中存在，MySQL 保存带域分离的 SHA-256 摘要；任务详情和 API 永不返回令牌或内部 `target_json`。到期 `leased/running` 任务由调度器回收并按同一退避规则处理。

队列领取前包含重试耗尽自愈：历史异常记录若保持 `queued` 且 `attempt_count >= 4`，Worker 会以系统身份转入 `dead_letter` 并保留事件、Outbox 与死信审计；正常领取查询只接受 `attempt_count < 4`，因此单条坏记录不能形成队头阻塞。

每次状态变化在同一事务写 `collection_task_events` 和 `collection_task_outbox`，保留 organization/workspace、request_id/trace_id、操作主体和脱敏元数据。死信重放只允许 `collection:replay`，要求同源 Origin、Idempotency-Key 和 2–500 字原因；新任务复制内部子查询，原任务改为 `manually_replayed`，全部历史不覆盖。

## 页面与权限

`/platform-admin/collection` 展示任务状态、覆盖、子查询、尝试和事件，`/platform-admin/collection/browser-runtime` 保留 M03-04 底层运行视图。列表、详情和人工重放均由服务端校验 `collection:replay`；前端菜单和按钮不是权限边界。页面覆盖加载、空、错误、过期、无权、依赖受阻、恢复、桌面与 390px。

## 回滚

先在宝塔停止 Node Worker，再停止 Node API，确认没有有效任务租约并备份。执行 `0016e_collection_tasks_m03_05.down.sql` 后回退本模块代码、OpenAPI 与配置，再由宝塔启动旧版本。回滚删除任务、尝试、事件、Outbox 和死信历史，必须经过生产变更审批；不得在 Worker 运行时执行。
