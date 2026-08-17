# M00-08 宝塔 S0 骨架范围

S0 当前生产合同只包含一个宝塔网站、一个名为“ai选品”的前台 Node 项目、MySQL 5.7、Redis、发布任务与备份任务。统一 Node 后端以前台进程运行并监督 API 与 Worker，采集执行使用内置通道；不得创建独立 API、Worker、Canary 或 Python 常驻项目。manifest 区分模板与真实部署；发布候选只允许作为同一宝塔发布任务中的临时端口，验收后必须恢复单一 4101 并停止 4103。禁止 systemd、独立 PM2、宿主 crontab和屏外 Docker Compose 承载生产能力。

API 仅监听 127.0.0.1:4101，由网站 Nginx 反代；SSE 关闭代理缓冲。统一后端监督的 Worker 输出不含密钥的结构化心跳并响应 SIGTERM/SIGINT，异常退出由监督器拉起。数据库固定 product_scout/utf8mb4；Redis 仅本机。发布前运行功能门禁；当前数据库、证据和导出由宝塔写入同机独立加密恢复目录，不声明整机或异地灾备能力。

迁移 0007 记录 S0/S1/S2 发布、构建、配置指纹、迁移版本、状态、批准人和 request_id/trace_id。前端依据 `images-html/01_72_page_concepts/64_系统监控.jpg` 展示 checking、healthy、blocked、rollback，覆盖桌面/390px；healthy 必须同时来自 readiness 和脱敏版本身份，并持续标明 S0 容量边界与 M07-04 恢复演练待验收状态。
