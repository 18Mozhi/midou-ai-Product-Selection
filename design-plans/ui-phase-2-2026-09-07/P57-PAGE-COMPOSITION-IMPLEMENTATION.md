# P57 通知运营台 · C 方向生产 Vue 实施

状态：C 方向页面构图已迁移到实际 Vue；不等同于真实会话、RBAC、投递送达或生产业务验收。

## 实施内容

- `apps/web/src/components/PlatformNotificationCenter.vue` 现在直接使用 C 方向结构：单一页面标题、消息/投递/系统事实三段任务导航位于白色工作区内，桌面与手机保持同一信息顺序。
- `apps/web/src/platform-notifications.css` 增加生产作用域的 C 方向蓝白布局、三段任务导航、移动端断点、44px 控件和键盘焦点样式。
- 保留原 `script setup`、通知读取、筛选、分页、编辑器、动作确认窗、追踪编号和所有 API/字段/权限契约；没有新增投递、邮件或数据库写入。
- `scripts/lib/platform-notification-shell-preview.mjs` 对已经迁移的生产模板幂等，旧审核宿主仍可用于回放历史 C 组合。

## 验证

- `node --test tests/unit/platform-notification-shell-preview.test.mjs tests/unit/platform-notification-responsive-preview.test.mjs tests/unit/notification-page-preview.test.mjs tests/unit/platform-notification-lifecycle.test.mjs tests/unit/platform-notification-operations.test.mjs`：34/34 通过。
- `node scripts/verify-platform-notification-app.mjs`：真实生产 Vue 4 组、56 项检查、零页面错误、零非 GET 请求。
- `node scripts/verify-platform-notification-app.mjs --shell-preview --responsive`：840/841px 断点 4 组、112 项检查通过；浏览器与本地服务均已关闭。
- 受控审核图包已刷新到 `output/playwright/p57-shell-responsive-r3`，保留当前源指纹和截图清单。

## 尚未宣称

- 未连接真实 MySQL、权限服务、收件人去重、邮件 Provider 或实际送达渠道。
- 未把本地 GET fixture、截图或 shell 审核包当成生产投递验收；正式 M07-03 生产证据门仍待现场采集。

## 2026-09-24 收口记录

- 用户授权剩余视觉项统一通过；不据此提升真实发送、收件人权限或邮件渠道验收状态。
- 五组通知单测共34/34通过；`UI2-PN57` Playwright 桌面 Chromium 11/11、手机390 10通过/1个按设计跳过（编辑请求归属专测仅跑桌面）；共享平台管理工作流桌面/手机各1/1通过。
- `node scripts/verify-platform-notification-app.mjs`：实际 Vue 390/1440px、两种动效4组共56检查通过；浏览器与服务器关闭，未写入图像。
- `node scripts/verify-platform-notification-app.mjs --shell-preview --responsive`：840/841px、两种动效4组共112检查通过；浏览器与服务器关闭，未写入图像。同步修复仅审核预览脚本的旧式标题锚点，不改生产 NavigationShell。
- 当前生产 BUILD_SHA `84885c2e05f9d613999d76805b6b7812e37801ee`；`/platform-admin/notifications` HTTP 200，父管理及 P57 JS/CSS 均 HTTP 200，SHA-256 与本地构建一致。本批没有生产运行时代码变更，不需要再次部署。
- 真实会话/RBAC、收件人去重、真实发布/取消送达与邮件 Provider、审计和正式 M07-03 仍未验收。
