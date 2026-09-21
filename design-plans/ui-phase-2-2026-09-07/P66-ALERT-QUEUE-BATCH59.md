# P66 队列与告警组合 · 批次59

起点main/6025c198、617项在途变化，索引为空。批58有代码修正及验证实质进展，本批继续P66队列/告警；未将自动继续或此前局部批准扩展为整页通过，全73页目标保持。

## 依据与实际改动

AGENTS→Feature Map runtimeTopology→总纲M08-01/P66规格→实际RuntimeTopologyService、Worker队列注册表、WorkerPollers对象转换器、调度器汇总公式与Vue。第19个automatic_selection_evaluation已在Worker登记，但Vue缺少中文名，列表与告警会显示泛化“后台任务”。新增“自动质量评估”，沿用Worker已有对象说明；未知队列回退仍保留。生产仅此一处显示映射变化。

baseline-ui技能用于C稿的控件区分和一致性：原关联链接/纯文字使用相同暖色标签，C专用CSS将纯文字关联改为浅灰标签，链接改为白底蓝色下划线、至少44px点击区，悬停浅蓝、键盘蓝色焦点；原生RouterLink/details继续复用，不增加业务弹窗或自制键盘机制。warning/critical左侧语义标记保留，不重算严重度。没有改生产布局或CSS。

## 本地29组样例及边界

复用批58的当前领域与服务执行器，为其增加可选验证样例参数，默认18组逐项与批58正式manifest比较完全相同。新`topology-alert-fixtures.mjs`转译当前WorkerPollers，调用真实normalizeQueueRunObservation，再把观测输入当前RuntimeTopologyService。仓储、监督器、Worker和健康摘要均为内存替身；实际服务read的recordView被捕获为本地记录，不调用Worker执行器、SQL、探针、生产权限或审计。

- 空闲19策略、背压、最近失败、疑似卡死、熔断、状态写入失败（有/无具体错误）。背压仅关联due队列；最近失败只关联一分钟内last_failed_at。
- 六类对象：collection_task、business_task、opportunity、trend_topic、report_export、automation_execution。当前Worker转换器仅为前三种生成链接，后三种保持null；显示名称和目标来自实际转换器，不发明地址或把无链接对象变成按钮。
- 业务结果恰好60,000ms、超过1ms、未来时间；waiting_evidence/waiting_profit、无稳定错误码、无精确对象；无效类型、空ID、外部href与第五项按当前服务过滤/截取规则处理。只验证现有过滤，不宣称进行了完整安全审计。
- 重启次数4/5的当前默认阈值；等待未老化、已老化、增益耗尽仍等待、delay为0、运行中五种显示条件；八类告警同时存在时仍保持当前服务的stale结论和独立计数。

背压与失败率样例的汇总依据当前调度器公式保持一致，组合告警分配给不同队列。老化边界是明确注入的展示输入，不是实际调度器运行轨迹；本批不证明真实并发、延迟、熔断恢复、稳定性或容量。固定时间/编号与错误码均为本地测试数据，不代表当前生产事实。

## 验证与图册

新增测试先确认第19名称缺失，修正后6项通过；原58项相关测试通过，共64项。默认18服务输出与批58逐字段一致；C转换器仍保留当前生产script。前端类型/生产构建与253资源预算通过，无依赖安装。

`verify-topology-alert-queue.mjs`使用实际App、1440/390×减少/正常动效。最终每组580检查/29本地GET，共2320检查/116GET；默认页304检查/16GET回归通过，总2624浏览器检查/132GET。最初验证器在按钮变名后仍用旧可访问名称定位，已改为同一稳定控件读取；链接使用真实Shift+Tab，并有界等待计算出的最终焦点样式，不用固定睡眠或修改DOM伪造焦点。

逐项核对告警标题、服务原提示、warning/critical、关联队列、对象数量/原href、根因代码、完整对象ID、原生Enter展开/收起；无对象不生成链接。19队列全部能显示名称与完整技术名；全部/异常切换仅本地操作。队列状态顺序、原饥饿公式与状态文件披露/默认错误文案保持；悬停/焦点及44px链接命中检查通过。各组均执行字体、双帧、局部文字/控件视口边界和中心命中检查，无截图模式也验证，不以小截图代替真实布局检查。

正式`output/playwright/p66-alert-queue-r1`共148PNG/173来源指纹。每端74图：29摘要、24告警详情、6关联焦点、空闲区域、末项策略、10队列组合、3状态文件异常。减少动效组出图，正常动效同样验证。入口index.html；manifest记录当前服务输出/内存查看记录与所有来源、图像SHA。历史批58及更早图不重绑源码。

本次仅提请审核手机object-collection-association-focus图：告警说明、队列标签、对象链接及蓝色焦点排列。未点击业务链接，不代表真实跳转、鉴权、完整读屏、其他告警、整页或生产验收；之前待审不自动通过。

## 使用与闭环

```powershell
node --test tests/unit/topology-alert-fixtures.test.mjs tests/unit/topology-state-fixtures.test.mjs
node scripts/verify-topology-alert-queue.mjs
node scripts/verify-topology-page-preview.mjs
```

原刷新读取运行事实；全部策略按钮切换原本地筛选；Enter展开技术详情，Shift+Tab可返回前面的对象链接。无参验证不写文件；`--capture-review rN`只生成新目录，不覆盖既有图。

同步计划、审核索引、P66规格、README、Feature Map及运维说明。未改API/字段/环境变量/依赖/数据库/权限/业务规则/超时/重试/离页策略，OpenAPI、后端/Worker/Python消费者无需改；无独立后端重启要求，未部署、迁移、访问生产或真实剪贴板。

本批未创建需清理的临时文件，图册/驱动/测试为永久交付，项目已有构建输出保留。验证服务与浏览器finally关闭，收尾复核。前批`output/playwright/p65-read-states-r1`和`output/playwright/p65-table-controls-r1`仍因工具策略不能清理，未绕过。

既有API覆盖断言223/256与当前225/258不一致，两输入与HEAD未变，处理决定仍缺；不重复同一失败，不暂存或提交，commit hash不适用。P66完整保活/主题密度/读屏与真实环境验收、其他页面实施及全73页交付继续。

收尾：148图与173来源SHA全部匹配，默认18服务结果与批58逐字段相同；相对批58只有RuntimeTopologyCenter一个生产源变化。Feature Map同时更正“due=false等于空闲”的旧概括，明确仍可能执行中，未改变规则。格式/JSON解析/相关diff检查通过；7个验证端口和相关浏览器/Node进程无残留。索引为空，621项在途变化保留未暂存，两处前批受阻临时目录仍存在。
