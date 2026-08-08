# ScoutOps 宝塔 S0 对象模板

本目录定义并记录 M07-03 已签发的 S0 生产对象；`productionDeployed=true` 与 `deploymentStatus=healthy` 仅在脱敏生产证据、当前 Git commit 和实时健康检查一致时成立。目标是惠州 `192.168.1.220` 与 `midouai.mozhiz.cn`；MySQL 5.7、Redis、Node API、Node Worker、Python Crawler、网站和手动发布门禁均由宝塔面板管理。备份任务已创建，实际恢复演练仍由 M07-04 完成。真实环境变量只保存在宝塔受限配置，不复制到仓库、报告或截图。

发布顺序：确认 M07-04 备份前置能力 → 拉取签发构建 → `npm ci` → `npm run build` → 升序迁移 → `npm run verify:module -- M07-02` → 在宝塔重启 API/Worker/Crawler → 检查 live/ready/version、心跳和日志 → 发布网站。Nginx 片段只合并到宝塔网站配置，TLS 证书由宝塔网站管理；`/api/`、`/open/` 和 SSE 均只反代本机 API。

本地或 CI 运行 `node scripts/verify-baota-deployment.mjs --preflight` 只证明发布包可用。每次发布后都要重新生成不含秘密的 `.artifacts/verification/baota-production-evidence.json`，并运行 `node scripts/verify-baota-deployment.mjs --production`；证据 commit 必须等于当前 Git HEAD。缺少、过期或矛盾的证据必须返回 blocked，不能人工跳过。

回滚顺序：冻结新写入 → 在宝塔恢复上一构建/环境 → 逆序执行本次迁移 down（确认数据影响后）→ 重启后台项目 → 验证健康与审计 → 恢复网站。数据库、证据、导出由宝塔写入当前主机内独立加密恢复目录；它不保护整机故障。生产不得用 systemd、独立 PM2、宿主 crontab 或屏外 Docker Compose。

宝塔官方依据：命令行工具 <https://docs.bt.cn/getting-started/bt-command-line-tool>；资源管理工具 <https://docs.bt.cn/getting-started/btcli-interactive-tool>；API 总览 <https://docs.bt.cn/api/>。官方说明 API 可能随面板版本变化，因此本仓库不猜未公开的 Node/Python 项目接口；真实创建使用面板，自动验收使用应用健康、心跳、依赖与脱敏面板对象证据。
