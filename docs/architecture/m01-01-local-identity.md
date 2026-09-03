# M01-01 本地账号与会话架构

## 范围与非目标

本模块交付本地已验证邮箱账号及可选用户名登录别名：注册、邮箱验证、邮箱或用户名密码登录、登出、找回/重置密码、登录后改密，以及当前用户查看和撤销自己的设备会话。注册、验证和找回仍以邮箱为可信渠道；用户名不区分大小写、全局唯一，由已登录用户在个人中心主动设置，现有账号不自动生成用户名。账号在组织创建前不带 `organization_id`；本模块没有组织可见业务记录，因此不虚构租户归属。MFA、OIDC、SAML、SCIM、手机号或工号登录、组织成员和角色不在本次用户名登录扩展中实现。

页面依据为 `images-html/02_high_resolution_core_pages/02_scoutops霓虹科技登录页.png`、`03_scoutops_深海蓝注册向导.png`，并读取 `images-html/01_72_page_concepts/03_忘记密码.jpg`、`04_邮箱验证.jpg`、`05_密码重置.jpg`、`19_个人中心.jpg`、`21_安全设置.jpg`。实现保留桌面双栏、单一主 CTA、状态反馈和 390px 单栏折叠，不把参考图中的第三方登录按钮误做成已支持能力。

## 数据与服务边界

`users` 保存规范化邮箱、可空的展示用户名与规范化用户名、Argon2id 哈希、验证/锁定/禁用状态和版本；`username_normalized` 使用唯一索引，多个未设置用户名的现有账号保持 `NULL`。`user_sessions` 只保存随机会话令牌的 SHA-256 哈希；`auth_action_tokens` 只保存邮箱验证与密码重置令牌哈希并以事务单次消费；`auth_security_events` 保存脱敏 IP/User-Agent 哈希、request_id 和 trace_id。基础六组 `0008a`–`0008f` 及增量 `0067_usernames_login` 迁移兼容 MySQL 5.7 与 utf8mb4，并提供 down 文件。

注册先校验投递能力；Outbox 入库失败时删除尚未完成的待验证账号与令牌，保留不关联用户的阻断安全事件，使相同邮箱可安全重试。写 API 使用 `Idempotency-Key`；登录响应只通过 HttpOnly、SameSite=Strict Cookie 建立会话，生产名为 `__Host-scoutops_session` 且带 Secure，浏览器脚本不接触令牌。改密、重置密码会撤销该用户所有活动会话；会话列表和撤销始终从当前 Cookie 解析 user_id，不能代查其他用户。

邮件明文负载在 API 内以 `CREDENTIALS_MASTER_KEY` 派生的 AES-256-GCM 密钥加密后进入 `auth_delivery_outbox`。Worker 使用租约、有限重试、`dead_letter` 和 `blocked_provider` 状态；账号邮件 Provider 经批准后固定为 QQ Mail SMTP，使用 `smtp.qq.com:465`、TLS 校验证书与 `AUTH LOGIN` 授权码认证，只发送邮箱验证和密码找回邮件。SMTP 用户名与授权码仅从宝塔受限环境读取，命令响应、日志和审计均不记录授权码、收件人、正文或原始动作令牌。未启用 `qq_smtp` 时仍显式受阻，绝不伪造成功。Crawler、Redis、文件、导出和 SSE 不参与本模块；业务通知邮件仍保持 M05-03 的 `placeholder` 边界。

## 安全与配置依据

Argon2id 默认 `memory=19456 KiB,time=2,parallelism=1`，对应 OWASP Password Storage Cheat Sheet 的最低推荐档。密码长度、锁定阈值、会话/动作令牌 TTL、Outbox 轮询及账号邮件模式和超时均经配置 schema 校验，可由安全负责人在宝塔受限环境调整；`qq_smtp` 启动时还会校验 QQ 邮箱格式与 16 字符授权码，缺失或错误即拒绝启动。这些本地默认值不是未经审批的生产政策。错误响应区分可操作状态，但登录失败对未知邮箱和未知用户名统一返回“账号或密码不正确”，邮件请求不在响应中暴露账号是否存在。登录接口优先接受 `identifier`，并继续接受旧客户端的 `email` 字段；两种入口共享锁定、MFA、会话和审计逻辑。

## 页面与失败状态

`LocalIdentity.vue` 覆盖 login、register、forgot、verify、reset、sessions，以及 idle、loading、success、error、expired。请求使用真实 OpenAPI 路径和 `credentials: include`；页面不写 localStorage/sessionStorage。登录页的安全会话与 MFA 辅助入口先进入机器路由目录声明的会话门禁；公开 `GET /auth/session-status` 始终以 200 返回匿名/已登录布尔值，不暴露用户、会话或租户标识，匿名访问直接带安全站内回跳地址返回登录页，不再用预期 401 判断落地。桌面和 390px 快照覆盖登录、注册与匿名安全入口，键盘路径覆盖模式切换与过期恢复。

## A01–A17 证据索引

- A01–A05：本文、`packages/auth`、`0008a`–`0008f`、`0067_usernames_login`、API MySQL Repository/Outbox/Idempotency 与 Worker。
- A06–A11：`docs/openapi.yaml`、`packages/contracts`、`LocalIdentity.vue`、配置 schema/env、HttpOnly Cookie、结构化安全事件。
- A12–A16：`tests/m01-01`、真实 MySQL 5.7 探针、Playwright 桌面/390 快照和 Provider 受阻/令牌重放/锁定演练。
- A17：本文、对应 Runbook、总纲、Feature Map、OpenAPI、env.example 与模块验收报告。
