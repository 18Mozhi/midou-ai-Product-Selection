# M00-02 配置边界 Runbook

## 校验与调整

复制 `config/env.example` 到本地 `.env`，真实值只写本地或宝塔受限环境。端口为 1–65535；AI 超时为 1–300 秒；`EVIDENCE_ROOT` 与 `EXPORT_ROOT` 不能相同。生产至少配置 12 位数据库密码、32 位会话密钥和 32 位 AES 主密钥。

## 重启

环境变量在进程启动时读取。修改 API/Worker/Crawler 配置后，必须在宝塔面板分别重启受影响项目；修改 `VITE_API_BASE_URL` 后重新构建前端并由宝塔网站发布。不得用 systemd、独立 PM2 或宿主 crontab 重启生产服务。

## 回滚

在宝塔恢复上一组受限环境变量与上一构建，重启对应项目，检查 `/api/v1/health/live` 和 `/api/v1/health/version` 的版本/配置指纹；如已应用迁移且确认没有需要保留的配置版本索引，再执行 `0003_m00_02_config_releases.down.sql`。失败和回滚均保留审计记录。
