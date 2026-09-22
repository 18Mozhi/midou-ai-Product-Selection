# P45 平台角色权限比较 C 方向生产实施

## 范围与依据

用户确认本轮剩余设计稿均通过后，继续完成 P45 `/platform-admin/permissions` 的真实 Vue 组合。视觉依据为 [P45 实际 Vue 审核](P45-PAGE-VUE-REVIEW.md)与用户批准的 C 方向；行为依据为[页面规格](page-specs/P45.md)、现有 `PlatformAccountCenter.vue` / `PlatformRoleComparison.vue` 和平台角色只读目录合同。

目标是将角色选择和角色事实放入蓝色上下文栏，将搜索、分组和能力差异放入白色阅读面；桌面采用双栏，760px及以下堆叠为单列。角色说明与权限数继续完整可见。P44 `/platform-admin/admins` 复用比较组件时维持原外观和布局。

## 实施内容

- 仅为 P45 父页及比较区增加作用域样式和布局包装；P44 共享实例不启用 P45 网格。
- 保留 Vue 脚本、路由、五个查询参数、GET `/api/v1/platform/roles`、比较计算、筛选、空/失败/加载状态及现有控件行为；不添加写入动作或新弹窗。
- 更新 P45 离线审核适配器，让真实生产组合通过时原样返回，不对其进行模板变换；测试验证适配器对源码漂移失败关闭。
- 新增桌面及390px手机布局 E2E：核验角色栏与结果区顺序、角色/结果记录数、断点堆叠以及手机无横向溢出。

## 验证与发布

- P45/共享账号目录定向单测18/18通过。
- `m06-01-platform-accounts.spec.ts` 桌面 Chromium 49/49、390px mobile 49/49通过；全请求由本地夹具控制，不能证明生产 RBAC 或真实角色写入。
- `npm run typecheck:web`、`npm run format:check`、`npm run verify:docs`、`npm run verify:static-analysis`、`npm run verify:release-matrix`、`npm run verify:runtime-docs`和`npm run build:web`通过；部署脚本的M07-01发布矩阵及M07-03预检通过，22/22工作区构建通过。
- `npm run verify:frontend-budget`未通过：入口 CSS 为129451字节，限制122880字节。本批未绕过或调整预算门。
- 已提交并推送 `e098b13a88244d3b0aeebf8300934a2910c9a5db`，宝塔部署返回相同 build SHA，部署器报告临时上传产物已删除。
- 生产只读核验：`live`、`ready`、`version`均HTTP 200，build SHA一致，MySQL/Redis/supervisor为available；P45深链HTTP 200。父/比较区JS与CSS共4个资源HTTP 200，实际响应包含P45作用域标记。

## 不在本批范围

无 API/OpenAPI、数据模型、数据库、环境变量、依赖、角色能力、安全策略或权限判断变更。真实服务端RBAC和MySQL角色权限语义未通过本地夹具证明；正式M07-03生产验收仍未完成。生产仅进行本批所需的健康与静态资源读取，没有执行角色写入。全73页的整体实施目标继续开放。
