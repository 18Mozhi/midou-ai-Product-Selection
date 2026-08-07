# M01-01 本地账号与会话 Runbook

## 配置与发布

1. 在宝塔受限环境保留已有 `CREDENTIALS_MASTER_KEY`；不得把值写入 Git、日志或文档。按 `config/env.example` 设置 `AUTH_ARGON2_*`、密码长度、会话/动作令牌 TTL、锁定阈值和 `AUTH_OUTBOX_POLL_MS`。
2. 按 `0008a` 到 `0008f` 顺序执行 up 迁移。生产数据库固定 MySQL 5.7、`product_scout` 业务账号、utf8mb4。
3. 先在宝塔发布静态 Web 和 Node API，再发布 Node Worker。配置由进程启动时读取；任何 `AUTH_*` 或主密钥变化后必须在宝塔分别重启 API 与 Worker。
4. 当前生产邮件 Provider 未确认。保持投递为 `blocked_provider`，注册 API 返回可操作的 `mail_provider_pending`，不得为了演示绕过投递或把令牌返回浏览器。Provider 选型、跨境与回调合同必须在后续获批后再接入。

## 验证与观测

最小验证依次运行 `npm run build`、`node --test tests/m01-01/local-auth.test.mjs`、`node --test tests/m01-01/auth-api.test.mjs`、`node --test tests/m01-01/identity-contract.test.mjs`。使用隔离 MySQL 5.7 时设置安全的本地 `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD/CREDENTIALS_MASTER_KEY` 后运行 `node scripts/verify-local-auth-live.mjs`；脚本会创建并清理唯一探针数据。视觉门禁为 `npx playwright test tests/e2e/m01-01-local-identity.spec.ts`，最终统一运行 `npm run verify:module -- M01-01`。

宝塔日志只观察事件名、状态、request_id、trace_id 和重试次数，不记录邮箱、密码、Cookie、原始动作令牌或主密钥。重点告警：注册投递连续失败、Outbox `dead_letter` 增长、`blocked_provider` 非预期出现、登录锁定激增、数据库不可用。定位时以 trace_id 关联 API 安全事件和 Worker Outbox 行。

## 故障恢复

- MySQL/Outbox 暂时失败：API 不保留半成品待验证账号；恢复依赖后用户可用原邮箱重试。Worker 依照租约和退避重试，超过上限进入 dead_letter，必须人工确认原因后按后续重放流程恢复。
- 邮件 Provider 未启用：这是已知受阻状态，不是发送成功。确认 Provider 和合规合同前不重放。
- 会话泄露或密码变更：用户在安全会话页撤销单个会话；改密或重置密码会撤销全部活动会话。
- 动作链接过期/重放：返回 `invalid_or_expired_token`，不得人工把数据库令牌改回未消费状态。

## 回滚

先在宝塔停止接收新的注册/登录写请求并停止 Worker，导出受影响的身份表与审计证据。回退 Web、API、Worker 到上一构建后，只有在确认允许删除 M01-01 数据时才按 `0008f`、`0008e`、`0008d`、`0008c`、`0008b`、`0008a` 的 down 文件逆序回滚；down 会删除本地账号、会话、令牌、Outbox、幂等记录和安全事件，属于破坏性操作。若需保留账号数据，只回退应用构建，不执行 down。最后在宝塔启动上一版本并验证 `/api/v1/health/live`、`/api/v1/health/ready`，不得使用面板外服务顶替。
