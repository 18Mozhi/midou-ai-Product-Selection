# M00-06 文件与审计基座 Runbook

生产文件根目录仅配置于宝塔受限环境，并由宝塔备份任务写入当前主机内独立加密恢复目录。目录必须可写但不可作为静态网站根直接暴露；同机副本不保护整机故障。运行 `npm run build`、`node --test tests/m00-06/file-audit-foundation.test.mjs`、`node scripts/verify-file-audit-live.mjs` 和 `npm run verify:module -- M00-06`；生产验收使用 `SCOUTOPS_FILE_AUDIT_LIVE_TARGET=baota-production node scripts/verify-file-audit-live.mjs`，在固定宝塔节点使用服务端配置。该探针只在已迁移表中写入随机组织/工作区专用记录并在结束时删除，不创建/删除表或隔离部署环境；使用 OS 临时目录，完成后清理文件和 MySQL 探针记录。表缺失时安全失败，由正式部署迁移处理，不在探针中执行 DDL。

下载失败时检查授权签名、组织/工作区、相对路径和到期时间，不延长现有 Token、不打印 Token。写入失败清理同目录 `.tmp`；来源不明文件不得自动删除。审计告警只引用 audit_id/request_id/trace_id，不回显敏感 metadata。

## 回滚

先在宝塔恢复上一构建和文件根配置并重启受影响项目。数据库按 `0006b...down.sql` 后 `0006a...down.sql` 逆序回滚；执行前备份并确认没有下游外键/审计查询。文件数据不随 schema 回滚删除，保留到人工核对归属、哈希和备份后处理。
