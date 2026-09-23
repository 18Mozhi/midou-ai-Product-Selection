# P09 三步引导 C 方向生产 Vue 实施

2026-09-23 按用户“剩余页面自动同意”授权，将 C 构图接入真实 `/onboarding`：蓝色说明带、白色内容面、三步分区、明确的上一步/下一步与根入口。实装证据六图和 SHA 清单：[P09 r4 桌面/手机全步骤图与 manifest](../../output/playwright/p09-page-composition-r4/manifest.json)。旧轨道插画及渐变式引导样式已从全局导航样式表移除，改由 P09 专属 CSS 控制。

## 运行合同

- 三步文案继续使用现有静态内容；步骤切换只存在本页面，不更新 URL、localStorage、sessionStorage，也不调用 API。
- query step 只接纳有限整数并限制到 1–3；缺失、非法、小数或负数回到第 1 步，过大值落到第 3 步。没有引入新的服务端进度或完成状态。
- 上一步仅第 2/3 步可见，下一步仅第 1/2 步可见；第 3 步进入链接与跳过都回到根路径，让现有 landing 解析合法目标。跨步骤标题使用 polite live region；推进至第 3 步将焦点交给完成链接。
- 未更改身份、组织/工作区选择、登录状态、路由表、API/OpenAPI、权限、数据库、配置、依赖或业务完成规则。

## 组件边界

- `OnboardingGuide.vue`：读取 query 初始步骤，维护局部状态，组合步骤面板和操作区。
- `onboarding-guide/steps.ts`：保留三步静态文案及安全的本地 query 解析。
- `onboarding-guide/OnboardingStepPanel.vue`：只通过只读 typed props 呈现当前步骤、要点和本页状态边界。
- `onboarding-page-c.css`：限定于引导根节点的桌面/移动 C 布局、控件与 reduced-motion 处理。

## 验证

- 实际 Vue 矩阵：1440/390px × reduced/no-preference 各 22 项，共 88 项；step 切换期间零 API 请求/页面异常。
- 单测与 M02-02 源合同：3/3；验证 step query 边界、无持久化与本页专属样式/组件关系。
- M02-02 E2E：桌面与 390px 各 6/6；覆盖既有登录/入驻链、三步键盘操作、根出口、query 边界、刷新不伪恢复，且三步主操作在移动首屏可见。
- `npm run typecheck:web`、`npm run build:web`、22 workspace build、`npm run format:check`、`npm run verify:docs` 与 `npm run verify:runtime-docs` 通过。
- 实图核对发现并修复标题蓝底前景色冲突和手机主操作触屏区纵向挤压。设计图为本地实际 Vue 样式验证，不代表真实身份、租户、权限、生产会话或正式 M07-03 验收。

## 发布

已提交并推送 `b7f951b541f52c69d3594774d9b3430d8fb2597d`（`main`），固定 `python scripts/deploy-baota.py` 发布成功，生产 build SHA 与该代码提交一致。宝塔发布流程受控停止并重启 Node、校验既有迁移白名单和健康；本页无迁移、环境变量、API 或数据库变化，Worker/Python 不需要因本页重启，部署脚本报告上传临时包已删除。

发布后证据：`/api/v1/health/live`=`ok`、`ready`=`ready`、`version` 返回上述 SHA；`/onboarding?step=1` HTTP 200。线上 1440px 与 390px Chromium 均完成三步键盘交互，页面脚本/样式资源（含 `OnboardingGuide` 懒加载 JS/CSS）全部 HTTP 200，零页面错误、零 API 请求、无水平溢出。此为前端部署与本页实际路由验收，不证明真实身份、租户、RBAC、M07-03 正式签收或全站交付。全 73 页阶段目标继续。
