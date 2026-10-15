# M07-04 宝塔备份与隔离恢复 Runbook

## 2026-10-16 受限 SAVEPOINT 回放

仅在 `BEGIN` 内接受 `SAVEPOINT`、`ROLLBACK TO [SAVEPOINT]` 与 `RELEASE SAVEPOINT`。名称只允许 ASCII 字母或下划线开头、后续字母/数字/下划线，1–64 字符，可带一对反引号；同一事务最多 1024 个有效名称。回退保留目标并移除之后的保存点，释放必须命中现存名称；事务结束或新 BEGIN 清空名称。未知名称、跨事务引用、表达式、额外参数和所有原先禁止的 SQL 仍失败关闭。ROW 事件 CRC、隔离命名空间和原字节检查不变。

执行 `node --test tests/m07-04/backup-pitr-sql.test.mjs`。固定部署上传后，下一次宝塔有限恢复任务直接读取新版本，无需单独重启 MySQL/Redis；只复用已有密文，不运行新备份。软件回归不代表真实恢复已通过。

P64读取状态（2026-09-15）：沿用原刷新/重新核验，命名标题及busy辅助识别状态，无新设置。`node scripts/verify-backup-read-states.mjs`四组256项/84本地GET，原真实15秒及安全重试不变；`--capture-review rN`当前r2/28图。16相关测试、97默认回归、类型/构建/253预算通过；仅前端语义变更，未来静态包生效，无Node/Python重启，本轮未部署/未提交。真实权限/恢复/保活待验，见P64-READ-STATES-BATCH43.md。

P64本地UI审核（2026-09-15）：`node scripts/verify-backup-page-preview.mjs`实际Vue审核宿主97项/双端，默认无文件；`--capture-review rN`独占新目录，当前r3/31图/165来源。全部请求本地拦截，只读展示，不执行备份/恢复；15相关合同通过，不代表真实演练验收。业务script与生产文件/配置未改，无重启要求、未部署/未提交；详情见P64-PAGE-COMPOSITION-BATCH42.md。下文旧备份目录不能覆盖当前AGENTS固定根边界，本次不执行或迁移这些路径。

## 配置

2026-10-15 固定目录修正：下述早期 `/www/backup/product-scout/` 和面板 data 密码文件说明已被当前合同取代。生产备份三个互不嵌套的目录必须位于 `/www/wwwroot/ai选品/backups/` 内；受限管理员密码文件必须位于 `/www/wwwroot/ai选品/config/` 内，不能提交或打印。部署包包含有限演练脚本、加密库、迁移引导、非秘密配置模板与清单。清理只针对本次创建的 `workingRoot`，不遍历删除其他 `run-*` 目录。部署这些修正后才可更新宝塔任务路径并演练；它们不改变 MySQL 配置或公网访问，不代表恢复已经通过。

在宝塔受限环境配置 `BACKUP_ENCRYPTION_KEY`（至少 32 字符）、`BACKUP_PRIMARY_REGION=惠州`、`BACKUP_RECOVERY_REGION=惠州`、`BACKUP_PRIMARY_ROOT`、`BACKUP_LOCAL_COPY_ROOT` 和 `BACKUP_DRILL_ROOT`。密钥不得复制到命令行历史、日志或仓库。三个根目录都在当前主机、生产必须位于 `/www/backup/product-scout/` 下，且不得互相重叠或与在线证据/导出目录重叠。`BACKUP_MYSQL_CLIENT`、`BACKUP_MYSQLDUMP_CLIENT`、`BACKUP_MYSQLBINLOG_CLIENT`、`BACKUP_MYSQL_SOCKET` 和 `BACKUP_MYSQL_ADMIN_PASSWORD_FILE` 指向宝塔管理的 MySQL 工具、本机 Unix socket 与受限管理员密码文件；启动检查要求 socket 是存在的绝对路径。API 运行和恢复元数据只使用 `product_scout@127.0.0.1` 业务账号；为了让 MySQL 5.7 全量备份嵌入精确 binlog 坐标并验证 PITR，有限备份任务仅通过 Unix socket 从宝塔受限文件读取 `root@localhost` 凭据。该凭据不得进入进程参数、日志、数据库或备份包，禁止新增 `root@127.0.0.1`，也不能授予业务账号全局管理员权限。

## 宝塔任务

1. 数据库：每日全量，同时保留足以满足 15 分钟 RPO 的 binlog；导出嵌入精确 binlog 坐标，关闭后的坐标区间与全量 SQL 一并 AES-256-GCM 加密并验证。`BACKUP_RETENTION_DAYS` 默认 90，任务只清理超过保留期且名称匹配 M07-04 密文/证据格式的文件。
2. 文件：证据与导出按组织清单加密，保留来源、哈希和时间；配置只备份模板、版本和非秘密参数。
3. 恢复副本：将密文写入当前主机内独立的宝塔受控目录，再从该目录重新计算密文哈希。没有副本端验证不得写 `verified`；此副本不保护整机或磁盘故障。
4. 记录：以系统审计身份写入 `backup_recovery_runs/assets`，关联 request_id 和 trace_id。失败写明确 failure_code，并由宝塔告警。

失败记录补齐：仅在运行环境、既有表及发布身份检查通过并建立实际执行上下文后，有限任务才追加 `status=failed` 的现有运行记录；备份阶段使用 `backup`，进入隔离恢复后使用 `restore_drill`。保存真实开始、结束、快照截止时间及本次 request/trace，失败码仅接受有界标识，不保存异常正文、SQL、密码或路径。所有验证标志保持未验证，不改写历史成功；审计写入失败另报 `backup_failure_record_write_failed`，原失败及非零退出不变。随后仅清理本次 running 源探针与自有临时目录，不删除失败记录。历史文件失败因缺少原执行时间或 trace 不自动回填。此修正随固定部署包上传后供下一次有限任务加载，无新配置、迁移或常驻服务重启；部署不等于授权执行新备份或恢复。定向验证：`node --test tests/m07-04/backup-failure-record.test.mjs`。

宝塔计划任务命令：`cd /www/wwwroot/ai选品/backend && node scripts/run-baota-backup-drill.mjs --run --env-file /www/wwwroot/ai选品/config/product_scout.env`。任务必须在宝塔中可见、可停用、可查看日志；不得另建系统 cron 或常驻进程。

配置或 socket 路径变化不需要重启 MySQL；在宝塔中重新执行有限备份任务即可生效。若回滚本变更，先停用该任务并恢复受限环境与上一发布代码，再运行一次自检；不得以创建 TCP root 账号作为回滚手段。

## 隔离恢复演练

2026-10-15 PITR 执行链修正：全量导出采用逐行 INSERT，从同一 SQL 快照计算表行数，不把持续变化的在线库行数误当快照。封闭 ROW binlog 先由现有 MySQL 5.7 工具校验原始 CRC 并按源业务库筛选；不使用现场已复现校验异常的原生 `--rewrite-db`。受控转换器验证原始事件 CRC，仅修改 table-map 的库名、事件长度及对应 CRC32，行事件原字节保持不变；转换后再次校验 CRC 与目标临时库。原始 DML/DDL、其他库映射及未知事件失败关闭，只补入真实输出中观测到的会话级 `SET TRANSACTION ISOLATION LEVEL READ COMMITTED` 控制语句。快照前创建的专用 `running` 探针在快照后更新，必须通过真实回放恢复更新值；失败仍报 `backup_pitr_replay_unverified`，不写 verified。成功签发前先删除准确探针、临时库和本次明文目录，并验证解密内容哈希。源库不新增表、账号或全局配置；根凭据仍仅从受限文件读取并通过 Unix socket 使用。

事件布局和 CRC32 依据 [MySQL 5.7 官方事件定义](https://github.com/mysql/mysql-server/blob/5.7/libbinlogevents/include/binlog_event.h) 与 [table-map 定义](https://github.com/mysql/mysql-server/blob/5.7/libbinlogevents/include/rows_event.h)。这是恢复工具内部转换，不升级 MySQL、不调整其配置，也不把原始校验成功而重写失败误报为生产 binlog 损坏。真正执行前需先以现场原始日志完成只读转换及校验预检；本地夹具不是生产恢复通过证据。

同一个原生 `BINLOG` 字面量可能包含多段分别填充的 base64 事件，不能直接当单段解码，否则会在首个填充处丢弃后续事件。转换器逐段严格解码、拼接事件并校验长度与 CRC，输出规范单段编码。现场只读候选检查曾覆盖 25 个映射与 25 个行事件；没有执行回放写入，不构成恢复通过证据。

有限任务必须额外加载当前 `config/release.env` 中的 `BUILD_SHA`；主环境和备份专用受限环境可由 Node `--env-file` 与脚本既有 `--env-file` 参数组合加载。没有同提交发布身份、快照后探针、行事件范围或清理证据时，生产门拒绝签发。本修正需要下一次固定目录部署更新工具，不要求改变 MySQL 配置；本地单测不代表线上演练已通过。`mysqlbinlog` 的 rewrite-db 对行事件生效，过滤发生在重写之后，见 [MySQL 5.7 官方手册](https://docs.oracle.com/cd/E17952_01/mysql-5.7-en/mysqlbinlog.html)。

至少每季度在当前主机的临时隔离数据库与隔离文件根目录执行：从本机恢复副本取回密文、验证、解密、恢复到新库；核对关键业务表行数和抽样事实、`audit_logs/platform_audit_events` 链、证据 SHA-256、跨组织拒绝；记录实际 RPO/RTO。不得连接生产 Worker/Crawler，不得覆盖生产库或主文件根目录。演练结束后由宝塔任务删除明文隔离库和临时文件，只保留密文及脱敏证据。

最小本地验证：`node scripts/backup-recovery.mjs --self-test`；MySQL 5.7 集成：`node scripts/verify-backup-recovery-live.mjs`；生产门：`node scripts/verify-backup-recovery-production.mjs --production`。MySQL 集成探针先读取现有恢复记录的最大开始时间，再在其后构造两条随机 ID 探针记录并按 ID 清理，防止真实生产演练覆盖 fail-closed 状态断言；不得为验收改写或删除既有生产备份记录。生产证据放在 Git 忽略的 `.artifacts/verification/backup-recovery-production-evidence.json`。

页面验收同时覆盖桌面表格与 390 像素摘要卡片/详情抽屉；确认对象和角色显示中文、页面无横向遮挡，恢复证据始终展示按 `BACKUP_MAX_DRILL_AGE_DAYS` 计算的到期时间与剩余天数，过期后继续由既有 `stale` 状态阻断。该倒计时随只读 API 刷新，不需要新增计划任务或重启服务；调整最大演练年龄仍需修改宝塔受限环境并重启 Node 项目。原始对象代码、存储角色代码、阻断代码和 request_id 默认隐藏在“技术详情”中且可按需展开。

刷新回归必须覆盖：有可信快照时快速重复点击只产生一个在途读取；对 `backup_recovery_runs` 制造超过 14 秒的测试库锁等待，接口返回 503 `backup_recovery_read_timeout`，页面在 15 秒内保留旧快照并显示重新核验，锁释放后不得出现该 request_id 的成功审计；停止测试 MySQL 时返回脱敏 503 `backup_recovery_dependency_unavailable`，恢复原参数后重新核验回 200。以上故障注入只允许在本地或测试环境，禁止停止生产 MySQL。匿名为 401，缺 `platform:operate` 为 403；401/403 后页面不得保留旧平台事实。

代码更新后，API 的 14 秒边界和事务取消逻辑需要重启宝塔 Node 项目生效；Web 需要重新构建并发布静态文件。它们不要求重启 MySQL、Redis、Worker、Crawler 或备份计划任务，也不新增配置项。Node 重启命令仍为 `/www/server/panel/pyenv/bin/python /www/server/panel/script/restart_project.py nodejs ai选品`，只能在宝塔对象和固定目录核对无误后执行。

## 故障与回滚

生产有限任务的密文核验明文临时文件也必须位于本次隔离 `workingRoot` 内；`verifyBundle` 的 `tempRoot` 由调用方传入，成功与认证失败均清理其临时目录。独立本地自检仍可使用操作系统临时目录，不改变 CLI 或环境变量。该工具修正需要下次固定目录部署，不影响已经启动并加载旧模块的任务；旧任务产生的明确临时路径需在其结束后核对已自然清理，不得删除来源不明目录。

### UI 第二阶段 B3a 展示修正

2026-09-15 批次46：页面“快照读取追踪”只归属成功事实，“本次失败读取追踪”只归属当前失败；初次失败也可展开复制编号，401/403移除旧事实及其编号。超时仍使用原本次发送的请求编号，接口和服务契约未改。定向 `node --test tests/unit/backup-trace-ownership.test.mjs` 与 `node scripts/verify-backup-trace-ownership.mjs`，后者使用本地响应与clipboard桩，不写真实剪贴板，不执行恢复。仅Web交付，无新配置/Node重启需求，本轮未部署；范围见 `design-plans/ui-phase-2-2026-09-07/P64-TRACE-OWNERSHIP-BATCH46.md`。

2026-09-15 批次45新增本地状态审核：`node scripts/verify-backup-state-matrix.mjs` 将当前服务函数的合成仓储返回挂入实际Vue，验证九种结论/有效期/缺记录/0/长内容。默认不出文件，`--capture-review rN`产生正式新版本图册。无真实数据库读写、备份、恢复或权限验收，无产品改动/新配置/重启要求；图册与覆盖边界见 `design-plans/ui-phase-2-2026-09-07/P64-STATE-MATRIX-BATCH45.md`。

2026-09-15 批次44：Web 读取重试的提示区消失前，仅把仍在该重试入口的焦点移至顶部刷新按钮。顶部等待使用 aria-disabled/aria-busy 保持可聚焦，原请求单飞 guard 防止重复发送；用户主动移焦不抢回。无新配置或 API，未来只需发布前端静态包，无需因此重启 Node/Python/数据库，本轮未部署。定向命令 `node --test tests/unit/backup-read-focus.test.mjs` 与 `node scripts/verify-backup-read-focus.mjs`；后者本地模拟读取，不执行备份恢复，默认不出文件。详见 `design-plans/ui-phase-2-2026-09-07/P64-READ-FOCUS-BATCH44.md`，完整读屏/保活/真实权限和恢复尚未验收。

2026-09-08：恢复证据标题改为读取接口的 `policy.maximum_drill_age_days`，不再写死90天；到期时间、剩余天数和状态计算保持原样。`UI2-OP64` 用隔离响应验证30天读取、刷新为120天及无演练提示。测试值不是生产策略建议，更不改变蓝图中发布前恢复演练不得超过90天的要求。

本批只改Web展示和永久测试，无新配置、API、迁移或执行能力，不需要现在重启Node/数据库/备份任务；后续沿用固定宝塔部署器发布静态包。本页只有读取/详情/复制，不执行备份恢复。已有 `BACKUP_MAX_DRILL_AGE_DAYS` 若另行获准调整，仍通过宝塔受限环境和Node重启生效。

逐页规格 `design-plans/ui-phase-2-2026-09-07/page-specs/P64.md` 与同目录上级 `log-backup-release-contract-review.md` 列出尚未覆盖的边界。本文早期 `/www/backup/product-scout/` 说明与当前AGENTS固定项目backups根存在历史差异；本批未核实/迁移线上目录，部署前必须按当前固定根核对实际任务与配置，不按旧说明直接搬移数据或扩大部署脚本权限。

### 执行与恢复故障

认证标签或哈希不一致时立即停止解密并删除本次明文临时输出；独立恢复目录不可写或空间不足时状态为 `blocked`，不得降低为成功。只读接口超时或依赖故障先按 request_id 核对 Node 日志和 `platform_audit_events`，确认没有迟到成功审计，再在宝塔检查 Node API 与 MySQL；不得以无限提高超时掩盖连接池或锁等待。回滚时在宝塔停用任务、恢复上一版任务脚本和应用 release；迁移回滚遵循架构文档，备份密文按原保留期保存。
