# M00-08 宝塔 S0 骨架 Runbook

完整创建顺序与回滚顺序见 `infra/baota/README.md`。本地运行 `npm run build`、`node scripts/verify-baota-s0.mjs`、`node --test tests/m00-08/baota-s0.test.mjs` 与 `npm run verify:module -- M00-08`。preflight 只验证模板、构建产物、Python once 心跳和禁用命令，不证明宝塔生产对象存在。

环境变量和密钥只填宝塔受限配置；改 `WORKER_HEARTBEAT_MS` 或 `CRAWLER_HEARTBEAT_SECONDS` 后在宝塔重启对应项目。发布时检查 API live/ready、Worker/Crawler 最新心跳、Redis/MySQL 和备份任务。日志只能从宝塔查看与轮转。

## 回滚

冻结新写入并在宝塔恢复上一构建/环境，按影响确认后逆序迁移，重启 API/Worker/Crawler，验证健康、心跳和审计，再切回网站。执行 `0007_m00_08_deployment_releases.down.sql` 前导出发布记录。不得删除数据库或文件备份，不得用面板外进程临时顶替。
