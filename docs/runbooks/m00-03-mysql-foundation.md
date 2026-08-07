# M00-03 MySQL 基座 Runbook

在本地 MySQL 5.7 或宝塔测试库配置 `DB_*` 后运行 `node scripts/verify-mysql-live.mjs`。门禁拒绝 root、非 `product_scout` 数据库、非 5.7 或非 `utf8mb4`；它会创建带随机名的事务探针和迁移记录，并在 `finally` 删除，保留正式 `schema_migrations` 基础表。

迁移前备份；按文件名升序执行 up SQL 并记录 checksum。失败时停止下游模块，保留错误与 trace_id，不修改已应用文件。回滚按逆序执行 down SQL；只有全部业务迁移回滚且元数据已导出后才删除 `schema_migrations`。数据库配置变化需在宝塔重启 API/Worker。
