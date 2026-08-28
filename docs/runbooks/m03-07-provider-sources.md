# M03-07 自动热点来源运维与回滚

## 宝塔发布

1. 在宝塔备份 `product_scout` 数据库与证据目录。
2. 以 `product_scout` 业务账号在 `product_scout` 库按顺序执行 `0036_automatic_hotspot_sources.up.sql`、`0051a_provider_parser_samples.up.sql`、`0051b_provider_parser_sample_replay_runs.up.sql`、`0051c_provider_parser_sample_operations.up.sql`、`0053_provider_configuration_versions.up.sql` 与 `0064_governed_workflow_confirmations.up.sql`；迁移兼容 MySQL 5.7 与 utf8mb4。
3. 发布统一后端与 Web 构建；确认宝塔只有一个名为“ai选品”的 Node 后端项目。
4. 先创建或确认一个仅供自动采集审计使用的活动系统用户，在“ai选品”受限环境配置其 UUID 到 `AUTOMATIC_SOURCE_SYSTEM_ACTOR_ID`；同时核对调度周期、批量、单租户预算和积压上限，再通过宝塔重启该项目。
5. 检查 `/api/v1/health/ready`、Worker 心跳中的 `registered_sources`、来源中心数量以及一个真实组织的自动调度记录。

## 日常使用

- 普通用户：进入“热点趋势”，系统会自动更新；需要立即更新时点击“立即获取热点”。
- 平台管理员：进入“热点来源”，页面按市场热点与消费者信号、商品与竞品观察、供应链找货三个业务用途分组，每页显示 20 条；搜索、六项筛选/排序与页码同步到 URL，刷新、返回或复制到新标签页后仍恢复同一视图。“刷新来源”只重读真实目录，超时或失败时保留上一次成功数据并提示，不伪造刷新成功。管理员可直接编辑频率、超时、重试次数和启停状态，保存要求原因并写入平台审计，启动时的目录同步不会覆盖这些管理员配置。停用的公开页面或 RSS 选择启用后，按钮会变为“烟测并启用”：系统先保存停用配置，再访问真实目标并解析，只有通过才执行第二次启用写入。解析合同等开发验收说明只在本运维文档和专用检查页保留。
- 保存前预估：编辑弹窗按拟议频率显示当前同频的已启用自动来源数，并显示该来源真实 `pending / running` 子查询数相对于 `concurrency_limit` 的当前占用。没有逐来源相位数据，因此同频只用于提示可能同窗，不表示必然冲突；占用也是读页面时的快照，不作为未来容量承诺。
- 配置版本：在来源卡片选择“版本与回滚”，逐版查看频率、超时、重试和状态差异。恢复旧版必须填写原因；系统会生成新的当前版本而不是改写历史。若旧版要求启用来源，当前条款审查或 1688 解析验收仍须通过。
- 自动目录包含 96 个 Google News RSS、40 个非 Google RSS/Atom 或公开页频道与 2 个 Amazon/eBay 固定公开榜单页面爬虫；其中 Shopify 资讯和 eBay 公告已切换到当前公开 HTML 页面。普通用户不需要配置官方 API Key。Walmart 当前返回人工验证页，保留为受控页面来源并明确显示受阻，不会伪造商品数据。
- 跨境自动来源只复用本项目受限代理，并仅允许代码目录中自动来源的固定主机；不设置服务器全局代理，也不会代理用户输入的网址。新增自动来源主机时必须同步目录测试、Feature Map 与本运维说明，然后通过宝塔重启“ai选品”。
- 登录型来源只使用平台管理员维护的受控浏览器档案。没有真实登录态或页面解析合同的来源保持禁用，不伪造结果，也不要求普通用户填写密钥。
- 1688 已有 `1688-browser-contract-v1` 搜索、商品详情和供应商输出合同及固定样本回放页面。专用验收页用最新真实浏览器作业展示搜索、详情、翻页覆盖矩阵；当前执行计划 `max_pages=1` 时翻页必须显示“未演练”，不能把首屏成功解释成分页覆盖。只有带结构化快照、截图和 DOM 的成功真实作业才会成为候选；固定后执行差异回放。当前 Playwright 尚未产出结构化快照，因此通常没有候选，来源仍显示“待配置”且保持禁用。配置接口会以 `provider_source_setup_required` 阻止手工启用，不能只因合同测试或矩阵某一项通过就绕过门禁。
- 自动调度参数分别为检查周期 `AUTOMATIC_SOURCE_SCHEDULER_POLL_MS`（5000–300000）、单批来源 `AUTOMATIC_SOURCE_BATCH_SIZE`、单组织活动任务预算 `AUTOMATIC_SOURCE_TENANT_ACTIVE_TASK_BUDGET` 和全局积压保护 `AUTOMATIC_SOURCE_QUEUE_BACKLOG_LIMIT`。规则采集和全量采集拥有独立队列配额但共享后两道业务预算；修改后通过宝塔重启统一后端“ai选品”。

## 故障处理

- `automatic_source_system_actor_not_configured / invalid`：专用系统用户未配置或已停用；修复 `AUTOMATIC_SOURCE_SYSTEM_ACTOR_ID` 对应的活动用户后通过宝塔重启，不得回退为普通管理员账号。
- `queue_backlog_limit / tenant_active_task_budget`：自动采集因全局积压或单组织预算暂停；先消化现有任务和失败重试，不得通过旁路 Worker 绕过。
- `adapter_not_registered`：来源仍处于待配置状态或部署版本不一致；不要伪造成功。
- `provider_source_setup_required`：1688 没有由另一来源管理员审批通过且当前解析版本最近一次回放通过的真实登录固定样本；保持来源停用，先完成真实结构化采集、固定样本、第二人审批和差异回放。
- `provider_source_smoke_test_required`：公开页面/RSS 的成功烟测缺失、早于当前配置，或烟测使用的超时配置与启用请求不同；在来源配置页保持停用保存当前设置，再点“烟测并启用”。不要直接改库或用历史启用版本绕过。
- `rate_limited`：保留任务和证据，等待状态机退避；不要提高并发绕过限制。
- `source_changed`：系统已事务化停用对应 Provider，并写 Provider 版本和 `provider.parser_drift.auto_paused` 平台审计；保留 trace_id，更新解析器和合同测试、完成固定样本差异回放后再由来源负责人显式恢复。
- `parse_failed`：任务按失败分类处理但不会自动停源；先用 trace_id 判断是单条脏数据还是稳定页面合同漂移，只有确认合同漂移并发布新解析器后再调整来源状态。
- 1688 的 `source_changed`：对照失败快照的 `schema_version`、DOM 片段与 `source_paths`，更新受控浏览器提取器和固定样本回放；不得放宽到任意 1688 URL、吞掉缺失字段或用空记录冒充成功。
- 1688 的 `source_configuration_invalid`：检查是否为 HTTPS 1688 域名、搜索入口是否为 `s.1688.com`，以及详情 URL 中商品 ID 是否与记录一致。该错误不是登录续期信号，不能通过重放绕过。
- 固定公开榜单页面无结果：先核对页面是否调整结构或返回地区/验证页面；解析器会以 `source_changed` 失败，不会把空白或错误页当成商品数据。
- `invalid_payload`：核对响应类型与编码；项目代理会在 2 MB 解压上限内处理 gzip/deflate/br，频道解析器支持 RSS、Atom 与 RDF，超限或未知编码继续失败关闭。
- 自动任务不生成：核对 `automatic_source_schedules.next_scheduled_at`、组织/默认工作区状态、来源是否已启用，以及公开来源的条款批准状态、HTTPS 参考地址、条款版本和有效期；没有合规可用来源时调度器只顺延 5 分钟，不写入必然得到 `permission_denied` 的任务。再检查统一后端 Worker 日志。
- 手动刷新失败：核对当前会话的活动组织/工作区、`trend:read`、Origin 与 Idempotency-Key。

所有排障都只检查“ai选品”项目自己的日志、表和证据；不得操作 PVE、其他项目、系统磁盘调度器或面板外服务。

## 回滚

先通过宝塔停止“ai选品”，回滚应用版本。只有确认旧应用不会再写 `configuration_updated` 或 `configuration_rolled_back` 后，才执行 `0053_provider_configuration_versions.down.sql`；该 down 会把这两类动作收敛为旧版可识别的 `updated`，保留版本快照但会丢失细分动作标签。未确认时保留 0053。若同时确认允许删除固定样本与回放记录，再依次执行 0051c、0051b、0051a down，最后执行 `0036_automatic_hotspot_sources.down.sql`。0051 down 会删除回放幂等、回放记录和固定样本；不删除 Provider、采集任务、原始证据、用户、组织或审计记录。若未取得该数据删除授权，只回滚应用并保留 0051 表。

最后通过宝塔启动“ai选品”，复查健康与单后端状态。回滚不创建独立 Worker、Crawler 或测试项目。

## 本次发布重启要求

来源目录、1688 解析合同、配置版本回滚和凭证续期重放逻辑都在 Node 进程启动时加载。发布时按顺序应用 0048、0049、0050、0051a/0051b/0051c、0053 与 0064 迁移，通过宝塔重启统一 Node 后端；Python 领取合同或执行器代码未变化时无需重启 `ai选品-python`。MySQL 与 Redis 不需要重启，也不创建新服务。`1688_search` 在真实登录固定样本字段提取回放和第二人审批均通过前继续保持停用。

## 网页登录与真实页面烟测

在“来源频道 → 1688 验收”依次核对登录态、验证码和字段解析。登录态需要当前有效档案完成一次成功运行；同一次成功运行作为未被验证码阻断的验收证据；字段解析需要当前解析器版本的固定样本回放为通过，并由另一名来源管理员审批样本基线。再核对搜索、商品详情与翻页矩阵：搜索和详情的“已覆盖”必须来自最新作业快照通过对应版本合同；翻页只有计划允许多页且实际 `page_count > 1` 才显示“已覆盖”，单页计划显示“未演练”。页面会显示负责人和准确待配置原因。点击“刷新验收事实”只重新读取数据库事实；按钮在读取期间禁用，12 秒超时、离线或接口失败时保留上一份事实并显示可重试提示，恢复后再次刷新应显示最新读取时间。“配置或续期登录档案”会带入 1688 并直接打开登录档案表单，“定位 1688 固定样本”会带 `provider_id` 将来源目录筛到唯一 1688 来源。矩阵不属于启用门，登录、验证码、回放与审批门禁未全部通过时，配置 API 仍以 `provider_source_setup_required` 拒绝启用，禁止直接改库绕过。

- `public_page` 与 `public_rss` 可单独使用“匿名测试”排障；从停用切换为启用时必须走“烟测并启用”，由页面先保存停用配置、执行同一真实页面测试，再以新版本锁启用，不要求登录档案。失败后设置已保存但状态保持停用。
- 登录型来源可先“打开登录页”，再上传 Playwright `storageState` JSON、浏览器 Cookie JSON、Netscape `cookies.txt` 或完整 `.tar.gz` 浏览器档案。
- 也可由浏览器助手在用户点击后按目标域名读取当前浏览器 Cookie。扩展桥接只接受 `midouai.mozhiz.cn` 与本地开发来源，Cookie 进入 API 后规范化、加密且不再返回。
- 完整档案与 Cookie 文件是不同格式；不允许把 Cookie JSON 当作 tar.gz 解压。
