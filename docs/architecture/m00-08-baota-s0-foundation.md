# M00-08 宝塔 S0 骨架范围

S0 当前生产合同包含一个宝塔网站、一个名为“ai选品”的统一 Node 项目、一个名为“ai选品-python”的 Python 3.12 项目、MySQL 5.7、Redis、发布任务与备份任务。固定目录分别为 `frontend`、`backend`、`python`、`config`、`runtime`、`backups`；服务器不保存 Git 工作树、`current` 或 `releases`。统一 Node 后端监督 API 与 Worker，Python 项目承载采集心跳与 Python-to-Playwright 桥接；不得创建独立 API、Worker、Canary 或面板外常驻项目。禁止 systemd、独立 PM2、宿主 crontab和屏外 Docker Compose 承载生产能力。

API 仅监听 127.0.0.1:4101，由网站 Nginx 反代；SSE 关闭代理缓冲。Node 和 Python 都由宝塔创建、启停和记录日志，Worker/Python 输出不含密钥的结构化心跳并响应 SIGTERM/SIGINT。数据库固定 product_scout/utf8mb4；Redis 仅本机。代码在本地构建后直接上传运行包，生产数据库、证据和导出由宝塔写入同机独立加密恢复目录，不声明整机或异地灾备能力。

迁移 0007 记录 S0/S1/S2 发布、构建、配置指纹、迁移版本、状态、批准人和 request_id/trace_id。前端依据 `images-html/01_72_page_concepts/64_系统监控.jpg` 展示 checking、healthy、blocked、rollback，覆盖桌面/390px；healthy 必须同时来自 readiness 和脱敏版本身份，并持续标明 S0 容量边界与 M07-04 恢复演练待验收状态。
