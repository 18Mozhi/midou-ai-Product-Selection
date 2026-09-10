# P31 角色与权限 / 控件状态待审

ROLE-CONTROLS-C-r1，2026-09-10。使用ui-skills-root/frontend-design及现有Playwright，保留已选C方向、蓝分区/白工作面；仅新子稿强化44px点击区、16px技术入口、蓝焦点/危险按下反馈和等待说明。原48图/renderer/fixture与真实Vue未改。

[图册](gallery.html) · [交互稿](index.html) · [页面规格](../../page-specs/P31.md) · [源合同](../../roles-semantic-contract-review.md)

42控件/变体、189个单端状态、双端378PNG，78次离线点击/选择核对。18代表动作及24附加变体；这些不是新增业务动作。

分区/角色/状态筛选的已选与未选分别出图；鼠标按下不冒充逻辑选中。四类型创建表单保留白名单与真实详情复制UUID，空动作禁用、创建等待、延期等待、撤销原因不足分别列明。原因窗先关闭再演示输入确认，不补造窗内提交busy；共享前端无maxlength，服务端max500仍须单独验证。

分页夹具仅一页：两按钮只展示disabled，不伪造可翻页数据。当前唯一授权已选按钮不证明跨授权切换。父级刷新/错误尚未出图，类型select不截图原生系统弹层/pressed。状态筛选busy只模拟目标按钮禁用，不宣称全页异步时序通过。现有原型延期期限仅验未来30天，真实后端另要求晚于原expiry；本批只用合法延期样本，不宣称服务器接受输入演示。

所有字段六态、完整组合、真实C实施/跨范围/草稿归属、具体审核及全站宝塔验收仍待。无API请求、cookies/storage、真实授权写入；不改权限/API/OpenAPI/MySQL/env/依赖，无新增配置、无需重启、未部署。全部图为永久审核交付物，非临时测试产物。

验证：node scripts/verify-ui-phase2-roles-controls-c.mjs --smoke；--capture生成永久PNG/图册/evidence；无参数核对来源与PNG哈希并重演交互。

| 控件/变体 | 状态 | 1440 | 390 |
| --- | --- | --- | --- |
| 角色模板分区 / 未选 | default | [桌面](section-roles-available-default-1440.png) | [手机](section-roles-available-default-390.png) |
| 角色模板分区 / 未选 | hover | [桌面](section-roles-available-hover-1440.png) | [手机](section-roles-available-hover-390.png) |
| 角色模板分区 / 未选 | focus | [桌面](section-roles-available-focus-1440.png) | [手机](section-roles-available-focus-390.png) |
| 角色模板分区 / 未选 | pressed | [桌面](section-roles-available-pressed-1440.png) | [手机](section-roles-available-pressed-390.png) |
| 角色模板分区 / 已选 | default | [桌面](section-roles-selected-default-1440.png) | [手机](section-roles-selected-default-390.png) |
| 角色模板分区 / 已选 | hover | [桌面](section-roles-selected-hover-1440.png) | [手机](section-roles-selected-hover-390.png) |
| 角色模板分区 / 已选 | focus | [桌面](section-roles-selected-focus-1440.png) | [手机](section-roles-selected-focus-390.png) |
| 角色模板分区 / 已选 | pressed | [桌面](section-roles-selected-pressed-1440.png) | [手机](section-roles-selected-pressed-390.png) |
| 数据范围分区 / 未选 | default | [桌面](section-scopes-available-default-1440.png) | [手机](section-scopes-available-default-390.png) |
| 数据范围分区 / 未选 | hover | [桌面](section-scopes-available-hover-1440.png) | [手机](section-scopes-available-hover-390.png) |
| 数据范围分区 / 未选 | focus | [桌面](section-scopes-available-focus-1440.png) | [手机](section-scopes-available-focus-390.png) |
| 数据范围分区 / 未选 | pressed | [桌面](section-scopes-available-pressed-1440.png) | [手机](section-scopes-available-pressed-390.png) |
| 数据范围分区 / 已选 | default | [桌面](section-scopes-selected-default-1440.png) | [手机](section-scopes-selected-default-390.png) |
| 数据范围分区 / 已选 | hover | [桌面](section-scopes-selected-hover-1440.png) | [手机](section-scopes-selected-hover-390.png) |
| 数据范围分区 / 已选 | focus | [桌面](section-scopes-selected-focus-1440.png) | [手机](section-scopes-selected-focus-390.png) |
| 数据范围分区 / 已选 | pressed | [桌面](section-scopes-selected-pressed-1440.png) | [手机](section-scopes-selected-pressed-390.png) |
| 指定授权分区 / 未选 | default | [桌面](section-grants-available-default-1440.png) | [手机](section-grants-available-default-390.png) |
| 指定授权分区 / 未选 | hover | [桌面](section-grants-available-hover-1440.png) | [手机](section-grants-available-hover-390.png) |
| 指定授权分区 / 未选 | focus | [桌面](section-grants-available-focus-1440.png) | [手机](section-grants-available-focus-390.png) |
| 指定授权分区 / 未选 | pressed | [桌面](section-grants-available-pressed-1440.png) | [手机](section-grants-available-pressed-390.png) |
| 指定授权分区 / 已选 | default | [桌面](section-grants-selected-default-1440.png) | [手机](section-grants-selected-default-390.png) |
| 指定授权分区 / 已选 | hover | [桌面](section-grants-selected-hover-1440.png) | [手机](section-grants-selected-hover-390.png) |
| 指定授权分区 / 已选 | focus | [桌面](section-grants-selected-focus-1440.png) | [手机](section-grants-selected-focus-390.png) |
| 指定授权分区 / 已选 | pressed | [桌面](section-grants-selected-pressed-1440.png) | [手机](section-grants-selected-pressed-390.png) |
| 组织管理员 / 未选 | default | [桌面](role-organization_admin-available-default-1440.png) | [手机](role-organization_admin-available-default-390.png) |
| 组织管理员 / 未选 | hover | [桌面](role-organization_admin-available-hover-1440.png) | [手机](role-organization_admin-available-hover-390.png) |
| 组织管理员 / 未选 | focus | [桌面](role-organization_admin-available-focus-1440.png) | [手机](role-organization_admin-available-focus-390.png) |
| 组织管理员 / 未选 | pressed | [桌面](role-organization_admin-available-pressed-1440.png) | [手机](role-organization_admin-available-pressed-390.png) |
| 组织管理员 / 已选 | default | [桌面](role-organization_admin-selected-default-1440.png) | [手机](role-organization_admin-selected-default-390.png) |
| 组织管理员 / 已选 | hover | [桌面](role-organization_admin-selected-hover-1440.png) | [手机](role-organization_admin-selected-hover-390.png) |
| 组织管理员 / 已选 | focus | [桌面](role-organization_admin-selected-focus-1440.png) | [手机](role-organization_admin-selected-focus-390.png) |
| 组织管理员 / 已选 | pressed | [桌面](role-organization_admin-selected-pressed-1440.png) | [手机](role-organization_admin-selected-pressed-390.png) |
| 审计员 / 未选 | default | [桌面](role-auditor-available-default-1440.png) | [手机](role-auditor-available-default-390.png) |
| 审计员 / 未选 | hover | [桌面](role-auditor-available-hover-1440.png) | [手机](role-auditor-available-hover-390.png) |
| 审计员 / 未选 | focus | [桌面](role-auditor-available-focus-1440.png) | [手机](role-auditor-available-focus-390.png) |
| 审计员 / 未选 | pressed | [桌面](role-auditor-available-pressed-1440.png) | [手机](role-auditor-available-pressed-390.png) |
| 审计员 / 已选 | default | [桌面](role-auditor-selected-default-1440.png) | [手机](role-auditor-selected-default-390.png) |
| 审计员 / 已选 | hover | [桌面](role-auditor-selected-hover-1440.png) | [手机](role-auditor-selected-hover-390.png) |
| 审计员 / 已选 | focus | [桌面](role-auditor-selected-focus-1440.png) | [手机](role-auditor-selected-focus-390.png) |
| 审计员 / 已选 | pressed | [桌面](role-auditor-selected-pressed-1440.png) | [手机](role-auditor-selected-pressed-390.png) |
| 角色技术能力 / 收起 | default | [桌面](role-technical-closed-default-1440.png) | [手机](role-technical-closed-default-390.png) |
| 角色技术能力 / 收起 | hover | [桌面](role-technical-closed-hover-1440.png) | [手机](role-technical-closed-hover-390.png) |
| 角色技术能力 / 收起 | focus | [桌面](role-technical-closed-focus-1440.png) | [手机](role-technical-closed-focus-390.png) |
| 角色技术能力 / 收起 | pressed | [桌面](role-technical-closed-pressed-1440.png) | [手机](role-technical-closed-pressed-390.png) |
| 角色技术能力 / 展开 | default | [桌面](role-technical-open-default-1440.png) | [手机](role-technical-open-default-390.png) |
| 角色技术能力 / 展开 | hover | [桌面](role-technical-open-hover-1440.png) | [手机](role-technical-open-hover-390.png) |
| 角色技术能力 / 展开 | focus | [桌面](role-technical-open-focus-1440.png) | [手机](role-technical-open-focus-390.png) |
| 角色技术能力 / 展开 | pressed | [桌面](role-technical-open-pressed-1440.png) | [手机](role-technical-open-pressed-390.png) |
| 能力筛选重置 | default | [桌面](capability-reset-default-1440.png) | [手机](capability-reset-default-390.png) |
| 能力筛选重置 | hover | [桌面](capability-reset-hover-1440.png) | [手机](capability-reset-hover-390.png) |
| 能力筛选重置 | focus | [桌面](capability-reset-focus-1440.png) | [手机](capability-reset-focus-390.png) |
| 能力筛选重置 | pressed | [桌面](capability-reset-pressed-1440.png) | [手机](capability-reset-pressed-390.png) |
| 能力筛选重置 | disabled | [桌面](capability-reset-disabled-1440.png) | [手机](capability-reset-disabled-390.png) |
| 成员范围筛选重置 | default | [桌面](scope-reset-default-1440.png) | [手机](scope-reset-default-390.png) |
| 成员范围筛选重置 | hover | [桌面](scope-reset-hover-1440.png) | [手机](scope-reset-hover-390.png) |
| 成员范围筛选重置 | focus | [桌面](scope-reset-focus-1440.png) | [手机](scope-reset-focus-390.png) |
| 成员范围筛选重置 | pressed | [桌面](scope-reset-pressed-1440.png) | [手机](scope-reset-pressed-390.png) |
| 成员范围筛选重置 | disabled | [桌面](scope-reset-disabled-1440.png) | [手机](scope-reset-disabled-390.png) |
| 展开创建授权 | default | [桌面](create-open-default-1440.png) | [手机](create-open-default-390.png) |
| 展开创建授权 | hover | [桌面](create-open-hover-1440.png) | [手机](create-open-hover-390.png) |
| 展开创建授权 | focus | [桌面](create-open-focus-1440.png) | [手机](create-open-focus-390.png) |
| 展开创建授权 | pressed | [桌面](create-open-pressed-1440.png) | [手机](create-open-pressed-390.png) |
| 取消创建（保留草稿） | default | [桌面](create-cancel-default-1440.png) | [手机](create-cancel-default-390.png) |
| 取消创建（保留草稿） | hover | [桌面](create-cancel-hover-1440.png) | [手机](create-cancel-hover-390.png) |
| 取消创建（保留草稿） | focus | [桌面](create-cancel-focus-1440.png) | [手机](create-cancel-focus-390.png) |
| 取消创建（保留草稿） | pressed | [桌面](create-cancel-pressed-1440.png) | [手机](create-cancel-pressed-390.png) |
| 创建任务授权 | default | [桌面](create-task-default-1440.png) | [手机](create-task-default-390.png) |
| 创建任务授权 | hover | [桌面](create-task-hover-1440.png) | [手机](create-task-hover-390.png) |
| 创建任务授权 | focus | [桌面](create-task-focus-1440.png) | [手机](create-task-focus-390.png) |
| 创建任务授权 | pressed | [桌面](create-task-pressed-1440.png) | [手机](create-task-pressed-390.png) |
| 创建任务授权 | disabled | [桌面](create-task-disabled-1440.png) | [手机](create-task-disabled-390.png) |
| 创建任务授权 | busy | [桌面](create-task-busy-1440.png) | [手机](create-task-busy-390.png) |
| 创建机会授权 | default | [桌面](create-opportunity-default-1440.png) | [手机](create-opportunity-default-390.png) |
| 创建机会授权 | hover | [桌面](create-opportunity-hover-1440.png) | [手机](create-opportunity-hover-390.png) |
| 创建机会授权 | focus | [桌面](create-opportunity-focus-1440.png) | [手机](create-opportunity-focus-390.png) |
| 创建机会授权 | pressed | [桌面](create-opportunity-pressed-1440.png) | [手机](create-opportunity-pressed-390.png) |
| 创建机会授权 | disabled | [桌面](create-opportunity-disabled-1440.png) | [手机](create-opportunity-disabled-390.png) |
| 创建机会授权 | busy | [桌面](create-opportunity-busy-1440.png) | [手机](create-opportunity-busy-390.png) |
| 创建竞品授权 | default | [桌面](create-competitor-default-1440.png) | [手机](create-competitor-default-390.png) |
| 创建竞品授权 | hover | [桌面](create-competitor-hover-1440.png) | [手机](create-competitor-hover-390.png) |
| 创建竞品授权 | focus | [桌面](create-competitor-focus-1440.png) | [手机](create-competitor-focus-390.png) |
| 创建竞品授权 | pressed | [桌面](create-competitor-pressed-1440.png) | [手机](create-competitor-pressed-390.png) |
| 创建竞品授权 | disabled | [桌面](create-competitor-disabled-1440.png) | [手机](create-competitor-disabled-390.png) |
| 创建竞品授权 | busy | [桌面](create-competitor-busy-1440.png) | [手机](create-competitor-busy-390.png) |
| 创建供应链授权 | default | [桌面](create-sourcing-default-1440.png) | [手机](create-sourcing-default-390.png) |
| 创建供应链授权 | hover | [桌面](create-sourcing-hover-1440.png) | [手机](create-sourcing-hover-390.png) |
| 创建供应链授权 | focus | [桌面](create-sourcing-focus-1440.png) | [手机](create-sourcing-focus-390.png) |
| 创建供应链授权 | pressed | [桌面](create-sourcing-pressed-1440.png) | [手机](create-sourcing-pressed-390.png) |
| 创建供应链授权 | disabled | [桌面](create-sourcing-disabled-1440.png) | [手机](create-sourcing-disabled-390.png) |
| 创建供应链授权 | busy | [桌面](create-sourcing-busy-1440.png) | [手机](create-sourcing-busy-390.png) |
| 未选择动作 / 创建禁用 | disabled | [桌面](create-no-actions-disabled-1440.png) | [手机](create-no-actions-disabled-390.png) |
| 选择资源类型 | default | [桌面](resource-type-default-1440.png) | [手机](resource-type-default-390.png) |
| 选择资源类型 | hover | [桌面](resource-type-hover-1440.png) | [手机](resource-type-hover-390.png) |
| 选择资源类型 | focus | [桌面](resource-type-focus-1440.png) | [手机](resource-type-focus-390.png) |
| 全部授权 / 未选 | default | [桌面](status-all-available-default-1440.png) | [手机](status-all-available-default-390.png) |
| 全部授权 / 未选 | hover | [桌面](status-all-available-hover-1440.png) | [手机](status-all-available-hover-390.png) |
| 全部授权 / 未选 | focus | [桌面](status-all-available-focus-1440.png) | [手机](status-all-available-focus-390.png) |
| 全部授权 / 未选 | pressed | [桌面](status-all-available-pressed-1440.png) | [手机](status-all-available-pressed-390.png) |
| 全部授权 / 未选 | disabled | [桌面](status-all-available-disabled-1440.png) | [手机](status-all-available-disabled-390.png) |
| 全部授权 / 未选 | busy | [桌面](status-all-available-busy-1440.png) | [手机](status-all-available-busy-390.png) |
| 全部授权 / 已选 | default | [桌面](status-all-selected-default-1440.png) | [手机](status-all-selected-default-390.png) |
| 全部授权 / 已选 | hover | [桌面](status-all-selected-hover-1440.png) | [手机](status-all-selected-hover-390.png) |
| 全部授权 / 已选 | focus | [桌面](status-all-selected-focus-1440.png) | [手机](status-all-selected-focus-390.png) |
| 全部授权 / 已选 | pressed | [桌面](status-all-selected-pressed-1440.png) | [手机](status-all-selected-pressed-390.png) |
| 全部授权 / 已选 | disabled | [桌面](status-all-selected-disabled-1440.png) | [手机](status-all-selected-disabled-390.png) |
| 全部授权 / 已选 | busy | [桌面](status-all-selected-busy-1440.png) | [手机](status-all-selected-busy-390.png) |
| 生效中授权 / 未选 | default | [桌面](status-active-available-default-1440.png) | [手机](status-active-available-default-390.png) |
| 生效中授权 / 未选 | hover | [桌面](status-active-available-hover-1440.png) | [手机](status-active-available-hover-390.png) |
| 生效中授权 / 未选 | focus | [桌面](status-active-available-focus-1440.png) | [手机](status-active-available-focus-390.png) |
| 生效中授权 / 未选 | pressed | [桌面](status-active-available-pressed-1440.png) | [手机](status-active-available-pressed-390.png) |
| 生效中授权 / 未选 | disabled | [桌面](status-active-available-disabled-1440.png) | [手机](status-active-available-disabled-390.png) |
| 生效中授权 / 未选 | busy | [桌面](status-active-available-busy-1440.png) | [手机](status-active-available-busy-390.png) |
| 生效中授权 / 已选 | default | [桌面](status-active-selected-default-1440.png) | [手机](status-active-selected-default-390.png) |
| 生效中授权 / 已选 | hover | [桌面](status-active-selected-hover-1440.png) | [手机](status-active-selected-hover-390.png) |
| 生效中授权 / 已选 | focus | [桌面](status-active-selected-focus-1440.png) | [手机](status-active-selected-focus-390.png) |
| 生效中授权 / 已选 | pressed | [桌面](status-active-selected-pressed-1440.png) | [手机](status-active-selected-pressed-390.png) |
| 生效中授权 / 已选 | disabled | [桌面](status-active-selected-disabled-1440.png) | [手机](status-active-selected-disabled-390.png) |
| 生效中授权 / 已选 | busy | [桌面](status-active-selected-busy-1440.png) | [手机](status-active-selected-busy-390.png) |
| 已到期授权 / 未选 | default | [桌面](status-expired-available-default-1440.png) | [手机](status-expired-available-default-390.png) |
| 已到期授权 / 未选 | hover | [桌面](status-expired-available-hover-1440.png) | [手机](status-expired-available-hover-390.png) |
| 已到期授权 / 未选 | focus | [桌面](status-expired-available-focus-1440.png) | [手机](status-expired-available-focus-390.png) |
| 已到期授权 / 未选 | pressed | [桌面](status-expired-available-pressed-1440.png) | [手机](status-expired-available-pressed-390.png) |
| 已到期授权 / 未选 | disabled | [桌面](status-expired-available-disabled-1440.png) | [手机](status-expired-available-disabled-390.png) |
| 已到期授权 / 未选 | busy | [桌面](status-expired-available-busy-1440.png) | [手机](status-expired-available-busy-390.png) |
| 已到期授权 / 已选 | default | [桌面](status-expired-selected-default-1440.png) | [手机](status-expired-selected-default-390.png) |
| 已到期授权 / 已选 | hover | [桌面](status-expired-selected-hover-1440.png) | [手机](status-expired-selected-hover-390.png) |
| 已到期授权 / 已选 | focus | [桌面](status-expired-selected-focus-1440.png) | [手机](status-expired-selected-focus-390.png) |
| 已到期授权 / 已选 | pressed | [桌面](status-expired-selected-pressed-1440.png) | [手机](status-expired-selected-pressed-390.png) |
| 已到期授权 / 已选 | disabled | [桌面](status-expired-selected-disabled-1440.png) | [手机](status-expired-selected-disabled-390.png) |
| 已到期授权 / 已选 | busy | [桌面](status-expired-selected-busy-1440.png) | [手机](status-expired-selected-busy-390.png) |
| 已撤销授权 / 未选 | default | [桌面](status-revoked-available-default-1440.png) | [手机](status-revoked-available-default-390.png) |
| 已撤销授权 / 未选 | hover | [桌面](status-revoked-available-hover-1440.png) | [手机](status-revoked-available-hover-390.png) |
| 已撤销授权 / 未选 | focus | [桌面](status-revoked-available-focus-1440.png) | [手机](status-revoked-available-focus-390.png) |
| 已撤销授权 / 未选 | pressed | [桌面](status-revoked-available-pressed-1440.png) | [手机](status-revoked-available-pressed-390.png) |
| 已撤销授权 / 未选 | disabled | [桌面](status-revoked-available-disabled-1440.png) | [手机](status-revoked-available-disabled-390.png) |
| 已撤销授权 / 未选 | busy | [桌面](status-revoked-available-busy-1440.png) | [手机](status-revoked-available-busy-390.png) |
| 已撤销授权 / 已选 | default | [桌面](status-revoked-selected-default-1440.png) | [手机](status-revoked-selected-default-390.png) |
| 已撤销授权 / 已选 | hover | [桌面](status-revoked-selected-hover-1440.png) | [手机](status-revoked-selected-hover-390.png) |
| 已撤销授权 / 已选 | focus | [桌面](status-revoked-selected-focus-1440.png) | [手机](status-revoked-selected-focus-390.png) |
| 已撤销授权 / 已选 | pressed | [桌面](status-revoked-selected-pressed-1440.png) | [手机](status-revoked-selected-pressed-390.png) |
| 已撤销授权 / 已选 | disabled | [桌面](status-revoked-selected-disabled-1440.png) | [手机](status-revoked-selected-disabled-390.png) |
| 已撤销授权 / 已选 | busy | [桌面](status-revoked-selected-busy-1440.png) | [手机](status-revoked-selected-busy-390.png) |
| 当前页唯一授权 / 已选 | default | [桌面](select-grant-default-1440.png) | [手机](select-grant-default-390.png) |
| 当前页唯一授权 / 已选 | hover | [桌面](select-grant-hover-1440.png) | [手机](select-grant-hover-390.png) |
| 当前页唯一授权 / 已选 | focus | [桌面](select-grant-focus-1440.png) | [手机](select-grant-focus-390.png) |
| 当前页唯一授权 / 已选 | pressed | [桌面](select-grant-pressed-1440.png) | [手机](select-grant-pressed-390.png) |
| 授权技术编号 / 收起 | default | [桌面](grant-technical-closed-default-1440.png) | [手机](grant-technical-closed-default-390.png) |
| 授权技术编号 / 收起 | hover | [桌面](grant-technical-closed-hover-1440.png) | [手机](grant-technical-closed-hover-390.png) |
| 授权技术编号 / 收起 | focus | [桌面](grant-technical-closed-focus-1440.png) | [手机](grant-technical-closed-focus-390.png) |
| 授权技术编号 / 收起 | pressed | [桌面](grant-technical-closed-pressed-1440.png) | [手机](grant-technical-closed-pressed-390.png) |
| 授权技术编号 / 展开 | default | [桌面](grant-technical-open-default-1440.png) | [手机](grant-technical-open-default-390.png) |
| 授权技术编号 / 展开 | hover | [桌面](grant-technical-open-hover-1440.png) | [手机](grant-technical-open-hover-390.png) |
| 授权技术编号 / 展开 | focus | [桌面](grant-technical-open-focus-1440.png) | [手机](grant-technical-open-focus-390.png) |
| 授权技术编号 / 展开 | pressed | [桌面](grant-technical-open-pressed-1440.png) | [手机](grant-technical-open-pressed-390.png) |
| 延长授权 | default | [桌面](extend-default-1440.png) | [手机](extend-default-390.png) |
| 延长授权 | hover | [桌面](extend-hover-1440.png) | [手机](extend-hover-390.png) |
| 延长授权 | focus | [桌面](extend-focus-1440.png) | [手机](extend-focus-390.png) |
| 延长授权 | pressed | [桌面](extend-pressed-1440.png) | [手机](extend-pressed-390.png) |
| 延长授权 | disabled | [桌面](extend-disabled-1440.png) | [手机](extend-disabled-390.png) |
| 延长授权 | busy | [桌面](extend-busy-1440.png) | [手机](extend-busy-390.png) |
| 撤销授权入口 | default | [桌面](revoke-default-1440.png) | [手机](revoke-default-390.png) |
| 撤销授权入口 | hover | [桌面](revoke-hover-1440.png) | [手机](revoke-hover-390.png) |
| 撤销授权入口 | focus | [桌面](revoke-focus-1440.png) | [手机](revoke-focus-390.png) |
| 撤销授权入口 | pressed | [桌面](revoke-pressed-1440.png) | [手机](revoke-pressed-390.png) |
| 撤销授权入口 | disabled | [桌面](revoke-disabled-1440.png) | [手机](revoke-disabled-390.png) |
| 撤销授权入口 | busy | [桌面](revoke-busy-1440.png) | [手机](revoke-busy-390.png) |
| 唯一页 / 上一页禁用 | disabled | [桌面](page-prev-disabled-1440.png) | [手机](page-prev-disabled-390.png) |
| 唯一页 / 下一页禁用 | disabled | [桌面](page-next-disabled-1440.png) | [手机](page-next-disabled-390.png) |
| 无授权 / 创建首条 | default | [桌面](first-grant-default-1440.png) | [手机](first-grant-default-390.png) |
| 无授权 / 创建首条 | hover | [桌面](first-grant-hover-1440.png) | [手机](first-grant-hover-390.png) |
| 无授权 / 创建首条 | focus | [桌面](first-grant-focus-1440.png) | [手机](first-grant-focus-390.png) |
| 无授权 / 创建首条 | pressed | [桌面](first-grant-pressed-1440.png) | [手机](first-grant-pressed-390.png) |
| 当前状态为空 / 查看全部 | default | [桌面](all-grants-default-1440.png) | [手机](all-grants-default-390.png) |
| 当前状态为空 / 查看全部 | hover | [桌面](all-grants-hover-1440.png) | [手机](all-grants-hover-390.png) |
| 当前状态为空 / 查看全部 | focus | [桌面](all-grants-focus-1440.png) | [手机](all-grants-focus-390.png) |
| 当前状态为空 / 查看全部 | pressed | [桌面](all-grants-pressed-1440.png) | [手机](all-grants-pressed-390.png) |
| 撤销原因窗 / 确认提交 | default | [桌面](reason-confirm-default-1440.png) | [手机](reason-confirm-default-390.png) |
| 撤销原因窗 / 确认提交 | hover | [桌面](reason-confirm-hover-1440.png) | [手机](reason-confirm-hover-390.png) |
| 撤销原因窗 / 确认提交 | focus | [桌面](reason-confirm-focus-1440.png) | [手机](reason-confirm-focus-390.png) |
| 撤销原因窗 / 确认提交 | pressed | [桌面](reason-confirm-pressed-1440.png) | [手机](reason-confirm-pressed-390.png) |
| 撤销原因窗 / 确认提交 | disabled | [桌面](reason-confirm-disabled-1440.png) | [手机](reason-confirm-disabled-390.png) |
| 撤销原因窗 / 取消 | default | [桌面](reason-cancel-default-1440.png) | [手机](reason-cancel-default-390.png) |
| 撤销原因窗 / 取消 | hover | [桌面](reason-cancel-hover-1440.png) | [手机](reason-cancel-hover-390.png) |
| 撤销原因窗 / 取消 | focus | [桌面](reason-cancel-focus-1440.png) | [手机](reason-cancel-focus-390.png) |
| 撤销原因窗 / 取消 | pressed | [桌面](reason-cancel-pressed-1440.png) | [手机](reason-cancel-pressed-390.png) |
| 撤销原因窗 / 关闭 | default | [桌面](reason-close-default-1440.png) | [手机](reason-close-default-390.png) |
| 撤销原因窗 / 关闭 | hover | [桌面](reason-close-hover-1440.png) | [手机](reason-close-hover-390.png) |
| 撤销原因窗 / 关闭 | focus | [桌面](reason-close-focus-1440.png) | [手机](reason-close-focus-390.png) |
| 撤销原因窗 / 关闭 | pressed | [桌面](reason-close-pressed-1440.png) | [手机](reason-close-pressed-390.png) |
