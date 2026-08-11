# M07-06 真实选品验收架构

## 目标与事实边界

M07-06 把现有真实来源、采集任务、原始证据、趋势投影、机会和人工决策串成成员可直接执行的生产旅程：关键词、ASIN 或 HTTPS 商品链接进入 `/opportunities/start`，Node API 从当前会话解析 `organization_id`、`workspace_id` 和操作者，服务器只选择已启用的 `google_news_search`，成员不读取或修改 Provider 配置。

验收门固定为：创建 API 不超过 3000 ms，已接收/排队状态不超过 15000 ms，首个真实结果、`succeeded_empty` 或明确受阻/失败终态不超过 180000 ms。`SELECTION_ACCEPTANCE_DEADLINE_MS` 必须等于 `180000`，启动检查拒绝放宽。教学或演示数据不能写入这条验收链。

## 数据和状态

迁移 `0028_selection_journeys_m07_06.up.sql` 新增 `selection_journeys`、一次性 `selection_journey_decisions`、追加式事件、Outbox 和幂等操作表。全部业务记录带组织、工作区、请求、链路和时间字段；任务仍由既有 `collection_tasks`、`collection_subqueries`、原始证据和 Worker 状态机承担事实真相。

旅程读取模型不复制结果：它按 `task_id` 读取 `raw_evidence`、`normalized_records` 和可用的 `trend_signals`。有原始证据为 `result_ready`；真实空结果为 `succeeded_empty`；登录、验证码、robots、权限或终止失败保留明确错误码。没有证据时禁止 `adopt`。有趋势信号时，决策事务复用或创建来源主题唯一的机会，并把原始证据链接和 `opportunity_decisions` 同步写入；空/受阻时仍保存旅程人工决策，但不会捏造机会。

## 权限、审计和异步边界

- 创建：`task:create`；读取：`opportunity:read`；决策：`opportunity:decide`。
- 不授予成员 `provider:configure`、`collection:replay` 或任何 `platform:*` 权限。
- 创建与决策同时写业务、事件、Outbox 和幂等操作；原始采集、证据落盘、趋势投影继续由宝塔 Node Worker/Python Crawler 执行。
- 浏览器只看到脱敏 DTO，不读取数据库、Redis、凭证、Cookie 内容或 Provider 密钥。
- 如 Google News 需要项目专用出口，只有 API/Worker 内的固定 `news.google.com` 请求使用宝塔受限 `PROVIDER_PROXY_*`；验收成员、浏览器、其他 Provider 和系统环境均看不到或不继承代理。

## 页面依据

桌面布局取核心图 01、04–10 的组织/工作区顶栏、深海蓝状态卡、结论优先详情和证据 CTA；移动布局取概念图 53、54，390px 下状态指标转单列、关键证据和决策动作不隐藏。404 继续遵循概念图 72。状态同时使用文字、数值和错误码，不仅依赖颜色。

## 生产验收

宝塔有限任务 `product-scout-selection-acceptance` 运行 `node scripts/run-baota-selection-acceptance.mjs --production`。它以宝塔受限环境中的专用普通 `member` 登录，读取唯一有效验收组织及其默认工作区并通过 `/auth/context` 绑定新会话，随后校验最小权限、创建真实任务、轮询终态、查看证据、保存 `observe` 决策并写 mode 0600 证据。任务最多 240 秒，不创建 daemon、systemd、独立 PM2、宿主 crontab、备用服务器或面板外服务。
