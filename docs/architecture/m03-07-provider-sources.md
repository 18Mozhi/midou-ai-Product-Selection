# M03-07 全网热点与来源目录

## 面向用户的结果

来源中心不再只显示两个技术条目。代码目录现在包含 100 个以上可解释的“来源频道”，分成新闻、电商、数据、社区和商品供应五类：

- 96 个公开 Google News RSS 固定频道由 8 个市场与 12 个主题组合而成；另有 40 个非 Google 新闻、电商、社区和趋势 RSS/Atom 或公开页频道，以及 Amazon/eBay 固定公开榜单页，均由系统启动时自动登记并启用。
- Shopify 资讯与 eBay 社区公告使用当前公开 HTML 页面解析；Amazon/eBay 榜单使用固定公开商品页解析。Keepa、1688、TikTok Shop、YouTube、Similarweb、Semrush 等尚未具备固定公开页合同或受控登录档案的来源保持“待配置”，不会伪造实时数据。
- Google News 关键词和商品供应 CSV 保留为用户手动采集入口。

这里的“100+”是可独立调度、审计和展示的来源频道数量，不宣称它们全部是相互独立的平台。页面明确显示“自动采集 / 待配置 / 手动导入”，小白用户不需要理解 Provider、Adapter 或 Parser 才能知道下一步。

每个来源同时展示代码目录中的负责人、由类型/市场/字段组成的影响范围，以及该 Provider 最近一条真实 `succeeded / succeeded_empty` 子查询的完成时间与结果数。当前没有独立 SLA 配置字段，页面只把已配置 `schedule_minutes` 标为“沿用采集计划”的更新目标，不伪造承诺或达标结论；待实施与手动来源明确显示“未设自动 SLA”。所有尚未完成生产接通的 `setup_required` 来源统一标为“待实施”。

## 自动与手动数据流

`@scoutops/provider-sources` 入口只作为兼容导出面；代码内置来源目录位于 `src/catalog/`，纯解析与证据映射位于 `src/parsers/`，网络/浏览器/导入适配器及注册工厂位于 `src/adapters/`。解析器不领取任务、不持有凭证，适配器不重新定义来源目录，调用方继续从包根入口导入以保持现有合同。

1. Node API 启动时以代码目录同步 `providers`。已存在来源只更新合同字段并保留人工状态；新自动频道登记为 `enabled`，待配置与手动来源登记为 `disabled`。
2. Node Worker 把规则采集与全量目录采集注册为两个独立队列。`MySqlAutomaticSourceScheduler` 为每个活动组织默认工作区建立 `automatic_source_schedules`，按下次时间、上次时间和组织 ID 公平轮转；每次按可配置批量轮转自动频道，完整轮转后等待 15 分钟。创建任务与系统审计只使用受限环境中配置的活动专用系统用户，不再借用任意平台管理员。
3. 普通成员在热点页点击“立即获取热点”时，`POST /api/v1/provider-sources/refresh` 用当前组织、工作区和幂等键创建一次包含最多 100 个已启用自动频道的任务。
4. Worker 继续复用 M03-05 状态机、Redis 范围租约和 M03-06 不可变证据链；每条结果带 Provider、Adapter、Parser 和字段路径溯源。
5. 待配置来源没有适配器且默认禁用，因此不能进入自动任务；系统宁可显示“需要配置”也不把聚合新闻当成该平台官方销量或价格。

## 1688 浏览器输出合同

`/platform-admin/providers/sources/1688-acceptance` 是 1688 专用验收页，只聚合真实数据库事实：有效且未过期的浏览器档案、最近一次登录态浏览器运行是否成功/是否被验证码阻断、当前解析器版本固定样本回放，以及代码中已登记的负责人和逐项待配置原因。页面与 API 不返回 Cookie、凭证密文、档案 UUID、租约或浏览器输入。1688 从停用切为启用时必须同时满足三项门，旧的解析回放或仅存在档案均不能单独放行。

`1688_search` 现在使用 `1688-browser-contract-v1` 管理浏览器提取器与 Provider 规范化层之间的输出，三类快照必须分别声明 `1688.search.v1`、`1688.offer-detail.v1` 或 `1688.supplier.v1`：

- 搜索结果保存标题、供应商、报价、币种、MOQ、地点和商品规范链接；详情补充规格与交期；供应商快照独立保存供应商名称、地点和规范链接。
- 每条记录都必须携带观测时间、受限 DOM 片段和每个必需字段的来源路径。原始 DOM 单条最多 250 KB，搜索快照最多 100 条；商品 ID 必须与 `detail.1688.com/offer/{id}.html` 路径一致。
- 报价缺失时币种必须同时为空；存在报价时只接受 `CNY`。缺少报价、MOQ、地点、规格或交期时写入明确的 `missing_fields_json`，不得补零或猜值。
- Schema、字段路径或页面身份变化统一以 `source_changed` 失败关闭；执行器在同一事务把 enabled Provider 改为 disabled、追加 Provider 版本与平台审计，然后才让必需来源任务失败。非 HTTPS、跨站地址或搜索/详情身份不一致以 `source_configuration_invalid` 拒绝。

固定样本只能从已成功且同时具有结构化快照、截图、DOM 片段和单一解析版本的真实浏览器作业生成；前端不能上传任意 JSON 冒充生产样本。服务端保存不可变输入、规范化基线及哈希，回放时用当前解析器重新处理并保存最多 200 条逐路径差异。1688 启用门禁只接受当前解析版本最近一次回放为通过的活动样本；后续差异或失败会立即使该样本不再满足门禁。

该合同和回放能力只锁定受控浏览器提取后的数据边界，并不等于生产字段采集已经接通。Worker 到 Python 的业务作业领取、心跳、Playwright 执行与结果回写链已登记；当前真实 Playwright 尚未产出合同要求的结构化快照，因此没有合格固定样本候选，`1688_search` 必须保持 `setup_required / disabled`，不得进入自动调度。

## 配置版本、差异与回滚

来源的每次采集设置变更继续追加到不可变 `provider_versions`。版本接口只从快照中投影采集频率、单次超时、失败重试次数和启停状态，并逐版计算字段差异；原始快照、负责人标识、request_id/trace_id、凭证、Cookie 和宝塔受限环境值不返回浏览器。回滚不是覆盖历史：管理员选择早于当前版本的快照、填写原因并提交当前版本锁，服务端重新校验公开来源条款与 1688 当前解析验收，再把四项安全设置恢复为一个新的 `configuration_rolled_back` 版本并写平台审计。历史版本、失败记录与当前安全门都不得删除或绕过。

## 安全、权限与限制

- 来源目录：`provider:configure`；人工回放：`collection:replay`；热点页立即刷新：`trend:read`。
- 所有写请求要求 HttpOnly Session、同源 Origin 和 `Idempotency-Key`。
- 自动来源地址全部来自代码目录，拒绝调用方提供任意 URL、代理或凭证；Google News 仍使用固定 HTTPS 模板并拒绝重定向。
- 项目专用代理只允许访问代码目录中已登记的自动来源主机；它不会代理任意地址，也不设置系统或其他项目的全局 `HTTP_PROXY`/`HTTPS_PROXY`。
- RSS/RDF/Atom 与公开页面代理响应在解压后最多 2 MB、单频道单批最多 20 条；原始证据与规范化记录仍按组织、工作区、来源和外部 ID 隔离去重。
- 自动刷新创建的来源子查询是非必需覆盖项：同一外部 ID 已存在但规范事实发生变化时，保留旧的不可变证据、跳过该条并继续处理本批其他热点；批次不得因此整体进入重试。普通用户主动创建的必需选品旅程仍显式返回规范数据冲突，不能静默覆盖。
- `source_changed` 无论来自必需还是非必需子查询都会暂停对应 Provider，阻止后续调度继续消费漂移页面；恢复必须由来源负责人更新解析器、完成固定样本回放与差异核对后显式启用，系统不自动猜测新字段。

## 配置与运行边界

`AUTOMATIC_SOURCE_SCHEDULER_POLL_MS` 控制 Worker 检查到期组织的周期，`AUTOMATIC_SOURCE_BATCH_SIZE` 控制单批来源数，`AUTOMATIC_SOURCE_TENANT_ACTIVE_TASK_BUDGET` 限制单组织活动自动任务，`AUTOMATIC_SOURCE_QUEUE_BACKLOG_LIMIT` 在全局积压达到门限时停止新增自动任务，`AUTOMATIC_SOURCE_SYSTEM_ACTOR_ID` 必须指向已创建并激活的专用系统用户。任一值修改后都需要通过宝塔重启统一后端“ai选品”。通用采集仍复用 `COLLECTION_TASK_*`、`PROVIDER_ADAPTER_*`、`PROVIDER_PROXY_*` 和 `EVIDENCE_*`。

生产由宝塔管理 Node 后端项目“ai选品”和 Python 3.12 采集项目“ai选品-python”。API/Worker 由 Node 统一后端拉起，Worker 领取业务任务并排队登录型作业；Python 项目领取浏览器作业、维持作业/档案/全局 Crawler 租约并桥接 Playwright，结果仍由 Worker 解析和持久化。当前 1688 字段提取未验收，来源保持停用。不新增独立 Worker、候选后端、面板外服务、负载均衡或多节点能力。
