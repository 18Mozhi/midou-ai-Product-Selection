# P34 审批读取反馈真实 Vue 实施

日期：2026-09-30。将已审核的 P34 读取反馈组合接入生产 Vue 页面；本次仅处理呈现与只读恢复入口，不改接口或审批业务行为。

## 实施内容

- `OrganizationApprovalReadFeedback.vue` 复用原错误分类，为首次超时/服务不可用/断网/版本冲突、登录失效、查看权限拒绝，以及保留快照时的后台读取失败提供对应反馈区。
- 首次 408/503/网络错误、409 和 401/403 使用原错误/追踪编号折叠区与现有 `load()` GET 恢复；401/403 仍由现有分类处理，不扩大读取权限。
- 后台 500/503/409/429/网络错误明确提示“审批内容未能更新”，保留上次读取的记录与筛选，只使用页头原“刷新数据”；读取详情仍展示现有 `api-client` 用户文案和 request ID。
- 已接入的首次 500/429 白色恢复卡保持原分支；后台失败的旧快照策略、自动安全重试次数、API 参数、错误分类、API 权限、请求数语义与写接口保持不变。
- 新反馈使用 P34 已核准的蓝灰/白色层级、浅蓝保留快照提示、键盘焦点边界；父层 `role=alert` 与原生 `<details>` 语义保留。

## 验证

- `npm run typecheck:web` 通过。
- `npm run build:web` 通过；Vite 生成包含 `OrganizationApprovalReadFeedback` 的独立样式/脚本块。
- `npm run verify:docs` 与 `npm run verify:plans` 通过。
- `node scripts/run-playwright-projects.mjs tests/e2e/m06-01-organization-admin.spec.ts --grep "organization approval first-read"`：桌面 Chromium 与 390px 移动端通过。
- `node scripts/run-playwright-projects.mjs tests/e2e/m06-01-organization-admin.spec.ts --grep "organization approval background read"`：桌面 Chromium 与 390px 移动端通过。
- 失败、展开详情、首次 GET 恢复、保留旧审批快照、背景刷新恢复均使用本地隔离响应；记录到的 API 写请求为零。此证据不代表真实登录、RBAC、数据库或生产依赖验收。
- P34 动作审查生成器按当前源候选重新绑定父刷新、新读取反馈详情/重试和模板/审批分页。旧路由生命周期证据仍作为不可变的历史工作树捕获保留（不是某个提交快照）；其上下文 App 源哈希有漂移，不重写旧证据或冒称整个 App 当前匹配。当前实现只由新的 SHA 绑定证据证明。

## 边界与后续

没有改 API/OpenAPI、数据库迁移、配置、依赖或 Node/Python 服务代码。该前端变更仍需后续本地构建并走固定宝塔发布流程；任何浏览器/E2E 隔离样例均不作为真实审批或生产 ready 证明。
