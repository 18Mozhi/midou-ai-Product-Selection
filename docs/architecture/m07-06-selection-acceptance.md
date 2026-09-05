# M07-06 真实选品验收架构

## 目标与事实边界

M07-06 把现有真实来源、采集任务、原始证据、趋势投影、机会和人工决策串成成员可直接执行的生产旅程：关键词、ASIN 或 HTTPS 商品链接进入 `/opportunities/start`，Node API 从当前会话解析 `organization_id`、`workspace_id` 和操作者，服务器只选择已启用的 `google_news_search`，成员不读取或修改 Provider 配置。

验收门固定为：创建 API 不超过 3000 ms，已接收/排队状态不超过 15000 ms，首个真实结果、`succeeded_empty` 或明确受阻/失败终态不超过 180000 ms。`SELECTION_ACCEPTANCE_DEADLINE_MS` 必须等于 `180000`，启动检查拒绝放宽。该阈值只用于运行验收和告警，不展示在成员页面；教学或演示数据不能写入这条验收链。

## 数据和状态

迁移 `0028_selection_journeys_m07_06.up.sql` 新增 `selection_journeys`、一次性 `selection_journey_decisions`、追加式事件、Outbox 和幂等操作表。迁移 `0029_collection_task_evidence_links_m07_06.up.sql` 新增范围化的 `collection_task_evidence_links`，并为既有原始证据回填首个采集任务关联。迁移 `0059_selection_journey_candidates.up.sql` 在决策中保存被采纳的原始证据引用。全部业务记录带组织、工作区、请求、链路和时间字段；任务仍由既有 `collection_tasks`、`collection_subqueries`、原始证据和 Worker 状态机承担事实真相。

旅程读取模型不复制结果：它按当前 `task_id` 通过 `collection_task_evidence_links` 读取 `raw_evidence`、`normalized_records` 和可用的 `trend_signals`，按稳定顺序最多返回 20 条候选供成员比较；`first_result` 仅保留为旧客户端兼容别名。浏览器只在本机保存当前旅程 ID，重新打开页面后按会话组织和工作区向 API 读取真实状态，不保存或伪造结果。成员采纳时必须提交属于当前旅程的 `selected_raw_evidence_id`；只有 `adopt` 会从被选候选生成或复用机会并链接该候选证据，`observe` 和 `reject` 只保存旅程决策。

同一组织、工作区和 Provider 再次采集相同去重键时，Worker 复用不可变原始证据，但必须先校验当前任务/子查询范围并追加 `deduplicated` 关联及审计事件；因此重复真实输入仍能在本次旅程中得到可验证结果。Google RSS 可能在 GUID、规范 URL 和规范字段完全不变时只改变未消费的 XML 包装；此时不得覆盖旧原文，也不得让整个任务进入重试，`evidence.linked` 审计载荷以 `content_changed=true`、`existing_content_sha256` 和 `observed_content_sha256` 留下变化事实。只要规范 URL、Parser、Adapter、Schema 或规范载荷任一变化，仍以 `evidence_dedupe_conflict` 失败关闭，禁止静默复用；单条冲突按不可重试的记录失败保留，其他独立记录继续落库，有可用记录时任务以 `completed_with_warnings / partial` 及时终止，不得把数据冲突误判成来源网络故障反复重试。有原始证据为 `result_ready`；真实空结果为 `succeeded_empty`；登录、验证码、robots、权限或终止失败保留明确错误码。没有属于当前旅程且已形成趋势主题的候选时禁止 `adopt`；空/受阻时仍保存旅程人工决策，但不会捏造机会。

## 权限、审计和异步边界

- 创建：`task:create`；读取：`opportunity:read`；决策：`opportunity:decide`。
- 不授予成员 `provider:configure`、`collection:replay` 或任何 `platform:*` 权限。
- 创建与决策同时写业务、事件、Outbox 和幂等操作；原始采集、证据落盘、趋势投影继续由宝塔 Node Worker/Python Crawler 执行。
- 浏览器只看到脱敏 DTO，不读取数据库、Redis、凭证、Cookie 内容或 Provider 密钥。
- 如 Google News 需要项目专用出口，只有 API/Worker 内的固定 `news.google.com` 请求使用宝塔受限 `PROVIDER_PROXY_*`；验收成员、浏览器、其他 Provider 和系统环境均看不到或不继承代理。

## 页面依据

桌面布局采用信号账页的身份条、横向模块索引、结论优先详情和证据 CTA；390px 下状态指标与候选账页转单列，关键证据和决策动作不隐藏。页面只展示业务进度、候选比较、受阻原因与下一步，不展示生产验收阈值或内部状态码；状态不仅依赖颜色。

## 生产验收

宝塔有限任务 `product-scout-selection-acceptance` 运行 `node scripts/run-baota-selection-acceptance.mjs --production`。它以宝塔受限环境中的专用普通 `member` 登录，读取唯一有效验收组织及其默认工作区并通过 `/auth/context` 绑定新会话，随后校验最小权限、创建真实任务、轮询终态、查看证据、保存 `observe` 决策并写 mode 0600 证据。任务最多 240 秒，不创建 daemon、systemd、独立 PM2、宿主 crontab、备用服务器或面板外服务。
