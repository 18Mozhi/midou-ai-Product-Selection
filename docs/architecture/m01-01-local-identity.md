# M01-01 本地账号与会话架构

## 范围与非目标

本模块只交付本地邮箱账号：注册、邮箱验证、邮箱密码登录、登出、找回/重置密码、登录后改密，以及当前用户查看和撤销自己的设备会话。账号在组织创建前不带 `organization_id`；本模块没有组织可见业务记录，因此不虚构租户归属。MFA、OIDC、SAML、SCIM、手机号登录、组织成员和角色属于后续模块，不在 M01-01 提前实现。

页面依据为 `images-html/02_high_resolution_core_pages/02_scoutops霓虹科技登录页.png`、`03_scoutops_深海蓝注册向导.png`，并读取 `images-html/01_72_page_concepts/03_忘记密码.jpg`、`04_邮箱验证.jpg`、`05_密码重置.jpg`、`19_个人中心.jpg`、`21_安全设置.jpg`。实现保留桌面双栏、单一主 CTA、状态反馈和 390px 单栏折叠，不把参考图中的第三方登录按钮误做成已支持能力。

## 数据与服务边界

`users` 保存规范化邮箱、Argon2id 哈希、验证/锁定/禁用状态和版本；`user_sessions` 只保存随机会话令牌的 SHA-256 哈希；`auth_action_tokens` 只保存邮箱验证与密码重置令牌哈希并以事务单次消费；`auth_security_events` 保存脱敏 IP/User-Agent 哈希、request_id 和 trace_id。六组 `0008a`–`0008f` 迁移兼容 MySQL 5.7 与 utf8mb4，并提供逆序 down 文件。

注册先校验投递能力；Outbox 入库失败时删除尚未完成的待验证账号与令牌，保留不关联用户的阻断安全事件，使相同邮箱可安全重试。写 API 使用 `Idempotency-Key`；登录响应只通过 HttpOnly、SameSite=Strict Cookie 建立会话，生产名为 `__Host-scoutops_session` 且带 Secure，浏览器脚本不接触令牌。改密、重置密码会撤销该用户所有活动会话；会话列表和撤销始终从当前 Cookie 解析 user_id，不能代查其他用户。

邮件明文负载在 API 内以 `CREDENTIALS_MASTER_KEY` 派生的 AES-256-GCM 密钥加密后进入 `auth_delivery_outbox`。Worker 使用租约、有限重试、`dead_letter` 和 `blocked_provider` 状态；当前蓝图尚未确认生产邮件 Provider，因此真实发送保持显式受阻，绝不伪造成功。Crawler、Redis、文件、导出和 SSE 不参与本模块。

## 安全与配置依据

Argon2id 默认 `memory=19456 KiB,time=2,parallelism=1`，对应 OWASP Password Storage Cheat Sheet 的最低推荐档。密码长度、锁定阈值、会话/动作令牌 TTL 和 Outbox 轮询均经配置 schema 校验，可由安全负责人在宝塔受限环境调整；这些本地默认值不是未经审批的生产政策。错误响应区分可操作状态但登录失败对未知邮箱保持统一文案，邮件请求不在响应中暴露账号是否存在。

## 页面与失败状态

`LocalIdentity.vue` 覆盖 login、register、forgot、verify、reset、sessions，以及 idle、loading、success、error、expired。请求使用真实 OpenAPI 路径和 `credentials: include`；页面不写 localStorage/sessionStorage。桌面和 390px 快照覆盖登录、注册与会话，键盘路径覆盖模式切换、过期恢复和安全会话入口。

## A01–A17 证据索引

- A01–A05：本文、`packages/auth`、`0008a`–`0008f`、API MySQL Repository/Outbox/Idempotency 与 Worker。
- A06–A11：`docs/openapi.yaml`、`packages/contracts`、`LocalIdentity.vue`、配置 schema/env、HttpOnly Cookie、结构化安全事件。
- A12–A16：`tests/m01-01`、真实 MySQL 5.7 探针、Playwright 桌面/390 快照和 Provider 受阻/令牌重放/锁定演练。
- A17：本文、对应 Runbook、总纲、Feature Map、OpenAPI、env.example 与模块验收报告。
