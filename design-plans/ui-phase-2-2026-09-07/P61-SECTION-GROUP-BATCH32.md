# P61 Batch 32 · 状态分区按钮组语义

## 结果

- 系统状态四个本地分区仍由原生按钮切换，并以 `aria-pressed` 暴露当前项；外层改为带名称的 `role="group"`，不再把面板切换按钮误标为站点导航。
- 分区按钮点击仅改本地活动视图，不触发状态 GET；原页面读取、手动刷新、失败保留与恢复行为保持不变。
- 真实 Vue E2E 检查默认选中项、四个按钮、分区切换零额外读取，以及一次刷新失败后保留数据和手动恢复。安全 GET 的既有重试策略仍保持。

## 边界

没有改变刷新按钮、15 秒超时、GET 参数、自动安全重试、权限、数据来源或任何 API/数据库合同。E2E 响应为本地隔离夹具，不构成真实 MySQL、RBAC、生产依赖或正式 M07-03 证据。

## 验证

- `node --test tests/unit/platform-status-page-preview.test.mjs tests/unit/platform-status-read-feedback.test.mjs`
- `node scripts/run-playwright-projects.mjs tests/e2e/m06-02-platform-dashboard.spec.ts --grep "system status aggregates real operations observations and management links"`：桌面 Chromium 与 390px 移动视口各 1/1。
- Web 类型检查、生产构建、格式与文档门待提交前复验。
