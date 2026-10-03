# M00-03 MySQL 基座 Runbook

本地 MySQL 5.7 或宝塔测试库配置 `DB_*` 后，运行 `node scripts/verify-mysql-live.mjs`。若没有隔离测试库且已明确授权使用当前生产库，可运行 `$env:SCOUTOPS_MYSQL_LIVE_TARGET='baota-production'; npm run verify:all`；该模式通过已固定的宝塔 SSH 目标执行同一探针，数据库凭据只从服务器受限环境文件加载，不回传本机，也不输出。该生产模式会临时写入唯一迁移标记和唯一临时表，验证后清理并回读确认；只允许在明确授权的验收/发布期间使用。

门禁拒绝 root、非 `product_scout` 数据库、非 5.7 或非 `utf8mb4`；本地与宝塔模式都验证迁移幂等和事务回滚，并在 `finally` 删除临时记录与表，保留正式 `schema_migrations` 基础表。宝塔模式只发送当前本地探针源代码到远端 Node 的内存参数，不写入服务器文件；固定 SSH 主机身份未验证时失败关闭。

迁移前备份；按文件名升序执行 up SQL 并记录 checksum。失败时停止下游模块，保留错误与 trace_id，不修改已应用文件。回滚按逆序执行 down SQL；只有全部业务迁移回滚且元数据已导出后才删除 `schema_migrations`。数据库配置变化需在宝塔重启 API/Worker。
