# 自动评估首次入队按商品复核

2026-10-19T20:12:54Z，业务账号只读SHOW FULL PROCESSLIST确认原INSERT IGNORE INTO automatic_selection_evaluations处于Sending data、已运行17秒。原Worker每个processOnce在claim/model/evaluate之前都等待该批量INSERT SELECT。以相同原条件执行只读候选SELECT，在诊断3秒上限下3004ms超时；当时新候选为空。相同完整主品存在性证明改为EXISTS并固定现有索引后345ms返回0，证明空批次也会被原历史身份排序/连接拖慢，而不是必须增加AI节点或放松证据门。

## 实现

移除Worker中的全局批量INSERT SELECT，调用独立admission模块。先普通一致性SELECT完整满足原条件的最多100个候选，不持行锁；LIMIT仍在完整资格证明之后，不能先取100个无主品商品而永久挡住后续合格者。每个候选再用商品主键、原组织和工作区，以及原pending、非archived/deleted和完整存在性证明，原子INSERT IGNORE入队。主品证明或原商品资格在两阶段间不再成立时不插入；并发已入队则由原唯一键忽略，不重置状态、次数、历史结果或租约。

存在性证明来自共享selectionCandidateExistsSql，与原scalar非空在相同ASIN格式与URL证明下等价，原链接/证据、租户、当前版本、ASIN、canonical URL和Amazon Provider条件逐字保留；只固定n_primary到已有idx_normalized_evidence、n_primary_current到已有uq_normalized_scope_record_version，并使用STRAIGHT_JOIN。初始行仍queued、attempt_count=0、同一个now写available_at/created_at/updated_at；字段与全局资格范围不变，没有新增活动租户、规则或其他业务筛选。旧跳过/分类器恢复的顺序和逻辑、后续领取、模型预算、完成标准、重试及租约不变。

每商品是独立原子插入，不把跨商品批次包在长事务中；若后续插入失败，已成功的新队列行保留，下次按原去重继续。没有改写产品、费用或完成事件，也没有手工重放已有终态。

## 只读验证

当前编译模块实际SELECT在20:14:49Z以380ms返回0。三个真实同范围机会比较原scalar与新indexed EXISTS，结果分别1/1、0/0、1/1，包括原完整RC商品、Router Cooling Fan及AirTag记录，没有将原不合格者提升。原子点INSERT仅做EXPLAIN而未执行：opportunities为PRIMARY const/1行，链接uq_opportunity_evidence/ref，seed证据idx_normalized_evidence/ref及current版本uq_normalized_scope_record_version/ref各估计1行；目标表在EXPLAIN中显示并不代表执行插入。无临时表、迁移、锁设置、隔离级别或数据库写入。

最小26项检查通过，覆盖完整证明还原、完整资格先于LIMIT、两阶段原子范围、空批次不写、跨范围逐键绑定、并发/失效候选不覆盖和读取失败。旧Worker入口断言同步为SELECT候选，恢复边界保留。更广泛回归、正式构建和发布结果另行记录。

## 运维与边界

无新增环境变量、配置、依赖、API字段、表结构或索引。前端/API、Python和插件仍消费原队列及原结果，不需要变更；Feature Map/总纲同步内部实现。仅固定deploy-baota.py本地构建上传、由宝塔重启既有Node后加载，不新增生产服务，无用户调节项。3秒上限仅为诊断，不新增生产超时。

本轮探针只读、未调用AI或写队列，未创建临时文件/目录、截图、测试服务或浏览器会话。保留用户verification/state.json原修改。实际自然入队和评估吞吐、每日100及全站UI仍需独立验收；候选读取变快本身不计新增完整商品。

完整定向回归102项通过，覆盖自动评分/货源事实、人工作价保护、缺价预检、分类器/旧跳过恢复及严格完整事件写入。OpenAPI仅同步内部入队策略，未新增API字段。

完整22工作区构建、格式、运行文档及OpenAPI语法门通过；当前修改没有数据库迁移、环境默认或API消费方变更。构建产物为项目既有输出，不作为临时测试文件删除。发布前工作区仅本次任务文件和预存verification/state.json；仅精确暂存本次文件。
