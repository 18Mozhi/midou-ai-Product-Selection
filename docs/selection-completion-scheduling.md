# 已发现商品的后续链路调度

## 真实问题

2026-10-18 06:08 北京时间，生产有 300 多个高优先级情报商品搜索，主品详情、竞品搜索和找货任务位于其后。持续新增的搜索会让已选择商品的后续采集长期等待。补采入队不能替代整链完成。

## 顺序与边界

保留显式 critical / high / normal / low 顺序及已有全量情报摄取优先规则；只调整同档、非摄取任务的顺序：

- 常规领取优先现有 Worker 自动产生的主品/竞品详情、竞品发现、1688 找货，之后仍按 available_at、id 排序。
- 每个存活 Worker 进程每 20 次已提交的领取后，第 21 次恢复同档原 FIFO 顺序；随后恢复后续链路优先。空队列、竞争失败和回滚不推进该计数。进程重启时计数重置；不新增持久化计数或全局配置。
- 不是无条件提升所有写有 projection_type 的任务。必须有同任务、组织、工作区的 Worker 调度事件，事件类型、子查询目标和 Amazon / 1688 来源必须对应；不信任 request_id 前缀或调用方标记。
- 完成通道的三组对应关系为 competitor.collection.auto_scheduled / competitor_snapshot / amazon_product，competitor.discovery.auto_scheduled / opportunity_competitors / amazon_product，以及 sourcing.collection.auto_scheduled / sourcing_search / 1688_search。

入队和领取共用同一进程轮次及排序，避免两个入口相互抵消。排序只选候选、不加行锁；随后按主键、组织、工作区锁定并重新核验状态、就绪时间或尝试次数。竞争丢失时退出，不覆盖其他 Worker。原单机、来源、Redis 租约和过期租约恢复继续保留，不抢占运行中任务，不改变并发、超时、四次尝试和退避规则。

## 验证与运维

tests/unit/collection-completion-scheduling.test.mjs 覆盖两阶段锁定、丢失候选、单机租约、回滚、20 次后 FIFO 轮次、两个入口一致及定向任务限制；原情报摄取公平性、状态机和来源隔离回归保留。

真实 MySQL 5.7 使用原排序 SQL、绑定 Date、只读事务和 3 秒查询上限：后续链路优先选择了真实 competitor_snapshot，耗时含执行计划 20ms；FIFO 选择更早的 intelligence_product_discovery，9ms。既有调度、任务事件、子查询及来源主键索引生效，无新增索引或生产数据修改。该结果证明排序差异，不代表竞品质量或整链验收。

无新增 API 字段、数据库迁移、事件格式、依赖、前端或 Python 变化。OpenAPI 仅补充既有任务优先级含义；config/env.example 保持原轮询及租约值，说明内部公平轮次。20 次上限不新增用户设置项。已有全局积压预算仍使用 AUTOMATIC_SOURCE_QUEUE_BACKLOG_LIMIT。

正式发布通过既有宝塔脚本重建运行包并重启唯一 Node 项目 ai选品，无额外服务。发布后检查新领取是否包含先前等待的详情、竞品和找货，同时核对 FIFO 轮次、单机租约及真实结果；不能把已入队或已领取当成商品完成，更不能跳过 5–10 个相关竞品、评分及货源验收。
