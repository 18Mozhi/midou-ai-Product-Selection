# ai选品宝塔对象模板

本目录定义 `ai选品` 的宝塔生产对象。目标是惠州 `192.168.1.220`、域名 `midouai.mozhiz.cn`、项目根目录 `/www/wwwroot/ai选品`。生产只创建一个名为 `ai选品` 的前台 Node 项目，由 `node apps/backend/dist/server.js` 统一监督 API 与 Worker；网站、MySQL 5.7、Redis、备份和统一后端均在宝塔中可见和可操作。独立 API、Worker、Canary、Python 常驻项目以及任务结束后的临时验收任务均应删除。

发布顺序：拉取签发构建到新版本目录 → `npm ci` → `npm run build` → 升序迁移 → 全量功能门 → 原子切换 `current` → 在宝塔重启 `ai选品` → 检查 live/ready/version、Worker 心跳和日志 → 发布网站。任一步失败即恢复上一 `current` 并通过宝塔重启。Nginx 只反代本机 `4101`，不创建第二后端。

发布或验收所需的宝塔有限任务只允许手工、单实例运行，并在任务完成后删除；不得把临时任务保留为生产对象。

本地或 CI 运行 `node scripts/verify-baota-deployment.mjs --preflight` 只证明发布包可用。每次发布后都要重新生成不含秘密的 `.artifacts/verification/baota-production-evidence.json`，并运行 `node scripts/verify-baota-deployment.mjs --production`；证据 commit 必须等于当前 Git HEAD。缺少、过期或矛盾的证据必须返回 blocked，不能人工跳过。

回滚顺序：冻结新写入 → 在宝塔恢复上一构建/环境 → 逆序执行本次迁移 down（确认数据影响后）→ 重启后台项目 → 验证健康与审计 → 恢复网站。数据库、证据、导出由宝塔写入当前主机内独立加密恢复目录；它不保护整机故障。生产不得用 systemd、独立 PM2、宿主 crontab 或屏外 Docker Compose。

宝塔官方依据：命令行工具 <https://docs.bt.cn/getting-started/bt-command-line-tool>；资源管理工具 <https://docs.bt.cn/getting-started/btcli-interactive-tool>；API 总览 <https://docs.bt.cn/api/>。官方说明 API 可能随面板版本变化，因此本仓库不猜未公开的 Node/Python 项目接口；真实创建使用面板，自动验收使用应用健康、心跳、依赖与脱敏面板对象证据。
