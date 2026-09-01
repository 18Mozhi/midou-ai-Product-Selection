# M02-05 宝塔发布、验证与回滚

## 发布

1. 在宝塔 MySQL 5.7 对 `product_scout` 使用业务账号执行 `0015a_search_documents_m02_05.up.sql`，确认字符集为 `utf8mb4`。
2. 通过宝塔统一 Node 项目“ai选品”发布并重启，使 `/api/v1/me/global-search` 与带 `shell` 查询参数的 `/api/v1/me/quick-actions` 生效；同时发布 Vue Web 静态资源。不得创建额外后端项目或面板外服务。
3. 不新增环境变量；保留 `config/env.example` 现有值。在一个已选择组织/工作区的会话中验证 Ctrl/Cmd+K、对象类型/状态/负责人组合筛选、角色顺序与当前 SPA 最近使用排序、390px 搜索/创建入口、空结果、401、403、429/503 与恢复路径。
4. 对将来接入的每类真实资源，所属模块必须在业务事务成功后同步写入或更新投影；未接入时空结果是正确状态。

## 诊断与调节

- 搜索无结果：先核对活动租户上下文、对象类型、对象真实状态、任务 `assignee_id` 或机会 `owner_id`、`search_documents` 的精确组织/工作区、`required_capability`、`source_version` 与 `updated_at`。负责人筛选不适用于证据和采集任务；不要把创建人当负责人，也不要放宽范围或绕过权限。
- 搜索返回 `ER_CANT_AGGREGATE_2COLLATIONS` 或 `ER_CANT_AGGREGATE_NCOLLATIONS`：确认当前运行包在拼接任务、机会、证据和采集任务的路由、标题或错误摘要前，已用 `CONVERT(... USING utf8mb4) COLLATE utf8mb4_unicode_ci` 规范化 `ascii` UUID 与错误码；不得通过修改数据库全局排序规则或放宽查询范围绕过。
- 401/403/409：重新登录、检查 capability 或重新选择组织/工作区。429/502/503/504 显示受阻状态，并携带安全格式的 `request_id` 联系运维。
- 快捷入口缺失、顺序异常或显示 ERROR：核对请求是否包含真实 `shell`，再检查服务端 capability。服务端先按壳层角色排序，当前页面内点击过的入口会临时前置；刷新页面后最近使用顺序清空属于预期。成员的任务/找货入口必须分别进入 `/tasks?create=1` 和 `/sourcing?create=1` 并直接打开表单；接口本身不执行创建。
- 本模块没有可调搜索阈值、超时、队列或重试配置；查询长度和每页上限属于已发布 API 合同。

## 回滚

先通过宝塔网站与 Node 项目回退 Web/API 到上一提交并重启 Node API。确认没有后续模块依赖 `search_documents` 后，备份所需投影并执行 `0015a_search_documents_m02_05.down.sql`。该表仅为可重建投影；回滚不得删除原始业务资源。Worker/Crawler/Redis 无需处理。
