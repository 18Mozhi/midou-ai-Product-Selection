# 任务记录页紧凑页头

成员任务页仍叠加多轮蓝色大横幅、渐变、阴影、136px最低高度及28–42px标题，与本轮商务数据界面方向不符。本项将列表、我的任务和详情统一为白底细边框页头，18px标题、紧凑间距、44px返回操作；手机不再将返回按钮扩成独立整行。

删除两个任务CSS中的40个旧页头选择器分支、34条独立规则，共用规则只移除页头分支。task-workspace.css导入唯一components/task-page-header.css；保留用于显示详情页头的结构性:not(.task-title)选择器，避免误删导致标题隐藏。删除TaskWorkspace的英文kicker和空span，详情h2改为任务详情，列表与我的任务名称沿用现有值。

Vue解析确认scriptSetup字节与改前HEAD相同，未改API、请求、权限、读写生命周期、任务字段、组织审批、批量或历史记录。sourceHashes、dependencyHashes和实际行号按当前源同步；历史截图与审批结论不改。新回归截图使用compact-task-header-detail-20261017名称，不覆盖此前版本PNG。

真实Vue回归新增页头高度不超过88px、白底无背景图、18px标题、无横向溢出和返回控件至少44px断言，覆盖两个列表入口的空/非空状态与详情，两种视口。HTTP为既有隔离fixture，不证明生产数据、真实百品或全站UI验收。

无新增环境变量、依赖、API或数据库结构，环境示例、OpenAPI、Node与Python合同无对应变更。仅发布前端静态包并刷新生效，孤立此项不需Node/Python重启；当前未部署，正式发布仍需按明确批准版本执行。

验证记录：10项定向浏览器检查通过；扩大关闭截图更新，桌面56/56、手机56/56共112项通过。10项相关Node检查、前端typecheck/build（Vite15.03秒）、格式709生产文件、静态496文件、包体199资源、73路由/153文档、运行文档、发布矩阵和本地部署预检通过。预检的production_deployed是旧模块记录，不代表本项部署。P13/P23/P24深比较确认只更新TaskWorkspace的源与依赖哈希，审批元数据均保留。

两张compact-task-header-detail-20261017 PNG为永久回归基线，保留；原有PNG不改。本轮测试服务4117/5187已随测试退出。原verification/state.json哈希保持29ab3761860d03f2a90dc356b4511d6054f66ad856feae165330d07b96c50c2c，不提交。

自动审批拒绝已核对路径的递归清理，返回blocked by policy且无更细原因，未换方法重试。保留以下临时目录，不进入Git或部署包：

- C:/Users/23136/AppData/Local/Temp/scoutops-task-header-baseline-20261017
- C:/Users/23136/AppData/Local/Temp/scoutops-task-header-final-20261017

目录存放浏览器测试运行记录及分页附件。后续清理需允许删除上述明确路径；当前无需要停止的测试服务。
