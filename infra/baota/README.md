# ScoutOps 宝塔 S0 对象模板

本目录只定义发布对象，不表示生产已经部署。按 `service-manifest.json` 在惠州主机宝塔面板依次创建 MySQL 5.7、Redis、Node API、Node Worker、Python Crawler、网站、手动发布门禁和备份任务；真实环境变量逐个填写在宝塔受限配置，不复制到仓库或截图。

发布顺序：备份 → 拉取签发构建 → 安装锁定依赖 → `npm run build` → 升序迁移 → `npm run verify:phase -- P00` → 在宝塔重启 API/Worker/Crawler → 检查 live/ready/心跳 → 发布网站。Nginx 片段只粘贴到宝塔网站配置，替换域名/TLS 由宝塔完成。

回滚顺序：冻结新写入 → 在宝塔恢复上一构建/环境 → 逆序执行本次迁移 down（确认数据影响后）→ 重启后台项目 → 验证健康与审计 → 恢复网站。数据库、证据、导出备份目标保持深圳，生产不得用 systemd、独立 PM2、宿主 crontab 或屏外 Docker Compose。
