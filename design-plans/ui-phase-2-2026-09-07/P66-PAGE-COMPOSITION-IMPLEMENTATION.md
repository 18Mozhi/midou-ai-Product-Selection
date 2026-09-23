# P66 服务拓扑 C 方向生产 Vue 接入

## 实施范围

将已确定的 C 方向接入真实 `/platform-admin/topology`，包含蓝色页内四区目录、节点与进程身份、健康探测窗口、队列与调度事实、告警/阻断关联，以及蓝色桌面外壳和移动端白色上下文/底部快捷导航。桌面侧栏、内容区及平台二级导航统一蓝白色；390px 页面为单列阅读，不出现横向溢出。

保留 `RuntimeTopologyCenter.vue` 的生产 `<script setup>`，原有 topology GET、15 秒单飞/超时、授权/拒绝、快照及失败追踪身份、筛选、队列策略、告警目标和 KeepAlive 离页读取生命周期均未变。外壳标题只在该页面隐藏重复标题。没有新增操作按钮、API/OpenAPI、字段、迁移、依赖、环境变量或服务控制动作。

## 依据和设计取舍

依据产品总纲 M08-01、P66 服务拓扑规格、当前 topology 服务返回与 Worker 队列注册表，以及用户对 C 方向“已完成页面自动通过”的授权。生产模板由已验证的实际 Vue 页面变换结果接入；预览器识别该生产 C 模板后仅添加审核说明，不再从旧模板推导另一个页面。

四区目录只切换本地锚点，不发请求；无样本时不展示实测 0% 可用率；运行中但非 due 不描述为空闲；重启信息保留服务返回的时间/累计/增量/重置；关联对象沿用服务已提供的白底蓝色链接。代码与样式仅由拓扑页作用域启用，NavigationShell 改动仅去除本页面重复标题。

## 验证

- P66 相关定向单元测试：60/60 通过，覆盖转换/模板、状态/追踪归属、焦点、告警、队列事实及 M08-01 单机边界。
- 实际 Vue 页面检查：1440px 与 390px、reduced/no-preference 两种动效，共 304 项；4 组、181 个来源文件，无生成图片或外部页面请求。
- `tests/e2e/m08-01-single-server.spec.ts`：desktop-chromium 4/4、mobile-390 4/4；覆盖 19 种实际队列策略可达性、页面分区、手机布局、刷新单飞、空闲队列真实文案，以及空/阻断/过期/未授权/限流/不可用反馈。桌面与手机视觉基线均更新为蓝白生产壳层。
- `npm run typecheck:web` 通过。
- `npm run build:web`、`npm run format:check`、`npm run verify:docs`、`npm run verify:static-analysis`、`npm run verify:plans`、`npm run verify:release-matrix`、`npm run verify:runtime-docs` 均通过；固定部署脚本完成 22 工作区构建及 M07-03 `preflight_passed`。
- `python scripts/deploy-baota.py` 已按固定目录完成部署，构建 SHA 为 `00906bf6bafee04f4529fed352a967f6d7391f6d`，部署输出确认临时包已删除。只读线上检查：live/ready/version 与 `/platform-admin/topology` 返回 HTTP 200，ready 的 MySQL/Redis 为 available，version/live SHA 与提交一致；拓扑 JS `RuntimeTopologyCenter-CCBSSOAW.js` 和 CSS `RuntimeTopologyCenter-Hg9INRk3.css` 均 HTTP 200。
- 本地拦截 E2E、页面矩阵、线上资源可达和部署预检不证明真实用户 RBAC/SQL 审计语义，也不等于正式 M07-03 全部生产证据已签收。

## 未改变及待完成边界

批次60确认 Vue KeepAlive 在普通离页时仍保持实例：读请求会继续，迟到结果更新缓存，返回同一实例不自动重读；只有组件真正卸载才中止浏览器等待。是否改为离页中止或返页重读会改变用户可见运行行为，本次仅用户批准页面设计，没有把这项待决策略当作获批，不作改动。真实 RBAC/SQL 审计、正式 M07-03 证据和完整 73 页阶段仍待。

## 交付记录

代码提交与推送：`00906bf6bafee04f4529fed352a967f6d7391f6d`（`main`）。

宝塔部署版本与线上核验：build SHA 同上；live/ready/version、页面深链及 P66 JS/CSS 资源均已只读核验 HTTP 200，MySQL/Redis readiness 为 available。
