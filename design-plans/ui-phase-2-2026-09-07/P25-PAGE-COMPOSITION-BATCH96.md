# P25 实际 Vue C 组合 · 批96

## 审核范围

本批使用实际 `/tasks/approvals`、`ApprovalWorkspace` 与 `ApprovalQueuePanel`，只在本地审核层套用企业蓝白视觉：审批范围标题、当前重点计数、待我处理/我发起的、状态筛选、审批队列与原生审批详情窗。

## 保留的合同

- 保留审批队列、模板与成员目录的既有 GET 读取。
- 审批详情继续读取既有 `GET /tasks/approvals/{id}`，提交快照与当前证据仍显示为两类事实。
- 批准操作仍发送既有 `POST /tasks/approvals/{id}/actions`，精确保留 `action`、原始原因与 `expected_version`。
- 原有 `selected.can_decide && canManage` 判断仍决定是否展示审批原因、批准与驳回入口。

## 本地核验

`node --test tests/unit/approval-page-preview.test.mjs` 通过。

`node scripts/verify-approval-page-preview.mjs --capture-review r1` 在 1440/390 和两种动效设置下通过 32 项检查；每组仅拦截一项真实批准合同的本地响应，生成 4 张永久审核图和 5 个来源哈希。

## 未覆盖

未验证真实会话、RBAC、数据库写入、驳回、模板发布/发起、详情 404、并发版本冲突、读屏或生产环境。该审核层没有变更生产组件、接口、权限或部署状态。
