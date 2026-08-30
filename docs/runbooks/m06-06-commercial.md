# M06-06 宝塔运维与回滚

## 发布与使用

1. 在宝塔备份 MySQL，确认目标为 MySQL 5.7、`utf8mb4`、业务账号 `product_scout`，执行 `0024_commercial_operations_m06_06.up.sql`。
2. 在宝塔 Node API 项目设置 `COMMERCIAL_RECENT_LIMIT`。它控制配额方案和人工调整单次读取上限，允许 1–500，默认 100；不配置任何价格、支付、发票或税务变量。
3. 发布 Web 与 Node API 后，在宝塔重启 Node API；配置在启动时读取，不支持动态重载。Web 静态资源按现有站点发布，不创建新服务；Node Worker/Crawler 无需因本模块新增进程。
4. 使用具有 `platform:operate` 的平台运营管理员访问 `/platform-admin/commercial`。导航和页面标题应显示“配额管理”，不应显示会员、续期或计费套餐入口。先显式创建配额方案草稿、编辑额度并启用，再按组织 UUID、方案和统计周期首次分配；已有分配可修改开始/结束时间后执行“确认调整”，也可暂停、恢复或结束。所有变更和人工调整都必须填写原因。确认执行前必须核对“影响范围”：方案变更应显示仍分配该方案的组织数，组织级变更应显示目标组织、配额和余量前后值；变更账期时应显示新周期用量将在写入后重新统计。可用 `?organization_id=<uuid>&query=<关键词>&status=active&page=1&adjustment_page=1` 打开并刷新同一上下文；方案每页 20 条，调整记录每页 10 条，搜索覆盖内部标识、名称和说明。
5. 用量只统计当前账期的 `collection_tasks`、`open_api_usage`、`report_exports`。若显示不符，先按 request_id/trace_id 检查 Node API 日志，再核对账期和三张事实表；不得用 Redis 缓存值手工覆盖。

## 验证

先运行 `node --test tests/m06-06/commercial.test.mjs`，再以 MySQL 5.7 环境运行 `node scripts/verify-commercial-live.mjs`，随后运行 Playwright 桌面与 390px 检查和 `npm run verify:module -- M06-06`。验收时确认平台导航、页面标题、确认文案均使用配额语义，页面明确说明当前不包含计费、价格或支付；方案列表的 `assignment_count` 应与活动或暂停的组织分配数一致，启用方案始终排在草稿前，筛选总数和页码一致。为同一组织准备超过 10 条调整时，逐页记录可以分页，但有效配额必须包含全部仍有效调整。组织不存在应返回 404 `organization_not_found`；已有分配使用旧 `expected_version` 应返回 409；非法暂停/恢复/结束状态转换也应返回 409。中断本地测试 MySQL 后读取应返回 503 `commercial_dependency_unavailable`，恢复数据库后原页面刷新成功且旧数据在失败期间保留。影响预览只使用本次读取到的用量和配额事实。若数量不符，先核对 `organization_plan_assignments.status`，若余量不符，再核对当前账期和人工调整有效期。现有 `/api/v1/platform/commercial/*` 路由以及原有 `plans`、`assignments` 字段保持不变；读取响应增加 `summary`、`pagination`、`adjustment_pagination` 和可选 `organization`。生产冒烟只创建可删除的测试组织数据，结束后清理；不要使用真实客户数据做回归。

## 回滚

先在宝塔关闭 `/platform-admin/commercial` 入口并回退 Web/API 版本。若需保留配额方案、组织分配、人工调整、审计和事件历史，只回退应用，不执行 down。确认已备份且允许删除 M06-06 数据后，执行 `0024_commercial_operations_m06_06.down.sql`；它会删除本模块全部配额运营表，属于不可恢复的数据删除。回滚后在宝塔重启 Node API，并验证旧版本健康检查、现有开放 API 与报表不受影响。
