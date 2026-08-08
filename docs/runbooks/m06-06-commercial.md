# M06-06 宝塔运维与回滚

## 发布与使用

1. 在宝塔备份 MySQL，确认目标为 MySQL 5.7、`utf8mb4`、业务账号 `product_scout`，执行 `0024_commercial_operations_m06_06.up.sql`。
2. 在宝塔 Node API 项目设置 `COMMERCIAL_RECENT_LIMIT`。它控制套餐和人工调整单次读取上限，允许 1–500，默认 100；不配置任何价格、支付、发票或税务变量。
3. 发布 Web 与 Node API 后，在宝塔重启 Node API；配置在启动时读取，不支持动态重载。Web 静态资源按现有站点发布，不创建新服务；Node Worker/Crawler 无需因本模块新增进程。
4. 使用具有 `platform:operate` 的平台运营管理员访问 `/platform-admin/commercial`。先显式创建套餐草稿并启用，再按组织 UUID、账期分配；人工调整必须填写原因。可用 `?organization_id=<uuid>` 打开组织用量深链接。
5. 用量只统计当前账期的 `collection_tasks`、`open_api_usage`、`report_exports`。若显示不符，先按 request_id/trace_id 检查 Node API 日志，再核对账期和三张事实表；不得用 Redis 缓存值手工覆盖。

## 验证

先运行 `node --test tests/m06-06/commercial.test.mjs`，再以 MySQL 5.7 环境运行 `node scripts/verify-commercial-live.mjs`，随后运行 Playwright 桌面与 390px 检查和 `npm run verify:module -- M06-06`。生产冒烟只创建可删除的测试组织数据，结束后清理；不要使用真实客户数据做回归。

## 回滚

先在宝塔关闭 `/platform-admin/commercial` 入口并回退 Web/API 版本。若需保留套餐、组织分配、人工调整、审计和事件历史，只回退应用，不执行 down。确认已备份且允许删除 M06-06 数据后，执行 `0024_commercial_operations_m06_06.down.sql`；它会删除本模块全部商业运营表，属于不可恢复的数据删除。回滚后在宝塔重启 Node API，并验证旧版本健康检查、现有开放 API 与报表不受影响。
