# P13 今日工作 C 方向生产 Vue 实施

## 本批范围

本批将 `/work` 的真实 `TaskWorkspace(mode="today")` 收口为个人行动台：蓝色标题与当前重点、本人状态筛选、按需搜索/排序、任务事实行、分页和批量操作条，并在 390px 下转为单列可操作布局。P23 `/tasks` 全任务目录与 P24 `/tasks/:id` 详情继续沿用各自作用域，不混用个人统计。

## 保留的业务边界

- 保留 `/work` 的本人任务查询、状态/关键词/排序/分页 URL、当前工作区成员读取和原有读取取消/缓存归属。
- 保留 `task:create`、`task:update`、`task:assign` 的前端入口判断，以及逐项和批量动作的原因、版本、截止时间、负责人和幂等请求合同。
- 不把状态数量、当前页条目或自动化事实改成跨工作区统计；不自动完成任务、不改变任务状态机和数据库结构。
- 详情路由、导出视图、P23 全量目录和 P24 卷宗详情不由本批 CSS 选择器覆盖。

## 实施内容

- 在 `TaskWorkspace.vue` 为 `mode="today"` 增加 `task-workspace--today` 作用域，避免个人行动台与全任务目录共用无法区分的视觉状态。
- 在 `task-workspace-enhancements.css` 追加 C 方向蓝白布局：标题行动区、重点计数、筛选/搜索、白色任务列表、进度/期限事实、批量条、分页、焦点和移动端重排；颜色使用主题变量，保留三主题切换能力。
- 没有新增依赖、API、OpenAPI、数据库、权限或运行配置。

## 验证与发布

- `node --test tests/unit/task-page-preview.test.mjs tests/unit/task-detail-page-preview.test.mjs tests/unit/all-task-page-preview.test.mjs`：3/3。
- `npx playwright test tests/e2e/ui-phase2-task-contracts.spec.ts --project=desktop-chromium --project=mobile-390`：36/36。
- `npx playwright test tests/e2e/ui-phase2-task-cache.spec.ts --project=desktop-chromium --project=mobile-390`：16/16。
- `npm run typecheck:web`、`npm run format:check`、`git diff --check`：通过。
- M05 全页详情视觉基线和跨页主题场景仍有既有差异，本批未更新其快照；提交后仍执行发布归属、完整构建、M07-03 预检和宝塔部署。

## 未覆盖事项

真实会话/RBAC、数据库任务事实、批量写入与并发锁、成员目录生产数据、全页读屏/200%缩放、共享壳层全站替换及正式 M07-03 生产证据仍需现场验收。测试 fixture 和当前页面 200 响应不等于这些业务事实已完成。

## 2026-09-24 · 批量执行归属与单飞闭环

复核实际 `confirmBatch` 后补齐批量操作提交边界：开始请求前一次性固定符合资格任务的 ID/版本、动作、原因、截止时间、负责人及跳过数；在任何异步请求挂起时，第二次提交会由函数级 guard 直接拒绝，批量操作入口、输入、返回和 Escape 关闭均锁定，并展示处理中状态。保留既有逐项 POST、每项 `expected_version`、幂等键、部分失败统计、跳过统计、审计语义及结束后的刷新，不推断服务器端去重。

新增实际 Vue E2E：首个请求被挂起时尝试合成重复 submit、Escape 及编辑字段，确认只有原定逐项请求发出、弹窗仍保持、剩余请求继续使用首次确认快照；桌面和390px各1/1通过。任务合同、KeepAlive 归属及 M05 页面回归合计桌面/手机各44/44通过；任务页预览/合同单测3/3、Web类型检查和生产构建通过。隔离夹具不证明真实 RBAC、MySQL 写入或服务端幂等，正式 M07-03 仍待。
