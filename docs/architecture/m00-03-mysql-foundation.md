# M00-03 MySQL 5.7 基座

`@scoutops/database` 提供受配置边界约束的连接池、显式事务和 checksum 迁移合同。`schema_migrations` 记录文件名、SHA-256 与 UTC 应用时间；已应用文件内容发生变化必须阻断。生产固定 MySQL 5.7、`utf8mb4`、业务库/账号 `product_scout`，禁止 root 与 MySQL 8 专属语法。

真实门禁必须确认服务版本为 5.7、服务端字符集为 `utf8mb4`、当前库/账号均为 `product_scout`，并实际验证 bootstrap、checksum 幂等迁移和事务回滚。服务不可用时返回 blocked；静态 SQL 与伪执行器测试不替代该外部门禁。2026-08-07 的本地验收使用 Oracle 官方 5.7.44 ZIP 在隔离临时端口执行，不注册系统服务，也不构成生产部署证据。

前端依据 `images-html/01_72_page_concepts/64_系统监控.jpg` 提供 available、blocked、rollback 契约状态与桌面/390px 布局，明确标注非实时监控且不显示连接或数据。真实 readiness、认证与平台运维权限由 M00-05 接入。
