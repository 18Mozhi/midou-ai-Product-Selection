# P16 创建选品旅程 · 输入、续办、候选与决定合同

2026-09-09 r2复核：第9节为c31fddc7统一质量门后的当前源码映射；[JOURNEY-C-r2](design/journey-direction-c/README.md)现67整页场景及102代表控件状态双端共338图；[控件审核](P16-CONTROL-STATE-REVIEW.md)列明40适用槽及8导航不适用。第1–8节为历史，不以旧hash或旧文案覆盖新规则。整体布局已批准，具体控制状态仍待用户。 新增[字段审核](P16-FIELD-STATE-REVIEW.md)，5个源绑定的8控件变体已有状态图与隔离交互验证，生产未改。

2026-09-09 规则实施更新：用户已明确[统一五项质量门](JOURNEY-ADOPTION-DECISION.md)，P16 本地实现复用 P18 判定，前端缺门阻断/提示与后端锁内复核、候选质量门 DTO 均已加入，保存成功清除旧错误态。下文第1–8节和 P16 动作JSON为改前源码快照，不能再当当前源身份或新采纳门的视觉证据。最新范围与测试见该决定文档及 PROGRESS；旧图未静默换绑，视觉稿重采/逐动作审核仍待继续。

2026-09-08图稿接续：[JOURNEY-C-r1](design/journey-direction-c/README.md)48场景双端96图，零业务弹窗；具体稿待审。实际函数执行复现decide成功仍state=error、reset保留decision.reason，提案清理尚未修Vue。J07仓库直接adopted与P18五门冲突仍在，本轮再次请用户选择；采纳成功图/实现暂未交付，不把禁用审核控件当生产规则变化。输入、观察驳回及恢复可继续推进，不注销J07–J10。

日期2026-09-07；N03；main/d0c1bb6；[页面规格](page-specs/P16.md)。源码入口为NavigationShell → SelectionJourney.vue → selection-journey-routes.ts → selection-journey-service.ts → mysql-selection-journey-repository.ts。当前产品源指纹沿用c4c1cd7f5470ab3896d355c7e16e49f7b5e291e48809e18eeabbf18198766183。本批只补规格/合同/隔离回归，不改旅程业务、生产样式或已审状态。

版本说明：第1–6节保留N03/42aee26的盘点快照和旧行号，不是后续修复后的当前源码声明。N04读取修复后的行为及证据见第7节；生成清单和既有图仍绑定原源码，待独立证据刷新后重新定位，不只改哈希冒充重验。

## 1. 必须先区分的业务合同

- P16的创建是POST /api/v1/selection-journeys，202后保存旅程ID，不是P15手工POST /opportunities，也不等于已经创建了机会。输入三种，但服务端均选择已有启用且合规的google_news_search，target包含query/input_kind；不因输入ASIN/商品URL就承诺直接采到对应平台商品价格。
- 创建API要求task:create，读取要求opportunity:read，决定要求opportunity:decide，写入还校验Origin与幂等键。当前页面路由只列opportunity:decide，组件不接收capabilities分别隐藏创建/读取/决定；真实拒绝仍由后端执行。不能把平台管理员或前端允许作为普通成员真实授权通过。
- **规则冲突待用户决定**：旅程decide在采集任务终态且所选范围内证据有topic_id时，adopt会创建/复用机会，写opportunity_decisions并直接把机会decision_status/lifecycle_status更新为adopted；未调用机会详情的五项质量门检查。这与蓝图3.4及P18“recommended且all_passed才可采纳”的边界不同。本批不统一或删改规则，不把它解释成“仅生成待决策候选”。已向用户询问统一质量门还是保留独立旅程规则，未回复前不改这部分后端/产品行为。
- observe/reject不会生成机会，但当前repository仍为三种决定都INSERT IGNORE一条selection_verification任务（48小时期限、指派当前actor），再保存旅程决定与事件。页面只在返回verification_task_id存在时显示链接。不可笼统说观察/驳回没有任何任务副作用。
- GET /selection-journeys/:id不是数据库纯只读：超deadline且采集任务仍非终态时，会在事务内把旅程标为blocked并登记事件/Outbox。浏览器零POST只证明没有发写入请求，不证明服务端无持久化变化。deadline固定180000，UI重设计不放宽。

## 2. 控件候选与表单输入

SelectionJourney本地10个控件/事件候选、0弹窗候选。下列尾键的完整candidateId前缀均为apps/web/src/components/SelectionJourney.vue#。两个form submit与其按钮归并到同一业务动作；共享UiStatePanel的主/次按钮按调用方展开，不能漏掉恢复入口。5个v-model位置另列输入实例，扫描候选没有自动覆盖全部radio。

| 行 | 候选尾键 | 语义ID / 结果 |
| --- | --- | --- |
| 247 | feb47750cbf8d6c2.1 | J-NAV-LIST：RouterLink /opportunities |
| 249 | ea132f1592801c04.1 | J-STATE-PRIMARY / SECONDARY：按当前journey与错误类型处理 |
| 257 | 59498db8867f4665.1 | J-CREATE：form submit |
| 300 | 09bdfc68bbfc5530.1 | J-CREATE：忙碌禁用按钮，同一动作 |
| 371 | ffaf47bf1a32fcaf.1 | J-SOURCE：每候选原文外链，target=_blank、noopener noreferrer、click.stop |
| 405 | 5704caf4d4e8cd9d.1 | J-DECIDE：内联form submit，三动作变体 |
| 444 | 1e10e5e77e7fc48e.1 | J-DECIDE：忙碌禁用按钮，同一动作 |
| 452 | 2982f925c629be51.1 | J-NAV-OPPORTUNITY：仅返回opportunity_id时到P18 |
| 455 | d3e6b84b6df72d56.1 | J-NAV-TASK：仅返回verification_task_id时到P24 |
| 464 | 2c481a724f0e9b09.1 | J-RESET：清当前展示/活动ID，回输入，不取消后台任务 |

| 输入语义 | 现有字段/条件/校验 | 请求与草稿行为 |
| --- | --- | --- |
| J-KIND（3个radio） | input_kind=keyword/asin/product_url，默认keyword，原生radiogroup名称“输入类型” | 切类型不清input_value；非业务写入，不新增Provider选择 |
| J-INPUT（一个动态输入，3种状态） | input_value required≤200；keyword为text；ASIN pattern十位字母数字；URL type=url，UI文案HTTPS但原生type不强制HTTPS/禁hash | 创建body只有input_kind/input_value，前端传原输入，服务端trim并验证HTTPS、无账号密码/hash；ASIN服务端不强制转换大写 |
| J-CANDIDATE（动态radio） | selectedResultId来自results，空数组才回退first_result；单候选自动选，多候选须显式选 | 当前选择存在则保留；换数据失效后仅单条自动选；topic_id为空显示不能生成机会并禁用adopt radio，不代表禁止观察/驳回 |
| J-DECISION（3个radio） | decision.action=adopt/observe/reject，默认observe；终态且未decided才显示表单 | POST /selection-journeys/:id/decisions，body为action/reason/selected_raw_evidence_id；adopt发选中ID或null，observe/reject始终null。没有expected_version字段，不从P18复制该字段 |
| J-REASON | required≤1000，原生textarea，无字段级错误关联 | 服务端trim并检查1–1000；失败保留，成功清原因。reset当前未清decision.action/reason，需要J09复核，不能默认新旅程没有旧草稿 |

**全部为内联表单，当前没有业务弹窗。** 后续若获审视觉需要新弹窗，必须补相应变体、焦点及关闭合同并扩大分母，而不是伪称已有弹窗完成。候选原文链接嵌在radio label内，鼠标与键盘下是否意外改变选择需要独立测试。

## 3. 读取、状态、轮询与恢复

| 当前阶段 | 前端表现和实际依据 | 写入/恢复边界 |
| --- | --- | --- |
| 未创建 | 两字段创建表单，state初始ready | 成功202才applyJourney；错误保留表单。busy只禁用按钮，函数没有提前busy guard |
| 恢复中 | onMounted读取localStorage活动ID；合法UUID v4才GET，state=loading | localStorage只存ID，不存输入/候选/权限；读取storage本身在try之外。初次恢复时journey仍null，创建表单仍可见且busy=false，恢复与新建竞态待J08 |
| accepted/running | 时间轴与服务端elapsed_ms向上取整秒；两秒setTimeout读取已有journey.id | 非实时本地计时器；每次成功load后才schedule。没有后台定时服务或新的SSE。任务非终态即使已有证据，服务端仍accepted/running，不因“首个结果”标题提前允许决定 |
| result_ready | 服务端采集任务终态且候选存在，呈现最多20候选 | available_result_count是任务计数，候选数组最多20，不把两数当同一口径；停止页面轮询，出现三种决定表单 |
| succeeded_empty | 无候选且任务真实空终态，明确空结果 | adopt禁用；observe/reject服务端仍需任务终态；不构造假证据 |
| blocked/failed | 无候选时终态说明、真实blocked_reason/owner/next_step；failed无结果的旧标题也显示“受阻” | 旅程超时blocked但task仍非终态时，前端显示决定表单而后端会409 selection_result_pending；需明确区分旅程终态与采集任务终态，不自动降级为可决定 |
| decided | 返回决定及可选机会/验证任务链接 | 移除活动ID，停止轮询，原因清空；不自动导航。决定成功目前未设置state=ready，先前写入错误面板可能仍留在成功页，J09待验 |
| 恢复404/非法ID | 移除活动ID并恢复输入 | 404不发新建请求；其他恢复失败保留ID并显示错误。服务端ID接受UUID v1–5，浏览器仅v4；当前create用randomUUID(v4)，不擅自扩展前端存储格式 |
| load请求失败 | 记录kind/actionHint/requestId，保留journey对象 | 本次失败不自动再schedule；已排timer或并发读取的归属需J08核对。刷新是GET，可触发服务端超时登记，不自动重发create |

界面层state与journey.state是两套状态；conflict/rate_limited转blocked，其他ApiClientError.kind沿用。UiStatePanel只有非ready且非loading时显示；加载缺少独立state面板不等于没有请求。

共享恢复按钮目前存在语义差异：primary无journey时reset、有journey时load，不会根据“重新登录/返回工作台”自动导航；secondary blocked只解释影响，forbidden只提示联系管理员，其他才history.back。恢复失败且尚无journey时，点“重试”实际会清活动ID而不是resume；这些是待修/待验，不当作理想新设计。未知网络错误的“任务未创建/决定未写入”只是当前文案，不证明服务器事务没有提交。

## 4. 范围、缓存与副作用

- 路由/opportunities/start的cachePolicy=reset_on_scope；NavigationShell使用KeepAlive。组件只onMounted(resume)/onUnmounted(stop)，无onActivated/onDeactivated或请求归属判断，不能直接宣称离开即停止轮询、回来一定重新拉取。正常卸载clearTimeout不等于取消在途GET，旧响应还可能applyJourney并重新设timer，需J08复现。
- 活动ID使用一个全局key `scoutops.selection-journey.active-id`，不按账号/组织/工作区分key。服务端按当前会话范围拒绝，但跨范围404会清此全局key；多标签/登录切换/存储异常恢复均待验。不可为省事把业务对象或凭证写入浏览器。
- reset仅清journey/state/message/input_value/selectedResultId/活动ID和timer；保留input_kind、decision.action/reason、requestId，且不取消任何后台任务。进行中也有“开始下一次”，不等于重放或取消原采集。
- create服务端先检查活动组织/工作区、启用来源及public_page/public_rss条款状态/引用/版本/有效期，再在同一事务写任务、子查询、来源运行、旅程、事件与Outbox。重复同key可查operations复用，但前端每次显式重试由共享客户端生成新key；不保证“服务器已提交但响应丢失”后的再次点击绝不重复建任务。
- decide服务端锁当前范围旅程、拒绝重复决定/非任务终态，adopt还核对当前task证据及topic；对已有topic机会可复用并追加决定。详细采纳业务与五门冲突仍待决定，测试中的adopt成功不能替代这项产品确认。
- 老m07-06首例observe夹具返回了opportunity_id，与真实repository非adopt不生成机会的行为不一致；它的标题“real result”只表示隔离Vue流程，不是生产证据。本批不修改该既有采图/测试源，新增J04用准确null机会与返回验证任务补充，后续证据刷新时修正旧夹具并重验。

## 5. 可执行验收卡

本批永久tests/e2e/ui-phase2-journey-contracts.spec.ts共9例；原m07-06三例只作既有局部回归。所有新增响应均为隔离夹具，输入/返回结构源于实际service类型及Vue；不连真实来源/DB/生产。结果以PROGRESS为准，下面“新增”不是自动passed。

| caseId | 精确步骤与预期 | 覆盖层 |
| --- | --- | --- |
| UI2-J01 keyword/asin/product_url | 选择类型→空提交required零POST→ASIN短值拒绝→填合法值→POST仅两字段、原大小写/关键词空白→202后显示服务端结果、保存ID、多候选未选禁adopt、无dialog | 新增3例；不验证HTTPS服务端拒绝或来源真实采集 |
| UI2-J02 | 非UUID活动ID→打开页面→删除该key、输入可用；旅程GET/POST均0 | 新增1例 |
| UI2-J03 | 合法活动ID→GET精确ID返回404→清key、回输入、无自动POST | 新增1例；不证明其他key或跨租户持久化 |
| UI2-J04 observe/reject | 恢复结果→选择候选→选择决定→空原因零POST→提交原原因且candidate=null、不携带version→201显示服务端决定、无机会链接、有返回验证任务链接、清活动ID | 新增2例；不触发采纳冲突的业务变更 |
| UI2-J05 | 创建503→保留input/不存活动ID/不自动重放→再次点表单提交→精确同body及不同幂等键→202显示结果 | 新增1例；不认证响应丢失时服务端去重 |
| UI2-J06 | 创建accepted且无候选→无决定表单→两秒GET原ID→服务端result_ready/elapsed=12000才展示结果与12秒→开始下一次清输入/活动ID、无新增POST | 新增1例；不认证长期轮询停止或真实180秒达标 |
| J07 采纳规则决策 | 对比旅程repository与P18门禁；用户决定统一或保留独立规则后，补真实持久化/复用/已有机会/错误版本及关联任务验收，同步双方生产消费链与文档 | 等待用户规则决定；禁止先改状态/SQL或用新文案掩盖差异 |
| J08 读取归属与续办 | 延迟resume→点击create、load→reset/离开/切范围、两个tab改key、缓存回来、storage异常；旧响应不能覆盖新旅程/重启失效轮询，恢复失败有准确重试入口 | 待复现与最小修复，不扩展持久化规则 |
| J09 表单/恢复完整性 | 失败决定→重试成功应清错误；新旅程不能误带旧action/reason；非HTTPS/凭证/hash URL与字段错误、blocked-but-task-running决定拒绝；shared按钮文案和实际导航一致 | 待复现与必要交互修复；安全校验以真实service为准 |
| J10 完整图与真实验收 | radio键盘/候选链接不误选、标题/代码中文化、焦点/错误关联/忙碌/缩放/软键盘、四视口三主题两密度；真实普通成员、来源准入与事务、180秒证据、隔离清理和生产版本 | 后续正式设计/实现/验收；本批不作最终通过结论 |

## 6. 交付边界与下一步

P16十项规格和合同让N01–N03的P14/P15/P16/P18四份规格均有实际文件（P17复用），累计22份、余51份。N04仍需按各族合同未验项整合，不等于五页最终图/实现已完成；G0未冻结，G1–G5待验，用户通过0。API、权限、SQL、运行配置、依赖、产品Vue/CSS和源码指纹不变，Feature Map仅加复核索引；不部署、不迁移、不重启。正式新风格仍待审核，J07独立业务决定不能代替视觉审核。

## 7. N04读取生命周期修复与剩余边界

起点main/42aee26。五个永久复现用例在旧产品上全部失败：JR01离开后两秒仍读取（期望1次实际2次）；JR02两变体返回缓存页后无第二次读取；JR03重置后迟到响应重新显示旧旅程；JR04失败恢复的主按钮没有重新GET。用例采用真实Vue、隔离API，并故意移除目标GET的AbortSignal以验证响应归属，而不是仅靠网络取消隐藏问题。

当前修复只在SelectionJourney处理读取：mounted/activated通过active标志去重，deactivated/unmounted停止timer并递增读取版本、取消GET；重新激活根据当前旅程或保存ID读服务端。readJourney的成功、错误、404清ID和finally释放reading均检查active及读取版本。reset及新写入使旧读取失效；仅active且非终态才排下一次轮询。恢复失败主按钮明确“重试读取进度”，再次读保存ID而非reset。读取中显示aria-busy，恢复创建按钮显示忙碌原因，create/decide均以reading/busy保护；保存期间reset禁用，不自动取消/重放任何POST。

| caseId | 直接证明的边界 | 不证明的边界 |
| --- | --- | --- |
| UI2-JR01 | 非终态离开超过2秒无新增旅程GET，缓存返回一次读取获得新终态，零旅程POST | 隐藏浏览器标签页省电策略、真实服务器定时副作用 |
| UI2-JR02（200/404） | 恢复读取中按钮禁用/aria-busy；离开返回后新结果可见，再释放不可取消旧响应不能覆盖新结果或清活动ID | 全部登录/组织/工作区切换、多标签共享存储竞争 |
| UI2-JR03 | 在途轮询时开始下一次，旧响应不能恢复旧对象/活动ID；无创建或决定写入 | 取消后台采集或写入期间离开/切范围 |
| UI2-JR04 | 读取500后显式重试原ID并恢复结果，错误面板清除，无自动创建 | 401重新登录、403权限恢复、存储读写异常 |

验证实际命令与结果见PROGRESS。本轮不修改既有J01–J06/m07-06夹具；全组回归用于确认三输入及决定请求未变。五项新测试不是J08全项关闭：多标签/storage异常、范围切换、在途写入归属和恢复副动作仍待验。J09旧草稿/决定错误清理、J10全可访问性和正式图仍待；J07质量门冲突未获用户决定，不动业务规则。源码更新后的生成清单、候选位置与图源一致性是下一步独立刷新任务，不能继续宣称旧指纹当前有效。

运行交接：只需后续正式发布时替换前端构建产物；无后端、Python、数据库、依赖或环境变量改动，不需要服务重启/迁移；当前没有部署。不新增可调节参数，轮询间隔仍为既有2秒。布局、配色及主题ID不变，新增忙碌文字不是正式重设计交付。

## 8. 16f524b后的源码清单与证据刷新

当前生成清单sourceRevision为16f524b66cf9dd48384c6cd78c475409ec5dd493，sourceFingerprint为92f0bffbe1a11fcce4d49c6e4fea83acc12eccb5045de9f33d078d34f5bc7504；SelectionJourney源码SHA为928808169759964ae801e50eb7b20843dec35e8d00f10e1f01bd6329f96fc271。指纹还包含本批P06/P07/P09矩阵纠偏和button-554人工源码对应，不只是产品文件SHA。第2节旧表保留历史；当前十项映射如下，完整前缀仍为apps/web/src/components/SelectionJourney.vue#。

| 当前行 | 当前候选尾键 | N03旧尾键 | 稳定语义ID / 本次变化 |
| --- | --- | --- | --- |
| 293 | feb47750cbf8d6c2.1 | 同左 | J-NAV-LIST；仅源码位置变化 |
| 295 | 8026812b48a68031.1 | ea132f1592801c04.1 | J-STATE-PRIMARY/SECONDARY；恢复重试分支与主按钮文案更新 |
| 304 | 8c00555eac0c2a19.1 | 59498db8867f4665.1 | J-CREATE；同一submit=create，表单内忙碌文字改变签名 |
| 347 | 8471b8c4a13a52ef.1 | 09bdfc68bbfc5530.1 | J-CREATE；新增reading禁用与恢复文案；旧button-554经精确label/attributes关联 |
| 418 | ffaf47bf1a32fcaf.1 | 同左 | J-SOURCE；原文链接不变 |
| 452 | 5704caf4d4e8cd9d.1 | 同左 | J-DECIDE；三变体请求合同不变 |
| 491 | dc2377b526f68954.1 | 1e10e5e77e7fc48e.1 | J-DECIDE；新增reading禁用 |
| 499 | 2982f925c629be51.1 | 同左 | J-NAV-OPPORTUNITY；返回链接不变 |
| 502 | d3e6b84b6df72d56.1 | 同左 | J-NAV-TASK；返回链接不变 |
| 511 | 283a41d530253e0d.1 | 2c481a724f0e9b09.1 | J-RESET；busy禁用，读取中仍可重置并使旧GET失效 |

五处v-model、零本地弹窗未变；其他1367控件候选及100弹窗候选逐对象与刷新前一致。目录外54候选及其13来源哈希另经现有验证器核对，未改语义或运行通过状态。旧704项再次全部有源码对应，不代表全动作已运行。

本轮用既有采集流程实际重采任务18张Vue基线、18张注入CSS研究图、关联12张独立任务A/B图，以及评分/组织权限/系统状态36张Vue基线；审核台两图也实际重采。没有P16最终设计图、生产图或新增用户通过；这些不同证据类型不得互相替代。记录与检查结果见PROGRESS；旧图片和旧指纹可从Git前一版本追溯，不修改其历史记录。

## 9. c31fddc7统一质量门后的当前源码映射

SelectionJourney.vue LF SHA-256：05f5b3a2e469960bd8132bc4d3c8883bfab0b01df1952c96eadc64629b153c03。十处候选仅保存按钮签名变更；同一form签名未变不代表内部采纳合同未变。五处模型、三个内联结构、零业务弹窗；8语义组不新增总动作。当前候选前缀 apps/web/src/components/SelectionJourney.vue#。

| 当前行 | 当前候选尾键 | 本轮核对 | 稳定语义ID |
| --- | --- | --- | --- |
| 339 | feb47750cbf8d6c2.1 | 返回列表，不取消任务 | J-NAV-LIST |
| 341 | 8026812b48a68031.1 | primary读取原ID，secondary按现有状态解释/返回 | J-STATE-RECOVERY |
| 350 | 8c00555eac0c2a19.1 | create表单，三输入与原body保持 | J-CREATE |
| 393 | 8471b8c4a13a52ef.1 | 创建submit，busy或reading禁用 | J-CREATE |
| 464 | ffaf47bf1a32fcaf.1 | 原文安全新开，不等于radio默认行为全验 | J-SOURCE |
| 498 | 5704caf4d4e8cd9d.1 | decide表单，新增canAdopt函数保护及成功清错 | J-DECIDE |
| 537 | 56c9199d58a1af94.1 | 保存按钮新增采纳未达门禁用，旧dc2377签名失效 | J-DECIDE |
| 548 | 2982f925c629be51.1 | 按返回opportunity_id显示，不猜链接 | J-NAV-OPPORTUNITY |
| 551 | d3e6b84b6df72d56.1 | 按返回verification_task_id显示 | J-NAV-TASK |
| 560 | 283a41d530253e0d.1 | reset保留旧决定草稿，未取消后台任务 | J-RESET |

canAdopt要求topic_id、opportunity_id、recommended及五门和all_passed严格true；后端同范围机会锁内复核P18规则，冲突409拒绝。radio、按钮与submit函数都按该规则，改选不合格候选保留原因且不能提交原采纳选择。request仍为action/reason/selected_raw_evidence_id，observe/reject恒null，未新增expected_version。服务端成功后state=ready，reset草稿和在途写归属仍未修。

r2图中五项核对区整体布局已通过；原因错误关联、busy期间冻结输入、reset清空草稿、任务未终态禁决定仍为交互提案。恢复无ID主动作reset与有ID读取、error副动作history.back、expired无副按钮及blocked/forbidden仅说明已按源分支补图；更明确的“重新输入”文案及重试忙碌禁用不等于Vue已有。当前Vue48项隔离回归来自c31fddc7，新67场景/102代表状态原型不替代真实SQL竞争/RBAC/生产。
