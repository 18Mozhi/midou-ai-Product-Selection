# P31 字段与表单组合待审

ROLE-FIELDS-C-r1，16字段（14本地模型、1受控类型、1共享原因）。92单端代表状态、9组合，双端202PNG。

[图册](gallery.html) · [交互稿](index.html) · [页面规格](../../page-specs/P31.md) · [批准范围](../../P31-CONTROL-VISUAL-APPROVAL.md)

沿用四项已批准控件视觉；使用fixing-accessibility新增就近说明/aria-describedby、无效状态及live错误和原因字数。全部只在新子稿中，旧48+378图/源Vue保持不变。UUID继续复制真实详情，格式正确不等于可访问。四类型/四范围与已返回能力组保留；工作区只有一个选项，不伪造切换。

创建/延期原因必填至500；共享撤销前端至少2字且无maxlength，501字图只证明前端输入，不证明服务端接受。延期必须晚于原到期时间，按已存在后端规则补提案就地错误；真实Vue未修。busy字段保持可编辑，不更改未审草稿归属规则。九组合覆盖创建可用/多错误/无动作/等待、延期可用/未延长/等待、撤销不足/501字取消。

原型输入演示不发API、不写审计或授权；没有真实后端、权限/MySQL、完整Vue生命周期验收。全部字段排列/原生日期弹层/软键盘/主题密度等组合、更多多页样本、具体字段批准和全站C实施/宝塔仍待。无新配置/依赖/重启/部署，PNG是永久审核交付物，不是临时文件。

验证：node scripts/verify-ui-phase2-roles-fields-c.mjs --smoke；--capture生成，默认只读复验来源与PNG并执行全部状态/组合。

| 场景 | 1440 | 390 |
| --- | --- | --- |
| role-query-default | [桌面](role-query-default-1440.png) | [手机](role-query-default-390.png) |
| role-query-hover | [桌面](role-query-hover-1440.png) | [手机](role-query-hover-390.png) |
| role-query-focus | [桌面](role-query-focus-1440.png) | [手机](role-query-focus-390.png) |
| role-query-filled | [桌面](role-query-filled-1440.png) | [手机](role-query-filled-390.png) |
| role-query-empty-results | [桌面](role-query-empty-results-1440.png) | [手机](role-query-empty-results-390.png) |
| capability-query-default | [桌面](capability-query-default-1440.png) | [手机](capability-query-default-390.png) |
| capability-query-hover | [桌面](capability-query-hover-1440.png) | [手机](capability-query-hover-390.png) |
| capability-query-focus | [桌面](capability-query-focus-1440.png) | [手机](capability-query-focus-390.png) |
| capability-query-filled | [桌面](capability-query-filled-1440.png) | [手机](capability-query-filled-390.png) |
| capability-query-empty-results | [桌面](capability-query-empty-results-1440.png) | [手机](capability-query-empty-results-390.png) |
| capability-group-default | [桌面](capability-group-default-1440.png) | [手机](capability-group-default-390.png) |
| capability-group-hover | [桌面](capability-group-hover-1440.png) | [手机](capability-group-hover-390.png) |
| capability-group-focus | [桌面](capability-group-focus-1440.png) | [手机](capability-group-focus-390.png) |
| capability-group-governance | [桌面](capability-group-governance-1440.png) | [手机](capability-group-governance-390.png) |
| capability-group-audit | [桌面](capability-group-audit-1440.png) | [手机](capability-group-audit-390.png) |
| member-query-default | [桌面](member-query-default-1440.png) | [手机](member-query-default-390.png) |
| member-query-hover | [桌面](member-query-hover-1440.png) | [手机](member-query-hover-390.png) |
| member-query-focus | [桌面](member-query-focus-1440.png) | [手机](member-query-focus-390.png) |
| member-query-filled | [桌面](member-query-filled-1440.png) | [手机](member-query-filled-390.png) |
| member-query-empty-results | [桌面](member-query-empty-results-1440.png) | [手机](member-query-empty-results-390.png) |
| scope-filter-default | [桌面](scope-filter-default-1440.png) | [手机](scope-filter-default-390.png) |
| scope-filter-hover | [桌面](scope-filter-hover-1440.png) | [手机](scope-filter-hover-390.png) |
| scope-filter-focus | [桌面](scope-filter-focus-1440.png) | [手机](scope-filter-focus-390.png) |
| scope-filter-own | [桌面](scope-filter-own-1440.png) | [手机](scope-filter-own-390.png) |
| scope-filter-team | [桌面](scope-filter-team-1440.png) | [手机](scope-filter-team-390.png) |
| scope-filter-workspace | [桌面](scope-filter-workspace-1440.png) | [手机](scope-filter-workspace-390.png) |
| scope-filter-organization | [桌面](scope-filter-organization-1440.png) | [手机](scope-filter-organization-390.png) |
| grant-query-default | [桌面](grant-query-default-1440.png) | [手机](grant-query-default-390.png) |
| grant-query-hover | [桌面](grant-query-hover-1440.png) | [手机](grant-query-hover-390.png) |
| grant-query-focus | [桌面](grant-query-focus-1440.png) | [手机](grant-query-focus-390.png) |
| grant-query-filled | [桌面](grant-query-filled-1440.png) | [手机](grant-query-filled-390.png) |
| grant-query-empty-results | [桌面](grant-query-empty-results-1440.png) | [手机](grant-query-empty-results-390.png) |
| workspace-default | [桌面](workspace-default-1440.png) | [手机](workspace-default-390.png) |
| workspace-hover | [桌面](workspace-hover-1440.png) | [手机](workspace-hover-390.png) |
| workspace-focus | [桌面](workspace-focus-1440.png) | [手机](workspace-focus-390.png) |
| resource-type-default | [桌面](resource-type-default-1440.png) | [手机](resource-type-default-390.png) |
| resource-type-hover | [桌面](resource-type-hover-1440.png) | [手机](resource-type-hover-390.png) |
| resource-type-focus | [桌面](resource-type-focus-1440.png) | [手机](resource-type-focus-390.png) |
| resource-type-task | [桌面](resource-type-task-1440.png) | [手机](resource-type-task-390.png) |
| resource-type-opportunity | [桌面](resource-type-opportunity-1440.png) | [手机](resource-type-opportunity-390.png) |
| resource-type-competitor | [桌面](resource-type-competitor-1440.png) | [手机](resource-type-competitor-390.png) |
| resource-type-sourcing | [桌面](resource-type-sourcing-1440.png) | [手机](resource-type-sourcing-390.png) |
| resource-id-default | [桌面](resource-id-default-1440.png) | [手机](resource-id-default-390.png) |
| resource-id-hover | [桌面](resource-id-hover-1440.png) | [手机](resource-id-hover-390.png) |
| resource-id-focus | [桌面](resource-id-focus-1440.png) | [手机](resource-id-focus-390.png) |
| resource-id-empty | [桌面](resource-id-empty-1440.png) | [手机](resource-id-empty-390.png) |
| resource-id-invalid | [桌面](resource-id-invalid-1440.png) | [手机](resource-id-invalid-390.png) |
| resource-id-filled | [桌面](resource-id-filled-1440.png) | [手机](resource-id-filled-390.png) |
| resource-id-pending | [桌面](resource-id-pending-1440.png) | [手机](resource-id-pending-390.png) |
| member-target-default | [桌面](member-target-default-1440.png) | [手机](member-target-default-390.png) |
| member-target-hover | [桌面](member-target-hover-1440.png) | [手机](member-target-hover-390.png) |
| member-target-focus | [桌面](member-target-focus-1440.png) | [手机](member-target-focus-390.png) |
| member-target-empty | [桌面](member-target-empty-1440.png) | [手机](member-target-empty-390.png) |
| member-target-selected | [桌面](member-target-selected-1440.png) | [手机](member-target-selected-390.png) |
| grant-actions-default | [桌面](grant-actions-default-1440.png) | [手机](grant-actions-default-390.png) |
| grant-actions-hover | [桌面](grant-actions-hover-1440.png) | [手机](grant-actions-hover-390.png) |
| grant-actions-focus | [桌面](grant-actions-focus-1440.png) | [手机](grant-actions-focus-390.png) |
| grant-actions-none | [桌面](grant-actions-none-1440.png) | [手机](grant-actions-none-390.png) |
| grant-actions-all | [桌面](grant-actions-all-1440.png) | [手机](grant-actions-all-390.png) |
| create-reason-default | [桌面](create-reason-default-1440.png) | [手机](create-reason-default-390.png) |
| create-reason-hover | [桌面](create-reason-hover-1440.png) | [手机](create-reason-hover-390.png) |
| create-reason-focus | [桌面](create-reason-focus-1440.png) | [手机](create-reason-focus-390.png) |
| create-reason-empty | [桌面](create-reason-empty-1440.png) | [手机](create-reason-empty-390.png) |
| create-reason-spaces | [桌面](create-reason-spaces-1440.png) | [手机](create-reason-spaces-390.png) |
| create-reason-limit | [桌面](create-reason-limit-1440.png) | [手机](create-reason-limit-390.png) |
| create-reason-pending | [桌面](create-reason-pending-1440.png) | [手机](create-reason-pending-390.png) |
| expires-at-default | [桌面](expires-at-default-1440.png) | [手机](expires-at-default-390.png) |
| expires-at-hover | [桌面](expires-at-hover-1440.png) | [手机](expires-at-hover-390.png) |
| expires-at-focus | [桌面](expires-at-focus-1440.png) | [手机](expires-at-focus-390.png) |
| expires-at-past | [桌面](expires-at-past-1440.png) | [手机](expires-at-past-390.png) |
| expires-at-over-limit | [桌面](expires-at-over-limit-1440.png) | [手机](expires-at-over-limit-390.png) |
| expires-at-pending | [桌面](expires-at-pending-1440.png) | [手机](expires-at-pending-390.png) |
| extend-reason-default | [桌面](extend-reason-default-1440.png) | [手机](extend-reason-default-390.png) |
| extend-reason-hover | [桌面](extend-reason-hover-1440.png) | [手机](extend-reason-hover-390.png) |
| extend-reason-focus | [桌面](extend-reason-focus-1440.png) | [手机](extend-reason-focus-390.png) |
| extend-reason-empty | [桌面](extend-reason-empty-1440.png) | [手机](extend-reason-empty-390.png) |
| extend-reason-spaces | [桌面](extend-reason-spaces-1440.png) | [手机](extend-reason-spaces-390.png) |
| extend-reason-limit | [桌面](extend-reason-limit-1440.png) | [手机](extend-reason-limit-390.png) |
| extend-reason-pending | [桌面](extend-reason-pending-1440.png) | [手机](extend-reason-pending-390.png) |
| extend-expiry-default | [桌面](extend-expiry-default-1440.png) | [手机](extend-expiry-default-390.png) |
| extend-expiry-hover | [桌面](extend-expiry-hover-1440.png) | [手机](extend-expiry-hover-390.png) |
| extend-expiry-focus | [桌面](extend-expiry-focus-1440.png) | [手机](extend-expiry-focus-390.png) |
| extend-expiry-past | [桌面](extend-expiry-past-1440.png) | [手机](extend-expiry-past-390.png) |
| extend-expiry-over-limit | [桌面](extend-expiry-over-limit-1440.png) | [手机](extend-expiry-over-limit-390.png) |
| extend-expiry-not-extended | [桌面](extend-expiry-not-extended-1440.png) | [手机](extend-expiry-not-extended-390.png) |
| extend-expiry-pending | [桌面](extend-expiry-pending-1440.png) | [手机](extend-expiry-pending-390.png) |
| revoke-reason-default | [桌面](revoke-reason-default-1440.png) | [手机](revoke-reason-default-390.png) |
| revoke-reason-hover | [桌面](revoke-reason-hover-1440.png) | [手机](revoke-reason-hover-390.png) |
| revoke-reason-focus | [桌面](revoke-reason-focus-1440.png) | [手机](revoke-reason-focus-390.png) |
| revoke-reason-short | [桌面](revoke-reason-short-1440.png) | [手机](revoke-reason-short-390.png) |
| revoke-reason-spaces | [桌面](revoke-reason-spaces-1440.png) | [手机](revoke-reason-spaces-390.png) |
| revoke-reason-long | [桌面](revoke-reason-long-1440.png) | [手机](revoke-reason-long-390.png) |
| create-ready-form | [桌面](create-ready-form-1440.png) | [手机](create-ready-form-390.png) |
| create-errors-form | [桌面](create-errors-form-1440.png) | [手机](create-errors-form-390.png) |
| create-no-actions-form | [桌面](create-no-actions-form-1440.png) | [手机](create-no-actions-form-390.png) |
| create-pending-form | [桌面](create-pending-form-1440.png) | [手机](create-pending-form-390.png) |
| extend-ready-form | [桌面](extend-ready-form-1440.png) | [手机](extend-ready-form-390.png) |
| extend-not-later-form | [桌面](extend-not-later-form-1440.png) | [手机](extend-not-later-form-390.png) |
| extend-pending-form | [桌面](extend-pending-form-1440.png) | [手机](extend-pending-form-390.png) |
| revoke-short-form | [桌面](revoke-short-form-1440.png) | [手机](revoke-short-form-390.png) |
| revoke-long-form | [桌面](revoke-long-form-1440.png) | [手机](revoke-long-form-390.png) |
