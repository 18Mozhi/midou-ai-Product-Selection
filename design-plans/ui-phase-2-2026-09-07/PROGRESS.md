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

## 2026-09-07 · S03外观、个人中心、首页规格与局部合同回归

从main / 915ee71干净工作树开始，新增P10–P12三份逐页规格及[外观/个人/首页合同](account-home-contract-review.md)。五个实际组件ThemeStudio、PersonalCenter、AccountShell、HomeDashboard、HomeAutomationOverview的51个控件/事件候选各映射一次，15个个人表单输入加7个首页规则输入另记；没有本地原生dialog，所有表单为内联。三页各十节、当前路由及相对链接、51行稳定键和行号、零本地dialog、12组验收卡的只读内联检查通过。规格累计18份，其余55份仍待补，未冻结G0或增加用户通过数。

真实链核对包括主题GET/PUT与缓存/密度模块、账号壳层与profile-first读取、个人资料服务/通知接口、首页summary与监控规则接口。主题ID继续兼容，密度只在内存和DOM即时生效，不是服务器保存项；个人中心实际是account壳层，租户分区失败不应阻断资料，但目前失败区回退空/default，仅有汇总提示；首页规则读取失败回退空列表，changes/follows返回但未逐项展示。移动账号导航潜在无可访问名、radio缺完整键盘合同、字段报错关联、提交竞态、缓存/范围与迟到响应均保留待验/待修，不把源码说明当完整运行证据。

按计划增加永久tests/e2e/ui-phase2-account-contracts.spec.ts五项：预览/撤销与密度零PUT、两次主题准确payload/版本及独立幂等键、409刷新版本再保存、三个租户分区403时本人资料仍可PATCH且零成员navigation GET、五个通知布尔值及两次返回版本。没有向实际账号、邮件或数据库写入，夹具沿既有UI与服务端字段；个人部分失败用例不认可失败区的空/default展示，也不证明密码/会话或真实RBAC通过。

首轮4项通过、通知第二次保存断言失败；error-context显示“通知偏好已保存。”与requestId在同一个paragraph，exact全文匹配不成立。改为对已定位notice检查目标文本，保留完整请求/版本断言；产品代码不变。该项最小复测通过后，原3项主题测试加新5项最终桌面8项通过（21.1s）、390移动8项通过（20.8s），无跳过。之后仅对新测试做Prettier格式化，不改变测试语义、响应或断言。两个final的.last-run均passed、failedTests为空。

验证范围：npm run verify:docs通过（73路由、60受保护路由、6角色、153份必需文档），npm run verify:static-analysis通过（389文件）。产品源、旧E2E及采图夹具、PAGES、生成器、清单与独立原型均未修改，既有全局源指纹仍有效，不重复生成图或做生产构建。Feature Map只补三处本地合同/测试索引，OpenAPI、SQL、依赖、环境变量、发布配置均不变，无部署、迁移和重启要求。

本轮唯一临时目录为 `D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\ui-phase2-account-contracts-20260907`，共7文件：首轮失败截图/trace/error-context及四轮.last-run。核对精确绝对路径、普通目录属性及最终结果后Remove-Item被工具策略拒绝，未绕过，目录仍需手动清理、不入Git。4101/5173无监听，所有本批测试服务和技能查询进程已结束；历史五批遗留目录未动。新增规格、合同和永久回归测试保留，不新增长期截图。

需求拆解技能用于三页任务卡，fixing-accessibility用于命名、radio键盘、字段报错与状态要求；按计划的永久回归测试范围使用Playwright技能和仓库测试体系。下一批继续P14–P18趋势/机会入口（复用P17已有规格），同时保留P10–P12合同中A06–A12缺项，不把既有模块verified等同重设计完成。正式A/B方向仍待用户明确审核，全73路由设计、Vue实现、全量动作/状态、宝塔部署和用户签收目标保持。

提交前收尾：format:check通过（changed=1、production=495、repositories=51），git diff --check通过；当前Git只包含本批七个交付文件，未混入生成物或临时文件。再次只读清点上述目录仍有7份文件，不宣称清理成功。

## 2026-09-07 · PLAN 1.5 N01趋势页规格与合同回归

从main/bc4ca78干净工作树开始实施。新增page-specs/P14.md及[趋势合同](trend-contract-review.md)，依Feature Map→六个真实Vue组件→trend/data-quality/provider-source路由→服务与MySQL边界核对。60个控件/事件候选各对应一次；另外18个v-model源码位置；5个弹窗定义/调用候选归并为3个本地role定义、4业务变体及1个共享筛选抽屉。合并/拆分、确认/驳回是内联表单，不虚增弹窗。只读内联检查确认候选稳定键及行号、5项dialog引用、18绑定、P14十节及19份规格计数。其余54份仍待补，G0未冻结、用户审核数未增加。

本批明确区分：关注/监控/转机会三种动作；转机会导航到P15预填而不是P16创建旅程；复制视图只是当前网址；规则结果只用首关键词筛选，排序只在当前分页。立即刷新来源真实要求trend:read及会话范围匹配，不错误收窄为trend:manage。规则UI周期/来源选项少于后端范围，未擅自扩展。服务端同人决定拒绝（含驳回）、拆分至少保留一条证据、异常工单复用是实际持久化边界，不以夹具成功证明。

新增永久tests/e2e/ui-phase2-trend-contracts.spec.ts共8例：关注PUT/取消DELETE无body且独立幂等键；相关性取消零写入及标记/恢复返回版本；异常503不自动重放、保留输入后显式重试返回已有工单；规则取消重开默认及准确关键词/数字/null字段；规则启停保留周期/门槛并使用新版本；拆分准确证据和版本只提议；确认/驳回两变体的取消及准确提交。新增夹具沿实际类型/路由，不改原测试或截图基线。

TR01最小验证1例通过（16.2s）；随后原m04-01的8例与新8例，桌面16项全部通过（28.2s）、390移动16项全部通过（22.4s），无失败或跳过。最终两份.last-run为passed且failedTests为空。文档门通过（73路由、60受保护路由、6角色、153必需文档），静态分析通过（389文件）。以上为Vue隔离合同及既有局部布局证据，不是全站设计、真实DB/RBAC、采集、生产或用户验收。

发现并保留待修/待验：本地三弹窗无初焦点/循环/Escape/归还、相关性失败关窗丢原因、弹窗错误在外层、提交关闭/重复点击竞态、全部状态空值恢复active、帮助置信度文字与真实不足状态不一致、缓存页/切主题迟到响应、规则旧数据和治理错误呈现。均在TR08–TR12列明确步骤与边界，不因8例通过而结案。本轮没有改产品Vue/CSS、API、安全、权限、SQL、依赖、配置或生成指纹；Feature Map只增加规格/合同/测试入口，无OpenAPI/.env配套变更，无部署、迁移和重启。

需求拆解、无障碍技能用于任务与交互验收。UI技能目录本次fetch failed，停止网络重试后使用已完整读取的本地技能；按PLAN的永久测试范围使用Playwright技能及现有测试体系。方向仍待用户审核，不代选A/B或把旧Vue截图当最终设计。

本轮仅创建临时目录 `D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\ui-phase2-trend-contracts-20260907`，其中minimal/desktop/mobile三个.last-run.json，无失败截图。精确路径及内容核对后Remove-Item被工具策略拒绝，未绕过；目录未入Git，需手动清理。4101/5173无监听，所有本批测试服务和技能查询进程已退出；历史六批目录未动。永久保留P14规格、合同与新增测试。

下一步N02机会列表/详情P15/P18，随后N03创建P16；复用P17。P14最终设计图、完整无障碍与异常恢复、真实后端、生产及用户签收均未完成，W00–W09全73路由目标保持。

## 2026-09-07 · PLAN 1.6 N02机会列表/详情规格与合同回归

从main/a329cfd开始，工作树已有本任务此前生成的opportunity-candidate-map.md草稿。复核后完成其关联合同并纳入本批；新增[机会合同](opportunity-contract-review.md)、P15/P18两份独立十项规格、永久ui-phase2-opportunity-contracts.spec.ts，Feature Map只增加机会域本地复核索引。规格累计21份、余52份，不增加用户通过数或冻结G0。

依Feature Map→OpportunityWorkspace与实际子组件→机会、ERP、利润、评分、AI、竞品及供应路由/服务核对。12组件104个控件/事件候选和8个弹窗定义/调用候选逐项匹配当前清单键、行号及源码SHA；另核对41个v-model位置，其中5个为父子转发，不虚报41个独立字段。四本地原生定义展开ERP1/创建1/人工决定3/批量3，另加AI共享原因2及共享筛选1，共11调用方变体；成本复核两变体与经营反馈为内联，未虚增弹窗数。两份规格十节、相对链接、21份计数只读检查通过；inventory --check仍为73路由/1377控件/100弹窗候选。

列表以四种队列、筛选、选择与返回为任务，详情以真实质量门、缺项和人工决定为任务，不默认沿用旧账页布局。合同明确：当前批量预览selectedIds总数与实际当前页items交集可能不一致；人工决定失败保留原因，AI原因框却先关闭再写；ERP选文件即导入，没有最后确认；成本提交只是双人复核申请，批准前不生效；利润读取失败当前会阻断主详情，复核人失败静默空；时间默认值存在UTC截断再按本地解析风险。OP06–OP10列出范围、迟到响应、重复标题ID/完整焦点、成本/AI状态及真实后端与生产未验项，不以源码说明当运行复现或已修复。

新增8项真实Vue隔离API回归：UI2-OP01手工创建required/初焦点/Escape归还/草稿保留/准确字段及返回ID；OP02指派/复核/归档三变体取消、打开重置、准确当前页ID与version、原因trim、负责人或null及成功重读；OP03观察/驳回两变体取消、503不自动重放、原因保留、显式重试、独立幂等键及返回历史；OP04只读AI独立失败不冒充空结果、恢复零写入；OP05内存JSON文件选择立即导入，准确来源/时间/原行透传。ERP行字段依据normalizeErpProductRow，仅为隔离数据，未访问真实ERP/助手、数据库或生产。

最小OP01通过1例（15.7s）；首轮原7+新8桌面14通过、指派1例失败。error-context显示负责人combobox及真实夹具成员选项存在，getByLabel exact未匹配；改为按combobox可访问名定位，不改产品或请求断言。该例最小复测通过（16.2s）；最终整组桌面15项通过（32.2s）、390移动15项通过（32.6s），无跳过，两份final .last-run均passed/failedTests为空。人工决定测试明确使用native top-layer定位而未认证重复标题ID的可访问名称；本批不声称完整无障碍或真实RBAC通过。

文档门通过（73路由、60受保护路由、6角色、153必需文件），静态分析通过（389文件），format:check通过（changed=1、production=495、repositories=51）。产品Vue/CSS、既有测试/采图夹具、PAGES、生成清单和源码指纹未改，不重复生产构建或刷新已有效图。API、业务规则、权限、SQL、依赖、环境配置无变化，OpenAPI/.env无需配套改动；无部署、迁移和重启要求。

需求拆解、无障碍技能用于两页任务与错误/焦点验收；UI技能目录读取成功，使用本地fixing-accessibility；按计划永久测试要求使用Playwright及既有测试体系。正式方向仍待用户审核，不代选A/B，不把规格/旧Vue回归说成新图已经完成。下一步N03补P16创建流程，随后N04该族整合；保留OP06–OP10与其他页面待验项，目标仍为W00–W09全73路由、全图、实现、生产及用户签收。

本批唯一临时目录：`D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\ui-phase2-opportunity-contracts-20260907`，共8文件（五轮.last-run和首轮失败截图/trace/error-context）。已核对绝对路径、普通目录非链接属性与最终测试结果，Remove-Item被工具策略拒绝，未绕过；目录未入Git，需手动清理。4101/5173无监听，本批所有测试服务与技能查询进程已退出；历史七批临时目录未动。永久规格、合同和测试保留。

## 2026-09-07 · PLAN 1.6 N03创建旅程规格与局部合同回归

从main/d0c1bb6干净工作树开始。新增[旅程合同](selection-journey-contract-review.md)、page-specs/P16.md十项规格和永久ui-phase2-journey-contracts.spec.ts九例，Feature Map只加selectionAcceptance复核索引。依地图→SelectionJourney→旅程路由/服务/MySQL仓库核对输入、创建、服务端进度、候选、三种决定和关联对象；NavigationShell的KeepAlive及reset_on_scope键另核实。只读检查通过：本地10候选稳定键/行号/源码SHA逐项一致，5处v-model、0本地弹窗，P16十节；规格累计22份、余51份，G0与用户审核计数不变。

发现需用户决定的业务冲突J07：旅程adopt直接创建/复用机会并写adopted，未检查P18与蓝图要求的五项质量门。已询问统一质量门或保留独立规则，未答复前不改后端、SQL、权限或相关产品行为。observe/reject真实不生成机会，但三种决定都可能创建验证任务；新增夹具据此返回null机会ID和真实形状的验证任务ID，不沿用旧m07-06 observe夹具的偏差。GET在超时且采集任务仍未终态时可能登记blocked事件与Outbox，零浏览器POST不等于零数据库写入。

新增九例覆盖：三种输入的原生required/ASIN长度与精确两字段请求；非法活动ID零旅程请求；恢复404清活动ID而不重建；观察/驳回required、原原因/null候选准确提交与返回验证任务链接；创建503保留输入、不自动重放、显式重试新幂等键；accepted后GET已有ID，使用服务端终态和elapsed，再开始下一次。最小关键词1例通过（14.9s）；旧三例加新九例桌面12项通过（24.1s）、390移动12项通过（25.9s），无失败或跳过。移动命令首次误写不存在的mobile-chromium，启动前报项目名错误；按实际配置改为mobile-390后整组通过，无产品或用例修改。最终desktop/mobile .last-run均passed、failedTests为空。

以上只是隔离Vue局部合同，不是实际来源采集、真实事务/RBAC、生产180秒指标、全状态或全套图通过。J08读取归属/缓存与恢复竞态、J09重置草稿/错误恢复/字段合同、J10完整无障碍与正式图/真实验收仍待逐项完成；N03因此是规格与局部回归交付，不宣称创建页全部验收完成。下一步N04整合该族及这些未验卡，未变化的P14/P17测试不无条件重跑。正式A/B方向和J07业务规则是两项独立待确认。

inventory --check通过（73路由、1377控件候选、100弹窗候选）；文档门通过（73路由、60受保护、6角色、153必需文件）；静态分析通过（389文件）；format:check通过（changed=1、production=495、repositories=51）。产品Vue/CSS、既有测试/采图夹具、PAGES、生成清单和产品源指纹未变，不重复生产构建或刷新有效图。API、业务规则、SQL、依赖、环境配置无变化，OpenAPI/.env无配套变更，无部署、迁移或重启；不把历史发布当本次线上验证。

需求拆解技能用于状态/任务卡，无障碍技能用于字段名称、键盘/焦点及恢复验收，按计划的永久测试要求使用Playwright及现有测试体系。只创建临时目录 `D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\ui-phase2-journey-contracts-20260907`，含minimal/desktop/mobile三份.last-run，无失败截图。核对精确绝对路径、普通目录非链接属性后Remove-Item被工具策略拒绝，未绕过；该目录仍在且不入Git，需手动清理。4101/5173无监听，本批测试服务已退出；历史八批遗留目录未动。永久规格、合同及回归测试保留。

## 2026-09-07 · N04旅程读取生命周期的复现与修复

上一轮42aee26是实际规格/永久测试交付，本轮从main/42aee26干净工作树继续，目标为N04/J08读取正确性，不借机选择正式视觉或改J07质量门规则。使用需求拆解、无障碍及按计划的Playwright永久回归工作流。先新增ui-phase2-journey-reads.spec.ts五例，旧产品全部红灯：离开缓存页仍轮询、返回后无新读取（迟到200/404两变体）、reset后被旧结果恢复、失败resume的重试不重新GET。JR03失败DOM明确显示“已重置的旧旅程”，不是仅凭源码推断。

SelectionJourney现在将mounted/activated初始化去重，deactivated/unmounted停止timer、递增读取版本并abort旧GET；激活时根据当前旅程或保存ID重新读取。所有读取成功/失败/404清ID/finally都校验active和版本，reset及写入前使旧读取失效。恢复失败主按钮“重试读取进度”保留并重读ID，不自动创建。新增reading/aria-busy与恢复忙碌文案，读取中不允许创建/决定，busy时禁止重复写入及reset；既有2秒间隔不变，不取消/重放POST或后台采集。

原五例修复后全部通过（26.7s）；随后补恢复按钮禁用/aria-busy断言，两项最小复测通过（17.8s）。最终原m07-06三例、J01–J06九例及JR01–JR04五例，共桌面17项通过（28.4s）、390移动17项通过（28.6s），无跳过，两个final .last-run均passed/failedTests为空。迟到响应测试故意去掉AbortSignal，证明归属检查；读测试零POST不等于真实数据库零写入，未访问真实来源/数据库/生产。

typecheck:web通过；build:web通过（407模块，Vite构建11.68s），frontend-budget通过（251资源）；文档门通过（73路由、60受保护、6角色、153必需文件），静态分析通过（389文件），组件边界单测1项通过，format:check通过（changed=2、production=495、repositories=51），git diff --check通过。既有测试/夹具、CSS、共享壳层及其他页源码未变，未无条件重跑P14/P17；正常构建产物及浏览器助手发布包是项目需要的输出，保留且不入本次提交。

蓝图15.1、Feature Map、P16及旅程合同第7节同步当前读取合同；旧第1–6节明确标为42aee26盘点快照，不把旧行号当现值。API方法/字段/权限、后端/Worker/Python、SQL、依赖、环境变量均不变，OpenAPI/.env无需配套改动。后续正式发布只需替换前端静态构建，不需要后端重启/数据库迁移；本轮未部署。唯一运行参数仍是既有2秒轮询，没有新增调节项。

J08仅已测读取边界局部通过；跨标签/storage异常、范围切换、离开期间写入归属和恢复副动作仍待独立验证。J09草稿/错误恢复、J10全状态/无障碍/正式图未完成，J07仍待用户规则决定。页面规格仍22份、余51份，正式方向/用户审核数不变。源码已变化，生成清单和既有图仍绑定e1f7a92，不宣称它们当前有效；下一步按本次产品提交刷新清单、候选位置与必要证据，再继续剩余页面族，不仅改哈希冒充复验。

本轮只创建临时目录 `D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\ui-phase2-journey-reads-20260907`，共20文件（旧版5例失败截图/trace/context共15文件和五轮.last-run）。已核对精确绝对路径、普通目录非链接属性，Remove-Item被工具策略拒绝，未绕过；目录仍在，未暂存，需手动清理。4101/5173无监听，本批测试和构建进程已退出；历史九批临时目录未动。永久回归测试及文档保留。

## 2026-09-07 · N04按16f524b刷新源码清单及关联证据

上一轮16f524b已提交实际读取修复，本轮main/16f524b干净工作树开始，产品代码不变。重新核对计划的证据刷新要求，先改正已记录的PAGES P06/P07/P09偏差：reset没有确认密码，MFA没有复制入口，引导只有query与局部step；LocalIdentity/OnboardingGuide源码复核后未改。随后运行生成器，首次输出703个旧项对应，定位到创建按钮新增恢复文案导致button-554自动匹配缺失；用同一selection-start/create表单、精确label及disabled属性建立人工对应，不按最近行号或数量凑匹配。

最终baseline/actions/dialogs/coverage/review-data绑定sourceRevision 16f524b66cf9dd48384c6cd78c475409ec5dd493、指纹92f0bffbe1a11fcce4d49c6e4fea83acc12eccb5045de9f33d078d34f5bc7504。只有SelectionJourney产品源SHA变化（928808169759964ae801e50eb7b20843dec35e8d00f10e1f01bd6329f96fc271），其10候选中5项签名改变，合同第8节保留旧→新及稳定语义ID；五处v-model/零本地弹窗保持。其他1367控件和100弹窗候选逐对象与前一清单一致。目录外54候选逐对象一致，13来源哈希经现有验证器复核，仅更新其关联全局指纹；不重写已复核的42语义动作或运行状态。

现有图库及task-study验证器要求同全局指纹，因此不能只换证据版本字段。通过原采集脚本实际重采任务18张Vue基线及18张注入CSS研究图，两组各14案例通过；proposal流程一并实际重采12张任务A/B图并验证预览/焦点/44px等已有度量，其图像哈希均与旧版一致，不视为新设计成果。通过既有七个采图用例刷新P17/P31/P61共36张Vue基线：桌面7项通过（23.3s），390移动7项通过（20.8s），无失败或跳过。测试源/夹具未修改，不用截图更新选项接受失败；仅打开现有SCOUTOPS_UI_PHASE2_CAPTURE开关并限于隔离页面。

36张Vue图中仅P31资源授权桌面/移动两图像素哈希改变，已人工查看；对应代码/控件列表/布局度量均未变，新到期时间来自Date.now()+7天，采集时间从11:49/11:50 UTC变为14:06/14:07 UTC。其余图片即使像素一致也来自实际重采。审核台两图及manifest实际刷新，人工查看两个视口；筛选73路由、候选分页、批注/导出、初焦点/Escape归还、宽度和44px控件检查通过，隔离批注与导出由脚本清理，不是用户审图通过。独立规则/权限/恢复76图未重采，逐文件哈希核对一致；未更新其审批状态。

inventory --check、source-scope verifier、36图生成/校验及双视口图库浏览通过（零控制台错误/外部请求/页面横溢）。清单、源范围与任务研究单测共18项通过，文档门通过（73路由/60受保护/6角色/153必需文件），format:check通过（changed=0、production=495、repositories=51），git diff --check通过。未重复运行源码未变的上一轮17项旅程回归或生产构建，不把历史结果描述为本轮新运行。

P16当前十项映射、PAGES纠偏、Feature Map索引和旧盘点说明已同步；产品Vue/CSS、API、SQL、依赖、环境变量、生产配置不变，OpenAPI/.env无需配套改动，无部署/迁移/重启。本批是证据一致性收尾，不增加页面规格（仍22/73、余51），G0未冻结、用户审核0。J07业务规则及A/B正式方向仍待用户决定；J08剩余跨范围/多标签/写入归属、J09/J10仍待。下一步补W02尚缺的P72/P73独立规格，再按共享入口族推进W03等剩余页面，不把本批重采数量当作全套新图完成。

需求拆解技能用于影响范围与版本证据，无障碍/Playwright技能用于已有图库和审核台的实际交互验证；不因重采延伸到新视觉或生产写入。本轮唯一临时目录 `D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\ui-phase2-journey-evidence-refresh-20260907`，含desktop/mobile两份.last-run，精确路径及普通目录非链接属性核对后Remove-Item被工具策略拒绝，未绕过，仍需手动清理且不入Git。采集脚本/browser/Vite及测试服务均已返回退出，4101/5173无监听；历史十批遗留目录未动。审核图、JSON和清单是永久交付物，保留。

## 2026-09-07 · PLAN 1.7 E01收尾、E02两页规格与遮罩焦点修复

从main/71b4c29及58项已记录证据变更开始，先核对差异与归属并只读运行inventory --check（73/1377/100、704历史对应）、source-scope（54/42/1/6）及36图build --check，通过后精确暂存58项形成f55942d。采图和18单测等沿用上一批有效证据，没有重采或伪称本批重跑。Git add曾返回非零但实际暂存58项，随后cached范围/检查和提交结果确认恰为原58项，提交后工作树干净；未混入本批后续产品修复。

依地图commonUiStates→route-catalog/router/App→UiStateShowcase/NotFoundPage/UiStatePanel/ConfirmDialog/navigation-memory完成E02盘点，新增page-specs/P72.md、P73.md及state-recovery-contract-review.md。14个控件/事件源码候选、2个定义/调用候选、两处v-model，按稳定语义与八态行为展开；P72开发演示与P73用户404明确分开。修复前逐项核对hash/line/ID，修复后将旧记录标历史并单列当前差异。规格24/73、余49；不是24页正式重设计完成，G0未冻结，用户通过0。

新增永久ui-phase2-state-recovery-contracts.spec.ts七例：非法/多值query、同态history、loading按钮/aria-busy、清提示、确认双条件/trim、取消重开/焦点、unsafe最近路径两变体与storage失败。最小ST03通过（17.2s）；原12项非截图用例加新7项首轮桌面18通过、ST04遮罩取消后焦点丢失1失败。ConfirmDialog的mousedown先关闭而后浏览器默认聚焦夺走返回焦点；仅改@mousedown.self为@mousedown.self.prevent，保留取消时机并使内部输入/勾选/按钮不受影响。最小ST04通过（14.1s）；最终本族桌面19项通过（19.3s）、390移动19项通过（26.3s），无跳过。两项历史toHaveScreenshot用例明确不在本批集合，未修改图基线。

核对9个组件/11次直接ConfirmDialog调用，取消均更新本地状态。补跑8个实际业务组件的已有相关隔离Vue回归：凭证撤销、浏览器回收、死信重放、质量解决、批量重放、开放平台确认取消、调度恢复、容量签认，桌面8项通过（28.6s）、390移动8项通过（27.9s）。四份final .last-run均passed/failedTests为空。现有批量重放用例通过DOM click两次测防重，不能称其覆盖鼠标命中；ST03/ST04使用实际交互测试。质量批量、来源熔断变体、叠加弹窗、辅助技术与真实后端/生产仍未全验。

build:web（包含typecheck）通过，407模块、10.90s，frontend-budget通过251资源；实际dist JS与文件名扫描无UiStateShowcase/VerificationFramework，不等于线上URL/HTTP状态已验。文档门73路由/60受保护/6角色/153必需文件通过，静态分析389文件通过，format:check通过changed=2/production=495/repositories=51。最初裸node --test因Node22不能直接加载.ts而失败，按真实M02-04注册命令加--experimental-strip-types后5项通过；不改依赖或运行参数。运行手册更新后该单测的旧“宝塔网站”字样断言改为真实统一部署命令和生产内部不可见约束，再做收尾验证。

同步Feature Map、架构和运行手册的焦点合同，并纠正旧文档要求生产开放内部展示的错误。产品只改ConfirmDialog一行，无API、权限、SQL、后端/Worker/Python、CSS、依赖或环境变量变化，OpenAPI/.env无需变更。修复本身只更新前端构建；实际发布仍用宝塔统一部署器并检查既有迁移/停启窗口，本轮未部署/迁移/重启。生成清单及旧图仍保留16f524b修复前指纹，需要在此产品提交后按影响刷新；不改哈希冒充复验。下一步收尾当前源证据，然后按E03补W03八份缺失规格；A/B方向、J07质量门决定和其他历史未验项仍保留，完整W00–W09目标不缩减。

使用需求拆解、UI技能目录选择的无障碍技能及计划要求的Playwright永久测试流程。唯一新临时目录 `D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\ui-phase2-state-recovery-20260907`，共10文件（7份.last-run及首轮失败截图/trace/context）。绝对路径与普通非链接目录已核对，Remove-Item被工具策略拒绝，未绕过，仍需手动清理且不入Git；历史11批目录不动。所有测试/构建工具已退出，4101/5173无监听，无服务交接。正常构建和浏览器助手包为项目运行输出保留；新规格、合同和测试为永久交付物。

## 2026-09-07 · PLAN 1.8 E03竞品两页合同与E01证据收尾

从main/ff615e3及5个既有未提交生成清单开始。上一轮为计划文档交付，本轮实际推进P19/P20，新增两份十项独立规格和competitor-contract-review.md；按route-catalog、NavigationShell、surfaceProps、CompetitorMonitor、API路由/服务/仓储追踪list/rules两条路由，复核36个控件/事件、3个弹窗定义及10处v-model，并补script Escape、共享状态事件与真实权限分支。所有候选ID和源码SHA逐项内联校验通过；规格26/73、余47，不是26页正式重设计完成，G0未冻结、用户通过仍0。

复用m04-05原fixture，在既有E2E文件追加UI2-CP01–CP06共7实例：三步创建与取消、失败保留/重试；库存指定规则省略阈值与数值全局规则的准确字段；删除取消/原因trim/revision冲突；暂停禁采/恢复revision；规则取消和默认重置；没有竞品管理权限但有task:create时按变化证据生成验证任务。最小CP02两例通过（17.0s）；原11例与新增7例最终桌面18项通过（46.7s），390移动18项通过（39.8s），无失败/跳过。本批没有真实数据库/采集/Outbox/RBAC或生产写入，成功fixture不证明持久化，取消零写入仅指捕获的本页API请求。CP-G01–CP-G07将焦点、阈值状态/币种、100快照窗口、缓存/异步归属、提交竞态、删除反馈及完整图/真实验收保留未关闭，不因局部测试通过注销。

E01对起点5个生成清单执行inventory --check通过（73路由、1377控件、100弹窗、704历史对应）。与HEAD旧清单逐对象断言：除ConfirmDialog外所有候选不变，目录外54项不变；当前只有遮罩事件签名从4505a8c2bbf9389c.1变为0f50ae650a1895b3.1，语义仍ST-CANCEL.backdrop。state-recovery合同第7节登记新映射，旧记录保留历史。source-scope仅更新全局关联指纹，13个源哈希经验证器重新核验，54候选/42语义动作/1原生确认/6无渲染入口通过，不提升运行时状态。

清单当前绑定060e0b591af732c4c69060a468f526c45cc1330c，指纹caf0574f33b1c91a446e6a7784bc954fc6d926d44ba5b349df538190304eff8d。依现有全局指纹校验，实际重新采集任务18张Vue基线及18张注入CSS研究图，各14案例通过；proposal流程同时重采12张独立任务A/B图，三组图像哈希与旧版一致。原七个代表采集用例桌面7项通过（25.3s）、移动7项通过（23.8s），刷新36张Vue基线及记录。仅两张P31资源授权图像素哈希变化，布局及控件列表一致，人工查看为Date.now()+7天输入时间变化（当前22:57/22:58）；其余图像素相同但确由本轮采集。独立规则/权限/恢复76张研究图未重采，逐文件哈希验证通过；第一次独立图校验误把其file相对路径当成计划根目录而ENOENT，改按evidence所在目录解析后通过，未移动图或放宽哈希比较。

代表图库生成/校验和双视口36图浏览通过，零控制台错误/外部请求/页面横溢；审核台实际采集两图及manifest，73路由筛选、批注/导出、焦点和44px控件检查通过，隔离批注及下载由脚本清理。这些仍是旧版Vue基线与研究图，不是新风格或用户签收。清单/范围/任务研究单测18项通过；文档门73路由/60受保护/6角色/153文件通过，静态分析389文件通过，format:check通过changed=1/production=495/repositories=51。未重跑未改变产品源码的构建、全站业务回归或上一轮状态页测试；证据一致性不替代全站实际行为验收。

Feature Map仅登记竞品规格/局部测试与未验边界；产品Vue/CSS、API、权限、后端/Worker/Python、SQL、依赖、环境配置均未改变，OpenAPI/.env无需同步，无迁移、发布、重启或新增调节项。起点5个清单经差异归属与验证后作为本计划E01收尾一并精确提交，不混入不明来源文件。PLAN/PAGES不为规格数量变化重新编制。按需求拆解、无障碍与Playwright永久测试流程工作；已展示A/B结构图并请求明确方向意见，审核文件打开请求返回queued，不声称用户已看到面板或通过方案。

新增临时目录仅 `D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\ui-phase2-competitor-contracts-20260907`（3份.last-run）及 `D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\ui-phase2-backdrop-evidence-20260907`（2份.last-run）。两目录绝对路径、非链接属性及只包含预期文件核对后，以非递归逐文件/空目录删除成功，最后exists=false；旧12批历史目录未动，不绕过此前拒绝操作。所有本轮采集/测试/审核服务已退出，4101/5173无监听；审核图/记录与永久测试为交付物保留。

下一步继续E03的P21/P22供应与费用规则两页，并按当前竞品CP-G01–CP-G06优先级逐项复现和修复，不只增加截图或测试数量。全站正式新稿仍待方向决定，后续W02–W09的图、Vue、真实验收、宝塔部署与用户签收均保留；J07质量门业务决定独立于风格审核。

## 2026-09-07 · PLAN 1.9 F01供应/费用规格与两项真实交互修复

上一轮3a886d3交付计划1.9，本轮从main/3a886d382000af8be7efad7e738eb7caf849cf76干净工作树开始实际实施F01，不再次编制计划。依AGENTS、Feature Map、蓝图3.4.1/3.6，追踪SourcingWorkspace/Dialogs/Comparison/CostConfirmation与CostRuleConsole，再追共享OpportunityProfitPanel/CostReviewQueue、API路由/服务/仓储。新增P21/P22两份十项独立规格及sourcing-cost-contract-review.md；只读scanSource逐项核对77个控件/事件、7个弹窗定义/调用、44处v-model和七个LF源码SHA。规格28/73，剩45份；这不是28页全新视觉实现，G0未冻结，正式方向和用户通过0不变。

新增永久UI2-SC01–SC06共9实例，复用原m04-04与m04-06夹具。SC01先在旧版失败：成本规则已生效但新版本入口不存在，页首非ready与准备度无active两个条件把所有创建入口同时隐藏。CostRuleConsole仅扩展为管理者且(非ready或active)时显示页首按钮，保留ready且无active的原入口，仍走原草稿API/空费用/双角色审批。SC01最小复测通过（15.2s），覆盖取消焦点/重开清草稿、四显式0和精确POST、保存仍draft；SC02只读active无入口及安全返回，SC03本人角色/revision冲突/原因保留/取消零重放。

SC04四类输入验证required、取消清create但保留草稿、精确两字段POST；SC05锁定quote版本、MOQ 100/99禁提交、取消重开、trim原因和queued；SC06用六条隔离报价复现第六checkbox假勾选：界面六框checked但selectedQuotes仅五个。新增九例首轮8通过/SC06失败（31.0s）。SourcingWorkspace.choose接收change事件并把原生checked同步到实际集合，不改变2–5规则或请求字段；SC06最小复测通过（15.9s）。两个问题都有修复前失败证据，不是仅凭源码猜测。

最终两模块原15例加新9例，桌面24项通过（32.1s），390移动24项通过（36.3s），无失败或跳过；两个.last-run均passed且failedTests为空。原有两项toHaveScreenshot也执行通过，没有更新旧截图基线。实际运行包含原报价非UTC时刻、报价缺项/只读、机会成本入口、规则双审批/分页/拒绝/回滚与利润呈现；不能称真实数据库、来源采集、Outbox、采购消费或生产全链通过。SC-G01–SC-G08记录预填/variable标签、对比读取与文档差异、提交竞态、焦点/错误、异步归属、历史/多市场/反馈、成本时间与完整设计/真实验收，不因本批局部通过关闭。

build:web包含typecheck通过，407模块、10.62s，正常dist与浏览器助手包保留为项目运行输出；frontend-budget通过251资源。组件边界单测1项通过，文档门通过73路由/60受保护/6角色/153文件，运行文档一致性通过，静态分析389文件通过，format:check通过changed=4/production=495/repositories=51，git diff --check通过。未重跑未改变的其他模块或Node/Python业务测试，不把局部验证当全站G3。第一次文档路径探测引用了不存在的顶层文件，随即用rg --files定位真实docs/architecture与docs/runbooks；未创建替代文档。Feature Map一次补丁上下文不匹配未生效，读取真实行后重试成功，没有改业务字段。

产品仅改两个Vue局部条件/事件，Feature Map增加规格索引及准确未验边界，成本架构与两份运维文档同步入口、上限交互和发布要求。API字段、权限、SQL、Node/Worker/Python、费用算法、依赖、主题/CSS和环境变量均不变；OpenAPI/.env无需同步。修复本身只需更新前端静态包，无新增参数及后端重启要求；正式发布仍由python scripts/deploy-baota.py统一执行，须核实既有迁移记录与宝塔停启窗口。本轮无迁移、部署或生产连接。

全局生成清单和旧图库仍绑定060e0b5/caf0574f33b1c91a446e6a7784bc954fc6d926d44ba5b349df538190304eff8d，未重新宣称当前有效。新局部合同已记录SW/CR当前hash、旧→新候选映射及行号；产品提交后需按实际影响刷新全局源证据，不能只改哈希冒充复验。不重建PLAN/PAGES，不在未批准方向时生成冒充正式成果的同风格图。下一批是证据一致性收尾及F02 P25/P26审批/通知；若有正式方向意见则安排F05代表新图→Vue闭环，完整W00–W09不缩减，J07仍是单独业务待决。

需求拆解技能用于两页合同与状态分层，无障碍技能用于按钮、字段、焦点及已复现交互的验收，按计划明确的永久回归要求使用Playwright现有测试体系。本轮唯一临时目录为 `D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\ui-phase2-sourcing-cost-contracts-20260907`，12个文件：六轮.last-run与两次红灯各自的截图/trace/context。非递归逐文件/空目录清理命令被工具策略拒绝，未绕过；随后只读确认目录存在、12文件、无ReparsePoint，未入Git，需要手动清理。旧12批临时目录不动。所有本轮测试/构建工具均已结束，4101/5173监听数0，无服务交接；永久测试、规格及合同保留。

## 2026-09-08 · PLAN 1.10 F02审批/通知合同与可复现交互修复

从main/a4e0eed干净工作树开始实施，不重新编计划。依AGENTS→Feature Map→蓝图6.3→ApprovalWorkspace/ApprovalQueuePanel/NotificationCenter及真实API路由、服务、仓储，新增P25/P26十项规格与approval-notification-contract-review。三组件65候选逐项映射（59控件/事件、6弹窗），17处v-model，八份相关源文件LF哈希可复核。规格30/73，剩43份；正式全新方向仍pending、用户通过0，不能把规格数视为重设计完成率。

先执行R00只读inventory --check，确认现有baseline过期；工具返回明确ui_phase2_artifact_stale，不是已通过。随后推进不依赖正式风格的F02合同与修复，待产品源稳定后统一刷新受影响全局证据；本批没有重写旧图库SHA或假称R00完成。

永久回归AN01/AN02两实例/AN03先在原代码四项均失败：审批详情关闭按钮未获焦点；模板和发起表单提交后必填所在details仍闭合；通知在途时按钮disabled但Escape关闭了详情。修复将审批aside改为原生dialog并接入既有useModalDialog、局部Tab边界循环和真实遮罩坐标关闭；表单invalid捕获展开最近details，不绕过required；通知closeDetail补busy保护，与既有按钮一致。增加AN04验证409提示在审批详情内可达、原因保留、精确reject/reason/expected_version且取消不重放。审批规则、当前审批人和证据门槛不变。

首次修复复测2通过2失败：原生Tab到浏览器焦点未形成要求的循环，补审批局部边界处理；测试的审批人select嵌套选项导致exact标签不匹配，改为与既有测试一致的部分标签查找，未改产品字段。五项定向最终通过18.9s。AN01随后补:modal、窗口内空白不关闭、真实遮罩关闭及返回焦点，双视口最小验证2通过20.6s。

全模块首轮桌面15通过/1截图失败36.6s；实际查看expected/actual后发现原生dialog继承全局blur与通用dialog边框，修正局部级联，不覆盖共享样式。第一次视觉复测仍差36752像素，定位html[data-design]低特异性与后加载dialog[open]并列优先级，再以当前设计令牌局部恢复；桌面单项通过14.7s且旧基线未改。移动首轮15通过/1截图失败31.0s，恢复原响应式max-width后差异仅4274像素（约2%）；实际查看原图、实图和差异，确认是旧底部导航盖住详情而原生顶层消除遮挡。只更新m05-02-approval-workflow-mobile-390-win32.png这一张永久基线（单项16.0s），不是批量接受截图，不代表正式新风格获审。

最终当前代码下审批/通知/实时三个模块原11例加新5实例，桌面16通过34.5s、移动16通过33.4s；两份.last-run均passed、failedTests为空。覆盖原模板创建/发布/发起/只读/深链/双击、通知分类/处理/旧参数/邮件禁用和SSE游标回归。没有真实数据库、Worker升级、Outbox投递或生产复验；AN-G01–AN-G07记录读取/写入归属、URL全部状态、偏好草稿、其他窗错误与焦点、真实范围和正式全站设计验收。

最终build:web（含typecheck）通过，407模块11.38s，frontend-budget通过251资源；组件边界1项、文档门73路由/60受保护/6角色/153文件、运行文档一致性、静态分析389文件、格式门changed=5/production=495/repositories=51均通过。随后唯一测试补充已用Prettier核对；65候选行号/sig与八源hash逐项一致，P25/P26各十节，git diff --check通过。未重跑不相关Node/Python或全站业务测试，没有宣称全站G3。

产品仅改ApprovalWorkspace、其局部CSS、NotificationCenter；同步Feature Map两个规格索引、两份运行说明及永久测试。OpenAPI/权限/接口字段/SQL/Node/Python/依赖/环境变量没有变化，不需配套修改。修复自身仅更新前端静态包，无单独后端重启要求；正式发布仍按既有宝塔部署器核对迁移白名单、恢复材料和停启窗口。本轮没有部署、迁移、生产连接或发送真实通知。

需求拆解技能用于逐页动作/数据合同，无障碍技能促成原生模态、必填可达与错误提示修复；按实施计划明确的永久回归要求复用Playwright测试，不新增依赖。本轮唯一临时根目录`D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\ui-phase2-approval-notification-20260907`开始前不存在，结束清点56文件、0 ReparsePoint；已解析核对准确路径后，删除命令被工具策略拒绝且未执行，未重试或绕过。目录仍需手动清理，未入Git；旧13批不动。所有测试/构建进程终止，4101/5173无监听；正常dist和浏览器助手运行输出保留，永久规格/合同/测试与单张基线保留。

下一步先按稳定产品提交推进R00全局清单/关联证据一致性（当前仍是060e0b5旧源，不冒充有效），再F03 P27/P28自动化/报表，后续W04–W08剩41份。若有正式方向意见，进入F05代表图→Vue闭环，不等待其余规格全部写完。W00–W09完整范围、全部按钮/弹窗/图、真实验收和用户签收保留；J07仍是独立业务决定。

## 2026-09-08 · PLAN 1.10 R00当前源证据一致性收尾

从main/4b835881c081af808713c76af323d866993f44c9干净工作树开始，本批只更新清单、局部来源说明及实际重新采集的审核证据，不再编制计划或修改产品。全局五个生成物经生成器及只读检查通过，产品源绑定4b83588，指纹`fad2a485b462fd89b20dca92bda5b944683bea63cbc263c5ad3d64b4f60fb591`；73路由、1377控件/事件、100弹窗候选，763原生按钮、57原生dialog，3处运行时警告。规格仍30/73、余43，G0未冻结、G1–G5待定、用户通过0。

与HEAD旧候选逐对象断言：除F01/F02已改的CostRuleConsole、SourcingWorkspace、ApprovalWorkspace、NotificationCenter之外，所有动作/弹窗候选完全一致。目录外54项及13份相关源码哈希通过真实核对，再更新source-scope的全局关联指纹；54候选、42语义动作、1原生确认、6无渲染入口仍保持原运行时边界。历史自动来源对应704→703，原因是审批详情aside改为dialog，旧dialog-1未自动匹配；approval-notification-contract-review追加旧92496ba501468962.1→新1e3aa75fca121f17.1的D-AN-APPROVAL人工对应，未篡改生成器或把全部变体标通过。G0仍须消费人工归并记录。

SCOUTOPS_UI_PHASE2_CAPTURE=1仅在本次测试进程开启，复用既有七个采集用例：评分版本/审批限制/只读空态、权限矩阵/范围/资源授权/表单/撤销/空目录、系统异常/刷新失败保留/恢复。桌面7项通过28.5s，移动7项通过27.9s；两份.last-run均passed且failedTests为空。真实重采36张Vue基线及36份来源记录，再生成代表图库；不是将旧图手工更新版本。仅两张P31-resource-grants像素哈希变化，布局记录相同；人工查看当前新到期时间为2026/09/15 00:14、00:15，源中仍为Date.now()+7天的动态输入。其余34张图像素一致，仍由本次测试实际采集。

任务基线与注入CSS研究流程分别实际采集18图、14案例；现有proposal流程连带重采12张独立任务A/B研究图，三组图像素哈希与旧版全部一致。保持fixture/not-production/not-approved与pending-user-review边界。另76张独立评分/权限/恢复与控件研究图未重采，来源及图像哈希校验通过。没有增加新方案数量或伪造正式设计认可。

代表图库在1440/390两视口逐张加载36图通过，控制台错误0、外部请求0、页面横溢false。审核台实际重新采集双视口证明图与manifest，73路由、筛选、批注导出、焦点与44px控件检查通过；隔离浏览器意见由脚本清除，不触碰用户意见。独立代表研究图库76图在两视口验证通过，错误0、网络0。清单/目录外范围/任务研究单测18项通过；文档门73路由、60受保护、6角色、153必需文件通过，git diff --check通过。本批无产品/测试源码变化，不重跑已有效的F01/F02业务回归、类型构建或全站业务测试，以上不证明真实后端、生产或正式全套重设计完成。

本批采用需求拆解技能确定R00边界及退出证据，按计划已要求的永久采证流程使用Playwright。Vue/CSS、API、权限、SQL、Node/Worker/Python、依赖、配置、Feature Map、OpenAPI、.env、PLAN/PAGES均未修改；无新运行合同或调节项，无迁移、部署、生产连接和重启要求。用户风格与J07业务决定仍独立待审；下一步F03 P27/P28自动化/报表，随后W04–W08剩41份，不以R00收尾替代W00–W09完整交付。

唯一新临时根目录`D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\ui-phase2-r00-evidence-20260908`开始不存在，仅产生桌面/移动两份.last-run；路径、条目数4及无链接属性验证后，通过PowerShell精确逐文件/空目录删除，最终exists=false。旧14批已交接的临时目录未动，不重试被拒绝的历史删除。全部本轮采集、测试和图库验证进程正常退出，4101/5173/5181无监听，不留服务器；重新采集的图片和记录是永久审核交付物，保留在design-plans内，不上传生产。

## 2026-09-08 · PLAN 1.10 F03自动化/报表规格与预览归属修复

从main/3aaf061干净工作树开始，按Feature Map的automationRules/reportsExports追目录、NavigationShell、两个Vue、真实API路由/服务/仓储和蓝图队列边界。新增P27/P28两份十项规格及automation-report-contract-review.md，33候选逐项映射（30控件/事件、3dialog定义）和10处v-model；候选sig、行号与六源LF哈希可复核。规格32/73、剩41份；不是32页正式重构完成，G0未冻结、用户批准仍0。

AR01/AR02先在原实现失败：修改次数后旧预览仍在，关闭并新建后旧响应填回新窗。AutomationRuleCenter仅增加表单/窗口/编辑对象/URL的同步失效序号，预览成功、错误、finally均校验当前归属；旧结果不回填、旧回调不改变新忙碌状态，字段改变后需要手动重新试运行，不自动执行或重放写入。现有api-client及完整请求字段保持，POST预览仍只读；API、Worker、限流/循环规则、权限不变。

RP01首次关闭后迟到用例通过；补等待初次报表完成、响应完成及200ms负向稳定窗口，最终改为检查原生详情元素不存在后仍通过。本轮未据静态可疑点修改ReportCenter；所有详情/后台/离开/跨范围乱序仍列RP-G01未关闭。该200ms仅为测试防即时负断言抢先通过，不是产品超时或性能证据。

新增永久AR01–AR04、RP01–RP03共7例，复用原夹具。AR03必填不发写入、三模板之一/任务循环保护/创建完整payload及幂等头；AR04暂停和恢复按返回version与原固定人工原因。RP02下载失败耗尽读取重试后人工再下，核验建议文件名及真实fixture CSV字节，并由download.delete清除临时下载；RP03保持null平均值/时间、空series与精确trend/csv请求。最初AR03的getByLabel同时命中region和select，改为真实combobox角色；随后断言误忽略可访问名“则 动作”的空格，再按真实快照改为唯一动作combobox，不改产品标签。RP02首轮仅中断一次GET被原api-client自动重试成功，因此未出现错误；读取0/150/400ms三次安全重试实现后改为持续失败至用户重试，不把自动重试误报为产品缺陷。

最小预览修复与加强RP01三例通过22.0s；新四例首轮2通过2测试设计失败，修正后AR03/RP01/RP02轮2通过1定位失败，再修正定位，当前AR01/AR02/AR03三项通过18.0s。最终两个完整模块原6例+新7例：桌面13通过33.5s、390移动13通过34.1s，无跳过；两份final .last-run均passed/failedTests为空。既有移动用例内部仍有弱容错断言，不能凭13项通过宣称全无障碍/视觉覆盖。未改任何历史截图基线，未产生正式新图，局部fixture不证明真实数据库/通知/文件系统/生产。

build:web含typecheck通过，407模块10.89s，frontend-budget通过251资源；组件边界单测1项通过；文档门73路由/60受保护/6角色/153文件通过，运行文档一致性、静态分析389文件、format门changed=3/production=495/repositories=51均通过。局部33候选、两页各十节和当前源码hash内联检查通过；未重跑不相关Node/Python业务或全站回归。全局清单/旧图库保持4b83588来源，不将此局部预览修复写成已重新采证的版本，后续产品源稳定后按实际影响刷新。

同步Feature Map两个规格索引/未验边界、自动化架构及运行手册。只改AutomationRuleCenter的预览读取与本批永久测试/文档；ReportCenter、CSS/主题、API/SQL、Node/Worker/Python、依赖、OpenAPI、.env均不改，无新增调节项或后端重启要求。正式发布仍通过python scripts/deploy-baota.py核对既有迁移白名单与宝塔停启窗口；本轮没有生产连接、迁移、部署或真实外发。

需求拆解技能用于两页输入/动作/退出证据，无障碍技能用于必填、可访问名称、模态返回焦点与待验项；按计划明确的永久测试要求复用Playwright。唯一新临时根目录`D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\ui-phase2-automation-reports-20260908`开始不存在，结束22文件（7份.last-run、5次失败各自截图/trace/context）。检查准确绝对路径、无ReparsePoint、所有文件名及最终通过记录后，通过PowerShell逐文件/空目录删除，最终exists=false。旧14批不动；全部测试/构建/验证进程结束，4101/5173无监听；正常dist与浏览器助手包保留，不入本提交。规格、合同及测试是永久交付物。

下一批F04先补组织治理缺失P29/P30/P32–P37共8份，复用P31；然后平台账号权限及采集/数据/运维其余33份。正式方向审核、J07业务决定与全部旧未验项仍保留；有方向意见即进入F05代表图→Vue闭环，不等41份规格全部写完。完整W00–W09、所有按钮/弹窗/适用状态、正式图、真实验收、宝塔部署和用户签收不缩减。

## 2026-09-08 · PLAN 1.12 H00/H01组织治理规格与明文展示收尾

组织批从main/9828743起实施；33fe9c2仅更新计划且保持14个在途文件原样，本轮依H00/H01接续其实际diff并完成局部验证。新增P29/P30/P32–P37八份十项规格，复用P31；organization-governance-contract-review逐项映射八组件108候选（105控件/事件、3共享原因窗调用）及54处v-model，14份前端/共享辅助/CSS的LF SHA-256与实际文件一致。内联检查首轮误将绑定表数量6算作sig，限定候选表后108逐对象比对通过，不修改清单来迁就检查。规格累计40/73、尚缺33份；正式重设计、冻结语义分母、用户通过并未因此增加。

按真实路由/组件/API链纠偏：P34审批治理与P35组织数据只有读取入口，P33团队没有后续编辑或归档接口，P32没有编辑工作区；不据旧PAGES概念文案补造功能。GET tokens现有仓储会将到期active置expired并递增version，零浏览器POST不证明数据库绝无写入。模板updated_desc实际按current_version排序，数量与质量、null行数与0行、成员停用与账号锁定分别保留。全站矩阵及图源的关联纠偏列OG-G04，待稳定源增量证据批统一处理，不只改hash冒充重采。

产品仅修改OrganizationAdminCenter的一次性明文显示：独立展示代次在KeepAlive离开、卸载、页面/组织身份变化及主动清除时失效，只有活动tokens页同代次的写响应能填明文；去掉写后刷新后的第二次赋值。前段实施已在原代码复现缓存返回、迟到POST和清除期间刷新三类重新显示；历史red/导航定位失败与真正secretPanel=1的失败分别记录在合同，本轮没有重新改回旧代码。请求不取消、不重放，API、scope、有效期、权限、事务、幂等和后端持久化规则均未改变。

新增UI2-OG01三时序及OG02/OG03/OG04共6实例：精确创建payload/单POST/两次GET；原因窗初焦点、Escape取消零写入与焦点返回、角色409保留选择；审批首版/只读及数据null/0；轮换新ID与版本、撤销、空原因/取消和复制拒绝。全部采用既有隔离API合同夹具与合成明文，不创建真实令牌、不写系统剪贴板。OG01的两次GET断言证明真实SPA返回复用缓存，不通过reload或脚本改DOM绕开生命周期。

完整组织桌面首次34项通过（1.1m）。移动首次30通过/1跳过/3失败（2.4m），三个失败均来自测试助手用isVisible判断屏外抽屉已经打开；实际查看失败截图和navigation-shell-scoped.css的translateX(-105%)，按真实菜单按钮aria-expanded打开后再点导航，不改产品壳层。修正后移动定向4项通过24.6s；最终移动完整33通过58.2s、1项原有审计12秒超时用例按项目规则跳过，该项桌面已经通过。最终测试助手在桌面受影响4项复测通过22.2s，其余桌面30项代码/用例未变，复用本轮完整结果，不无变化重跑。三份最终.last-run均passed且failedTests为空；原测试中部分自行设置视口、令牌热区只断言38px，这些既有局限不作为全站44px或全无障碍达标证据。

build:web含typecheck通过，407模块10.85s；frontend-budget通过251资源，组件边界单测1项通过，文档门73路由/60受保护/6角色/153文件通过，运行文档一致性、静态分析389文件、格式门changed=2/production=495/repositories=51通过。八页各十节、局部候选/输入数、引用链接、Feature Map JSON及14源hash通过实际核对。未重跑无关Node/Python业务，也未宣称全站G3、真实MySQL/Redis/审计投递或生产通过；没有更新任何视觉基线，没有产生正式新风格图。

同步Feature Map组织模块索引及架构/运行说明。未改CSS/主题、P31实现、API/OpenAPI、数据库/SQL、Node/Worker/Python、依赖或环境变量；无新增调节项。修复自身仅需以后更新前端静态包，不新增后端重启要求；正式发布仍须按既有宝塔部署器核对迁移白名单、停启窗口和恢复材料。本批没有部署、迁移、生产连接或真实邮件/第三方调用。需求拆解技能用于八页实际合同，无障碍技能用于焦点与错误验收；按已批准实施计划的永久测试要求复用Playwright测试文件。

唯一自建临时根目录为`D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\ui-phase2-organization-governance-20260908`，属于本组织批前段测试延续；最终43文件（10份.last-run、11份失败context、11张失败图、11份trace），21子目录、0 ReparsePoint。精确路径核对后删除命令被工具策略拒绝，未执行、未重试或绕过；随后只读复查43文件仍在，需要用户按该精确目录手动清理，未入Git。旧14批目录不动。全部测试/构建/检查进程正常退出，4101/5173无监听；正常dist与浏览器助手运行包保留，规格、合同和永久测试保留。

下一步R01按稳定产品源核对增量证据，F04继续W05 P38–P45八份规格（40→48），随后W06/W07/W08；F00有明确意见即优先F05代表新图→Vue闭环。OG-G01–OG-G06完整读写归属、全部原因窗/URL历史/复制归属、真实后端与正式新图仍待完成，J07仍是独立业务决定。W00–W09完整目标与用户逐页签收保持，不能将本批局部安全修复和规格收尾表述为第二阶段完成。

## 2026-09-08 · PLAN 1.13 H02账号详情读取生命周期

从main/658d054接续唯一在途账号E2E差异（111增1删，三例UI2-PA01），核对原red-detail三项失败及实际父/子组件、缓存壳层、API客户端和后端路由。原实现迟到成功/错误不检查当前打开对象，详情展示使用detail而写入目标使用selected；关闭甲再打开乙或重新打开甲均能被旧响应覆盖。此证据是隔离Vue复现，不是生产误操作记录。

本轮先提供既有A/B任务列表研究图链接和代表审核入口，实际查看两张列表图，说明结构/样本密度限制，并提交异步方向问题，允许全部否定。没有收到具体图版本的通过意见，没有重新生成研究图、正式图或替用户选定风格；用户通过仍0。需求拆解技能用于H02范围，无障碍技能用于实际可访问名称与Escape/模态状态；按已批准计划的永久测试要求继续使用现有Playwright测试文件。

详情每次打开记录独立代次、用户ID及routePath；仅仍属于当前打开窗口的成功/错误可显示。关闭、同步routePath变化、KeepAlive离开及卸载使旧读取失效并清空详情/反馈。保留共享selected、原API客户端、全部写body和后端结果，不重放写请求。父页首次直接增加逻辑后触发既有850行组件边界失败；随后按职责抽出use-platform-user-detail.ts，父页833行、辅助模块63行，原父页阈值未变，新增辅助模块低于100行及装配测试。该抽取不是新服务、依赖或业务合同。

UI2-PA01覆盖旧成功、旧404、同用户重新打开三时序；UI2-PA02覆盖用户/管理员共享入口与平台概览KeepAlive的真实浏览器前进后退。两个历史用例首轮误要求概览GET仅一次，实际五次，其他详情断言已通过；读取query数组watch后改为直接检查返回后原dialog节点身份/isConnected证明缓存复用，不修改产品刷新行为。所有五例核对两次详情GET、零账号写入；迟到响应完成后200ms仅用于防负断言抢先通过，不是产品超时或性能结论。

首次详情三例通过18.2s，修正历史用例两例通过17.0s；未抽取前两个完整视口均21项通过52.2s，但组件边界失败未提交。抽取后最小五例通过20.9s，最终完整桌面21通过52.2s、390移动21通过52.5s，无跳过；两份extracted-final .last-run均passed、failedTests为空。没有更改截图基线；现有测试的覆盖局限保留，不能据这21项宣称全无障碍或所有平台读写已验。

最终build:web含typecheck通过，408模块10.86s；frontend-budget通过251资源，组件边界单测1项通过，文档门73路由/60受保护/6角色/153必需文件通过，运行文档一致性、静态分析390文件和格式门changed=4/production=496/repositories=51通过。局部合同七份源码LF SHA-256与Feature Map入口通过实际核对，diff检查通过。未重跑无关Node/Python业务、真实MySQL/Redis、全站G3或生产；历史全局清单及图库保持4b83588来源，R01仍须按稳定产品源核对增量。

新增platform-account-detail-contract-review.md，同步Feature Map、架构与运行说明，明确旧0036历史说明不授权本次UI更新或回退执行Down SQL。未改CSS/主题、API/OpenAPI、SQL/数据库、Node/Worker/Python、依赖或环境变量；无新增调节项，修复自身仅需以后更新Web静态包，不新增后端重启要求。正式发布仍由既有宝塔部署器核对迁移白名单、停启窗口和恢复材料；本批没有部署、迁移、生产连接、真实邮件或第三方执行。

本批临时根目录`D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\ui-phase2-platform-accounts-20260908`接续早期三例red材料，最终24文件（9份.last-run、5份失败context、5张失败图、5份trace）、14子目录、0 ReparsePoint。精确路径核对后删除命令被工具策略拒绝，未执行、未重试或绕过；需要用户按该精确目录手动清理，不入Git。旧15批目录不动。测试、构建和验证进程均结束，4101/5173/5181无监听；正常dist及浏览器助手运行包保留，不作为临时产物删除；合同和永久测试保留。

H02详情GET局部修复与验证已交付；PA-D01写完成后的窗口归属、PA-D02概览/筛选/组织记录边界和密码表单、PA-D03其他卸载及权限链、PA-D04全套规格/正式图/生产仍待完成。独立规格仍40/73，缺33份；下一步F04 W05 P38–P45及上述相关合同，之后W06–W08。F00得到意见即优先F05正式图→Vue，J07业务决定仍独立；第二阶段整体目标、全按钮/弹窗及用户逐页签收没有缩减，也未标完成。

## 2026-09-08 · PLAN 1.14 F00-C新结构研究与P43事实规格

从main/1ad9db7干净工作树开始，本批实施而非再次编制计划。先读AGENTS、Feature Map、蓝图平台账号边界及真实父/子组件、GET辅助模块、账号API路由/服务；查看旧P43概念图，明确它不是当前Vue或生产截图，商品列表/批量分配等不作现有业务依据。为了尽早交付可审新结构，先以事实已核对的P43做F00-C研究并完成其规格；W05其余七份仍待补，没有称四个入口族全部完成。

新增design/account-direction-c的独立HTML/CSS/JS原型，改变旧账页大编号/横向模块索引/巨大页头，采用蓝色范围与创建区、账号目录、身份/访问分区详情。移动压缩范围，常驻关闭，提议直接进入详情及把组织授权移到独立弹窗；均为未批准设计提案，没有改现有Vue行为。原型仅使用8个example.test合成账号、3个本地组织，固定角色与现有字段边界；所有确认只显示明确演示反馈，不调用API、不写数据库/权限/密码/浏览器存储、不发邮件或第三方请求。样例间状态组合不代表新业务推导规则。

实际生成18张永久研究图：目录、详情上部/访问区、新建、创建失败、原因、密码、组织授权和无结果各桌面/移动。目录/空态整页，其余视口截图，避免全页捕获导致backdrop仅覆盖首屏的取景误导。查看桌面目录/详情及移动目录/访问区/创建失败，修正移动详情常驻关闭及中文字体。已向用户展示新目录图并提交方向审核问题，未收到通过记录，仍pending-user-review；未默认否定或采用旧A/B，18图不计入正式图槽位或通过页数。

永久脚本verify-ui-phase2-account-direction.mjs复用Playwright，--capture实际检查场景、44px可见热区、整页无横溢、搜索/重置、总量不受过滤影响、详情身份、原因窗Tab/Shift+Tab循环与层级返回焦点、必填邮箱、密码长度、条件组织角色、演示提交零新增及演示成功后密码清空；两个视口均通过，控制台错误0、外部HTTP请求0。evidence.json记录12份源的LF哈希、18张图哈希、场景caseId、视口、采集时间、浏览器、win32与CSS字体族。sourceRevision为采集起点1ad9db7，新研究文件实际内容由sourceHashes明确标识；不是声称这些未提交文件已包含在起点提交内。

首次采集因原型重置按钮id=reset遮蔽HTMLFormElement.reset失败；更名filter-reset后通过。强化键盘用例先因关闭和取消两个data-close匹配导致定位失败，改按可访问名；再证实原型末尾Tab不稳定返回首项，补原型内显式循环后最终双视口通过。中途源变化/采集失败时--check确实因旧manifest与源哈希不同拒绝，最终重新实际采集后--check通过；未只改hash绕过失败。未修改生产useModalDialog或称其全量焦点已验。

新增P43十项规格及platform-user-design-contract，四个直接组件33候选逐对象sig、9处v-model通过扫描器比对；父入口与共享抽屉/表格等另列W05待补，不以33当完整语义分母。原因窗11个本页语义变体有清单，但研究图与检查没有覆盖所有变体/六态。规格41/73、缺32；局部链接25处、源码/测试入口及图片存在检查通过。全局baseline/actions/dialogs/coverage和旧图库保持原来源，G0未冻结、用户通过0，R01仍须增量核对。

文档门通过73路由/60受保护/6角色/153必需文件；静态分析门通过390生产文件，格式门通过changed=1/production=496/repositories=51，并对四个新研究/验证源码显式Prettier处理与语法检查。全站静态门本身不覆盖独立HTML研究，研究运行由上述浏览器脚本验证。未重跑未改变的Vue构建、H02业务E2E、Node/Python或真实数据库/生产，不把本地HTML等同真实Vue、权限或审计验收。

Feature Map只增加P43研究/合同索引和未验边界；产品Vue/CSS、API/OpenAPI、数据库、业务规则、Node/Worker/Python、依赖、.env均未改。无需新增配置、迁移或重启，本批没有部署。需求拆解技能用于规格与行动合同，frontend-design用于新构图，无障碍技能用于焦点/标签/错误，按计划的永久采证要求使用Playwright。正式风格、移动展示变化与J07仍分别待审，下一步先消化意见；无意见时继续P38/P39、P40–P42、P44/P45七份事实规格及共享清单，再W06–W08，不等待全量文档才推进获审代表Vue闭环。

本批未新建临时验证目录、下载或测试日志；原型、README、18张截图、manifest、规格与合同均为永久审核交付。浏览器由try/finally关闭context/browser，所有命令已退出，未启动HTTP服务器，4101/5173/5181无监听。旧16批临时材料未触碰、不重试被拒绝清理、不宣称已清理；无新增需交接的临时文件或后台进程。

## 2026-09-08 · PLAN 1.15 W05平台八页事实合同收口

从main/c5d647c干净工作树实施A1–A5的事实规格和局部候选盘点；不是再修订计划。新增P38/P39/P40/P41/P42/P44/P45七份十项规格，复用P43并补交叉链接。规格总数41→48/73，剩W06八份、W07八份、W08九份共25份。P38平台观察、P39概览、P40组织目录、P41两步创建、P42资料/状态、P44可授权账号、P45只读比较分别说明任务、字段、拟议编排、动作/弹窗、状态、URL/异步、可读性及验收槽位；拟议编排不是正式图通过。

新增platform-account-contract-review.md：11本族Vue文件112候选/23绑定，其中复用P43四文件33候选/9绑定，新增父/其他入口79候选/14绑定；四共享组件再补16候选/1绑定，实际核对128候选/24绑定。逐对象sig与真实扫描结果相符，form/button和定义/调用不重复算业务动作；S预览四类型、T动态列4/5/5/3、Q筛选与X复制各有调用差异。扫描器未识别Q动态role模态，人工补记，不修改扫描器抬高计数；六native定义、两个共享模态族及14种已识别共享原因变体各自记录，运行时/全站分母仍未冻结。

实际父/子和API/服务/仓储核对确认：dashboard读取附带审计；成功率null不等于0、队列柱宽不是利用率、empty只统计部分字段；组织详情只有过滤/200上限的概览来源，无独立GET，最小创建响应缺计数而旧组件回退1；admins含未赋角色用户；角色比较只有读取、两角色并集与本地过滤，无权限保存；创建组织/用户不带人工reason，与旧蓝图笼统描述不同。本文不以文案需求补API/字段。PA-D01写回调、PA-D02列表/密码/详情、PA-D03真实权限及新增共享无障碍/历史/事实待验条目没有因规格完成而关闭；没有做浏览器复现，不将源码疑点写成已复现缺陷。

永久只读脚本verify-ui-phase2-platform-account-contract.mjs通过：八页十节及精确路由、128候选、24AST输入绑定、32份产品/路由LF源哈希和16个本地链接。通过注入只读reader在内存做八项反向检查：重复候选、漏候选、错误绑定、源内容变化、漏hash、规格缺节、错误路由、断链均按预期拒绝，随后正向再次通过；没有落盘测试夹具。脚本语法与显式Prettier检查通过。该脚本验证静态记录一致性，不验证人工语义/全量交互，也不改变review状态。

既有C方向--check通过18图与源/图哈希，approval仍pending；未重采未变化研究稿。文档门73路由/60受保护/6角色/153必需文件通过，静态门390生产文件通过，格式门changed=1/production=496/repositories=51通过，diff检查通过。另核对磁盘48份规格与25份缺失、Feature Map新索引。产品Vue、API及环境未改变，不重复运行H02旧21项E2E、构建、真实MySQL或生产；全站静态门不覆盖本脚本的人工语义，所以另有正反向检查。

Feature Map仅补全族规格/脚本索引；P43合同及H02历史说明只追加已补规格的当前归属，不覆盖其源证据。未改产品Vue/CSS、API/OpenAPI、SQL/数据库、Node/Worker/Python、依赖、.env、PAGES、全局清单或图源；无需配置、迁移、部署或重启。需求拆解技能用于逐页十项合同，无障碍技能用于名称/焦点/键盘/错误和共享消费者验收；本批没有新的正式视觉交付。

本批未创建临时文件、目录、测试日志、截图、下载或浏览器/服务进程；所有验证命令已正常结束，内存反向测试没有外部写入，永久规格/合同/验证器保留。旧16批材料未动、不重试被拒绝清理、未入本次提交；不声称历史材料已清理。下一步先处理具体风格意见；未获审时可继续PA-D01隔离复现或W06事实规格，获审即优先代表正式图→Vue闭环。完整W00–W09、全按钮/弹窗、生产和用户逐页签收仍待完成，目标保持进行中。

## 2026-09-08 · PLAN 1.16 S0用户详情四类写入归属收口

接续8503d74后的PA-D01实施改动；中间65fd32a只更新两份计划并保留6个在途文件。本轮按main/65fd32a的实际diff、Feature Map、父/子入口、详情辅助模块、API及历史失败材料核对，不重新实施已提交H02或W05规格。上一目标回合提交计划为进展，本轮推进S0代码验证与证据收口，不再次修订计划；全站规格仍48/73、剩25，用户正式方向尚未通过。

原实现已有两个隔离red复现：甲账号状态写成功后，乙窗口被替换回甲；甲加入组织成功后，乙详情出现甲的“普通成员组织关系已创建”。本轮复核其error-context与在途差异，不把历史red当生产事件。captureDetailAction复用详情代次、账号ID及routePath，状态、平台角色、会话撤销和加入组织四类写操作捕获归属；原因确认前及成功/错误反馈、后续详情重读前检查仍为原窗口。关闭、切换账号、同账号重开、共享路由和KeepAlive离开均使旧结果失效。已发写入继续原事务与概览刷新，不取消、不自动重放、不改目标/body，也不把关窗说成后台撤销。

永久UI2-PA03共24个实例：四类操作各成功/失败×切乙/留甲16个；组织关系关闭/同ID重开4个；平台角色共享路由/缓存概览离开返回4个。断言当前身份/alert/status、精确详情GET序列、单次POST、目标路径、完整body及非空Idempotency-Key；缓存路径还检查同一DOM节点复用。UI2-PA04验证未提交角色原因窗换路由后确认零写入。200ms只用于等待迟到回调的负向观察，不是产品超时或性能阈值；所有返回采用明确隔离夹具，不执行真实账号/角色/会话/数据库写入。

前段定向记录为切人8例、扩展24例与原因1例通过，本轮读取expanded/reason-targeted的最终passed记录。随后原21例加新25例完整模块串行运行：desktop-chromium 46通过（1.5m），mobile-390 46通过（1.4m），无跳过；两份final .last-run均passed且failedTests为空。正常窗口成功/失败反馈与原创建、筛选、角色目录、详情链共同回归。没有覆盖全部角色/单会话变体、真实授权/持久化审计、屏幕阅读器或全站视觉，不以92项通过声称G3全站通过。

build:web含typecheck通过，408模块、Vite构建11.11s；frontend-budget通过251资源，组件边界1项通过且父850/辅助100阈值未改；docs通过73路由/60受保护/6角色/153文件，runtime-docs、static-analysis 390文件、format changed=3/production=496/repositories=51通过。未重跑无改动的Node/Python业务全套，也未使用生产环境。W05合同只读验证通过8页、128候选、24绑定、32源和17链接；仅父与详情辅助源hash更新，语义表明确新保护及剩余项。

C研究关联产品源发生变化，实际执行verify-ui-phase2-account-direction --capture，再--check通过：18图、双视口、0控制台错误、0外部请求。sourceRevision为65fd32a，精确在途产品内容由sourceHashes绑定，不称它是干净发布版本。14张图字节不变，4张重新生成的图（1440-create/create-error/password与390-reason）已实际查看，表单、错误、焦点和操作区可见；这些仍为相同研究设计，不是新正式图或用户通过。研究HTML/CSS/JS未改，evidence manifest及实际变化图随本批保留；全局4b83588来源的清单/旧Vue证据不手改hash，R01继续待做。

同步P43/P44规格、用户动作合同、W05当前hash及增量说明、H02历史追溯说明、Feature Map和账号架构/运行手册。代码仅父入口及详情辅助模块，永久测试保留；未修改CSS/视觉、API/OpenAPI、SQL、Node/Worker/Python、依赖、.env或运行参数。无需新配置或单独后端重启；本批未部署，后续正式发布仍通过宝塔部署器核对既有迁移与Node停启窗口，不执行Down SQL。需求拆解技能限定四类操作与退出证据，无障碍技能用于真实控件名称/模态反馈，按计划永久回归要求使用Playwright。

本批临时根为`D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\ui-phase2-platform-write-20260908`，含red/targeted/expanded/reason-targeted及本轮desktop-final/mobile-final；最终12个文件（6份.last-run与2次red各自截图/context/trace）。只读确认准确路径、无ReparsePoint及文件清单后，PowerShell精确递归清理调用被执行策略拒绝，命令未运行；不换工具、不重试绕过，目录保留且未入Git。旧16批材料未动；现在另外保留此一批，不能声称临时材料全部清理。所有测试/构建/研究采集/验证进程均结束，4101/5173/5181无监听；正常dist及浏览器助手运行包保留，不纳入源码提交。

S0四类写归属技术验证通过，临时清理因策略受阻已交接；不代表全部PA-D01解决。密码/创建/组织资料状态回调、共享原因窗自动关闭及PA-D02/03仍按S1验收；没有具体审图意见时可继续B1来源/采集八页事实线，方向获审则优先F05正式图→Vue闭环。全部W00–W09、全按钮/弹窗、正式图、真实后端/宝塔与用户逐页签收仍待完成，目标保持进行中。
