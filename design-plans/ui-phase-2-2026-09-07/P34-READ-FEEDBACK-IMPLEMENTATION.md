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

## 当前源复核 r2（2026-10-02）

- P31 后续只修改了 `OrganizationAdminCenter.vue` 中资源授权撤销的上下文/版本快照；P34 的共享父组件源 SHA 随之变化。为避免把旧页面内联提示断言套到现有 `OrganizationApprovalReadFeedback` 子组件，C 路由驱动改为核对实际组件的 `data-mode`、copy 与 boundary 类；业务组件和接口未改。
- 新证据：`output/playwright/p34-read-feedback-vue-c-r3/evidence.json`，56 场景、1,606 断言、160 张截图，桌面与 390px 手机各 168 次读取、0 写入；已比对 151 个当前加载源 SHA、逐张校验尺寸与图像 SHA，Vite 与浏览器在结束时关闭。
- 原 r1 包的 manifest SHA 与全部截图仍原样锁定；其中一项旧动态样式源没有 Git 中的可重建版本，因此 r1 只作为原始截图/场景历史，不再声称其全部 194 源可由当前代码重建。当前源证明由 r2 implementation JSON 和 r3 capture 的 151 个精确 SHA 单独承担。
- 仓库中既有但不完整的 `p34-read-feedback-vue-c-r2` 目录未触碰。

## 当前源复核 r3（2026-10-04）

- P15 在共享父组件增加了键盘焦点边界处理后，旧 r3 捕获仍绑定变更前源码，因此保留 r3 原件，不把旧图标记为当前版本。
- 使用当前生产 Vue 组件重新运行只读恢复矩阵并生成 `output/playwright/p34-read-feedback-vue-c-r4/evidence.json`：桌面与 390px 手机共 56 场景、1,606 条断言、160 张截图；每端 168 次读取、0 写入，记录 151 个当前加载源 SHA；浏览器和 Vite 均已关闭。
- `P34-READ-FEEDBACK-IMPLEMENTATION.json` 与 P34 动作审查现绑定当前源码。新捕获只证明本地隔离响应下的 UI/恢复交互，不代表真实权限、数据库或生产验收；旧 r3 截图与证据保持不变。

## 边界与后续

没有改 API/OpenAPI、数据库迁移、配置、依赖或 Node/Python 服务代码。该前端变更仍需后续本地构建并走固定宝塔发布流程；任何浏览器/E2E 隔离样例均不作为真实审批或生产 ready 证明。
