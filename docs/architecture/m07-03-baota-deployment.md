# M07-03 S0 宝塔部署

## 范围和真实状态

M07-03 当前部署目标为惠州 `192.168.1.220`、`midouai.mozhiz.cn` 与 `/www/wwwroot/ai选品`。宝塔管理网站、统一 Node 后端 `ai选品`、Python 3.12 采集项目 `ai选品-python`、MySQL 5.7、Redis、备份与日志。生产固定使用 `frontend/backend/python/config/runtime/backups`，不保存 Git、`current` 或 `releases`。独立 API、Worker、Canary 和面板外常驻项目禁止创建。manifest 只有在同提交生产证据、live/ready/version、Worker/Python 心跳与面板日志均通过时才可签发健康。

部署脚本只认识上述六个固定目录、当前一次上传暂存与回滚目录，以及初始化时可迁移的受控 `shared`。脚本不再包含 `current`/`releases` 的迁移或删除分支；根目录存在其他条目时会在停止 Node 前失败关闭，由运维先确认归属并移出，不能由部署器猜测删除。

本地发布还要求 Git 忽略的 `.artifacts/release-change-ownership.json`。清单以一个已发布祖先 commit 为 `baseSha`、当前待发布提交为 `headSha`，并把区间内每个 commit 和每个变更路径精确归入一个带负责人的工作包。缺失、重复、区间外、跨工作包修改同一路径、基线非祖先或 HEAD 漂移均在读取 Windows 凭据和上传前失败关闭。示例结构位于 `verification/release-change-ownership.example.json`；清单是发布审批事实，不上传服务器、不写秘密。

本模块不新增业务表、权限或业务事件，复用可回滚的 `deployment_releases` 保存发布身份、迁移版本、配置指纹、状态、批准人和 request_id/trace_id。生产数据库已按顺序应用 73 个既有 up 迁移。部署页面依据 `images-html/01_72_page_concepts/64_系统监控.jpg` 更新为实时 checking、healthy、blocked、rollback：healthy 同时要求 readiness 和脱敏版本身份，Worker/Crawler 明确由宝塔心跳监测，M07-04 恢复演练不得提前显示成功。

## 运行与安全边界

- 网站只公开 80/443；统一后端内的 API 绑定 `127.0.0.1:4101`，MySQL/Redis 只绑定本机，内部 Worker 不监听公网。
- Nginx 同时反代 `/api/`、`/open/` 和无缓冲 SSE；静态站点回退到 `index.html`，HTTP 强制跳转 HTTPS，并启用 HSTS 与安全响应头。
- API、Worker、Crawler 从 `config/schema.json` 对应环境组读取宝塔受限配置；浏览器只可读取 `VITE_API_BASE_URL`。
- Worker/Crawler 输出结构化心跳并优雅处理 SIGTERM/SIGINT。Node 和 Python 项目都由宝塔展示、启停并轮转日志；日志禁止密码、Cookie、Token、API Key、私钥和主密钥。
- S0 只声明 100 用户和 5–20 并发业务用户，不声明多节点或 10,000 用户能力；M07-04 仅签发同机逻辑隔离恢复，不签发整机或异地灾备。

## 自动证据

`scripts/deploy-baota.py` 在 Git fetch、构建、Windows 凭据读取和上传之前先要求工作树干净，并依次执行 `format:check`、运行文档一致性与发布矩阵门；因此格式或发布合同错误不会拖到远端连接阶段。构建完成后（含 `--skip-build` 复用产物）再执行 `scripts/verify-baota-deployment.mjs --preflight`，校验固定目标、六类基础面板对象、构建产物、本地上传器、配置分组、Nginx、Python 心跳、外部管理器禁令和秘密边界，只有通过才允许打包和读取凭据。`--production` 额外要求 manifest healthy，并读取符合 `verification/baota-production-evidence.schema.json` 的忽略文件；证据 commit 必须等于当前 Git HEAD，并覆盖版本、配置指纹、迁移版本、面板对象、live/ready/version、Worker/Crawler 心跳、MySQL 5.7/utf8mb4、本机 Redis 和宝塔日志。缺失、过期或矛盾时返回 blocked/failed。
