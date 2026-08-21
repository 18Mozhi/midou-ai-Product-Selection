# M03-01 来源注册中心

## 范围与事实边界

M03-01 只交付平台全局的 Provider 技术合同注册中心。`providers` 不包含 `organization_id` 或 `workspace_id`；组织启用、额度和凭证引用属于后续 `provider_connections`。本模块不发起采集、不创建 Worker/Crawler 队列、不保管 Cookie 或密钥，也不把“已登记”解释为“生产已启用”。

每个定义包含 code、名称、目标 URL/标识、接入模式、市场、语言、字段、频率、并发、超时、重试、熔断阈值、去重键、保留期、失败规则、Parser 版本、健康检查 URL、负责人、平台条款复核状态/HTTPS 参考地址/服务端复核时间和来源状态。网络型来源只接受 HTTP(S)；新建页面默认 `disabled`。公开页面或 RSS 只有在条款状态为 `approved` 且登记参考地址后才能启用，系统不代替负责人判断平台条款。

## 数据、服务与审计

公开页与公开 RSS 的条款事实包含复核状态、HTTPS 参考地址、明确版本、到期时间和服务端复核时间。启用与每次 Worker 执行都要求状态为 `approved`、版本非空且到期时间晚于当前服务端时间；缺失或过期时失败关闭，不能用旧复核状态继续采集。

- `providers` 保存当前版本，使用整数 `version` 做乐观锁。
- `provider_versions` 保存不可变 JSON 快照、操作人、动作、request_id 和 trace_id。
- `provider_operations` 以操作人、路由和 Idempotency-Key 唯一，重复写入返回第一次结果。
- 创建、版本快照和幂等记录在同一 MySQL 事务中；更新通过 `SELECT ... FOR UPDATE` 串行检查版本。
- 三张表使用 MySQL 5.7、InnoDB、`utf8mb4`，UUID 和技术标识使用 ASCII 字符集。

列表、创建和更新统一要求已登录用户具备平台能力 `provider:configure`。写请求还要求同源 Origin 和 Idempotency-Key。API 返回稳定错误信封以及 request_id/trace_id，不在响应或日志中展示凭证。

## 页面与运行边界

平台管理员页面 `/platform-admin/providers` 按来源管理参考图实现列表与版本编辑器，并覆盖 loading、empty、error、expired、forbidden、blocked 和恢复状态。新建与编辑统一使用右侧分步抽屉，按“基本信息 → 范围与字段 → 执行策略 → 合规与发布”四步完成，列表与大表单不会同屏。技术字段提供按接入模式选择的显式模板和与 API 同界的即时校验；模板只填通用合同默认值，仍要求管理员按真实来源核对后发布。桌面保留完整表格；760px 及以下改为来源摘要卡片与具名详情抽屉，编辑入口保持可达，来源 UUID、代码、目标地址和原始接入模式只在“技术详情”展示。状态与接入方式统一显示中文，不会显示内部队列或凭证内容。

M03-01 是同步注册配置，因此异步处理不适用。调度、采集、租约、限流、死信和健康计算由 M03-03 及后续所属模块实现。没有新增环境变量、Redis key、文件、事件、SSE、导出或面板外服务；继续复用 `APP_WEB_ORIGIN`、MySQL 与既有 Baota Node API。

公开来源进入后续 Worker 执行链时，先读取已批准的条款复核事实，再请求目标同源的 `/robots.txt`。匹配 `ScoutOpsPublicCrawler`，无专用组时匹配 `*`，按最长 Allow/Disallow 规则决定目标路径；明确禁止返回 `robots_disallowed`，429 保留为限流，网络或超时保留可重试错误，不能把不可达伪装为允许或禁止。robots 文本只在进程内短时缓存，不新增持久化事实。来源中心的批量公开来源入口只选择已批准且有参考地址的定义；其他既有入口即使已排队，Worker 仍按同一门禁失败关闭，不能绕过最终执行检查。

## 回滚

先停止宝塔中的 Node API，确认没有 M03-01 写入，再执行 `database/migrations/0016a_provider_registry_m03_01.down.sql`，按 operations、versions、providers 的顺序删除表，随后回滚应用版本并由宝塔重启 Node API。该回滚会删除已登记来源及版本审计，执行前必须使用宝塔数据库备份并确认恢复点。
