# M07-05 宝塔发布与回滚 Runbook

> 本文以下双槽命令已停用，只用于历史审计。当前发布必须在本地提交且工作树干净后运行
> `python scripts/deploy-baota.py`，生产只维护 `/www/wwwroot/ai选品/frontend`、
> `/www/wwwroot/ai选品/backend`、`/www/wwwroot/ai选品/python`、`config`、`runtime`
> 与 `backups`，并通过宝塔重启既有 `ai选品` 与 `ai选品-python` 项目。

当前生产只允许一个宝塔 Node 后端 `ai选品`。不得创建第二后端、分流后端或常驻灰度
任务。当前操作步骤如下：

1. 在本地确认目标提交已经完成 `npm run verify:release-matrix`、
   `npm run verify:runtime-docs`、`npm run verify:docs` 和风险匹配的构建/测试，且工作树
   干净。
2. 首次整理固定目录时运行 `python scripts/deploy-baota.py --initialize-layout`；后续发布
   运行 `python scripts/deploy-baota.py`。脚本只读取既定 Windows 凭据管理器条目，只能
   更新当前项目的固定目录和宝塔对象。
3. 脚本更新网站、统一 Node 后端与 Python Crawler 后，通过宝塔管理的既有项目完成
   重启。禁止在服务器执行 Git、构建、systemd、独立 PM2、宿主 crontab 或屏外服务。
4. 发布后核验公网版本、live、ready、available，确认 Node 内 API/Worker、Python
   Crawler、MySQL 5.7 与 Redis 的当前状态。任一门失败时，以本地目标 Git 提交重新
   构建并执行同一部署命令回滚，不删除发布、审计或业务数据。
5. 在 `/platform-admin/releases` 验证桌面门禁表格与 390 像素摘要卡片/详情抽屉；确认状态和阻断原因显示中文、页面无横向遮挡，门禁 ID、类型、发布 ID、阻断代码与 request_id 默认隐藏在“技术详情”中且可展开追踪。

## 历史双槽审计资料（不可执行）

以下命令、端口、变量与观察记录只用于解释既有 M07-05 发布证据。旧执行器已经退出
当前生产调用链，禁止照此新建项目、计划任务或流量分配。

## 发布前

在宝塔创建同机私有 Node 项目 `product-scout-api-canary`，形成 4101/4103 两个发布槽。首次发布把候选 release 放在 4103，候选应用环境必须设置 `APP_PORT=4103`，发布控制器设置 `RELEASE_STABLE_API_PORT=4101`、`RELEASE_CANDIDATE_API_PORT=4103`；成功后下一版本放在 4101，并同时对调应用端口与发布控制器的两个槽位变量。`APP_PORT` 是 Node API 的实际监听端口，两个 `RELEASE_*_API_PORT` 只用于 Nginx 流量编排。两个槽只能监听 `127.0.0.1`，不得覆盖当前稳定槽后再开始灰度。创建仅手工触发的宝塔计划任务 `product-scout-release-rollout`，不得设置每日、每小时或其他自动日调度，命令为 `node <candidate>/scripts/run-baota-release-rollout.mjs --run --env-file <宝塔受限环境文件>`。执行器使用 `RELEASE_ROLLOUT_LOCK_NAME=scoutops:m07-05:release-rollout` 的 MySQL 会话级命名锁覆盖整轮 5/25/100；第二实例不能立即取得锁时以 `release_rollout_lock_busy` 失败关闭，不能重置门禁或改流量。不得通过 SSH 前台、systemd、独立 PM2 或宿主 crontab 常驻运行。

受限环境必须按 `config/env.example` 设置 release、Nginx、端口、采样、阈值、数据库和应用身份变量。API 候选项目与发布任务必须注入同一个随机 `RELEASE_PROBE_SIGNING_KEY`（至少 32 字符），只保存在宝塔受限环境；`RELEASE_PROBE_TIMESTAMP_TOLERANCE_SECONDS` 默认 60，可调 10–300 秒。生产 `RELEASE_CANARY_OBSERVE_SECONDS` 不得低于 1800，`RELEASE_SAMPLE_INTERVAL_SECONDS=1` 固定采用 1 秒采样以提高低流量 S0 的候选 P95 样本分辨率；不得用采样调整缩短观察或放宽阈值。`RELEASE_PUBLIC_BASE_URL` 必须等于正式 HTTPS origin，`RELEASE_PUBLIC_CONNECT_ADDRESS=127.0.0.1` 只固定 TCP 连接到本机宝塔 Nginx，TLS/SNI/Host 与证书校验仍使用正式域名，从而避免公网回环波动；不得填公网 IP、直连 4101/4103 或关闭证书校验。候选 `BUILD_SHA` 必须等于候选 `/health/version`，Nginx 配置必须在 `/www/server/panel/vhost/nginx/`，计时日志必须在 `/www/wwwlogs/`。真实密码、Cookie、Token、私钥和 `.env` 不得复制到任务日志或仓库。

MySQL 5.7 的宝塔受限 `my.cnf` 必须显式设置 `innodb_flush_log_at_trx_commit=2`、`sync_binlog=1`、`binlog-format=ROW`，并确认 `product_scout` 不在 binlog 排除列表。惠州 16 GiB 单机同时固定 `innodb_buffer_pool_size=4096M`、`innodb_buffer_pool_instances=4`、`innodb_io_capacity=1000`、`innodb_io_capacity_max=4000`、`innodb_flush_neighbors=0`、`innodb_flush_method=O_DIRECT`；这些资源参数不允许被当作放宽 600 ms 门槛。该合同不由应用环境变量下发：共享实例在主机或操作系统故障时最多可能丢失约 1 秒已提交事务；M08-03 只验证同机加密备份与隔离恢复，不把它描述为备用服务器或异地灾备。现有 `product_scout@127.0.0.1` 账号的全局 `REPLICATION CLIENT` 让发布任务读取 `SHOW MASTER STATUS`，不得扩大为 `SUPER`。发布任务会读取运行时变量与 `SHOW MASTER STATUS`，任一值漂移都在分流前失败关闭。修改前将 `my.cnf` 复制到 `/www/server/panel/data/` 的 0600 备份，只能通过宝塔重启 MySQL；配置解析或健康门失败时同一有限任务自动还原并回滚重启。

## 执行与观察

当前并发保护迁移还必须登记 `0027a_release_rollout_attempts_m07_05.up.sql`。它将 `(stage, build_sha)` 从唯一键改为普通查询索引，使同一构建的每次手工发布都有独立 release ID；模块验收必须把 0027a 作为最新迁移，不能仅停在 0027。

1. 在宝塔确认稳定/候选 API 的 live、ready、version，确认 MySQL 5.7、Redis、Worker、Crawler 正常；确认发布任务仅手工触发、系统计划中没有自动日调度、当前没有其他发布实例。重复启动必须返回 `release_rollout_lock_busy`，不得清理或覆盖已有失败门禁。
2. 运行 M07-01、M07-02、M07-04 门禁并确认最近隔离恢复为 verified。
3. 从宝塔手工执行发布任务。任务先验证历史 `0027` 迁移和 `0032a_compact_release_write_probe_m08_03` 紧凑写样本迁移，再验证候选签名写入；历史 `deployment_release_write_probes` 只读保留，新样本只能进入 `deployment_release_write_samples`。随后依次配置 5%、25%、100%，每阶段至少观察 30 分钟；宝塔日志应持续显示 request_id/trace_id，但不显示秘密。Nginx 会用 32 位十六进制 `$request_id` 覆盖 `X-Request-ID`，因此签名 canonical 只含 timestamp、nonce、release_id、sample_id；API 仍保存代理传入的追踪值。只有 Nginx 499 且 `upstream_status="-"` 的到达上游前中断可用同一 sample_id 重试一次，证据必须记录次数；不得重试候选拒绝，重试仍无法送达时失败关闭。候选已到达上游的写探针必须返回 202，且候选构建的新增持久化行数必须与候选 Nginx 已到达上游的写样本数相等，否则自动回到稳定槽。
4. 在 `/platform-admin/releases` 查看当前 release、三阶段样本、5xx、读写 P95、异步延迟和阻断项。API 只读，不能从浏览器触发发布。
   异步延迟清单必须与 `infra/baota/release-rollout-manifest.json` 的 `automaticStop.asyncQueueTables` 一致，只包含宝塔 Worker 可领取的到期工作和过期租约。队列 `DATETIME(3)` 的到期判断与等待时长必须和 Worker 一样使用 MySQL 当前会话 `NOW(3)`；若 MySQL `@@system_time_zone` 不是 UTC，禁止把 `UTC_TIMESTAMP(3)` 与这些会话本地时间直接比较，否则会制造固定时差的假积压。领域审计 Outbox 没有当前消费者时保留原状态与证据，但不计入可执行队列延迟；禁止删除这些记录或放宽 60 秒阈值来通过灰度。
5. 生产证据写入 Git 忽略的 `.artifacts/verification/release-rollout-production-evidence.json`，再执行 `node scripts/verify-release-rollout-production.mjs --production`。
6. 从宝塔 `product-scout-release-gate` 有限任务执行 `npm run verify:module -- M07-05`。任务运行前确认 `schema_migrations` 同时登记 `0007_m00_08_deployment_releases.up.sql`、`0026_release_rollout_m07_05.up.sql`、`0027_release_write_probe_m07_05.up.sql` 和 `0027a_release_rollout_attempts_m07_05.up.sql`。若表已存在但 0007 账本缺失，必须先逐字段、引擎、字符集和索引比对实际表与 0007 文件，并核对 SHA-256 后只补账本行、保留 0600 前后证据；不得重跑 `CREATE TABLE`、删除表或伪造 checksum。live 验收由 MySQL `UTC_TIMESTAMP(3)` 创建唯一测试发布与 gate 时间，避免宝塔任务进程本地时区或较新的真实发布遮蔽，并在成功或失败后清理全部探针数据。生产稳定/候选已占用 4101/4103 时，宝塔验收任务设置 `APP_PORT=4201`、`PLAYWRIGHT_API_PORT=4201`、`PLAYWRIGHT_WEB_PORT=5273`，让 Playwright 仅启动有限的隔离临时 API/Web；两个临时服务的启动等待上限为 300 秒，以覆盖 Debian 单机隔离工作区的真实构建耗时，超时仍失败关闭且不影响生产超时或灰度阈值。当前 Debian 11 主机还设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` 复用已安装的系统 Chromium，因为 Playwright 1.62.1 不为该系统下载自带浏览器。E2E 前的 `node scripts/verify-playwright-host.mjs` 必须确认绝对路径可执行且 `fc-list :lang=zh` 非空；缺字体时不得接纳方框字 Linux 快照。主机已按用户 2026-08-10 明确授权，通过宝塔有限任务安装 Debian 官方 `fonts-noto-cjk` `1:20201206-cjk+repack1-1` 并刷新字体缓存，安装前证据为 `/www/server/panel/data/scoutops-m0705-font-install-before-*.json`（0600）；未重启生产服务。回滚时确认无 Playwright/验收进程后，通过同一宝塔有限任务执行 `apt-get remove -y fonts-noto-cjk && fc-cache -f`，再确认 `fc-list :lang=zh` 为空并使 M07-05 失败关闭。不得安装未知浏览器、复用生产 API，也不得把临时进程登记为生产服务。

## 2026-08-12 历史生产签发证据（已失效）

以下 schema v3 证据只用于历史审计。2026-08-13 检出宝塔自动日调度与手工任务并发覆盖后，该签发不能用于当前 M07-05 验收；必须由修复后的 schema v4 执行器重新完成连续的 5%/25%/100% 各 1,800 秒观察。

- 发布 ID：`8b6114fe-fafa-4c6c-8a5d-ebd52ffe65ae`；候选构建：`e22968896ab087647ad171f00a6f107c6824acf9`；证据捕获：`2026-08-11T19:22:54.886Z`；SHA-256：`649a4b18ddec6d5f4967dce0ce2f992c4c5aa5ce45a4cb272ce0c31597376d1d`。
- 5%：1,800 秒、160 样本、5xx 0%、读 P95 3 ms、写 P95 6 ms、异步延迟 0、持久化写样本 84；到达上游前中断和投递失败均为 0。
- 25%：1,800 秒、818 样本、5xx 0%、读 P95 2 ms、写 P95 152 ms、异步延迟 0、持久化写样本 432；到达上游前中断和投递失败均为 0。
- 100%：1,800 秒、3,199 样本、5xx 0%、读 P95 2 ms、写 P95 276 ms、异步延迟 0、持久化写样本 1,599；到达上游前中断和投递失败均为 0。
- `npm run verify:module -- M07-05` 在同提交隔离工作区的宝塔有限任务中 11/11 命令通过；run_id/trace_id：`cfadd66f-b1d4-4a3e-ac0f-faa1efac2b1a`，生产证据门 trace_id：`23bd60f3-59f3-4951-9a88-2fb74cc631e6`。验收后 4201/5273 无残留监听，临时 bundle 已删除，任务 14 已恢复为 `product-scout-m0706-candidate-deploy`。

## 2026-08-13 schema v4 生产签发证据

宝塔仅手工任务在 MySQL 会话命名锁与独立 release 尝试模型下重新完成发布 `f1e33e3b-ab99-4b6e-8d30-e94285b6cd1e`，候选构建为 `eabce9a0bbad5b711de9f7f36e2f02db0737d25b`，证据捕获于 `2026-08-13T10:24:01.231Z`，SHA-256 为 `b454dc3cd3cbc3c1b5eb216722bb84756f30a945e5cacecc6ff5e75f09bf18bf`。并发演练中第二个手工实例在迁移、门禁和 Nginx 变更前返回 `release_rollout_lock_busy`，已有 release/gate/event 与流量配置保持不变。

- 5%：1,800 秒、162 样本、5xx 0%、读 P95 3 ms、写 P95 6 ms、异步延迟 0、82 个候选写样本全部持久化。
- 25%：1,801 秒、787 样本、5xx 0%、读 P95 2 ms、写 P95 7 ms、异步延迟 0、373 个候选写样本全部持久化。
- 100%：1,800 秒、3,304 样本、5xx 0%、读 P95 2 ms、写 P95 5 ms、异步延迟 0、1,644 个候选写样本全部持久化。
- 三阶段到达上游前中断与投递失败均为 0；`npm run verify:module -- M07-05` 的 11/11 命令通过，run_id/trace_id 为 `82f35776-52a9-4e00-90bc-a7ca76d452cb`。

该证据完成 M07-05 模块签发，但包含本收尾文档的最终提交仍必须重新通过生产灰度和 P07 阶段门；不得据此提前声明 P07 或 P08 完成。

## 自动停止与人工回滚

脚本在样本不足或阈值超限时自动把 candidate 比例改为 0%，Nginx 检查通过后 reload，并记录 automatic_stop/rollback。若任务进程异常退出，在宝塔将 `000-product-scout-release-upstream.conf` 设为只含本次 `RELEASE_STABLE_API_PORT`，先运行宝塔 Nginx 配置检查再 reload。确认公网 `/health/version` 返回稳定构建后，在宝塔停止失败候选槽。每次执行生成独立 release ID；不得删除、复用或覆盖失败 release、gate/event、备份或审计记录。回滚 `0027a_release_rollout_attempts_m07_05.down.sql` 前必须确认没有相同 stage/build 的多次尝试，否则恢复唯一键会失败并必须保留 0027a。

本模块只提供同机应用版本回滚。主机、磁盘、站点或 MySQL 故障不能靠候选项目恢复；当前没有备用服务器。

若撤销 MySQL 资源配置，先确认发布任务未运行且 Nginx 全量指向稳定槽，从最新 `/www/server/panel/data/scoutops-m0705-mysql-resource-before-*.cnf` 还原 `/etc/my.cnf`，通过宝塔重启 MySQL，再确认 MySQL 5.7、稳定/候选 ready、Worker 和 Crawler 全部健康。撤销资源配置不允许修改持久性合同或发布阈值，且必须重新执行 M07-05 生产门。

若撤销已授权的 MySQL 持久性合同，先确保发布任务没有运行且 Nginx 已全量指向稳定槽，从 `/www/server/panel/data/scoutops-m0705-durability-before-*.cnf` 恢复 `/etc/my.cnf`，再通过宝塔重启 MySQL。验收 `innodb_flush_log_at_trx_commit=1`、`Binlog_Ignore_DB` 不含 `product_scout`、稳定/候选 ready 均为 200。撤销后 M07-05 生产门必须重新执行，旧证据失效。

若需要撤销紧凑写探针，先停止发布任务并把 candidate 比例恢复为 0%，导出 `deployment_release_write_samples` 和 gate/event 审计，回滚 API 后执行 `0032a_compact_release_write_probe_m08_03.down.sql`，最后由宝塔重启 API。原 `deployment_release_write_probes` 历史表保留，可供旧版本回滚继续使用；不得在仍有 M07-05 发布任务运行时删除任一表或轮换签名密钥。
