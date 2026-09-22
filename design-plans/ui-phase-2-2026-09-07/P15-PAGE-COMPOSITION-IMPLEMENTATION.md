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
