# M00-08 宝塔 S0 骨架范围

S0 当前合同包含宝塔网站、稳定 Node API、同机候选 Node API、Node Worker、Python Crawler、MySQL 5.7、Redis、手动发布门禁、手工渐进发布任务与备份任务十个对象。manifest 区分模板与真实部署；M07-03 完成现场创建和签发后当前为 `productionDeployed=true`，M07-05 只增加同机候选发布对，不增加备用服务器。禁止 systemd、独立 PM2、宿主 crontab和屏外 Docker Compose 承载生产能力。

API 仅监听 127.0.0.1:4101，由网站 Nginx 反代；SSE 关闭代理缓冲。Worker/Crawler 输出不含密钥的结构化心跳并响应 SIGTERM/SIGINT。数据库固定 product_scout/utf8mb4；Redis 仅本机。发布前运行阶段门禁；当前数据库、证据和导出由宝塔写入同机独立加密恢复目录，不声明整机或异地灾备能力。

迁移 0007 记录 S0/S1/S2 发布、构建、配置指纹、迁移版本、状态、批准人和 request_id/trace_id。前端依据 `images-html/01_72_page_concepts/64_系统监控.jpg` 展示 checking、healthy、blocked、rollback，覆盖桌面/390px；healthy 必须同时来自 readiness 和脱敏版本身份，并持续标明 S0 容量边界与 M07-04 恢复演练待验收状态。
