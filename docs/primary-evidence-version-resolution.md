# 主品证据刷新后的身份与事实读取

2026-10-18 生产真实采集恢复后，三个竞品查询虽已留存候选证据，但分类上下文报 competitor_primary_missing。原机会关联的 Amazon 搜索记录均因同一商品后续采集被 EvidencePersistence 标记 superseded；机会关联仍保留原 raw_evidence，旧身份 SQL 只认 active，导致主品身份消失。

共享 selectionPrimaryAsinSql 继续从原机会关联确定主品，允许原记录为 active 或 superseded，但必须同时存在同组织、工作区、provider、record_key、相同 ASIN 且具有合法 Amazon 商品 URL 的 active 版本。其他状态、不同商品、不同租户和没有活跃后继的记录均不能恢复身份。原始关联、历史快照和数据版本不改写，不新增数据库字段。

Worker 的主品事实、标题和图片从原关联的记录键读取同范围的 active 版本，并再次比对 ASIN。返回当前版本的 raw_evidence_id、created_at 和 payload，不能拿历史证据 ID 给新事实背书。竞品详情、分类、评分、利润和货源消费者继续使用原接口及原始来源校验。没有新增环境变量、API 字段、依赖、权限或 Python 变更。

生产只读 MySQL 5.7 预检：原先缺失的 B0G3HC7PB6、B0FHVLKH6M、B079C99FXK 均恢复原身份，并读到各自新的实际证据，单机会身份及事实查询共 4–9ms。此为查询验证，不是分类、竞品数量或整链完成验收。

API 商品列表的关联事实和详情快照也通过 packages/database 的 currentProductVersionJoinSql 读取当前版本，与 Worker 共用组织、工作区、provider、record_key、ASIN 边界。保留原证据及记录键索引，页面时间取当前记录创建时间，不把旧关联时间用于新事实。详情快照本身不改写。

SQL 内部 JSON 的 DATETIME 不再直接附加 Z：由 Node 按既有 mysql2 本地时间规则解析后再输出 UTC ISO。生产只读比较发现原方式把实际 22:38 UTC 错标为 18:38 UTC；此修复不改变 MySQL、进程或全局时区，测试包含冬夏偏移。

自动测试覆盖原身份范围、活跃后继约束、当前事实证据及时间绑定；与选品、竞品分类及供应商评分测试一起执行。运行包发布后需由宝塔重启唯一 Node 项目 ai选品，API 和 Worker 同时加载共享数据库查询。前端响应契约、来源配置及本地环境无需调整。
