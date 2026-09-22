# P14 热点趋势 C 方向生产 Vue 实施

## 本批范围

本批将 P14 C 方向落实到真实 `apps/web/src/components/TrendDashboard.vue`：证据就绪标题区、趋势/规则/治理三模式、共享筛选、主题列表与详情、证据时间线、来源筛选、规则目录、治理队列以及异常证据和相关性业务弹窗统一为蓝白证据台。列表仍先于折叠帮助，主题、来源新鲜度和可信度在列表行内可见。

## 保留的业务边界

- 保留趋势主题、规则和治理请求的原路由、组织/工作区隔离、成员能力判断和请求追踪字段。
- 保留关注/取消关注、标记无关/恢复相关、异常质量工单、监控规则启停/创建和治理提议/确认/驳回的原请求合同；视觉迁移不自动执行写入。
- 保留热度以实际信号数表达；没有测量规则时继续显示数据不足，不填充环比或可信度默认值。
- 关闭的全局搜索 `dialog` 不再挂载到 DOM，避免它参与趋势筛选关键词的可访问名称匹配；打开时仍由既有 `useModalDialog` 管理焦点和请求取消。

## 实施内容

- 给 `TrendDashboard` 增加 `trend-dashboard--review` 作用域，追加蓝色证据就绪 hero、扁平导航、白色筛选工作区、双栏列表/详情面、规则目录和治理状态的 C 方向样式。
- 统一桌面与 390px 移动端的 44px 触控尺寸、蓝色键盘焦点、选中主题行、详情动作区和弹窗确认层级；不改 API、OpenAPI、数据库、权限或环境配置。
- 更新 M04-01 趋势双端视觉基线，基线来自真实 Vue 路由与本地受控 API fixture，不把独立设计图当作生产证据。

## 验证与发布

- `node --test tests/unit/trend-page-preview.test.mjs`：1/1。
- `npx playwright test tests/e2e/m04-01-trends.spec.ts --project=desktop-chromium --project=mobile-390`：16/16，含 URL 深链、空态、规则、响应式与视觉基线。
- `npx playwright test tests/e2e/ui-phase2-trend-contracts.spec.ts --project=desktop-chromium --project=mobile-390`：16/16。
- `npm run typecheck:web`、`npm run format:check`、`git diff --check`：通过。
- 提交后执行 `npm run verify:release-ownership`、完整发布门、22 工作区构建、M07-03 预检和宝塔部署，并核对线上 `/trends` 与健康接口的构建版本。

## 未覆盖事项

真实会话/RBAC、真实 Provider 采集与治理写入、原始证据/数据库事务、完整读屏/200% 缩放、共享壳层全站替换及正式 M07-03 生产证据仍需现场验收；本批不把 fixture、截图或页面 200 响应当作这些业务事实的证明。
