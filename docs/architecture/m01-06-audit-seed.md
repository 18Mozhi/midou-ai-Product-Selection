# M01-06 审计与种子管理员

## 范围与非目标

本模块只交付一次性平台超级管理员种子、首次安全激活和平台/组织只读审计。平台管理员 CRUD、凭证管理、任务重放、审计导出和自定义角色属于后续管理模块，不在这里提前开放。

## 安全链路

1. 宝塔受限发布任务临时注入种子邮箱与强密码，运行 `node scripts/seed-platform-admin.mjs`。
2. MySQL 5.7 事务锁定固定 seed key；原子创建用户、分配 `platform_super_admin`、写脱敏审计并完成 seed run。
3. 重复执行返回 `already_seeded`；已有超级管理员但 seed 状态冲突时明确阻止。
4. 种子账号登录只建立受限会话。默认 `authenticate` 在强制改密或 MFA 未完成时返回 `security_setup_required`。
5. 改密、MFA 状态/绑定、首次状态查询和退出允许受限会话；其他 API 一律拒绝。改密撤销全部会话，MFA 确认写入安全完成时间。

## 审计与权限

`platform_audit_events` 可表达平台全局或精确组织事件。平台查询要求平台角色的 `audit:read`，组织查询要求活动成员、`audit:read` 与组织数据范围。接口只读、游标分页；元数据禁止秘密。种子、权限判定和审计写入都保持同步，不使用 Worker/Crawler/Redis 或面板外调度。
