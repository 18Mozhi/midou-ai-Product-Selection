# 当前重制与整链验收状态

截至北京时间2026-10-19 06:21，线上运行版本为9d6ee468d56e043b279967fa5b0344a9a19cb207，迁移身份0075_competitor_opportunity_identity.up.sql。依据实际发布、页面回执与只读运行数据；历史版本不能覆盖当前状态，代码发布也不等于整链业务验收。

| 原始要求                                                         | 当前证据与边界                                                                                                                                                                                                      | 状态                                                                                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 全部UI、样式和布局重制，主要参考Ecom168，列表参考FindNiche/QuPin | 同行已实际查看；列表、首页及找货已有重制；97c64e0e重制详情数据顺序，真实1858px评分区从y=974.75提前至474.48，390px资料整行、无页面横向溢出；cfdca3e6后台总览已真实验证1858px内容1583px、趋势/来源同排、390px两列指标 | 部分完成，缺少当前全站逐页最终签收                                                                                 |
| 精简成员功能、删除旧代码并保留选品库                             | 成员任务整页及11个运行文件已删除；独立自动化、竞品监控、手工成本等退休，保留核心导航及独立审批                                                                                                                      | 已有实施，不能据局部删除宣称旧代码全部清理                                                                         |
| 保留后台、账号、组织、来源、采集管理及运维                       | 后台保留；73路由、60受保护路由、6类角色地图通过门禁                                                                                                                                                                 | 地图数量不替代全部真实操作验收                                                                                     |
| 持续采集情报并识别商品关系                                       | 已有同工作区自然情报、Amazon商品及下游任务；工作区领取公平轮转已验证                                                                                                                                                | 新增业务候选不等于整链商品                                                                                         |
| Amazon主品及5–10个相关独立竞品，均有详情                         | 02:44只读核对主品B08826B2XL，10个独立竞品均有当前相关性证明、真实详情、价格、币种、评价数、评分和fresh/healthy状态                                                                                                  | 该样本竞争门有真实证据，不代表所有商品齐备                                                                         |
| 同一ASIN可供不同选品独立分析                                     | 59bbc39a先发布归属约束代码，58c9b134再迁移唯一键；真实手机壳选品已自动补建自己的主品和新详情任务，原记录仍保留原归属和快照                                                                                          | 独立主品详情已自然入库；该选品仍缺5–10个独立详细竞品，不能当作整链完成                                             |
| 免费取得商品、销售、评价及广告详细数据                           | 按公开证据显示价格、评价、排名、购买下限与赞助标记，缺失保持未知                                                                                                                                                    | 不能宣称精确销量、私有广告表现或全部字段齐全                                                                       |
| 沿用已有规则自动评分                                             | 同一样本真实总分72.67、覆盖80%，四个非利润维度有值，利润明确未知                                                                                                                                                    | 未知利润已获允许，但仍须其他整链证据                                                                               |
| 对接221–226图搜1688并取得真实采购价                              | 02:55:25自动健康ready并恢复closed；02:57–02:59本工作区5个自然找货任务各取得60条候选；02:57:55独立池探测由223节点实际响应证明至少一个可用节点                                                                        | 此前采集成功；06:15自然健康仍rate_limited、degraded/open，当前未恢复。手机壳已核对具体原报价，其余候选不能当采购价 |
| 每日100个完整商品，含低分、不推荐及明确利润未知                  | 按工作区主品ASIN首次完成事件及北京时间日去重；利润未知允许，但其他质量门不放宽                                                                                                                                      | 06:21:22米兜今日完成0，未达标                                                                                      |
| 自动、不间断运行                                                 | 宝塔固定项目、既有自动健康恢复、原租约/重试/熔断和工作区轮转继续运行；7fbbbc68核心投影优先级88已在真实进程生效                                                                                                      | 进程存活、单次恢复及局部成功不证明持续整链                                                                         |

## 当前实际缺口

当前手机壳选品c8c10134-36cc-43c2-b0a8-aea3f40a73e6的主品B0FH4V325T，此前因工作区全局ASIN唯一键借用到另一选品的旧记录，自己没有详情。现已采用各选品独立保存方案，线上新键包含opportunity_id；Worker自然补建主品7653c3f8-5cb1-4ac1-b151-7be75446dff6及详情任务b247359f-a648-415b-8ff7-3aca99dfb4d9。05:40:15该父任务自然第二次领取成功，耗时779ms，消费同一浏览器作业fb1697e9-66eb-456b-82a1-51e5ca088bd3的原成功结果；05:41核对独立新快照5b0f199e-0746-4451-a6a2-ac2f01a418f4，captured_at保留原21:25:50.546Z，未重新采集或借用其他选品。原95b75351记录仍属于原选品，旧快照未转移。此前发布重启打断父任务消费，原租约自然恢复；e11f4ef1在优先级/工作区/通道内优先消费成功结果，FIFO逃逸与原校验不变。不能把详情入库单步算作完成。

该选品的1688记录已有60条真实候选；05:42核对已写入具体采购价CNY8.80，来自offer1084175573174、供应商长沙市壳界商贸有限公司，原报价8.8、说明运费3元，非新人价，原链接https://detail.1688.com/offer/1084175573174.html。输入source_ref=1688:1084175573174:p75:5，evidence_id=60ae7cca-1e5d-42d0-9a63-ab098504d76c，金额及币种与原规范化证据一致，不代表含运费到岸成本。主品真实详情售价USD5.38、评价21874、评分4.60、fresh/healthy。自动评估已succeeded；最新规则评分50.39、覆盖100%，五维输入齐备，利润评分0是实际评分结果，不能据此解释成利润金额为0。该选品当前只有主品记录，尚无独立竞品，整链完成证明仍为0。其他商品利润未知的许可保持原口径，不能借本样本推断其利润已知。

以下Frito-Lay记录保留为03:00时已核对的另一组样本，不能与手机壳的任务、竞品或报价拼接为一个完整商品。

机会722bd141-bb6b-4af6-a409-48b43f98199b的主品B08826B2XL是40包Frito-Lay零食组合。02:58找货记录13a8b049-7a6d-4cd4-8233-1cd7229f3f41已由自然任务529d837f-843a-4ccb-b9b3-8f906249d9eb成功取得60条候选，不能再将其未完成原因描述为来源仍停用。

03:00只读核对：60条规范化货源均有人民币数值价格，其中15条标有新人价。前部候选包含仿真食品树脂配件、慢回弹零食玩具和未证明同规格的普通零食礼包，不能直接用作40包真实品牌零食的进货价。原匹配未选中具体报价、没有采购价输入，整链完成证明为0。模型没有抛出分类错误不代表已找到同款，不放宽原类型、属性、规格和非新人价校验。

该样本四个非利润评分为market_demand98.41、competition17.59、risk85、data_quality100；profit为null，原因automatic_cost_scope_mismatch。非利润评分和利润未知已能独立成立，当前仍缺具体可信采购价证据。评分覆盖率80%不等于完成度80%，60条候选不等于60个商品。

## 本次可复核证据

以下脱敏回执位于.artifacts/selection-production-20261018，保留为交付证据，不计为业务事实：

- lan-pool-failure-current-20261019.json：20秒原预算内223实际HTTP200并通过原解析器，其余请求因首次成功取消；没有写商品或改来源状态。
- lan-pool-recovered-pending-runtime.json、source-recovery-acceptance-current-20261019.json：已有自动健康审计ready/closed，线上版本及当日完成数。
- own-sourcing-live-after-source-recovery.json：5个同工作区自然任务成功、各60条候选，不借用其他租户数据。
- own-ten-competitors-current-detail-gaps.json、own-ten-competitors-completion-gaps.json：10个竞品及真实非利润评分。
- own-ready-product-sourcing-progress.json、own-ready-supply-candidate-facts.json、own-ready-supply-classification-state.json：具体找货任务、原报价事实、未选中报价及评估终态。
- sourcing-compact-release-receipt.json、core-projection-scheduling-verification.json：实际发布、UI与调度核验；局部测试不是全站或每日百品验收。
- product-ownership-release-receipt.json、product-ownership-natural-independent-records.json、product-ownership-phone-case-detail-current-final.json：两步发布、独立归属、新主品和真实详情排队；基于身份核验，不用迁移UTC审计时间与应用本地写入时间的比较推断商品是否创建。
- competitor-opportunity-identity-mysql57-verification.json：本地隔离MySQL5.7.44业务账号、合成数据验证独立记录、并发去重、回退失败关闭及外键行为，不是生产业务验收。
- product-detail-layout-live-ui-proof.json、product-detail-live-desktop.png、product-detail-live-mobile.png、product-detail-layout-published-final-runtime.json：实际97c64e0e版本、真实桌面/手机布局、60条当前关联货源阅读与每日完成0。
- pending-browser-result-mysql57-readonly.json、pending-browser-result-global-readonly.json：42组只读合成排序与现有队列计划，不写业务数据。
- pending-browser-result-original-parser-complete-readonly.json、pending-browser-result-natural-attempt-duration.json、pending-browser-result-primary-persisted.json：原完整浏览器结果解析、自然779ms消费和独立主品新快照；早期移除artifacts的诊断不具备解析条件，不作验收依据。
- pending-browser-result-current-purchase-provenance.json、pending-browser-result-final-product-proof.json、pending-browser-result-final-rival-proof.json、pending-browser-result-final-runtime.json：原报价、完整评分、独立竞品缺口、线上版本与当日完成0。

## 继续验收与操作

继续核对自然任务的主品、5–10个有效详细竞品、非利润评分、具体1688采购价、首次完成事件及每日去重数；逐页核对实际界面与流程。不能把来源恢复、采集成功、搜索结果、候选数量或模型诊断代替整链完成，也不重置任务、强行认可不同规格货源或复制其他机会归属。

本表仅更新交接文档，不改变规则、接口、配置、数据库或服务，无需重启或重新部署。线上版本以实际健康版本接口为准；文档提交不代表运行包切换。后续代码仍按固定deploy-baota.py与宝塔项目发布。

本轮临时MySQL进程、浏览器验证服务均已停止，Chrome验证标签页已关闭、视口已复原。临时MySQL目录及浏览器验证配置/输出的删除被自动审批以blocked by policy拦截，残留精确路径见product-detail-layout-cleanup-handoff.json及previousHandoff链，未重试、绕过或再次复用。永久测试基线和脱敏回执保留为交付材料。原verification/state.json保持不变且不提交。

本轮只读SQL通过SSH标准输入执行，无服务器临时脚本；既有浏览器证据回归自建临时目录已在finally删除，并核对无scoutops-browser-evidence-*残留，未启动新验证服务。此前被拒绝清理的配置/输出仍按trend-detail-pending-cleanup-handoff.json及previousHandoff链保留，不重试或复用。当前表更新仅文档，无需重启或部署，不改变线上e11f4ef1版本。

## 06:21 本轮发布与未关闭事项

后台总览布局提交d193e638、真实HTTP权限补证cfdca3e6已发布并通过真实Chrome桌面/手机检查，原账号、组织、来源、采集和运维入口保留。选品库实际1858px显示1267条总记录中的20张商品图卡，价格、评分/评价、购买下限和缺失说明存在，无横向溢出；1267不是每日完成数。全部商品标题仍有历史“机会”用词，全站逐页最终签收尚未完成。

9d6ee468新增投影背压已发布，三个相关编译文件哈希与本地一致。未完成活动范围积压先后1040/1036/1034/1032，1034时988条为Amazon情报商品搜索，仅18条受1688熔断约束。初次热点投影和竞品发现结果投影如今在领取前遵循既有1000阈值，已完成详情/货源结果继续消费。110项回归、34项MySQL5.7 SELECT-only用例、22工作区构建和发布门通过。部署后首次只读尚无可观察的新核心投影或活动范围到期热点行，不能据此声称已证明自然暂停/恢复；更不能宣称竞品和日百品恢复。阈值不增加，既有批次/进行中任务和修复仍可能短暂超过阈值。

06:22:53手机壳仍为自己的主品详情、CNY8.80原报价采购价和50.39分、100%评分覆盖；整链完成证明仍0。利润维度评分0不是利润金额0。06:21:22今日完成0；LAN06:15:22自然健康rate_limited，degraded/open，未强制恢复。部署清理包成功，浏览器临时标签均已关闭、视口已恢复，4155/5225/4157/5227测试端口已退出。四个本地测试配置/输出清理被自动审批拒绝（blocked by policy），未重试、复用或提交；绝对路径与前轮交接链见.artifacts/selection-production-20261018/platform-boundary-http-cleanup-handoff.json及其previousHandoff。
