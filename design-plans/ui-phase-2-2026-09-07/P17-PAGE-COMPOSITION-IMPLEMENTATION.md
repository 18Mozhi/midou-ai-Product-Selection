# P17 评分规则 C 方向生产 Vue 实施

## 本批范围

本批将已确认的 P17 C 方向应用到真实 `ScoreRuleConsole`：蓝色评分规则工作区、五项配置覆盖、版本目录、阈值/权重事实、创建草稿窗、只读影响预览窗及提交/批准/拒绝/启用/回滚动作窗。桌面和 390px 移动端共用真实路由 `/opportunities/scoring-rules`，不新增审核稿独立页面。

## 保留的业务边界

- 保留成员守卫、`GET /opportunity-score-rules`、创建草稿、只读预览和生命周期动作请求。
- 保留 `opportunity:decide` 与 `opportunity:approve` 能力判断、原因必填、回滚目标限制、`expected_revision` 和现有错误追踪。
- 不新增默认阈值、自动启用、绕过审批、直接编辑生效规则或自动采纳；配置覆盖不等于单个机会通过质量门。
- 本批只修改页面壳层、CSS 和现有评分页视觉基线，不改 API、OpenAPI、数据库、权限、环境变量或依赖。

## 实施内容

- `ScoreRuleConsole.vue` 增加 `score-rules--review` 作用域，避免影响其他评分/机会页面。
- `scoring.css` 增加 C 方向蓝白工作台样式：平直边界、状态色、版本行、权重条、五项质量配置卡、模态窗、焦点环和手机单列布局。
- 更新 M04-03 评分规则桌面与移动截图基线，使视觉回归基线与批准的 C 方向实现一致。

## 验证与发布

- `node --test tests/unit/scoring-page-preview.test.mjs tests/m04-03/scoring.test.mjs`：6/6。
- `npm run typecheck:web`、`npm run format:check`、`git diff --check`：通过。
- `npx playwright test tests/e2e/m04-03-scoring.spec.ts --project=desktop-chromium --project=mobile-390`：8/8（更新视觉基线后）。
- 提交前继续执行完整格式、运行文档、发布矩阵、归属校验、构建和宝塔部署，并验证线上版本号与页面 `200`。

## 未覆盖事项

本批不等同于真实 RBAC、真实审批/回滚写入、跨页预览分页、屏幕阅读器完整验收或正式 M07-03 生产证据；这些仍需在对应运行环境中单独验收。其余第二阶段页面与共享导航壳层继续按计划推进。
