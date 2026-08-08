# M07-01 发布矩阵运维与回滚

## 使用与宝塔边界

先运行 `npm run verify:release-matrix` 校验清单，再运行 Node、live 和 `node scripts/verify-release-matrix.mjs --browser all`；排障时也可把 `all` 换成 `p00` 至 `p06`。模块正式入口仍为 `npm run verify:module -- M07-01`。完整矩阵耗时可能超过默认单命令上限，宝塔受限发布任务可临时设置 `VERIFY_COMMAND_TIMEOUT_MS=900000`；报告继续写到 `VERIFY_REPORT_DIR`。这两个变量均已在 `config/env.example` 和配置 schema 中登记，无新增配置。

该执行器只用于本地、CI 或宝塔面板创建的受限发布任务，不暴露 HTTP API，不启动常驻服务，不在面板外创建生产任务。运行前确认宝塔 MySQL 为 5.7、业务账号和库名为 `product_scout`，Redis 可用，且预发布数据允许隔离创建与清理。浏览器分组固定使用 4 worker，会短暂启动本地 API/Web 服务，Playwright 结束后自动关闭；不得把测试 worker 数解释为生产容量。

## 故障定位

执行器按失败组返回非零并输出 `module_id`、`run_id`、`trace_id`。Node 失败先定位具体测试文件；live 失败按对应脚本核对 MySQL/Redis、迁移和清理日志；browser 失败查看 `.artifacts/playwright`，确认是业务回归还是经人工检查后的合法视觉基线变化。不得以更新截图掩盖布局或状态错误。

## 回滚

M07-01 没有生产数据库、API、页面或进程可回滚。代码回滚时删除模块注册、机器矩阵、执行器、定向测试和两份文档，并撤销 OpenAPI、Feature Map、总纲、计划与 package script 的对应登记。已有 P00–P06 迁移、业务代码和视觉基线不得删除。若矩阵执行中断，先确认 Playwright 的 4101/5173 临时进程已退出，再清理本次临时失败产物；验证报告可作为发布证据保留。
