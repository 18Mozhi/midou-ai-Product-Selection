# 优先补齐有效自动主品的真实详情

## 依据

当前用户要求精简到连续的情报→主品→5–10竞品→评分→1688整链，旧功能不能妨碍根本流程。真实21:33:18Z核对：已自然补到详情的旧YISHU商品当前primary_asin=NULL/candidate_present=0；Router Cooling Fan具有B0B5DJ6KF7/candidate_present=1却仍waiting_evidence。原周期详情按首次缺失/年龄排序，不能区分当前自动主品和旧监控。21:39:32Z评估队列明确存在3条amazon_competitor_snapshot_missing和9条amazon_sale_facts_incomplete，其他等待原因不等同于缺主品详情。

## 改动

在原周期详情轮次内先做一次普通候选读取：从waiting_evidence且属于上述两种实际等待原因的评估出发，按原正式selectionPrimaryAsinSql确认当前主品，再绑定同机会/组织/工作区/市场的活动Amazon竞争对象。必须确实没有latestCompetitorDetailSnapshotSql证明的实际详情；非空快照指针仍须属于该对象/范围，不能从错误指针回退。原创建/观察年龄、近期尝试冷却、自身活动详情排斥和原全局容量1000均保留。先处理已等主品快照，再处理售价事实不足，同类按原评估时间/创建时间/ID确定顺序；没有写入或重算任何评估/评分/价格。

候选读取不加FOR UPDATE，不范围锁住评估队列；选中后从competitor主键按原competitor/opportunity顺序做范围与全部资格复核，等待状态只作嵌套证明。资格变化/当前任务冲突时不采用旧候选。最终仍调用原scheduleCoreCollection，使用同样auto-refresh请求、competitor.collection.auto_scheduled事件与provider/page_url/asin/projection_type/competitor_id载荷。没有合格主品时继续原全部周期刷新；回退SQL与改动前逐字一致，SHA256=9092c7b10f8d2420f23d34115215003b68726094ed674c9ff269274ca33359f7。

原竞品发现/详情轮换、来源开关/熔断/robots/验证保护、单机与来源并发、冷却/退避/任务尝试和范围权限不变。旧任务及记录不删除/归档、不人工重放，不提高积压阈值；原子队列锁之外的在途扇出仍可能让总积压暂时超过阈值。本次是已有详情轮次的选择顺序修复，不承诺特定商品立刻完成或日百品达成。

## 配置与调用方

无新增API/字段、环境变量、数据库结构、依赖、服务或Python/插件协议。沿用COMPETITOR_REFRESH_INTERVAL_SECONDS（默认3600）与AUTOMATIC_SOURCE_QUEUE_BACKLOG_LIMIT（默认1000）；config/env.example仅补充现有参数注释，真实.env不变。前端/后端接口继续消费原任务与结果，OpenAPI只注记内部优先顺序，Feature Map和产品总纲同步。按固定deploy-baota.py发布并由宝塔重启唯一Node项目ai选品加载；整包固定发布按原流程运行，用户无需额外调参或增设服务。

## 验证

41项最小、175项相关Node回归通过，覆盖优先对象、原payload、无候选/复核丢失后原刷新回退、读失败原样抛出、无额外尝试，以及原容量/范围/完成任务公平/模型与评分合同。两条旧测试已同步读取位置/读取次数，原回退断言完整保留。

24项真实MySQL5.7只读点选/派生评估检查全部通过：两种正确等待原因可匹配，其他状态/原因、错误评估范围、错误选中身份、过早年龄与容量不足全部返回0。为了独立验证其余条件，正例仅在SELECT参数中忽略当前容量，不改配置/任务；时间仍转换JS Date绑定。派生表初次存在字符集冲突，按原评估表ASCII字段显式CAST后通过，没有修改真实库字符集。测试占位数量先排除SQL字符串中的问号，实际mysql2本身正确保留字符串内问号。

21:43:20Z实际1000阈值查询17ms/0；仅忽略容量的诊断1491ms选出当前范围B0FLY4HV8V，再经同身份只读点选成功，没有手工调度。21:48:40Z EXPLAIN显示普通候选从现有status索引读评估队列，o主键/c机会索引；当前点选的c/o为PRIMARY const各1，等待评估为嵌套PRIMARY const1。没有执行真实FOR UPDATE或任何写入。正式发布、自然优先入队、新详情/整链仍须分别验证。

22工作区完整构建、格式、运行文档及地图/OpenAPI语法解析通过。没有新增临时脚本/目录、日志、截图、浏览器或常驻验证进程；永久SQL/单元测试为本次交付保留。旧清理拒绝路径未重试，用户原verification/state.json保持原哈希且不暂存。配置仅注释更新，无真实.env修改；正式发布和自然优先任务结果待上线后回读。

## 正式发布与真实边界（2026-10-20 05:57，北京时间）

59ee638bd2025f803acd5a9dad0cca1c66af82aa已由固定发布命令通过格式、运行文档、发布矩阵、13路径归属及22工作区构建，上传与宝塔重启、公开验证完成，终端exit=0，发布临时包已自动删除。独立只读回读BUILD_SHA一致；automatic-primary-detail-refresh哈希8b42fd3fe78421d4c92aa1ec84d56b1222517c1ac3c77da7d8b446ccf72b43f0，trend-projection-persistence哈希a40a437d90bb00257a1b595d86473998c904f9882fa6549406e8283abd76ca9c，与本地构建完全一致；原competitor-refresh-policy哈希4444009e2c296325617450349c996bef394ea0164acf0aa63a0cb62184c27f60未变。线上编译方法捕获原回退SQL哈希仍9092c7b10f8d2420f23d34115215003b68726094ed674c9ff269274ca33359f7。

21:56:58.703Z真实容量1000/1000，实际候选为空；两来源enabled/closed，Cooling主品仍无详情、仅有原permission_denied终止任务。仅在SELECT诊断中使用backlog+1，原编译方法选中当前工作区B0FLY4HV8V，沿用auto-refresh载荷和competitor.collection.auto_scheduled；scheduleCoreCollection已被只读哨兵替换，在任何写入前抛出，未创建任务/事件或锁定业务记录。该探针只能证明线上选择与生产者边界，不是自然调度成功。

从21:56:58.703Z至21:57:20.512Z，新详情/发现事件为0，积压仍1000，当前工作区当日整链仍1/100；不提高阈值、不重放任务、不将诊断或旧监控快照计入产量。自然优先入队、真实详情和日百品仍待验收，总目标未完成。

## 自然优先入队已验证（2026-10-20 05:59，北京时间）

21:59:29.476Z原采集任务自然成功释放容量；21:59:31.979Z原投影轮次自动创建d110fb9b-b886-4c5d-bbeb-e2ff5a856b3a，事件competitor.collection.auto_scheduled/worker，组织6a91c1bf-661d-459f-9530-54e6315056ff、工作区99a2e4be-1796-4030-a42a-a2d95138679d，主品B0FLY4HV8V/对象08bd72be-1ebd-483f-bb19-001a486a0abe，与线上只读候选一致。21:59:54.338Z任务scheduled、latest_snapshot_id=NULL、积压1000、当日1/100。这是自然入队证明，尚非详情或整链完成；没有运行诊断中的scheduleCoreCollection替身写入、人工建任务、重放旧任务或提高阈值。

21:58:09Z有效排队999条，其中正式完成通道37条、其他既有任务962条；21:58:30Z调度running/suspected_stuck_runs=0。21:59:30Z最近30分钟有29条succeeded（全局查询，不能等同于当前工作区商品数），当前正在处理旧intelligence_product_discovery任务。以上为实际吞吐和排队快照，不是日百品承诺或旧任务可删除的依据。只读排查初次误用浏览器表last_error_code字段已失败，按真实代码改查error_code后成功，没有修改表或数据。

## 三个当前主品真实详情已自然恢复（2026-10-20 06:09，北京时间）

22:09:39.306Z正式同范围latestCompetitorDetailSnapshotSql确认三条新详情均valid_detail=1：B0FLY4HV8V快照f1cf3fae-ce2c-418d-9d50-1af0c0fc958c，22:02:08.633Z，USD21.59/4.3/121174评价；B0DHJH2GZL快照bd262cc3-e3d7-4e79-9f9a-6cef9d8162bf，22:04:54.985Z，USD558.90/3.9/2772评价；Cooling主品B0B5DJ6KF7快照c58576a4-d172-4cb3-be9d-17d311d52ee6，22:07:48.722Z，USD27.99/4.3/91评价。三者rank_value均NULL，不补造排名或销量。

评估已自然推进至下一证据门：第一条high_confidence_1688_match_missing，后两条automatic_cost_scope_mismatch。真实详情恢复已证明，尚不等于评分/货源/整链完成。旧Cooling permission_denied任务未重放或改写，新任务来自原周期策略并满足冷却和容量。此为评估等待原因，不证明利润未知本身会阻断：现有waitForCost仍发布非利润评分，并在评分输入稳定后按完整证明尝试记账。22:14:01Z只读正式证明中Cooling有效竞品8、iPhone16有效竞品9，二者完整proof仍空；采购报价等其余条件需继续逐项核对，不能伪造报价、改写规则或直接增加完成数。

22:16:45.107Z进一步只读核对上述三商品的同范围当前成本输入：各自只有真实automatic_evidence售价（USD558.90/27.99/21.59），没有purchase_price。缺少实际可确认采购报价是当前未形成完整证明的已证实条件之一；利润未知仍按已确认规则允许，不应为此再次要求用户确认或放宽进货价事实。
