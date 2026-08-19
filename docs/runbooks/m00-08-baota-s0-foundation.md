# M00-08 宝塔 S0 骨架 Runbook

完整目录、创建、更新、重启与回滚顺序见 `infra/baota/README.md`。本地运行 `npm run build`、`node scripts/verify-baota-s0.mjs`、`node --test tests/m00-08/baota-s0.test.mjs` 与 `npm run verify:module -- M00-08`。首次整理运行 `python scripts/deploy-baota.py --initialize-layout`，以后更新运行 `python scripts/deploy-baota.py`；服务器不执行 Git 或源码构建。

环境变量和密钥只保存在 `/www/wwwroot/ai选品/config/product_scout.env`。生产设置 `WORKER_SCHEDULER_STATE_FILE=/www/wwwroot/ai选品/runtime/worker-scheduler.json`；`WORKER_MAX_CONCURRENCY` 控制统一 Worker 的全局并发配额，`WORKER_SCHEDULER_TICK_MS` 控制到期队列检查频率，`WORKER_SCHEDULER_STALE_AFTER_SECONDS` 控制业务可用性心跳门限。改任一 `WORKER_*` 后在宝塔重启 `ai选品`，改 `CRAWLER_HEARTBEAT_SECONDS` 后重启 `ai选品-python`。发布时分别检查 API live、ready、available、version，系统状态页的队列等待数、最长延迟、失败率、背压和连续重启告警，以及 Crawler 最新任务结果、Redis/MySQL 和备份任务。状态文件只包含脱敏调度指标，日志只能从宝塔查看与轮转。

## 回滚

冻结新写入，在本地切到目标提交后重新运行固定目录部署命令；按影响确认后逆序迁移，再从宝塔重启 Node/Python，验证健康、心跳和审计。执行 `0007_m00_08_deployment_releases.down.sql` 前导出发布记录。不得删除 `config/runtime/backups`，不得用面板外进程临时顶替。
