# P39 平台账号与组织概览 C 方向生产实施

## 已实施

- `PlatformAccountCenter.vue` 增加独立的 `account-center--review` 生产作用域，保留组织、用户、管理员、角色权限四条真实路由，以及创建、刷新、筛选、详情、密码、状态和角色比较合同。
- `PlatformAccountCenter.css` 将真实账号工作台收口为蓝色范围标题与操作栏、白色事实指标、二级目录、筛选查询和记录工作区；桌面双栏标题、940px 以下动作下移、700px 以下单列。
- 保留真实 `/platform-admin/*` 读取、12 秒超时、查询 URL 同步、错误/空态、组织与用户详情和原有写入边界；未新增 API、字段、权限或数据库动作。

## 验证

- `node --test tests/unit/ui-phase2-platform-account-production-composition.test.mjs`：3/3 通过。
- `npx playwright test tests/e2e/m02-03-navigation-shell.spec.ts --grep "platform shell exposes management navigation|explicit routes keep internal navigation reactive" --project=desktop-chromium --project=mobile-390 --workers=1`：4 passed，验证平台管理导航、真实路由切换和双端壳层仍可进入账号工作台。
- `npm run typecheck:web`、`npm run format:check`、`git diff --check`：通过。

历史 P39 概念图、真实 RBAC、MySQL 账号写入、正式 M07-03 证据和未覆盖的 P40–P45 目的页不以本批视觉接入替代。

## 未覆盖

本批未验证真实组织/用户/管理员写入、跨组织权限、邮件投递、会话生命周期、全主题密度或正式生产数据。
