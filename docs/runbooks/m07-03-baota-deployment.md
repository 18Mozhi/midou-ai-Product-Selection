# M07-03 S0 宝塔部署 Runbook

## 发布前

1. 运行 `npm run verify:module -- M07-02` 和 `node scripts/verify-baota-deployment.mjs --preflight`。
2. 在宝塔确认目标网站与唯一一个名为“ai选品”的 Node 后端均由面板创建和管理；不得保留独立 API、Worker、Canary 或 Python 常驻项目，也不要用 systemd、独立 PM2、宿主 crontab或屏外 Docker Compose代替。
3. 统一后端只读取一组宝塔受限环境；秘密只填宝塔受限配置，检查页面、项目环境、日志和任务输出均无秘密。
4. 使用 `npm ci` 完整安装锁文件依赖并构建同一 commit；不得排除 Vite/Rollup 所需的平台可选包。数据库升序迁移后，由宝塔重启“ai选品”统一后端，再发布 Web。
5. 合并 Nginx 模板并在宝塔执行配置检查；确认 `/api/`、`/open/`、SSE 和 SPA 回退。TLS 由宝塔网站签发，DNS/NAT 未完成时不得宣称公网可用。

## 生产验收

读取 `/api/v1/health/live`、`ready` 和 `version`，核对 build SHA、迁移版本、配置指纹与本次签发一致。宝塔日志中确认统一后端父进程、API 与 Worker 子进程都在运行且 Worker 最近 60 秒内有结构化心跳；MySQL 必须是 5.7/utf8mb4/product_scout 业务账号，Redis 不可公网访问。面板内确认站点、“ai选品”统一后端、MySQL、Redis、发布任务和 M07-04 备份对象可查看、启停、重启和查看日志。

需要同提交发布签发时，临时把上述非秘密事实写入 `.artifacts/verification/baota-production-evidence.json`，设置 `SCOUTOPS_REQUIRE_PRODUCTION_EVIDENCE=1` 后执行生产证据门；验收结束必须删除该临时文件。不得包含面板地址安全入口、用户名、密码、Cookie、API 密钥或环境值。日常 `npm run verify:functional` 始终执行部署结构预检，但不依赖必须被清理的临时证据。manifest 当前已签发为 `deploymentStatus=healthy`、`productionDeployed=true`；每次需要新 commit 发布签发时必须重新采集证据，使证据 commit 等于当前 Git HEAD，再执行 `node scripts/verify-baota-deployment.mjs --production`。若现场状态退化，立即撤销 healthy 签发或恢复稳定发布，不得沿用旧证据。

## 故障与回滚

- 初次部署时目标或证据缺失：保持 blocked 和 `productionDeployed=false`；当前已签发环境如候选 API 或发布任务证据缺失，则保持 `productionDeployed=true` 但使 M07-03/M07-05 生产门失败，先在宝塔修复对象，不能把缺失写成通过。
- Nginx 检查失败：不重载，保留当前有效配置，修复模板后重试。
- ready 失败：保持网站维护入口，按依赖字段检查 MySQL/Redis 与受限配置；不能用缓存状态伪装健康。
- Worker 心跳过期或 API 子进程退出：在宝塔检查“ai选品”统一后端启动配置、监督器拉起日志和租约；不启动独立或面板外替代进程。
- 版本或配置指纹不一致：停止签发，恢复同一上一稳定 commit 与环境快照。

回滚时先冻结新写入，在宝塔恢复上一签发构建和环境，按数据影响决定是否逆序迁移，然后由宝塔重启“ai选品”统一后端、恢复 Web，重新验证 live/ready/version、子进程心跳与审计。不得删除失败发布记录或审计证据。M07-04 完成后也只能声明同机逻辑恢复，不可声称整机或异地灾备能力。
