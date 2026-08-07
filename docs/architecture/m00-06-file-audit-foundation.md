# M00-06 文件与审计基座范围

证据、导出和附件的路径强制包含 organization_id 与 workspace_id；空范围、路径穿越、不安全段和根目录逃逸全部拒绝。写入先在目标目录创建唯一临时文件，成功后原子重命名，失败在 finally 清理。

短时下载 Grant 使用调用方注入的至少 32 字节 HMAC 密钥，绑定组织、工作区、相对路径、nonce 与到期时间，最长 300 秒；本模块不猜测登录会话或开放下载路由。真实路由必须在身份/权限模块复用同一 scope Guard 后接入。

审计事件保留 actor、action、resource、organization/workspace、request_id、trace_id、UTC 时间与 schema version，metadata 对 password、secret、token、cookie、authorization、API/private key 递归脱敏。`file_assets` 与 `audit_logs` 分别由 0006a/0006b MySQL 5.7 迁移创建并提供逆序回滚。

前端依据 `images-html/01_72_page_concepts/64_系统监控.jpg` 展示 protected、denied、redacted 契约状态，覆盖桌面与 390px，不显示真实路径、签名、元数据或其他组织信息。
