# P49 · 缓存往返与迟到响应 r1

## 本批范围

核对 P49 在真实 `App → NavigationShell → KeepAlive → ProviderRuntimeSurface → Alibaba1688AcceptanceCenter` 路径中的离开、返回、在途主检查和在途工作区读取。先运行未变换的生产组件基线，再运行只存在于本地 Vite 的生命周期评审变体；**生产 SFC、路由、ApiClient、接口、权限、数据库、环境、依赖和线上数据均未改，未部署。**

Vue Router 生命周期规范用于约束本批：缓存停用不等于卸载；在途读需要明确归属，重新激活需要重新读取服务端事实，旧响应不得覆盖新页面状态。写请求不随切页取消或自动重放。

## 基线事实与评审方案

- 当前 P49 在 `KeepAlive max=12` 内，组件只有 `onMounted/onBeforeUnmount`。390px 和 1440px 的实际路由往返均显示：返回缓存页后，启用检查、组织、工作区读取次数仍分别为 1；页面直接显示缓存的 2/3 事实，没有重新激活提示。
- 评审变体为主检查和范围读取分别增加序列号与 AbortController；`onDeactivated` 使旧读失效并中止，`onActivated` 重新读取两组事实。
- 返回读取期间保留上次成功的 2/3 事实，同时显示“正在重新读取最新启用条件”；完成后切换到返回响应的 0/3 事实。
- 离开前故意挂起的 3/3 主检查响应和第二组织工作区响应均被浏览器记录为中止；返回后没有覆盖新的 0/3 事实或当前组织工作区。
- 范围重新读取期间组织、工作区和提交按钮保持禁用；完成后恢复当前账号第一活动组织和本次返回读取到的工作区。

## 实际证据

- [4 图总览](../../output/playwright/p49-acceptance-lifecycle-review/index.html)：390px、1440px各含“返回读取中”和“返回读取完成”两张真实 Vue 长图。
- [机器证据](../../output/playwright/p49-acceptance-lifecycle-review/evidence.json)：2 次未变换基线、2 次评审变体、4 张 PNG、路由往返请求计数、被中止请求和实际加载源码哈希。
- 导航使用仓库导出的真实 Vue Router，在已注册的 P49 与 P47 路由之间往返；两页都进入同一个真实 `KeepAlive`。P47 数据 GET 被本地阻断，因为其业务行为不在本批。
- 全部业务数据来自权威 E2E 夹具或同结构的明确状态夹具；没有 POST、来源启停、数据库写入、权限修改、凭证访问或外部请求。
- 两端均验证零水平溢出、零页面运行异常；随机端口、Vite 和 Chromium 已关闭。

复验：`node --test tests/unit/ui-phase2-1688-acceptance-lifecycle.test.mjs`。重建图包：`node scripts/verify-ui-phase2-1688-acceptance-lifecycle.mjs --capture`。

## 未覆盖与待审

本批不定义离开期间验收 POST 的未知结果策略，也没有取消或重放写请求。KeepAlive 容量淘汰、跨标签、真实浏览器历史按钮、真实 API/MySQL/权限/采集、SC49 全流程和生产实现仍待后续验证。

本批只申请“返回读取中提示、保留旧事实、完成后替换为新事实、旧响应不得覆盖”的交互审核；不代表 P49 前四批、P48、生产实现或部署已经通过。
