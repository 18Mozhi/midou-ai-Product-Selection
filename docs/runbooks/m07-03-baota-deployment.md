# M07-03 S0 宝塔部署 Runbook

## 发布前

确认 `/www/wwwroot/ai选品` 只包含 `frontend/backend/python/config/runtime/backups`。初始化允许迁移受控 `shared`，但部署器不再识别或删除旧发布目录；发现任何其他根目录条目会在停止服务前失败关闭，必须先人工确认归属并移出，禁止为通过门禁直接递归删除未知目录。

1. 运行 `npm run verify:module -- M07-02` 和 `node scripts/verify-baota-deployment.mjs --preflight`。
2. 复制 `verification/release-change-ownership.example.json` 为 Git 忽略的 `.artifacts/release-change-ownership.json`，把 `baseSha` 设为上次已发布 commit、`headSha` 设为当前 HEAD，并按实际工作包填写负责人、commit 与变更路径。路径清单须覆盖区间内每个 commit 触及的路径，包括随后在同一区间删除或恢复的文件。运行 `npm run verify:release-ownership`；漏项、重复归属、区间外变更、同一路径跨工作包或 HEAD 漂移必须先修正，禁止把未知并行变更统归到当前任务。
3. 在宝塔确认网站、Node 项目“ai选品”和 Python 项目“ai选品-python”均由面板创建和管理；不得保留独立 API、Worker、Canary 或面板外常驻项目，也不要用 systemd、独立 PM2、宿主 crontab或屏外 Docker Compose代替。
4. Node/Python 只读取 `/www/wwwroot/ai选品/config/product_scout.env` 受限环境；秘密只填宝塔受限配置，检查页面、项目环境、日志和任务输出均无秘密。2026-09-07 已完成生产目录及两个宝塔项目名称的 UTF-8 规范化；部署器在上传前校验远端根目录文件名字节，编码漂移时失败关闭，禁止通过 SSH 手工重命名绕过面板记录。
5. 本地使用锁文件完整安装依赖，然后运行 `python scripts/deploy-baota.py` 上传运行包；不得在服务器执行 Git 或源码构建。脚本在 Git fetch 和构建前自动执行格式、运行文档与发布矩阵门，构建后自动执行固定宝塔产物 preflight；任一失败都不会读取 Windows 凭据或连接服务器。随后脚本校验发布归属清单，只允许执行内置白名单中的升序迁移，校验迁移校验值后切换固定目录，并通过宝塔接口更新或重启“ai选品”和“ai选品-python”；既有 Python 项目配置更新后，必须按固定名称/路径二次核对并通过宝塔 `restart_project.py python ai选品-python` 重启，避免旧解释器继续加载上一版代码。部署失败回滚 Python 运行包时也会重启既有 Python 项目；不会创建面板外服务。机会详情依赖的 `0065_opportunity_operating_feedback.up.sql` 必须位于 `0064` 与 `0066` 之间执行并登记，缺少时不得继续签发生产机会路由。
6. 部署器只在网站 ID 29、域名与固定路径全部匹配后更新宝塔 Nginx：由当前路由目录生成 `/www/wwwroot/ai选品/config/nginx-spa-routes.conf`，登记的 SPA 深链返回 200，随机未登记路径返回应用 fallback 正文并保留 HTTP 404。为避免宝塔默认 `error_page 404 /404.html` 抢先返回静态错误页，部署器只移除其 `#ERROR-PAGE-START` 块中的精确默认映射；修改前备份，随后执行 `nginx -t` 和 reload，失败从 `/www/wwwroot/ai选品/backups/nginx` 的同提交备份恢复。继续确认 `/api/`、`/open/` 与 SSE 不受 SPA 错误页拦截。TLS 由宝塔网站签发，DNS/NAT 未完成时不得宣称公网可用。

## 生产验收

### 2026-10-15 已确认的运维边界

部署器随运行包交付 M07-06 的 `scripts/run-baota-selection-acceptance.mjs` 与 `infra/baota/selection-acceptance-manifest.json`；不会自动执行。后续通过宝塔手动有限任务运行，凭证只从受限环境读取；缺少专用普通成员账号时保持受阻，不生成账号、不复用管理员。该打包修复需要下次固定目录部署才会到生产，不要求现在单独重启服务。

- 用户确认维持现行全部生产验收门；软件测试通过不能代替生产验收，不删除、跳过或自动签收生产门。
- Python 项目 `ai选品-python` 的宝塔运行日志切割任务 ID 为 `69`，已启用：每日服务器时间 `02:00` 切割，压缩并保留 `30` 份；这是份数而非承诺保留 30 天。通过宝塔 Python 项目日志切割设置调整，不直接编辑宿主 crontab。配置无需重启 Python；本次未立即执行切割或删除旧日志。原项目日志策略保存在服务器受限备份 `/www/wwwroot/ai选品/backups/python-log-policy-20261015.json`，恢复时通过宝塔项目模型处理，不覆盖其他项目的共享策略。
- 用户明确要求 MySQL 保持现状并接受公网访问；本次不调整账号授权、监听、防火墙或网络映射。2026-10-15 已进一步明确批准 MySQL 3306 公网访问为唯一例外，证据如实登记该例外而不伪称全部私有，也不豁免其他现行生产门；应用仍使用既有本机业务账号连接，不改运行时数据库合同。公网可达范围应按实际网络检查确认，不能仅凭防火墙允许规则认定外网连通。

按产品总纲与 M03-04/M08-05 当前合同，Python 无待处理作业时领取接口返回 204，不发送空闲心跳。此时应核对宝塔项目进程/版本、同进程发出的新鲜领取请求及真实 204 响应；只有执行期间才核对作业租约心跳与 `running/completed` 日志。长时间空闲时，最后一条 Python 日志可能早于本次重启，不能据此断言当前失败，也不能伪造持续心跳或把 PID 存在当作健康证明。领取请求仍失败时保持受阻；204 只证明空闲领取链路，不证明外部来源采集或登录成功。本条仅纠正文档，不要求重启服务。

读取 `/api/v1/health/live`、`ready` 和 `version`，核对 build SHA、迁移版本、配置指纹与本次签发一致。宝塔日志中确认统一后端父进程、API 与 Worker 子进程都在运行、Worker 最近 60 秒内有结构化心跳；`ai选品-python` 按上述空闲/执行分支分别核验，不要求空闲心跳。MySQL 必须是 5.7/utf8mb4/product_scout 业务账号，Redis 不可公网访问。面板内确认站点、Node、Python、MySQL、Redis、发布任务和 M07-04 备份对象可查看、启停、重启和查看日志。

需要同提交发布签发时，临时把上述非秘密事实写入 `.artifacts/verification/baota-production-evidence.json`，设置 `SCOUTOPS_REQUIRE_PRODUCTION_EVIDENCE=1` 后执行生产证据门；验收结束必须删除该临时文件。不得包含面板地址安全入口、用户名、密码、Cookie、API 密钥或环境值。日常 `npm run verify:functional` 始终执行部署结构预检，但不依赖必须被清理的临时证据。manifest 当前已签发为 `deploymentStatus=healthy`、`productionDeployed=true`；每次需要新 commit 发布签发时必须重新采集证据，使证据 commit 等于当前 Git HEAD，再执行 `node scripts/verify-baota-deployment.mjs --production`。若现场状态退化，立即撤销 healthy 签发或恢复稳定发布，不得沿用旧证据。

## 故障与回滚

- 初次部署时目标或证据缺失：保持 blocked 和 `productionDeployed=false`；当前已签发环境如统一 Node、Python Crawler 或部署证据缺失，则保持 `productionDeployed=true` 但使 M07-03/M07-05 生产门失败，先在宝塔修复既有对象，不能把缺失写成通过。
- 切换后的 Nginx、Node 或 Python 步骤失败：部署器恢复上一版 `frontend/backend/python`、`release.env` 与 Nginx，并通过宝塔重启 Node 和既有 Python 项目；同时删除当前 SHA 的 stage/upload。先确认公网 `ready/version` 已回到上一版，再修复错误重试；如输出包含 `rollback failed`，保留回滚目录并停止自动重试，按错误逐项恢复。
- ready 失败：保持网站维护入口，按依赖字段检查 MySQL/Redis 与受限配置；不能用缓存状态伪装健康。
- Worker 心跳过期或 API 子进程退出：在宝塔检查“ai选品”启动配置、监督器日志和租约。Python 心跳过期则检查并重启“ai选品-python”；不启动面板外替代进程。
- 版本或配置指纹不一致：停止签发，恢复同一上一稳定 commit 与环境快照。

回滚时先冻结新写入，在本地切到上一签发提交并重新运行固定目录部署，按数据影响决定是否逆序迁移，然后由宝塔重启 Node/Python，重新验证 live/ready/version、子进程心跳与审计。不得删除失败发布记录、`config/runtime/backups` 或审计证据。M07-04 完成后也只能声明同机逻辑恢复，不可声称整机或异地灾备能力。

2026-10-19自动新增投影也遵循现有AUTOMATIC_SOURCE_QUEUE_BACKLOG_LIMIT；详情/货源已完成结果继续消费。Node Worker启动读取该值，修改配置或发布代码后须由宝塔重启ai选品，单独此项不需Python重启。准入并非全局原子硬预留；见[自动新增投影背压](../selection-automatic-fanout-backpressure.md)。
