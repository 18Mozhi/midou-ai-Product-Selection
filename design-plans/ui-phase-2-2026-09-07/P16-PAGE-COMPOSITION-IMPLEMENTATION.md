# P16 创建选品 C 方向生产 Vue 实施

## 2026-09-30 · 失败、受阻与成功空结果文案分离

修正无候选终态区把所有非空状态都写成“明确受阻”的问题。现在按服务端 `journey.state` 分开说明 `failed`、`blocked`、`succeeded_empty`；失败/受阻保留返回错误码并使用对应原因文案，成功空结果明确说明处理已完成且无可用候选。其他未预期的无候选状态使用中性说明，不推断为失败或受阻。实际 Vue 桌面 Chromium 与 390px 回归各覆盖三态，无写请求、API/状态合同不变。尚不证明真实采集状态、RBAC 或 M07-03。

## 本批范围

P16 已批准的 C 方向真实页面位于 `/opportunities/start`，组件为 `SelectionJourney.vue`。当前生产构图包含蓝色阶段栏、白色创建/进度工作区、候选与决策分区、五项质量门、可展开时间轴、读取/恢复状态及移动端纵向布局。

## 保留的业务边界

- 保留 `POST /selection-journeys`、`GET /selection-journeys/:id` 和 `/decisions` 的原请求字段与响应归属。
- 创建只提交输入类型和值；采纳只有候选具备机会 ID、推荐状态且评分/市场/竞争/成本/风险五门全部通过时才可用。
- 观察与驳回继续发送空候选 ID；任务轮询、恢复 ID、失败/权限/过期状态和焦点交接保持原合同。
- 不新增默认输入、自动采纳、自动评分、真实凭证或浏览器持久化字段；现有 localStorage 仅保存活动旅程 ID。

## 实施与证据

页面 CSS 已按批准稿作用域实现：阶段导航、输入单选组、候选选择、质量门、时间轴、决定区和 44px 键盘焦点状态均来自真实 `SelectionJourney.vue`，不是独立原型页面。P16 相关行为合同在本次发布后的桌面/390px 双端回归中通过：

- `npx playwright test tests/e2e/ui-phase2-journey-contracts.spec.ts --project=desktop-chromium --project=mobile-390`：当前 38/38；包含终态说明三态与零决策弹窗回归。
- 线上 `https://midouai.medouai.com/opportunities/start`：HTTP 200；健康、依赖和 API/Worker 状态沿同批 P17 发布检查通过。

## 未覆盖事项

真实会话/RBAC、真实采集来源、数据库竞争、邮件或第三方凭证、完整屏幕阅读器验收及正式 M07-03 生产证据仍需现场验证；本记录不把本地 fixture 或双端合同替代这些门禁。
