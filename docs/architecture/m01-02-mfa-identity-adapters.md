# M01-02 MFA 与企业身份适配层架构

## 范围与图片依据

本模块交付标准 TOTP MFA、一次性恢复码、短时登录挑战、本人启用/停用及企业身份适配接口。页面读取 `images-html/01_72_page_concepts/21_安全设置.jpg` 的安全卡片、状态标签和主操作层级，并复用已读取的 `images-html/02_high_resolution_core_pages/02_scoutops霓虹科技登录页.png` 登录布局实现 MFA 挑战。桌面与 390px 都以文字说明状态，不只依赖颜色。

OIDC 接口状态为 `adapter_ready`；SAML 2.0 与 SCIM 2.0 为 `reserved_disabled`。三者调用时均显式返回 `identity_provider_not_configured`，因为当前没有获批 Provider、组织域名、Client ID/Secret、回调地址、属性映射或账号回收合同。本模块不编造这些外部契约，也不提前启用企业 SAML/SCIM。组织级激活须等待 M01-03 的真实租户边界。

## 数据、安全与登录链路

`user_mfa_factors` 保存 AES-256-GCM 密文、nonce、auth tag、状态、版本和最后成功时间步；`user_mfa_recovery_codes` 只保存随机恢复码 SHA-256 哈希和单次使用时间；`user_mfa_challenges` 只保存随机挑战令牌哈希、过期、尝试次数和消费状态。`0009a`–`0009c` 使用 MySQL 5.7、utf8mb4、索引、外键和逆序 down 文件。

TOTP 使用 RFC 6238 的 HMAC-SHA1 兼容模式、30 秒默认时间步、6 位验证码与前后各一个时间步的受控窗口。成功时间步以条件更新写入，已经使用或更早的验证码不能重放。实现由 RFC 6238 官方测试向量锁定；种子使用 Node CSPRNG 生成，并以 `CREDENTIALS_MASTER_KEY` 域分离派生的 AES-256-GCM 密钥保存。依据：[RFC 6238](https://www.rfc-editor.org/info/rfc6238/)、[OWASP MFA Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)。

启用 MFA 先验证当前密码，再返回一次 `otpauth://` URI 与手工密钥；确认首个 TOTP 后启用因子并只返回一次恢复码。此响应带 `no-store`，页面不写 localStorage/sessionStorage；幂等表只记录完成标记和状态码，不保存密钥或恢复码响应，重复键明确拒绝而不重放敏感值。启用后，密码登录只创建 5 分钟默认有效的 HttpOnly、Secure、SameSite=Strict 挑战 Cookie；TOTP/恢复码成功且挑战原子消费后才创建会话 Cookie。挑战失败达到阈值即锁定。停用同时要求当前密码和当前第二因子，并撤销全部会话。

## 适用性与失败状态

TOTP 计算、挑战和恢复码消费均是同步安全路径，不投递消息、不调用 Crawler，也不产生异步业务事件，因此 M01-02.A05 的 Worker/Outbox/重试/死信不适用；强行异步会扩大验证码重放窗口。审计复用 `auth_security_events`，记录 enrollment/challenge/disable 事件、request_id/trace_id，不记录密码、验证码、恢复码、挑战令牌或种子。

页面覆盖未启用、重新认证、绑定、确认、恢复码一次显示、登录挑战、失败、过期、锁定、停用和恢复入口。OIDC/SAML/SCIM 只显示能力状态，不出现可点击的假登录按钮。

## A01–A17 证据

- A01–A05：本文、`packages/auth/src/mfa.ts`、`0009a`–`0009c` 与同步路径适用性说明。
- A06–A11：OpenAPI/共享 DTO、HttpOnly 挑战 Guard、配置 schema/env、页面和脱敏安全事件。
- A12–A16：RFC 向量/重放/恢复码/锁定单测、API Cookie 合同、MySQL 5.7 探针与 Playwright 桌面/390 快照。
- A17：总纲、Feature Map、Runbook、OpenAPI、env.example 与模块报告。
