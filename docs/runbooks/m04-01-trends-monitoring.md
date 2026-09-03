# M04-01 热点与监控运行、故障与回滚

## 宝塔部署顺序

1. 在宝塔受限发布任务备份 MySQL，按发布清单执行 `database/migrations/0017a_trends_m04_01.up.sql`、`0043_trend_rule_collection_schedule.up.sql`、`0064_governed_workflow_confirmations.up.sql`、`0068_automatic_selection_rule_matches.up.sql` 与 `0069_rule_based_recommendations.up.sql`；迁移兼容 MySQL 5.7、`utf8mb4`，不得使用 root 运行常驻服务。
2. 在 Node Worker 项目环境设置 `TREND_PROJECTION_POLL_MS=2000`、`TREND_PROJECTION_LEASE_SECONDS=120`。这些不是秘密；真实数据库、Redis 和会话秘密仍只保存在宝塔受限环境。
3. 由宝塔先重启 Node Worker，再重启 Node API。Web 静态产物随网站发布；不得创建 systemd、独立 PM2、宿主 crontab或面板外容器。
4. 检查 Worker 日志中的 `queue=trend_projection`，再运行 `npm run verify:module -- M04-01`。

发布后在桌面和 390px `/trends` 核对列表项的来源数、新鲜度和可信度，确认帮助面板位于列表之后且默认折叠；进入详情后依次选择“全部来源”和各来源，时间线点数应与 `timeline_sources` 一致。关注、创建监控和转为机会必须仍进入各自原有动作。

从任一证据点击“报告异常”，选择风险等级并填写原因。首次提交应返回 `201` 和 `created=true`，同一原始证据已有未关闭工单时应返回 `200` 和 `created=false`；随后在“平台后台 → 数据质量”按工单 ID 核对来源、原始证据、规范化记录、解析器版本、归因原因、`request_id` 与 `trace_id`。跨组织、跨工作区或不属于当前主题的 signal ID 必须返回 404，不能泄露其他范围是否存在。

同时核对筛选、排序、页码、当前主题和监控规则分区会同步到地址栏；复制后的视图链接应能恢复相同条件，`topic` 深链即使不在当前页也应读取对应详情。制造空结果后，“清除筛选并恢复”应回到默认活跃趋势。桌面调整列表宽度不得造成正文横向溢出，390px 下主从栏应转为单栏且主要操作可触达。

配置在进程启动时读取，修改轮询或租约后必须由宝塔重启 Node Worker。API 合同或代码发布后必须由宝塔重启 Node API。

## 观测与处置

- `scheduled` 长时间不下降：检查 Worker 是否由宝塔运行、数据库连接和 `available_at`。
- `leased` 超过租约：确认旧 Worker 已停止；新 Worker 会回收过期租约。
- `failed_terminal`：查看 `last_error_code`，通常是来源字段缺失或 URL/时间非法；修复解析合同后保留原证据并受控重放。
- `dead_letter`：依赖错误已耗尽四次尝试；记录 request/trace，恢复依赖后由受控 SQL 或后续管理入口重置，禁止直接删除审计。
- 页面数据不足：核对主题证据数和来源新鲜度。单来源或没有批准的计算规则时，环比与置信度显示数据不足是正确状态。
- 报告异常返回 404：刷新趋势详情，确认该证据仍属于当前主题和会话工作区；不得改传原始证据 ID 绕过 signal 范围校验。
- 报告异常返回已有工单：在数据质量页继续归因、指派或关闭；这是防重复行为，不应反复创建同根因工单。
- 自动频道采集成功但没有热点：检查 `trend_projection_jobs.last_error_code` 和 Provider code；`gnews_<市场>_<主题>` 应进入投影，只有非趋势来源才是 `succeeded_empty`。
- 商品型频道有热点但没有自动发现选品：先检查主题是否命中至少一条已启用规则，再检查同组织、工作区、趋势主题对应的 `opportunities`、`opportunity_rule_matches`、`opportunity_evidence_links` 和 `opportunity.candidate.discovered`。未命中规则不生成候选是正确状态；命中后应保存全部精确规则关联。
- Amazon 规则没有创建公开页任务：检查 Provider 是否启用、平台条款审核是否有效、解析器是否为 `amazon-structured-product-v2`，并确认规则任务的 `collection_subqueries.target_json` 含 `projection_type=rule_product_discovery` 和规则关键词 `query`。这条链只读取 Amazon 公开 `/s` 和商品页，不使用商品 API。
- 自动候选没有推荐：没有评分规则结果时，检查命中规则的 `status`、`recommendation_min_source_count` 与机会 `source_count`；达到任一启用规则门槛应写入 `recommend`，否则 `insufficient_data` 是正确状态。存在已启用评分规则时再检查 `opportunity_score_jobs` 与真实评分输入，并以评分版本结论为准。无论来源门槛或评分结果得到 `recommend`，都只能进入人工“采纳/观察/驳回”决策，系统不得自动采纳。
- 1688 未运行：检查已认证浏览器档案、登录健康和双人样本批准。当前合同仅允许已认证浏览器爬虫，不接入 OneBound 或其他商品 API；未完成前必须保持“待配置”，不得伪装为实时运行。
- 已有商品机会但图片、竞品快照或供应商仍为空：检查 `collection_subqueries.target_json` 中对应的 `competitor_snapshot` / `sourcing_search`，以及事件 `competitor.collection.auto_scheduled` / `sourcing.collection.auto_scheduled`。Amazon 详情目标必须包含 `page_url`；供应商目标必须包含 `query_contract=supplier-keywords-v2` 和 1–300 字符的 `query`，实际自动关键词不超过 120 字符。旧版字段错误、完整长标题查询或代理响应 URL 丢失会自动补建一次正确任务；Made-in-China 失败后仍应继续 EC21。其他已有失败或死信任务不会自动无限重放，应在采集控制台查看错误和证据后人工处理。

日志不得输出 Cookie、Token、数据库密码、主密钥或原始证据正文。

## 回滚

1. 先由宝塔停止 Node Worker，避免继续创建投影。
2. 回滚 Web、Node API 和 Node Worker 到上一版本。回滚后自动频道不再创建新候选，但已经生成的待评估选品、规则关联、趋势证据和审计必须保留，不得批量删除掩盖发布结果。
3. 如必须回滚数据库，确认 M04-02 及下游尚未使用趋势表，导出并保留 `trend_events`、`trend_outbox` 和主题证据关联后，执行 `database/migrations/0017a_trends_m04_01.down.sql`。
4. 只回滚规则推荐时，先恢复旧代码，再执行 `0069_rule_based_recommendations.down.sql`；它会把尚无评分版本的待决策规则候选恢复为 `insufficient_data` 并删除来源门槛字段。继续回滚规则关联时再执行 `0068_automatic_selection_rule_matches.down.sql`；它只删除规则关联表，不删除机会、证据或决策。完整 M04-01 下迁移会删除趋势投影与监控规则并撤销 `trend:manage`，但不会删除 P03 原始证据和规范化记录。完成后由宝塔重启旧版 Worker/API。

## 故障演练

自动验收覆盖租约回收、幂等投影、非趋势空成功、非法字段终止、可恢复依赖重试/死信、跨组织读取拒绝、版本冲突和相关性操作不删除证据。

## 规则周期发布与排障

发布前在宝塔备份 `product_scout`，确认 `0017a_trends_m04_01.up.sql` 已应用，再以业务账号执行 `0043_trend_rule_collection_schedule.up.sql`。发布本地构建后，通过宝塔重启统一 Node 后端“ai选品”；该后端包含 API 与 Worker，不创建新服务。

规则周期允许 15–10080 分钟。迁移前已经启用且 `next_collection_at` 为空的规则会在 Worker 下一次轮询时立即进入首批采集。没有运行时依次检查 `trend_monitoring_rules.next_collection_at`、`collection_interval_minutes`、`source_cursor`、`last_collection_task_id` 和 Worker 的 `queue=automatic_hotspot_sources` 日志。Google、非 Google RSS/论坛及公开榜单均应进入趋势投影；商品型榜单随后还应出现高优先级 Amazon 商品快照和 Made-in-China/EC21 供应商任务。只回滚本扩展时先停止后端，再执行 `0043_trend_rule_collection_schedule.down.sql` 并回滚代码；已生成的任务、证据、机会、竞品和找货记录必须保留。

主题治理验收需要两个不同的活动趋势管理员：甲提交提案后只能等待，乙按当前版本确认或驳回。合并前若关联超过一个机会，接口必须返回冲突且不迁移任何主题；拆分必须逐条选择信号且原主题至少保留一条。回滚 0064 前先停止统一 Node 后端并确认没有待处理治理请求；down 会把已归档主题恢复为 `stale` 并删除治理请求历史，必须先导出审计。应用迁移或回滚后只需通过宝塔重启统一 Node 后端，Python、MySQL 和 Redis 不重启。
