# M07-03 S0 宝塔部署 Runbook

## 发布前

确认 `/www/wwwroot/ai选品` 只包含 `frontend/backend/python/config/runtime/backups`。初始化允许迁移受控 `shared`，但部署器不再识别或删除旧发布目录；发现任何其他根目录条目会在停止服务前失败关闭，必须先人工确认归属并移出，禁止为通过门禁直接递归删除未知目录。

1. 运行 `npm run verify:module -- M07-02` 和 `node scripts/verify-baota-deployment.mjs --preflight`。
2. 在宝塔确认网站、Node 项目“ai选品”和 Python 项目“ai选品-python”均由面板创建和管理；不得保留独立 API、Worker、Canary 或面板外常驻项目，也不要用 systemd、独立 PM2、宿主 crontab或屏外 Docker Compose代替。
3. Node/Python 只读取 `/www/wwwroot/ai选品/config/product_scout.env` 受限环境；秘密只填宝塔受限配置，检查页面、项目环境、日志和任务输出均无秘密。
4. 本地使用锁文件完整安装依赖并构建同一提交，然后运行 `python scripts/deploy-baota.py` 上传运行包；不得在服务器执行 Git 或源码构建。脚本只允许执行内置白名单中的升序迁移，校验迁移校验值后切换固定目录，并通过宝塔接口更新或重启“ai选品”和“ai选品-python”；不会创建面板外服务。
5. 合并 Nginx 模板并在宝塔执行配置检查；确认 `/api/`、`/open/`、SSE 和 SPA 回退。TLS 由宝塔网站签发，DNS/NAT 未完成时不得宣称公网可用。

## 生产验收

读取 `/api/v1/health/live`、`ready` 和 `version`，核对 build SHA、迁移版本、配置指纹与本次签发一致。宝塔日志中确认统一后端父进程、API 与 Worker 子进程都在运行、Worker 最近 60 秒内有结构化心跳，并确认 `ai选品-python` 持续输出脱敏心跳；MySQL 必须是 5.7/utf8mb4/product_scout 业务账号，Redis 不可公网访问。面板内确认站点、Node、Python、MySQL、Redis、发布任务和 M07-04 备份对象可查看、启停、重启和查看日志。

需要同提交发布签发时，临时把上述非秘密事实写入 `.artifacts/verification/baota-production-evidence.json`，设置 `SCOUTOPS_REQUIRE_PRODUCTION_EVIDENCE=1` 后执行生产证据门；验收结束必须删除该临时文件。不得包含面板地址安全入口、用户名、密码、Cookie、API 密钥或环境值。日常 `npm run verify:functional` 始终执行部署结构预检，但不依赖必须被清理的临时证据。manifest 当前已签发为 `deploymentStatus=healthy`、`productionDeployed=true`；每次需要新 commit 发布签发时必须重新采集证据，使证据 commit 等于当前 Git HEAD，再执行 `node scripts/verify-baota-deployment.mjs --production`。若现场状态退化，立即撤销 healthy 签发或恢复稳定发布，不得沿用旧证据。

## 故障与回滚

- 初次部署时目标或证据缺失：保持 blocked 和 `productionDeployed=false`；当前已签发环境如统一 Node、Python Crawler 或部署证据缺失，则保持 `productionDeployed=true` 但使 M07-03/M07-05 生产门失败，先在宝塔修复既有对象，不能把缺失写成通过。
- Nginx 检查失败：不重载，保留当前有效配置，修复模板后重试。
- ready 失败：保持网站维护入口，按依赖字段检查 MySQL/Redis 与受限配置；不能用缓存状态伪装健康。
- Worker 心跳过期或 API 子进程退出：在宝塔检查“ai选品”启动配置、监督器日志和租约。Python 心跳过期则检查并重启“ai选品-python”；不启动面板外替代进程。
- 版本或配置指纹不一致：停止签发，恢复同一上一稳定 commit 与环境快照。

回滚时先冻结新写入，在本地切到上一签发提交并重新运行固定目录部署，按数据影响决定是否逆序迁移，然后由宝塔重启 Node/Python，重新验证 live/ready/version、子进程心跳与审计。不得删除失败发布记录、`config/runtime/backups` 或审计证据。M07-04 完成后也只能声明同机逻辑恢复，不可声称整机或异地灾备能力。
