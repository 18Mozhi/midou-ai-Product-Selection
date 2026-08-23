# M07-01 发布矩阵运维与回滚

## 使用与宝塔边界

先运行 `npm run verify:route-artifacts` 和 `npm run verify:release-matrix` 校验路由生成物、清单和 E2E 真实性比例，再运行 Node、live 和 `node scripts/verify-release-matrix.mjs --browser all`；排障时也可把 `all` 换成 `p00` 至 `p06`。新增或修改路由时只编辑 `config/route-catalog.json`，随后执行 `npm run generate:route-artifacts`，不得手工编辑 `apps/web/src/route-catalog.generated.json` 或 `docs/feature-map.json` 的 `routes` 段。`npm run verify:e2e-realism` 可单独输出截图总数、位于 Mock 文件的截图数和比例；该比例必须低于 50%，当前为 17/37（45.95%），其中两张核心业务截图只能由一次性生产验收的真实 Fastify/MySQL/Redis 脚本贡献。移动端还必须复用遮挡 helper 检查成员与平台壳层末端内容不被固定底栏覆盖。模块正式入口仍为 `npm run verify:module -- M07-01`。完整矩阵耗时可能超过默认单命令上限，宝塔受限发布任务可临时设置 `VERIFY_COMMAND_TIMEOUT_MS=900000`；报告继续写到 `VERIFY_REPORT_DIR`。这两个变量均已在 `config/env.example` 和配置 schema 中登记，无新增配置。

`npm run test:e2e`、`npm run verify:functional` 和发布矩阵浏览器门都会先完整执行桌面项目并关闭其 API/Web 服务，再重新启动服务执行 390px 项目。日志中应出现两次独立的 Playwright 运行；第二次端口占用通常表示第一次服务未正常退出，必须先清理对应测试进程再重跑，不得启用 `reuseExistingServer` 掩盖生命周期泄漏。`node scripts/run-playwright-projects.mjs --self-test` 只校验编排合同，不启动服务。

该执行器只用于本地、CI 或宝塔面板创建的受限发布任务，不暴露 HTTP API，不启动常驻服务，不在面板外创建生产任务。运行前确认宝塔 MySQL 为 5.7、业务账号和库名为 `product_scout`，Redis 可用，且预发布数据允许隔离创建与清理。浏览器分组固定使用 4 worker，会短暂启动本地 API/Web 服务，Playwright 结束后自动关闭；不得把测试 worker 数解释为生产容量。

软件矩阵通过且生产版本已就绪后，在包含完整源码和开发依赖的本地受限发布工作区按 `config/env.example` 注入六组 `SCOUTOPS_QA_*` 临时账号，并以生产 HTTPS 根地址运行 `npm run verify:production-product`。生产服务器的固定运行包不包含源码验证脚本，不得临时上传脚本或在服务器安装开发依赖。账号必须分别只有 `member`、`selection_manager`、`organization_admin`、`platform_operations_admin`、`platform_security_admin`、`platform_super_admin` 一个角色；成员侧三个账号使用同一隔离验收组织和工作区。验收组织必须至少保留一条可打开的机会和任务记录，否则动态详情路由无法实测并会失败。密码只放本地受限环境，报告和截图不得包含登录表单值或 Cookie。

报告中的 `route_catalog_count` 必须与 `covered_route_templates` 数量一致，六个角色都必须有独立 `route_count`、`allow_count`、`deny_count` 和长度等于 `route_catalog_count` 的 `route_matrix`，且 `api_failures`、`console_errors` 为空。`must have exactly` 表示账号角色叠加；`contains a forbidden capability` 表示生产权限目录漂移；`has no persisted acceptance record` 表示补齐隔离验收数据后重跑；`authorized route catalog is not fully covered` 表示新增受保护路由没有任何验收角色可达。路由目录和验收变量都不是常驻运行配置，修改后不需要重启 API、Worker 或 Crawler；重新生成路由产物并运行有限验收即可。

完整的一次性生产验收在宝塔计划任务中按 `infra/baota/production-acceptance-manifest.json` 创建 `product-scout-production-acceptance`，手工执行 `node scripts/run-baota-production-acceptance.mjs --production`。只在该任务的受限环境配置 `SCOUTOPS_ACCEPTANCE_PASSWORD`；其余地址和报告路径可沿用 `config/env.example`。先在本地或发布预检执行 `npm run verify:production-acceptance`，应只输出 221/254/59/6 基线且不连接数据库、不创建账号。

生产任务成功报告必须同时满足：`operation_count=254`、`route_catalog_count=59`、`matrix_cells=354`、六个已验证单角色账号、一个组织、一个工作区、两条 `core_e2e` 链路、两张真实栈截图，以及 `cleanup.status=passed`、`cleanup.remaining_rows=0`。`core_e2e.dependencies` 中 MySQL 与 Redis 都必须为 `available`；`cleanup.tables` 是逐表删除清单。任务失败但清理成功时仍返回非零，禁止把清理成功冒充验收成功。进程被主机强制终止时 `finally` 无法保证执行，应先按报告中的 run/trace 标记核对残留，不得使用宽泛邮箱或组织条件删除生产数据。

## 故障定位

执行器按失败组返回非零并输出 `module_id`、`run_id`、`trace_id`。Node 失败先定位具体测试文件；live 失败按对应脚本核对 MySQL/Redis、迁移和清理日志；browser 失败查看 `.artifacts/playwright`，确认是业务回归还是经人工检查后的合法视觉基线变化。不得以更新截图掩盖布局或状态错误。

## 回滚

M07-01 没有生产数据库、API、页面或进程可回滚。代码回滚时删除模块注册、机器矩阵、执行器、定向测试和两份文档，并撤销 OpenAPI、Feature Map、总纲、计划与 package script 的对应登记。已有 P00–P06 迁移、业务代码和视觉基线不得删除。若矩阵执行中断，先确认 Playwright 的 4101/5173 临时进程已退出，再清理本次临时失败产物；验证报告可作为发布证据保留。
