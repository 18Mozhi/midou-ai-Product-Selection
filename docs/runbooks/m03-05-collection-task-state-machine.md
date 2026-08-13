# M03-05 采集任务状态机运维手册

## 宝塔配置与启动

生产继续使用宝塔面板中的 Node API、Node Worker、Python Crawler、MySQL 5.7 与 Redis，不新增 systemd、独立 PM2、宿主机 crontab 或屏外 Docker 服务。

- `COLLECTION_TASK_POLL_MS`：Node Worker 调度轮询间隔，默认 2000 ms。
- `COLLECTION_TASK_LEASE_SECONDS`：MySQL 与 Redis 协调租约，默认 120 秒；必须长于稳定心跳窗口。
- 总尝试次数 4 次、1/5/15 分钟退避和最多 20% 抖动是锁定业务规则，不通过环境变量调整。

配置在进程启动时读取，修改后必须在宝塔重启 Node Worker。API 代码或任务监控合同变更时再重启 Node API。M03-07 接入真实执行器前，不应启动生产任务轮询；M03-05 只提供可验证的执行引擎。

## 发布与验证

1. 备份 MySQL，确认使用 `product_scout` 业务账号、MySQL 5.7 与 utf8mb4。
2. 停止 Node Worker，执行 `0016e_collection_tasks_m03_05.up.sql`。
3. 复用现有依赖构建，运行 `npm run verify:module -- M03-05`；验收包含状态规则、API 合同、真实 MySQL/Redis 事务、桌面和 390px 浏览器状态。
4. 真实状态机验收必须使用执行时当前时间作为租约基准，不能使用历史固定时间；否则生产 Worker 会按真实时钟将刚创建的验收租约回收为过期租约并返回 `collection_task_lease_invalid`。
4. 由宝塔启动 Node API。Node Worker 的真实采集轮询须等 M03-07 Provider 执行器完成后再启用。
5. 在 `/platform-admin/collection` 核对任务、覆盖、子查询、尝试、事件及死信重放；M03-04 运行记录位于子页 `/platform-admin/collection/browser-runtime`。

## 故障与恢复

- `retry_scheduled`：核对 `available_at` 和 attempt_count，等待锁定退避；不得手工提前改库。
- `rate_limited`：遵守来源 reset 时间，不改造成固定快速重试。
- `blocked_login/blocked_captcha/blocked_robots`：停止自动执行，核对合法账户、来源政策和人工恢复条件；不得绕过。
- `dead_letter`：修复原因后由具备 `collection:replay` 的人员填写原因并人工重放；新旧任务必须同时可查。
- 租约过期或 Redis 协调冲突：调度器把 MySQL 租约回收为重试或死信；用 request_id/trace_id 关联 Worker、事件和 Outbox。
- MySQL 或 Redis 不可用：停止领取新任务，在宝塔恢复依赖后重试；Redis 恢复不能作为任务完成依据。

## 回滚

在宝塔停止 Node Worker 与 Node API，确认没有有效租约并备份，再执行 down migration。回退代码/config 后由宝塔恢复旧版本。不得单独删除任务表、Redis 宽泛 key 前缀或历史审计；验收产生的探针数据由验证脚本按精确 ID 在 finally 清理。
