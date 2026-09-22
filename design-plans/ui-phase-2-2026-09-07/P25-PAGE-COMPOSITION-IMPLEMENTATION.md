# P25 审批中心 C 方向生产实施

## 范围

本批将已审核的蓝白审批工作区迁移到真实 `/tasks/approvals`、`ApprovalWorkspace.vue` 与 `ApprovalQueuePanel.vue`：审批范围标题、当前重点计数、待我处理/我发起的、状态筛选、审批队列、详情窗和审批模板/发起窗。

## 保留的运行合同

- 审批队列、模板和成员目录继续走既有 GET 读取。
- 详情继续读取 `GET /tasks/approvals/{id}`，提交快照与当前证据仍分开展示。
- 批准/驳回继续发送 `POST /tasks/approvals/{id}/actions`，保留 `action`、原始原因与 `expected_version`。
- `selected.can_decide && canManage` 仍决定原因输入、批准与驳回入口；本批不新增 API、数据库字段、权限或审批规则。

## 实施内容

- 在生产组件上启用 `approval-workspace--review` C 方向作用域，并将页面主标题升级为单一 `h1`。
- 统一蓝色标题区、重点计数、队列筛选、白色事实列表、浅蓝详情区、危险驳回按钮和键盘焦点。
- 补齐桌面/移动队列、审批详情、模板草稿、发布和发起审批窗的响应式视觉层。

## 验证证据

- `node --test tests/unit/approval-page-preview.test.mjs`：通过。
- `node scripts/verify-approval-page-preview.mjs --capture-review r2`：1440/390、reduced/no-preference 四组共32项检查通过，生成4张审阅图，批准合同每组精确拦截一次。
- Web 类型检查、格式检查、生产构建与宝塔部署在本批提交前完成。

## 未覆盖边界

真实会话、RBAC、数据库写入、驳回、模板发布/发起、详情 404、并发版本冲突、读屏完整回归和正式 M07-03 生产证据不在本批假设为已验收。
