# 成员任务创建入口退休

选品从持续采集、情报识别、Amazon主品与竞品分析、评分、1688找货自动推进，成员无需再新建“分析竞品/查找货源”任务才能启动。移除TaskWorkspace页头、TaskListPanel空状态的新建入口、canCreate分支、create事件及POST /tasks调用。旧create/title/description查询参数不再读取或打开编辑窗；正常状态筛选保留。

编辑窗仅从已有任务详情打开，保存时须有editing对象和task:update权限，仅PATCH原任务并保留assignee_id、expected_version及原因字段。弹窗焦点返回、错误保留草稿与显式重试、busy防重和Escape保护继续验证。空列表明确等待自动流程产生记录，不引导手工建任务。

现有任务详情、进度、评论、筛选、批量操作、删除及返回商品链接保留；组织审批与所有后台功能不在本次删除范围。历史POST /tasks API、服务端权限和数据库审计保留，不新增、删除或迁移数据，不改变任务API字段、鉴权或Python输入。没有新增环境变量或依赖，OpenAPI及环境示例无对应变更。

P13/P23旧设计预览会恢复手动创建模板，因此三个旧捕获命令在输出目录、服务或浏览器创建前明确拒绝当前源；纯历史回归使用固定16b949ff版本，不还原到产品。TaskWorkspace及TaskListPanel的实际行号、LF哈希同步至现有源码对账，原截图和审批字段不改，不把退休创建签名当作当前功能。P24保留编辑探针改为调用saveTask，不再调用已删除的create。

仅发布前端静态包并刷新生效，孤立此项不需Node/Python重启。累计重构仍须按已确认版本走宝塔部署与真实整链验收。当前未部署，每日100品真实产出尚未证明。


## 验证记录与证据边界

当前12项定向浏览器检查通过；扩大88项相关Node检查通过。前端typecheck/build通过（Vite15.10秒）；静态496文件、包体199资源、73路由/153文档、运行文档、发布矩阵及本地部署预检通过。预检中的production_deployed来自既有模块状态，不代表本次部署。

初次扩大桌面浏览器50/53通过，三项失败来自此前整体UI重构后的旧测试假设：旧全页截图含已删除的创建选品与旧导航，主题名称仍为暮砂，分页要求至少10px大圆角。已目视对比旧/当前截图，新增retired-task-create-detail-20261017两端基线，保留旧PNG；主题用当前石墨名称与根语义主色校验，白色中性面板无需随主题变背景。手机顶栏在现有窄屏样式下隐藏组织文本，仍核验绑定文本，桌面继续核验可见组织/工作区。分页保留44px触控高度与无横向溢出断言，按当前平直样式核验圆角不超过4px。未修改产品CSS或放宽截图差异阈值。

P13/P23/P24源身份仅同步现有两个组件的sourceHashes与dependencyHashes；深比较确认其余审批元数据完整保留。本轮浏览器使用隔离HTTP fixture，不代表真实采集、数据库写入或生产验收。未修改后端、Python、数据库和权限。

最终扩大回归关闭截图更新，桌面56/56、手机56/56，共112项通过，无跳过。覆盖两个列表入口的有任务/空列表旧快捷参数、详情返回商品、编辑草稿/失败重试/防重、Escape等待保护、删除、批量、分页、只读权限、组织审批/通知/选品页主题。两张带日期PNG作为永久回归交付保留，旧PNG未改。测试4117/5187服务已退出；原verification/state.json哈希保持29ab3761860d03f2a90dc356b4511d6054f66ad856feae165330d07b96c50c2c，不提交。

## 临时目录交接

已核对绝对路径后，自动审批拒绝递归清理并返回blocked by policy，未给更细原因；没有改用其他方式重试。以下五个本轮测试目录保留，不进入Git与部署包：

- C:/Users/23136/AppData/Local/Temp/scoutops-task-create-retired-20261017
- C:/Users/23136/AppData/Local/Temp/scoutops-task-create-retired-full-20261017
- C:/Users/23136/AppData/Local/Temp/scoutops-task-create-retired-baseline-20261017
- C:/Users/23136/AppData/Local/Temp/scoutops-task-create-retired-baseline2-20261017
- C:/Users/23136/AppData/Local/Temp/scoutops-task-create-retired-final-20261017

目录包含失败诊断、回归运行结果与分页截图。清理需后续允许对上述明确路径执行删除；无待停止的测试服务。项目正常构建产物与永久截图继续保留。
