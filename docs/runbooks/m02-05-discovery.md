# M02-05 宝塔发布、验证与回滚

## 发布

1. 在宝塔 MySQL 5.7 对 `product_scout` 使用业务账号执行 `0015a_search_documents_m02_05.up.sql`，确认字符集为 `utf8mb4`。
2. 通过宝塔 Node 项目发布并重启 Node API，使 `/api/v1/me/global-search` 与 `/api/v1/me/quick-actions` 生效；通过宝塔网站发布 Vue Web 静态资源。Node Worker、Python Crawler 与 Redis 无变更，不重启，也不得创建面板外服务。
3. 不新增环境变量；保留 `config/env.example` 现有值。在一个已选择组织/工作区的会话中验证 Ctrl/Cmd+K、390px 搜索/创建入口、空结果、401、403、429/503 与恢复路径。
4. 对将来接入的每类真实资源，所属模块必须在业务事务成功后同步写入或更新投影；未接入时空结果是正确状态。

## 诊断与调节

- 搜索无结果：先核对活动租户上下文、`search_documents` 的精确组织/工作区、`required_capability`、`source_version` 与 `updated_at`。不要放宽范围或绕过权限。
- 401/403/409：重新登录、检查 capability 或重新选择组织/工作区。429/502/503/504 显示受阻状态，并携带安全格式的 `request_id` 联系运维。
- 快捷入口缺失：检查服务端 capability；接口只返回入口，不重放或执行任何创建。
- 本模块没有可调搜索阈值、超时、队列或重试配置；查询长度和每页上限属于已发布 API 合同。

## 回滚

先通过宝塔网站与 Node 项目回退 Web/API 到上一提交并重启 Node API。确认没有后续模块依赖 `search_documents` 后，备份所需投影并执行 `0015a_search_documents_m02_05.down.sql`。该表仅为可重建投影；回滚不得删除原始业务资源。Worker/Crawler/Redis 无需处理。
