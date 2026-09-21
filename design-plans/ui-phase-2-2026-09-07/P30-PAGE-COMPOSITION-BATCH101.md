# P30 实际 Vue C 组合 · 批101

## 审核范围

本批使用实际 `/org-admin/members` 与 `OrganizationMemberPanel`，仅在本地审核层重构组织身份、邀请表单、邀请记录、成员筛选与成员目录。

## 保留的合同

- 保留组织摘要与成员目录读取。
- 邀请仍为 `POST /org/admin/invitations`，保留邮箱、角色与原因字段；本地审核中拦截请求，不投递邮件、不修改真实成员。
- 原有角色分配、禁用/恢复与审计原因窗均未触发、未改动。

## 本地核验

`node --test tests/unit/member-page-preview.test.mjs` 通过。

`node scripts/verify-member-page-preview.mjs --capture-review r1` 在 1440/390 通过各 6 项检查；每组仅拦截一次精确邀请合同，并生成默认与本地成功反馈的双端永久审核图。

## 未覆盖

未验证真实会话、RBAC、邮件服务、批量部分失败、角色/状态写入、刷新失败、读屏、跨组织切换或生产环境；本批不构成生产验收。
