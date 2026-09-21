# P66 服务拓扑实际 Vue C 组合 · 批次54

起点 main/6025c198、594项在途变化、索引为空。本批承接完整73页重设计，只推进P66审核组合与可验证实现基础，不把继续指令当作图片批准或生产验收。

## 依据与改动

依次读取AGENTS、Feature Map、P66规格及总纲M08-01，追到 `/platform-admin/topology` → RuntimeTopologyCenter → `GET /platform/operations/topology`、RuntimeTopologyService和Worker队列注册表。真实接口需要platform:operate，读取仍产生查看审计；本地拦截不等于真实后端零写入。

按 ui-skills-root 选择 frontend-design，并使用 playwright 技能验证实际Vue。旧图稿的蓝色上下文/白色证据方向转入审核插件：四段原生锚点对应节点、健康、队列、告警，节点身份显示完整构建SHA；进程观测与健康端点分区，移除审核中的重启折线图，以服务返回的时间、累计、增量和重置记录代替。运行关系明确标注为配置合同，不冒充网络连通性实测。页面状态、告警、阻断项、端点窗口分别展示，不互相推导。

仅审核模板/CSS显示层发生变化。原组件script字节等值，保留刷新、筛选、原生details、业务对象href及数据合同。无样本时不显示实测0%可用率；执行中但非due的队列不再描述为空闲。十九注册策略逐一展开核对完整队列名和超时字段。生产Vue、共享外壳和生产CSS未修改。

新增 `scripts/lib/topology-page-preview.mjs`、`topology-review-fixtures.mjs`、`scripts/verify-topology-page-preview.mjs`、`tests/unit/topology-page-preview.test.mjs` 和审核 `implementation/topology-page-preview.css`。没有新增依赖、API、配置、数据库、权限或离页规则。

## 样例与验证边界

原E2E的node/base由AST抽取，十九策略由当前注册表的policy函数和常量抽取；导航使用既有样例。没有执行服务、真实Worker、SQL或健康请求。原样例只返回两队列，但due_count为2、逐项due只有1；当前Worker累计1与较晚趋势累计3也原样保留，不补造或重算汇总。无样本、全策略空闲展示、十九项due是明确的本地展示变体，不证明真实调度结果。

- 最小模板/脚本/样例合同7项通过；扩大至现有M08-01单机运行合同共20项通过。
- 实际App：1440/390 × 减少/正常动效，304项检查、16个本地拓扑GET，无外部请求、写入、下载或页面异常。原生锚点焦点、完整SHA、进程失败详情、重启两次观测、三端点P95、无样本文字、业务对象href、十九策略展开及筛选均有断言。
- 每张区域截图前等待字体与双帧，检查可见字段/按钮/summary/code的视口边界及中心命中；不出图与正常动效也执行。手机单列和目录两列、页面无横向溢出通过。
- 无新增业务弹窗检查排除了既有外壳中命名为“工作台导航”的role=dialog元素；不宣称此次修复或验收全外壳可访问性。
- 验证器无参数不输出文件。`node scripts/verify-topology-page-preview.mjs --capture-review rN` 只创建尚不存在的版本目录，不覆盖旧图。

## 图册与审核

正式目录为 `output/playwright/p66-metric-display-r1`，沿用验证器当前目录前缀，内容实际为P66整体组合而非仅指标。16PNG/168来源指纹：每宽8图，分别为默认整页、节点身份、进程失败、重启观测、健康有样本、告警关联、健康无样本、末项策略。PNG捕获减少动效组，另一动效组同样验证；index.html是完整入口。

本批展示手机重启观测记录，提请仅审核该区域的时间、状态、累计/新增/重置排列和蓝色焦点。未答复保持待审，不扩大为整页、真实重启/健康或生产通过。旧离线181图仍是历史稿，不等于本批已覆盖181种实际Vue状态。

## 收尾与剩余事项

审核图、验证器及永久测试是交付物，不删除。本批未创建验证专用临时文件，Vite和浏览器已按finally关闭并须收尾复核；无常驻服务交接。前批 `output/playwright/p65-read-states-r1` 和 `output/playwright/p65-table-controls-r1` 的临时截图清理仍被工具策略阻止，未绕过、未删除。

本次不涉及生产运行合同，OpenAPI/env/部署说明无须变更；Feature Map仅同步审核进度。生产代码未变化，不重复既有类型/构建预算验证，不部署、不重启。既有HEAD API覆盖225路径/258操作与旧223/256断言不一致仍待决定，输入未变，不重复失败、不暂存提交；commit hash不适用。

P66加载/错误/权限/追踪归属、焦点及保活生命周期、全部阻断码和完整状态矩阵、真实鉴权审计/运行证据以及整页批准尚未完成；P62/P64离页决定保持待定。完整73页实施与生产验收目标继续，不以本批局部通过替代完成。

收尾复核：16张PNG与168来源SHA全部相符；相对上一批图册，所有已登记apps生产源文件无漂移。五个新增实现/测试文件Prettier检查通过，Feature Map解析和diff空白检查通过。四个本轮测试端口及关联Node/Playwright进程均无残留，索引仍为空；两个前批受阻临时目录仍存在。
