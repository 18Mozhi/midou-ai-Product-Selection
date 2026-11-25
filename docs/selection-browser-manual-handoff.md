# 真实采集浏览器验证码接管

## 范围和行为

Amazon 公开采集在同一 Playwright 上下文内识别验证码并暂停，管理员在
`/platform-admin/collection/browser-runtime` 的“验证码人工接管”点击接管。
画面来自服务器当前浏览器，而非管理员本地 Amazon 标签页。可点击画面、输入验证码、
发送有限按键、滚动或取消；验证码标记消失、同源/无登录保护复核通过，且原有严格匿名账户链接
`Hello, sign in Account & Lists` 可见后，原调用自动继续。验证码节点暂时消失但正常页面尚未恢复时，
继续保留同一会话画面及人工操作，不把中间空白页或错误页认作验证成功。
不会因为接管结束就认定商品、来源或完整选品成功；解析、投递地、证据、评分、竞品、
1688报价和每日完成标准继续按真实结果验收。

页面本身返回503时先检测验证码，再处理HTTP失败；429仍立即停止，不进入接管。
普通503仍保留network_error。失败日志新增仅包含HTTP状态及Chromium标准网络错误码的诊断，
不记录原始异常、URL、页面内容、代理或凭证。没有验证码时不制造人工会话。

### 点击后再次出现验证页的诊断

失败回执增加两个最多10条的受限序列：`handoff_observations`记录opened、command_applied、
ready、expired及执行时长；命令只记click/text/key/scroll等种类，不记录坐标、键值或验证码。
`main_document_responses`记录主框架实际文档响应的状态码、受限HTTPS DNS主机名、
GET/POST/other方法和执行时长，不记录路径、查询、Cookie、请求或响应正文。
两者可区分命令未执行、提交后收到HTTP失败、再次进入验证页与正常恢复；没有观察到ready，
不得称验证通过。诊断回调失败不会打断人工会话；子资源仍使用原独立失败序列。
复核应使用原run回执及审计，不因相同验证循环反复要求用户点击。需要人工操作时才通知。
无新增API/env/数据库/依赖/权限或生产服务；需通过官方宝塔流程重启既有Node/Python。

## 运行与权限

### 旧验证码暂停后的自动接管与续跑

`AMAZON_PUBLIC_HANDOFF_RECOVERY_ENABLED=true`显式启用该行为（代码默认false）；
还需既有Amazon自动恢复开关、规范匿名档案和600秒浏览器总时限。
API现有恢复循环复用60秒轮询与300秒失败冷却，不增添服务。
只检查系统账号自己的真实待办、有效组织/工作区、已启用且条款有效的公开Amazon来源。
来源已有有效浏览器租约时不再发起探针；新登录、robots、权限、解析否定不会触发自动接管。
验证码仍由管理员处理，超时/取消仍记受阻；不会重放终态任务、改凭证或强行关闭熔断。

人工处理后，若最新真实健康回执为ready、晚于当前熔断及当前来源配置，并处于既有冷却时间
代表的新鲜窗口内，下一轮可复用这份正式健康回执恢复队列，不重复打开一个浏览器让用户再做验证码。
历史业务浏览器缓存、旧回执和将来时间不能触发此路径。否则执行原搜索加同商品详情的真实探针。
最终恢复事务仍重新锁定并核对来源版本、条款、同一熔断事件和晚于暂停的ready证据；
验证码例外只接受内部开关及公开Amazon身份，HTTP参数不能注入它，RSS与1688行为不变。

- 继续复用唯一宝塔 Node API 和 Python Crawler；不添加桌面服务、远程调试端口、依赖或数据库表。
- 接管接口只允许已有HttpOnly会话且具有`platform:superadmin`的管理员。
  写入要求同源与幂等键；命令幂等键须为UUID，同一命令在引擎内最多执行一次。
- 每个接管只允许一个管理员的一个登录会话；画面和命令均复核归属和有效采集租约。
  管理员不要退出后更换登录会话；失联或退出后等待当前接管过期，不强抢占。
- 只支持当前Amazon公开采集的验证码；不提供账号登录、任意导航、脚本执行、Cookie、
  档案导出或CDP地址。未知页面保持原受阻状态。
- 同一个真实浏览器页面最多等候300秒。`PLAYWRIGHT_RUN_TIMEOUT_SECONDS`在受限配置中设为600，
  让原有180秒总时限不会先于人工接管结束。现有合法范围10–600不变；低值会提前终止接管。
  Python原心跳持续保持租约；健康检查复用其最多600秒租约；失去租约后接口停止提供画面。
- 浏览器结束仍清理解密档案。接管画面和IPC仅保存在既有
  `RUNTIME_TMP_ROOT/browser-handoffs/{uuid}`（实际配置字段为`storage.runtimeTempRoot`；
  使用现有`RUNTIME_TMP_ROOT`配置，不增加变量），目录700、文件600，不纳入源码或发布包。
  正常结束立即删除，API每60秒清理已过期目录；崩溃遗留最多等到下一次API清理。
- 操作审计只记录会话、运行ID和命令种类/命令ID，不记录验证码文本或画面。

## 使用与部署

1. 本地构建并按AGENTS的正式部署脚本发布，同步前端、Node包及Python包。
2. 在宝塔受限`product_scout.env`把既有`PLAYWRIGHT_RUN_TIMEOUT_SECONDS`设为600。
   同时配置`AMAZON_PUBLIC_HANDOFF_RECOVERY_ENABLED=true`以自动打开暂停后的真实验证会话并在通过后恢复队列。
3. 通过宝塔重启Node `ai选品`和Python `ai选品-python`；前端刷新。
4. 真实来源健康检查或正常任务遇到验证码时，打开采集运行监控；接管画面中完成验证码。
   通过后自动继续原浏览器调用；健康检查须同时成功解析搜索与同一商品详情，才按原规则恢复来源。
5. 核对正式任务、采集证据和每日完成统计。低分、不推荐及明确利润未知可计入，但缺少真实主品、
   5–10竞品详情或实际匹配货源不能计入100个。

本地测试涵盖503/验证码检测顺序、429、同一页面续跑、临时目录清理、权限、同源、租约、
单会话互斥、路径/命令边界及敏感输入不入审计。测试夹具不代表真实验证码已通过或日百品已达成。

真实Chromium集成测试 `tests/integration/browser-handoff.test.mjs` 使用自有本地确认页，
验证503到真实截图、后台接管及点击/输入/回车、原上下文Cookie续跑和清理。它不处理第三方验证码。

正式前端的`apiBaseUrl`已包含`/api/v1`；接管组件调用相对`/platform/crawler-handoffs`，
截图地址沿用相同前缀，不能再次拼接`/api/v1`。上线须核对真实空状态与接管画面，不能只检查后端路由。

## 活动租约时间口径

接管列表、画面和命令的存活检查，使用与现有租约写入、续期和回收相同的应用 Date 参数，
不得混用数据库 UTC_TIMESTAMP 与连接本地时间的 DATETIME。仍要求真实 running 运行、同一 run_id 和未过期租约；
自动恢复探针排除已有活动浏览器时，也绑定同一 Date 参数，避免把人工会话误看成空闲。
不放宽权限、不改变租约时长或数据库时区。发布需重启现有宝塔 Node 服务，原人工会话结束后才发布。

## 业务采集外层预算

Worker 的 collection_tasks 调度时限由既有 PLAYWRIGHT_RUN_TIMEOUT_SECONDS 派生，
取原300秒与浏览器总预算加30秒的较大值（600秒配置对应630秒）；其中原浏览器客户端
已等待浏览器预算加10秒，其余时间用于回执和任务结算。疑似卡死观测阈值同步为外层预算两倍。
原180秒浏览器配置仍使用原300秒外层预算；其他队列、并发、重试、租约心跳、证据门均不改变。
不增加环境变量或HTTP字段；更新需重启既有宝塔Node Worker，Python预算仍使用同一既有配置。
该修复避免人工验证等待期间外层队列提前abort，不能解决Amazon验证本身拒绝或反复出现。

## 账号模式下已停用来源的人工诊断（2026-11-19）

正式端真实人工检查曾在创建浏览器前返回 crawler_profile_unavailable：账号路径错误地只接受 enabled 来源。
仅现有内部 manual=true 且没有 automaticTaskId 的 Amazon 健康检查可诊断 disabled 来源；仍锁定操作员自己的有效账号、
规范匿名档案、有效条款、原全局租约和权限。自动健康检查、普通采集、其他来源仍要求 enabled，探针不修改来源启停。

Amazon 页面发现 HTTPS AWS WAF token 域 challenge.js 节点时，按验证受阻进入原有最多300秒人工接管；
没有 handoff 时返回 blocked_captcha，不再误报普通超时。普通202无该标记不会制造会话。
这是识别并展示原页面，不是绕过验证：不执行求解、不增加外域访问许可、不修改脚本、不换出口或导入Cookie。
若原页面只显示空白/错误而无可操作控件，应记录真实受阻，不能以空白页当作验证通过。
原同源、禁止登录、严格匿名链接、投递地及搜索加同商品详情验收全部保留；只在真实通过后走既有审计恢复。

定向发布仅替换 Node 包中 packages/playwright-crawler/dist/index.js 和
apps/api/dist/mysql-crawler-runtime-repository.js，保留每日地区准备、趋势投影、AI等待、背压等全部既有模块。
使用官方协调入口 --collection-handoff-only；精确代码回退为 --collection-handoff-rollback，二者均需
--expected-previous-sha 和 --expected-module-sha256，哈希不符失败关闭。本地重建上一提交原模块，不在服务器创建回退副本。
发布只重启宝塔 ai选品 Node；不重启Python、不调并发、不直接修改数据库或配置。
无新增环境变量、HTTP字段、依赖或服务；前端现有 /platform-admin/collection/browser-runtime 接管区继续使用。

后续真实接管暴露账号 retired 模式的双重路由屏蔽（列表HTTP404）。正式账号模式现复用原接管接口，
rehearsal 仍不注册；不恢复独立旧版 acquire/heartbeat/complete 入口。原超级管理员、同源、有效租约、
独占登录会话与审计均不变。该配套仅发布 server.js 和 crawler-runtime-routes.js，使用
--collection-handoff-routes-only / --collection-handoff-routes-rollback，基线哈希不符拒绝，
保留前述引擎/账号人工探针模块。只重启 ai选品 Node，须等现有接管自然结束后发布。
此前只读诊断由root创建的空 amazon-delivery-context 目录已归还正式uid/gid1001，仍保留2700权限；
未放宽到其他用户，也不改配置、数据库、并发或Python进程。

## 用户授权的精确WAF资源，仅限已接管会话（2026-11-19）

实际空白页日志明确是本项目代理403 target_not_allowed，拒绝了
1c5c1ecf7303.eb59107c.us-west-1.token.awswaf.com，脚本随后 ERR_TUNNEL_CONNECTION_FAILED。
用户已明确允许仅在人工接管中加载该精确主机；不把空白页误称为源站没有控件。

默认、普通任务、无接管、尚未点击“接管验证码”、接管结束后，该主机仍拒绝。
只有现有超级管理员鉴权/同源/有效租约/独占会话/审计通过并持久化有效claim后，
当前Amazon页面同时具有HTTP202、x-amzn-waf-action=challenge及该精确HTTPS主机challenge.js节点，
才临时允许原代理CONNECT该主机443，并对同一页面进行一次正常重载以加载原站验证资源。
不放行父域、其他token主机、子域、相似后缀、IP或其他端口；不改请求头、脚本、TLS、出口、Cookie或验证逻辑。
这是正常浏览器执行源站提供的资源，不提供自动求解、令牌注入或成功伪造。

临时许可绑定原接管截止时间，最多300秒，不因接管点击延长。代理独立定时关闭该主机现有隧道；
成功、取消、错误及浏览器结束也立即撤销，普通Amazon连接不受该撤销影响。
正常200页面即使保留普通WAF集成脚本也不会被误判为再次验证；原验证码节点仍必须消失，严格匿名和原投递地/解析门继续检查。
重载遇429仍原样受限，不以验证码错误覆盖。HTTP字段、权限、环境变量和并发均不变。

只发布共享Node包中的 index.js、authenticated-proxy.js、manual-handoff.js 三个采集运行模块。
官方协调入口 --collection-manual-waf-only，精确代码回退 --collection-manual-waf-rollback；
均需基线提交和当前模块SHA，哈希不符失败关闭。保留既有账号接管路由、每日地区准备、AI等待、背压及趋势优化。
只重启宝塔 ai选品 Node；Python运行器后续调用现有共享Node包，无Python代码/负载或独立重启变化。
管理员通过现有“验证码人工接管→接管验证码”使用，无新调节项。来源仍停用，搜索和同一商品详情真实通过后才另走审计恢复。

## 地区重读的受限诊断（2026-11-19）

真实run bbe37789-a044-45ca-90cd-dbd4d6914fc5在人工接管后出现ready及200，但
request_delivery_reread仍失败。不能凭该阶段名推断邮编或匿名身份哪一个失败。
所有amazon_delivery失败阶段现复用既有delivery_state诊断：准确匿名链接数量/可见性及aria-hidden可见性、
邮编头存在/可见/与配置匹配、账号链接存在/可见/精确已知匿名文字、密码框存在、原弹窗状态。
只输出布尔值、数量及固定枚举，不输出页面文字、真实邮编、Cookie、URL或属性值。
仅既有anonymous错误精确字面量可标anonymous_missing，超时为readiness_timeout，其他为other；
观察最多750毫秒，失败返回null，不能改变原错误码、校验、来源状态或重试。
这是为查因的中间诊断，不是修复已通过或采集恢复。

官方 --collection-delivery-observe-only / --collection-delivery-observe-rollback仅替换共享index.js，
需原基线和模块SHA。只重启ai选品 Node，不改Python、数据库、并发、白名单、HTTP/API/env或依赖。
后续需依据真实诊断修复，再通过搜索及同商品详情后按原审计恢复。

## 地区重读后的严格匿名就绪竞态（2026-11-19）

诊断版一次真实检查在原标准下搜索48条并通过对应商品详情，说明旧故障非必现；
不能把自然恢复归因于只读诊断。旧失败现场未保留匿名/邮编快照，不能宣称唯一历史根因已穷尽。
代码中重读后直接isVisible会在DOMContentLoaded后匿名链接尚未异步渲染时立即报匿名失败。
真实Chromium本地同输入夹具已复现：邮编正确、精确匿名链接延迟300ms出现，旧版误失败。

仅在实际重读之后，若原精确匿名链接暂不可见，使用原actionTimeoutMs等待它可见，再复核原保护。
没有新增超时值、重试、重载或身份候选；初次匿名检查仍按原逻辑失败关闭。
缺失/其他身份仍失败，邮编仍必须在可见头部准确匹配；不是200、DOM就绪、地址接口200或Cookie就可通过。
原验证码/登录/同源保护继续复核，超时不接受缺失匿名，日志区分匿名和邮编阶段。
本地四状态覆盖延迟匿名成功、缺失匿名拒绝、不同身份拒绝、错误邮编拒绝；不访问真实源站。

官方 --collection-delivery-ready-only / --collection-delivery-ready-rollback只替换共享amazon-delivery-context.js，
校验现有index诊断、精确WAF许可和既有模块哈希，需原基线及模块SHA。只重启ai选品 Node，
不动Python/1688、数据库、白名单或并发，无新增API/env/依赖。来源恢复仍需最新真实搜索和同商品详情及既有审计。
已成功的当天地区缓存不清除、不强制重跑准备；次日自然首次准备稳定性需真实后续样本。

## 直接搜索结果就绪与邮编歧义诊断（2026-11-25）

Amazon直接 `/s?k=...` 任务没有 `plan.search`，旧版在DOM就绪后立即计数，可能把异步出现的真实结果记为空。
本地真实Chromium夹具已复现300ms延迟：旧版为空成功，修复后原选择器取得一项；不访问源站。
仅给该分支补上与交互搜索相同的原item_selector附着等待，沿用actionTimeoutMs；不新增请求、重载、重试或超时参数。
等待结束后原验证码/登录/robots检查继续执行；确实无结果仍保留原空结果契约，缺主体详情仍不能成功。
这是确定的本地搜索竞态修复，不声称已解释历史独立详情HTTP200无主体。

当天真实健康检查11221971-552b-4cf4-8554-7a546161a675在人工接管后到达200，
失败在request_delivery_postal，诊断中的精确匿名可见与邮编匹配都为true，不能误报账号或ZIP不正确。
为区分单节点内容与选择器歧义，仅增加头部总数、匹配数、匹配且可见数，以及原错误明确含strict mode violation时的固定selector_ambiguous枚举。
诊断仍限750ms和布尔/数量/固定枚举，不保存文字、URL、ZIP、Cookie或原始异常消息，不改变验收或错误码；尚未确认真实失败为重复头部。

官方入口 `--collection-search-ready-only` / `--collection-search-ready-rollback` 只替换共享index.js；
固定80ed59fce基线、输入/输出SHA并保护地区上下文、精确WAF许可、接管、AI等待、背压和趋势模块。
只重启宝塔ai选品 Node，不改Python、1688、数据库、并发、白名单、API字段、环境配置或依赖。
使用现有健康检查和人工接管入口，无新增调节项；真实搜索与同商品详情未通过之前，来源保持停用。

同日发布后真实run3708c499-fd37-49ee-87d9-3aa1be6eef58仍在request_delivery_postal失败，
头部总数/匹配数/可见匹配数均为1、匿名精确可见和ZIP匹配均为true，排除了当次重复头部歧义。
因此不改选择器或降低标准。补充固定navigation_context_lost/page_closed等错误类别与固定Playwright操作名，
只识别既知异常片段；未知仍other，原消息/URL/正文/凭证不记录，错误状态和验收完全不变。

run7f727e0b-37b4-4756-9daf-275def63a916仍为同阶段、单个可见匹配头、精确匿名可见，
既知导航/关闭/选择器歧义类别与操作前缀均未匹配。继续保留失败，不据此自动重试或启用。
诊断仅增固定运行方法/引用/属性缺失类别、白名单Error类型、至多4条固定项目/Playwright JS文件名及数字行列，
不输出绝对栈路径或消息内容；据真实错误代码位置定位，禁止凭假设修改校验。

真实run023c6872-df1c-4e81-b2ce-68343df4a8e5的受限栈定位到amazon-delivery-context.js:135，
即save内匿名Cookie集合验证失败，而非邮编或匿名DOM未通过。引擎在save前现在报告daily_cache_save，
避免沿用上一步request_delivery_postal标签。仅对精确cache_invalid增加受限750ms Cookie形状计数：
数量、认证标记数、不接受的域数、精确.www.amazon.com变体数、过期值/SameSite/字符/长度/path异常数；
不记录名称/值/域/path内容，也不改变原缓存读写或任何接受/拒绝规则。新类别daily_cache_invalid仍失败。

## 每日地区缓存的精确主机收紧（2026-11-25）

真实run0623bff2-e2d6-40fd-bbc9-edf9eb854a8b证明：匿名与ZIP均通过，9条实时Cookie中
只有1条使用精确.www.amazon.com表示，认证标记为0，其余字符/长度/过期值/SameSite/path均无异常。
旧save把该表示整体拒绝，真实失败是daily_cache_invalid，而非地区重读不成功。

仅在已通过原匿名与可见邮编证明的实时浏览器context.cookies快照写入前，将精确.www.amazon.com
复制为已接受的www.amazon.com主机表示；不修改实时浏览器Cookie、不丢弃任何Cookie、不改名称/值/path/属性，
不扩大允许域集合，不接受其他域、不规范化不可信持久化输入。旧缓存读取仍严格拒绝.www.amazon.com。
认证at-main/sess-at-main、外域、相似后缀和非法数据均保留原拒绝。每天一次与跨进程串行约束不变。

真实Chromium本地拦截页观察请求头证明：原域Cookie会发给child.www.amazon.com，规范化缓存不会，
但仍发送到www.amazon.com；没有真实源站请求。BrowserContext.cookies(url)仅按域后缀筛选，不能作为主机范围证明。
原版同输入cache_invalid，修复成功，回退再次cache_invalid；其他旧负例继续拒绝。

官方 --collection-delivery-ready-only / --collection-delivery-ready-rollback现在固定67eed207c基线与新旧context SHA，
仅替换amazon-delivery-context.js并保护当前index诊断和既有所有采集/接管/背压/AI等待/趋势模块。
只重启宝塔ai选品 Node，无Python/1688/数据库/并发/请求白名单/配置或依赖变化；无需调节参数。
不清除每日缓存、不强行启用来源；发布后原健康入口的真实搜索与同商品详情通过，才允许按现有审计恢复。
