# M06-05 开放 API 与 Webhook

`/api/v1/platform/open/*` 是平台安全管理员的管理面，使用浏览器会话、`platform_token:manage`、同源、`Idempotency-Key`、版本和变更原因。`/open/v1/*` 是独立开放面，只接受 API Client Bearer 密钥，不读取浏览器会话。当前实际开放 scope 只有 `status:read`，未实现的业务接口不会提前发放 scope。

Client 密钥仅创建或轮换响应显示一次，MySQL 仅保存 SHA-256 哈希与可公开前缀。开放请求必须携带秒级 `X-ScoutOps-Timestamp` 和 16–128 位唯一 `X-ScoutOps-Nonce`；服务端校验时间窗、持久化 nonce、执行每 Client 分钟配额并写 `open_api_usage`。

Webhook 签名密钥使用凭证主密钥 AES-256-GCM 加密。Node Worker 按 MySQL lease 投递，签名串为 `timestamp.delivery_id.body`，头为 `X-ScoutOps-Id`、`X-ScoutOps-Timestamp`、`X-ScoutOps-Signature: v1=<hex>`。每次尝试都重新解析 DNS，拒绝私网、环回、链路本地、多播和非 HTTPS 443 地址，并把 TLS 请求固定到已校验地址，避免 DNS 重绑定。失败按 60/300/900 秒重试，第四次失败进入死信；人工重放创建新 delivery 并保留来源证据。

所有管理写入同步写平台审计与事务 outbox；每次投递状态变化写 `webhook_delivery_events`。本模块沿用 S0 单机宝塔 API/Worker，不作多节点或 10,000 用户能力声明。

管理页只向拥有 `platform_token:manage` 的平台角色开放，与管理接口使用同一能力边界；不再额外要求 `platform:superadmin`。页面一次只展示 Client、Webhook 或投递记录中的一类，三类数据都使用 MySQL 服务端搜索、状态筛选、排序和独立分页，默认每页 20 条、最大 50 条，同时返回未截断的真实总数和汇总计数。`organization_id` 必须是 UUID；各集合的 page、page_size、status、sort 和最长 120 字搜索词均由服务端失败关闭校验。MySQL 不可用时概览统一返回 503，浏览器 15 秒超时后保留最后一次成功结果。

桌面端使用完整宽度表格，760px 及以下改用摘要卡片与详情抽屉。当前视图、组织、搜索、状态、排序、页码和每页数量写入 URL，刷新后可恢复；切换数据类型不会把筛选错误套到另一类记录。状态和事件显示中文业务名称，数据库中仍为 active 但已经到期的 Client 在读取时按 `expired` 展示且不提供轮换或撤销动作；Client/Webhook/delivery/organization 标识、Client 前缀、Webhook 指纹、原始错误代码与 request_id 只在折叠的“技术详情”中展示。一次性明文密钥仍按原合同显式展示一次，并提供复制与主动关闭，但不会进入可重复打开的详情。

API Client 创建、轮换和撤销在写入前展示令牌权限风险预览。预览只解释当前真实 `status:read` scope、组织范围、分钟配额和操作后果：创建说明只读边界以及服务端决定的到期时间，轮换说明权限与配额不变且旧密钥立即失效，撤销说明访问立即终止且不可恢复。Webhook 创建、启停、测试、轮换和投递重放也都在写前确认，测试结果通过真实 Worker 和投递列表反馈。页面不虚构未开放 scope，也不使用未经配置的高/中/低风险分级；服务端同源校验、幂等键、版本锁和审计仍是最终边界。
