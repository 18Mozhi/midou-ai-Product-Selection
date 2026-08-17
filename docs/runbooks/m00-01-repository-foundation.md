# M00-01 仓库骨架 Runbook

## 本地构建与检查

```powershell
npm install
npm run verify:module -- M00-01
```

单独启动时，先构建共享合同，再启动对应进程：

```powershell
npm run build:contracts
npm run dev:api
npm run dev:web
npm run dev:worker
$env:PYTHONPATH='apps/crawler'; python -m scoutops_crawler
```

Web 默认 `127.0.0.1:5173`，Node API 默认 `127.0.0.1:4101`。配置变化需重启对应 Node/Vite/Python 进程；这些命令仅用于开发，不创建生产守护进程。

## 宝塔运行边界

生产只在宝塔面板中建立网站和一个名为“ai选品”的统一 Node 后端对象。统一后端监督 API、Worker 和按需采集执行通道；Python/Playwright 代码只能作为该后端按需拉起的子执行器，不能再建立独立 Node Worker、Python Crawler 或候选常驻项目。网站反向代理 `/api/` 到本机 4101；后端、MySQL 和 Redis 均不得直接暴露公网。

## 故障与恢复

- API 无响应：在宝塔“ai选品”项目日志中按 request_id/trace_id 定位；确认 `APP_HOST`、`APP_PORT` 后由宝塔重启统一后端。
- Worker 或采集执行通道启动失败：统一后端必须在健康检查中失败关闭并保留日志；修复配置后只由宝塔重启“ai选品”，不得另建生产项目绕过故障。
- 迁移失败：停止新入口，保留失败记录；确认没有未发布 Outbox 数据后执行 `0001_m00_01_foundation.down.sql`。审计或证据不得为掩盖失败而删除。

## 回滚

1. 在宝塔网站关闭新增入口或回退静态包。
2. 在宝塔回退统一发布目录，并重启唯一的“ai选品”后端。
3. 仅在已备份并确认无待发布事件时执行向下迁移。
4. 重新检查 `/api/v1/health/live`，记录回滚版本、操作者、时间、原因和 request_id/trace_id。
