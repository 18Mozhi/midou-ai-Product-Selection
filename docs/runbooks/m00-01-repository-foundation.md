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

生产只能在宝塔面板中分别建立网站、Node API、Node Worker 和 Python Crawler 对象。当前模块只交付进程入口，不执行生产部署。网站反向代理 `/api/` 到本机 API；API、Worker、Crawler、MySQL 和 Redis 均不得直接暴露公网。

## 故障与恢复

- API 无响应：在宝塔项目日志中按 request_id/trace_id 定位；确认 `APP_HOST`、`APP_PORT` 后由宝塔重启 API。
- Worker/Crawler 启动失败：保留失败日志，不将状态报告为可用；修复配置后由宝塔重启对应项目。
- 迁移失败：停止新入口，保留失败记录；确认没有未发布 Outbox 数据后执行 `0001_m00_01_foundation.down.sql`。审计或证据不得为掩盖失败而删除。

## 回滚

1. 在宝塔网站关闭新增入口或回退静态包。
2. 在宝塔分别回退 API、Worker、Crawler 代码版本并重启。
3. 仅在已备份并确认无待发布事件时执行向下迁移。
4. 重新检查 `/api/v1/health/live`，记录回滚版本、操作者、时间、原因和 request_id/trace_id。
