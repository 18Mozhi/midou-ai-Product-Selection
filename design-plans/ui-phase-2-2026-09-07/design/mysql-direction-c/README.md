# P68 MySQL运行 · MYSQL-C-r1

本稿是离线设计历史材料；后续用户已授权页面视觉自动通过，实际 Vue C 组合已接入生产路由。它不是生产截图或真实数据库操作证据，实施与运行边界见[实施记录](../../P68-PAGE-COMPOSITION-IMPLEMENTATION.md)。

[打开交互稿](index.html) · [来源与验证](evidence.json)

## 设计与全部控件

frontend-design技能用于“运行与恢复并列核验”：蓝色运行上下文，白色双证据工作区，底部持久化实际/目标对照。替代旧四指标卡＋状态已核对徽标。六色#1748a0、#ffffff、#182d4a、#dce4ee、#875300、#b02d3c；微软雅黑正文、Consolas数值，正文16px、辅助至少13px，按钮44px。手机纵向阅读，不缩小桌面列；无自动动画。

```text
运行结论与发现
资源/速率/累计等待 | 同机恢复证据
持久化实际值      | 合同目标
```

只保留刷新、首次/保留快照重试、登录、三个原生请求ID详情/模拟复制。无业务模态/抽屉/排序/分页/筛选、SQL输入、配置保存、备份或恢复按钮。审核选择器仅原型工具。键盘、悬停/按下/加载、空/错误/保留与清快照、三处复制拒绝逐场景出图。

## 事实口径

46数据集来自45组源probe/evaluator/service合成输入输出和独立原始E2E。生产探针只返回available=true或抛错；available=false评估器样例与长格式值仅为边界/布局压力输入，不冒充真实探针回退。未连接数据库/文件系统/生产环境；路径、版本、原始SQL不进入页面数据。

慢查询速率为非负累计差÷max(1分钟,观测间隔)，缺上次时累计÷uptime分钟；DTO未回传分母来源。缓冲命中来自累计reads/requests，0请求回退10000，不能从100%独立推断实际命中。行锁/日志等待是启动以来累计，运行线程是瞬时计数。新稿不沿用“当前窗口增量”作为无条件事实。

恢复probe固定15分钟/240分钟/90天，并检查最近20条内备份/演练与同备份的加密完整mysql_full/mysql_binlog恢复资产、隔离/权限/审计/证据；evaluator另用运行policy，放宽policy不能绕开probe blocked。null值在probe内部数字判定可当0而返回仍null，因此恢复verified与总体RPO阻断可并存。源可接受负恢复数字，稿中保留并明确异常，不代替业务规则修复。年龄未来归0，两位小数；90.001天可显示90.00同时stale。未知不用0，真实0保留。

资源比例在0–100%封顶，无上限10000为约定值不是实测满额；数据盘指数据目录所在文件系统。实际版本/主状态/副本实值不在DTO中，不能编造；固定replica_enabled=false不得覆盖mysql_replica_unexpected。指标条各自按对应finding着色，不随无关恢复阻断一起变红。

## 验证边界与使用

五组源证据：真实probe合成SQL行及惰性statfs；真实evaluator/service输入输出和两层判门；Vue脚本/源严重级别与累计影响函数；service取消检查和repository惰性三插入/提交/失败或中途abort回滚；真实路由handler惰性认证、14秒race/abort、依赖503和finish清理。分组细节以evidence为准；七相关旧B3b hash保持，不重写历史表。

浏览器15秒，授权后API默认14秒；probe不接signal，正在运行的SQL不保证即时中止。service记录后取消可能晚于事务提交；这些控制流测试不证明实库事务、SQL语法/持久性、权限服务器、系统剪贴板、Vue挂载/保活、真实恢复或生产同提交。recovering只是前端枚举预览，不启动作业。

复验 `node scripts/verify-ui-phase2-mysql-c.mjs`；有意更新正式图时才加 `--capture`。正式PNG、数据和脚本保留，验证浏览器finally关闭，无一次性临时文件/常驻服务。没有生产Vue/API/OpenAPI/环境/依赖/数据库/Worker/Python或权限修改，不部署、不调优、不迁移、不恢复；无需重启。

请审核布局、未知/负值表达、时间口径与技术控件。具体批准后才迁入Vue，全73页实施/部署/签收仍待完成。

<!-- GALLERY:START -->
正式PNG：145张；70场景。

| 场景 | 桌面1440 | 手机390 |
| --- | --- | --- |
| 单主运行与恢复证据齐备 (ready) | [主图](1440-ready.png) | [主图](390-ready.png) |
| available=false评估边界（非探针回退） (availability-boundary) | [主图](1440-availability-boundary.png) | [主图](390-availability-boundary.png) |
| 版本不符合5.7 (version) | [主图](1440-version.png) | [主图](390-version.png) |
| 主库只读 (read-only) | [主图](1440-read-only.png) | [主图](390-read-only.png) |
| 未启用binlog (binlog-off) | [主图](1440-binlog-off.png) | [主图](390-binlog-off.png) |
| 日志非ROW (format) | [主图](1440-format.png) | [主图](390-format.png) |
| 业务库被排除 (excluded) | [主图](1440-excluded.png) | [主图](390-excluded.png) |
| 刷盘合同不符 (flush) | [主图](1440-flush.png) | [主图](390-flush.png) |
| 同步合同不符 (sync) | [主图](1440-sync.png) | [主图](390-sync.png) |
| 主状态不可用 (master) | [主图](1440-master.png) | [主图](390-master.png) |
| 发现非预期副本 (replica) | [主图](1440-replica.png) | [主图](390-replica.png) |
| 连接上限未设置 (connections-unbounded) | [主图](1440-connections-unbounded.png) | [主图](390-connections-unbounded.png) |
| 数据盘容量未知 (capacity-unknown) | [主图](1440-capacity-unknown.png) | [主图](390-capacity-unknown.png) |
| 慢查询预警边界 (slow-warning) | [主图](1440-slow-warning.png) | [主图](390-slow-warning.png) |
| 慢查询停止边界 (slow-stop) | [主图](1440-slow-stop.png) | [主图](390-slow-stop.png) |
| 缓冲命中低于99% (buffer-warning) | [主图](1440-buffer-warning.png) | [主图](390-buffer-warning.png) |
| 累计日志等待非零 (log-waits) | [主图](1440-log-waits.png) | [主图](390-log-waits.png) |
| 累计行锁等待非零 (row-waits) | [主图](1440-row-waits.png) | [主图](390-row-waits.png) |
| RPO未记录 (rpo-null) | [主图](1440-rpo-null.png) | [主图](390-rpo-null.png) |
| RTO未记录 (rto-null) | [主图](1440-rto-null.png) | [主图](390-rto-null.png) |
| 演练年龄未记录 (age-null) | [主图](1440-age-null.png) | [主图](390-age-null.png) |
| 连接75%边界 (connections-warning) | [主图](1440-connections-warning.png) | [主图](390-connections-warning.png) |
| 连接90%边界 (connections-stop) | [主图](1440-connections-stop.png) | [主图](390-connections-stop.png) |
| 数据盘75%边界 (storage-warning) | [主图](1440-storage-warning.png) | [主图](390-storage-warning.png) |
| 数据盘90%边界 (storage-stop) | [主图](1440-storage-stop.png) | [主图](390-storage-stop.png) |
| 可用空间异常负值 (storage-over) | [主图](1440-storage-over.png) | [主图](390-storage-over.png) |
| 真实零用量与零耗时 (zero-values) | [主图](1440-zero-values.png) | [主图](390-zero-values.png) |
| 源返回负RPO/RTO仍可能ready (negative-recovery) | [主图](1440-negative-recovery.png) | [主图](390-negative-recovery.png) · [近图](390-negative-recovery-detail.png) |
| 长日志格式值 (long) | [主图](1440-long.png) | [主图](390-long.png) |
| 短间隔按至少一分钟分母 (interval-short) | [主图](1440-interval-short.png) | [主图](390-interval-short.png) |
| 没有上次观测用uptime平均 (no-previous) | [主图](1440-no-previous.png) | [主图](390-no-previous.png) |
| 慢查询累计计数下降 (counter-reset) | [主图](1440-counter-reset.png) | [主图](390-counter-reset.png) |
| 零缓冲请求回退100% (no-buffer-requests) | [主图](1440-no-buffer-requests.png) | [主图](390-no-buffer-requests.png) |
| 没有返回恢复记录 (recovery-empty) | [主图](1440-recovery-empty.png) | [主图](390-recovery-empty.png) |
| 恢复副本缺binlog资产 (asset-missing) | [主图](1440-asset-missing.png) | [主图](390-asset-missing.png) |
| 演练未隔离 (drill-not-isolated) | [主图](1440-drill-not-isolated.png) | [主图](390-drill-not-isolated.png) |
| 超过90天但显示取整90.00 (drill-stale) | [主图](1440-drill-stale.png) | [主图](390-drill-stale.png) · [近图](390-drill-stale-detail.png) |
| 恰好90天 (drill-boundary) | [主图](1440-drill-boundary.png) | [主图](390-drill-boundary.png) |
| 未来时间归零年龄 (drill-future) | [主图](1440-drill-future.png) | [主图](390-drill-future.png) |
| 探针verified但RPO为空 (probe-null-rpo) | [主图](1440-probe-null-rpo.png) | [主图](390-probe-null-rpo.png) · [近图](390-probe-null-rpo-detail.png) |
| 探针固定RPO15分钟之外 (rpo-probe-stop) | [主图](1440-rpo-probe-stop.png) | [主图](390-rpo-probe-stop.png) |
| 探针固定RTO240分钟之外 (rto-probe-stop) | [主图](1440-rto-probe-stop.png) | [主图](390-rto-probe-stop.png) |
| 最近20条只有演练 (twenty-drills) | [主图](1440-twenty-drills.png) | [主图](390-twenty-drills.png) |
| 运行policy比探针更严格 (policy-stricter) | [主图](1440-policy-stricter.png) | [主图](390-policy-stricter.png) |
| 放宽运行policy仍不能绕过探针 (policy-relaxed) | [主图](1440-policy-relaxed.png) | [主图](390-policy-relaxed.png) |
| 原始历史E2E夹具 (original) | [主图](1440-original.png) | [主图](390-original.png) |
| 首次加载 (loading) | [主图](1440-loading.png) | [主图](390-loading.png) |
| 空响应 (empty) | [主图](1440-empty.png) | [主图](390-empty.png) |
| 首次401 (expired) | [主图](1440-expired.png) | [主图](390-expired.png) |
| 首次403 (forbidden) | [主图](1440-forbidden.png) | [主图](390-forbidden.png) |
| 首次429 (rate_limited) | [主图](1440-rate_limited.png) | [主图](390-rate_limited.png) |
| 首次15秒超时 (timeout) | [主图](1440-timeout.png) | [主图](390-timeout.png) |
| 首次依赖失败 (unavailable) | [主图](1440-unavailable.png) | [主图](390-unavailable.png) |
| 仅UI恢复文案 (recovering) | [主图](1440-recovering.png) | [主图](390-recovering.png) |
| 保留旧快照刷新中 (refreshing) | [主图](1440-refreshing.png) | [主图](390-refreshing.png) |
| 旧快照读取超时 (refresh-timeout) | [主图](1440-refresh-timeout.png) | [主图](390-refresh-timeout.png) |
| 旧快照读取限流 (refresh-rate_limited) | [主图](1440-refresh-rate_limited.png) | [主图](390-refresh-rate_limited.png) |
| 旧快照读取失败 (refresh-unavailable) | [主图](1440-refresh-unavailable.png) | [主图](390-refresh-unavailable.png) |
| 无请求ID的异常 (generic-error) | [主图](1440-generic-error.png) | [主图](390-generic-error.png) |
| 成功请求ID披露 (request-detail) | [主图](1440-request-detail.png) | [主图](390-request-detail.png) · [近图](390-request-detail-detail.png) |
| 首次错误请求ID披露 (failure-detail) | [主图](1440-failure-detail.png) | [主图](390-failure-detail.png) |
| 保留快照错误请求ID披露 (refresh-detail) | [主图](1440-refresh-detail.png) | [主图](390-refresh-detail.png) · [近图](390-refresh-detail-detail.png) |
| 模拟复制成功 (copy-success) | [主图](1440-copy-success.png) | [主图](390-copy-success.png) |
| 成功请求ID复制拒绝 (copy-denied) | [主图](1440-copy-denied.png) | [主图](390-copy-denied.png) |
| 首次错误ID复制拒绝 (failure-copy-denied) | [主图](1440-failure-copy-denied.png) | [主图](390-failure-copy-denied.png) |
| 保留快照错误ID复制拒绝 (refresh-copy-denied) | [主图](1440-refresh-copy-denied.png) | [主图](390-refresh-copy-denied.png) |
| 刷新键盘焦点 (focus) | [主图](1440-focus.png) | [主图](390-focus.png) |
| 刷新悬停 (hover) | [主图](1440-hover.png) | [主图](390-hover.png) |
| 刷新按下 (pressed) | [主图](1440-pressed.png) | [主图](390-pressed.png) |
| 审核场景选择器 (review-tools) | [主图](1440-review-tools.png) | [主图](390-review-tools.png) |
<!-- GALLERY:END -->
