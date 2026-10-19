# 主品证据补齐后的跳过评估恢复

2026-10-19T18:34:20Z，当前工作区185个有效Amazon主品候选中，63条评估为succeeded，其中59条并非跳过，4条却仍保留primary_product_missing_or_not_pending。18:35:00Z进一步核对这4条仍属于活动组织/工作区、待决策、非归档/删除且通过原有效Amazon主品资格，评估时间停在2026-10-17。现有恢复只接受旧not_rule_candidate码，遗漏当前Worker实际写入的跳过原因。

当前受影响选品为abfce94a-a180-48b7-af08-79fad9d01b6a、6bae3d78-1790-4f07-8bdb-2340de237a57、9260c584-681f-4a86-9e85-de05ad4471d3、481b82aa-ed60-4233-964c-f0d51e14a37e。只依据这4条当前状态证明缺口，不把其他历史succeeded当成未完成，也不把旧缺主品记录一律入队。

## 修复边界

原enqueueEligibleCandidates继续接收未建立评估的有效主品。旧跳过恢复独立为automatic-selection-skipped-recovery.ts：普通SELECT最多100条，按原available_at、选品ID排序；仅接受succeeded且skipped为not_rule_candidate或primary_product_missing_or_not_pending，同时重新验证匹配的活动组织/工作区、待决策状态和原selectionCandidateSql。随后按选品主键、组织、工作区原子UPDATE，重复全部资格；并发领取、状态变化或证据失效时affectedRows为0。

只将跳过评估置queued、attempt_count=0、available_at更新为当前时间并清除旧跳过结果和错误；不改租约、不重放采集、不重试真实成功/失败终态，不更改主品、证据、评分、采购价、利润、决策或完成事件。队列沿用原Worker处理与质量门：缺少后续证据仍正常等待，入队不代表整链完成。不同于分类修订恢复，此恢复不调用模型也不依赖分类器配置；仅消费当前主品资格。

读取和更新分离以避免原宽范围UPDATE在检查候选时持有不必要的源记录锁；不改变MySQL隔离级别、表结构、索引或账号。此处没有声称只读EXPLAIN模拟了并发写入。

## 验证与运维

51项Node定向回归通过，包括旧跳过恢复、模型修订恢复、原证据评分及自动选品。38项真实MySQL5.7只读派生场景同时检验候选读取和点更新WHERE，覆盖两种跳过、真实成功、未知码、6种其他队列状态、组织/工作区错配与停用、已采纳、归档/删除和主品缺失；EXPLAIN UPDATE语法有效。探针不创建表、不写入业务事实。

仅Worker内部队列修复，无新增环境变量、配置、API字段、数据库结构、依赖、权限或Python合同。前端/API/插件仍消费原状态，不需要新增字段。同步Feature Map和本运维说明；通过固定deploy-baota.py发布并宝塔重启Node加载，无用户调节项。生产自然恢复、下一阶段分析和百品目标必须分别回读，未观察前不宣称通过。
