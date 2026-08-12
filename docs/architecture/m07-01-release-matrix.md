# M07-01 全链路测试矩阵

M07-01 把 P00–P06 的现有自动化组织为可执行发布矩阵，覆盖角色与范围、来源与采集、任务与队列、数据质量、桌面与 390px、性能预算和安全失败关闭。机器真相位于 `verification/release-matrix.json`，执行器位于 `scripts/verify-release-matrix.mjs`。

## 范围与不适用边界

本模块不新增生产 API、数据库表、页面、权限或常驻进程。它不复制业务实现，也不把测试报告变成生产数据：

- A03 复用并检查 P00–P06 已有 MySQL 5.7 迁移及成对 down 回滚，真实链路使用隔离数据并清理；没有新持久化对象，因此没有 M07-01 迁移。
- A04/A05 仅编排既有 Node API、Worker、Crawler、Outbox、Redis 和真实数据库验收；不创建新的生产服务或 daemon。
- A04 在 Node 原生支持时启用 `--experimental-strip-types`；Node 20 等不支持该参数的运行时改用项目内 TypeScript 依赖提供的只读测试加载器，保证同一矩阵可执行且不新增依赖或生产进程。
- A06 只在 OpenAPI 顶层扩展声明发布矩阵不是运行时 API；不新增 HTTP 路由、DTO 或错误码。
- A07/A08/A15 重跑 46 个既有页面场景，并在 desktop-chromium 与 mobile-390 两个项目上执行；M07-01 没有单独业务页面。
- A09/A11 通过既有组织权限、审计、request_id/trace_id 和安全运营链路取证。执行器自身只接受清单内固定分组与命令，不接受任意 shell 命令。

## 门槛与后续边界

矩阵冻结总纲中的 LCP、INP、CLS、核心读写 P95，以及三分钟真实选品旅程等目标。M07-01 的浏览器用例测量代表性页面的 LCP、CLS 和交互响应代理；真实用户 INP、生产核心 API P95、队列等待和三分钟真实来源旅程分别由 M07-05 与 M07-06 在可观测生产/预发布环境签发，不能用本地代理值替代。

验证输出必须包含 `run_id` 与 `trace_id`。失败立即返回非零；测试数据由各 live 脚本按组织隔离创建并在结束时清理。浏览器矩阵固定 4 worker，避免 46 个页面场景同时争抢本地渲染资源造成时钟与动画噪声；这不是生产并发配置。配置只复用 `VERIFY_COMMAND_TIMEOUT_MS` 和 `VERIFY_REPORT_DIR`，后者在 Windows 与 Linux 上都拒绝使用任一风格的父目录分隔符逃逸工作区；没有新增环境变量。

正式模块验收 `f12a7160-90ba-437c-9e6f-fc23149b9077` 已通过；报告位于 `.artifacts/verification/module-M07-01.json`。其中浏览器矩阵为 216/216，通过后另行执行的性能探针为 2/2。
