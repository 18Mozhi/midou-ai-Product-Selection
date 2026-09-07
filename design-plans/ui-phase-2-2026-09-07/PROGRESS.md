# 第二阶段实施记录

## 2026-09-07 · W00静态基线与W01审核工具

第二阶段已开始。当前完成的是源码发现、旧证据校正和可运行的审核工具；W00完整运行时盘点及W01共享产品组件设计尚未完成，W02–W09未开始，不是全阶段验收通过。

### 实际交付

- `baseline.json`：当前源码SHA、逐文件哈希、清单指纹、证据类型、扫描限制和运行时待查点。
- `actions.json`：1377个控件/事件源码候选，包含763个原生按钮。记录位置、显示条件、事件处理函数、候选路由和旧清单关联。actionId尚未人工冻结，不能算1377个业务动作通过。
- `dialogs.json`：100个弹窗定义或调用候选，其中57个原生定义；其余为共享组件和脚本触发。不是100个已验收弹窗变体。
- `coverage.json`：73条路由、每页实施方向、旧704项去向及G0–G5待验状态。真实动作/生产执行/用户通过均未擅自置为成功。
- `source-reconciliation.json`：旧“创建选品”标签绑定变更、趋势创建规则入口可见性扩展的人工源码对应；48个DEV query入口候选与6个未找到显式消费方的旧移动壳层候选分类。未删除这些源文件，也未声称已完成生产不可达验证。
- `review.html`、`review.css`、`review.js`、`review-data.js`：可直接本地打开的实施账册，支持页面/工作包/类别筛选、候选事件检索及分页、查看处理函数与条件、批注、导出意见。没有证据的页面不提供“通过”按钮。
- 旧包 `IMPLEMENTATION.md` 修正错误图片路径及证据类型；旧README与其生成器同步说明静态扫描与HTML概念图的边界。

旧704项已经建立历史源码对应：702项通过原历史版本的正则范围→Vue AST→当前源码特征匹配，2项经人工源码核实记录明确变化。部分旧正则项覆盖多个真实按钮，已保留一对多映射。这里完成的是“旧项定位”，不是704项行为或设计验收。

### 使用与复验

从仓库根目录执行，不需要安装新依赖：

```text
node scripts/build-ui-phase2-inventory.mjs
node scripts/build-ui-phase2-inventory.mjs --check
node --test tests/unit/ui-phase2-inventory.test.mjs
node scripts/verify-ui-phase2-review.mjs
node scripts/verify-ui-phase2-review.mjs --capture
npm run verify:docs
npm run format:check
```

生成器只写本目录的5个生成产物：baseline/actions/dialogs/coverage JSON和review-data.js。请勿手改生成文件；源码对应由source-reconciliation.json维护，后续业务与设计审核必须使用独立人工记录，不能把人工结论写进生成文件后期待重生成保留。`--check`只比较，不修改文件；要求本地保留旧清单提交的Git历史，不在服务器运行。

浏览器直接打开 [review.html](review.html) 即可，无须保留服务器。页面意见保存在浏览器当前来源下、按清单指纹分开的localStorage；同目录file://与HTTP打开的草稿未必互通。点击“导出审核意见”得到review-decisions.json，请用户或实施者明确归档，生成器不会导入、伪造或覆盖审核结论。不要在批注中填写凭证或客户数据。

浏览器复验器只启动绑定127.0.0.1、系统分配空闲端口的短时静态服务，允许读取4个审核台资产；finally中关闭浏览器及服务。`--capture`保留本目录review-proof中的桌面/移动审核台截图和元数据，其他测试批注、导出文件及浏览器上下文会清理。这些截图是审核工具实景，不是产品页面设计稿或生产验收图。

### 已验证及发现

定向单元测试覆盖Vue模板内比较表达式、嵌套条件、动态菜单/链接/提交、共享原因弹窗、行移动/样式变更身份稳定、重复按钮、历史正则一对多范围、类型导入、路由聚合导致的错误关联、循环依赖、畸形模板失败关闭。

审核台1440×1000与390×844浏览器检查覆盖73路由目录、工作包/无结果/内部页过滤、候选分页、批注存储/导出、HTML注入文本不执行、弹窗首焦点/循环/Escape/归还焦点、44px控件高度、页面无横向溢出与控制台错误。实际发现并修复批注弹窗反向Tab会离开内容焦点的问题。测试结果及截图最终版本以review-proof/manifest.json为准。

本批收尾结果：11项定向单元测试通过；生成产物`--check`通过，旧704项都有源码对应；两种视口浏览器验收通过且控制台错误0；文档门、仓库静态分析与格式门通过。未运行全产品构建/业务E2E或生产验收，因为本批没有修改生产源码，这些后续门仍保持待执行。浏览器导出的测试文件与隔离批注已清理，浏览器和临时静态服务已退出；工具报出的临时npm错误日志复查已不存在。保留的review-proof两张图和manifest是永久审核工具证据，不是临时测试垃圾。

### 下一步，不缩减范围

1. W00继续按路由mode和真实角色，在Vue页面运行时补全动态选项、按钮状态、弹窗变体及API调用结果；把候选位置转成稳定业务actionId/dialogId，冻结分母前不得把候选数当覆盖率。
2. W01先完成列表、详情、规则编辑、权限矩阵和异常恢复的代表设计图、按钮六态板及共享弹窗桌面/移动变体；建立一个真实产品页的设计→实现→截图→用户审核闭环。
3. 依PLAN串行推进W02–W08全部73条路由，最后W09同版本全站回归与生产证据。没有跳过组织/平台/运维页，没有把核心页局部通过视作全部完成。

本批未修改产品Vue/CSS、业务接口、权限、环境变量、数据库、依赖清单或生产服务；OpenAPI无需变更。Feature Map仅新增本地盘点/验收工具索引。无部署，无数据库迁移，无重启要求；没有创建长期服务或其他代理任务。

## 2026-09-07 · W00任务运行时证据与W01两种新结构原型

本批继续实施PLAN 1.1，尚未通过G0/G1：运行时清单仍需全站补齐，新方向仍待用户选择。W02–W09未开始正式页面改造，不把任务页研究当作73页完成。

### 可审核交付

- [新结构A/B交互原型](design/task-directions.html)：A“专注工位”采用侧边队列与详情并读；B“任务简报”采用全宽列表与独立详情。两种构图分别有1440/390的列表、详情、进度弹窗，共12张图，位于design/directions。它们是独立HTML原型，使用现有任务夹具的一条样本；不是Vue、不是生产，不包含完整动作和状态。
- [真实Vue基线/样式研究对照](design/task-review.html)：任务列表、新建弹窗、详情、更多菜单、进度/暂停/调整期限/转交/取消表单，共9场景×2视口；基线与CSS研究各18张，合计36张。基线在runtime/tasks，研究在design/tasks；界面由真实Vue事件驱动，但所有API响应来自既有E2E夹具，不证明数据库或真实授权服务。
- page-specs/P23.md和P24.md包含十项规格、真实字段与动作入口、已测和未测边界；CSS研究保留旧壳层只用于隔离变量，不代表用户批准旧布局。正式视觉规范仍待A/B或后续新方向审定。
- 审核台增加两个入口；原有批注与导出机制不变。所有草稿保持待审核，没有自动写入用户通过结论。

### 实际代码与验证

将原m05-01-business-tasks.spec.ts的setup提取到tests/e2e/helpers/business-tasks.ts供测试和采图复用，原16个用例不改变；仅补齐TaskSummary已存在的paused字段为0，避免缺字段导致NaN。没有修改生产空值逻辑、任务生命周期、接口或权限。

`scripts/capture-ui-phase2-tasks.mjs`检查源码清单哈希后启动短时Vite，分别记录图哈希、源码指纹、视口、场景、控件观察和动作请求。Vite会将port=0解释为默认端口，首次与E2E启动发生5173冲突；修复为先取得系统分配端口，再strictPort启动，若发生抢占则失败关闭，不占用未知服务。修复后桌面16项和移动16项原有任务E2E分别通过。

Vue采图每种模式验证7个语义动作×2视口：新建打开、进度打开/单次提交，以及暂停/期限/转交/取消的打开与Escape取消。四个变体检查表单首焦点、关闭、归还入口与零写入；进度请求确认action=progress、expected_version=2、progress_percent=45。四变体的最终提交、全部焦点循环、全部角色与失败状态不由此链证明。

A/B原型验证进入/返回、进度范围校验、预览反馈、Escape归还、零网络请求与页面无横向溢出；移动主动作调整到标题下并验证首屏可见。弹窗采图使用视口而非长页拼接，避免遮罩错位的视觉误判。12张原型图、36张Vue图是永久审核交付，另更新审核工具两张实景图。

新增3项证据完整性单测，检查48张图哈希/覆盖、夹具及设计文件哈希、当前清单指纹、每个变体的取消结果和证据类型；与既有11项盘点单测合计14项通过。更新计划文字后清单指纹失效已通过原生成器刷新5个产物，数量保持1377/100，旧704项源码对应不变，没有擅自冻结分母或改变审核状态。

### 使用、复验与清理

从仓库根目录执行，无需安装依赖：

```text
node scripts/build-ui-phase2-inventory.mjs
node scripts/capture-ui-phase2-tasks.mjs
node scripts/capture-ui-phase2-tasks.mjs --proposal
node --test tests/unit/ui-phase2-task-study.test.mjs tests/unit/ui-phase2-inventory.test.mjs
node scripts/verify-ui-phase2-review.mjs --capture
node scripts/build-ui-phase2-inventory.mjs --check
```

先生成基线，再执行--proposal；后者也输出A/B原型的隔离数据脚本、12张图及独立证据，不导入生产样式。默认采图与--proposal分别重写自己在本目录中的永久证据；运行前确保没有其他任务同时写同一图目录。清单指纹因计划或源码变化时先重生成，再重采并校验。runtime/tasks虽然匹配全局runtime忽略规则，具体18张图和evidence.json作为本阶段明确交付物精确纳入Git，不放开整个runtime忽略规则。

本批文档门、静态分析与代码风格门通过；未运行全产品构建、全站业务E2E或生产验收，因为生产源码未改。测试临时输出仅为系统临时目录scoutops-phase2-tasks-20260907-audit下的两份.last-run.json，收尾删除；采图、审核工具和E2E启动的浏览器/服务均退出。未改API、OpenAPI、环境变量、数据库、依赖或生产服务；Feature Map仅登记本地命令和证据边界。无迁移、部署或重启要求。

下一步：用户选定新方向前继续补W00运行时与状态/权限盘点；方向选定后完成P17规则、P31权限矩阵、P61异常恢复代表图和公共按钮六态/弹窗合同，再按W02–W09推进全范围实现。用户未回复不得视为A或B获批。

## 2026-09-07 · W00规则、权限与异常恢复代表页

新增P17评分规则、P31组织权限、P61系统状态的十项规格，追踪现有字段、动作与失败语义。正式新布局尚未获批，本批只补运行时基线，不把现有界面当新设计交付。

发现并定向修复OrganizationRolePanel错误空态：原来使用资源授权分页总数判断角色目录为空，导致有角色但无授权时显示“暂无活动角色”；现在只按roles.length判断。新增回归先在旧逻辑下失败，再在修复后通过，同时覆盖真实空目录。固定角色仍只读，授权接口、后端策略和持久化均不变。

复用三个现有E2E文件，不复制夹具。P17覆盖版本、创建表单、只读预览、提交原因、待审批、权限受限及只读空态；P31覆盖矩阵、范围、授权列表/筛选空态、创建/撤销表单及两种空态边界；P61覆盖依赖异常、刷新失败保留旧数据及成功重试。测试数据不证明真实数据库、RBAC服务或生产环境。

本批桌面42项通过；移动40项通过、2项按既有条件跳过（组织与平台超时用例仅桌面执行）。前端类型检查及构建通过，文档门、静态分析通过。采图使用测试进程环境变量SCOUTOPS_UI_PHASE2_CAPTURE=1，默认关闭，不写入任何.env或生产配置；测试结束后将截图元数据标为该用例最终状态，未完成或失败记录不能作为通过证据。

采图输出固定为runtime/representatives的P17/P31/P61桌面1440及移动390文件，后续证据提交将记录完整哈希和审核入口。先提交源码，再更新baseline和重采已有任务图，确保新证据的源码指纹与修复版本一致；当前旧证据是历史基线，不能当作修复版本证明。页面规格中“待采集”在证据验证成功后更新。

本批没有新设计上线、数据库迁移或生产重启。上线空态修复需依既有宝塔部署流程重新上传前端静态构建，不需要新增后端环境变量或重启Python；本批没有执行部署。OpenAPI无需变更，Feature Map登记空态边界和测试专用开关。

采图阶段另发现P31角色矩阵在390视口撑宽文档至814px，原功能用例没有检查该状态的横向溢出。将org-role-page网格单列约束为minmax(0, 1fr)，保留原矩阵内部横向滚动；新增常规E2E断言页面不溢出、矩阵可滚动，不依赖采图开关。采图器记录实际宽度及溢出观察而非伪造视觉通过，审核台明确区分功能用例通过和视觉验收。此项修复不批准旧布局或任何新方向，修复版本需要重新采集证据。

### 代表页证据入口与复验

[规则、权限与系统状态审核页](representative-review.html)按页面、视口、场景切换36张当前Vue图，展示场景断言、源码提交、截图和测试来源，支持原尺寸查看。P17共14张、P31共16张、P61共6张；不是36个页面，也不是36个已审核设计。元数据额外记录采图器与所有独立CSS哈希，弥补控件AST盘点只扫描Vue/TS的边界；功能用例通过和视觉验收保持独立。

生成器只接受固定36份记录，检查最终测试状态、页面路径、当前源码指纹/版本、测试文件/采图器/样式和图片哈希；失败或缺项直接退出，不会把未执行项填为通过。检查布局时记录实际documentWidth及有限元素观察；图库明确标注发现的溢出，W03/W04最终响应式门仍要求修复后复测，不能用“采集成功”代替产品质量。

完整重采前先运行node scripts/build-ui-phase2-inventory.mjs；然后在PowerShell执行以下命令（使用现有依赖，测试服务与浏览器由Playwright配置关闭）：

```powershell
$previousCapture = $env:SCOUTOPS_UI_PHASE2_CAPTURE
try {
  $env:SCOUTOPS_UI_PHASE2_CAPTURE = '1'
  $captureSpecs = @('tests/e2e/m04-03-scoring.spec.ts', 'tests/e2e/m06-01-organization-admin.spec.ts', 'tests/e2e/m06-02-platform-dashboard.spec.ts')
  $captureCases = 'score rule versions support|score rule approval controls|score rules read-only empty|organization roles expose searchable|organization resource grants validate|role catalog empty state|system status aggregates'
  npx --no-install playwright test @captureSpecs --project=desktop-chromium --grep $captureCases
  if ($LASTEXITCODE -ne 0) { throw 'Desktop capture failed' }
  npx --no-install playwright test @captureSpecs --project=mobile-390 --grep $captureCases
  if ($LASTEXITCODE -ne 0) { throw 'Mobile capture failed' }
} finally {
  $env:SCOUTOPS_UI_PHASE2_CAPTURE = $previousCapture
}
node scripts/build-ui-phase2-representative-review.mjs
node scripts/verify-ui-phase2-representatives.mjs
```

生成器的--check仅验证，不写文件；浏览器验证器不接受参数，从file://打开图库，在1440/390各切换全部36张、检查对应来源/规格链接、44px选择器、键盘顺序、无外部请求及审核台自身不横向溢出，finally关闭浏览器。新图库的“页面不溢出”结论指图库自身；产品截图有独立测量和待审状态。源码变化后旧任务证据也必须重采，再运行任务证据14项单测和主审核台验证器。

局部宽度修复后，组织模块再次桌面28项通过、移动27项通过/1项按既有超时策略跳过；前端构建、文档、静态分析和格式门通过。此前三个文件的42/40结果仅对应当时版本，未将其伪称为全站验收。本批无API、后端、权限、环境文件、依赖、数据库或生产操作变化；两项产品修改仅影响本地Vue空态显示与角色矩阵宽度。全站设计、G0分母冻结、六角色完整状态、真实后端/生产验收仍未完成。

最终证据重采基于d9427bc：代表页桌面7项、移动7项功能用例均通过，36份记录均为passed、pageOverflow=false，P31移动文档宽度已回到390px。主审核台双视口通过，新图库双视口各切换全部36张通过（控制台错误0、外部请求0），旧任务基线/样式研究/双结构原型重新采集并通过14项单测。文档与格式门通过，清单及全部代表图哈希校验通过；仍不等于用户视觉签收。

收尾删除本批唯一系统临时目录scoutops-phase2-representatives-20260907及其中23份测试输出（失败追踪/截图、error-context、.last-run），浏览器、短时Vite和E2E服务均已退出，4101/5173无监听。保留runtime/representatives的36张PNG和36份JSON、图库资产及重采的任务/审核台图片作为永久审核交付。临时产物无剩余；生产未部署，无重启要求。下一步继续W00其他路由与动态角色/状态盘点，同时等待用户选定全新布局方向；没有将A/B或任何页面自动批准。

## 2026-09-07 · W01全新结构代表方案与按钮六态

本批推进设计本身：新增P17规则、P31权限、P61异常恢复两套独立结构，不导入旧产品CSS。A为竖向导航与对象队列/详情并读；B为单层顶导航、全宽概览与独立详情。两者都取消纸色、朱砂、大序号与衬线大标题，并按具体页面重排信息和行动。当前方案不是生产Vue；W01仍待用户方向审核，没有通过G1。

### 本批交付

- [76张设计图审核页](design/representative-design-review.html)与[可点击原型](design/representative-directions.html)：19场景×2方向×2视口。P17为版本、详情、长表单三段、影响预览、提交原因和预演反馈；P31为角色概览/详情、独立授权、授权长表单两段及撤销原因；P61为异常概览/详情、刷新失败保留与读取恢复；另有一张公共按钮板场景。
- [公共按钮六态板](design/button-states.html)：主操作、次操作、危险操作、图标操作四类，每类默认/悬停/聚焦/按下/处理中/不可用。静态示意有明确标注，不能计作24个真实业务动作通过。
- [设计说明与字段依据](design/representative-directions.md)：说明两案结构差异、逐页事实顺序、来源夹具、合同边界、未覆盖状态与复验命令。
- scripts/capture-ui-phase2-representative-directions.mjs生成76张PNG、evidence.json和用于file://图库的evidence-data.js；--check只读校验数量、方向/视口/场景完整性和源/夹具/图片哈希。
- scripts/verify-ui-phase2-representative-design-review.mjs在1440/390分别切换76张图；主审核台追加新入口并重采自身两张图。

### 实际验证与边界

四组方向/视口原型检查通过：表单空值与有效数据预演、UUID/成员/动作/有效期、Escape关闭与归还焦点、提交原因弹窗Tab循环、刷新失败保留及重试后依赖仍告警；控制台错误和外部请求均为0。初次Tab测试发现焦点逃出弹窗，新增局部键盘边界后复测通过，没有改生产useModalDialog。长规则表单三段截图验证八个维度的权重/证据组/必填控件均被拍到，避免把不可见字段算作完整图。

新图库双视口各76图加载/来源对应/无溢出通过；原型76图及哈希检查通过，主审核台双视口通过，文档门通过。没有运行生产构建或全站E2E：本批没有修改apps/web/src、接口、权限、业务测试夹具或运行配置，先前有效的产品测试不重复运行。样本只选自已核实夹具，不构成真实数据库/后端权限/生产验证。没有写入localStorage或用户业务数据，没有新增依赖、环境变量、服务或部署，无重启要求。

本批所有图片、原型、脚本与说明都是永久审核交付；浏览器上下文在finally关闭，未启动HTTP/Vite/后端进程。失败采图的同名文件已由最终通过版本覆盖，没有另留临时截图、追踪或下载目录。主审核台验证的隔离批注与下载已按原脚本清理。

下一步仍是补齐W00全站运行时分母与W01完整代表闭环。用户选定方向后，统一任务代表稿及共享设计规范、补全多主题/密度/断点/所有适用状态，再进入W02–W09；不能因这76张图存在就跳过完整73路由或用户签收。

## 2026-09-07 · W01任务稿同系重构与88张原型可读性复核

接续PLAN 1.2，本批收尾此前尚未提交的任务A/B稿：task-directions.html改为直接复用representative-directions.css，移除独立旧纸色/衬线布局，保持一案队列并读、一案独立详情。没有选择用户未批准的方向，也没有把新HTML原型接入生产Vue。

核验截图发现共享字号原为11–14px，未达到计划标准；将基础正文、按钮与表单调整至16px，辅助文字至少13px，移动导航、规则字段、权限矩阵正文和依赖说明同步调整。共享CSS变化使原76张图失效，已与任务12张图全部重采；Vue基线及CSS隔离研究图不是本次全新结构图，仍分开计数。

新增scripts/lib/ui-phase2-prototype-metrics.mjs供两个现有采图脚本复用，每张图记录实际计算字号、控件尺寸、计数及违规列表；无弹窗时检查页面，有弹窗时检查当前弹窗。检查非复选框按钮/输入/选择器/文本域至少16px及44×44px、可见直接文字至少13px。裸复选框、链接热区、对比度、软键盘和屏幕阅读器不由本指标证明；完整无障碍和全状态仍待后续验收。任务原型额外验证正反Tab边界、Escape归还、预演无网络、0–100校验和移动主动作首屏可见。

复验命令：

```text
node scripts/capture-ui-phase2-tasks.mjs --proposal
node scripts/capture-ui-phase2-representative-directions.mjs
node scripts/capture-ui-phase2-representative-directions.mjs --check
node scripts/verify-ui-phase2-representative-design-review.mjs
node --test tests/unit/ui-phase2-task-study.test.mjs tests/unit/ui-phase2-inventory.test.mjs tests/unit/ui-phase2-prototype-metrics.test.mjs
npm run verify:docs
npm run verify:static-analysis
npm run format:check
```

88张原型图保持pending-user-review。76图的图库在1440/390各遍历全部场景，通过且控制台错误0、网络请求0；任务采图的既有Vue夹具14个语义案例通过。新增浏览器几何回归用例要求小字号、小热区和小正文各自失败，合法尺寸通过，隐藏小字不误报。图片哈希与当前共享CSS一致；不将局部通过推广为全站或生产通过。

没有修改apps/web/src、API/权限/数据库/.env/依赖/生产配置，OpenAPI不变，Feature Map仅同步本地证据检查边界；无需生产构建、重启或部署。新增/重采的PNG、元数据、原型、文档及回归测试都是永久交付物，无另建临时文件目录；浏览器及任务采图短时Vite由finally关闭。用户方向仍待审，下一步按R01处理全站运行时语义归并，不缩减W02–W09及73路由范围。

## 2026-09-07 · R01目录外54项语义归属与开发视图行为验证

已核对原清单的54个目录外候选：53控件/事件及1原生确认调用，48项属于8个开发query视图，6项来自暂无显式渲染消费者的OpportunityMobileShell。原source-reconciliation已有文件级分类，本批推进到[逐动作语义记录](source-scope-review.md)及[source-scope-review.json](source-scope-review.json)，保留每个candidateId、条件、事件、handler、目标链接、读写调用及源哈希；归并42个语义动作、1个原生确认调用，另5个无handler当前/禁用Tab明确为非动作占位。不删除旧组件，不伪造生产入口，不把unmappedCandidates改为0，不冻结全站业务分母。

App的DEV门在selectedView，不在解析query的requestedInternalView本身；本次复核澄清旧文件级说明。NavigationShell广泛glob仍可能打包这些组件，未声明生产bundle剔除或生产query不可达通过。独立补充文件不改原生成器/PAGES/source-reconciliation，现有任务与代表图源指纹因此不失效。

新增只读命令node scripts/verify-ui-phase2-source-scope.mjs，无参数，检查54项与实际清单对应、源哈希、语义分类、原生确认及部分测试入口。4项单测验证有效记录、重复/缺项、源/指纹失效、伪造runtime通过、丢确认或改handler时失败关闭。人工业务语义不会因自动清单重生成丢失，但相关源变化后必须重新审核。

补3个mysql/redis/file-audit本地预演用例、授权创建/延期/撤销合同用例及审计筛选/游标用例；扩展API重试、部署回滚说明零写入及恢复读取、角色空目录与拒绝后的重试。授权核对POST/PATCH路径、完整body、expected_version及幂等键，取消确认保留原因且无写入；未知写请求在夹具边界中拒绝。所有接口响应来自原M00/M01测试的隔离事实，未向生产发送写请求。

首轮18项通过、3项新增检查失败：测试错误地从健康态查找受阻区入口，授权glob未覆盖expiry子路径，审计select按精确label定位失准。修正测试边界后3项定向复测通过；最终同一版本六文件桌面21项、390移动21项全部通过，无跳过。产品源码无修改，不以调整业务逻辑迎合测试。

可复验命令（桌面结束后再运行移动）：

```powershell
node scripts/verify-ui-phase2-source-scope.mjs
node --test tests/unit/ui-phase2-source-scope.test.mjs
$scopeSpecs = @('tests/e2e/m00-05-api.spec.ts', 'tests/e2e/m00-08-deployment.spec.ts', 'tests/e2e/ui-phase2-internal-scope.spec.ts', 'tests/e2e/m01-04-rbac.spec.ts', 'tests/e2e/m01-05-resource-grants.spec.ts', 'tests/e2e/m01-06-audit-seed.spec.ts')
npx --no-install playwright test @scopeSpecs --project=desktop-chromium
npx --no-install playwright test @scopeSpecs --project=mobile-390
```

这不是54项每种状态/角色都已运行：导航多为源码/href证据，旧移动组件无可执行入口，生产、真实RBAC/数据库、并发及全站状态仍未覆盖。R01继续处理目录内候选与动态控件；A/B待用户选定，W02–W09与最终73页审核不缩减。

无生产代码、API、权限、SQL、配置或依赖修改，OpenAPI不变；Feature Map仅新增本地检查入口。无需前端重采、生产重启或部署。本批临时输出统一位于系统临时目录scoutops-ui2-source-scope-20260907，含首轮失败追踪和最终测试元数据，收尾按精确目录清理；没有新增永久截图，长期保留语义清单、说明和回归测试。

收尾结果：文档门、静态分析、格式门通过。4101/5173无监听，测试服务已退出。清理确认上述目录共13份本批测试文件，但工具策略拒绝Remove-Item删除（包括显式LiteralPath命令）；未绕过限制，文件没有进入Git。剩余精确路径为 `C:\Users\23136\AppData\Local\Temp\scoutops-ui2-source-scope-20260907`，需用户手动删除该目录；仅含隔离测试截图、追踪、错误上下文及.last-run，不是业务资料。此前“收尾清理”是要求，不代表这一次已成功删除。

## 2026-09-07 · R01任务三页合同与定向运行验证

从main / 3ac5bea干净工作树开始，执行PLAN 1.3的S02。复用54项目录外复核，不再次盘点该范围。新增page-specs/P13.md，修订P23/P24，新增task-contract-review.md；四个实际任务组件的71个控件/事件候选均有局部语义映射，4个原生dialog定义展开为新建/编辑/删除、5个单项及5个批量变体，共13个。人工表与自动清单分离；只读内联校验确认71项各对应一次，没有改全站分母或审核状态。

沿routes→service→MySQL确认两项旧规格偏差：新建/编辑表单实际内联在TaskWorkspace，并非TaskEditForm；summary固定按actor统计本人工作区任务，P23列表不带mine，两者不保证同一总量。只修正文档事实，不改变后端统计范围、权限或数据规则。

新增tests/e2e/ui-phase2-task-contracts.spec.ts共18项参数化用例，复用原business-tasks helper且不修改夹具。覆盖5个单项表单的取消/焦点/准确POST、3个直接生命周期动作、进度503重试与草稿保留、5个批量变体的取消/资格/参数、今日工作mine及返回、快捷创建取消、编辑/删除与详情404重载。每项能力边界在合同表列明；模拟响应不持久化PATCH，不能称数据库、真实权限或审计验证。

首轮17项通过，UI2-T05失败后依次纠正中文URL编码、壳层h1与业务h2的定位歧义。进一步证据发现NavigationShell的KeepAlive缓存页仍运行TaskWorkspace的query watch，切页时会额外读取未筛选的mine=true列表；首次与返回有效请求仍带原筛选。T05据实际合同分别验证范围和恢复，不断言不存在额外请求，也不把发现隐藏为测试错误。缓存页读取与迟到响应是下一步优先修复/回归项，尚未修复；动作弹窗的错误提示位于外层、提交中关闭竞态等也仍未完成。

T05最小复测通过后，最终同一版本全文件桌面18项通过（32.8s）、390移动18项通过（34.1s），无跳过。清单--check及文档门通过；旧产品源、共享夹具和原型样式未变，不重复生成现有图片或运行无关业务全量回归。Feature Map仅添加本地合同与测试入口，没有API、SQL、依赖、环境变量、生产运行或重启变更。

复验按桌面→移动顺序执行：

```text
npx --no-install playwright test tests/e2e/ui-phase2-task-contracts.spec.ts --project=desktop-chromium
npx --no-install playwright test tests/e2e/ui-phase2-task-contracts.spec.ts --project=mobile-390
node scripts/build-ui-phase2-inventory.mjs --check
npm run verify:docs
npm run format:check
git diff --check
```

本轮6次测试运行的临时产物均在 `D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\ui-phase2-tasks-20260907`，共15份文件（三次失败的截图/追踪/错误上下文及各轮.last-run）。4101/5173无监听，所有自建测试服务已退出。精确路径核实后尝试Remove-Item被工具策略拒绝，未绕过；该目录仍需手动清理，不在Git中，不是长期设计交付。上一批系统临时目录未触碰。永久保留本轮规格、合同和测试，不新增截图交付。

R01仍未全站冻结；六份页面规格不等于六页设计通过。A/B方向与正式Vue重构、全73页图和验收、生产发布、用户签收仍待完成。

## 2026-09-07 · S00任务缓存读取修复收尾

PLAN 1.4提交2bdeedf后继续实施，复核此前保留的同任务未提交修改；未混入其他文件。TaskWorkspace将挂载、KeepAlive激活及路由归属合并为单一post读取监听；离开或新读取取消旧GET，成功/失败/分页meta/成员结果均校验请求归属，迟到响应不能覆盖当前事实或错误状态。详情动作刷新同时完成成员目录，写请求不取消、不重放。模板、CSS、API字段、权限、SQL和依赖不变；Feature Map及蓝图同步读生命周期说明，OpenAPI和.env不适用，无生产重启或部署。

此前红灯复现UI2-C01两列表入口均为预期1次却收到2次读取。修复后新增8项缓存/迟到响应回归，连同原16项业务测试及18项合同测试，最终桌面42项、390移动42项全部通过；C02/C04故意忽略目标GET的AbortSignal，证明归属校验不依赖网络取消。此前同源码typecheck:web、4项组件治理测试、build:web、frontend-budget（251资源）、docs、static-analysis及format:check均通过。本次只读复核两个final结果文件均passed，保留源码与测试差异未变，按效率规则不重跑相同业务测试。上述为隔离Vue合同证据，不是MySQL/真实权限/生产或设计通过。

清理前精确目标为 `D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\ui-phase2-task-cache-20260907`，此前已清点12份验证临时文件；本次Remove-Item再次被工具策略拒绝，未绕过，目录仍保留且不入Git。以前两批记录的临时目录未操作。4101/5173无监听，没有遗留测试服务；保留必要构建产物，永久测试不是临时文件。

产品修复提交后刷新源清单和受影响Vue证据；当前旧指纹和历史截图不能代表修复版本。S00修复收尾不等于G0冻结；继续全站语义盘点、方向审核和W02–W09逐页重设计，用户通过数仍为0。

## 2026-09-07 · S00/S01按修复提交刷新清单和证据

修复提交e1f7a92后重新生成baseline/actions/dialogs/coverage/review-data，产品sourceRevision绑定e1f7a9272b5017307754fa60aa691a8bb43b8329，指纹为c4c1cd7f5470ab3896d355c7e16e49f7b5e291e48809e18eeabbf18198766183。对比前一清单，只有TaskWorkspace源哈希变化，1377控件/100弹窗候选、704旧项对应及54目录外候选数量不变；不以数量稳定推断运行时完整。

54目录外候选逐对象完全一致，13来源哈希经source-scope验证器核对，机器复核记录只更新关联全局指纹；4项防漏项/假通过单测成功。TaskWorkspace模板前后逐字符一致、控件ID稳定；任务合同按新清单将W位置后移66行，71行局部控件映射逐项对应通过，不修改动作语义。

原采集脚本实际重采任务Vue基线18图、隔离CSS研究18图，各14个案例通过。proposal流程同时重采12张既有任务A/B图及其交互/尺寸校验，没有引入新设计或审批。为保持当前全局指纹合同，P17/P31/P61的7项既有采集测试按桌面后移动顺序重跑，各7项通过，刷新36张真实Vue夹具图与JSON；P31资源授权表单的默认延期时间随采集时刻变化，两个视口图片哈希变化不代表产品布局变化。其余图片即使像素相同，也来自本次实际采集。各类证据分开标注，不是生产事实。

重新生成36图图库并验证1440/390逐图加载、图源对应、无横向溢出/控制台错误/外部请求；审核台双视口筛选、焦点、批注、导出、44px高度通过并刷新2张工具图。任务与清单14项单测通过。主审核台的测试批注、下载随隔离上下文清理；所有短时Vite/测试服务和浏览器已退出。

本批原型/基线/元数据为永久审核交付，Git保留旧版本；没有新增生产代码、依赖、配置、API或数据库改动，无部署和重启。唯一新增测试临时目录为 `D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\ui-phase2-evidence-refresh-20260907`，只有桌面/移动两个.last-run.json；精确清理被工具策略拒绝，未绕过，目录未入Git，需手动清理。S00前述12份缓存回归临时文件及更早遗留不宣称已清除。

下一步继续S02任务弹窗未覆盖状态及S03其余路由族语义盘点；用户方向问卷已发出，无回复不代选。G0仍in-progress且未冻结、G1–G5待验，不把修复与证据刷新当成正式全站风格重构完成。

## 2026-09-07 · S03评分规则动作、弹窗与状态合同

从main / 4e5e8f5干净工作树开始，进入P17评分规则页，不重复任务截图。依feature-map定位ScoreRuleConsole→scoring-routes→scoring-service→mysql-scoring-repository，核对五种状态转换、启用替代与回滚目标的真实queueAll边界。新增[评分合同](scoring-contract-review.md)，25个控件/事件候选逐行映射、3个原生定义展开7个业务弹窗，另登记9个v-model位置展开的30个输入实例。只读内联校验确认25行一一对应、7变体均来自实际3定义；不冻结全站分母、不改审核计数。

新增独立ui-phase2-scoring-contracts.spec.ts共11项：5种生命周期的必填/初焦点/取消归还/准确字段与revision/幂等键/成功重读；创建校验、取消保留和成功重置；409弹窗错误与刷新后的新revision；预览失败重试、20/1分页和零POST；3种能力组合×7状态的入口呈现。fixture字段来自现有m04-03与实际接口，新增数据只在本地拦截响应中模拟，不代表持久化状态或后端无写事务。

首轮7项通过、预览错误用例失败：共享API客户端对503自动重试，单次失败夹具随后成功，UI不会显示最终错误。读取真实api-client后改为连续3次失败耗尽重试；没有改变生产重试配置或放宽错误断言。修正与新增能力用例4项最小复测通过，随后原4项+新11项完整桌面15项、390移动15项均通过，各30.4秒，无跳过。清单--check、文档门、静态分析及格式门通过，现有产品源、CSS、截图测试和采图夹具均不变，不重复构建或刷新已有效图源。

UI技能目录本次可读取，选择fixing-accessibility并完整阅读；据此核对初始焦点、Escape归还、required及弹窗内alert。发现missing_fields未渲染、错误未与字段关联、提交中关闭/重开与预览迟到响应尚未验证，均在P17规格和合同保留为后续设计/实现必验项，不声称完整无障碍通过。本轮不改产品Vue、评分规则、权限、API、SQL、依赖或环境配置，Feature Map只补本地复核入口；无需部署、迁移和重启。

本轮唯一临时目录 `D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\ui-phase2-scoring-contracts-20260907` 共7文件（首轮失败截图/trace/error-context与四轮.last-run）。4101/5173无监听，测试服务和技能查询进程均已退出。精确路径核验后Remove-Item被工具策略拒绝，未绕过，目录未入Git，需手动清理；更早遗留目录未动。永久保留规格、合同和测试，不新增长期截图。

下一步S03进入账号与入驻页面族，补尚缺逐页规格及真实动作依据；P17剩余竞态/字段错误关联仍在清单中，不因本批测试通过注销。全73路由、最终新图/实现、生产验收和用户签收目标保持；方向意见仍待用户明确回复。

## 2026-09-07 · S03身份与入驻九页规格及源码合同

从main / 6c0e090干净工作树开始，新增page-specs/P01.md至P09.md及[身份与入驻合同](identity-onboarding-contract-review.md)。按Feature Map→route-catalog/App/router→LocalIdentity、LandingRedirect、TenancyChooser、OnboardingGuide→auth/tenancy routes追踪；九页每页十项规格，包括桌面/移动构图要求、真实字段/动作、内联模式、状态连续性、响应式、待交付图槽位和验收步骤。页面规格由6份增至15份，其余58份仍待补，不能据此登记15页设计通过。

四个本地组件的38控件/事件候选各对应一次，普通表单submit与按钮合并为同一语义入口并按五种模式展开。14个v-model源码位置展开17个模式输入实例；没有本地原生dialog候选，MFA挑战/首次设置/结果是内联状态而不是新增路由或弹窗。P01共享UiStatePanel的blocked次按钮没有调用方监听，P08“当前账号”无handler，旧sessions模式暂无公开入口，分别记录共享边界、非动作占位和旧模式，不误算已验证功能。

核对修正规划口径：P06没有确认密码字段，P07没有复制按钮，P09没有持久化进度。真实邮箱验证返回200 data.status，旧E2E的204是兼容夹具；登录可优先采用符合现有字符串检查的redirect，不保证总先请求landing。MFA加载初值/表单外校验与重复提交、敏感ref清理、跨模式与组织迟到响应、引导小数step索引undefined等均明确列为未完成/待验；本轮不改安全规则，不声称已运行复现或修复所有缺口。

第一次清单检查发现修改PAGES三行会改变全局sourceFingerprint并使baseline过期；随后的文档门仍通过。为保持本批规格范围，已用补丁撤回本批PAGES改动，在独立合同的“旧矩阵纠偏与同步时机”保留三项明确纠偏，要求下一次相关源/证据刷新时同步矩阵、生成物和受影响证据。没有只修改指纹冒充重采，PAGES内容与提交基线一致。第二次清单--check通过，仍为73路由、1377控件、100弹窗候选；四文件38行候选键与行号、九条真实路由/各十节、相对链接及15份规格计数的只读内联检查通过，G0未冻结。

验收计划I01–I12逐项写出步骤、精确method/body/结果和复用测试入口；全部明确为计划卡，不是本轮新增测试通过。产品源码、CSS、既有E2E、图和夹具未改，按效率规则不重复构建或运行旧业务测试。Feature Map仅增加本地复核索引；OpenAPI、数据库、依赖、环境配置、生产部署与重启均不适用。没有新建测试临时文件、截图、浏览器、服务器或后台进程，历史五个已记录且删除被策略拒绝的临时目录未触碰、不声称已清理。

使用需求拆解技能编制逐页任务卡，UI技能目录选择fixing-accessibility后据其要求补字段错误关联、模式焦点、状态播报及敏感动作忙碌态检查；没有借技能默认实施未批准的视觉或安全改动。下一批继续P10–P12偏好/个人/首页的缺失规格与共享行为，P01–P09上述缺项仍需按I01–I12补测；A/B方向未回复不代选，W02–W09正式重设计、全图包、Vue、生产及用户签收目标不变。

收尾：npm run verify:docs通过（73路由、60受保护路由、6角色、153份必需文档），npm run format:check通过（production=495、repositories=51），git diff --check通过。4101/5173无监听，本批无临时产物或服务需要清理；只提交九份规格、合同、进度与Feature Map索引，不提交生成物、历史临时文件或生产修改。
