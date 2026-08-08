# M06-04 安全与密钥运营

页面按概念图 65–68 组合安全事件、会话、Token、凭证生命周期与平台审计。API 需要 `platform:secure`；读证据写入 `security_operations_views` 与全局审计。Repository 使用字段白名单，禁止选择任何认证秘密、密文、nonce、auth tag、Token hash、Cookie 或原始网络标识。

本模块不复制已有的会话撤销、Token 管理或凭证轮换写合同。写入继续受既有 capability、同源、幂等、版本和原因约束。没有外部 SIEM/KMS 时只展示真实本地状态，不伪造已接入结论。
