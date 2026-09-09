# P14 热点趋势：逐项审核与实施边界

基线 `7b331ccc`。C方向已选，具体稿仍待审。本轮补齐实际源入口与既有图的对应关系，不追加重复图片，不修改生产界面。

## 看图与审核顺序

[全部146张图及交互稿](design/trend-direction-c/README.md) · [桌面详情](design/trend-direction-c/1440-detail.png) · [手机主题](design/trend-direction-c/390-topics.png) · [手机规则表单](design/trend-direction-c/390-rule-open.png) / [滚动下部](design/trend-direction-c/390-rule-open-lower.png) · [逐项JSON](action-reviews/P14.json)

按主题列表/详情 → 筛选/来源/历史 → 监控规则 → 异常/相关性 → 合并拆分/确认驳回审核。146图=68场景双端136主图+10张同一长弹窗滚动下部，不是146个页面或弹窗。本轮目检桌面详情与手机规则下部两张，未重采图，也不将两张目检扩大成全图验收。

## 源码覆盖与页面行为

实际六组件：TrendDashboard、TrendFilterPanel、TrendDetailPanel、TrendEvidenceTimeline、TrendRuleDialog、TrendChangeQueue。65个局部候选归51组：42个页面动作组、9个转发/定义组。18个v-model和五个受控筛选字段分开登记；时间线来源v-model没有旧按钮候选，不能为填数量捏造actionId。

| 工作面 | 必须保留的实际含义 | 待审呈现与验收点 |
| --- | --- | --- |
| 三模式 | topics/rules/governance同一路由，治理需trend:manage；父传组织/工作区，reset_on_scope | C稿单一阅读焦点与蓝色模式目录不是完整NavigationShell替代品 |
| 筛选 | 市场仅全部/US；四状态、四排序；q/category不由客户端trim；草稿立即进入reactive | 应用才同步URL，但排序草稿立即改变当前页；关闭抽屉不回滚草稿 |
| 清除/复制 | 清除恢复active/impact；复制当前window.location.href，不保存服务端视图、不应用草稿 | 默认active也计入筛选数量；移动清除/复制不是submit，不自动按表单提交关闭 |
| 列表/分页 | GET page_size=20，sort不进请求，只重排当前页；选中topic写URL | 不宣称跨页全局排名；返回仅切mobileDetailOpen，不移除topic |
| 来源刷新 | 服务端明确允许trend:read，校验Origin与请求范围等于会话 | source_count表示启动受理，无自动load/轮询，不是采集完成 |
| 监控规则 | 八字段含独立language；7周期/3门槛选项，固定in_app；启停保留原周期/门槛和版本 | 不能套用P12七字段；缺下次时间不能把enabled改称已暂停 |
| 查看规则结果 | 只取include_keywords[0]作q，仍保留其他market/category/status条件 | 不是按精确rule_id查看命中结果 |
| 转机会 | /opportunities带source_topic_id/name/market/category，只预填导航 | 不走/opportunities/start、不POST，不证明目标有权或已通过质量门 |
| 证据/时间线 | 原文canonical_url在新窗口打开；来源筛选只用已有timeline_sources，切主题重置 | 无删除证据；条形保留真实数值，不用高度替代读数 |
| 治理 | merge候选限当前页/同市场语言/active/非目标；split选实际证据；提交只入队 | 另一管理员决定、版本、保留一条信号、迁移关联均需真实后端证明 |

读/写都使用现有api-client，不新增接口、字段、权限或规则。页面load并发读取列表、监控及管理者治理队列，再读详情；单个失败可能阻断主体。规则旧条目仍可能与错误面板同屏，治理没有同级状态面板。C稿的错误分区和恢复导航仍是提案。

## 弹窗、内联表单与输入

| 界面 | 源结构及字段 | 关闭/提交与差异 |
| --- | --- | --- |
| 创建监控 | 一个role=dialog div；八字段，关键词拆分trim去空但不去重；category空null | 失败留窗；取消销毁，重开US/en-US/60/1；原div无统一焦点/Escape/忙碌关闭保护 |
| 报告异常 | 一个role div；warning/critical及2–500原因 | 失败保留；201新建/200已有工单都成功；按钮只凭本实例qualityIssueIds禁用 |
| 标记无关/恢复相关 | 同一个role div的两个业务变体；status/reason.trim/expected_version | 原始证据和历史不删；源失败也关窗清原因，C稿保留尚未实现 |
| 移动筛选 | 一个ResponsiveFilterDrawer调用；760px及以下dialog、桌面group | 共享实现有初焦点/Tab/Escape/遮罩/返焦，submit.capture关层；不能把它的能力套到三个本地role div |
| 合并/拆分提议 | 一个内联form的两种态；sourceIds/signalIds/newTitle/newCategory/reason | 切模式保留草稿；expected_versions仍遍历残留sourceIds；成功父不调用resetProposal |
| 确认/驳回 | pending行中的一个内联form定义，两种态；decision.reason | beginDecision清原因；取消只清requestId；成功依赖重读，不新增确认弹窗 |

三个本地role定义展开四业务弹窗，另有共享筛选；规则调用不是第二个规则弹窗。结构扫描的6个form、3个说明aside和1个drawer共10容器，与业务弹窗数不是同一口径。42个动作组的252视觉槽尚未按selector映射，不能以146图就称每个按钮六态完成。

## 本轮实际函数复验与新增风险

复用既有buildTrendDesignData执行当前源码：八字段规则body、七周期/三来源选项、merge/split payload、四排序和机会目标；真实validateMonitoringRuleInput对BEAUTY/beauty报trend_rule_keywords_duplicate。再次确认全部status往返回active、相关性失败清空关窗，源未修。

另外直接提取当前setTab/syncFromRoute/follow函数到隔离VM，以惰性router/write替身执行：

1. 旧query含tab=rules时，setTab('topics')只移除section，syncFromRoute仍判rules。需要兼容旧深链并验证切换/结果返回；不能仅验证新section链接。
2. 对主题A发关注请求并等待，随后selected改为B；A请求成功返回followed=true后，源更新B详情及B列表，A未同步。此证据证明函数回写使用了可变selected，不证明真实数据库关注错对象，也不替代浏览器切换链。

实施验收需覆盖旧深链正规化与历史返回、请求发起对象和结果回写归属、所有忙碌关闭/切主题/失去权限的迟到结果。父scope缓存仍存在，不能因局部缺active/读代次保护就称父无组织隔离；不在本轮修改权限或生产契约。

## 验证、使用与未完成事项

新JSON的全部65候选、原合同别名、转发事件目标、源/依赖指纹、18模型/10结构/15消费者场景引用已通过定向校验。引用只证明存在与对应关系，不证明全变体视觉/真实Vue/SQL已验。最终全局报告和文档门禁结果见PROGRESS。

没有新环境变量、运行配置、依赖、API/OpenAPI、数据库或权限变更；不部署、无需重启。没有创建临时文件、浏览器或服务；JSON和本说明为永久交付，旧图保留。

请按页号/场景给出通过或修改意见。全局16页已有局部逐项清单，57页待同级核对；全部共享消费者/动态行/输入错误/主题密度/真实生命周期、具体批准及生产签收仍待完成。下一批P15及机会创建/列表入口。
