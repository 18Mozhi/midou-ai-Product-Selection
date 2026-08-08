# M07-03 S0 宝塔部署

## 范围和真实状态

M07-03 将 M00-08 骨架部署到惠州 `192.168.1.220` 与 `midouai.mozhiz.cn`。宝塔面板内已创建并管理网站、Node API、Node Worker、Python Crawler、MySQL 5.7、Redis、手动发布门禁、备份和日志轮转任务；公网 HTTPS、TLS 1.2/1.3、API live/ready/version、Worker/Crawler 心跳与秘密扫描均通过现场核验。manifest 因此签发为 `productionDeployed=true`、`deploymentStatus=healthy`。

本模块不新增业务表、权限或业务事件，复用可回滚的 `deployment_releases` 保存发布身份、迁移版本、配置指纹、状态、批准人和 request_id/trace_id。生产数据库已按顺序应用 73 个既有 up 迁移。部署页面依据 `images-html/01_72_page_concepts/64_系统监控.jpg` 更新为实时 checking、healthy、blocked、rollback：healthy 同时要求 readiness 和脱敏版本身份，Worker/Crawler 明确由宝塔心跳监测，M07-04 恢复演练不得提前显示成功。

## 运行与安全边界

- 网站只公开 80/443；API 绑定 `127.0.0.1:4101`，MySQL/Redis 只绑定本机，Worker/Crawler 不监听公网。
- Nginx 同时反代 `/api/`、`/open/` 和无缓冲 SSE；静态站点回退到 `index.html`，HTTP 强制跳转 HTTPS，并启用 HSTS 与安全响应头。
- API、Worker、Crawler 从 `config/schema.json` 对应环境组读取宝塔受限配置；浏览器只可读取 `VITE_API_BASE_URL`。
- Worker/Crawler 输出结构化心跳并优雅处理 SIGTERM/SIGINT。宝塔统一展示和轮转站点、项目与任务日志；日志禁止密码、Cookie、Token、API Key、私钥和主密钥。
- S0 只声明 100 用户和 5–20 并发业务用户，不声明多节点或 10,000 用户能力；深圳恢复目标必须到 M07-04 演练通过后才能签发。

## 自动证据

`scripts/verify-baota-deployment.mjs --preflight` 校验固定目标、八个面板对象、构建产物、配置分组、Nginx、Python 心跳、外部管理器禁令和秘密边界。`--production` 额外要求 manifest healthy，并读取符合 `verification/baota-production-evidence.schema.json` 的忽略文件；证据 commit 必须等于当前 Git HEAD，并覆盖版本、配置指纹、迁移版本、八个面板对象、live/ready/version、Worker/Crawler 心跳、MySQL 5.7/utf8mb4、本机 Redis 和宝塔日志。缺失、过期或矛盾时返回 blocked/failed。
