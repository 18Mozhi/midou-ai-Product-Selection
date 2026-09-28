# P15 机会列表 C 方向生产 Vue 实施

## 本批范围

本批将 P15 C 方向落实到真实 `OpportunityWorkspace` / `OpportunityListPanel`：蓝色机会工作台标题、四个推荐队列、筛选工作区、自动推荐配置摘要、候选事实行、批量条和手机单列列表；详情分支继续沿用 P18 五项质量门工作面。

## 保留的业务边界

- 保留 `recommended`、`rule_candidates`、`evidence_pending`、`all` 四个显式队列及原查询参数、筛选字段、分页和 `from` 返回路径。
- 保留“推荐只在五项质量门全部通过后进入人工采纳清单”的事实边界；规则命中不冒充已采纳。
- 保留 `opportunity:decide`、成员读取、批量指派/复核/归档、手工创建和 ERP 入口的权限与请求合同；未新增跨页写入或自动决策。
- 详情页的 P18 决定合同、原因必填、真实写入和权限判断不因列表视觉重构改变。

## 实施内容

- 在 `automatic-selection.css` 追加 `opportunity-workspace--review` 作用域：蓝色标题区、白色筛选/列表面、队列状态、五项配置摘要、事实行、分页、按钮焦点和 390px 重排。
- 保留并强化移动详情“更多分析”原生 disclosure 的可见性，避免小屏隐藏真实合同入口。
- 更新 M04-02 机会列表/详情桌面与移动视觉基线，基线对应真实 Vue 而非独立 HTML 原型。

## 验证与发布

- `node --test tests/unit/opportunity-page-preview.test.mjs tests/unit/opportunity-selection-view.test.mjs tests/unit/opportunity-selection-policy.test.mjs`：9/9。
- `npx playwright test tests/e2e/m04-02-opportunities.spec.ts --project=desktop-chromium --project=mobile-390`（列表、详情、筛选场景）：6/6。
- `npm run typecheck:web`、`npm run format:check`、`git diff --check`：通过。
- 提交后执行完整发布门、归属校验、构建和宝塔部署，并核对线上 `/opportunities` 与 `/opportunities/:id` 路由及健康版本。

## 未覆盖事项

真实 RBAC/成员数据、批量写入、ERP 助手、跨页选择的生产验证、完整读屏、200% 缩放以及正式 M07-03 证据仍需现场验收；本批不把 fixture 或截图基线当作生产业务证明。

## 2026-09-28 补充：OP07 缓存趋势创建入口

- 修复同成员壳层 `KeepAlive` 下从其他授权页返回 `/opportunities` 时，`create=1` / `source_topic_id` URL 已更新但机会页创建窗未重新打开的问题。
- 首次挂载和重新激活共用 `syncCreateRouteIntent()`；重新激活只在列表路径、存在明确创建 URL 参数且已有 `opportunity:decide` capability 时更新现有表单并打开窗。不会自动提交或采纳，不改变 route/API/permission contract。
- `UI2-OP07` 实际 Vue 双端各2/2：验证无创建意图的页面往返保留草稿；新趋势意图覆盖为新 URL 字段并打开；没有决定 capability 时不打开且零写入。
- OP07 的旧读回执已有独立实施记录；写入在途、关闭重开/连点、P18 子面板读写归属与真实 RBAC/生产 M07-03 仍未关闭。

## 2026-09-28 补充：创建写入回执归属

- 提交创建时快照字段和当前路由/弹窗代次；请求仍是原有一次 `POST /opportunities`，关闭弹窗不取消已提交写入。
- 若原弹窗仍持有请求且页面范围未变，成功继续关闭并导航到服务端返回的机会详情；失败留在窗内展示既有错误提示，不自动重试。
- 若用户关闭并重开弹窗，旧成功仅在当前列表仍属同一路由范围时展示返回记录链接，不关闭新窗、不覆盖新草稿或自动导航。与刚完成记录等价的表单内容暂禁再次提交；编辑后可作为新建意图提交。离开原路由的回执不改写新页面状态。
- 新增受控真实 Vue E2E：延迟 201 后关闭/重开/编辑，桌面与390px各1/1；同时验证同内容防重复和编辑解锁。请求由本地 Playwright 路由拦截，不证明服务端提交、幂等、RBAC 或数据库结果。

## 2026-09-28 补充：批量写入回执归属

- 批量 POST 开始前捕获列表路由、弹窗代次与选中代次；成功回执仅在原弹窗仍持有时关闭，仅在原选择未变化时清空，并且只在原路由仍活动时重读。
- 关闭旧弹窗后允许继续列表选择；重新打开的新批量意图不会被旧回执关闭、清空或覆盖。原请求体、已提交写入不被取消、同范围成功后重读合同保持不变。
- 先通过延迟本地 API 回执在旧实现上复现失败，再验证真实 Vue 桌面 Chromium 与390px手机各1/1。此夹具不证明真实服务端写入、事务、RBAC 或生产验收；P15/P18其他 OP07 项继续开放。
