# 搜索与快捷创建 · DISCOVERY-C-r1

状态：C方向已选，具体稿待审核；独立HTML，不是Vue实现或生产发布。

[打开交互审核稿](index.html) · [截图与源指纹](evidence.json) · [上一批共享导航](../shell-direction-c/README.md)

## 本批设计

桌面蓝色范围／筛选区与白色结果区分离；手机按关键词、对象／状态、负责人、搜索、结果的顺序排列，弹窗内滚动，关闭和通知入口保留在边缘。前端设计技能用于重排信息层级和状态布局，不更换业务规则。

29场景、双端58张主图，另补10张手机下部图，共68张。下部图明确是同一弹窗的滚动位置，不额外计算业务场景。旧导航中的未实现提示和旧图证据保持原样；新稿不代表两者已集成为真实壳层。

## 每项动作与边界

| 动作 | 本稿行为与真实合同 |
| --- | --- |
| 搜索关键词 | 2–100字符，trim后查询，短输入就地提示并返焦，不发送请求。新增可见搜索按钮是同一Enter动作的待审入口，不新增API。 |
| 对象／状态 | 四类对象分别读取真实状态枚举；不选对象禁用状态。换对象清空状态，不自动搜索。 |
| 负责人 | 仅任务和机会可用，最多120字符；task与opportunity切换保留，其他类型清空。 |
| 搜索请求 | 仅展示同合同的q、limit=10、可选resource_type/status/assignee，不带组织工作区ID；不新增分页。样例固定返回一条隔离任务，不执行搜索引擎或编造筛选结果。 |
| 结果行 | 原任务路由、待处理状态、更新时间；无补充说明，不伪造负责人或评分。 |
| 快捷创建 | 读取已授权入口，不提前创建对象；一条／两条来自UI2-DI夹具，组织／平台／全部注册入口是明确标识的能力投影，不证明当前会话权限，不新增壳层入口。 |
| 最近使用 | 当前组件内去重、最多5项；关闭再开保留，卸载后清空，不写storage。修饰键点击也更新最近列表。 |
| 普通链接／修饰键 | 记录准确目标，普通点击关闭，修饰键点击保持弹窗；审核稿统一拦截实际跳转，不能当作浏览器开新页或真实业务导航验收。 |
| 401/403/409/429/500/503 | 两种模式分别出图；保留真实覆盖按钮“重新加载／关闭”，不是把401按钮改成登录。请求／追踪编号保持可见，重新加载清空旧编号。 |
| 读取中／晚到结果 | 新查询取代旧查询，关闭／换模式使旧读取失效；本地计时模拟，不证明真实HTTP中止、API客户端重试或后端权限。 |
| 关闭 | 顶栏、状态按钮、Escape、外侧遮罩均关闭返焦；内部点击不关闭，Tab首尾循环；通知仅成员壳展示。 |
| 审核工具 | 场景选择、重新打开、模拟组件卸载仅供审核，不进入生产界面。 |

## 全部图

| 场景 | 图 |
| --- | --- |
| search-idle | [1440](1440-search-idle.png) · [390](390-search-idle.png) |
| search-invalid | [1440](1440-search-invalid.png) · [390](390-search-invalid.png) |
| search-filter-task | [1440](1440-search-filter-task.png) · [390](390-search-filter-task.png) |
| search-filter-opportunity | [1440](1440-search-filter-opportunity.png) · [390](390-search-filter-opportunity.png) |
| search-filter-evidence | [1440](1440-search-filter-evidence.png) · [390](390-search-filter-evidence.png) |
| search-filter-collection_task | [1440](1440-search-filter-collection_task.png) · [390](390-search-filter-collection_task.png) |
| search-results | [1440](1440-search-results.png) · [390](390-search-results.png) · [390 下部](390-search-results-bottom.png) |
| search-empty | [1440](1440-search-empty.png) · [390](390-search-empty.png) · [390 下部](390-search-empty-bottom.png) |
| search-loading | [1440](1440-search-loading.png) · [390](390-search-loading.png) · [390 下部](390-search-loading-bottom.png) |
| search-401 | [1440](1440-search-401.png) · [390](390-search-401.png) · [390 下部](390-search-401-bottom.png) |
| search-403 | [1440](1440-search-403.png) · [390](390-search-403.png) · [390 下部](390-search-403-bottom.png) |
| search-409 | [1440](1440-search-409.png) · [390](390-search-409.png) · [390 下部](390-search-409-bottom.png) |
| search-429 | [1440](1440-search-429.png) · [390](390-search-429.png) · [390 下部](390-search-429-bottom.png) |
| search-500 | [1440](1440-search-500.png) · [390](390-search-500.png) · [390 下部](390-search-500-bottom.png) |
| search-503 | [1440](1440-search-503.png) · [390](390-search-503.png) · [390 下部](390-search-503-bottom.png) |
| create-ready | [1440](1440-create-ready.png) · [390](390-create-ready.png) |
| create-one | [1440](1440-create-one.png) · [390](390-create-one.png) |
| create-recent | [1440](1440-create-recent.png) · [390](390-create-recent.png) |
| create-empty | [1440](1440-create-empty.png) · [390](390-create-empty.png) |
| create-loading | [1440](1440-create-loading.png) · [390](390-create-loading.png) |
| create-401 | [1440](1440-create-401.png) · [390](390-create-401.png) |
| create-403 | [1440](1440-create-403.png) · [390](390-create-403.png) |
| create-409 | [1440](1440-create-409.png) · [390](390-create-409.png) |
| create-429 | [1440](1440-create-429.png) · [390](390-create-429.png) |
| create-500 | [1440](1440-create-500.png) · [390](390-create-500.png) |
| create-503 | [1440](1440-create-503.png) · [390](390-create-503.png) |
| create-organization_admin | [1440](1440-create-organization_admin.png) · [390](390-create-organization_admin.png) |
| create-platform_admin | [1440](1440-create-platform_admin.png) · [390](390-create-platform_admin.png) |
| create-all_registered | [1440](1440-create-all_registered.png) · [390](390-create-all_registered.png) · [390 下部](390-create-all_registered-bottom.png) |

## 验证与使用

仓库根目录执行 `node scripts/verify-ui-phase2-discovery-c.mjs`：只读核对原始夹具／状态枚举与数据、源文件和PNG哈希，运行双端交互、字段顺序／尺寸、恢复与焦点检查。显式 `--capture` 才重新生成本目录永久截图及证据。复用现有Playwright与TypeScript，不新增依赖或服务；浏览器由finally关闭，HTTP与storage写入为零。

原始依据：DiscoveryOverlay、UiStatePanel、state-contract、use-modal-dialog、api-client、discovery-service/routes与UI2-DI01–06夹具；具体源指纹见evidence。组织与工作区名称为隔离样本，2026-08-07任务时间是测试数据而非当前生产事实。

未改Vue/API/OpenAPI、权限、数据库、配置、依赖、coverage和用户审批，无需生产重启。尚需用户审核具体稿、迁入真实共享壳层、真实网络／跨角色验证及部署；主题、AccountShell和其余页面仍在完整73页计划内。
