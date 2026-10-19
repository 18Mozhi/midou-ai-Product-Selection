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
