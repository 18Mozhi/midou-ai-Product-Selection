# M06-01 组织管理后台

## 范围与事实边界

本模块实现当前组织的资料、成员与邀请、固定角色模板、工作区、团队、审批事实、组织数据入口、组织 Token 元数据和组织审计。所有查询以服务端会话解析出的 `organization_id` 为范围，不接受浏览器指定组织覆盖。平台驾驶舱、开放 API/Webhook、支付和多节点能力不属于本模块。

组织资料与成员管理使用独立子路由。普通管理界面以工作区名称、成员邮箱、中文角色和中文能力名称表达业务对象；工作区和成员 UUID 仍作为既有 API 写入值，但只允许出现在折叠的“技术详情”或表单选项值中，不作为选择或识别对象的主文案。审批主列表同样不直接展示资源 UUID 和流程节点键。

组织资料、成员、角色、工作区、团队和 Token 的写入使用 `Idempotency-Key`、原因与适用的乐观版本锁。同事务写业务表、`audit_logs`、`outbox_events` 和幂等结果；Outbox 由宝塔管理的 Worker 消费，本模块不创建面板外服务。邀请邮件 Provider 未确认，因此状态保持 `pending_delivery`。

## 安全与失败

- 路由分别要求 organization、membership、role、workspace、team、approval、organization_token、audit 或 report 能力。
- 自我禁用、移除最后一位活动组织管理员、归档默认工作区、跨组织负责人/团队成员全部失败关闭。
- Token 只允许 `task:read`、`trend:read`、`opportunity:read`、`report:read`；明文仅返回一次，数据库只保存 SHA-256 哈希和前缀。
- 空结果保持空数组或零，不填充图片示例数据；409 冲突要求刷新真实版本后重试。

## 数据与回滚

迁移 `0019_organization_admin_m06_01` 增加邀请、团队成员关系、组织 Token、幂等操作以及组织 Logo/团队负责人字段，兼容 MySQL 5.7 和 utf8mb4。回滚前先关闭 `/org-admin` 写入口并撤销仍在使用的组织 Token；导出需留存的审计证据后，执行 down migration。审计记录不得为掩盖失败而删除。
