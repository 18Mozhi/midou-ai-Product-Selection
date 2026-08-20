# M06-05 开放 API 与 Webhook

`/api/v1/platform/open/*` 是平台安全管理员的管理面，使用浏览器会话、`platform_token:manage`、同源、`Idempotency-Key`、版本和变更原因。`/open/v1/*` 是独立开放面，只接受 API Client Bearer 密钥，不读取浏览器会话。当前实际开放 scope 只有 `status:read`，未实现的业务接口不会提前发放 scope。

Client 密钥仅创建或轮换响应显示一次，MySQL 仅保存 SHA-256 哈希与可公开前缀。开放请求必须携带秒级 `X-ScoutOps-Timestamp` 和 16–128 位唯一 `X-ScoutOps-Nonce`；服务端校验时间窗、持久化 nonce、执行每 Client 分钟配额并写 `open_api_usage`。

Webhook 签名密钥使用凭证主密钥 AES-256-GCM 加密。Node Worker 按 MySQL lease 投递，签名串为 `timestamp.delivery_id.body`，头为 `X-ScoutOps-Id`、`X-ScoutOps-Timestamp`、`X-ScoutOps-Signature: v1=<hex>`。每次尝试都重新解析 DNS，拒绝私网、环回、链路本地、多播和非 HTTPS 443 地址，并把 TLS 请求固定到已校验地址，避免 DNS 重绑定。失败按 60/300/900 秒重试，第四次失败进入死信；人工重放创建新 delivery 并保留来源证据。

所有管理写入同步写平台审计与事务 outbox；每次投递状态变化写 `webhook_delivery_events`。本模块沿用 S0 单机宝塔 API/Worker，不作多节点或 10,000 用户能力声明。

管理页在桌面端用表格展示 Client、Webhook 和投递记录，760px 及以下改用摘要卡片与详情抽屉。状态和事件显示中文业务名称；Client/Webhook/delivery/organization 标识、Client 前缀、Webhook 指纹、原始错误代码与 request_id 只在折叠的“技术详情”中展示。一次性明文密钥仍按原合同显式展示一次，不会被移入可重复打开的详情。
