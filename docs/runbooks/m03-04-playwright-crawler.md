# M03-04 Playwright Crawler 运维手册

## 宝塔配置

生产中保留统一 Node 后端宝塔项目 `ai选品` 和 Python 3.12 宝塔项目 `ai选品-python`。Node Worker 唯一领取业务采集任务并为登录型子查询排队浏览器作业；Python 项目只在领取到该作业后维持租约并通过 Python-to-Playwright 桥接执行，空闲时不发送心跳。任务子进程读取 `PLAYWRIGHT_NODE_BINARY` 和 `PLAYWRIGHT_RUNNER_PATH`。不得创建独立 Node Worker、候选后端、systemd、独立 PM2、宿主机 crontab 或屏外 Docker 服务。

在宝塔受限环境按 `config/env.example` 配置：

- `PLAYWRIGHT_HEADLESS`：生产应为 `true`。
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`：必须是当前宝塔主机上由 `www` 可执行的 Chromium/Chrome 绝对路径；惠州 Debian 11 固定使用 `/usr/bin/chromium`。部署器会在切换运行包前验证该文件并写入受限环境，缺失时失败关闭，不在服务器请求处理中下载浏览器。
- navigation/action timeout：页面导航和单动作上限。
- max pages/scrolls/details：单次执行动作上限；调大前先核对来源合同、并发和站点限制。
- profile archive/extracted/files：加密档案解包资源上限。
- Node binary、runner path、runner timeout：Python 到 Node 的固定桥接边界。
- `CRAWLER_SERVICE_TOKEN` 与 `CRAWLER_ACTOR_ID`：Node/Python 共用的内部服务凭证和专用服务用户；Token 至少 32 字符，只能放宝塔受限环境，服务用户 UUID 必须已存在。
- `CRAWLER_API_BASE_URL`：固定指向本机统一 Node API。组织、工作区、档案和执行计划由 Worker 创建的 `browser_collection_jobs` 决定，不再配置静态 UUID 或请求文件。
- Python Crawler 到该本机 API 的请求不继承系统代理；若日志持续出现 `crawler_api_http_502`，先用本机直连检查 `/api/v1/internal/crawler-runtime/jobs/acquire`，再确认已发布包含回环免代理传输的 Crawler 版本，不得通过修改系统代理或把 API 暴露公网来绕过。
- `CRAWLER_LEASE_SECONDS`：30–600 秒；心跳间隔必须小于租约时长。
- `CRAWLER_COMPLETION_SPOOL_ROOT`：完成回传失败的受限暂存目录；生产固定为 `/www/wwwroot/ai选品/runtime/crawler-completions`，由部署器创建并写入受限环境。目录沿用固定运行目录合同 `root:www / 02770`，回执文件由 Crawler 以 0600 保存；禁止使用 Python 项目工作目录下的相对 `runtime`、放入网站目录或备份外传。
- `CRAWLER_COMPLETION_RETENTION_DAYS`：待回写与隔离回执的人工处置保留期，默认 30 天；到期只告警，不自动删除。
- `CRAWLER_COMPLETION_MAX_BYTES`：受限回执目录聚合容量停止线，默认 512 MiB。
- `CRAWLER_COMPLETION_MIN_FREE_DISK_MB`：回执目录所在磁盘可用空间停止线，默认 4096 MB。

Node/Worker 配置在统一后端启动时读取，Python 配置在 `ai选品-python` 启动时读取；共享配置或凭证安全边界代码修改后应在宝塔分别重启两个项目。Cookie 写入 API 必须返回 `Cache-Control: no-store`，入库前转换为 AES-256-GCM 密文；Python 结构化事件会递归脱敏 cookie、credential、token、authorization、secret 与 master key 类字段。不要把密钥、Cookie 或档案内容写入日志或文档。

## 发布与验证

在 390px 打开最近运行卡片，确认状态、采集量、原因与时间无需横向滚动即可读取；展开“技术详情”后再核对完整运行 ID、范围 ID、错误码和关联编号，关闭抽屉后焦点应返回原卡片。

1. 备份 MySQL，并确认没有本模块 running 租约。
2. 执行 `0016d_playwright_crawler_m03_04.up.sql`、`0048_browser_collection_jobs.up.sql`、`0049_credential_renewal_auto_replay.up.sql`、`0050_browser_evidence_artifacts.up.sql` 与 `0054_crawler_succeeded_empty.up.sql`，必须使用 `product_scout` 业务账号且确认 MySQL 5.7/utf8mb4；已应用的迁移不可重复手工执行。
3. 本地运行 `python -m unittest discover -s apps/crawler/tests -p "test_*.py"`、`node --test tests/unit/credential-cookie-security-boundary.test.mjs` 与 `npm run test:integration`。集成测试必须显示 Python 真实 HTTP 消费的领取、续租、完成及无任务不发心跳均通过，并显示加密登录态真实 Chromium 的成功采集、登录失效受阻、证据生成和临时档案清理均通过；不得用外部账号或纯 Mock 截图替代。
4. 在发布目录复用锁文件安装依赖，并保持 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`；部署器必须确认 `/usr/bin/chromium` 由 `www` 可执行，再把绝对路径写入受限环境。不得在服务器发布或请求处理中执行 `npx playwright install`。
5. 构建后运行 `npm run verify:crawler-chain` 与 `npm run verify:module -- M03-04`。前者检查生产调用方和真实集成测试未被移除，后者继续覆盖真实本地 Chromium、MySQL 5.7 独占租约、Python bridge、桌面和 390px 视觉验收。
6. 由宝塔重启 `ai选品` 和 `ai选品-python`，在 `/platform-admin/collection/browser-runtime` 确认档案明确有效期与剩余天数、目标域名、活动租约占用实例与来源、过期租约的僵尸占用风险和最近运行可读；未设置有效期必须显示“无法预测”，不能猜测。准备超过 25 条脱敏运行，验证下一页可达，精确搜索早于首 100 条的 trace_id 仍可返回，状态/搜索/页码在刷新和返回后保持；让读取挂起超过 15 秒时，旧事实必须保留。中文临时根目录下的本地真实 Chromium 成功和 `blocked_login` 两条生命周期必须同时通过，且临时目录清空。在 `/platform-admin/crawler-scheduler` 确认完成回执的待回写/隔离数量、保留期、容量和磁盘水位已更新。再检查 Python 的 running/completed 日志；成功作业应在 `browser_evidence_artifacts` 同时出现 `dom_fragment` 与 `screenshot`，解析版本与 Provider 一致，文件位于受控 `EVIDENCE_ROOT` 而非网站目录；没有 `browser_collection_jobs.status='queued'` 时不应出现空闲心跳。

## 故障处理

- `blocked_login` / `blocked_captcha` / `blocked_robots`：停止自动重试，平台管理员核对合法账户、档案与来源政策；不得自动绕过。
- `blocked_login` / `credential_expired` 的续期：任务中心会出现关联业务采集任务的续期项。轮换凭证后观察新的自动重放任务；轮换只确认输入格式和站点域名，自动重放才确认登录是否真实恢复。
- `rate_limited`：遵守 Retry-After 与 M03-05 的后续重试策略；本模块只记录受阻结果。
- `timeout` / `dependency_failed`：先用链路日志的 request_id/trace_id 关联，再在宝塔“ai选品”日志中检查子执行器、Node runner 路径和 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`。若 Playwright 报 bundled executable missing，应确认受限环境为 `/usr/bin/chromium` 且 `www` 可执行，不得改为服务器临时下载。出现 `crawler_heartbeat_failed` 时浏览器子进程已被终止；先恢复 Node API，不得手工补发旧令牌。
- `completion_retry`：`pending>0` 表示结果仍保留在 `CRAWLER_COMPLETION_SPOOL_ROOT`；保持 Python Crawler 运行以继续回传。确认 `completed` 增长且目录清空后再回收旧租约，禁止直接删除待回传文件。
- `crawler_profile_lease_conflict`：等待有效租约结束。只有 `expires_at` 已过期时才在监控页输入“确认回收”。
- `crawler_lease_invalid`：立即停止对应执行，不得用新令牌补写旧运行。

## 回滚与清理

回滚前从宝塔停止 `ai选品` 和 `ai选品-python`，确认或回收所有过期租约并备份；待回传目录非空时先完成或人工登记，不能直接删除。先执行 0054 down；若已应用 0051，再取得删除固定样本与回放记录授权并依次执行 0051c、0051b、0051a down；再执行 0050 down、0049 down 和浏览器作业 down migration。0054 down 会把 `succeeded_empty` 映射为旧版 `succeeded`。0050 down 不删除证据文件，按备份与索引清单精确处理；从本地重新上传目标版本后再由宝塔启动两个项目。临时档案默认位于 `CREDENTIAL_TEMP_ROOT`；异常残留只能在确认路径属于该根目录、没有活跃 Chromium 后清理，不能递归删除宽泛目录。
