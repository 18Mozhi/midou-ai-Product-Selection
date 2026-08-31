# M07-04 宝塔备份与隔离恢复 Runbook

## 配置

在宝塔受限环境配置 `BACKUP_ENCRYPTION_KEY`（至少 32 字符）、`BACKUP_PRIMARY_REGION=惠州`、`BACKUP_RECOVERY_REGION=惠州`、`BACKUP_PRIMARY_ROOT`、`BACKUP_LOCAL_COPY_ROOT` 和 `BACKUP_DRILL_ROOT`。密钥不得复制到命令行历史、日志或仓库。三个根目录都在当前主机、生产必须位于 `/www/backup/product-scout/` 下，且不得互相重叠或与在线证据/导出目录重叠。`BACKUP_MYSQL_CLIENT`、`BACKUP_MYSQLDUMP_CLIENT`、`BACKUP_MYSQLBINLOG_CLIENT`、`BACKUP_MYSQL_SOCKET` 和 `BACKUP_MYSQL_ADMIN_PASSWORD_FILE` 指向宝塔管理的 MySQL 工具、本机 Unix socket 与受限管理员密码文件；启动检查要求 socket 是存在的绝对路径。API 运行和恢复元数据只使用 `product_scout@127.0.0.1` 业务账号；为了让 MySQL 5.7 全量备份嵌入精确 binlog 坐标并验证 PITR，有限备份任务仅通过 Unix socket 从宝塔受限文件读取 `root@localhost` 凭据。该凭据不得进入进程参数、日志、数据库或备份包，禁止新增 `root@127.0.0.1`，也不能授予业务账号全局管理员权限。

## 宝塔任务

1. 数据库：每日全量，同时保留足以满足 15 分钟 RPO 的 binlog；导出嵌入精确 binlog 坐标，关闭后的坐标区间与全量 SQL 一并 AES-256-GCM 加密并验证。`BACKUP_RETENTION_DAYS` 默认 90，任务只清理超过保留期且名称匹配 M07-04 密文/证据格式的文件。
2. 文件：证据与导出按组织清单加密，保留来源、哈希和时间；配置只备份模板、版本和非秘密参数。
3. 恢复副本：将密文写入当前主机内独立的宝塔受控目录，再从该目录重新计算密文哈希。没有副本端验证不得写 `verified`；此副本不保护整机或磁盘故障。
4. 记录：以系统审计身份写入 `backup_recovery_runs/assets`，关联 request_id 和 trace_id。失败写明确 failure_code，并由宝塔告警。

宝塔计划任务命令：`cd /www/wwwroot/ai选品/backend && node scripts/run-baota-backup-drill.mjs --run --env-file /www/wwwroot/ai选品/config/product_scout.env`。任务必须在宝塔中可见、可停用、可查看日志；不得另建系统 cron 或常驻进程。

配置或 socket 路径变化不需要重启 MySQL；在宝塔中重新执行有限备份任务即可生效。若回滚本变更，先停用该任务并恢复受限环境与上一发布代码，再运行一次自检；不得以创建 TCP root 账号作为回滚手段。

## 隔离恢复演练

至少每季度在当前主机的临时隔离数据库与隔离文件根目录执行：从本机恢复副本取回密文、验证、解密、恢复到新库；核对关键业务表行数和抽样事实、`audit_logs/platform_audit_events` 链、证据 SHA-256、跨组织拒绝；记录实际 RPO/RTO。不得连接生产 Worker/Crawler，不得覆盖生产库或主文件根目录。演练结束后由宝塔任务删除明文隔离库和临时文件，只保留密文及脱敏证据。

最小本地验证：`node scripts/backup-recovery.mjs --self-test`；MySQL 5.7 集成：`node scripts/verify-backup-recovery-live.mjs`；生产门：`node scripts/verify-backup-recovery-production.mjs --production`。MySQL 集成探针先读取现有恢复记录的最大开始时间，再在其后构造两条随机 ID 探针记录并按 ID 清理，防止真实生产演练覆盖 fail-closed 状态断言；不得为验收改写或删除既有生产备份记录。生产证据放在 Git 忽略的 `.artifacts/verification/backup-recovery-production-evidence.json`。

页面验收同时覆盖桌面表格与 390 像素摘要卡片/详情抽屉；确认对象和角色显示中文、页面无横向遮挡，恢复证据始终展示按 `BACKUP_MAX_DRILL_AGE_DAYS` 计算的到期时间与剩余天数，过期后继续由既有 `stale` 状态阻断。该倒计时随只读 API 刷新，不需要新增计划任务或重启服务；调整最大演练年龄仍需修改宝塔受限环境并重启 Node 项目。原始对象代码、存储角色代码、阻断代码和 request_id 默认隐藏在“技术详情”中且可按需展开。

刷新回归必须覆盖：有可信快照时快速重复点击只产生一个在途读取；对 `backup_recovery_runs` 制造超过 14 秒的测试库锁等待，接口返回 503 `backup_recovery_read_timeout`，页面在 15 秒内保留旧快照并显示重新核验，锁释放后不得出现该 request_id 的成功审计；停止测试 MySQL 时返回脱敏 503 `backup_recovery_dependency_unavailable`，恢复原参数后重新核验回 200。以上故障注入只允许在本地或测试环境，禁止停止生产 MySQL。匿名为 401，缺 `platform:operate` 为 403；401/403 后页面不得保留旧平台事实。

代码更新后，API 的 14 秒边界和事务取消逻辑需要重启宝塔 Node 项目生效；Web 需要重新构建并发布静态文件。它们不要求重启 MySQL、Redis、Worker、Crawler 或备份计划任务，也不新增配置项。Node 重启命令仍为 `/www/server/panel/pyenv/bin/python /www/server/panel/script/restart_project.py nodejs ai选品`，只能在宝塔对象和固定目录核对无误后执行。

## 故障与回滚

认证标签或哈希不一致时立即停止解密并删除本次明文临时输出；独立恢复目录不可写或空间不足时状态为 `blocked`，不得降低为成功。只读接口超时或依赖故障先按 request_id 核对 Node 日志和 `platform_audit_events`，确认没有迟到成功审计，再在宝塔检查 Node API 与 MySQL；不得以无限提高超时掩盖连接池或锁等待。回滚时在宝塔停用任务、恢复上一版任务脚本和应用 release；迁移回滚遵循架构文档，备份密文按原保留期保存。
