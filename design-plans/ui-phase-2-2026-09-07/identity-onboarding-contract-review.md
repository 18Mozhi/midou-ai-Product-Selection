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

16f524b后的N04证据刷新已按本表修正PAGES的P06/P07/P09三行，并重新生成清单。LocalIdentity及OnboardingGuide源码再次核对且未修改；确认密码仅属register，MFA无复制入口，引导仍只有query初始化与局部step。本表保留为纠偏依据，不再表示矩阵尚未同步。

| 旧矩阵条目 | 当前实际情况 / 本次执行要求 |
| --- | --- |
| P06“确认输入、不一致输入” | 无确认字段；验证单个新密码长度、缺失/失效token、失败保留、204成功与返回，不实现不存在的确认规则 |
| P07“复制反馈” | 无复制按钮；验证现有绑定、确认、停用及敏感材料生命周期，不默认新增复制能力 |
| P09“已有进度” | 只有query初始化和局部step，没有持久化；验证刷新、非法步骤及跳过/完成到根入口，不把进度当存档 |

## 2. 38 个局部控件/事件候选的对应

前缀 L=LocalIdentity.vue、R=LandingRedirect.vue、T=TenancyChooser.vue、O=OnboardingGuide.vue；均位于 apps/web/src/components。候选键写为 `前缀#signature.ordinal`，可还原 actions.json 的完整 candidateId。行号是当前定位提示，不是稳定标识。actionId 为本批人工语义名，后续全站去重时保留引用；同一表单 submit 与按钮、同一 handler 的多入口不重复算独立业务能力。

| 候选键 | 行 | actionId / 分类 | 条件、行为与验收卡 |
| --- | --- | --- | --- |
| L#9b4b982bf643379f.1 | 1260 | ID-ROOT | 品牌→`/`；I01/I02 |
| L#4ea44facc4e04130.1 | 726 | ID-SHOW-FORGOT | login→局部 forgot，无请求/URL变化；I02 |
| L#dc876249a8119b09.1 | 838 | ID-SHOW-LOGIN | verify结果返回；I04/I05 |
| L#dc876249a8119b09.2 | 851 | ID-SHOW-LOGIN | 首次设置结束、恢复码后返回；I07 |
| L#f29375268246ac09.1 | 1333 | ID-LEGACY-SESSION-REVOKE | 旧sessions模板行，暂无公开模式入口；源码保留、运行入口待归并P11 |
| L#ba3feba8b42af0bf.1 | 545 | ID-ACCOUNT-SECURITY | RouterLink→`/me?section=security`；I09 |
| L#df188704ef470c64.1 | 1343 | ID-MFA-ROUTE | RouterLink→P07，会话守卫适用；I09 |
| T#5587941412d5210f.1 | 216 | ID-LOGIN-ROUTE | expired→`/login`；I10 |
| T#222cadb1072dc1d8.1 | 219 | ID-ORG-RELOAD | error/forbidden→loadOrganizations；I10 |
| T#9dde30dd57699c01.1 | 232 | ID-ORG-RELOAD | 无工作区→loadOrganizations；I10 |
| T#ecd9e9dbd8b34d05.1 | 241 | ID-PERSONAL-PROVISION | 无组织→创建本人空间、成功replace；I11 |
| T#d29e9f25fe7a5452.1 | 244 | ID-ACCOUNT-ROUTE | 无组织→`/me`；I11 |
| T#df188704ef470c64.1 | 245 | ID-MFA-ROUTE | 无组织→P07；I09/I11 |
| T#72a9593314273d39.1 | 258 | ID-CONTEXT-CONTINUE | selectedContext就绪→safeReturnTo；I10 |
| T#04d5594b96977687.1 | 263 | ID-ORG-RELOAD | 已选组织时返回组织，重新读目录；I10 |
| T#087b197306ae2192.1 | 304 | ID-ORG-CLEAR | 搜索无结果→清空query，无写请求；I10 |
| O#7142f76fc59ad9ee.1 | 39 | ID-GUIDE-SKIP | 跳过→P01，不写完成状态；I12 |

### 2.1 当前 LocalIdentity 源标识补记

当前静态合同审计发现 `LocalIdentity.vue` 有45个候选未被本合同正文引用。逐项对照 `action-reviews/P02.json` 至 `P07.json` 的 `sourceCandidateIds` 与当前模板后，45/45 均能归入既有身份动作；下表仅补齐当前源标识，不新增业务动作、路由、请求或权限结论。`L#` 仍表示 `LocalIdentity.vue`，具体路由和模式条件以模板及下方P02–P07合同为准。

| actionId | 当前候选键 | 当前源码语义 |
| --- | --- | --- |
| ID-ROOT | L#d545c6b53ab2b2a8.1；L#77c47b63bed1a205.1；L#77c47b63bed1a205.2；L#77c47b63bed1a205.3；L#77c47b63bed1a205.4；L#77c47b63bed1a205.5 | 身份路由各实际模式中的品牌根入口 |
| ID-MFA-RELOAD | L#9734082c2e28b39f.1 | MFA 读取失败后显式重读 |
| ID-MFA-START | L#24e4d3a67a2b28f1.1；L#3a0dc4e3156efd96.1；L#05351529fe9e3358.1；L#f068679ed044d696.1 | MFA 独立绑定及首次安全设置绑定；表单提交与按钮归并 |
| ID-MFA-CONFIRM | L#4ce7b78a016bd6b5.1；L#7d20870a6b6ed73c.1；L#d9c0ff91de01c471.1；L#e7030ff0d08dfdb7.1 | MFA 绑定确认及首次安全设置确认；表单提交与按钮归并 |
| ID-MFA-DISABLE | L#29abd90f9774564d.1；L#6735871aaf8e0556.1 | MFA 停用表单提交与确认按钮，沿用撤销全部会话边界 |
| ID-MFA-RETURN-LOGIN | L#e4840b8a830571e2.1 | MFA 管理页返回登录路由 |
| ID-FORM-SUBMIT | L#b4ef7a9c4f34af7b.1；L#3d0185dcb1b90a38.1；L#55432de3fcde4409.1；L#62294b45ceb45f22.1；L#a8e9d7ee5148dbe5.1；L#be82854e01e5e049.1；L#4b32d082f043e0da.1；L#e448c4ea094171f6.1；L#8cc6c6d54ed246f6.1 | login、MFA challenge、reset、forgot、register 的模式表单及提交按钮；不是一个业务请求 |
| ID-SEED-PASSWORD | L#15cfc05b46fac8ba.1；L#361a7d3b3e6c57b1.1 | 首次安全设置中的改密提交与按钮 |
| ID-SHOW-REGISTER | L#f3edcccf9be30a1b.1；L#f3edcccf9be30a1b.2 | 登录/旧 sessions 模式切换到注册 |
| ID-ACCOUNT-SECURITY | L#ba3feba8b42af0bf.2；L#ba3feba8b42af0bf.3 | 跳转本人 `/me?section=security`；旧 sessions 入口不等于该组件内会话撤销 |
| ID-MFA-ROUTE | L#dce7dc58cd80c932.1；L#341395d9a1567247.1；L#e0691d9aef4aa1e2.1；L#e0691d9aef4aa1e2.2；L#393c4351ab80bac7.1 | 跳转 `/security/mfa` 的说明/管理入口，仍受该路由会话守卫约束 |
| ID-SHOW-LOGIN | L#dc876249a8119b09.3；L#6f57070c49bdbca1.1；L#dc876249a8119b09.4；L#dc876249a8119b09.5；L#dc876249a8119b09.6；L#dc876249a8119b09.7 | 注册、验证、找回、重置、MFA 与旧 sessions 模式返回登录 |
| ID-SHOW-FORGOT | L#56d7e5b963aa0067.1 | 失效重置链接状态进入既有找回密码模式 |

### 2.2 P09 OnboardingGuide 当前源码位置（2026-09-24）

当前 `OnboardingGuide.vue` 的7个静态候选均登记当前签名、行号、类型与LF指纹。旧表中的“跳过引导”签名仍可识别但已移至第39行；其余5个旧签名未匹配当前候选，保留为历史身份。步骤按钮只切换本地step；上下步按边界显隐，最后一步以RouterLink包装真实锚点进入根路径。品牌与跳过同样去根路径，不写服务端进度或完成状态。

| 当前candidateId | 行 | 类型 | 当前语义归属 |
| --- | ---: | --- | --- |
| apps/web/src/components/OnboardingGuide.vue#77c47b63bed1a205.1 | 35 | control | OG-CURRENT-ROOT / ScoutOps品牌根路由入口 |
| apps/web/src/components/OnboardingGuide.vue#7142f76fc59ad9ee.1 | 39 | control | OG-CURRENT-SKIP / 跳过引导并前往根路由，不写完成状态 |
| apps/web/src/components/OnboardingGuide.vue#767668a05760119c.1 | 46 | control | OG-CURRENT-STEP / 三个按钮实例选择步骤并更新aria-current |
| apps/web/src/components/OnboardingGuide.vue#29d93cd3465b4ff3.1 | 59 | control | OG-CURRENT-PREVIOUS / step大于1时回到前一步 |
| apps/web/src/components/OnboardingGuide.vue#af9a19de541c1f52.1 | 62 | control | OG-CURRENT-NEXT / 未到最后一步时进入下一步 |
| apps/web/src/components/OnboardingGuide.vue#7782f528a47ecb39.1 | 70 | control | OG-CURRENT-FINISH-WRAPPER / RouterLink仅在最后一步包装根路由 |
| apps/web/src/components/OnboardingGuide.vue#354bfce3e8fca3e5.1 | 71 | control | OG-CURRENT-FINISH-LINK / 最后一步真实锚点，激活RouterLink导航 |

| 当前源文件 | 当前LF SHA-256 |
| --- | --- |
| apps/web/src/components/OnboardingGuide.vue | abfa994e639442460aad2203478b27cb015c7c319170b3e04c2be2b5a17536ed |

### 2.3 P08 TenancyChooser 当前入口与范围选择（2026-09-24）

以下补记 `TenancyChooser.vue` 三个当前静态候选及源码指纹。品牌入口回到根路径；选择组织只读取该组织工作区和团队并更新本地目录状态，不提交会话范围；只有活动工作区选择才向既有 `/auth/context` 提交组织/工作区并更新会话。该静态映射不代替真实成员授权或生产写入验收。

| 当前candidateId | 行 | 类型 | 当前语义归属 |
| --- | ---: | --- | --- |
| apps/web/src/components/TenancyChooser.vue#d545c6b53ab2b2a8.1 | 173 | control | P08-CURRENT-ROOT / 品牌链接返回根路径 |
| apps/web/src/components/TenancyChooser.vue#51f99d2206301d80.1 | 282 | control | P08-CURRENT-ORG-CHOOSE / 选择组织并读取工作区、团队；不写会话范围 |
| apps/web/src/components/TenancyChooser.vue#9d6c9b22e4716bb9.1 | 316 | control | P08-CURRENT-WORKSPACE-CHOOSE / 仅活动工作区可用；调用既有 `/auth/context` 更新会话范围 |

| 当前源文件 | 当前LF SHA-256 |
| --- | --- |
| apps/web/src/components/TenancyChooser.vue | bb23c5df2396fa9a639ea0ffc8efacdc477a569abb3e3d03537e6bea73c0e3a8 |

本映射只确认当前静态候选与既有局部导航规则，不表示完成记录、持久化进度、真实身份/工作区、完整焦点读屏或生产状态已新增或验收。

额外运行边界：P01 使用共享 UiStatePanel。blocked 默认还渲染“查看影响”次按钮，组件 emit secondary，但 LandingRedirect 没有对应监听；记录为 `NONACTION-LANDING-SECONDARY`，不假设它可打开影响详情。该候选位于共享组件，不加入上述四文件的38行分母；其余共享消费者留到壳层/通用状态批归并。

四文件在 dialogs.json 无原生定义/确认调用候选，源码无实际模态弹窗。MFA、首次设置、验证结果均是内联模式；不得为了图数凭空添加弹窗或把它们从状态图包排除。今后若选定稿改为弹窗，须补具体触发、焦点、关闭及秘密清理合同，不改变安全流程。

### 2.4 P08/P09旧源码身份归档（历史）

以下旧签名已不在当前组件中。LocalIdentity 对应的当前源动作族见2.1；OnboardingGuide 与 TenancyChooser 的逐候选当前映射见2.2、2.3。交叉索引只到语义族，不声称每个旧签名与新签名一一对应；登录成功到P08旧入口无当前LocalIdentity候选替代项，当前账号说明亦没有可操作入口，均不推定为仍然可用。

#### apps/web/src/components/LocalIdentity.vue

| 旧candidateId | 初始语义 | 当前映射边界 |
| --- | --- | --- |
| L#2e7305c394f2d04e.1 | ID-FORM-SUBMIT 按mode展开登录/注册/找回/重置/MFA挑战 | 2.1 ID-FORM-SUBMIT当前动作族 |
| L#e469057c327dc16e.1 | ID-FORM-SUBMIT 表单按钮，与submit归并 | 2.1 ID-FORM-SUBMIT当前动作族 |
| L#3170fd522bb10adc.1 | ID-SEED-PASSWORD 首次改密提交 | 2.1 ID-SEED-PASSWORD当前动作族 |
| L#2f540419fadab817.1 | ID-MFA-START 首次安全设置绑定 | 2.1 ID-MFA-START当前动作族 |
| L#6eba4c9b2b754a44.1 | ID-MFA-CONFIRM 首次安全设置确认 | 2.1 ID-MFA-CONFIRM当前动作族 |
| L#2f540419fadab817.2 | ID-MFA-START 普通MFA绑定 | 2.1 ID-MFA-START当前动作族 |
| L#ea20d050ca8862b0.1 | ID-MFA-CONFIRM 普通MFA绑定确认 | 2.1 ID-MFA-CONFIRM当前动作族 |
| L#44386aa05f9251f5.1 | ID-MFA-DISABLE 停用MFA | 2.1 ID-MFA-DISABLE当前动作族 |
| L#c29c165271e564d1.1 | ID-SHOW-REGISTER 局部切换注册模式 | 2.1 ID-SHOW-REGISTER当前动作族 |
| L#170fb1546e423ddb.1 | ID-SHOW-LOGIN 局部切换登录模式 | 2.1 ID-SHOW-LOGIN当前动作族 |
| L#68d7e490dbe530cd.1 | ID-CONTEXT-ROUTE 登录成功后进入P08 | 当前LocalIdentity源表无一对一候选，不推定替代项 |

#### apps/web/src/components/OnboardingGuide.vue

| 旧candidateId | 初始语义 | 当前候选交叉索引 |
| --- | --- | --- |
| O#07db575ab56f90da.1 | ID-ROOT 品牌回P01 | OG-CURRENT-ROOT |
| O#75986af56e7cd4f4.1 | ID-GUIDE-STEP 三实例切换步骤 | OG-CURRENT-STEP |
| O#0728ff37173af0c0.1 | ID-GUIDE-PREVIOUS 上一步 | OG-CURRENT-PREVIOUS |
| O#f74e91375a9aef9f.1 | ID-GUIDE-NEXT 下一步 | OG-CURRENT-NEXT |
| O#176ac690f7c39e94.1 | ID-GUIDE-FINISH 完成并进入P01 | OG-CURRENT-FINISH-WRAPPER / LINK；链接目标语义保留，不称交互等价 |

#### apps/web/src/components/TenancyChooser.vue

| 旧candidateId | 初始语义 | 当前候选交叉索引 |
| --- | --- | --- |
| T#9b4b982bf643379f.1 | ID-ROOT 品牌回P01 | P08-CURRENT-ROOT |
| T#fbfed57848d7366f.1 | NONACTION-ACCOUNT 当前账号文字，没有handler/href | 无当前操作候选；仍不得描述为账号菜单入口 |
| T#6f0aae6f4f0ea461.1 | ID-ORG-CHOOSE 选择组织并读取工作区/团队 | P08-CURRENT-ORG-CHOOSE |

#### apps/web/src/components/LandingRedirect.vue

| 旧candidateId | 初始语义 | 当前映射边界 |
| --- | --- | --- |
| apps/web/src/components/LandingRedirect.vue#0c5f729c6e5f1db6.1 | ID-LANDING-CHECK 受阻态主操作直接调用入口解析 | 第6节记录的当前父子事件链：Surface 发出 retry，父级复用既有 resolveLanding；语义参照，不宣称旧签名连续 |
| T#a556210b61698de6.1 | ID-WORKSPACE-CHOOSE 选择活动工作区并更新会话范围 | P08-CURRENT-WORKSPACE-CHOOSE |

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

## 6. P01重试父子事件当前映射（2026-09-24）

`LandingRedirectSurface` 将受阻态的“重新检查”主操作发为 `retry`；父级 `LandingRedirect` 接收后复用同一个 `resolveLanding`，执行既有 `/me/landing` 读取。它与挂载时的自动解析共用处理函数，不是另一个业务写动作；加载态仍不显示可重复按钮。

| 当前candidateId | 行 | 类型 | 当前语义归属 |
| --- | ---: | --- | --- |
| apps/web/src/components/LandingRedirect.vue#0f7c864f959a1c13.1 | 41 | event-binding | ID-LANDING-RETRY-PARENT / 子事件转发至现有入口解析与重读处理函数 |
| apps/web/src/components/LandingRedirectSurface.vue#bb7cd7dbbdfa84a2.1 | 44 | event-binding | ID-LANDING-RETRY-SURFACE / 将通用状态主操作转发为retry事件 |

| 当前源文件 | 当前LF SHA-256 |
| --- | --- |
| apps/web/src/components/LandingRedirect.vue | bdaf47a55416ebfe563dcd2affe9b578bb22644832b39d79289c64de542372e5 |
| apps/web/src/components/LandingRedirectSurface.vue | 7c4100c1eb8d4dd56d5dec61446ef2ebe544873b9c57cec49db62d1a2bad370d |
