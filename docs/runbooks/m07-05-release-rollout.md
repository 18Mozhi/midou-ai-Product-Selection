# M07-05 宝塔发布与回滚 Runbook

## 发布前

在宝塔创建同机私有 Node 项目 `product-scout-api-canary`，形成 4101/4103 两个发布槽。首次发布把候选 release 放在 4103，`RELEASE_STABLE_API_PORT=4101`、`RELEASE_CANDIDATE_API_PORT=4103`；成功后下一版本放在 4101，并对调两个变量。两个槽只能监听 `127.0.0.1`，不得覆盖当前稳定槽后再开始灰度。创建手工计划任务 `product-scout-release-rollout`，命令为 `node <candidate>/scripts/run-baota-release-rollout.mjs --run --env-file <宝塔受限环境文件>`。不得通过 SSH 前台、systemd、独立 PM2 或宿主 crontab 常驻运行。

受限环境必须按 `config/env.example` 设置 release、Nginx、端口、采样、阈值、数据库和应用身份变量。生产 `RELEASE_CANARY_OBSERVE_SECONDS` 不得低于 1800。候选 `BUILD_SHA` 必须等于候选 `/health/version`，Nginx 配置必须在 `/www/server/panel/vhost/nginx/`，计时日志必须在 `/www/wwwlogs/`。真实密码、Cookie、Token、私钥和 `.env` 不得复制到任务日志或仓库。

## 执行与观察

1. 在宝塔确认稳定/候选 API 的 live、ready、version，确认 MySQL 5.7、Redis、Worker、Crawler 正常。
2. 运行 M07-01、M07-02、M07-04 门禁并确认最近隔离恢复为 verified。
3. 从宝塔手工执行发布任务。任务依次配置 5%、25%、100%，每阶段至少观察 30 分钟；宝塔日志应持续显示 request_id/trace_id，但不显示秘密。
4. 在 `/platform-admin/releases` 查看当前 release、三阶段样本、5xx、读写 P95、异步延迟和阻断项。API 只读，不能从浏览器触发发布。
5. 生产证据写入 Git 忽略的 `.artifacts/verification/release-rollout-production-evidence.json`，再执行 `node scripts/verify-release-rollout-production.mjs --production`。

## 自动停止与人工回滚

脚本在样本不足或阈值超限时自动把 candidate 比例改为 0%，Nginx 检查通过后 reload，并记录 automatic_stop/rollback。若任务进程异常退出，在宝塔将 `000-product-scout-release-upstream.conf` 设为只含本次 `RELEASE_STABLE_API_PORT`，先运行宝塔 Nginx 配置检查再 reload。确认公网 `/health/version` 返回稳定构建后，在宝塔停止失败候选槽。不要删除失败 release、gate/event、备份或审计记录。

本模块只提供同机应用版本回滚。主机、磁盘、站点或 MySQL 故障不能靠候选项目恢复；当前没有备用服务器。
