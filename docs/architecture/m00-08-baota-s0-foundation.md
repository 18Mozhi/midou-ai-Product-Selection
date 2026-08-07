# M00-08 宝塔 S0 骨架范围

S0 模板包含宝塔网站、Node API、Node Worker、Python Crawler、MySQL 5.7、Redis、手动发布门禁与备份任务八个对象。manifest 永久区分模板与真实部署：当前 `productionDeployed=false`。禁止 systemd、独立 PM2、宿主 crontab和屏外 Docker Compose 承载生产能力。

API 仅监听 127.0.0.1:4101，由网站 Nginx 反代；SSE 关闭代理缓冲。Worker/Crawler 输出不含密钥的结构化心跳并响应 SIGTERM/SIGINT。数据库固定 product_scout/utf8mb4；Redis 仅本机。发布前运行阶段门禁，数据库、证据和导出由宝塔备份到深圳恢复目标。

迁移 0007 记录 S0/S1/S2 发布、构建、配置指纹、迁移版本、状态、批准人和 request_id/trace_id。前端依据 `images-html/01_72_page_concepts/64_系统监控.jpg` 展示 preflight、ready-template、rollback，覆盖桌面/390px，持续标明“未部署”和 S0 容量边界。
