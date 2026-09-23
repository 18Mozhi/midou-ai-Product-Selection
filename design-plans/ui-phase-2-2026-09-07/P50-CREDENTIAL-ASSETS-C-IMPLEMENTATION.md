# P50 凭证与档案 · 已审核 C 方向生产样式接入

日期：2026-09-23

## 实施内容

- 将用户已通过的 P50 蓝白 C 方向接入真实 `CredentialAssetCenter`：深蓝安全资料库身份区、唯一网页登录主任务、连续概要、凭证保管台账、运行档案/兼容台账，以及蓝色登录材料说明/白色操作区；四编辑面与撤销确认沿用同一视觉层级。
- 从实际 Vue 页面审核 CSS 生成页面专用生产样式 `apps/web/src/credential-assets-c.css`，保留原审稿 CSS 的组件结构/断点；作用域改为 `body:has(#app .credential-center)`，离开凭证页后不套用到其他路由，也可覆盖 Teleport 顶层编辑窗。
- 仅改变样式，不改 Vue 数据/请求编排、页面内容、API、加密、权限、文件处理、浏览器助手、数据库/迁移、环境、依赖、worker 或服务拓扑。`credential-assets.css`、`credential-login.css` 仍提供既有结构与基础样式，C 样式在其后覆盖。

## 验证

- `tests/e2e/m03-02-credential-assets.spec.ts`：desktop Chromium 24/24、390px mobile 24/24；包含默认页响应式、顶层模态、焦点、撤销、读错、刷新、两段登录写、未知结果、离页归属、KeepAlive 与恢复。
- `npm run typecheck:web`、`npm run build:web`、`npm run verify:docs`、`npm run format:check`、`npm run verify:static-analysis` 通过。全局 CSS/NavigationShell 字节预算仍失败，阈值/当前计数见交付记录；未通过无关全站重构处理。
- 完整宝塔 22 个工作区构建和固定目录部署成功。公网 live/ready/version、`/platform-admin/credentials` 深链均 HTTP 200；应用提交 `cf1dbae41ac91390d157b74dca51150b6e7a2e8d` 对应的线上构建 SHA 已核实，CredentialAssetCenter JS/CSS 及脚本/组件 JS 资源共3项 HEAD 全部 HTTP 200；部署临时包由脚本删除。
- 正式 `verify-baota-deployment.mjs --production` 以 `production_evidence_missing` 阻断：缺 `.artifacts/verification/baota-production-evidence.json`。部署健康不等于正式 M07-03 签收；本地 E2E 不证明真实权限、加密/MySQL 或浏览器助手操作。
- `verify:frontend-budget` 仍列全局入口 CSS `129451 > 122880` 和 NavigationShell JS `51825 > 51200`，未因 P50 页面重构其他路由或导航。
