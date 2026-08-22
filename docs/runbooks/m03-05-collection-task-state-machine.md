# M03-05 采集任务状态机运维手册

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
6. 在 `/platform-admin/collection` 核对任务、覆盖、子查询结果数、缺失字段、起止耗时、尝试、事件及死信重放；RSS 子查询应按真实完成事件分别显示“空成功”“无新内容”或“解析失败”，旧任务没有该事件元数据时不补猜分类。失败任务的下一步入口应按状态指向浏览器档案、来源设置、来源健康或原有确认重放。M03-04 运行记录位于子页 `/platform-admin/collection/browser-runtime`。

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
