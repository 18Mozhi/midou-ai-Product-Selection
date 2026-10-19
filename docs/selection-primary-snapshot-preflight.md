# 主品详情先于货源模型分类

2026-10-19T20:36:01Z，在生产8c29b8e78对Router Cooling Fan与完整RC商品分别运行只读替身探针：两者原classifySupplyTitles均读取货源并进入模型入口一次，但前者实际无主品详情，原evaluate会直接等待amazon_competitor_snapshot_missing。探针只执行SELECT，在实际模型前用哨兵停止，不调用AI、不续租/写库。说明缺详情的评估会无谓分类，然后才发现必需事实缺失。

把evaluate已有主品快照SQL原样移到automatic-selection-evidence.ts的automaticPrimarySnapshotSql，由模型预检和事务内评估共用。SQL SHA256=ea59647b7445dec0d10bf3f68fd19a9113ea59fd1ed92a23fe8b4b0cbfa22f69，与改动前实际内联表达式逐字一致，未改变最新真实详情、任务/证据血缘、当前主品ASIN、组织/工作区或状态证明。

classifySupplyTitles保留原售价、币种、标题和手机壳早退；随后按同商品/组织/工作区及解析的主品ASIN检查该快照。缺失时在任何货源读取、模型请求或续租前返回undefined。已具备快照继续原分类、60候选预算、分批和引用验证。evaluate仍在原事务内重新读取同一SQL，不能信任预检时的快照；缺失仍写原等待原因，不生成价格、评分或完成事实，也不改变其余失败策略。

## 验证

81项最小检查通过后，扩展129项自动评分/引用/租约/恢复/入队/完成门回归全部通过。新场景覆盖缺快照零模型与货源读取、有效快照继续原分类、预检后快照失效仍由事务内拒绝写入。旧模型测试补充本来就必需的主品快照模拟及其第四个绑定ASIN参数，不放宽原引用/分批/租约断言。

20:39:26Z当前编译SQL在真实MySQL只读验证5个场景：本工作区缺主品详情0行（30ms），已完整RC主品1行（3ms），不同ASIN、工作区和组织分别0行（2/2/1ms）。不创建表、不改业务记录、不调用模型；SQL层隔离证明不等于自然采集或整链完成。

## 运维与交付边界

无新增配置/环境变量、API字段、队列格式、权限、数据库或依赖。前端/API、Python及插件消费原结果不变；Feature Map、OpenAPI和总纲只同步先后顺序。通过固定deploy-baota.py构建上传，由宝塔重启既有Node加载；无用户调节项，原模型配置/超时/重试及租约值不变。

本轮探针在工具会话中执行，未创建临时文件/目录、日志、截图、浏览器或测试服务；永久回归测试保留。用户verification/state.json原修改不动、不暂存；先前清理被拒路径不重试。正式发布、真实替身复核与自然整链仍需各自回读，不能把省去无谓模型调用计作新增完整商品或日百品达标。

完整22工作区构建、格式/运行文档及OpenAPI语法检查通过。20:41:14Z主品周期恢复回读仍无新任务，活动积压1000等于原阈值，来源enabled/closed；未为验证本改动绕过容量或唤醒任务。

## 发布与真实模型边界复核

46df6acf7d61d09d6fb6045219bf64122c377189固定宝塔发布exit0，8文件归属、格式/运行文档/发布矩阵及正式22工作区重建通过，脚本临时包删除。20:45:30Z独立BUILD_SHA一致，两个模块SHA256与本地构建匹配：automatic-selection-evidence=e73af3b06f67c1324b9b3cbb838057e955d26839ca4cedfae2ee696db3cbdb84；automatic-selection-evaluation-worker=57f7278e2f34f2e527c5929665954fb2f1313c7a7ebfc94fb0dafc0f1ede5e59。快照SQL哈希仍ea59647b7445dec0d10bf3f68fd19a9113ea59fd1ed92a23fe8b4b0cbfa22f69，与原评分查询逐字相同。

同一只读替身探针：无主品详情的Router Cooling Fan现在snapshot_reads=1、supply_reads=0、model_entries=0；有完整详情的RC对照snapshot_reads=1、supply_reads=1、model_entries=1，并仍在实际模型前停止。所有SQL均由白名单拒绝非SELECT，不续租、不改写队列/价格/评分、不实际请求AI。证明本改动消除该真实缺详情样本的无效前置模型入口，同时未误挡有效对照；它是模型边界复核，不是新采集或业务完成。

20:45:32Z主品仍无新任务/快照，原失败任务未变；Amazon/1688均enabled/closed，活动积压1000仍等于原阈值，恢复需等待准入。当前工作区今日仍1/100。自然主品恢复、真实新分类与全站UI及日百品验收仍未通过。本轮无临时测试文件/目录、日志、截图、浏览器或常驻验证服务；用户原verification/state.json不暂存，先前清理拒绝路径未重试。
