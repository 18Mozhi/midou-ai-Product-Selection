# M03-04 Playwright Crawler 运维手册

## 宝塔配置

生产中保留统一 Node 后端宝塔项目 `ai选品` 和 Python 3.12 宝塔项目 `ai选品-python`。Node Worker 唯一领取业务采集任务并为登录型子查询排队浏览器作业；Python 项目只在领取到该作业后维持租约并通过 Python-to-Playwright 桥接执行，空闲时不发送心跳。任务子进程读取 `PLAYWRIGHT_NODE_BINARY` 和 `PLAYWRIGHT_RUNNER_PATH`。不得创建独立 Node Worker、候选后端、systemd、独立 PM2、宿主机 crontab 或屏外 Docker 服务。

在宝塔受限环境按 `config/env.example` 配置：

- `PLAYWRIGHT_HEADLESS`：生产应为 `true`。
- navigation/action timeout：页面导航和单动作上限。
- max pages/scrolls/details：单次执行动作上限；调大前先核对来源合同、并发和站点限制。
- profile archive/extracted/files：加密档案解包资源上限。
- Node binary、runner path、runner timeout：Python 到 Node 的固定桥接边界。
- `CRAWLER_SERVICE_TOKEN` 与 `CRAWLER_ACTOR_ID`：Node/Python 共用的内部服务凭证和专用服务用户；Token 至少 32 字符，只能放宝塔受限环境，服务用户 UUID 必须已存在。
- `CRAWLER_API_BASE_URL`：固定指向本机统一 Node API。组织、工作区、档案和执行计划由 Worker 创建的 `browser_collection_jobs` 决定，不再配置静态 UUID 或请求文件。
- `CRAWLER_LEASE_SECONDS`：30–600 秒；心跳间隔必须小于租约时长。

Node/Worker 配置在统一后端启动时读取，Python 配置在 `ai选品-python` 启动时读取；共享配置修改后应在宝塔分别重启两个项目。不要把密钥、Cookie 或档案内容写入日志或文档。

## 发布与验证

1. 备份 MySQL，并确认没有本模块 running 租约。
2. 执行 `0016d_playwright_crawler_m03_04.up.sql`、`0048_browser_collection_jobs.up.sql`、`0049_credential_renewal_auto_replay.up.sql` 与 `0050_browser_evidence_artifacts.up.sql`，必须使用 `product_scout` 业务账号且确认 MySQL 5.7/utf8mb4；已应用的迁移不可重复手工执行。
3. 在发布目录复用锁文件安装依赖，安装项目固定的 Playwright Chromium；不得在请求处理中下载浏览器。
4. 构建后运行 `npm run verify:module -- M03-04`。其中包含真实本地 Chromium、MySQL 5.7 独占租约、Python bridge、桌面和 390px 视觉验收。
5. 由宝塔重启 `ai选品` 和 `ai选品-python`，在 `/platform-admin/collection/browser-runtime` 确认档案有效期、目标域名、活动租约和最近运行可读，并检查 Python 的 running/completed 日志；成功作业应在 `browser_evidence_artifacts` 同时出现 `dom_fragment` 与 `screenshot`，解析版本与 Provider 一致，文件位于受控 `EVIDENCE_ROOT` 而非网站目录；没有 `browser_collection_jobs.status='queued'` 时不应出现空闲心跳。

## 故障处理

- `blocked_login` / `blocked_captcha` / `blocked_robots`：停止自动重试，平台管理员核对合法账户、档案与来源政策；不得自动绕过。
- `blocked_login` / `credential_expired` 的续期：任务中心会出现关联业务采集任务的续期项。轮换凭证后观察新的自动重放任务；轮换只确认输入格式和站点域名，自动重放才确认登录是否真实恢复。
- `rate_limited`：遵守 Retry-After 与 M03-05 的后续重试策略；本模块只记录受阻结果。
- `timeout` / `dependency_failed`：在宝塔“ai选品”日志中检查子执行器、Node runner 路径和 Chromium 安装，使用 request_id/trace_id 关联。
- `crawler_profile_lease_conflict`：等待有效租约结束。只有 `expires_at` 已过期时才在监控页输入“确认回收”。
- `crawler_lease_invalid`：立即停止对应执行，不得用新令牌补写旧运行。

## 回滚与清理

回滚前从宝塔停止 `ai选品` 和 `ai选品-python`，确认或回收所有过期租约并备份。先执行 0050 down，再执行 0049 down 和浏览器作业 down migration；0050 down 不删除证据文件，按备份与索引清单精确处理；从本地重新上传目标版本后再由宝塔启动两个项目。临时档案默认位于 `CREDENTIAL_TEMP_ROOT`；异常残留只能在确认路径属于该根目录、没有活跃 Chromium 后清理，不能递归删除宽泛目录。
