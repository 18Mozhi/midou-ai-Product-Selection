# 主品必须匹配查询的商品类型

## 真实误选与范围

2026-10-20 08:28北京时间只读追溯当前工作区opportunity b118cb56-ce5a-4177-8098-f94da63bb4d0：原情报为Driving test waits fall to two-year low - but still average 20 weeks，原查询car cover for learner drivers。实际候选包含11条车罩和1条Student Driver Magnet for Car 2 Pack, Large Reflective 10x3.4 in。旧主品选中磁贴65bd119c-ca7d-47ae-8a81-4049795e97cc，理由只有Student Driver对应learner driver。现有记录来源链真实，但这一相关性分类错误。

本次只明确既有selectPrimary标题相关性指令：先确认查询要求的实物类型、必需物理功能和设备兼容，再在真实候选内选择；共同人群、主题或品牌不能把其他类型变成同类商品。普通车罩适用于学车者，不必在标题里重复learner/student词。全是磁贴时返回原有source_ref:null，不能硬选最接近候选。

不改查询生成、不新增品牌/类目黑名单、不预测需求增量或推荐采购。分类仍是模型判断，不能保证任意未来输入都准确；需继续观察真实新主品。旧主品、证据、评分、任务和完成事件不删除、不改写、不重放。本次不是重新将旧机会替换成车罩。

## 调用链与运行合同

生产者为OpenAiIntelligenceProductClassifier.selectPrimary，输出仍为{source_ref,rationale}、source_ref可为null且非空值必须来自真实候选。消费者MySqlTrendProjectionWorker.prepareIntelligence原流程保留：无匹配不创建机会；真实选择才进入TrendProjectionPersistence，保留原情报证据关联及主品详情/竞品/1688三项下游。

API、持久化格式、数据库、依赖、队列、容量、模型地址/名称/超时/重试、前端及Python不变；无需新增设置或修改.env。更改服务端提示需既定deploy-baota.py上传并由宝塔重启Node项目ai选品；不可通过浏览器配置。原供应商报价与整链完成标准不变。

## 验证证据

08:29真实后端模型仅分类对照：从同组织/工作区真实任务证据链接读取原12条非广告候选，旧提示仍选磁贴；修正提示选31b7637d-097d-4634-bfd5-4a1f5b629ede真实车罩。首次试验错误地把缺learner措辞当成不匹配，返回null；随后明确通用品的人群词规则，未改模型或数据。

08:30:32最终三组实际模型分类全部通过：原12候选选择车罩；仅保留实际磁贴候选返回null；仅保留实际11车罩仍选择车罩。三个场景中的子集是只读模型验证，不是历史查询的新采集结果。未写数据库、领取任务或发布机会，不计入完成量。

worker定向构建和21项原情报/主品单元回归先通过，覆盖真实引用与空选择、无匹配不投影、失败重试、完整情报/主品/三项下游和来源/广告/范围保护。随后123项情报、投影、竞品和货源相关回归、22工作区完整构建、格式及文档地图门通过。正式发布回执后续补充；日100整链目标未完成。

## 正式回执

代码39af9cd13fcdd003d496337c273d00be56868354已通过固定本地发布脚本，终态deployed、退出0、临时包删除；宝塔Node重启完成。08:34:44独立回读BUILD_SHA一致，intelligence-product-association.js SHA256=9678c59008a4f1e974a747761bd930238a9e4a9602e3385fadfd33d340f394c8，与本地构建一致。

此次直接使用已部署原分类器、不注入替代提示，重复原12候选、仅实际磁贴、仅实际车罩三组只读模型检查，3/3通过。不是重新采集或自然新商品验收；没有数据库写入。08:34:54调度快照running、suspected_stuck_runs=0、最近collection/trend轮询无错误；本次未要求取消重启前的业务租约。08:34:51今日完成仍1/100、活动积压1000，旧磁贴商品和旧任务保持历史。

另08:33:51当天尝试只读汇总：本工作区competitor_snapshot共115次、succeeded101次、平均48.1秒；Amazon找品44次、succeeded40次、平均49.5秒；竞品发现15次、succeeded9次；1688找货17次均succeeded、平均12.2秒。这些是按started_at落在北京时间当天、已有finished_at的尝试，重试和主品详情可能同属快照类，不能当作去重商品数量或持续吞吐SLA。采集等待、积压和可信货源仍需继续处理。

本轮未创建临时脚本、浏览器标签或本地服务；新文档是永久交付。沿用既有受忽略发布归属清单，未改用户verification/state.json；无需用户设置。后续自然新主品的完整相关性与日完成数量仍待验证，总目标保持未完成。
