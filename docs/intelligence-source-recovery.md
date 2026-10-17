# 情报来源恢复后的补采

## 问题与范围

2026-10-18，Amazon 停用版本 12 至经真实健康检查重新启用版本 13 之间，米兜有 30 个自动情报搜索因来源停用进入 failed_terminal。既有手工回放接口只支持 dead_letter，不能直接修改旧终态、伪造死信或成功。

现有趋势 Worker 增加有界补偿：创建关联的新采集任务，旧任务的状态、错误、证据及版本保持原状。新任务必须经过原采集、事实持久化、主品识别、竞品、评分与找货流程；补采入队不算整链完成。

## 放行条件

- 仅 Amazon public_page；当前启用、条款已批准且未过期、熔断关闭、真实健康为 ready。
- 当前版本必须来自现有 configuration_updated 审计，状态 enabled，紧邻前一版本必须 disabled；健康检查时间不早于停用版本。
- 原任务在该停用区间内以 permission_denied 失败、无可用结果、不是回放任务；只包含一个必需的同来源 blocked 子查询。
- 原任务必须有 Worker 写入的 intelligence.product_search.auto_scheduled 事件；目标严格沿用原 intelligence_product_discovery、query 和 intelligence_source_record_id 合同。
- 当前组织、工作区和原创建人须有效；原始情报记录仍 active，已投影的同范围主题有 intelligence.associated 事件且包含原搜索词。使用已有 normalized_records、trend_signals 与 trend_events 关系核验，不能靠调用方标记猜来源。
- 已有任意关联补采任务即不再补采；权限、验证或策略错误发生在正常启用区间时不属于本机制。

## 运行与审计

每个 Worker 每 30 秒最多扫描一批，批量上限 20；同时受现有 AUTOMATIC_SOURCE_QUEUE_BACKLOG_LIMIT 全局活动任务预算约束，并精确限制在预算剩余空间内。沿用原优先级，不新增租约、线程、服务或提速配置。

锁定唯一来源及其审计版本后，再按原任务主键和组织/工作区锁定、重查状态与关联补采，事务内创建新任务、原目标子查询及两条调度事件。原终态不更新，外键 replay_of_task_id 关联原任务，trace_id 沿用原链路，request_id 新建。

新增事件 intelligence.product_search.source_recovered 记录原任务、来源 ID、启用和停用版本；同时保留既有自动搜索调度事件。补采任务不能再次触发此补偿，因此失败时仍按原重试、终态和死信合同处理，不无限循环。

补偿失败会回滚整批，记录脱敏错误码 intelligence_source_recovery_failed；扫描冷却仍保留，新的情报投影继续执行。该机制不启用来源、不关闭熔断、不批准条款、不访问或解决验证页面。人工死信回放权限和状态机不变。

## 配置、验证与发布

没有新增环境变量、API 字段、数据库迁移、依赖、前端或 Python 参数。现有预算在 config/env.example 说明；调整预算须在宝塔受限环境中修改并重启唯一 Node 项目 ai选品。扫描间隔与批量上限是内部有界策略，无额外调节入口。

本地 tests/unit/intelligence-source-recovery.test.mjs 覆盖同范围补采、防重、竞态重查、预算、目标和来源隔离、事务回滚及补偿故障不阻断新情报。既有投影调度、情报分类、来源保护及采集状态机测试继续运行。

真实 MySQL 5.7 只读预检使用原 SQL、绑定 Date 和 3 秒查询上限。早期按租户扫描所有事件的方案触及查询上限，已改用现有词条唯一索引和主题事件索引；最终执行计划加 20 个候选读取耗时 28ms，未写入生产数据。发布后需核对新任务、原终态不变、同范围和目标相同、无重复补采，再单独验证实际采集与整链结果。未据代码测试宣称日百品验收完成。
