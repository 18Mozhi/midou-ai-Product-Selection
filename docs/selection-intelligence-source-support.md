# 情报关联必须保留原文支持

## 真实问题

2026-10-20 08:46只读追溯本工作区原关联事件和源记录：

- e7604a03-da7d-4c17-93ef-868ae3a8f8c3：Driving test waits fall to two-year low - but still average 20 weeks，摘要只有等待实践考试的时间。旧模型虚构“不能练车”，输出driving simulator for beginners、car cover for learner drivers等查询。
- dd8fd34e-7b93-4429-a346-7847604d828a：football rankings，摘要为梦幻橄榄球DFS攻略和球员预测。旧模型虚构购票、购周边和观赛零食的消费行为，输出NFL game day tickets、football team merchandise、game day snacks。

08:46实际旧模型重新分类均复现这些推导。原情报没有上述活动或限制，仅有人群或主题相近不足以确认需求条件。作为对照，原香水e68b93fc-1ba4-4f3a-8baa-1a2215de3500确实描述具体实物，保持direct_product；不新增品牌或类目黑名单。

## 实现和合同

associate继续输出原relation/rationale/queries，强调每条实物查询独立由原文中的具体条件支持，不为凑3条而附加推测。可用条件包括天气、明确事件和使用变化，不要求原文直接点名商品；仍是假设，不能断言销量已经增长。票务、数字服务和攻略不作为实物查询。

只改新情报指令不能覆盖旧队列，因此intelligenceProvenanceSql在完全保留原组织/工作区、active/superseded、worker关联事件及原query归属条件下，同时读取n.payload_json。prepareIntelligence通过原intelligenceInput截取title1000/summary2000，再交给selectPrimary复核原文对query的支持，最后才比较候选商品类型；无原文先返回原无匹配，不读候选或调用模型。无额外模型请求，仍用原一次主品分类。

selectPrimary新增可选内部originatingIntelligence参数；生产情报后找品路径总是从已经核验范围的源记录传入。模型只收到原title/summary，不收到情报source_ref；真实源ID留在调用方及原事件链。带源上下文时候选source_ref改用c1/c2等短编号，返回值必须精确属于本次候选集合，然后严格映射回原真实ID。原输出仍为source_ref/rationale、source_ref可null。未知别名、大小写变化、真实UUID、ASIN或情报ID均拒绝，不能模糊修补；无源上下文的既有独立调用保持原类型判断合同。

模型分类仍可能出错，不构成任意输入准确率保证。没有增加硬编码新闻黑名单，没有把旧任务直接删除/取消/重放，没有替换旧商品或完成事件。未来新情报和自然处理的旧结果分别使用原终态与事件流程。API、数据库、环境变量、依赖、前端、Python、采集容量/轮次/租约、价格/货源/评分及日完成标准不变。

## 验证

最小worker构建及单元检查通过；相关扩大回归127项通过，覆盖实际候选选择、源范围、缺原文早停、旧查询无匹配、原情报关联/下游扇出、广告排除、短引用精确映射/错引用拒绝和模型失败重试。

22工作区完整构建、格式（3个相关代码文件）、73路由/60保护/6角色及文档门通过。用户原verification/state.json的SHA256保持29ab3761860d03f2a90dc356b4511d6054f66ad856feae165330d07b96c50c2c，不暂存该文件。

08:50:38实际后端模型、无业务写入的5组分类：两条上述真实负样本为unrelated且queries=[]；真实香水对照为direct_product。另两条明确标注controlled的合成测试输入（热浪、明确要求着装的万圣节活动）均为demand_driver并给出相符实物查询；它们不是真实情报、采集成功或完成数量。

08:49原12真实车罩/磁贴候选：只有query时会选车罩；加入真实驾考源文和最终独立短指令后返回null。第一次把源复核指令与旧长类型示例拼接，模型仍覆盖源复核而错误选择，此版本未发布。随后正向iPhone实样暴露模型把源ID当候选ID及UUID抄写错误，两次均被原校验拒绝，未持久化。

08:52最终短引用正反对照：真实iPhone源文和真实1TB候选返回c1；真实football源文和真实零食候选返回null。短引用映射回真实ID由单元测试覆盖，正式已部署分类器直接复测随后补充。

## 运行与收尾

无新增配置；按固定deploy-baota.py发布并由宝塔重启Node项目ai选品。模型地址、模型名、超时、重试和非思考传输不变，浏览器不接触模型配置。临时对照脚本仅在工具内存和命令参数中执行，没有创建临时文件、浏览器标签或本地服务；新文档/测试是永久交付。正式发布与自然新商品结果待验证，日100总目标未通过。
