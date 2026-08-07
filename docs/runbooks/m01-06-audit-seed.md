# M01-06 宝塔运维与回滚

## 发布

1. 在宝塔发布任务备份 MySQL，并依次执行 `0013a`、`0013b`、`0013c`、`0013d` 的 up 迁移。
2. 构建当前提交。只在一次性宝塔任务中临时设置 `PLATFORM_ADMIN_SEED_EMAIL` 和 `PLATFORM_ADMIN_SEED_PASSWORD`，运行 `node scripts/seed-platform-admin.mjs`。
3. 输出必须为 `created` 或已确认的 `already_seeded`，且不包含邮箱、密码或密码哈希。成功后立即删除两个种子变量。
4. 在宝塔重启 Node API 以加载用户字段和审计路由，发布 Vue Web 静态资源。Worker 与 Crawler 无需重启。
5. 种子管理员首次登录后先改密；会话被撤销后用新密码登录并绑定 TOTP。完成前普通 API 应返回 `security_setup_required`。

## 观测与故障恢复

- 用 `request_id` / `trace_id` 在 `platform_audit_events` 和宝塔 Node 日志关联；不要打印种子环境值。
- `seed_state_missing` 表示迁移未完成；`seed_conflict` 表示已有超级管理员而单次状态不一致；`seed_email_conflict` 表示邮箱已被占用。任何一种都先停止任务并核对数据库，不要删除账号后重跑。
- 审计查询 401 需重新登录，403 需核对平台/组织 `audit:read`，依赖失败先在宝塔检查 Node API 与 MySQL。

## 回滚

1. 在宝塔停止写流量并备份 `users`、`platform_role_assignments`、`platform_seed_runs`、`platform_audit_events`。
2. 若种子已执行，先由安全负责人确认账号和审计保留方案；不得直接运行 down 迁移丢弃安全证据。
3. 回退应用提交后，按 `0013d`、`0013c`、`0013b`、`0013a` 的 down 文件逆序执行，再在宝塔重启 Node API 并重新发布 Web。
4. 回滚不会恢复已删除的种子环境变量，也不得重新使用首次密码；需要重新种子时必须经安全审批并在隔离恢复点验证。
