# P66 运行结论与阻断矩阵 · 批次58

起点 main/6025c198、613项在途变化，索引为空。延续批57实质进展，不把自动继续当作视觉批准；全73页实施目标不变。

## 依据与改动

AGENTS → Feature Map runtimeTopology → 总纲M08-01/P66规格 → 当前领域评估器、RuntimeTopologyService与实际Vue。服务会返回五种节点阻断代码，原Vue只有旧runtime_node系列标签，导致这些代码落入泛化说明。本批为runtime_nodes_empty、api_node_missing、api_unavailable、api_host_identity_mismatch、api_heartbeat_stale增加准确中文标签，保留监督器标签、旧代码兼容及未知代码回退。

stale可能来自API心跳，也可能来自Worker观测缺失、停止、过期或未来时间，不统一解释为API心跳过期。标题改为“运行观测需重新核验”，说明引导分别查看阻断与告警；worker_scheduler_heartbeat_stale展示为“任务调度观测需核对”。服务提供的actionHint和技术代码原样保留。这里只改措辞，不改判定。

按baseline-ui技能沿用现有C方向、原生details及单一蓝色交互强调，不引入依赖、动画或自制键盘行为。人工看r1发现阻断标题仍继承棕色、条目左右留白不足；C专用CSS将标题改为深蓝文字并增加16px内边距，保证蓝色键盘焦点框完整位于条目内。生产CSS与布局不变。

## 当前服务生成的18组本地样例

`scripts/lib/topology-state-fixtures.mjs`直接转译执行当前领域评估器与服务类，require仅允许当前runtime-topology模块；注入固定时间、内存仓储、监督器/Worker/探测摘要，不连接数据库或真实进程。每次调用服务read均捕获一次内存recordView，不能据此宣称真实读取零写入或生产审计通过。

- API门：就绪、无API、缺失预期节点、主机身份不一致、过期心跳、starting/degraded/draining/stopped四状态，以及主机/过期/未就绪三阻断组合。
- 监督器降级：节点结论仍为ready，但另有backend_supervisor_degraded阻断，页面不得自行合并改写。
- Worker缺失、停止、过期、未来时间：均按服务返回stale，过期节点计数为0、无API阻断，单独显示Worker告警。
- API未来时间：仍按现有评估器返回ready，与Worker处理不同；本批不修订时间策略。
- 探测摘要不可用：保留节点ready与独立unavailable探测状态，不伪装全部服务健康。
- 重启计数由4降为0：按服务返回显示计数重置、本次新增0，不制造负新增值。

基线节点/监督器/健康事实来自现有E2E，Worker队列清空且汇总归零使本组输入一致；不是观测到的生产数据，也不覆盖全部健康分位、19队列、完整告警阈值、真实调度或容量资格。

## 验证与审核

新5项测试先暴露遗漏标签和旧stale措辞，修正后通过；格式化引起的测试正则误差已修正。P66、共享客户端与M08-01共58项通过。运行命令：

```powershell
node --test tests/unit/topology-page-preview.test.mjs tests/unit/topology-read-focus.test.mjs tests/unit/topology-read-regions.test.mjs tests/unit/topology-state-fixtures.test.mjs tests/unit/topology-trace-ownership.test.mjs tests/unit/frontend-api-client-boundary.test.mjs tests/m08-01/single-server-runtime.test.mjs
node scripts/verify-topology-state-matrix.mjs
node scripts/verify-topology-page-preview.mjs
npm run build:web
npm run verify:frontend-budget
```

实际Vue、1440/390×减少/正常动效均检查18组结论、4项摘要、节点/阻断/告警数量、准确标签、服务原提示、Enter展开/收起完整技术代码，局部操作不增加请求。检查字体、双帧、可见标题/文字/控件边界和中心命中；正常动效和无截图模式同样执行。首次验证器误用了不存在的健康区域类名，已按实际DOM修正，不改产品代码。

初稿1020检查通过；看图后补真实计算色与焦点框容纳断言，先在旧棕色失败，再修正C CSS。最终1116检查/72本地GET通过；默认页304检查/16GET通过，共1420浏览器检查/88GET。无页面异常、外部请求、业务写入、下载或真实剪贴板操作。生产类型/构建和253资源预算通过；随后仅修改审核CSS及其验证器，不重复生产构建。

当前正式图册为`output/playwright/p66-state-matrix-r2`：72PNG/170来源指纹，每端18结论、12阻断条目、4Worker告警、1探测不可用标题、1重启重置记录。r1同72图保留为修订前设计对照，不重绑旧manifest，不作为当前稿。manifest记录当前服务输入生成结果、内存查看记录、源码/图像SHA，不能充当真实权限或审计凭据。

本轮提请审核r2手机“主机身份不一致”阻断条目：深蓝标题、说明、左右留白、展开技术代码与蓝色焦点框。仅该区域待审，不包含完整页面、其他状态、真实权限、探针或生产。前述全部待审和已批准范围不扩大。

## 使用、未改与收尾

点击原“刷新运行事实”，按现有返回分别核对顶部结论、告警与阻断；技术详情仍可用Enter展开/收起。无参验证不写文件；加`--capture-review rN`只允许新目录，不覆盖历史图。

同步P66规格、Feature Map、计划/审核索引、README和运维说明。没有新增API/字段/环境变量/配置/权限/依赖/数据库/超时/重试/离页政策，OpenAPI和后端/Worker/Python消费者无需联动。无独立后端重启要求，本批未部署、迁移、重启或访问生产；C完整布局仍处于审核接入阶段。

本批未创建验证专用临时文件；永久测试、驱动与两版正式图册保留，既有构建产物为项目所需。验证浏览器/服务均由finally关闭，结束前复核。前批`output/playwright/p65-read-states-r1`、`output/playwright/p65-table-controls-r1`清理仍受工具策略限制，未绕过。

既有覆盖断言仍为223路径/256操作，当前OpenAPI为225/258，两输入与HEAD相同。该既有失败未获处理决定，不重复相同测试，不暂存/提交，commit hash不适用。P66完整队列/告警、保活、主题密度、完整读屏和真实验收，以及全73页交付仍未完成。

收尾复核：r2全部72图与170来源SHA匹配；r1全部72图SHA匹配，来源仅审核CSS和验证器按修订发生变化，未重绑历史证据。相对批57仅RuntimeTopologyCenter一个生产源文件变化。Feature Map解析、代码格式和相关diff空白检查通过；7个验证端口均已关闭，无相关Node验证/构建进程残留，索引为空，617项在途变化保留未暂存。两处前批临时目录仍保留，未尝试绕过清理限制。
