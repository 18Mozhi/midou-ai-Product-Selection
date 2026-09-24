# B3b · 运行拓扑与Redis/MySQL/文件韧性合同复核

2026-09-11 共享复制增量：TechnicalDetails 的哈希行已更新为当前实现；其余历史描述不扩大为最新验收。复制拒绝现有就地反馈、重试和迟到结果隔离，见 [共享复制反馈复核](TECHNICAL-COPY-FEEDBACK-REVIEW.md)。无 API、权限或复制内容调整。

## 2026-09-09 P69设计补充 · FILES-C-r1（未实施）

[图册](design/files-direction-c/README.md)与verify-ui-phase2-files-c交66场景138PNG。RS-G05源隔离复现三根access/statfs失败占位、索引仍保留、temp固定零、证据优先占满名额不读导出、无效路径/缺失/不一致及真实SHA256对内存流。service未知10000与负比例/used归零、evaluator最高水位不求和、零样本仍ready、恢复过期warning/取整未来年龄/空证据、固定公网false与暴露finding并存明确呈现。两根/零根、共享/备用、verified空年龄与长值标明评估或布局边界，不伪称正常探针输出。

五组源检查覆盖Vue真实脚本读取与空ID、service向probe传signal、仓储惰性三插入提交/回滚释放、真实route handler惰性授权顺序/14秒race/依赖503/finish；八相关历史hash保持。不代表实文件/SQL/权限/审计、流或SQL真实即时取消、恢复或生产验证。三请求ID披露及模拟复制拒绝、progress与双端断点/缩放属于原型证据；RS-G05生产表达/第三根验证、RS-G06保活及真实事务取消、RS-G07共享复制/主题密度仍未关闭。固定标记不替代ACL/Nginx alias/符号链接或公网探测；不改旧manifest两根或冒充新增生产证据。本稿待审，无清理/下载/恢复动作，不部署/重启；下一P70。

## 2026-09-09 P68设计补充 · MYSQL-C-r1（未实施）

[图册](design/mysql-direction-c/README.md)与verify-ui-phase2-mysql-c交70场景145PNG。RS-G04用真实probe/evaluator/service惰性输入复现最小一分钟与无历史uptime分母、累计下降归0、零requests回退10000、资源未知10000占位、恢复固定15/240/90及运行policy二次判断。最近20条/同备份full与binlog副本条件、缺失/未隔离、未来年龄归0、90.001天显示取整90但stale、null中间数值判定与返回null、负恢复值仍可能ready分别保留并标明。探针实际返回available=true或抛错；available=false只是评估器边界样例，不伪称失败回退。

五组源隔离检查覆盖Vue读取与空ID、service取消检查、仓储惰性提交/审计失败及中途取消回滚、真实route handler的认证顺序/14秒race abort/依赖503/finish清理；不代表实际SQL即时中止、事务、权限、审计或恢复验证。七个相关历史hash保持，不改表刷证。三技术详情及模拟复制拒绝、双端断点与缩放已验；RS-G04生产表达迁入、RS-G06保活与真实取消、RS-G07共享复制/主题密度仍待关闭。具体稿待审核，不改SQL/配置/数据库，不部署/迁移/恢复/重启；下一P69。

## 2026-09-09 P67设计补充 · REDIS-C-r1（未实施）

[图册](design/redis-direction-c/README.md)与verify-ui-phase2-redis-c交61场景126PNG。RS-G03用实际采样器隔离复现：partial全部MEMORY失败与空分组、sampled测量0字节、128键/32轮/16并发、去重/分类/脱敏及成功字节分母；新稿区分无样本、未知、零分母和截断。实际probe/evaluator/service复现五INFO/五CONFIG GET、AOF重写回退、占位0与10000比例、总体运行policy和局部80%不一致；不更改阈值或恢复规则。资源条按各自finding而非总state变色。Vue脚本单飞/15秒/null/清快照/空请求ID、仓储三插入惰性提交/回滚与静态route/server分别验证，不作为真Redis/MySQL/RBAC证据。

三个请求技术消费者各自展开、模拟复制及拒绝反馈有图；recovering仅UI枚举不发起恢复。七个相关旧hash保持，未改表刷证。everysec、网络监听与演练没有当前GET证据，源loading/AOF/RDB和累计拒绝/淘汰仍原判定。RS-G03生产表达迁入和RS-G06共享复制/保活未关闭；本稿待审，不部署、不清缓存/键、不恢复、不重启。下一P68。

## 2026-09-09 P66设计补充 · TOPOLOGY-C-r1（未实施）

[图册](design/topology-direction-c/README.md)与永久verify-ui-phase2-topology-c复验器交付81场景181PNG。实际evaluator/service验证预期节点过滤、90秒边界、API未来心跳仍ready而Worker未来快照stale、ready可并存监督器blocker/严重重启告警、八类告警、业务一分钟/等待排除/先取前四再校验、重启首条/下降增量0与重置标记。健康仓库汇总函数惰性执行验证零样本null、包含失败和超时的分位数；源码Vue验证单飞/15秒/401403清快照/其他保留与卸载abort，提取原队列筛选和老化逻辑。仓库SQL和路由guard只静态绑定，不声明实库事务或权限服务器通过。

RS-G01/02已有源隔离与新稿表达：19队列不截断、running非due明确运行中、实际api_*阻断码、无样本和时间观测明细，不改源业务判门。三TechnicalDetails消费者各自展开/模拟复制与拒绝反馈；generic异常仍使用旧请求ID的源问题已复现，新稿把模拟失败ID与旧快照分开。RS-G06真实保活/共享组件与服务取消链未关闭。旧B3b相关9个source hash逐一保持；下文旧“未选择”及“待正式图”为当时事实，不覆盖用户已选择C的最新状态。本稿待审、未部署、未执行恢复/重启/迁移，P67–P69本轮未改。

起点main/ea91a57，工作树干净；覆盖P66–P69四页及实际共享TechnicalDetails。事实规格完成不等于正式图/新风格、全量行为或生产通过；未选择F00 A/B/C。全局baseline/actions/dialogs/coverage和历史图保持原来源，不只修改hash冒充重新采证。

## 1. 页面范围与动作边界

| 页面 | 入口/读取接口（客户端省略/api/v1） | 实际交互与没有的能力 |
| --- | --- | --- |
| [P66](page-specs/P66.md) | RuntimeTopologyCenter；GET /platform/operations/topology | 刷新/重试/登录、队列全部切换、进程/策略/告警/阻断披露和有效关联链接；无重启/回滚/配置执行 |
| [P67](page-specs/P67.md) | RedisResilienceCenter；GET /platform/operations/redis | 刷新/重试/登录、技术披露/复制；无清键/启停/恢复表单 |
| [P68](page-specs/P68.md) | MySqlResilienceCenter；GET /platform/operations/mysql | 刷新/重试/登录、技术披露/复制；无SQL/迁移/参数修改 |
| [P69](page-specs/P69.md) | FileResilienceCenter；GET /platform/operations/files | 刷新/重试/登录、技术披露/复制和三类只读容量条；无文件路径/下载/删除/恢复入口 |

四页route-catalog均platform_admin/preserve，路由能力列operate/superadmin；API都认证会话并authorize platform:operate、private/no-store，不能用超管可见推断普通账号允许。页面无业务写按钮仍不等于服务零写入：四GET都写查看/平台审计；P66还写进程观测，另三页写对应韧性观测。

## 2. 真实生产者与消费者

### P66：节点、连续探针、队列与重启不是一个状态

mysql-runtime-topology-repository取节点及24小时最多600条历史；service读取监督器、Worker和健康摘要，返回预期node ID。授权read在事务中写查看/审计并按五分钟桶upsert当前API/Worker累计计数；窗口无读取时没有承诺每桶有样本。service在历史后加当前样本，排序、同进程差值，首次/计数下降为0并标reset；Vue横轴样本序号等距，各曲线独立最大值。

health-probe摘要按配置窗口取每端点全部结果，包括失败/超时的耗时排序取分位；零样本latency为null、availability为0约定，不是实测不可用0%。进程内探测不证明事件循环已经停止时仍可观测。当前Node门、Worker新鲜度、监督器blocker和alert要分开呈现；service可在node state ready时追加监督器blocker，不应从主标题独立推定全链健康。

队列由真实worker-queue-registry定义19种；原Vue在“全部”和“运行异常”两种模式均slice(0,18)，本批只移除该展示截断。筛选条件、顺序、优先级/老化、重试/熔断及Worker源码不改。业务关联仅最近一分钟带error_code且非waiting_evidence/waiting_profit的结果；service白名单类型、有界字符串和本地路径校验不等于任意猜目标，缺失时不得生成关联。

### P67：运行策略、当前观测与采样

server创建独立短连接，inspectRedisResilience读取PING、INFO五类及CONFIG GET appendonly/save/maxmemory/maxmemory-policy/maxclients；异常返回blocked占位、零资源与unknown，非“实测0故障”。evaluate检查可用/加载、AOF/RDB状态、资源上限、noeviction、拒绝与淘汰以及运行policy阈值；没有恢复记录、appendfsync或bind/protected-mode输入。现有Feature Map truthBoundary是更广运维目标，不能拿这个GET替代全部证明；本批添加局部合同边界，不擅自扩展API或删除历史证据。

SCAN最多128键/32轮、COUNT32，MEMORY USAGE每批16；仅按四用途和三资源类别聚合，成功测量总字节为占比分母。失败计数>0为partial，即使全部失败；无命令/SCAN失败为unavailable。UI仅特判两unavailable_reason，partial空列表走“无可归类键”，需后续有控复现。每次GET的观测/查看/审计在事务中；没有请求AbortSignal链。

### P68：窗口近似、累计和恢复

mysql probe通过SHOW读取全局变量/计数与主从状态，statfs数据盘；慢查询差值用max(1分钟,前次观测间隔)，无历史用uptime；缓冲命中为累计reads/requests，0请求时默认100%。不是每条SQL采样或当前延迟。恢复查询最近20条备份/演练与该备份资产；probe固定15/240/90判断，evaluator再用运行policy，DTO显示真实RPO/RTO/null。不修改两层业务规则。

MySQL和File路由授权后默认14秒竞争超时，浏览器15秒；signal在service及repository事务检查，File还传probe/哈希流，MySQL probe不接signal。正在执行的SQL不能因此声称立即停止；成功审计提交取消边界需真实隔离验证，非一条前端用例能证明。

### P69：文件系统水位不等于目录体积

probe用statfs blocks/bavail/bsize和可读写检查取三根所在文件系统水位；used_bytes是total-available，indexed_bytes独立SQL汇总；temp索引/活动数为0。无容量时百分比10000为失败占位，不能声称实测磁盘已满。证据按updated_at/id最近项优先占用全部抽样名额，剩余才取有效导出，不是均匀或随机全资产校验。

恢复从最近20条备份/演练及evidence/export recovery_copy判加密/隔离证据；过期在File为warning、MySQL为blocked，不能擅自统一。DTOpublic_access=false/共享关闭是固定边界，probe仅检查目录包含关系，不等于实时全Nginx alias与ACL扫描。容量条本批增加kind派生名称及percent派生aria-valuetext，value/max和判门不变。

## 3. 共享交互与状态合同

四页各3处TechnicalDetails：已有快照刷新失败、首次错误、成功页脚；共12个调用位置。仅传requestId，空ID无rows不显示。原生details/summary+clipboard不是业务模态，没有字段、草稿、提交或焦点圈定需求；共享copy无catch，1500ms标签timer无unmount清理，本批不扩大修改公共组件。

四页15秒单飞、seq忽略迟到、失败保留/401403清除；MySQL/Redis/File null→empty，P66期待结构化data。顶部disabled+aria-busy，局部提示live。仅mounted/unmount，preserve的deactivate/activate完整行为待测；不能声称已覆盖返页新鲜度、所有API取消和请求ID归属。recovering是三韧性页前端枚举，不证明这些页发起了恢复作业。

## 4. 交付与仍需关闭的验收项

本批永久用例UI2-RS69证明旧容量条无名称（red），新增名称/百分比后定向及文件模块通过；UI2-RS66证明19项返回只渲染18（red），移除展示截断后按定向/模块复验。完整结果及临时材料状态见PROGRESS，未将历史生产verified更新为本轮通过。

| 缺口 | 状态 / 范围 | 关闭证据 |
| --- | --- | --- |
| RS-G01 | P66的18项截断本批修复；未知队列名回退、running非due的空闲辅助语、blocker实际码/标签仍待核对 | 19项和异常模式不丢项；其余分别受控复现并保留真实规则 |
| RS-G02 | P66重启等距图、观测桶空缺、节点门与监督器blocker、探测零样本未全验 | 单调/重置/无记录/失联/阻断并存的事实和新图一致 |
| RS-G03 | P67每秒持久化目标与实测、partial全失败、80%局部提示与policy差异待验/必要决定 | 不把无观测写成正常或无键；高影响契约扩展需明确依据 |
| RS-G04 | P68慢查询分母最小一分钟、零requests命中回退、两层恢复策略与null边界待验 | 时间和累计语义、RPO/RTO未知不升级，不改阈值凑绿 |
| RS-G05 | P69容量条本批修复；同盘重复/根失败10000占位/样本倾斜/恢复过期与公网边界待验 | 名称和值已验；其余有界夹具及必要真实隔离证据 |
| RS-G06 | 四页preserve返页/迟到响应/身份清除/请求ID及API取消边界未全验 | 同路由离开返回、并发错误、超时与审计真实事务分开测 |
| RS-G07 | 共享复制失败/键盘/焦点、三主题/密度/缩放/读屏未全验 | 12调用方及适用样式/辅助技术验证，不能用截图代替 |
| RS-G08 | 四页全新正式图、版本意见、真实角色与生产、第三文件根证据未交 | F00获审后正式图→Vue→用户意见；固定宝塔和同提交生产证据 |

除两个已复现UI问题外，上表不是全部已确诊缺陷，也不默认授权业务/数据/安全变更；本批不做Redis/MySQL故障注入、恢复、清理业务文件或修改调度。

## 5. 精确源码候选及实际语义

候选由现有scanSource读取最终LF源码；四局部23项（11+4+4+4），共享2项，共25项，均为control。签名+序号不等于业务动作ID；循环实例、同义重试与共享调用方另按语义记录。五文件没有v-model、业务表单或模态定义/调用；progress为阅读指标，不在控件候选中，P69三种kind及名称/值由永久回归覆盖。

### apps/web/src/components/RuntimeTopologyCenter.vue

| candidateId | 行 | 类型 | 语义与副作用 |
| --- | --- | --- | --- |
| apps/web/src/components/RuntimeTopologyCenter.vue#99e387027e98dda9.1 | 373 | control | RT66-LOAD：初读/顶部刷新，单飞GET |
| apps/web/src/components/RuntimeTopologyCenter.vue#21c66441891be768.1 | 389 | control | RT66-RETRY：已有快照刷新失败重试 |
| apps/web/src/components/RuntimeTopologyCenter.vue#5587941412d5210f.1 | 410 | control | RT66-LOGIN：expired才显示，/login跳转 |
| apps/web/src/components/RuntimeTopologyCenter.vue#6a87ca890e2cd293.1 | 411 | control | RT66-RETRY：首次错误重试，含forbidden |
| apps/web/src/components/RuntimeTopologyCenter.vue#dac6cbc2991374ba.1 | 520 | control | RT66-PROCESS：last_failure原生披露 |
| apps/web/src/components/RuntimeTopologyCenter.vue#1c45c779df2fcc7f.1 | 630 | control | RT66-QUEUES：只改本地showAllQueues |
| apps/web/src/components/RuntimeTopologyCenter.vue#e41c915a9e93bf55.1 | 727 | control | RT66-POLICY：每个已显示队列原生披露 |
| apps/web/src/components/RuntimeTopologyCenter.vue#fcf7c9f746bc706b.1 | 739 | control | RT66-SNAPSHOT：发布失败计数非零才出现 |
| apps/web/src/components/RuntimeTopologyCenter.vue#d9de878e4de4767e.1 | 804 | control | RT66-OBJECT：仅真实object.href跳转，目标重新授权 |
| apps/web/src/components/RuntimeTopologyCenter.vue#1c008f867673db60.1 | 812 | control | RT66-ALERT：告警码/根因/业务ID原生披露 |
| apps/web/src/components/RuntimeTopologyCenter.vue#1c008f867673db60.2 | 836 | control | RT66-BLOCKER：阻断code原生披露 |

### apps/web/src/components/RedisResilienceCenter.vue

| candidateId | 行 | 类型 | 语义与副作用 |
| --- | --- | --- | --- |
| apps/web/src/components/RedisResilienceCenter.vue#99e387027e98dda9.1 | 192 | control | RD67-LOAD：顶部单飞GET |
| apps/web/src/components/RedisResilienceCenter.vue#21c66441891be768.1 | 207 | control | RD67-RETRY：刷新失败重试 |
| apps/web/src/components/RedisResilienceCenter.vue#5587941412d5210f.1 | 233 | control | RD67-LOGIN：expired登录 |
| apps/web/src/components/RedisResilienceCenter.vue#6a87ca890e2cd293.1 | 234 | control | RD67-RETRY：首次错误重试 |

### apps/web/src/components/MySqlResilienceCenter.vue

| candidateId | 行 | 类型 | 语义与副作用 |
| --- | --- | --- | --- |
| apps/web/src/components/MySqlResilienceCenter.vue#99e387027e98dda9.1 | 169 | control | MY68-LOAD：顶部单飞GET |
| apps/web/src/components/MySqlResilienceCenter.vue#21c66441891be768.1 | 184 | control | MY68-RETRY：刷新失败重试 |
| apps/web/src/components/MySqlResilienceCenter.vue#5587941412d5210f.1 | 210 | control | MY68-LOGIN：expired登录 |
| apps/web/src/components/MySqlResilienceCenter.vue#6a87ca890e2cd293.1 | 211 | control | MY68-RETRY：首次错误重试 |

### apps/web/src/components/FileResilienceCenter.vue

| candidateId | 行 | 类型 | 语义与副作用 |
| --- | --- | --- | --- |
| apps/web/src/components/FileResilienceCenter.vue#cdc9d1538d58eb3c.1 | 155 | control | FL69-LOAD：顶部单飞GET |
| apps/web/src/components/FileResilienceCenter.vue#21c66441891be768.1 | 170 | control | FL69-RETRY：刷新失败重试 |
| apps/web/src/components/FileResilienceCenter.vue#5587941412d5210f.1 | 196 | control | FL69-LOGIN：expired登录 |
| apps/web/src/components/FileResilienceCenter.vue#6a87ca890e2cd293.1 | 197 | control | FL69-RETRY：首次错误重试 |

### apps/web/src/components/TechnicalDetails.vue

| candidateId | 行 | 类型 | 语义与副作用 |
| --- | --- | --- | --- |
| apps/web/src/components/TechnicalDetails.vue#b3ffca8eb967d682.1 | 36 | control | 共享TECH：rows非空才有原生details |
| apps/web/src/components/TechnicalDetails.vue#c19091da9e2471f1.1 | 43 | control | 共享COPY：clipboard.writeText，成功标签1500ms |

## 6. 历史源码指纹（LF SHA-256）

以下29个文件以LF归一SHA256绑定本批所引用的实现；大模块文件指纹用于定位版本，不表示对其无关业务做完整审计。共享源不变的旧图仍保留原证据类型；不得仅更新旧图hash冒充重采。

| 文件 | LF SHA256 |
| --- | --- |
| apps/web/src/components/RuntimeTopologyCenter.vue | 457ff21b3b62967c1cf4b0d19c4eab3aa83d9d1308a9cf9b6b7ef2dfab2a4f79 |
| apps/web/src/components/RedisResilienceCenter.vue | 75744285930910ebf412bd8a9587a7889bfa1892439b5be8405891a589bce04d |
| apps/web/src/components/MySqlResilienceCenter.vue | 8467519fd4f24d53034dc92dbc5073590b128b29ffa678428463440b77e59ffa |
| apps/web/src/components/FileResilienceCenter.vue | e539f017ca23e53283979f2cf44a8d0a1f6a8822eb9088601e645f7111b27ee2 |
| apps/web/src/components/TechnicalDetails.vue | 4e2443f3f7f901c3d1cf14243523956e8705bbd39aed8e0a19d54063220fe82d |
| apps/api/src/runtime-topology-service.ts | 4a88e08069419e093c514fbe05b1a2b9c1966ca505910130780823a8db5fb172 |
| apps/api/src/mysql-runtime-topology-repository.ts | 8df495e05636d11ddaa4994813952a584a675e1b309fced24131ca073d8d5960 |
| apps/api/src/runtime-topology-routes.ts | 850d8148baab86f20bad5bff10f5bec4b85f7f3802560c3adb9be7d94aae2de6 |
| apps/api/src/mysql-runtime-health-probe-repository.ts | 067cf155fe160716f191a313f94414d47a4d62ad6a47d35864c1dfe3fa9915bf |
| apps/api/src/redis-resilience-service.ts | cfbd9e26b30637414dd900c4eb1149c4b55e111121d218d922e63202ee78ef39 |
| apps/api/src/redis-resilience-routes.ts | 7dcbf01de9cc67e254a07203da6c448bc49a113a43b9d52581956656258d911e |
| apps/api/src/mysql-redis-resilience-repository.ts | 93790e3999678d11a9425a58bebe15100a83e0bad0f730193838f2d301006fda |
| apps/api/src/mysql-resilience-service.ts | f7c5fb9870ca09c3bd4ad22bdf517e9ede3a3e2b0f77ab74d209f0fc66451a7c |
| apps/api/src/mysql-resilience-probe.ts | ade3544b9857f85b92aa0ee3a1d606ee950c64578dc55dc2223501c21336f2be |
| apps/api/src/mysql-resilience-routes.ts | 357476406cc658c7ebbd3dc2f9ab799556a571cdea2bc55dc9f7c96298aa5d6e |
| apps/api/src/mysql-resilience-repository.ts | 8cde0c182946f9d5d663da1adab21fa932ee33f1b7bfdfc4d460965cd8de02e5 |
| apps/api/src/file-resilience-service.ts | 94f63ef5eda5120b21f84de6abd36dbc214da1bced483f03c82e7bb172d23986 |
| apps/api/src/file-resilience-probe.ts | 3a0c13b768c77e732190da86f8fddb7b59511891149051f0e8ed061d8c1ef7dd |
| apps/api/src/file-resilience-routes.ts | b99b4e7934369b5ab8d22802a0f18e4d71b66e8570b588027a918c4ab970aa6c |
| apps/api/src/file-resilience-repository.ts | 12b943df959c7d007cec3f1f9133cdbd4de612764e27fecfc33e3c0d706c6860 |
| packages/redis/src/index.ts | 60a7c14a0569859cefb9b17517c1c898e60b5441e2706ab021447cf38b6be6fc |
| packages/database/src/index.ts | 6054d36018ac3fc3e4ac063434a9564211aca03f61c61e14c918da496ee4c0ab |
| packages/storage/src/index.ts | 9ba760de22833c37a6a8a8249db7a94dc4e5f548689652e87d90b65e04ab4734 |
| packages/runtime-topology/src/index.ts | 94944692b23ecb16c8bf962badc5ae6f0c435169d84c2ea7254e4b7475d7c78b |
| apps/api/src/server.ts | 1bd6af66a766dd867bbb8aeac6ea3ec34b796858c6e9a59cd5133a4793869d81 |
| apps/worker/src/worker-queue-registry.ts | 90a2453f389d0af58e34ebede80e4cbbbe324191ae435e1efb64757b96d74faf |
| apps/worker/src/worker-pollers.ts | 82700434efc37713da4b1342bcb8e675fe84334bac9bafd4483c390fdd6ed2b1 |
| tests/e2e/m08-01-single-server.spec.ts | ddc02d16bd45a1c13a76ba9b12448afa3bc29536f613e9b5f869589f2383e874 |
| tests/e2e/m08-04-file-resilience.spec.ts | 9fe7bef0ae8630bd19d13af3244a4587addd068d3bf9f4867c85a288c896af1a |

## 7. P66 服务拓扑当前源码归属（2026-09-24）

当前 `RuntimeTopologyCenter.vue` 共16个静态候选：原第5节8个仍可识别的候选在此刷新到精确行号/类型，3个旧签名继续保留为未找到，补齐另外8个当前位置。页内四个锚点只定位本页区段；刷新/重试读取服务拓扑，队列和错误披露只展开本地事实；重启观测摘要可展开记录，但不发起重启。登录入口与其他错误重读分支保持区分。具体生产状态和单机能力仍以原合同及服务端事实为准。

| 当前位置键 | candidate sig | 类型 / 行 | 当前语义 |
| --- | --- | --- | --- |
| apps/web/src/components/RuntimeTopologyCenter.vue:416 | 58a7337b2cdfab3b.1 | control / 416 | RT66-CURRENT-LOAD 页头刷新运行事实；保留焦点的aria-disabled/busy状态 |
| apps/web/src/components/RuntimeTopologyCenter.vue:433 | ba9adc29c8482881.1 | control / 433 | RT66-CURRENT-NAV 锚点跳至节点与进程区段 |
| apps/web/src/components/RuntimeTopologyCenter.vue:433 | e9f9ec4727623c2c.1 | control / 433 | RT66-CURRENT-NAV 锚点跳至健康探测区段 |
| apps/web/src/components/RuntimeTopologyCenter.vue:434 | 937f81b359ccaf21.1 | control / 434 | RT66-CURRENT-NAV 锚点跳至队列调度区段 |
| apps/web/src/components/RuntimeTopologyCenter.vue:434 | 276f8658e371a562.1 | control / 434 | RT66-CURRENT-NAV 锚点跳至告警与阻断区段 |
| apps/web/src/components/RuntimeTopologyCenter.vue:488 | a93553a3ba9aa8a6.1 | control / 488 | RT66-CURRENT-RETRY 有快照刷新失败提示中的重新核验 |
| apps/web/src/components/RuntimeTopologyCenter.vue:520 | 5587941412d5210f.1 | control / 520 | RT66-CURRENT-LOGIN 仅expired状态导航到登录 |
| apps/web/src/components/RuntimeTopologyCenter.vue:521 | d45ddc5db7a2701f.1 | control / 521 | RT66-CURRENT-RETRY expired以外列举错误状态中的重新核验 |
| apps/web/src/components/RuntimeTopologyCenter.vue:645 | dac6cbc2991374ba.1 | control / 645 | RT66-CURRENT-PROCESS 展开进程最近失败文本 |
| apps/web/src/components/RuntimeTopologyCenter.vue:654 | cc99c7c8b16ccff2.1 | control / 654 | RT66-CURRENT-RESTART 展开Node API/Worker重启观测摘要 |
| apps/web/src/components/RuntimeTopologyCenter.vue:789 | 1c45c779df2fcc7f.1 | control / 789 | RT66-CURRENT-QUEUES 切换仅运行/异常与全部队列本地视图 |
| apps/web/src/components/RuntimeTopologyCenter.vue:890 | e41c915a9e93bf55.1 | control / 890 | RT66-CURRENT-POLICY 展开单个队列调度参数 |
| apps/web/src/components/RuntimeTopologyCenter.vue:903 | fcf7c9f746bc706b.1 | control / 903 | RT66-CURRENT-SNAPSHOT 有发布失败计数时披露状态文件错误 |
| apps/web/src/components/RuntimeTopologyCenter.vue:944 | d9de878e4de4767e.1 | control / 944 | RT66-CURRENT-OBJECT 仅对返回真实href的关联对象导航 |
| apps/web/src/components/RuntimeTopologyCenter.vue:952 | 1c008f867673db60.1 | control / 952 | RT66-CURRENT-ALERT 展开告警码、根因及关联业务ID |
| apps/web/src/components/RuntimeTopologyCenter.vue:975 | 1c008f867673db60.2 | control / 975 | RT66-CURRENT-BLOCKER 展开阻断项技术码 |

| 当前源文件 | 当前LF SHA-256 |
| --- | --- |
| apps/web/src/components/RuntimeTopologyCenter.vue | d3f1ba56a9d303e2c40d09fb8c07caaaddf80bb4d4207f69185539aae61125dd |

当前位置/类型/指纹只证明静态归属；不替代运行时焦点、服务拓扑GET、权限、进程采样、新建重启或真实宝塔验收。
