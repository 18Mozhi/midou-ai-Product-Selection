# M07-01 全链路测试矩阵

M07-01 把 P00–P06 的现有自动化组织为可执行发布矩阵，覆盖角色与范围、来源与采集、任务与队列、数据质量、桌面与 390px、性能预算和安全失败关闭。机器真相位于 `verification/release-matrix.json`，执行器位于 `scripts/verify-release-matrix.mjs`。

## 范围与不适用边界

本模块不新增生产 API、数据库表、页面、权限或常驻进程。它不复制业务实现，也不把测试报告变成生产数据：

- A03 复用并检查 P00–P06 已有 MySQL 5.7 迁移及成对 down 回滚，真实链路使用隔离数据并清理；没有新持久化对象，因此没有 M07-01 迁移。
- A04/A05 仅编排既有 Node API、Worker、Crawler、Outbox、Redis 和真实数据库验收；不创建新的生产服务或 daemon。
- A04 在 Node 原生支持时启用 `--experimental-strip-types`；Node 20 等不支持该参数的运行时改用项目内 TypeScript 依赖提供的只读测试加载器，保证同一矩阵可执行且不新增依赖或生产进程。
- A06 只在 OpenAPI 顶层扩展声明发布矩阵不是运行时 API；不新增 HTTP 路由、DTO 或错误码。
- A07/A08/A15 重跑 48 个页面场景，并在 desktop-chromium 与 mobile-390 两个项目上执行；其中真实 API 截图用浏览器经 Vite 访问实际 Fastify，不允许路由拦截。纯 Mock 截图调用占比不得超过 84%，只能承担视觉回归，不能独立证明功能链路。成员与平台壳层复用移动遮挡 helper，末端内容与固定底栏重叠必须为 0；M07-01 没有单独业务页面。
- 全量 E2E 入口通过 `scripts/run-playwright-projects.mjs` 依次执行 desktop-chromium 与 mobile-390。每次 Playwright 子进程独立启动并在退出时关闭 Fastify 与 Vite `webServer`；前一个项目非零时立即停止，后一个项目不复用其服务、浏览器或内存状态。定向调试仍可直接调用 Playwright，但软件功能门和发布矩阵浏览器门必须使用该编排器。
- A09/A11 通过既有组织权限、审计、request_id/trace_id 和安全运营链路取证。执行器自身只接受清单内固定分组与命令，不接受任意 shell 命令。

## 门槛与后续边界

矩阵冻结总纲中的 LCP、INP、CLS、核心读写 P95，以及三分钟真实选品旅程等目标。M07-01 的浏览器用例测量代表性页面的 LCP、CLS 和交互响应代理；真实用户 INP、生产核心 API P95、队列等待和三分钟真实来源旅程分别由 M07-05 与 M07-06 在可观测生产/预发布环境签发，不能用本地代理值替代。

验证输出必须包含 `run_id` 与 `trace_id`。失败立即返回非零；测试数据由各 live 脚本按组织隔离创建并在结束时清理。浏览器矩阵固定 4 worker，避免 47 个页面场景同时争抢本地渲染资源造成时钟与动画噪声；这不是生产并发配置。配置只复用 `VERIFY_COMMAND_TIMEOUT_MS` 和 `VERIFY_REPORT_DIR`，后者在 Windows 与 Linux 上都拒绝使用任一风格的父目录分隔符逃逸工作区；没有新增环境变量。

正式模块验收 `f12a7160-90ba-437c-9e6f-fc23149b9077` 已通过；报告位于 `.artifacts/verification/module-M07-01.json`。其中浏览器矩阵为 216/216，通过后另行执行的性能探针为 2/2。

## 生产授权路由验收

软件矩阵通过后，`npm run verify:production-product` 使用六个隔离账号覆盖普通成员、选品经理、组织管理员、平台运营管理员、平台安全管理员和平台超级管理员。`scripts/production-route-catalog.mjs` 只读解析前端权威 `route-catalog.ts` 的成员、组织和平台路由及能力要求；验收脚本再使用 `/me/navigation` 返回的服务端真实角色与能力计算每个账号应访问的页面。六个账号的覆盖并集必须等于 Route Catalog 全部受保护路由，新增路由不会因未加入侧栏而静默漏测。

机会详情和任务详情必须从对应真实列表解析已持久化 UUID；没有验收记录时门禁失败，不以占位 ID 或 Mock 响应代替。每个账号必须只有一个预期角色，受限角色含禁止能力或非平台账号含平台角色时立即失败。报告保存路由模板、实际路径、标题、正文长度、能力和错误，不保存邮箱、密码、Cookie 或响应正文。
