# M04-01 热点与监控运行、故障与回滚

## 宝塔部署顺序

1. 在宝塔受限发布任务备份 MySQL，执行 `database/migrations/0017a_trends_m04_01.up.sql`；迁移兼容 MySQL 5.7、`utf8mb4`，不得使用 root 运行常驻服务。
2. 在 Node Worker 项目环境设置 `TREND_PROJECTION_POLL_MS=2000`、`TREND_PROJECTION_LEASE_SECONDS=120`。这些不是秘密；真实数据库、Redis 和会话秘密仍只保存在宝塔受限环境。
3. 由宝塔先重启 Node Worker，再重启 Node API。Web 静态产物随网站发布；不得创建 systemd、独立 PM2、宿主 crontab或面板外容器。
4. 检查 Worker 日志中的 `queue=trend_projection`，再运行 `npm run verify:module -- M04-01`。

配置在进程启动时读取，修改轮询或租约后必须由宝塔重启 Node Worker。API 合同或代码发布后必须由宝塔重启 Node API。

## 观测与处置

- `scheduled` 长时间不下降：检查 Worker 是否由宝塔运行、数据库连接和 `available_at`。
- `leased` 超过租约：确认旧 Worker 已停止；新 Worker 会回收过期租约。
- `failed_terminal`：查看 `last_error_code`，通常是来源字段缺失或 URL/时间非法；修复解析合同后保留原证据并受控重放。
- `dead_letter`：依赖错误已耗尽四次尝试；记录 request/trace，恢复依赖后由受控 SQL 或后续管理入口重置，禁止直接删除审计。
- 页面数据不足：核对主题证据数和来源新鲜度。单来源或没有批准的计算规则时，环比与置信度显示数据不足是正确状态。

日志不得输出 Cookie、Token、数据库密码、主密钥或原始证据正文。

## 回滚

1. 先由宝塔停止 Node Worker，避免继续创建投影。
2. 回滚 Web、Node API 和 Node Worker 到上一版本。
3. 如必须回滚数据库，确认 M04-02 及下游尚未使用趋势表，导出并保留 `trend_events`、`trend_outbox` 和主题证据关联后，执行 `database/migrations/0017a_trends_m04_01.down.sql`。
4. 下迁移会删除 M04-01 趋势投影与监控规则，并撤销 `trend:manage`；不会删除 P03 原始证据和规范化记录。完成后由宝塔重启旧版 Worker/API。

## 故障演练

自动验收覆盖租约回收、幂等投影、非趋势空成功、非法字段终止、可恢复依赖重试/死信、跨组织读取拒绝、版本冲突和相关性操作不删除证据。
