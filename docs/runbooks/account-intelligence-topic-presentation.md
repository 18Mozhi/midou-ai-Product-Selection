# 账号迁移：情报主题归组

账号模式先核对登录账号、封存归属与原记录，再按持久化主题键归组和分页。共享／无明确归属的主题只允许封存主账号读取，独占主题仍由原账号读取。不能通过直接打开原 ID 绕过同一校验。

分组只用于列表。展开后可从各自原 ID 打开独立情报，包括原证据、来源链接和分页。标题相似但主题键不同的记录不做合并；筛选条件只影响展示，不修改库。账号模式不使用旧合并／拆分入口，旧历史仍保留。

账号版 Worker 扫描并领取情报时同时核对采集任务、原始证据、标准化记录和投影作业归属。新作业与归属记录同事务写入；发现已有作业时不重复生成。投影校验领取次数与有效租约，再写入同账号主题与原证据关联；既有信号优先沿用原主题，历史重复主题不合并。刷新、找货及补采保留原判定规则及阈值。没有新增配置，由正式协调发布启动新版 Worker。验证见 `tests/unit/trend-projection-worker-scheduling.test.mjs`、`tests/unit/trend-projection-account-owner.test.mjs` 与 `tests/unit/collected-product-projection.test.mjs`。

自动来源和监控规则保留原游标、间隔、来源配置和预算数值。账号模式用任务原生归属与封存归属一致的活动任务计算预算；已有的 `AUTOMATIC_SOURCE_TENANT_ACTIVE_TASK_BUDGET` 配置名不变，切换后预算按账号计算。新任务、子查询、回执和原游标必须同时提交；共享游标归到其他账号或更新不到原游标时整批拒绝。测试见 `tests/unit/automatic-source-schedule-account.test.mjs`、`tests/unit/automatic-source-fairness.test.mjs` 与 `tests/unit/trend-rule-scheduler.test.mjs`。不重跑现有任务，无新增开关或手工重启步骤。

正式库只读计数：9,809 条主题记录、6,375 个全库不同主题键、67,961 条信号。全库键数不代表迁移后的个人可见分组数。本地验证覆盖分组分页、跨账号拒绝、证据引用和历史摘要；未停机、写库或创建备份。
