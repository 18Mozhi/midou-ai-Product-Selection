# P11 个人中心 C 方向实施记录

日期：2026-09-24
页面：`/me`（`AccountShell` → `PersonalCenter`）
设计审核：按用户“通过，剩下的全部通过”的授权自动采纳 C 方向；这里只表示界面审核授权，不代表真实账号或生产验收。

## 实施内容

- 将旧账号索引与横向账页式页面重构为蓝色账号边界、五分区可访问目录、白色主工作区；移动端目录两列、内容单列。可见正文至少17px，键盘焦点使用蓝色轮廓。
- 将资料、权限、安全/设备、通知偏好、本人资产拆分为五个 typed panels；`usePersonalCenter` 统一管理读取、版本化写入、忙碌状态、追踪归属与离页清理。
- 个人资料先加载并独立于其它分区；权限、会话、通知和资产异步独立读取。失败只影响对应分区并展示其请求/追踪编号和独立重试；保留旧快照时显式标明，未成功获取的通知偏好不生成默认值。
- 添加首屏 profile loader 单飞修正；页面卸载或离开安全分区时清空密码输入状态。预览工具不再替换生产 Vue 模板，只注入审核样式，截图/交互均由实际 Vue 组件执行。

## 保留边界

保留 `/me/profile`、`/me/authorization`、`/me/sessions`、`/me/notification-preferences`、`/me/assets` 现有方法与字段；资料 PATCH 不含邮箱、通知 PUT 仅五个布尔值加 `expected_version`、会话撤销仍按现有 id 执行。邮件通知启用继续按服务端 `mail_provider_pending` / 503 失败，不将拒绝显示为成功。本次没有增加 API、OpenAPI、数据库迁移、权限、配置、依赖或新业务能力。

## 本地验证

- `npm run typecheck:web`：通过。
- `node --test tests/unit/personal-center.test.mjs tests/unit/personal-center-page-preview.test.mjs`：通过（4项）。
- `node scripts/verify-personal-center-page-preview.mjs`：真实 Vue 1440/390 × reduced/no-preference 共48项断言、12次被拦截写入通过；覆盖资料 PATCH、会话撤销、通知 PUT、资料读取失败、单分区权限拒绝及请求/追踪归属、未知偏好不可写、分区重试恢复。
- `node scripts/run-playwright-projects.mjs tests/e2e/ui-phase2-account-contracts.spec.ts --grep "UI2-A04"`：桌面与手机均通过。
- 同命令 `--grep "UI2-A05"`：桌面与手机均通过；邮件服务 503 后版本仍为7，关闭邮件后按该版本重试成功。
- 全文件 E2E 命令同时会执行不属于 P11 的 UI2-A01–A03；该三个外观偏好用例当前未通过（测试找不到“保存主题”按钮），因此不将其记为 P11 通过，也未在本任务改动 P10。

## 生产部署证据

待本次代码提交后通过固定 `python scripts/deploy-baota.py` 部署并进行只读检查，再补充提交/build SHA、线上 live/ready/version、`/me` 深链和本页专属静态资源校验。线上资源检查不能证明真实已登录账号、生产 RBAC/审计、密码与会话持久化、邮件服务或正式 M07-03 验收。
