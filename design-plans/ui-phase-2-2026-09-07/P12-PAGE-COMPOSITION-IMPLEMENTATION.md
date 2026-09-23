# P12 首页 C 方向实际 Vue 接入

## 结果

P12 `/home` 已接入 HOME-C-r1：蓝色工作范围头部、白色人工决策清单、本人待办/异常及渐进披露的自动选品进度。视觉按用户“剩下的全部通过”的明确授权登记为自动通过。共享 `NavigationShell`、登录/组织守卫和全站外壳未改。

保留原 API、字段和权限合同：`GET /me/home-dashboard`、独立规则读取、七字段规则内联表单、十市场/五频率/三来源选项、原语言映射与 POST body、仅恢复首条暂停规则的精确 PATCH，以及服务端推荐顺序和每条现有目标路由。没有新增 API、数据库、权限、配置或依赖。

## 本次实现

- 自动选品缺少 `automatic_selection` 时显示未知，不生成“未配置”或 0 计数；已有本人待办仍可显示。
- 规则列表读取失败与规则为空分开处理；状态读取不完整时隐藏首次创建/恢复动作，并提供现有读取集合重试。
- GET 结果以代次绑定当前组件，卸载后忽略迟到结果；登录过期/权限拒绝清除快照。其他读取失败保留上次成功快照并单独展示追踪。
- 创建/恢复操作做单飞保护，写入期间锁定输入；请求受理提示与后续 GET 成功/失败分开，不把受理表述成爬虫已执行。
- 桌面与 390px 手机统一采用蓝白信息层级，键盘焦点清晰、触控目标至少 48px；动态简介和字段小字提升至可读字号。

## 验证

- `node scripts/run-playwright-projects.mjs tests/e2e/m02-06-home-mobile.spec.ts`：desktop-chromium 4/4，mobile-390 4/4。
- `node --test tests/m02-06/home-dashboard.test.mjs`：8/8。
- `npm run typecheck:web`、`npm run format:check`、`npm run verify:docs`、`npm run verify:runtime-docs`、`npm run verify:release-matrix`、`npm run verify:static-analysis`、`npm run verify:frontend-budget` 均通过。
- `npm run build`：22/22 工作区生产构建通过。
- `node scripts/verify-baota-deployment.mjs --preflight`：M07-03 preflight passed。

本地夹具证明 Vue 展示与请求形状，不证明真实用户会话/RBAC、MySQL 内容、后端规则权限、实际采集器运行或正式 M07-03 验收。

## 部署状态

待按 `AGENTS.md` 的固定宝塔入口 `python scripts/deploy-baota.py` 执行，并核验线上 `/home` 深链、live/ready/version、页面专属静态资源及 build SHA。部署成功后在此补记线上证据；在完成该步骤前不宣称生产已更新。

不需要数据库迁移、环境变量或配置调整。前端静态资源由部署替换，无需额外手工重启；部署脚本按既定宝塔流程管理运行项目。
