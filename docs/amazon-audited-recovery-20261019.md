# Amazon真实健康检查与审计恢复

2026-10-19 15:51只读核验：amazon_product运行熔断open、连续失败5、validation_failed，opened_at为00:10:09.501Z；当前工作区早先竞品详情子查询60c63ea3失败，不能把旧ready探针当作新恢复证据。自动恢复只允许network_error、timeout、rate_limited，本轮未修改该策略，也未直接更新数据库状态。

在真实登录后台“来源设置→采集程序”筛选amazon_product，仅执行一次原有健康检查。搜索运行f8e27be7-5c6a-4e21-bcb6-cfd8daba9434成功，解析48条；同一商品详情运行18897b08-46e6-41f2-bd4e-91b82a71ceb0成功，解析1条。两次运行均无错误；健康版本91、last_checked_at=2026-10-19T07:54:28.213Z、耗时51272ms，晚于原熔断。这是标准检查商品，不写入或冒充业务选品。

后台显示健康检查已通过后，使用原“前往解除暂停→采集调度”入口，只对087833fa-cc02-4a4b-98c1-b13e98301c88确认恢复。15:56:42只读回读closed、连续失败0、last_error_code=null、recovered_at=07:55:58.394Z；平台审计e7c0d6da-6105-4e99-b9cf-6be9e3565e10记录platform.crawler_scheduler.provider_recover succeeded。来源定义、条款、权限、失败历史和其他来源均未修改，没有重放旧任务、解决验证码或绕过访问限制。

15:57:42自然调度领取当前米兜默认工作区的任务fb6969dc-3b17-4867-9d71-5ffc0566c291，opportunity_competitors，对应009e1d10-2860-471c-b541-70f639795c7d、主ASIN B0DHJH2GZL。业务浏览器作业22db6a64-be40-4df5-b611-c17ac1a2bbaa在07:58:13.174Z成功，15:58:37父任务仍running、子查询pending。原始抓取成功不等于相关性分类、5–10份详细竞品、货源或整链完成，须继续按同一任务观察。

脱敏只读回执：.artifacts/selection-production-20261018/amazon-circuit-root-20261019.json、amazon-health-run-live-20261019.json、amazon-health-audited-recovery-20261019.json、amazon-recovery-natural-claim-20261019.json、amazon-recovery-live-task-fb6969dc.json。均为交付证据保留，不计为业务结果。最初时间窗口查询返回空，改为精确运行ID核验后确认两个健康运行成功；不将空窗口推断为运行记录丢失。

本轮为真实运行恢复，没有变更程序、环境、依赖、数据库结构、接口或调度参数，无需重启服务。持续运行仍由原宝塔Node与Python项目负责；每日100品及全站UI原总目标未签收。健康页面目前直接截取ISO时间显示UTC，本说明明确Z与北京时间，不能将页面07:54误认为本地07:54。

15:59:29精确回读原任务已succeeded，子查询succeeded、available_result_count=10、无错误。16:00:55当前选品分类事件913a451f-b2b4-45b5-aad5-9f308a16befc确实来自该任务：排除主品后9个独立ASIN被原规则判为substitute。当前已有9份搜索快照，其中只有3份有数值售价；主品latest_snapshot_id仍为空。这些不是9份已经验证的详情快照，仍不能签收5–10份详细竞品或整链完成。原始ASIN、当前价格/评价及分类回执见amazon-recovery-candidate-detail-gates.json。

16:01:23最终只读核验运行版本999ac62f，Amazon和1688均closed、无当前熔断错误；今日整链完成数仍0。没有启动本地临时进程，没有新建临时测试目录；脱敏回执是永久交付证据，原被拒绝清理的目录没有重试。
