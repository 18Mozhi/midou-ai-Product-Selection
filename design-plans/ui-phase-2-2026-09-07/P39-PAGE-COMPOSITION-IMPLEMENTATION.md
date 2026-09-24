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

## P39 查询框可见标签补齐（2026-09-24）

按 page-spec P39 第 9 节记录，普通账号/组织筛选此前仅以 placeholder 提示用途。现改为可见原生 `<label>`，文字沿用当前路由已有 `searchPlaceholder`，并与输入框形成原生关联；字段、筛选/URL/API 行为及桌面/移动布局断点不变。管理员目录原有“账号邮箱”字段标签不变。标签采用 16px 页面正文尺寸，没有新增 API、配置、依赖或权限行为。

验证：P39 生产组合单测 3/3；M06-01.A07/A08/A15 实际 Vue E2E 桌面与 mobile-390 各 1/1；Web 类型检查/生产构建、73 路由/153 文档门、runtime-docs、格式、静态分析（446 文件）和前端预算（202 assets）通过。线上发布后只验证 health/version、P39 深链和构建资源哈希。标签语义检查不等价于真实读屏器验收；真实平台账号/RBAC/写入和正式 M07-03 仍未由此批通过。

## P39 表格工具触控目标（2026-09-24）

按 page-spec 第 9 节，将 P39 组织目录的桌面列设置、密度选择及展开后的列选项行最小高度从共享控件默认 36px 提升至 44px。规则限定在 `.account-center--review .account-table-wrap`，不改变其他 `ResponsiveDataView` 页面、表格数据或列选择行为。手机端继续使用现有移动记录预览，不显示桌面列工具。

验证：生产组合单测 4/4；M06-01.A07/A08/A15 实际 Vue E2E 桌面与 390px 手机各 1/1。桌面浏览器逐项测量工具及展开列项均不小于 44px；手机筛选、记录预览和路由切换回归通过。Web 类型检查与生产构建通过；此项仅调整前端静态样式，无 API、数据、权限或服务运行行为变更。页面视觉方向按用户全局授权通过；读屏器、真实 RBAC 和正式 M07-03 仍不由此证明。

## 未覆盖

本批未验证真实组织/用户/管理员写入、跨组织权限、邮件投递、会话生命周期、全主题密度或正式生产数据。
