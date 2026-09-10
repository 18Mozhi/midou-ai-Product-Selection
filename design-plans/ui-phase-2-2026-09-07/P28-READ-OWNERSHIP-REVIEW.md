# P28 报表与导出 · 真实读取批次与详情归属

2026-09-10，main/63488ef8起点；上一批按钮图与登记是实际进展，本批继续真实交互链。只修改ReportCenter.vue的script，不将P16布局批准外推给P28，完整73路由重设计目标继续。

## 原因与修复

原loadSequence只在Promise.all之后保护报告/列表，api先写notice/requestId，旧请求和失败后的兄弟请求仍可污染新状态。syncDetailFromRoute无独立代次，关闭、打开B、同ID重开或销毁后，旧A成功可重新赋值selectedExport，旧错误可清掉当前query；load在等待详情后也会继续落state。

本次api增加可选的组件内部读取owner，不改变HTTP参数或响应。并行报告/列表共享代次和active，首错写本次诊断后立即失效，后续兄弟成功/错误不落地；后台失败仍保留已有报告。报告路径/类型变化同步失效，销毁后禁止新的列表/详情读取并忽略旧回包。报表及列表成功先落ready/empty，不再由旧详情尾部改写页面状态。

详情有独立代次、完整路径、export ID及可选父读取有效期。关闭立即增加代次，不等query导航完成；清参数、换记录、同ID重开、销毁都会让旧详情无效。列表只在启动时的详情代次/路径未变时同步详情，因此列表完成不会重开后来关闭的窗口。当前404仍清export参数并保留report/其他query和原提示，没有新错误码或自造记录窗。

真实浏览器首轮抓到修复中的一个回归：单个数组getter随query对象变化触发，即使只是export变化，也使初始列表失效并停留loading。改用两个独立watch来源，只在路径/报表类型真正变化时失效；追加源回归及双端初始深链用例。该失败不是浏览器连接故障。

## 依据与验证范围

AGENTS → Feature Map reportsExports → 产品蓝图M05-06 → ReportCenter → report-routes与现有源码图稿适配器。请求仍为原报告、导出列表与详情GET；report:read、当前会话范围、CSV/重建/Worker和文件规则均不变。

- 24项新增永久源测试：真实setup/ref/computed与同步watch，受控请求/路由/生命周期。21项初版中18项在旧源码失败、3项正常；另追加export-only初始加载和路径/报表往返三个回归。测试适配器的CommonJS exports命名冲突先修好才执行上述有效基线。
- 22项真实Vue浏览器检查：11场景×1440/390；旧类型成功/失败、首错后列表回包、详情A→B成功/失败、清参数、同ID重开、窗口关闭时后台详情、销毁列表/详情以及初始深链。直接挂载未加测试钩子的原Vue与真实router/原生dialog，只有GET响应被隔离。无真实业务写入、Cookie或持久化存储。
- 既有90整页图和208逐按钮图按当前源重新验证与绑定，数量不增加，不将图稿当真实Vue或用户批准。源码候选14处、10动作/1接线、0输入/1原生窗保持不变。
- 完整构建/门禁/全量测试与清理结果见[PROGRESS](PROGRESS.md)。源测试和浏览器脚本仅控制读取顺序，不证明数据库、Worker、真实下载字节或生产运行。

## 未改与下一项

模板/CSS/C图稿布局、createExport/regenerate/download/refresh函数本体、API/OpenAPI、权限、后端/Worker/Python、数据库/迁移、依赖、env及部署配置未改。本轮不是完整C视觉实施。

仍须完成写后回执/重复提交、跨记录重建及旧finally、下载归属、refresh finally、尚存活KeepAlive的跨范围缓存与所有并行操作共享诊断仲裁。两个仍有效的不同读操作可能按完成顺序更新共享requestId；本批只拦截已失效owner，不声称全局诊断优先级已定义。团队人数/任务范围、过期标签与服务时间判断差异不改。RP-G01–G04/F03-G05、具体审稿和生产签收仍待。

## 操作交接

运行`node --test tests/unit/ui-phase2-report-read-ownership.test.mjs`做最小检查；确认5175未占用后运行`node scripts/verify-ui-phase2-report-read-ownership.mjs`验证真实Vue。脚本仅有测试宿主和隔离响应，finally关闭浏览器/本地Vite，不生成截图、日志或临时配置文件。

无新增用户设置或参数；使用仍是报表类型切换、刷新与详情打开/关闭。当前未部署；后续通过既有`python scripts/deploy-baota.py`本地构建发布和宝塔受管重启流程上线，不新增生产服务或启动方式。临时文件/进程清理与提交信息见本批交接。
