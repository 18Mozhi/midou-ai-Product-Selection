# P60 Batch 30 · 浏览器历史与读取快照归属

## 结果

- 筛选、分页、组织范围与视图变化进入浏览器历史；浏览器前进/后退恢复 URL 中当前视图的筛选和组织范围，并对恢复后的范围重新发起只读 GET。
- 每次 GET 固定捕获查询参数、组织范围和读取代次。新读取、离页或卸载会使旧响应失效；旧响应不能覆盖当前快照，也不能解除新请求的忙碌态。
- 成功快照记录实际请求查询和组织范围。用户编辑组织/筛选但尚未读取时，页面明确提示下方仍是哪个组织范围的旧结果；旧快照保留，不伪装成新范围数据。
- KeepAlive 页面重新激活时从当前 URL 恢复并重新读取。一次性密钥的既有离页清除保持不变。
- 开放平台路由使用页面自身的 H1，避免导航壳与页面各输出一个同名一级标题。

## 边界

没有改变 API 路由、方法、字段、筛选合同、读写权限、幂等、审计或一次性密钥创建/撤销行为。变化只限客户端历史状态、过期响应归属提示、生命周期读取和标题层级。E2E 请求由 Playwright 本地拦截；没有真实 MySQL、RBAC、密钥、Webhook 回调或生产写入证据。

## 验证

- `npm run typecheck:web`
- `node --test tests/unit/ui-phase2-p60-action-review.test.mjs tests/unit/open-read-feedback.test.mjs`
- `node scripts/run-playwright-projects.mjs tests/e2e/m06-05-open-platform.spec.ts`：桌面 Chromium 6/6、390px 移动视口 6/6。
- 仍须将构建部署到生产并分别核验 `live`、`ready`、`available`、版本 SHA 和用户页面。当前公开 `ready` 仍报告依赖不可用，生产验收未通过。
