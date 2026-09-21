# P27 实际 Vue C 组合 · 批98

## 审核范围

本批使用实际 `/automations` 与 `AutomationRuleCenter`，只在本地审核层套用企业蓝白视觉：规则身份、事件→条件→动作、限流与最近执行、执行详情，以及创建规则的模板和只读试运行预览。

## 保留的合同

- 保留自动化规则、成员目录与详情的既有读取路径。
- 试运行仍发送既有 `POST /automations/preview`，展示结果明确为只读，不创建通知或任务。
- 暂停继续使用既有 `POST /automations/{id}/actions`，精确保留 `action`、`expected_version` 与原人工原因。
- 未改生产 `AutomationRuleCenter`、Worker、API、权限、数据或部署状态。

## 本地核验

`node --test tests/unit/automation-page-preview.test.mjs` 通过。

`node scripts/verify-automation-page-preview.mjs --capture-review r1` 在 1440/390 与 reduced/no-preference 两种动效偏好下通过 40 项检查。每组使用本地拦截响应验证一项只读试运行和一项暂停合同，生成默认、详情、预览双端 6 张永久审核图及来源哈希。

## 未覆盖

未验证真实会话、RBAC、真实成员目录、创建/编辑保存、恢复、异常/空态、全部弹窗键盘边界、Worker 限流/死信、数据库写入、读屏或生产环境；本批不构成生产验收。
