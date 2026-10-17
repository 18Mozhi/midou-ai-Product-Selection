# 商品任务重试的页面证据版本

2026-10-18，生产竞品任务在主品身份修复后仍报 validation_failed。独立真实模型诊断可以分类全部 20 个候选；随后对同任务公开页面的只读重采确认：20 个商品都命中原 task_id + external_id 去重键，但全部原始页面字节和观察时间已变化。EvidencePersistence 正确拒绝用变化内容覆盖旧证据，执行器因此在分类前返回冲突。

版本化商品来源的去重键改为 task_id、external_id、parser_version、原始内容 SHA256 的联合摘要。相同任务、商品、解析版本和字节仍幂等；页面变化或解析版本变化产生新证据，并通过原 record_key、record_version、supersedes_record_id 流程形成不可变版本。不同任务仍不能共用任务证据。

仅影响既有 VERSIONED_PRODUCT_SOURCES：Amazon、1688、DHgate、Made-in-China、EC21。普通 RSS 及 Google Trends 的现有身份规则不变。保留 evidence_dedupe_conflict 校验，不删除、改写或回填旧键和旧证据；旧任务下一次合法重试首次使用新键可能新增一次相同页面证据，不重复计算整链产出。每任务仍受原采集条数和最多四次尝试约束。

没有数据库结构、API 字段、环境变量、依赖或权限变化。更新 Feature Map 和对应身份测试；相关采集、证据持久化、分类、评分与完成门共同验证。正式部署后通过宝塔重启唯一 Node 项目 ai选品，使 Worker 加载新的内部去重规则。前端、Python 及外部服务协议无需调整。
