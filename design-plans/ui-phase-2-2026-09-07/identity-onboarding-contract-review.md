# P01–P09 身份与入驻：逐页实施合同

状态：S03 源码语义复核及规格草案；不是新设计通过、浏览器验收或生产验证。复核基线 main / `6c0e090`，产品源指纹仍为 `c4c1cd7f5470ab3896d355c7e16e49f7b5e291e48809e18eeabbf18198766183`。本批不修改生成清单、冻结分母或登记用户通过。

## 1. 范围与真实入口

沿 `docs/feature-map.json` 的 localIdentity、mfaIdentityAdapters、authOnboardingPages、navigationShells，读取 route-catalog、App、router、四个页面组件，以及 auth-routes、tenancy-routes、navigation-memory。API 路径下文省略 `/api/v1`。

| 页面 | 路径 / 实际组件 | 进入与离开合同 |
| --- | --- | --- |
| P01 | `/` / LandingRedirect | 自动 GET `/me/landing`；返回 `/home` 时恢复最近成员路径，其他目标直接 replace；过期去登录，其余异常受阻 |
| P02 | `/login` / LocalIdentity | login；普通成功、MFA challenge、security-setup 三分支，不能统一画成成功直达首页 |
| P03 | `/register` / LocalIdentity | register；提交成功切为 verify，但 URL 不变 |
| P04 | `/forgot-password` / LocalIdentity | forgot；统一防枚举结果，不表示邮件已经送达 |
| P05 | `/verify-email` / LocalIdentity | verify；有 token 挂载自动提交，无 token 显示查收邮件 |
| P06 | `/reset-password` / LocalIdentity | reset；只输入新密码，无确认密码框 |
| P07 | `/security/mfa` / LocalIdentity | mfa；目录 acceptance=public，但 sessionRequired=true，路由守卫先读 session-status |
| P08 | `/select-context` / TenancyChooser | 目录无 sessionRequired；API 仍要求会话。组织→工作区→范围就绪；个人空间创建有独立分支 |
| P09 | `/onboarding` / OnboardingGuide | 无服务端进度；query step 初始化局部状态；跳过/完成都去 `/` 再确定落点 |

App 对 LocalIdentity 使用 `:key="routePath"`，不同路径切换会重挂载。组件 `switchMode` 只改局部 ref，不改 URL，不清输入；query 的 mode 只接受 login/register/forgot/verify/reset。mfa-challenge、security-setup 只能由登录结果进入，不能把 query 字符串当身份凭证。sessions 虽有模板与 handler，当前未找到公开入口；“查看安全会话”实际去 P11 `/me?section=security`，不进入该旧模式。

`enterApplication` 优先采用 query redirect 中 startsWith('/') 且非 startsWith('//') 的字符串，否则请求 `/me/landing`。这是实际代码分支，不应写成“所有登录一定先请求 landing”，也不意味着任意输入已完成安全验证。蓝图的入口总述未列此例外；本批记录差异，不更改跳转或安全规则。

### 旧矩阵纠偏与同步时机

PAGES.md纳入全局sourceFingerprint，改文字也会使既有图源合同过期。本批保留其历史基线，不只改指纹冒充重采；以下纠偏用于当前领任务，依据真实组件与新增逐页规格，不是待批准的新业务能力。下一次相关源/证据刷新时必须同步PAGES、生成清单及受影响证据，不能丢掉本表。

| 旧矩阵条目 | 当前实际情况 / 本次执行要求 |
| --- | --- |
| P06“确认输入、不一致输入” | 无确认字段；验证单个新密码长度、缺失/失效token、失败保留、204成功与返回，不实现不存在的确认规则 |
| P07“复制反馈” | 无复制按钮；验证现有绑定、确认、停用及敏感材料生命周期，不默认新增复制能力 |
| P09“已有进度” | 只有query初始化和局部step，没有持久化；验证刷新、非法步骤及跳过/完成到根入口，不把进度当存档 |

## 2. 38 个局部控件/事件候选的对应

前缀 L=LocalIdentity.vue、R=LandingRedirect.vue、T=TenancyChooser.vue、O=OnboardingGuide.vue；均位于 apps/web/src/components。候选键写为 `前缀#signature.ordinal`，可还原 actions.json 的完整 candidateId。行号是当前定位提示，不是稳定标识。actionId 为本批人工语义名，后续全站去重时保留引用；同一表单 submit 与按钮、同一 handler 的多入口不重复算独立业务能力。

| 候选键 | 行 | actionId / 分类 | 条件、行为与验收卡 |
| --- | --- | --- | --- |
| R#0c5f729c6e5f1db6.1 | 42 | ID-LANDING-CHECK | UiStatePanel primary→resolveLanding；加载时无按钮，受阻重读；I01 |
| L#9b4b982bf643379f.1 | 286 | ID-ROOT | 品牌→`/`；I01/I02 |
| L#2e7305c394f2d04e.1 | 357 | ID-FORM-SUBMIT | 按 mode 展开登录/注册/找回/重置/MFA挑战五动作；I02–I06 |
| L#4ea44facc4e04130.1 | 413 | ID-SHOW-FORGOT | login→局部 forgot，无请求/URL变化；I02 |
| L#e469057c327dc16e.1 | 417 | ID-FORM-SUBMIT | 表单按钮，loading禁用；与submit事件合并，非第六动作；I02–I06 |
| L#dc876249a8119b09.1 | 452 | ID-SHOW-LOGIN | verify结果返回；I04/I05 |
| L#3170fd522bb10adc.1 | 482 | ID-SEED-PASSWORD | must_change_password→changeSeedPassword；I07 |
| L#2f540419fadab817.1 | 494 | ID-MFA-START | 首次设置、需绑定且无secret→startMfa；I07 |
| L#6eba4c9b2b754a44.1 | 506 | ID-MFA-CONFIRM | 首次设置展示secret后确认；I07 |
| L#dc876249a8119b09.2 | 515 | ID-SHOW-LOGIN | 首次设置结束、恢复码后返回；I07 |
| L#2f540419fadab817.2 | 540 | ID-MFA-START | mfa未启用且无secret→startMfa；I08 |
| L#ea20d050ca8862b0.1 | 553 | ID-MFA-CONFIRM | mfa绑定确认；I08 |
| L#44386aa05f9251f5.1 | 576 | ID-MFA-DISABLE | mfa已启用→disableMfa；I08 |
| L#f29375268246ac09.1 | 591 | ID-LEGACY-SESSION-REVOKE | 旧sessions模板行，暂无公开模式入口；源码保留、运行入口待归并P11 |
| L#c29c165271e564d1.1 | 596 | ID-SHOW-REGISTER | 非register→局部register；I03 |
| L#170fb1546e423ddb.1 | 604 | ID-SHOW-LOGIN | 非login→局部login；I02–I08 |
| L#ba3feba8b42af0bf.1 | 612 | ID-ACCOUNT-SECURITY | RouterLink→`/me?section=security`；I09 |
| L#df188704ef470c64.1 | 613 | ID-MFA-ROUTE | RouterLink→P07，会话守卫适用；I09 |
| L#68d7e490dbe530cd.1 | 614 | ID-CONTEXT-ROUTE | login且success→P08；I02 |
| T#9b4b982bf643379f.1 | 146 | ID-ROOT | 品牌→P01；I01 |
| T#fbfed57848d7366f.1 | 155 | NONACTION-ACCOUNT | “当前账号”无handler/href，不登记为已实现账号菜单；I10 |
| T#5587941412d5210f.1 | 201 | ID-LOGIN-ROUTE | expired→`/login`；I10 |
| T#222cadb1072dc1d8.1 | 202 | ID-ORG-RELOAD | error/forbidden→loadOrganizations；I10 |
| T#9dde30dd57699c01.1 | 213 | ID-ORG-RELOAD | 无工作区→loadOrganizations；I10 |
| T#ecd9e9dbd8b34d05.1 | 217 | ID-PERSONAL-PROVISION | 无组织→创建本人空间、成功replace；I11 |
| T#d29e9f25fe7a5452.1 | 218 | ID-ACCOUNT-ROUTE | 无组织→`/me`；I11 |
| T#df188704ef470c64.1 | 219 | ID-MFA-ROUTE | 无组织→P07；I09/I11 |
| T#72a9593314273d39.1 | 232 | ID-CONTEXT-CONTINUE | selectedContext就绪→safeReturnTo；I10 |
| T#04d5594b96977687.1 | 237 | ID-ORG-RELOAD | 已选组织时返回组织，重新读目录；I10 |
| T#6f0aae6f4f0ea461.1 | 255 | ID-ORG-CHOOSE | 每组织实例→chooseOrganization，并行读工作区/团队；I10 |
| T#087b197306ae2192.1 | 274 | ID-ORG-CLEAR | 搜索无结果→清空query，无写请求；I10 |
| T#a556210b61698de6.1 | 278 | ID-WORKSPACE-CHOOSE | active且非selecting→POST范围；I10 |
| O#07db575ab56f90da.1 | 40 | ID-ROOT | 品牌→P01；I12 |
| O#7142f76fc59ad9ee.1 | 41 | ID-GUIDE-SKIP | 跳过→P01，不写完成状态；I12 |
| O#75986af56e7cd4f4.1 | 61 | ID-GUIDE-STEP | 三实例，step=index并更新aria-current；I12 |
| O#0728ff37173af0c0.1 | 72 | ID-GUIDE-PREVIOUS | step>1→previous；I12 |
| O#f74e91375a9aef9f.1 | 73 | ID-GUIDE-NEXT | step<3→next；I12 |
| O#176ac690f7c39e94.1 | 74 | ID-GUIDE-FINISH | 第3步→P01；I12 |

额外运行边界：P01 使用共享 UiStatePanel。blocked 默认还渲染“查看影响”次按钮，组件 emit secondary，但 LandingRedirect 没有对应监听；记录为 `NONACTION-LANDING-SECONDARY`，不假设它可打开影响详情。该候选位于共享组件，不加入上述四文件的38行分母；其余共享消费者留到壳层/通用状态批归并。

四文件在 dialogs.json 无原生定义/确认调用候选，源码无实际模态弹窗。MFA、首次设置、验证结果均是内联模式；不得为了图数凭空添加弹窗或把它们从状态图包排除。今后若选定稿改为弹窗，须补具体触发、焦点、关闭及秘密清理合同，不改变安全流程。

## 3. 输入、请求与成功事实

LocalIdentity有13个v-model源码位置，TenancyChooser有1个。前者按现有模式展开为16个输入实例：login2、register3、forgot1、reset1、challenge1、首次改密2、首次绑定2、普通绑定2、停用2、sessions0、verify0。另组织搜索1，共17个展开输入实例；共享ref不代表这些输入同时可见。

| 模式/动作 | 输入与实际请求 | 成功后的现状 |
| --- | --- | --- |
| login | identifier必填2–254；password必填12–128；POST `/auth/login` `{identifier,password}` | 202 mfa_required先challenge；security_setup.required先设置；普通结果enterApplication |
| register | email必填/email/≤254；password及confirmPassword必填12–128，仅此模式比较一致；POST `/auth/register` `{email,password}` | 201后局部verify；“进入队列”不等于邮件送达 |
| forgot | email同上；POST `/auth/password-reset/request` `{email}` | 202通用反馈，不泄露账号是否存在 |
| verify自动动作 ID-EMAIL-CONFIRM | URL token；POST `/auth/email-verification/confirm` `{token}` | 后端200 `{status}`；旧E2E模拟204只是兼容状态，不是后端真实返回合同 |
| reset | 新密码必填12–128；POST `/auth/password-reset/confirm` `{token,new_password}` | 204显示重新登录，当前不自动跳转 |
| challenge | code必填6–32、one-time-code，numeric输入提示；POST `/auth/mfa/totp/verify` `{code}` | 200后enterApplication；mfa_challenge_invalid退login并清code |
| 首次改密 | currentPassword/newPassword→POST `/me/password` `{current_password,new_password}` | 204、服务端清会话cookie，前端清相关输入并退login；需重新登录继续MFA |
| MFA开始 | currentPassword→POST `/me/mfa/totp/enrollment` `{current_password}` | 201读取secret仅存组件ref，用于手动绑定，不添加二维码/复制接口 |
| MFA确认 | mfaCode→POST `/me/mfa/totp/confirm` `{code}` | 200读recovery_codes，显示启用/完成；真实恢复码不进入图、日志或仓库 |
| MFA停用 | currentPassword/mfaCode→DELETE `/me/mfa/totp` `{current_password,code}` | 204、服务端清cookie；前端置未启用并提示会话撤销，不自动跳转 |
| 组织选择 | GET `/org/memberships`；选组织后GET `/org/{id}/workspaces`及`/teams` | 展示服务端name/slug/timezone、工作区name/status、团队数量 |
| 工作区选择 | POST `/auth/context` `{organization_id:workspace.organization_id,workspace_id:workspace.id}` | 200 selectedContext组织/工作区名称；点击继续才导航 |
| 个人空间 | POST `/me/personal-workspace`，前端不传body | 201；默认return_to=/onboarding时改去/home，其余采用return_to；不展示任意组织名表单 |

MFA和首次设置按钮是 form 外的 type=button，输入虽然部分有minlength，但没有required和表单提交校验，也未随loading禁用。不要把普通身份form的防重复/原生校验结论套到这些按钮。服务端schema密码maxLength=1024，与前端128上限不同；本批不更改任一规则，图上以当前UI限制为事实，不声称二者一致。鉴权、同源、cookie与幂等沿共享api-client及真实服务端，不新增前端token存储。

## 4. 计划用例与已有证据的边界

下列 Ixx 是下一轮实施/验收任务卡，**均非本批新运行通过**。既有测试只作为复用入口；补测应覆盖其缺项，避免把测试标题当完整行为证明。

| caseId | 可执行步骤与必须断言 | 复用入口 / 待补 |
| --- | --- | --- |
| I01 | 根页加载→无会话登录/各角色landing/成员最近页；失败重试；请求未完成不显示业务壳层；次按钮真实可达性 | e2e/m02-03-navigation-shell：public root、member landing；缺目标/受阻次按钮待补 |
| I02 | login有效输入→准确payload，202挑战、首次设置、普通返回分别运行；redirect及默认landing分开；处理中点击/Enter不重写 | e2e/m01-01-local-identity、m02-02-auth-onboarding；三分支及慢请求待补 |
| I03 | 空/格式/两次不一致→零POST；正确输入→201后verify且URL不变；失败保留 | m02-02注册已有局部用例；字段关联、慢请求待补 |
| I04 | 存在/不存在邮箱同提示；失败/429恢复；只向隔离投递器写入 | m02-02找回用例；实际投递及防枚举由m01-01后端测试和隔离环境分层验 |
| I05 | 缺token零确认请求；有效token按真实200合同；失效/重复失败标题准确，不记录token | m02-02只有204夹具兼容结果；真实200、失效标题、自动提交次数待补 |
| I06 | 缺token/失效/短密码、有效204与返回登录；无确认输入不得虚构一致性检查 | m02-02重置用例；真实重置仅用专用隔离账号 |
| I07 | 服务端要求改密→204重新登录→绑定→确认→离线保存恢复码；拒绝/重试/重复点击；不提前进入业务 | m01-02后端契约可复用；完整前端种子链待补，不使用生产种子身份 |
| I08 | MFA状态读取失败/未启用/启用；开始、确认、停用准确method/body；拒绝时保留输入、成功后会话失效 | e2e/m01-02只覆盖读取/入口/过期挑战；管理写入、秘密清理与焦点待补 |
| I09 | 匿名点击安全会话/MFA先session-status，拒绝后不请求受保护内容；认证登录页→P07正确重挂载 | e2e/m01-01匿名安全入口、m01-02账号链接；mode白名单与query-only变化补边界 |
| I10 | 有组织搜索/无匹配/清除→选组织→active工作区POST→继续；非active零POST；401/403/空/迟到响应不串范围 | m02-02正常链、m02-03 return context；错误与竞态待补 |
| I11 | 无组织创建仅本人默认空间，无body；连续点击/重试不重复；失败不导航；默认/home与return_to分别验 | m01-03/tenancy-api.test.mjs、tenancy-domain.test.mjs与tenancy-routes；全前端链待补 |
| I12 | 三步直达/上下步/跳过/完成；URL与刷新不冒充持久进度；step缺失、非法、小数、越界；键盘/读屏/缩放 | m02-02正常三步；异常step与焦点变化待补 |

测试文件路径以 `tests/` 为根；涉及身份写入时用拦截夹具或专用隔离账号/邮箱。Vue夹具不产生真实账号、邮件、数据库或会话撤销；真实后端验证后按明确的测试用户、组织、工作区ID清理，不按名称模糊删除。UI图只能使用显式合成字段；令牌、密码、secret、恢复码不得作为截图/URL索引交付。

## 5. 已发现缺口与实施顺序

1. **先补行为基线**：I01–I12缺项按页族补测试，尤其真实200验证返回、MFA写入及强制设置、个人空间分支。本批只追源码，不承诺浏览器已复现全部问题。
2. **处理会影响新稿的语义问题**：根页无处理的次动作、组织页占位按钮应提交明确的非交互呈现/已有入口方案；验证失败时标题仍“正在验证邮箱”；MFA读取期间初值false显示“未启用”。这些不能在新稿中当正常事实。
3. **状态连续性**：身份mode切换不改变URL且不清敏感ref，query-only更新不触发path-key重挂载；MFA成功或停用后secret/recoveryCodes是否应清理需按安全合同复核。组织选择没有请求归属保护，跨步骤迟到响应仍待运行验证。不得只改截图掩盖。
4. **局部明确异常**：OnboardingGuide用Number(step)夹在1–3而未取整；如1.5会索引pages[0.5]得到undefined。后续先写失败回归，再按既有合法1/2/3范围做局部输入保护；本批不改源码、不声称已修复。
5. **设计与无障碍**：获审方向后制作每页/内联模式/异常态图，去掉旧营销侧栏的默认继承；错误紧邻字段并建立aria-describedby/aria-invalid，模式变化焦点到标题或首字段，敏感操作忙碌态、软键盘与44px热区逐项验证。遵循fixing-accessibility的最小修改约束，不引入新安全能力。
6. **批准后实现并发布**：先单页真实Vue闭环，再本族共享消费者回归；正式图与实现证据分别绑定版本。按PLAN的W09统一宝塔发布，本批没有部署、迁移、环境/依赖变更或重启要求。

新增九份规格见page-specs/P01.md至P09.md；十项规格字段齐全并不等于上述验收通过。全站其余页、动态共享控件、运行分母冻结、A/B选择与用户签收继续待办。
