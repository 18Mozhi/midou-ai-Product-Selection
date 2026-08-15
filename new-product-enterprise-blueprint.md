# 实时选品运营平台：企业级产品与技术总计划

> 版本：1.0
> 项目性质：全新企业级 SaaS 产品
> 产品名称：ScoutOps（名称可在品牌阶段替换）
> 技术基线：Vue 3 + TypeScript + Node.js（NestJS/Fastify）+ Python（采集/解析）+ MySQL 5.7 + Redis + Playwright + 宝塔面板
> 本文定位：新项目唯一总纲。产品、设计、开发、测试、运维和上线验收均以本文为上游依据。

---

## 1. 产品定义、成功标准与边界

### 1.1 一句话定义

ScoutOps 是面向跨境电商团队的实时选品运营平台：持续汇集市场新闻、商品与竞品、供应链报价和人工判断，将它们变成可解释的热点、机会、任务、决策和复盘结果。

### 1.2 产品要解决的五件事

1. 用户不知道市场发生什么：系统持续产生有来源、有时间、有可信度的热点信号。
2. 用户不知道商品是否值得做：系统把趋势、竞争、成本、利润、风险和证据放入同一机会详情。
3. 用户不知道谁该处理：系统把机会变成带负责人、优先级、期限和审批规则的任务。
4. 用户不知道数据是否新：每个业务结果都显示来源、最后成功时间、下次计划、过期状态和失败影响。
5. 管理员不能有效运营：管理员无需登录服务器或数据库，即可完成账号、组织、来源、采集、Token、日志、监控和异常处置。

### 1.3 上线成功标准

上线版本必须同时满足：

- 新成员可在三分钟内完成“输入关键词/ASIN/商品链接 → 创建真实任务 → 查看首个可验证结果或受控受阻状态 → 作出决策”。任务创建 API P95 ≤ 3 秒，页面在 15 秒内显示已接收/排队状态；从任务创建起，首个真实结果、`succeeded_empty` 或明确受阻状态 P95 ≤ 180 秒。演示数据仅用于标记明确的教学工作区，不能替代真实来源结果或计入此验收。
- 所有显示为“可运行”的数据来源都有最近健康检查、真实任务记录、原始证据和明确负责人。
- 采集产生的新数据、任务状态和通知可自动更新到页面；用户无需频繁刷新。
- 普通用户、组织管理员、平台运营管理员、安全管理员只能看到各自应看到的功能与数据。
- 平台管理员可创建组织、管理员和 Token，管理所有任务、全部数据、全部机会、全部竞品、日志和监控。
- 数据源受限、登录失效、验证码、限流、无结果、解析失败时，系统不假报成功、不反复向普通用户索要授权。

### 1.4 明确不做

- 不规避登录、验证码、网站访问限制、robots、付费墙或第三方平台条款。
- 不把 AI 文本当作原始事实、价格、利润或供应商资质；AI 只做摘要、解释、分类和缺失项提示。
- 不在普通用户页面暴露 API Key、Cookie、浏览器档案、任务队列内部信息或其他组织数据。
- 不将“候选来源”显示为“已接入来源”；只有健康检查与真实采集通过后才可启用。
- 第一版不实现支付扣款、发票、合同正文和税务申报；仅设计可扩展的套餐与计量边界。

---

## 2. 统一业务模型与角色边界

### 2.1 组织模型

```text
平台 Platform
└─ 组织 Organization（唯一租户、数据、安全、计费、审计边界）
   ├─ 工作区 Workspace（品牌、站点、事业部、项目）
   │  ├─ 团队 Team（选品、采购、运营、财务协作组）
   │  └─ 业务资源（机会、竞品、供应商、任务、报表）
   └─ 成员 Membership（角色、数据范围、资源级授权）
```

所有**组织可见或可操作**的表、缓存键、队列任务、对象存储路径、导出文件、搜索索引、SSE 频道和审计记录必须带 `organization_id`。属于工作区的数据必须再带 `workspace_id`；平台全局元数据不得伪造组织归属。默认拒绝跨组织访问。

#### 2.1.1 数据归属分类与强制规则

| 分类 | 典型对象 | `organization_id` | `workspace_id` | 规则 |
|---|---|---:|---:|---|
| 平台全局 | `users`、平台管理员角色、`providers` 定义、`plans`、全局权限字典、解析器版本 | 不得存在 | 不得存在 | 仅平台管理员可维护；不得直接承载组织业务数据或密钥值 |
| 组织级 | 成员关系、组织 Token、组织审计、Provider 连接、凭证引用、组织级任务/报表 | 必填 | 可为空 | `workspace_id` 为空表示该记录作用于整个组织；查询必须以 `organization_id` 为首要过滤条件 |
| 工作区级 | 热点、机会、竞品、供应商、报价、业务任务、决策、通知、证据 | 必填 | 必填 | 不允许跨工作区归属；跨工作区共享必须创建新的受控引用或资源授权，不能复制后失去来源链 |
| 平台执行镜像 | 队列租约、Provider 健康汇总、运行指标、死信 | 视任务而定 | 视任务而定 | 只要来自组织任务即必填两个适用范围字段；真正全局的运行指标仅保存聚合数据 |

`users` 仅存放身份主体；用户在任何组织内的角色、范围和状态只存在于 `memberships`。`providers` 是平台来源模板，组织实际启用状态、配额、凭证引用和调度配置只存在于带 `organization_id` 的 `provider_connections` 与 `collection_plans`。

### 2.2 角色与菜单矩阵

| 角色 | 可见主菜单 | 可见管理菜单 | 核心权限 |
|---|---|---|---|
| 普通成员 | 首页、今日工作、趋势、机会、竞品、供应链、通知、个人中心 | 无 | 处理被授权资源、创建业务任务、作出决策 |
| 选品经理 | 普通成员全部菜单 | 团队管理、团队报表、审批 | 分配任务、审核机会、管理团队视图 |
| 采购成员 | 首页、今日工作、机会、供应链、通知、个人中心 | 无 | 维护报价、比较供应商、提交成本确认 |
| 组织管理员 | 业务菜单 | 组织、成员、工作区、团队、角色、组织 Token、组织审计、组织报表 | 管理当前组织，不可访问平台全局数据 |
| 平台运营管理员 | 平台运营后台 | 组织与账号、来源、采集、全量业务数据、通知、商业运营 | 管理平台运营，不可读取密钥明文 |
| 平台安全管理员 | 平台安全后台 | 会话、登录、Token、审计、风险事件、密钥轮换策略 | 安全治理，只读业务数据 |
| 平台超级管理员 | 全部 | 全部平台后台 | 初始化、授权、紧急处置；所有操作强制审计 |
| 审计员 | 只读业务与报告 | 授权的审计查询 | 不可写入、不可重放任务、不可管理凭证 |

### 2.3 权限模型

- `RBAC` 决定能否执行动作，例如 `opportunity:approve`、`provider:configure`。
- `Data Scope` 决定可见范围：本人、团队、工作区、组织、平台。
- `Resource Grant` 处理例外共享，例如一个指定机会临时授权给外部采购团队。
- 权限检查必须在 API、导出、附件、SSE 订阅、任务重放、Webhook、后台 Worker 和对象存储签名 URL 中重复执行。

#### 2.3.1 资源授权的首发约束

- 首发版本不支持向组织外身份直接共享资源。“外部采购团队”必须先作为同一 `organization_id` 下的受邀成员加入，并被授予采购角色；不能以邮箱链接、匿名链接或跨组织 Token 替代成员关系。
- `Resource Grant` 只可授予指定资源及其最小必要的只读/协作动作；默认不包含原始证据下载、导出、凭证引用和任务重放。
- 授权必须填写业务原因、授权人、到期时间；最长 30 天，到期自动失效。延长、撤销和实际访问均写入审计日志。
- 权限设计文件必须提供“动作 × 数据范围 × API/页面”矩阵；API 和后台 Worker 使用同一能力名称，前端菜单仅作为展示层，不能作为授权依据。

---

## 3. 普通用户产品设计

### 3.1 主导航与路由

| 路由 | 页面 | 用户问题 | 必须提供的动作 |
|---|---|---|---|
| `/home` | 今日行动中心 | 今天最值得做什么 | 创建选品、继续任务、处理待办 |
| `/work` | 今日工作 | 我还欠哪些工作 | 完成、延期、转交、评论、提交审批 |
| `/trends` | 热点趋势 | 市场发生了什么 | 关注主题、建立监控、转为机会 |
| `/opportunities` | 选品机会 | 什么值得验证 | 采纳、观察、驳回、创建验证任务 |
| `/competitors` | 竞品监控 | 竞品发生了什么变化 | 关注、设阈值、关联机会 |
| `/sourcing` | 供应链与利润 | 从哪里找货、能否赚钱 | 找货、比较、确认成本、创建采购任务 |
| `/tasks` | 任务中心 | 系统和同事交给我的事项 | 处理、审批、查看自动化状态 |
| `/notifications` | 通知中心 | 哪些变动需要我知道 | 已读、订阅、跳转关联业务对象 |
| `/automations` | 自动化规则 | 哪些已确认事件需要稳定跟进 | 创建、暂停、恢复、查看限流与执行记录 |
| `/reports` | 报表与导出 | 当前机会、趋势和团队事实如何分布 | 切换报表、查看缺失、异步导出、下载未过期文件 |
| `/me` | 个人中心 | 我的资料、权限、安全和偏好 | 编辑资料、管理会话、改密、通知偏好 |

#### 3.1.1 前端 UI 图片包：必读依据与实施规则

**前端 UI 需要阅读 `images-html` 文件夹里面的图片以及说明。** 该目录是本计划的视觉、信息架构和页面状态参考，不是可直接当作生产数据、权限结果或接口返回的依据。每次新增或实现页面前，产品、设计和前端必须依次阅读：

1. `images-html/README.txt`：确认图片包用途；
2. `images-html/manifest.json`：以页面编号、名称和文件路径确认设计参考；
3. 对应的 `01_72_page_concepts` 概念图：确认信息架构、页面状态和相邻流程；
4. 如属于核心页面，再阅读 `02_high_resolution_core_pages` 高清图：确认布局、层级、组件密度与交互入口；
5. `03_source_contact_sheets`：用于跨页面导航、主题一致性和响应式覆盖复核。

图片包已核对的范围如下；实现时必须覆盖表中列出的页面状态，具体字段、权限、文案和接口仍以本计划、OpenAPI 与真实实现为准。

| 页面组 | 概念图编号 | 必须纳入实施的页面/状态 |
|---|---|---|
| 身份与入驻 | 01–10 | 登录、注册、找回/重置密码、邮箱验证、选择组织、选择工作区、三步引导 |
| 日常工作与个人 | 11–27 | 首页概览/今日行动/变化雷达/数据健康、全局搜索、快捷创建、通知、个人资料/偏好/安全/主题、任务列表/详情/评论/审批 |
| 热点与机会 | 28–40 | 趋势列表/详情/时间线/监控规则、机会列表/概览/市场/竞争/利润/风险/证据/创建 |
| 竞品与供应链 | 41–49 | 竞品列表/详情/价格追踪/监控规则、供应商搜索/详情、报价对比、成本计算、采购任务 |
| 报表与移动端 | 50–54 | 机会/趋势/团队报表、移动端首页和机会详情 |
| 组织与平台后台 | 55–71 | 组织、成员、角色权限、工作区、团队、审批；平台驾驶舱、来源/采集/系统/日志/安全/Token/密钥/告警/套餐 |
| 异常页 | 72 | 404；实现阶段同时补齐本计划规定的无权限、加载、空、受阻和恢复状态 |

视觉与组件规则：

- 桌面端必须采用“顶部组织/工作区/全局搜索/创建/通知/个人菜单 + 左侧业务导航 + 主内容区”的壳层；组织后台和平台后台使用独立导航壳，不能与普通成员菜单混用。
- 建立可切换的设计令牌主题：`deep-ocean`（深海蓝，默认）、`aurora-purple`（极光紫）、`cloud-white`（云雾白）。主题只改变颜色、阴影、背景和图表语义色，不得改变权限、数据范围、功能可见性或业务结论；主题选择保存到用户偏好。
- M02-01 实现合同：主题偏好按用户、当前活动组织和当前活动工作区保存，采用版本锁、幂等键和同步审计；未保存时返回深海蓝默认值，不新增异步服务或生产环境变量。
- M02-02 页面合同：登录、注册、找回、验证、重置、组织/工作区选择复用 P01 的真实接口与数据范围；三步快速引导不落库。图片中的手机、Google、Microsoft 与 SSO 入口在能力未启用前不得伪装可用。
- M02-03 壳层合同：`/home`、`/org-admin`、`/platform-admin` 使用三套独立导航；服务端按活动成员资格、`organization_admin` 或平台角色审计放行，前端只展示结果。平台管理员进入平台壳层不依赖组织上下文；导航状态不落库、不新增异步服务或环境变量。
- M02-04 状态合同：加载、空、错误、无权限、过期、受阻、恢复、404 与确认弹窗使用统一文字、符号、下一步及安全关联标识；高影响确认默认失败关闭。组件不推断权限、不自行写 API，也不新增数据库、异步服务或环境变量。
- M02-05 搜索合同：全局搜索固定在服务端解析的当前组织与工作区，结果按资源 capability 二次过滤并只返回站内路由；快捷创建只返回已授权页面入口，不提前写入尚未实现的业务对象。搜索投影由后续资源所属模块在真实事务成功后同步维护，本模块不新增异步生产者或环境变量。
- M02-06 首页合同：首页只读取当前组织、工作区、当前用户受众和 capability 过滤后的真实投影；今日行动严格按 `逾期 > 阻断 > 高风险 > 高价值 > 普通` 且最多五项，健康提示必须精确影响当前用户。P03–P05 未写入投影时显示有入口的空状态，移动机会详情只提供骨架，不生成 P04 数据。
- 高清核心图作为下列页面的直接布局基准：今日行动中心、登录、注册向导、今日工作、热点趋势、机会详情、竞品监控、供应链与利润、组织管理后台、平台驾驶舱。其余概念图用于补齐页面结构和状态，不要求像素级复刻插画。
- 图中的品牌、用户头像、商品、金额、指标、供应商、认证标识、Google/Microsoft 登录入口及 SSO 文案均为视觉示例；上线前必须替换为真实授权能力和真实数据。特别是企业 SSO 仍遵循 9.1.1 的“首发不强制、首个支持 Microsoft Entra ID、满足合同与验证后按组织启用”规则。
- 所有图表、徽标、颜色和趋势箭头必须同时提供文本标签、数值、时间范围、数据来源/新鲜度和非颜色状态；不允许仅凭红绿或图形表达风险、成功或失败。
- 页面验收除功能正确外，还需比对对应图片包：导航位置、信息层级、表格/卡片密度、筛选区、关键 CTA、加载/空/错误/无权限状态及 390px 移动端可用性。示例图与本计划冲突时，以本计划的安全、权限、数据真实性和业务规则为准。

### 3.2 首页 `/home`

页面只回答三个问题：今天该做什么、哪些变化值得关注、数据是否可信。

1. 顶部固定栏：组织切换、工作区切换、全局搜索、创建按钮、通知、个人菜单。
2. 今日行动：最多五项，排序公式为 `逾期 > 阻断任务 > 高风险机会 > 高价值机会 > 普通待办`；每项显示原因、负责人、截止时间、下一步按钮。
3. 变化雷达：新增热点、机会评分变化、竞品关键变动、供应链报价变化；每项必须显示来源数和最新时间。
4. 我的关注：已关注主题、竞品、供应商的变化摘要。
5. 数据健康提示：只展示影响当前用户的数据源异常，例如“Amazon 竞品监控延迟，3 条记录数据可能过期”。
6. 空状态：给出“开始一次选品”“添加竞品”“从 1688 找货”三个入口，不能只展示空插画。

### 3.3 热点趋势 `/trends`

列表字段：主题、分类、热度、环比、来源数、可信度、最后更新时间、关联品类、状态。

详情顺序：

1. 结论：主题为何值得关注，结论置信度和适用市场。
2. 证据：每条来源的标题、摘要、发布日期、抓取时间、原文 URL、解析版本。
3. 时间线：按小时/天展示信号增长和来源变化。
4. 关键词：主关键词、关联关键词、否定关键词、语言和市场。
5. 相关机会：被该主题影响的候选商品与评分变化。
6. 数据质量：来源覆盖、重复比例、过期比例、受限来源和缺失信息。

操作：关注、取消关注、创建监控规则、创建机会候选、标记无关。用户不可删除原始证据。

M04-01 实现合同：`trend_topics`、`trend_signals`、主题关键词、关注和监控规则全部按组织与工作区隔离。Google News 规范化证据由宝塔 Node Worker 的租约任务投影为主题；同一规范化标题合并，多来源不得覆盖。热度仅表示实际信号数并携带 `signals` 单位；在没有已批准的测量规则前，环比和置信度返回 `insufficient_data`，不得填充默认分数。关注、标记无关、创建或暂停规则要求 `trend:manage`、同源校验、幂等键、事务审计和 Outbox；标记无关不删除证据。监控规则首批只支持站内通知，邮件 Provider 未确认时不得显示为已接通。创建机会仍由 M04-02 交付，M04-01 页面只显示明确的未启用状态。

### 3.4 选品机会 `/opportunities`

列表默认字段：机会名称、综合评分、趋势评分、竞争评分、利润状态、风险等级、置信度、负责人、决策状态、更新时间。

详情按以下固定顺序呈现：

1. 推荐结论：推荐/观察/不推荐，且标明规则版本与计算时间。
2. 评分解释：权重、输入、异常项、缺失项、置信度；每个分数可展开来源。
3. 市场证据：热点、关键词、竞品与历史变化。
4. 成本利润：采购价、物流、平台费、汇率、税费口径、利润公式和缺失项。
5. 竞品对比：价格带、评价、排名、差异点、最后采集时间。
6. 风险：合规、侵权、供应、趋势、利润和数据质量风险。
7. 决策历史：谁在何时采纳、观察、驳回及原因。
8. 执行：关联任务、审批、验证活动、结果回流。

“采纳、继续观察、驳回”均必须填写原因；无法计算利润时必须显示“数据不足，不能生成可靠 ROI”。

M04-02 实现合同：`opportunities`、趋势证据引用、人工决策、刷新任务、事件和 Outbox 全部按组织与工作区隔离。候选可手工创建，或从当前工作区的活动趋势主题转入；创建与决策沿用既有 `opportunity:decide`，要求同源校验、幂等键和事务审计。宝塔 Node Worker 只把已持久化的趋势信号链接为市场证据，并将仅有趋势证据的覆盖状态标记为 `partial`；M04-03 至 M04-06 未提供评分、费用、竞品与风险输入前，综合分、趋势分、竞争分和置信度保持空值，利润为 `insufficient_data`、风险为 `unknown`，不得生成默认推荐或可靠 ROI。采纳、继续观察和驳回必须填写原因并形成独立决策记录，不能改写原始分数、证据或历史。

#### 3.4.1 利润、评分与人工决策合同

- 所有金额必须同时保存金额、币种、来源、采集/确认时间和适用市场；汇率使用经批准的汇率 Provider 及其报价日期，不能以界面当前汇率覆盖历史计算。
- 首发利润口径为：`预估净利润 = 含税销售价 − (确认采购价 + 物流 + 平台费 + 支付手续费 + 税费 + 已知履约成本)`；`预估净利率 = 预估净利润 ÷ 含税销售价`。任一必填输入缺失时，利润状态为 `insufficient_data`，不得显示数值 ROI。
- 税费、平台费、支付手续费、目标市场与履约成本不是全局常量，而是“市场 + 平台 + 生效日期”版本化规则。规则草稿须经选品经理与组织管理员审批后发布；已生成的机会保留所用规则版本。
- 综合评分至少支持市场需求（销量、增长、复购）、竞争、利润、履约效率、客户体验（评分、退货率、差评痛点）、用户场景/内容成交适配、风险与数据质量等维度。每个维度、权重、阈值和评分输入必须版本化，并记录计算时间、证据引用与缺失项；初始权重由平台运营管理员配置，组织只能在平台允许的范围内调整。
- 人工采纳、观察、驳回可覆盖自动推荐，但不得改写原始分数；覆盖必须填写原因、有效范围和期限，形成独立决策记录。规则发布支持草稿、审批、灰度、全量和回滚，任何回滚只影响指定生效时间之后的新计算，历史结果保持可复现。

M04-03 实现合同：评分规则不预置或推断业务权重、推荐阈值和观察阈值，创建者必须显式提交 0–100 维度权重（合计 100）及阈值。输入按机会、维度、来源、观测时间、版本和证据 ID 不可变保存；缺失值必须列出缺失字段，不能按 0 分或默认分补齐。规则状态依次为草稿、待审批、已批准、已启用，并支持拒绝、停用和回滚；提交使用既有 `opportunity:decide`，批准、启用与回滚使用既有 `opportunity:approve`，所有写入要求同源校验、幂等键、版本锁、审计事件和 Outbox。宝塔 Node Worker 按租约执行版本化加权计算：必需输入覆盖率低于 50% 时综合分和置信度保持 `insufficient_data`；达到 50% 可形成观察性结果；只有覆盖率至少 80% 且市场、竞争、成本三类各有真实证据时才允许自动“推荐”。回滚只改变后续任务使用的活动规则，既有输入、分项、总分、缺失项和运行快照保持可复现。

M04-04 实现合同：费用规则按组织、工作区、市场和平台版本化保存，平台费、支付手续费、税费和履约成本四项必须由创建者显式填写，不提供或推断默认费率。规则提交后必须分别由真实 `selection_manager` 和 `organization_admin` 角色审批，双审批完成才可发布；拒绝、换版和回滚保留全部审批与历史运行。含税售价、已确认采购价和物流输入必须保存金额、ISO 4217 币种、来源、证据、观测时间和不可变版本；跨币种换算只接受已启用且声明 `exchange_rate` 能力的 Provider 历史报价。宝塔 Node Worker 固定按“含税售价 − 采购 − 物流 − 平台费 − 支付手续费 − 税费 − 已知履约成本”计算净利润和净利率；任何必需输入或汇率缺失时状态必须为 `insufficient_data`，净利润、总成本和 ROI 数值保持空值。规则、成本输入、汇率、任务、分项和运行均保留 request_id、trace_id、审计事件与 Outbox；既有利润运行不可改写。

### 3.5 竞品监控 `/competitors`

每条竞品必须包含：市场、来源站点、外部 ID、商品 URL、标题、当前价格、货币、排名、评价数、评分、可用性、抓取时间、数据新鲜度、来源状态。

变动记录格式固定为 `字段 + 前值 + 后值 + 变化时间 + 证据 + 影响说明`。用户可设置价格、排名、评价、可用性阈值；阈值触发后进入通知和任务中心。

M04-05 实现合同：竞品按组织、工作区、市场、来源站点和外部商品 ID 唯一保存，首个完整快照只建立基线。所有快照必须来自已启用 Provider，并包含价格、ISO 4217 币种、排名、评价数、评分、库存、抓取时间、新鲜度、来源状态、来源引用和证据 ID；缺字段不得补示例值。快照不可变，宝塔 Node Worker 使用租约、重试和死信比较上一快照，按固定格式保存变更。价格、排名和评价阈值必须显式提供，库存只支持任意变化或变为缺货；达到阈值时在本模块可靠记录通知与任务 `queued` 状态并写 Outbox，由后续所属模块消费。读取使用 `competitor:read`，创建、快照、阈值和启停使用 `competitor:manage`；审计员保持只读。所有写入要求同源校验、幂等键、组织/工作区隔离、request_id、trace_id、审计事件与回滚说明。

### 3.6 供应链与利润 `/sourcing`

- 输入：关键词、图片、机会候选或商品链接。
- 结果：供应商、商品标题、规格、MOQ、报价、币种、交期、所在地、最后采集时间、原始页面、证据、可信度。
- 比较：最多五家供应商，按规格、价格、MOQ、交期、历史稳定性和风险对比。
- 成本确认：采购成员填写实际报价、物流、平台费和汇率来源；字段修改记录前后值。
- 利润：显示公式、税费口径、汇率日期、成本来源；缺失输入不可隐藏。

M04-06 实现合同：找货请求只引用当前组织、当前工作区内已经完成的采集任务，并明确记录关键词、图片、机会或商品链接之一作为输入类型；本阶段只投影已启用 `manual_product_supply_csv` Provider 产生的 `product-supply-csv-v1` 规范化记录，不虚构 1688 或其他外部接口。供应商名称、标题、MOQ、报价、币种、原始页面、观测时间和证据来自不可变采集事实；规格、交期、所在地、可信度、稳定性和风险缺失时保持 `incomplete` 并逐项展示，只有采购成员使用证据显式确认后才创建新的不可变报价版本。对比仅接受同组织、同工作区内当前有效的 2–5 家完整报价；采购任务必须满足报价 MOQ，并以 `queued` 事件和 Outbox 交给 P05 任务中心消费，不能显示为已执行。读取使用 `sourcing:read`，找货、报价、对比和采购任务写入使用 `supplier_quote:manage`；所有写入要求同源校验、幂等键、审计、request_id 和 trace_id。物流、平台费与汇率来源继续使用 M04-04 已交付的版本化成本与利润合同，不在本模块复制或推断。

M04-07 实现合同：AI 辅助分析只读取当前组织、当前工作区内已持久化的机会事实、证据引用、最近评分与利润运行，并把输入快照、SHA-256、机会版本和提示合同版本不可变保存。宝塔 Node Worker 使用后端 `AI_BASE_URL`、`AI_MODEL`、`AI_API_KEY`、超时与重试配置调用 OpenAI 兼容 Chat Completions JSON mode；输出仍必须通过本地严格 schema 和 `source_refs` 白名单验证。结果只包含摘要、分类观察和缺失提示，必须标记 `ai_generated`，不得生成或覆盖价格、评分、利润、资质、风险结论与决策。非法 JSON、未知字段、伪造引用、超时、限流和依赖失败进入明确重试或死信状态。人工抽检另存通过或驳回记录，不改写 AI 原始输出；读取使用 `opportunity:read`，排队和抽检使用 `opportunity:decide`，所有写入要求同源校验、幂等键、组织/工作区隔离、request_id、trace_id、事件与 Outbox。

### 3.7 个人中心 `/me`

| 分区 | 内容 | 操作 |
|---|---|---|
| 基本资料 | 头像、姓名、邮箱、手机号、语言、时区 | 修改并验证联系方式 |
| 我的权限 | 组织、工作区、团队、角色、数据范围 | 只读查看与申请权限 |
| 安全中心 | 密码、设备会话、登录历史、MFA | 改密、退出其他设备、启用 MFA |
| 通知偏好 | 站内、邮件、任务、热点、竞品、异常 | 设置渠道和免打扰时段 |
| 我的资产 | 收藏、最近浏览、我的决策、我的任务 | 跳转、取消收藏 |
| 我的 Token | 仅有权限时出现 | 创建、查看前缀、撤销；明文只显示一次 |

---

## 4. 管理员产品设计

### 4.1 组织管理后台 `/org-admin`

组织管理员仅管理当前组织，导航必须包括：

1. 组织资料：名称、Logo、时区、数据保留策略、默认工作区。
2. 成员与邀请：创建成员、批量邀请、禁用、恢复、邀请失效、成员归属。
3. 角色与权限：角色模板、能力、数据范围、资源授权预览。
4. 工作区与团队：创建、归档、成员分配、负责人、默认工作流。
5. 组织任务与审批：组织级任务、审批模板、SLA、超时升级。
6. 组织数据：工作区数据质量、导出历史、组织级报表。
7. 组织 Token：组织 API Client、scope、过期、轮换、撤销、调用日志。
8. 组织审计：成员、权限、导出、配置和关键数据变更。

#### M06-01 组织管理后台实现基线

- `/org-admin` 及其成员、角色、工作区/团队、审批、组织数据、Token 和审计子路由只读取当前会话选择的组织；每个 API 继续执行对应 capability，前端菜单不是权限边界。
- 组织资料、成员状态、角色、工作区、团队与 Token 写入必须携带原因和 `Idempotency-Key`；版本化对象使用 `expected_version`，同事务写业务事实、`audit_logs` 和 `outbox_events`。
- 禁止组织管理员自我禁用或移除最后一位活动组织管理员；默认工作区在更换前不可归档；团队负责人和成员必须来自同一组织的活动成员关系。
- 邀请在邮件 Provider 未确认前保持 `pending_delivery`，不得显示“已发送”；邀请投递是宝塔管理服务消费的 Outbox 合同，不创建面板外常驻进程。
- 组织 Token 只允许固定只读 scope，明文只在创建或轮换响应中显示一次；数据库、幂等记录、审计、事件和日志只保存前缀、SHA-256 哈希及生命周期元数据。
- `ORG_INVITATION_TTL_HOURS`、`ORG_TOKEN_DEFAULT_TTL_DAYS`、`ORG_TOKEN_MAX_ACTIVE` 由宝塔受限环境注入，修改后重启 Node API；本模块仍是 S0 单机能力，不声明 P08 容量或高可用结论。

### 4.2 平台管理后台 `/platform-admin`

平台后台必须独立域名或独立根路由，不能与普通用户导航共用。菜单与字段如下：

| 模块 | 页面 | 必须展示/操作 |
|---|---|---|
| 平台驾驶舱 | `/platform-admin`（`/overview` 不作为第二入口） | 活跃组织、用户、来源健康、任务成功率、队列积压、错误、数据增长、告警 |
| 组织与账号 | `/platform-admin/organizations` | 创建组织、创建组织管理员、冻结/恢复、组织状态、隔离检查 |
| 平台管理员 | `/platform-admin/admins` | 创建运营/安全/超级管理员、角色、会话、强制改密、禁用 |
| 来源注册中心 | `/platform-admin/providers` | 所有来源、连接、健康、限流、解析版本、负责人、启停、审核 |
| 凭证与档案 | `/platform-admin/credentials` | 凭证引用、轮换日期、权限范围、健康状态；不显示明文 |
| 采集控制台 | `/platform-admin/collection` | 实时任务、尝试记录、耗时、错误、重试、死信、人工重放、证据 |
| 全量数据 | `/platform-admin/data` | 全部热点、机会、竞品、供应商、数据质量问题、受控导出 |
| 规则与自动化 | `/platform-admin/governance` | 评分、风险、工作流、自动化、配置版本、审批、灰度、回滚 |
| 通知运营 | `/platform-admin/notifications` | 模板、渠道、订阅、投递、失败重试、告警路由 |
| Token 与开放 API | `/platform-admin/open-platform` | API Client、scope、限流、用量、Webhook、签名、投递记录 |
| 安全与审计 | `/platform-admin/security` | 登录日志、会话、风险事件、审计、权限变更、导出、请求链路 |
| 监控与运维 | `/platform-admin/operations` | API、DB、Redis、Worker、Crawler、队列、慢查询、P95/P99、版本、事件 |
| 商业运营 | `/platform-admin/commercial` | 套餐、配额、订阅状态、用量、账期、人工调整和审计 |

#### M06-02 平台驾驶舱实现基线

- 驾驶舱只聚合 MySQL 5.7 已持久化事实；任务成功率仅使用成功/失败终态，没有终态样本时返回 `null`，来源没有时间窗样本时显示“未知”。
- 页面和 `GET /api/v1/platform/dashboard` 要求 `platform:operate`，不返回凭证、Cookie、原始 payload 或内部文件路径；跨组织只显示聚合数及告警关联 ID，不展示组织业务内容。
- 每次读取写入 `platform_dashboard_views` 和全局 `platform_audit_events`，携带 request_id、trace_id、操作者、时间窗与观测时间。
- `PLATFORM_DASHBOARD_DEFAULT_WINDOW`、`PLATFORM_DASHBOARD_QUEUE_WARNING`、`PLATFORM_DASHBOARD_ERROR_LIMIT` 由宝塔环境配置并在重启 Node API 后生效；驾驶舱仅观察既有队列，不创建面板外服务，也不声明 P08 容量。

#### M06-03 来源与采集控制台实现基线

- `/platform-admin/collection/overview` 汇总平台来源定义与健康；任务、尝试、死信和质量问题可按 organization_id/workspace_id 精确筛选，来源写入、健康检查和死信重放继续使用 M03 已有版本锁、幂等、权限和审计接口。
- 控制台不返回凭证、Cookie、采集 payload 或文件路径。读取要求 `platform:operate` 并记录全局审计；重放仍要求 `collection:replay`、同源、原因与 `Idempotency-Key`。
- `COLLECTION_CONSOLE_RECENT_LIMIT` 仅控制最近尝试和死信行数，修改后由宝塔重启 Node API；现有 Worker/Crawler 负责租约、重试、限流和死信，控制台不创建新进程。

#### M06-04 安全与密钥运营实现基线

- `/platform-admin/security` 与 `GET /api/v1/platform/security/operations` 只允许 `platform:secure`，汇总登录结果、风险事件、会话元数据、组织 Token 元数据、凭证生命周期和平台审计。
- 查询明确排除会话 token/hash、组织 Token hash、凭证密文/nonce/auth tag、Cookie 以及原始 IP/User-Agent；Token 仅展示前缀，凭证仅展示指纹与 key_version。
- 凭证轮换、会话撤销和 Token 管理继续使用既有版本锁、幂等、原因、最小 capability 与审计接口；本视图只读且记录 `platform.security.operations.read`。

#### M06-05 开放 API 与 Webhook 实现基线

- `/api/v1/platform/open/*` 是要求 `platform_token:manage`、同源、幂等键、版本和原因的管理面；`/open/v1/*` 使用独立 API Client Bearer、scope、分钟配额、时间戳、持久化 nonce 重放保护和独立用量审计，绝不复用浏览器会话。
- API Client 密钥和 Webhook 签名密钥仅在创建或轮换成功响应中显示一次；前者只保存 SHA-256 哈希，后者使用凭证主密钥 AES-256-GCM 加密。当前实际开放 scope 仅为 `status:read`，不得为未实现接口发放虚假 scope。
- Webhook 仅允许无凭证的 HTTPS 443 目标；Worker 每次尝试重新解析 DNS，拒绝私网、环回、链路本地和多播地址，并将 TLS 请求固定到已验证地址。签名覆盖 timestamp、delivery_id 与原始 body，失败按 60/300/900 秒重试，第四次进入死信，人工重放生成新 delivery 并保留来源证据。
- 管理写入同步记录平台审计和事务 outbox；投递状态写不可变事件。API 与 Worker 均由宝塔管理并读取同一主密钥，本模块维持 S0 单机边界，不声明 P08 容量。

#### M06-06 商业运营预留实现基线

- `/platform-admin/commercial` 与 `/api/v1/platform/commercial/*` 只允许 `platform:operate`；写操作要求同源、`Idempotency-Key`、原因与版本锁。套餐、组织当前分配和人工配额调整均保留版本与审计。
- 当前计量只读取已有 MySQL 事实：`collection_tasks`、`open_api_usage` 和 `report_exports`，按组织与明确账期聚合。有效配额为基础配额加当前有效人工调整且不低于零；Redis 与浏览器状态不是用量真相。
- 本模块不实现支付扣款，不定义价格、币种、税率、发票、支付 Provider 或自动强制限额规则。没有权威业务值时不得生成默认套餐或价格。
- 读取、变更分别写 `commercial_views`、平台审计和不可变 `commercial_events`；组织级变更还同步写事务 outbox。本模块不新增 Worker/Crawler 或面板外服务，仍维持 S0 宝塔 Node API 边界。

### 4.3 平台管理员初始化

- 首次部署必须通过一次性安全种子创建平台超级管理员；禁止固定默认账号和默认密码。
- 种子值只来自宝塔受限运行环境中的部署密文；首次登录强制修改密码并绑定 MFA。
- 之后只有平台超级管理员可创建平台管理员；创建、授权、禁用和角色修改全部写审计。

---

## 5. 来源目录、RSS 与爬虫设计

### 5.1 来源技术接入规则

来源接入分为 `public_page`（公开页面）、`public_rss`（公开 RSS）、`official_api`（官方 API）、`authenticated_browser`（自有账号登录页面）、`import`（文件导入）和 `manual`（人工录入）。编写、测试和部署爬虫代码，不要求项目所有者向开发人员提交授权书、合同、法务审核记录或来源准入证明；robots、网站条款和来源运营审核也不作为开发或本地测试的前置条件，最多作为生产启用时的可选管理信息。

每个来源开发前只需明确以下技术合同：

1. 来源名称与目标 URL；
2. 公开访问或使用项目所有者的自有账号登录；
3. 需要采集的字段；
4. 搜索、分页、滚动、详情页和必要的筛选规则；
5. 调度频率、并发数量、超时时间、重试和熔断规则；
6. 数据保存位置、去重键和保留期；
7. 页面变化、登录失效、限流、空结果和解析失败的处理方式。

每个实现的来源记录必须保存：来源 ID、名称、目标地址、接入模式、市场/语言、字段清单、频率、并发、超时、Parser 版本、健康检查、最近成功/失败、失败原因和下一次计划。项目所有者决定来源是否正式启用；未启用只是不进入生产默认调度，不阻塞代码开发、本地测试、回放测试或管理员手工任务。程序必须记录目标地址、频率、并发和失败情况。

`authenticated_browser` 使用项目所有者自己的账号和 Playwright 持久化浏览器档案保存登录状态。普通业务用户不需要做第三方授权、不提交 Cookie、也不可查看或下载档案。程序不实现验证码破解、登录绕过、付费权限绕过、第三方账号获取或 Cookie 获取功能；登录失效、验证码和页面变化必须以可审计的受阻状态返回。

#### 5.1.1 来源凭证归属与首期加密方案

- 所有来源账号、API Key、浏览器档案及其 Cookie 均为**平台资产**，不归某个组织或个人所有；组织只能在 `provider_connections` 中获得指定来源的使用权、配额和市场范围，不能读取、导出或替换凭证明文。
- `crawler_profiles` 与平台级 `credential_assets` 只保存元数据、所有权、适用来源、轮换状态和加密载荷引用；`provider_connections` 仅保存对 `credential_asset_id` 的受控授权关系。平台安全管理员创建、分配、轮换、撤销和交接，平台运营管理员只能发起使用或故障工单，普通用户无此权限。
- 首期不引入 Vault 或独立密钥服务。凭证、Cookie、私钥和浏览器档案压缩包使用应用层 AES-256-GCM 加密后保存于 MySQL 密文列或宝塔受控本地目录；数据加密密钥只以 `CREDENTIALS_MASTER_KEY` 形式保存在对应宝塔项目的受限运行环境中，不写入数据库、代码、Git、镜像、日志或截图。每条加密载荷存储 `key_version`、`nonce`、`ciphertext`、`created_at` 和 `rotated_at`。
- Worker/Crawler 仅在执行已授权任务时解密到其本机受限临时目录；任务结束立即删除明文档案。创建、读取解密、使用、失败、轮换、撤销和删除均写入审计；密钥轮换采用“新密钥写入 + 后台重加密 + 校验 + 旧密钥撤销”的版本化流程。短期租约挂载和 Vault 仅作为未来单独批准后的替代方案，不是首期实现前提。

### 5.2 首批内置 RSS 来源（具体网站与地址）

以下 RSS/Atom 地址在计划编写时返回 XML 或 RSS；上线时由来源健康检查验证 HTTP 状态、内容类型、字段质量与解析结果。robots 和条款信息可记录为管理提示，不作为开发、本地测试或技术实现的阻塞条件。

| ID | 网站/主题 | RSS 地址 | 采集字段 | 默认频率 | 用途 |
|---|---|---|---|---|---|
| `google_news_search` | Google News 关键词新闻 | `https://news.google.com/rss/search?q={urlEncodedQuery}&hl=en-US&gl=US&ceid=US:en` | 标题、摘要、发布日期、原文 URL、发布方 | 15 分钟 | 新品、品类、竞品关键词新闻雷达 |
| `techcrunch` | TechCrunch | `https://techcrunch.com/feed/` | 标题、摘要、分类、发布时间、规范 URL | 30 分钟 | 消费科技、创业、平台变化信号 |
| `the_verge` | The Verge | `https://www.theverge.com/rss/index.xml` | 标题、摘要、分类、发布时间、规范 URL | 30 分钟 | 消费电子、生活方式、平台趋势 |
| `practical_ecommerce` | Practical Ecommerce | `https://www.practicalecommerce.com/feed` | 标题、摘要、分类、发布时间、规范 URL | 30 分钟 | 电商运营、营销、平台规则和消费者需求 |
| `retail_dive` | Retail Dive | `https://www.retaildive.com/feeds/news/` | 标题、摘要、分类、发布时间、规范 URL | 30 分钟 | 零售、渠道、品类、消费者与供应链趋势 |
| `ecommercebytes` | EcommerceBytes | `https://www.ecommercebytes.com/feed/` | 标题、摘要、发布时间、规范 URL | 30 分钟 | Marketplace、卖家生态、平台政策变化 |
| `bbc_business` | BBC News Business | `https://feeds.bbci.co.uk/news/business/rss.xml` | 标题、摘要、发布时间、规范 URL | 30 分钟 | 宏观商业、零售、汇率和供应链背景 |

RSS 处理规则：

1. 只保存标题、允许的摘要、发布日期、来源 URL、分类、抓取时间和内容哈希；不批量抓取全文。
2. 使用 `canonical_url` 优先、`normalized_title + publisher + published_date` 兜底去重。
3. 单次读取上限 100 条；同一来源单次任务最大处理 20 条新条目。
4. 解析后先进入 `raw_evidence`，再进入 `trend_signal`；不得跳过证据直接写热点。
5. 标题相同但来源不同应合并为一个主题下的多条证据，而不是覆盖。
6. RSS 无新内容是成功状态 `succeeded_empty`，不是失败。

### 5.3 商品、竞品、供应链与社区来源目录

| ID | 网站/端点 | 方式 | 采集/读取内容 | 用户入口 | 技术前提 |
|---|---|---|---|---|---|
| `amazon_product` | `https://www.amazon.com/dp/{asin}` | 官方接口或公开页面 | 标题、品牌、价格、货币、类目、评价、图片、变体 | ASIN/商品 URL、竞品监控 | 每个市场独立限流与字段回放 |
| `keepa` | `https://api.keepa.com/` | 付费 API | 价格历史、销量排名历史、Offer、类目 | 机会/竞品详情 | API Key、额度、成本与字段映射检查 |
| `1688_search` | `https://s.1688.com/selloffer/offer_search.htm?keywords={keyword}` | 已认证浏览器任务或官方接口 | 供应商、标题、规格、MOQ、报价、地点、链接 | 供应链找货、图片找货 | 平台资产浏览器档案、字段回放、登录健康检查 |
| `ebay_browse` | `https://api.ebay.com/buy/browse/v1/item_summary/search` | eBay Browse API | 商品标题、价格、货币、状态、类目、卖家/物流公开字段 | 竞品与价格带 | OAuth Client、scope、配额、字段映射 |
| `etsy_listings` | `https://openapi.etsy.com/v3/application/listings/active` | Etsy Open API v3 | 活跃商品、价格、标签、类目、图片、库存公开字段 | 手作/家居趋势和竞品 | API Key、scope、速率限制、隐私审查 |
| `reddit_search` | `https://oauth.reddit.com/search` | Reddit 官方 API | 帖子标题、摘要、分区、时间、互动聚合 | 痛点/场景/需求信号 | OAuth、社区白名单、禁止保存身份和私信 |
| `youtube_search` | `https://www.googleapis.com/youtube/v3/search` | YouTube Data API | 视频标题、频道、发布时间、标签、公开互动汇总 | 场景、内容趋势辅助 | API Key、配额、频道/关键词白名单 |
| `manual_import` | CSV/XLSX | 文件导入 | 内部销量、成本、供应商、广告、库存 | 数据中心 | 模板、字段映射、病毒扫描、幂等策略 |
| `manual_entry` | 受控表单 | 人工录入 | 报价、成本、风险、决策和事实补充 | 机会/供应链详情 | 角色、审核、前后值审计 |

Walmart、Target、Etsy 网页、eBay 网页、Pinterest、TikTok、IKEA、Google Search、Bing Search、Quora 可直接进入开发和本地测试；生产默认调度前只需由项目所有者确认目标 URL、字段、频率、并发、结果保存和失败处理已配置。未配置完成的来源必须显示为“未启用”，不得描绘成“实时爬虫已接通”。

### 5.4 爬虫任务状态机

```text
draft
  → scheduled
  → queued
  → leased
  → running
  → parsing
  → validating
  → persisted
  → succeeded | succeeded_empty | completed_with_warnings

running/parsing/validating
  → retry_scheduled (可重试)
  → blocked_login | blocked_captcha | blocked_robots | rate_limited (受控暂停)
  → failed_terminal (不可重试)
retry_scheduled
  → dead_letter (超过最大重试)
dead_letter
  → manually_replayed (管理员动作，保留历史尝试)
```

统一错误码：`network_error`、`timeout`、`dns_error`、`login_required`、`session_expired`、`captcha`、`rate_limited`、`robots_disallowed`、`source_changed`、`parse_failed`、`validation_failed`、`empty_result`、`permission_denied`。

执行纪律：租约到期且没有成功心跳的 `leased` 或 `running` 任务由调度器回收为 `retry_scheduled`；同一任务最多自动尝试 4 次（首次执行加 3 次重试），采用 1、5、15 分钟指数退避并叠加不超过 20% 的随机抖动。`rate_limited` 以响应中的重置时间为准，`blocked_login`、`blocked_captcha`、`blocked_robots` 和 `permission_denied` 不自动重试。多来源任务逐项保存子查询结果与错误：全部满足所需覆盖时为 `succeeded`，没有任何可用结果时为 `succeeded_empty`，至少一项有可用结果但存在失败、受阻或缺少必需来源时为 `completed_with_warnings`。任务同时保存 `coverage_status`（`complete`、`partial`、`insufficient`）、成功/失败/受阻子查询数、缺失字段和可用证据；页面必须显示成功覆盖、失败范围和可继续使用的证据。评分服务根据覆盖状态降低置信度；`insufficient` 不得产生“推荐”自动结论。仅具备 `collection:replay` 且属于平台运营管理员或来源负责人角色的人员可人工重放，重放必须指定原因并保留原任务及全部尝试记录。

### 5.5 调度策略与不重复授权规则

| 场景 | 调度 | 幂等键 | 普通用户看到什么 | 管理员动作 |
|---|---|---|---|---|
| RSS 热点 | 15/30 分钟 | 来源 + 关键词 + 时间桶 | 最新时间、来源、结果 | 启停、限流、查看证据 |
| 竞品监控 | 60 分钟或用户设定阈值 | 组织 + 竞品 + 来源 + 时间桶 | 最新快照、变动、过期提示 | 重放、修复来源 |
| 1688 找货 | 用户发起后即时入队；关注项每 6 小时 | 组织 + 关键词/图片哈希 + 时间桶 | 任务进度、结果或受限提示 | 仅登录过期时维护档案 |
| 历史数据 API | 每日或评分触发 | 组织 + 外部 ID + 数据日期 | 价格/排名历史与更新时间 | 配额、成本、Key 轮换 |
| 社区/API 信号 | 30 分钟 | 来源 + 查询 + 时间桶 | 主题与证据摘要 | 配额、白名单、数据质量 |

普通用户从不需要为单次采集确认授权。来源授权、API Key 和登录档案由平台安全管理员一次维护；过期、验证码或限流时，系统自动创建管理员待办并给受影响用户显示业务影响和预计恢复状态。

---

## 6. 实时更新、任务与通知架构

### 6.1 实时定义

实时 = “按合规频率持续采集 + 写入后立即产生领域事件 + 页面自动收到变化”。不是每秒无节制访问第三方网站。

### 6.2 端到端链路

```mermaid
flowchart LR
  A["来源计划"] --> B["调度器"]
  B --> C["Redis 队列与租约"]
  C --> D["Crawler / API Worker"]
  D --> E["原始证据"]
  E --> F["解析、校验、去重"]
  F --> G["趋势/竞品/供应链/机会"]
  G --> H["Transactional Outbox"]
  H --> I["通知、任务、SSE"]
  I --> J["用户工作台与管理后台"]
```

### 6.3 事件合同

#### M05-01 业务任务中心实现基线

任务中心以组织/工作区范围的 `tasks`、不可变评论与任务事件为事实源。任务状态固定为待处理、进行中、完成、取消；SLA 只由真实 `due_at` 派生，缺少期限显示 `not_set`。创建、状态、延期、转交和评论使用幂等键与版本锁，并在同一事务写审计和 Outbox。M04-06 采购任务由宝塔 Node Worker 通过租约投影，来源唯一键保证重放不重复；审批、通知消费和 SSE 由 M05-02 至 M05-04 后续模块交付。

#### M05-02 审批流程实现基线

审批模板采用草稿与不可变已发布版本分离；每个节点显式保存审批人、顺序、SLA 和超时接收人。审批请求只绑定当前组织、当前工作区内存在的任务或机会决策，并锁定创建时的模板版本。批准与驳回均要求原因并追加不可变动作历史；请求 version 防止并发覆盖。宝塔 Node Worker 以租约处理超时节点，只升级 active approver 并写审计和 `approval.overdue` Outbox，绝不自动批准或驳回；通知投递和 SSE 仍由 M05-03、M05-04 交付。

#### M05-03 Outbox 与通知实现基线

宝塔 Node Worker 以租约消费任务、审批和竞品事务 Outbox，按 `source_event_id + recipient_id` 去重生成当前组织、工作区、当前用户的站内通知。通知读取必须叠加 recipient_id，已读动作和偏好使用幂等键与版本锁并写审计。偏好可按任务、审批、竞品和渠道控制；邮件在没有真实 Provider 合同前固定为 placeholder，只记录 pending_placeholder 或 suppressed，绝不向外发送。SSE 由 M05-04 从通知事实读取，不与通知 Worker 抢占 Outbox。

#### M05-04 SSE 与重放实现基线

通知投影同步写入带 BIGINT 单调游标的 `realtime_events`。SSE 经会话、`notification:read` 和组织/工作区/接收人四重范围校验，支持 Last-Event-ID、有限重放、心跳、连接到期和浏览器去重；只传通知失效提示，真实详情继续读取 API。重放窗口与连接上限产生明确 409/503。当前仅为宝塔 S0 单机 MySQL 轮询与进程内连接计数，P08 前不得宣称多节点或 10,000 用户能力。

所有事件包含：`event_id`、`organization_id`、`actor_id`、`resource_type`、`resource_id`、`occurred_at`、`schema_version`、`request_id`、`trace_id`、最小业务 payload。

首批事件：

- `collection.task.created/started/progressed/succeeded/empty/failed/blocked`
- `provider.health.changed`
- `trend.signal.created/expired`
- `competitor.snapshot.created/changed`
- `opportunity.created/recalculated/decision.changed`
- `task.created/assigned/completed/overdue`
- `notification.created/read/delivery_failed`
- `approval.requested/approved/rejected/overdue`
- `security.session.changed`、`audit.recorded`

### 6.4 SSE 规则

- 前端连接 `/api/v1/realtime/events`，连接鉴权必须校验组织与能力。
- 使用 `Last-Event-ID` 断线续传；服务端保存至少 24 小时可重放事件。
- 客户端 1 秒、2 秒、5 秒、10 秒、30 秒指数退避重连；超过 5 分钟切换 30 秒轮询并显示轻提示。
- 事件只触发局部数据失效和重新读取，不将完整敏感对象直接广播给客户端。
- 不得向一个组织推送另一个组织的事件；订阅过滤在服务端完成。

### 6.5 通知规则

| 事件 | 接收人 | 默认优先级 | 渠道 | 去重规则 |
|---|---|---|---|---|
| 高价值机会创建 | 负责人、选品经理 | 高 | 站内 + 邮件 | 同一机会 24 小时一次 |
| 竞品重大降价/缺货 | 关注人、负责人 | 中 | 站内 | 同竞品同字段 30 分钟聚合 |
| 来源受阻影响业务 | 受影响用户、来源负责人 | 高 | 站内 + 邮件 | 同来源状态变化一次 |
| 任务即将逾期 | 负责人、上级 | 中 | 站内 | 距截止 24 小时一次 |
| 安全风险 | 被影响用户、安全管理员 | 紧急 | 站内 + 邮件 | 不聚合，保留全部事件 |

### 6.6 外部参考项目驱动的能力扩展

在不复制未获授权代码、不改变来源受限处理规则的前提下，产品必须纳入以下能力：多平台热点与 RSS 聚合、关键词/来源/市场/平台订阅、监控模式与通知路由、AI 筛选/翻译/简报、差评痛点到改良方案链路、市场/蓝海/供应链匹配、内容成交路径建议、销售预测/聚类/购物篮/情感验证、AI 工作流和可导出行动报告。

实现采用“证据采集 → 规则/统计验证 → AI 解释 → 人工决策”的顺序。AI 输出不得覆盖原始证据、确定性评分、成本或利润计算；没有真实数据的分析必须标记为 `simulated` 或 `insufficient_data`。

#### 6.6.1 十个参考仓库的源码级实现映射

| 参考仓库 | 已研读的具体代码/方法 | 必须独立实现到本项目的能力 |
|---|---|---|
| `baiwumm/next-daily-hot` | `src/app/api/*/route.ts`；例如 `douyin/route.ts` 的 `GET()` 请求来源、检查状态、映射统一 `id/title/pic/hot/url` 响应 | `ProviderAdapter.collect/normalize/healthCheck`；每个热点来源具备成功、空、非 2xx、字段缺失回放测试 |
| `sansan0/TrendRadar` | `AIFilterPipeline.run()`、`_collect_pending_news()`、`_classify_batches()`、`_save_results()`、`convert_to_report_data()`；配置化 Prompt、兴趣词和标签 | `SubscriptionRuleEvaluator`、`PendingEvidenceSelector`、`AIBatchClassifier`、`TopicTagManager`；实现订阅、增量筛选、去重、标签和通知路由 |
| `OMGitsIRISSS/ProductSelectionAnalysis` | `min_max_normalize()`、`score_products()`、`summarize_by_category()`；正向销售/复购/毛利/评分/48h 履约/场景，负向退货率 | `ScoreNormalizer`、`WeightedScoreCalculator`、`CategoryBenchmarkService`；权重、常量列、缺失值和反向指标可版本化、可重放 |
| `mguozhen/sellersprite-product-research` | `fetch.sh`、`selection.sh`、`analyze.sh`；`resolve_model()`、市场/关键词裁剪、结构化报告字段提取 | `MarketplaceResearchSnapshot`、`BlueOceanCalculator`、`ResearchReportRenderer`；蓝海、竞争、风险、机会、策略、建议定价和参考 ASIN |
| `zhaogege429-crypto/tk-product-selection-cockpit` | `analyzeProduct()`、`buildUserPrompt()`、`normalizeBaseUrl()`、`extractAssistantText()`、`validateReport()`、`extractProviderError()` | `ContentRouteAnalysisService`；产出短视频/直播/达人分销建议，强制 JSON Schema 校验和 `ai_generated` 标记，不自动决策 |
| `duk-destiny/AI_Micro_Innovation_Product_Selection_Decision_Engine` | `Pipeline.run()`、进度回调、`PipelineError`；`collect/denoise/extract/cluster/severity/improve/estimate/report` 八步 | `ReviewAnalysisOrchestrator` 与八个独立 Step；差评到痛点、改良、区间预估、报告，逐步审计、失败定位、检查点重试 |
| `arsss6630/meli-picker` | `handleAnalyze()`、`fetchMeliData()`、`parseSearchResults()`、`analyzeWithAI()`、`translateToChineseWithAI()`、`fetch1688Data()`、`calculateProfitMargin()` | `MarketSearchProvider`、`KeywordTranslationService`、`SupplierMatchService`、`ProfitCalculator`；保留原始证据并以 MySQL 5.7 重建数据模型 |
| `huang-doudou567/snack-selection-agent` | `smart_selection()`、`precise_price_compare()`、`brand_strategy_insight()`、`identify_scene()`、`query_category_structure()`、`create_llm()`、`get_system_prompt()` | `AgentToolRegistry`、选品/比价/类目/场景工具；每个工具定义权限、输入 Schema、组织范围、审计和受控失败 |
| `UnknowTT16/WeaveAI_Agent` | `api_generate_report()`、`api_action_plan()`、`process_uploaded_file()`、`api_forecast_sales()`、`api_product_clustering()`、`api_sentiment_analysis()`、`api_generate_and_save_report()` | `DatasetValidationService`、预测/聚类/购物篮/情感服务、`ReportExportService`；上传数据、分析版本、图表和导出可复现且按组织隔离 |
| `xnningerhahaha/AmazonProductSeletionTool` | `BaseAnalyzer.analyze()`、`getLevel()`、`clampScore()`、`calculateStandardDeviation()`、`calculatePercentile()`；需求、竞争、价格、同质化、评论缺陷、存活率等子分析器 | 可插拔 `Analyzer` 接口，返回 `score/reason/evidence_ids/confidence/missing_fields`；单分析器单测和单 ASIN 集成测试 |

参考使用规则：`next-daily-hot` 为 MIT，如复制具体代码须保留许可证与版权；TrendRadar 为 GPL-3.0，不并入项目；其余未声明许可证的仓库只作为方法、字段、接口和测试设计参考，所有 ScoutOps 代码独立重写。新对象包括 `subscription_rules`、`topic_clusters`、`review_analysis_runs`、`review_pain_points`、`improvement_hypotheses`、`analysis_artifacts`、`agent_tool_calls`、`report_exports`；新增接口组为 `/subscriptions`、`/reviews`、`/analysis`、`/reports`，新增事件为 `subscription.matched`、`review.analysis.completed`、`analysis.validation.completed`、`report.exported`、`agent.tool.called`。

---

## 7. 数据库与数据治理设计

### 7.1 核心表

| 领域 | 表 |
|---|---|
| 身份组织 | `users`、`organizations`、`workspaces`、`teams`、`memberships`、`roles`、`permissions`、`resource_grants`、`sessions`、`login_events` |
| 来源采集 | `providers`、`credential_assets`、`provider_connections`、`provider_health_checks`、`collection_plans`、`collection_tasks`、`collection_subqueries`、`task_attempts`、`dead_letters`、`crawler_profiles` |
| 证据质量 | `raw_evidence`、`normalized_records`、`field_provenance`、`data_quality_issues`、`reconciliation_runs` |
| 业务决策 | `trend_signals`、`trend_topics`、`competitors`、`competitor_snapshots`、`suppliers`、`supplier_quotes`、`opportunities`、`opportunity_scores`、`decisions` |
| 协同实时 | `tasks`、`task_comments`、`approvals`、`automation_rules`、`automation_executions`、`outbox_events`、`notifications`、`notification_preferences`、`report_exports` |
| 安全运营 | `audit_logs`、`export_jobs`、`api_clients`、`api_tokens`、`webhook_endpoints`、`webhook_deliveries`、`config_releases` |
| 商业化预留 | `plans`、`subscriptions`、`usage_meters`、`quota_overrides`、`billing_periods` |

### 7.2 必须存在的字段与索引

- 每个业务表：`id`、`organization_id`、`workspace_id`（适用时）、`created_at`、`updated_at`、`created_by`、`version`、`deleted_at`（适用时）。
- 任务表：`status`、`coverage_status`、`successful_subquery_count`、`failed_subquery_count`、`blocked_subquery_count`、`priority`、`scheduled_at`、`leased_at`、`lease_expires_at`、`started_at`、`finished_at`、`idempotency_key`、`attempt_count`、`trace_id`；子查询表按来源、目标、状态、错误、字段覆盖和证据引用保存。
- 证据表：`source_url`、`canonical_url`、`content_hash`、`captured_at`、`parser_version`、`retention_until`、`object_key`。
- 关键复合索引：`(organization_id, status, updated_at)`、`(organization_id, external_id)`、`(status, scheduled_at)`、`(lease_expires_at)`、`(organization_id, occurred_at)`。
- 所有唯一约束、外键策略、归档策略和分区策略必须在本总计划的数据模型章节中逐表定义，并在实施时同步至数据库迁移说明。

### 7.3 保留、删除与脱敏

- RSS 原始证据默认保留 90 天；标准化信号保留 24 个月；由来源合同覆盖。
- 不保存论坛用户身份、私信、密码、Token 明文或不必要全文；平台资产 Cookie、凭证和浏览器档案仅按 5.1.1 的加密载荷规则保存，业务表不得保存明文或可直接使用的副本。
- 用户删除请求、组织注销、数据导出和数据保留到期均有异步任务、审批、审计和可恢复窗口。
- 数据修正保留前后值和修正原因，不允许覆盖式静默修改。

---

## 8. API、开放平台与安全设计

### 8.1 API 规范

- 内部 API 使用 `/api/v1`；开放 API 使用 `/open/v1`，独立鉴权、中间件、限流和审计。
- OpenAPI 先行：所有路由、DTO、错误码、分页、权限、审计等级和事件在编码前写入 `docs/openapi.yaml`。
- 统一响应：`data`、`meta`、`request_id`；错误响应含 `code`、`message`、`action_hint`、`request_id`。
- 列表接口必须分页，默认 50、上限 200；导出使用异步任务，禁止一次性查询全部数据。
- 写操作使用 `Idempotency-Key`；更新使用 `version` 乐观锁；关键操作要求二次确认令牌。
- API 接受 1–128 字符的安全 `X-Request-ID` / `X-Trace-ID`，非法上游值重新生成；认证中间件只有在受信 Token verifier 返回组织 claims 后才放行，缺少组织或 capability 默认拒绝。`/health/ready` 只返回同步依赖类别与可用性，不暴露主机、账号、库表或 Redis 键。

### 8.2 API 路由组

| 路由组 | 作用 |
|---|---|
| `/api/v1/auth/*` | 登录、登出、MFA、密码重置、会话 |
| `/api/v1/me/*` | 个人资料、偏好、会话、我的 Token |
| `/api/v1/org/*` | 组织、成员、角色、工作区、团队 |
| `/api/v1/trends/*` | RSS/新闻主题、信号、订阅和证据 |
| `/api/v1/opportunities/*` | 机会、评分、决策、验证活动 |
| `/api/v1/competitors/*` | 竞品、快照、监控和阈值 |
| `/api/v1/sourcing/*` | 找货、供应商、报价、利润 |
| `/api/v1/tasks/*` | 任务与审批 |
| `/api/v1/automations/*` | 版本化规则、人工暂停、限流和安全动作执行记录 |
| `/api/v1/reports/*`、`/api/v1/report-exports/*` | 事实聚合、异步 CSV、生命周期和受保护下载 |
| `/api/v1/realtime/*` | SSE 事件、事件重放和连接状态 |
| `/api/v1/platform/*` | 平台管理、Provider、采集、监控、审计 |
| `/open/v1/*` | API Client、用量、Webhook、面向客户的开放能力 |

### 8.3 安全控制

1. 密码使用 Argon2id；登录限流、账户锁定、异常 IP/设备检测、会话撤销、一次性密码重置。
2. 平台管理员和安全管理员强制 MFA；普通用户可选 MFA。
3. API Token 只保存哈希；创建时明文只显示一次；支持 scope、过期、轮换、撤销和最后使用记录。
4. 使用参数化 SQL、请求 schema 校验、输出编码、CSRF 防护、CORS 白名单、速率限制和安全响应头。
5. 文件上传做 MIME/扩展名双校验、大小限制、病毒扫描、宝塔受控文件目录隔离、短期签名下载。
6. Webhook 做签名验证、时间戳容差、重放保护、SSRF/DNS 防护、投递重试和最终失败证据。
7. 凭证、Cookie、私钥按 5.1.1 的应用层加密方案保管；应用日志、异常上报、审计和截图中全部脱敏。

#### 8.3.1 M01-01 本地身份实现基线

P01 首个模块只实现本地邮箱账号与自有会话：注册、邮箱验证、登录、登出、找回/重置密码、改密及会话查看/撤销。密码使用 Argon2id；随机会话与动作令牌只存哈希，生产会话仅通过 Secure、HttpOnly、SameSite=Strict Cookie 传递。验证/重置投递负载以 AES-256-GCM 加密写入 MySQL Outbox，由宝塔管理的 Node Worker 以租约、重试、死信和审计处理。生产邮件 Provider 尚未确认时必须显式阻断投递，不把原始令牌返回页面，也不把阻断误报为成功。MFA 与 OIDC/SAML/SCIM 仍由 M01-02 实现，组织与权限不在本模块提前创建。

#### 8.3.2 M01-02 MFA 与企业身份适配基线

TOTP MFA 遵循 RFC 6238：种子由 CSPRNG 生成并以 AES-256-GCM 加密，验证码默认 30 秒有效，成功时间步不可重放；启用时二次验证当前密码，只显示一次恢复码。密码登录在启用 MFA 后先建立短时 HttpOnly 挑战，第二因子成功并消费挑战后才建立正式会话；停用 MFA 同时撤销全部会话。OIDC 提供标准适配接口，SAML 2.0 与 SCIM 2.0 保留同一适配边界，但在 Provider 审批、组织域名和属性/回收映射完成前均不得启用或展示假入口。

#### 8.3.3 M01-03 组织与工作区上下文基线

组织、工作区、组织级团队和组织成员资格使用 MySQL 5.7 事务与外键保存。普通账号只能列出本人仍为活动成员的组织，并在该组织内读取工作区和团队摘要；会话上下文选择必须同时验证活动成员资格、活动组织及工作区归属，成功后同步写入 `user_session_contexts` 和带 `organization_id`、`workspace_id`、`request_id`、`trace_id` 的租户审计。组织创建仅保留为后续平台管理模块调用的内部原子服务，本模块不提供普通用户创建入口；角色、数据范围与团队成员规则由 M01-04 定义，不能在 M01-03 猜测。

#### 8.3.4 M01-04 RBAC 与数据范围基线

RBAC 使用固定、版本化的八类角色与能力代码；数据范围独立表达为本人、团队、工作区、组织或平台。服务端先验证活动成员资格和能力，再使用真实资源 owner/team/workspace/organization 字段匹配范围，缺失事实、缺失能力、成员失效或范围不符一律拒绝。平台角色单独分配，组织管理员不能获得平台能力。API、Worker、导出、文件、事件和 SSE 复用同一 `AuthorizationService` 能力名称；前端菜单和角色页面只展示服务端结果，不能代替授权。每次 Guard 允许或拒绝均保存 actor、请求范围、执行面、原因、request_id/trace_id。M01-04 不提前实现 M01-05 的指定资源临时授权，也不开放自定义角色或浏览器端权限写入。

#### 8.3.5 M01-05 资源临时授权基线

Resource Grant 只补充 RBAC/Data Scope 无法覆盖的指定资源例外：目标必须是同一组织的活动成员，组织、工作区、资源类型、资源 UUID 和动作全部精确匹配。首发资源类型为任务、机会、竞品和供应链，动作仅采用对应的既有只读/协作能力；原始证据下载、导出、凭证引用与任务重放不在授权白名单。创建、延长与撤销需要组织范围和既有 `role:manage`，目标成员查询需要 `membership:read`，组织只读列表需要 `role:read`；成员可读取自己的授权。业务原因、授权人、到期时间和乐观版本锁必填，到期最长 30 天，过期或撤销不能恢复。创建、延长、撤销、到期、实际访问与访问拒绝同步写专用审计，最终 Guard 决定继续写 `authorization_decisions`。到期由 MySQL `expires_at` 在列表和访问时同步判定，不依赖异步任务或面板外调度。

#### 8.3.6 M01-06 审计与种子管理员基线

首次平台超级管理员只能由宝塔受限发布任务读取临时的 `PLATFORM_ADMIN_SEED_EMAIL` 与 `PLATFORM_ADMIN_SEED_PASSWORD` 后创建；仓库、浏览器、常驻 API/Worker、日志和审计都不得读取或保存明文。种子事务原子写入活动用户、`platform_super_admin` 角色、单次运行状态和脱敏平台审计；重复执行只返回既有种子用户，不创建第二个账号。成功后必须从宝塔任务环境删除两个变量。种子账号首次登录只能使用受限会话：完成强制改密与 TOTP MFA 前，普通 API 统一返回 `security_setup_required`；改密撤销全部会话，MFA 确认后才完成安全激活。

平台审计与组织审计采用只读、游标分页查询，服务端分别验证平台或组织范围的 `audit:read`。审计员保留业务只读、报告和审计读取能力，不获得任务重放、凭证、密钥轮换或角色写入能力。平台级事件允许 `organization_id` 为空，组织事件必须精确绑定组织；事件只保存脱敏元数据、结果、资源引用、`request_id`、`trace_id`、时间和 schema 版本。种子与审计权限属于同步安全真相，不进入 Worker、Crawler、Redis 队列或面板外调度。

#### 8.3.7 M03-01 来源注册中心实现基线

`providers` 只保存平台全局、版本化的来源技术合同，不包含 `organization_id`、`workspace_id`、凭证明文或组织启用状态。合同固定包含目标 URL/标识、接入模式、市场、语言、字段、频率、并发、超时、重试、熔断、去重、保留期、失败规则、Parser 版本、健康检查地址、负责人和状态；新建默认 disabled。创建和更新在 MySQL 5.7 事务中同步写当前值、不可变版本快照、操作人、request_id/trace_id 与幂等记录，并用乐观版本锁拒绝静默覆盖。列表和写入只允许具备平台能力 `provider:configure` 的已登录用户，写入还校验同源 Origin 和 Idempotency-Key。M03-01 不创建采集任务、队列、租约、死信、凭证资产或组织连接；这些由后续归属模块实现，来源登记或 enabled 状态在 M03-03 前都不代表生产采集能力。

#### 8.3.8 M03-02 平台凭证资产实现基线

`credential_assets` 与 `crawler_profiles` 是平台全局安全资产，不带组织/工作区归属。秘密写入使用 AES-256-GCM、随机 96 位 nonce、128 位认证标签和绑定资产/类型/key_version 的 AAD；数据库保存当前密文与不可变密文版本，API 和页面只返回指纹、版本、状态及引用，绝不提供明文读取、导出或下载。创建、轮换、撤销和档案登记要求 `key_rotation:manage`、同源 Origin、Idempotency-Key 与乐观锁，并同步保存操作人和 request_id/trace_id；撤销不可恢复。Worker/Crawler 仅可在授权任务中通过受限 `CREDENTIAL_TEMP_ROOT` 临时物化，回调结束或异常时必须清空 Buffer 并删除准确目录。主密钥与版本只在宝塔受限环境；主密钥轮换由宝塔一次性、可续跑任务逐个重加密 active 资产，全部校验完成后才能切换常驻配置和撤销旧密钥。M03-02 不提前创建组织连接或真实采集任务，M03-04 才接入 Playwright 执行链。

#### 8.3.9 M03-03 Provider 适配器实现基线

`ProviderAdapter` 统一 `collect`、`normalize`、`healthCheck`，以 Provider code 注册并校验 access mode。collect 强制携带组织/工作区 scope、关联 ID 和批次上限；运行时限制超时、响应字节与条数，normalize 保留 evidence_ref 及 Provider/Adapter/Parser provenance。Provider 和健康状态是平台全局技术资产，MySQL 5.7 保存当前健康、不可变版本、幂等操作与 request_id/trace_id；API 只允许 `provider:configure`，不返回凭证、Cookie 或原始 payload。M03-03 不猜具体平台接口：生产注册表在 M03-07 前为空，未注册实现必须记录 `blocked / adapter_not_registered`。M03-04、M03-05、M03-06 分别负责浏览器执行、任务状态机与证据持久化，不能由本模块提前替代。

#### 8.3.10 M03-04 Playwright Crawler 执行基线

`authenticated_browser` 使用项目依法持有的账号和 M03-02 加密浏览器档案，由 Python Crawler 通过无 shell 插值的 stdin/stdout 桥接调用 Node Playwright Chromium。执行计划仅接受 HTTP(S)、明确 origin 白名单和有上限的搜索、分页、滚动及详情动作；登录、验证码、robots、429、超时、Parser 变化和依赖失败必须如实受阻或失败，禁止绕过登录、验证码、付费墙和站点限制。档案以受限 `tar.gz` 临时解包，拒绝路径穿越、链接和资源超限，并在全部结果路径关闭 context、清空 Buffer 和删除准确临时目录。

浏览器档案是平台全局安全资产，但每次低层运行必须带 `organization_id`/`workspace_id`。MySQL 5.7 以档案主键独占租约、令牌摘要、心跳、到期时间和 `SELECT ... FOR UPDATE` 防止并发复用；首次 acquire 才向内部 Crawler 返回令牌，幂等重放和监控 API 均不返回令牌。运行、租约事件和过期回收都保留 request_id/trace_id。平台监控和显式过期回收只允许 `collection:replay`，写入还校验 Origin 与 Idempotency-Key。M03-04 不创建 M03-05 的采集任务状态机/队列/重试/死信，不保存 M03-06 证据，也不提前编造 M03-07 来源选择器。

#### 8.3.11 M03-05 采集任务状态机实现基线

MySQL 5.7 是采集任务、子查询、执行尝试、租约、死信、事件和 Outbox 的事实源；Redis 只保存按组织/工作区隔离的就绪信号与短租约，不能决定任务完成。调度与领取使用行锁，Worker 仅持有原始租约令牌，数据库保存带域分离的 SHA-256 摘要。租约到期或 Redis 协调冲突必须显式回收，不能让任务永久停留在 leased。

任务严格执行 5.4 的状态、总尝试 4 次、1/5/15 分钟退避与受阻规则；子查询逐项保存结果与缺失字段，再计算 `complete/partial/insufficient`。人工重放仅针对 `dead_letter`，要求 `collection:replay`、同源 Origin、Idempotency-Key 与原因，创建新的 scheduled 任务并保留原任务全部历史。监控 API 不返回内部 target、租约令牌或凭证。M03-05 不保存 M03-06 原始证据，也不在 M03-07 前注册或启动真实来源执行器。

#### 8.3.12 M03-06 证据与数据质量实现基线

MySQL 5.7 保存组织/工作区范围化的原始证据元数据、规范记录版本、字段溯源、核对运行、质量问题、事件、Outbox 和幂等操作；原文保存在宝塔管理且位于中国境内的 `EVIDENCE_ROOT`。Provider 提供的去重键按组织、工作区和 Provider 隔离：同键同内容只返回已有证据，同键异内容返回显式冲突，禁止静默覆盖。Worker 在事务失败时删除本次精确文件，不宽泛清理目录。

质量核对按 Provider、Parser、市场和时间窗记录分子、分母、冻结阈值及样本不足状态，覆盖标题、价格、币种、外部 ID、规范 URL、重复、供应商误匹配、AI 抽检、新鲜度和来源成功率。问题解决使用 `expected_version`、同源 Origin 与 Idempotency-Key，只追加解决原因、操作人、事件和 Outbox，不改写原始证据或历史核对。平台数据页面和 API 要求 `platform:operate`；原文下载使用最长 300 秒的组织/工作区/证据/路径绑定授权，签发和实际访问分别审计，下载前核对大小与 SHA-256。M03-07 前仅接入合成实库验收，不编造真实来源 URL、字段、选择器或接口合同。

#### 8.3.13 M03-07 首批来源实现基线

首批来源固定为 `google_news_search` 与 `manual_product_supply_csv`。Google News 使用代码内固定的关键词 RSS URL 模板，只接受关键词，不接受调用方 URL、重定向、凭证或任意 Header；解析 title、summary、published_at、source_url 和 publisher，限制 2 MB 且每任务最多持久化 20 条。商品与供应链来源采用权利明确的显式 CSV 导入，固定八列表头，限制 1 MB、100 条数据行且每任务最多持久化 20 条；没有真实凭证和已确认接口合同的平台不得伪造接入。

目录项默认 `disabled`。Google RSS 的端点可访问不等于生产授权，所有者必须复核当前条款、频率、展示字段和保存期限后显式启用。目录/登记要求 `provider:configure`，回放要求 `collection:replay`、同源 Origin、Idempotency-Key、启用 Provider 以及活动组织/工作区。API 在事务中写 M03-07 replay run 与 M03-05 task/subquery/event/outbox；宝塔 Node Worker 使用 Redis 租约执行真实适配器，将原始内容先交给 M03-06 证据持久化，再保存规范化字段与逐字段 provenance。生产服务仍全部由宝塔管理；本模块不创建面板外服务。

当惠州出口不能直连 Google News 时，只允许在 ScoutOps 的宝塔 Node API、Node Worker 和有限来源任务中注入 `PROVIDER_PROXY_*` 项目配置。代码仅对固定 `news.google.com` HTTPS 请求建立带 Basic 认证的 HTTP CONNECT，其他 Provider、AI、API 请求和系统进程继续直连；禁止设置全局 `HTTP_PROXY`/`HTTPS_PROXY`，禁止将代理地址或凭证下发浏览器、写入 Provider DTO、日志或 Git。代理不能放宽 10 秒健康门、2 MB 响应和每任务 20 条限制。

P03 已于阶段自动验收 `01b8e9ff-d2c4-4a5a-80b3-673ee96dbea7` 通过；M03-01 至 M03-07 的构建、MySQL 5.7、Redis、浏览器、真实来源探针、证据链、权限、视觉与文档门均重新执行成功。此结论只证明 P03，不代表 P04–P08 或多节点/10,000 用户能力完成。

---

## 9. 技术架构、性能与容量

### 9.1 运行拓扑

```text
Internet / 企业 SSO
        │
宝塔网站 + TLS + WAF
        │
Web (Vue 静态站点) ── API (Node.js) ── MySQL 5.7
                              │                    │
                              ├── Redis（缓存、队列、限流、SSE）
                              ├── Node Worker（评分、Outbox、通知、报表）
                              ├── Python Crawler（Playwright/API Provider）
                              ├── 本地受控文件存储（原始证据、导出）
                              └── 宝塔日志、监控与应用 trace_id
```

开发环境可采用 Docker Compose；生产部署在中国境内自有服务器，且所有生产服务必须由宝塔面板创建、展示、启动、停止、重启、查看日志和配置。前端作为宝塔网站部署；Node API 与 Node Worker 作为宝塔 Node 项目部署；Python Crawler 作为宝塔 Python 项目部署；MySQL 5.7、Redis 和定时任务使用宝塔已安装的对应服务或插件。不得以系统级 systemd、独立 PM2、宿主机 crontab、屏外 Docker Compose、外部托管队列、外部数据库或外部对象存储承载生产能力。Crawler 使用隔离网络策略、独立资源上限和按来源的并发限制。

P00 Redis 连接只从后端环境读取 `REDIS_HOST`、`REDIS_PORT`、`REDIS_PASSWORD` 与 `REDIS_CONNECT_TIMEOUT_MS`；浏览器不得读取。S0 键使用 `scoutops:v1:<purpose>:org:<organization_id>:ws:<workspace_id>:…` 命名，缓存、队列、限流、SSE 协调均设置有限 TTL，Redis 不作为业务或事件事实源。

#### 9.1.1 单机部署与稳定性合同

生产长期固定为**单机企业应用阶段（S0）**，不是已承诺的 10,000 用户高可用 SaaS：惠州 `192.168.1.220` 上由宝塔管理一个网站、一个 API、一个 Worker、一个 Crawler、MySQL 5.7、Redis 和本地受控文件目录。当前决策不增加服务器、不启用负载均衡、Redis Sentinel、MySQL 只读副本、共享文件节点或横向 Crawler。S0 的规划上限仍为 100 用户、5–20 并发业务用户，最终只以 M08-06 实测容量边界为准；同机加密备份与逻辑隔离恢复不保护整机、磁盘或机房故障，也不构成自动高可用或异地灾备。

P00 交付 `infra/baota/service-manifest.json` 与 Nginx 模板作为 S0 创建清单；其中 `productionDeployed=false` 在实际宝塔对象创建、配置、发布签发和健康验收前不得改为已部署。Worker/Crawler 使用 5–60 秒受控心跳并响应 SIGTERM/SIGINT；修改心跳配置后在宝塔重启对应项目。

| 部署 | 网站与实时 | 数据与文件 | 异步与采集 | 故障与恢复 |
|---|---|---|---|---|
| S0：惠州单机 | 宝塔网站 Nginx 只反代一个本机 API；不配置上游池；SSE 由单 API 提供并以 `Last-Event-ID` 重放 | MySQL 5.7 单主、单 Redis、宝塔本地受控目录和同机独立加密恢复目录 | 1 Worker、1 Crawler；使用租约、幂等、来源配额和浏览器档案独占 | 人工在宝塔重启、回滚或从同机加密副本隔离恢复；整机、磁盘和机房故障无恢复保证 |

P08 不再是多节点扩展阶段，而是把这套单机合同做成可观测、可降载、可恢复、可回滚的最终生产边界。任何页面、API、证据或文档都必须明确 `load_balancing_enabled=false`、`backup_server_used=false`、`multi_node_claim=false` 和 `capacity_claim=unverified`，直到 M08-06 的单机实测仅形成有限容量边界；即使阶段完成，也不得宣称多节点、高可用或 10,000 用户能力。

M08-06 的实现合同使用 MySQL 5.7 `capacity_boundary_observations` 保存同提交受控基线和 API 复核观测，以固定的核心读 P95 300 ms、核心写 P95 600 ms、错误率 1%、异步滞后 60 秒及现有单机资源停止线失败关闭。宝塔有限任务固定按 5→10→20 并发逐档测量，每档生产窗口不少于 60 秒；低档位越线立即停止，三档不能通过配置跳过。`GET /api/v1/platform/operations/capacity` 只向 `platform:operate` 返回实测档位、规划值、脱敏性能/资源/韧性和降载结论；`POST /api/v1/platform/operations/capacity/drills` 只允许同源、幂等地签认已被生产事实验证的本机加密归档与隔离恢复，不创建服务或拓扑。规划 100 用户和 5–20 并发只是测量安排；只有同提交生产证据通过后才允许 `capacity_claim=measured_single_host_limited`，且仅限实测档位，不等于 100 人同时在线承诺。当前实现已完成本地定向测试，仍等待同提交生产灰度、容量基线和模块门，因此 P08 尚未完成。

#### 9.1.2 已确定的基础设施基线

| 能力 | 基线决策 | 约束 |
|---|---|---|
| 身份与企业 SSO | 首发使用本地账号、Argon2id、TOTP MFA 与 OIDC；不强制启用企业 SAML。SAML 2.0 与 SCIM 2.0 通过同一身份适配层保留，首个支持的企业身份供应商为 Microsoft Entra ID | 仅在客户合同、域名验证、属性映射和账号回收测试通过后，对该组织启用 SAML/SCIM；平台管理员必须 MFA |
| 密钥与文件存储 | 采用“数据库/宝塔目录保存 AES-256-GCM 密文 + `CREDENTIALS_MASTER_KEY` 仅在宝塔受限项目环境”的方案；证据与导出使用服务器本地受控目录，并由宝塔任务写入同机独立加密恢复目录 | 具体载荷、轮换、审计和临时解密规则以 5.1.1 为准；不使用 Vault、不将主密钥入库、不进 Git、镜像、日志或截图；同机副本不保护整机故障；不配置共享文件节点 |
| 部署与区域 | 生产主机房位于广东惠州；当前不配置备用服务器，备份和隔离恢复在现有主机内由宝塔管理 | 真实客户数据、数据库和主文件存储不出中国境内；不得在宝塔面板外创建运行服务；不得把同机恢复表述为异地灾备 |
| 邮件 | 生产邮件服务商尚未确认；通过独立 Provider Adapter 接入，最终 Provider 必须支持投递、退信、投诉、延迟、失败与抑制状态回调 | 未确认 Provider 前仅允许测试收件箱；生产启用状态为 `pending_provider_selection`，Webhook 必须验签、幂等入库并写入通知审计 |
| 可观测性 | 使用宝塔面板服务监控、访问日志、错误日志和项目日志；应用统一输出 `request_id`、`trace_id` 与结构化业务事件 | 禁止向日志写入凭证、Cookie、Token 明文或完整敏感 payload；所有日志必须可从宝塔面板查看和轮转 |
| 搜索与分析 | 业务交易与首期检索以 MySQL 5.7 索引、分页和受控聚合为准；如容量验证证明必须引入搜索引擎，只能通过宝塔面板的 Docker/服务管理能力部署并管理 | 搜索索引是可重建派生数据，必须带组织过滤字段，不能成为权限真相来源；未经宝塔可见、可操作的部署方式不得使用 |

P00 文件路径固定包含 `organizations/<organization_id>/workspaces/<workspace_id>`，拒绝路径穿越与不安全段；短时下载授权绑定组织、工作区、相对路径、随机值与过期时间，最长 300 秒。文件写入使用同目录临时文件后原子重命名。审计元数据递归脱敏 password、secret、token、cookie、authorization、API key 和 private key 类字段。

#### 9.1.3 邮件 Provider 选择与跨境处理准入

结论：**Resend 仅为候选，当前不确认任何生产邮件 Provider。** 邮箱地址、姓名（如使用）以及邮件正文、投递状态和 Webhook 记录均按个人信息处理。最终选择境外 Provider 时，不得因服务器位于中国境内而将数据传输视为已合规；选择境内 Provider 时，仍须完成个人信息、邮件内容、供应商权限和审计评估。

启用生产发送前必须由法务/数据保护负责人完成并留档以下事项：

1. 从候选 Provider 取得并审核数据处理协议（DPA）、处理方名称与联系方式、处理/存储地区、子处理者、保留期限、安全措施、事件通知与删除机制。
2. 形成数据流和最小字段清单：默认只允许收件邮箱、通知模板变量、消息 ID 与投递状态；邮件正文不得包含密码、Token、Cookie、身份证件、支付信息、完整业务证据或其他敏感个人信息。
3. 完成个人信息保护影响评估（PIPIA），确认数据出境数量、是否涉及敏感个人信息、处理目的、风险、个人权利响应方式和适用的数据出境机制；不得仅凭“数量较少”跳过该评估。
4. 更新隐私政策与通知文案；在法律要求的情形下，向个人告知境外接收方、目的、方式、字段与权利行使路径，并取得相应同意。
5. 选择境外 Provider 时，由法务根据实际年度出境数量、敏感信息范围和是否属于关键信息基础设施运营者，确认适用的安全评估、标准合同、个人信息出境认证或法定豁免路径；结论、依据与复核日期写入审计。
6. Provider 确认后，使用非真实用户的测试地址完成域名验证、Webhook 验签、幂等、退信/投诉/抑制名单处理和停用演练，才可将状态改为 `enabled`。

### 9.2 前端性能要求

- 初次 JavaScript gzip 小于 250 KB；路由和图表按需加载。
- LCP 小于 2.5 秒、INP 小于 200 ms、CLS 小于 0.1（代表性桌面网络条件）。
- 表格超过 500 行使用服务端分页；超过 2,000 行使用虚拟滚动。
- 筛选条件变化使用 300 ms 防抖、可取消请求、URL 同步保存。
- SSE 事件按资源去重合并，不能使列表每条事件都整页刷新。

### 9.3 后端性能与容量目标

| 规模 | 预期使用 | 必须配置 |
|---|---|---|
| 不超过 100 用户的规划范围 | 5–20 并发业务用户、低频任务；最终以 M08-06 实测为准 | S0 单机：单 API、1 Worker、1 Crawler、单 Redis、MySQL 5.7 单主、宝塔本地受控目录、同机加密备份与降载策略 |
| 1,000 用户及以上 | 不在当前单机生产合同内 | 不得用推算、局部压测或同机多进程宣称支持；需要重新立项并改变服务器约束 |
| 10,000 用户 | 明确不支持且不验收 | 不实现或宣称多副本、读写分离、共享存储、跨节点恢复或搜索派生集群 |

服务目标：核心读 API P95 小于 300 ms，核心写 API P95 小于 600 ms；后台任务吞吐和来源限制以来源合同为准；任何超过阈值的任务必须在后台显示积压和影响范围。

---

## 10. 监控、备份、灾备与发布

### 10.1 指标与告警

必须采集：API P50/P95/P99、错误率、数据库连接/慢 SQL、Redis 内存、队列等待、租约超时、死信、Provider 成功率、来源新鲜度、SSE 在线数、导出耗时、受控文件目录增长、成本，以及 13.2 定义的字段质量与证据覆盖率。

告警分级：

- P1：登录不可用、跨组织风险、数据库不可用、密钥泄露疑似、全局采集停止。
- P2：单个核心来源持续失败、队列严重积压、任务丢失风险、导出失败率异常。
- P3：数据新鲜度下降、非核心来源受限、单个组织配额异常。

每条告警必须有：影响范围、开始时间、当前状态、负责人、Runbook、trace ID 和关闭原因。

### 10.2 健康检查

- `/health/live`：进程活着。
- `/health/ready`：仅表示当前 API 副本可处理其同步职责：进程、MySQL、Redis 和必需配置可用；不得因 Worker 或 Crawler 临时故障而将正常 API 副本判为不可用。
- `/health/async`：Worker、队列租约、Outbox 消费与通知投递能力；用于异步能力告警和发布门禁。
- `/health/crawlers`：Crawler 容量、隔离网络与按来源队列的可用性；用于采集能力告警和发布门禁。
- `/health/providers`：按来源输出最近健康状态，平台管理员可见。
- `/health/version`：构建版本、迁移版本、配置版本；构建身份从后端 `APP_VERSION` 与 `BUILD_SHA` 注入，不暴露密钥。

### 10.3 备份恢复

- MySQL：每日全量备份 + binlog/PITR；备份加密、校验。当前 S0 只使用惠州现有主机内分离的宝塔受控密文目录与隔离恢复库，不配置备用服务器，不声明整机、磁盘或机房故障保护；后续如重新引入异地主机必须另行确认并重新验收。
- 文件证据与导出：按组织、目录和生命周期策略写入宝塔本机受控目录，并由宝塔任务写入同机独立加密恢复目录；不配置共享文件服务或跨节点挂载。
- 配置：来源、规则、工作流、权限和 Feature Flag 独立版本化备份。
- 每次迁移前自动备份；迁移记录保存 checksum、操作者、开始/结束和回滚说明。
- 每季度在隔离环境执行一次恢复演练，验证业务数据、审计链、对象证据和权限边界。

### 10.4 发布策略

代码审查 → 单元/契约测试 → 集成测试 → 安全扫描 → 预发布 → 浏览器 E2E → 性能基线 → 迁移演练 → 灰度 → 指标观察 → 发布签发。

配置、来源和规则通过版本化发布：草稿、校验、审批、灰度、全量、回滚。禁止生产环境直接改数据库或直接编辑凭证文件。

#### 10.4.1 量化发布门槛

- 灰度前 24 小时：核心读 API P95 ≤ 300 ms、核心写 API P95 ≤ 600 ms、5xx 错误率 < 0.5%、无未解决 P1/P2 安全问题、迁移演练与备份校验通过。
- 异步能力：核心队列等待 P95 < 60 秒、无超过 15 分钟未处理的租约、死信增长率为 0；核心来源最近一次成功或受控受阻状态不得超过其计划频率的 2 倍。
- 灰度顺序为 5% → 25% → 100%，每阶段至少观察 30 分钟；任一阶段出现 5xx 错误率 ≥ 1%、核心 API P95 连续 10 分钟超过目标 2 倍、跨组织/权限异常、数据丢失风险或 P1 告警时自动停止并回滚到上一稳定版本。
- MySQL 恢复目标为 RPO ≤ 15 分钟、RTO ≤ 4 小时；备份恢复目标环境必须位于中国境内。对象证据与审计链恢复后必须执行组织隔离和哈希校验。发布前最近一次隔离恢复演练不得超过 90 天。

### 10.5 代码提交、宝塔部署与运行配置

#### 10.5.1 代码仓库与提交纪律

- 唯一远程仓库为公开 GitHub 仓库 `https://github.com/18Mozhi/midou-ai-Product-Selection.git`。GitHub 仅用于源代码托管、审查和提交，不承载任何生产运行服务。
- 首次初始化和后续变更均须提交到该仓库；提交前执行与改动匹配的验证，暂存仅限本次任务文件，禁止提交 `.env`、宝塔导出、数据库备份、Cookie、Token、私钥、密码和运行日志。
- 宝塔拉取公开仓库无需读取凭证；如未来改回私有仓库，Deploy Key、Personal Access Token 或 SSH 私钥仅保存在宝塔面板的受限部署配置中，不能写入 Git、文档或代码配置样例。

#### 10.5.2 宝塔服务映射与操作边界

生产目标服务器为 `192.168.1.220`，主域名为 `midouai.mozhiz.cn`。域名、HTTPS 证书、反向代理、静态前端、Node 项目、Python 项目、MySQL、Redis、日志、备份和计划任务必须能在宝塔面板中查看并操作。

| 能力 | 宝塔中的可见对象 | 部署方式 |
|---|---|---|
| Vue 3 前端 | 网站 `midouai.mozhiz.cn` | 构建静态文件后发布到宝塔网站根目录；HTTPS、缓存和反向代理由网站配置管理 |
| Node API | Node 项目 `product-scout-api` | 宝塔 Node 项目管理器启动、停止、重启和查看日志；仅监听本机端口，由网站反向代理 |
| Node Worker | Node 项目 `product-scout-worker` | 宝塔 Node 项目管理器管理；队列消费、Outbox、通知和报表与 API 独立运行 |
| Python Crawler | Python 项目 `product-scout-crawler` | 宝塔 Python 项目管理器管理；采集与浏览器任务不能由用户请求进程直接执行 |
| MySQL | MySQL 5.7 服务与数据库 `product_scout` | 账号 `product_scout` 仅授予该库所需权限；密码只在宝塔数据库配置和运行环境变量中保存 |
| Redis | Redis 服务 | 仅绑定本机或受控内网；用于缓存、队列、限流和 SSE 协调 |
| 文件证据/导出 | 宝塔受控目录与备份任务 | 目录按组织隔离，备份任务写入同机独立加密恢复目录；不得暴露为公网目录，也不声明整机故障保护 |
| 定时调度 | 宝塔计划任务 | 只触发应用内部调度入口；禁止另建宿主机 crontab 或屏外守护进程 |

宝塔网站必须将 `/api/` 与 SSE 路径反向代理到受控的本机 Node API，关闭 SSE 响应缓冲并配置与客户端重连策略一致的读取超时；不得将 API、Worker、Crawler、Redis 或 MySQL 端口直接暴露到公网。`192.168.1.220` 为内网地址，域名上线前必须由网络负责人提供固定公网入口或 NAT 映射、DNS A/AAAA 记录、80/443 转发规则和 TLS 证书签发条件；未满足时只允许内网预发布，不得宣称公网可用。

MySQL 必须以 5.7 兼容 SQL、`utf8mb4`、显式索引和迁移脚本为准；运行配置使用 `DB_HOST=127.0.0.1`、数据库名和业务账号 `product_scout`。不得引入 MySQL 8 专属语法或在应用中使用 root 数据库账号。部署服务器 root 登录密码与数据库密码属于密钥，不得写入仓库、文档、前端包或日志。

#### 10.5.3 AI 模型接入

- 模型服务地址为 `192.168.1.203:8588`，已验证 OpenAI 兼容基础路径为 `/v1`，`GET /v1/models` 返回 `Qwen3.5-9B-AWQ-4bit`；模型地址、基础路径和模型名均为后端环境配置，不得下发至浏览器。
- 已验证 `POST /v1/chat/completions` 的文本和最小 PNG 多模态请求可成功返回；4 个低负载文本并发请求均成功，单请求耗时约 0.72–0.82 秒。默认模型标识为 `Qwen3.5-9B-AWQ-4bit`；该结果不是生产容量承诺，并发上限、最大图像/请求大小和生产超时仍须在实施前通过受控容量测试确定。
- 当前接口不使用 API Key。适配器必须允许无 Key 配置，同时保留未来启用鉴权时的环境变量入口；模型调用超时、重试、限流、输入大小和图像大小必须可配置并写入审计。
- AI 仅用于计划既定的摘要、解释、分类和缺失项提示，不得作为原始事实、价格、利润、供应商资质或自动决策依据。

---

## 11. 新手上手、帮助与错误恢复

### 11.1 首日七步流程

1. 欢迎页：选择目标“找新品 / 监控竞品 / 1688 找货 / 观察热点”。
2. 选择工作区、目标市场和品类；页面解释每个选择对数据范围的影响。
3. 输入关键词、ASIN、Amazon 商品链接或合法图片；即时校验格式。
4. 创建任务：显示“已创建 → 排队 → 采集 → 解析 → 计算 → 生成结果”的实时进度。
5. 结果页：先展示“是否值得继续”和原因，再展示证据、竞争、成本、风险与下一步。
6. 建立持续动作：关注一个竞品、一个主题或一个供应商。
7. 第二天：首页展示新增热点、竞品变动、待决策机会和逾期任务。

### 11.2 全部状态的用户文案规则

| 状态 | 必须解释 | 用户动作 |
|---|---|---|
| 无结果 | 查询了哪些来源、无结果是否正常 | 调整关键词、扩大市场、创建人工任务 |
| 来源延迟 | 哪个来源延迟、影响哪些数据、上次成功时间 | 查看历史数据、订阅恢复通知 |
| 登录失效 | 不暴露技术细节，只说明来源暂不可用 | 无需操作；系统已通知管理员 |
| 权限不足 | 缺少何种角色、联系哪个组织管理员 | 发起权限申请 |
| 数据不足 | 缺哪项成本/价格/汇率/证据 | 补数据或创建协作任务 |
| 网络失败 | 是否已保存草稿、如何重试 | 重试、查看 request ID |

### 11.3 帮助系统

- 每个复杂字段有一句话说明和“为什么需要它”。
- 内置角色化检查清单、搜索帮助中心、问题反馈和 request ID 自动附带。
- 教学演示工作区可使用示例数据，但必须显著标记“演示”；真实组织数据不得混入。

---

## 12. 实施工作包与交付文件

本计划不以 MVP 名义删减工作包或验收范围；WP-00 至 WP-09 共同构成一个整体交付目标。工作包可按依赖顺序实施和验收，但任何未完成工作包不得被包装为“完整上线版本”。

实际执行以 [`plans/README.md`](plans/README.md) 为阶段索引：P00 先一次性完成所有阶段共用的基础框架，P01–P07 再完善业务功能，P08 按最新单机决策完成稳定性、资源保护、恢复和实测容量边界收尾。每个阶段已拆为独立小模块，均定义目标、依赖、交付物和自动验收命令；不得把 P08 表述为多节点扩展或 10,000 用户验收。

| 工作包 | 内容 | 依赖 | 完成标准 |
|---|---|---|---|
| WP-00 | 产品 PRD、术语、角色、来源政策、ADR | 无 | 业务术语、租户模型、来源政策无冲突 |
| WP-01 | 新仓库、CI、开发 Docker、宝塔部署基线、设计系统、OpenAPI 基础 | WP-00 | 本地可重复启动，宝塔预发布可重复部署且质量门禁可运行 |
| WP-02 | 登录、组织、RBAC、数据范围、个人中心 | WP-01 | 跨组织、越权、会话测试通过 |
| WP-03 | 三套前端壳层、完整信息架构与图片包驱动的 UI 实现 | WP-01、WP-02 | 普通、组织、平台菜单完全隔离；按 3.1.1 覆盖 72 个概念页、10 个核心高清页对应的页面状态与移动端验收 |
| WP-04 | 来源注册中心、RSS、健康检查、凭证引用 | WP-02 | 每个启用来源有真实健康与证据 |
| WP-05 | 队列、Crawler、解析、去重、死信和证据 | WP-04 | 成功/空/失败/受阻全状态可追溯 |
| WP-06 | 趋势、竞品、供应链、评分、利润、决策 | WP-02、WP-05 | 一次真实输入形成可解释机会 |
| WP-07 | Outbox、SSE、任务、审批、通知、自动化 | WP-05、WP-06 | 断线恢复、幂等、通知去重测试通过 |
| WP-08 | 平台运营、安全、审计、监控、开放平台 | WP-02 至 WP-07 | 管理员无需服务器权限即可运营 |
| WP-09 | 性能、安全、备份恢复、灰度和上线 | 全部 | 通过发布门禁与恢复演练 |

新仓库第一个提交必须包含：

```text
README.md
AGENTS.md
docs/openapi.yaml
docs/feature-map.json
scripts/locate_flow_v4.mjs
config/env.example
infra/docker-compose.dev.yml
```

每个工作包必须同时交付代码、数据库迁移、前端页面、API/事件合同、测试、配置样例、操作说明、监控项和回滚说明；禁止只交付页面或只交付接口。

---

## 13. 测试与最终验收矩阵

### 13.1 自动化覆盖

- 统一入口：模块使用 `npm run verify:module -- <module-id>`，阶段使用 `npm run verify:phase -- <phase-id>`，P00–P08 全量使用 `npm run verify:all`；任一前置缺失、命令失败或超时必须返回非零且输出脱敏 `run_id`/`trace_id` 报告。
- 单元：领域规则、权限、评分、利润、错误映射、状态机、去重。
- 契约：OpenAPI、SSE 事件、Provider 输入输出、前后端 DTO。
- 集成：MySQL 迁移、组织隔离、Redis 队列、租约、Outbox、通知、导出、Webhook、Token。
- Provider 回放：每个内置来源覆盖成功、空结果、字段缺失、超时、限流、登录失效、验证码、解析变化。
- E2E：普通成员、选品经理、组织管理员、平台运营管理员、安全管理员；桌面、390px、键盘、无障碍。
- 安全：越权、跨组织、SQL 注入、XSS、CSRF、SSRF、文件上传、Token 重放、密钥泄露扫描。
- 性能：大列表、并发任务、SSE 连接、导出、慢 SQL、缓存命中、故障降级。

#### M07-01 全链路测试矩阵实现基线

P07 发布门禁首先由 `verification/release-matrix.json` 冻结 P00–P06 的角色范围、来源采集、任务队列、数据质量、桌面/390px、性能与安全失败关闭场景；`scripts/verify-release-matrix.mjs` 只允许执行清单内固定的 Node、真实 MySQL 5.7/Redis 链路和 Playwright 分组，失败返回非零及 `run_id`/`trace_id`。该矩阵不新增生产数据库表、API、页面、权限或常驻服务，只能在本地、CI 或宝塔受限发布任务中运行。

本地浏览器门禁测量代表性页面 LCP、CLS 和交互响应代理，不能替代真实用户 INP、生产核心 API P95、队列等待或三分钟真实来源旅程；这些生产/预发布签发项仍分别由 M07-05 和 M07-06 完成。矩阵复用 `VERIFY_COMMAND_TIMEOUT_MS` 与 `VERIFY_REPORT_DIR`，完整发布任务可将前者临时调至 900000 毫秒，不新增环境变量。

M07-01 最新同提交模块自动验收 `6eaae7d4-46e0-4798-b6c4-4b515fa90a45` 通过：构建、289 个 Node 测试、MySQL 5.7/Redis 真实链路、216 个桌面/390px 浏览器用例、2 项性能预算探针和文档门均重新执行成功。该结果只证明全链路回归矩阵本身完成，不代表 P08 多节点或 10,000 用户能力完成。

M07-02 安全门禁由 `verification/security-gate.json` 冻结依赖漏洞、版本库秘密、浏览器危险 DOM 与敏感存储、新窗口 opener、SQL 插值、CSRF、Webhook SSRF、上传入口、越权、日志脱敏和宝塔边缘响应头规则；`scripts/verify-security-gate.mjs` 对扫描异常和任一发现失败闭合，并输出脱敏 `run_id`/`trace_id` 报告。它不新增生产表、API、页面、权限或常驻服务；MySQL 5.7 权限和安全运营链路使用既有真实验收重跑。HSTS 只有在生产 TLS 全链路确认后才允许配置，当前不得虚假声明。

M07-02 最新同提交模块自动验收 `489e59a2-ee7e-426e-9321-7b22181f0c1b` 通过：全仓构建、策略单测、0 高危/严重生产依赖漏洞、静态安全门、MySQL 5.7 RBAC 隔离与脱敏安全运营真实链路、文档门均重新执行成功。该结果不代表 P08 容量或高可用能力完成。

M07-03 部署合同以 `infra/baota/service-manifest.json` schema v2 锁定惠州 `192.168.1.220`、`midouai.mozhiz.cn`、十个宝塔对象（含 M07-05 同机候选 API 与发布任务）、环境分组、日志秘密排除和 S0 容量边界。`scripts/verify-baota-deployment.mjs --preflight` 只验证发布包；`--production` 必须同时看到 manifest healthy 签发与忽略目录中的结构化生产证据，覆盖面板对象、当前 Git commit 的同一发布身份、live/ready/version、Worker/Crawler 心跳、MySQL 5.7/utf8mb4、本机 Redis 和日志。生产对象全部由宝塔创建和管理；M07-04 只验证同机逻辑恢复，M07-05 增加同机候选 API 与渐进发布，但仍只声明 S0 单机容量且没有备用服务器。

M07-05 发布合同以 `infra/baota/release-rollout-manifest.json` 锁定 4101 稳定 API、4103 同机候选 API、宝塔手工发布任务和 Nginx 5% → 25% → 100% 分流。生产每阶段至少观察 30 分钟，并以 1 秒采样提高低流量 S0 的候选 P95 样本分辨率；采样频率不得用于缩短观察、改变比例或放宽阈值。生产探针固定把 TCP 连接指向 `127.0.0.1` 的本机宝塔 Nginx，同时完整保留正式域名的 TLS/SNI/Host 校验，避免服务器访问自身公网 IP 的公网回环波动污染应用灰度结论；不得关闭证书校验或绕过 Nginx。候选读写 P95、5xx、MySQL 异步延迟和最小样本全部来自运行证据；写样本使用宝塔受限 HMAC 签名、唯一 sample/nonce、单次 InnoDB 提交并保留代理实际 request_id/trace_id 的 M07-05 专用探针。签名 canonical 只覆盖 timestamp、nonce、release_id、sample_id，不能绑定会被宝塔 Nginx 覆盖的追踪头。Nginx 499 且没有 upstream_status 的到达上游前传输中断只允许用同一 sample_id 重试一次并单独留证；不得重试候选拒绝，重试仍未送达也必须失败关闭。候选已到达上游的请求必须返回 202，且候选 build 的持久化增量必须与候选已到达上游的 Nginx 写样本完全一致。不能用多次业务提交或幂等回放替代。缺样本、探针拒绝、传输重试耗尽、持久化数量不一致或超过阈值必须自动把流量退回 4101 并追加停止/回滚审计。宝塔模块验收的 Playwright API/Web 使用可配置的隔离临时端口，不能占用或复用 4101/4103 生产槽，命令结束即关闭；隔离服务启动等待固定为 300 秒，以覆盖 Debian 单机真实构建耗时，超时继续失败关闭且不改变生产门禁。`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 可显式选择主机既有 Chromium 的绝对路径，空值保持本地默认浏览器。Linux 视觉门还必须通过自动主机预检确认 Chromium 可执行和中文字体存在，禁止接受方框字快照；惠州 Debian 11 主机经明确授权由宝塔有限任务安装 Debian 官方 `fonts-noto-cjk` 固定版本并保留 0600 安装前证据，回滚也只能由宝塔任务删除包并刷新字体缓存。候选项目不是备用服务器，也不提供主机故障保护、多节点或 10,000 用户能力。

M07-05 宝塔发布任务必须仅手工触发，不得配置每日或其他自动调度。执行器在迁移、门禁写入和 Nginx 改动前取得固定 MySQL 会话级命名锁并持有整轮；第二实例不能立即取得锁时以 `release_rollout_lock_busy` 失败关闭。`0027a_release_rollout_attempts_m07_05` 将 stage/build 唯一键改为普通索引，使每次执行保存独立 release ID，失败门禁与审计不得因同构建重跑而删除或覆盖。

M07-05 的 MySQL 异步延迟只测量宝塔 Node Worker 实际可领取的显式队列到期工作与过期租约；没有当前消费者的领域审计/后续投递 Outbox 必须保留事实，但不冒充可执行队列。队列表由发布 manifest、`scripts/release-rollout-async-lag.mjs` 和自动测试共同锁定；队列 `DATETIME(3)` 与 Worker 统一使用 MySQL 会话 `NOW(3)` 判断到期，避免非 UTC MySQL 系统时区与 `UTC_TIMESTAMP(3)` 混用导致固定时差假积压。禁止动态扫描任意 `status + available_at` 表、删除审计记录或放宽 60 秒停止阈值。

M07-03 最新同提交模块自动验收 `eae6ebd9-8fb2-4124-8345-98dccacb6450` 通过：全仓构建、MySQL 5.7/Redis/API 真实探针、Python 心跳、桌面/390px 生产状态视觉、文档门和同 commit 生产证据均成功。该结果只证明 S0 宝塔部署完成，不代表 P08 容量完成。

M07-04 使用 `backup_recovery_runs` 与 `backup_recovery_assets` 记录惠州当前主机、同机独立加密恢复目录、AES-256-GCM 资产、实际 RPO/RTO 和逻辑隔离演练核验。`/api/v1/platform/operations/backup-recovery` 仅向 `platform:operate` 返回脱敏事实；备份和恢复只由宝塔计划任务执行。业务元数据连接固定使用 `product_scout@127.0.0.1`，管理员备份步骤只通过 `BACKUP_MYSQL_SOCKET` 使用已有 `root@localhost` 受限凭据，不新增 TCP root 账号。状态严格失败关闭：缺恢复副本完整性证据或缺 90 天内隔离恢复时为 `blocked/stale`，不得写成 `verified`。生产验收要求本机逻辑损坏场景下 MySQL RPO 不超过 15 分钟、RTO 不超过 4 小时，并核验业务数据、审计链、证据哈希和权限边界；该验收明确不保护整机、磁盘或机房故障，也不构成异地灾备能力。

M07-04 最新同提交模块自动验收 `46a76ff6-6059-41e4-bfec-c5693209b604` 通过：宝塔任务完成全量库、binlog、证据、导出与非秘密配置加密备份，恢复副本完整性、175 张表、审计链、证据哈希和权限边界均通过。该结果只证明当前惠州单机的逻辑恢复能力，不保护整机、磁盘或机房故障，也不代表 P08 多节点或 10,000 用户能力完成。

M07-05 已由 schema v5 同提交模块自动验收 `0784e022-93e4-421d-9524-ef818ecfcda1` 通过：宝塔同机候选构建 `162cb10664e6029284cf36594fba0d21a2e41f21` 的发布 `ef868169-253b-41ec-97a2-d3a8a822ed9c` 完成 5%/25%/100% 三阶段各 1,800 秒生产观察，样本分别为 211/883/3,578，错误率均为 0，读 P95 为 2/2/2 ms，写 P95 为 5/5/4 ms，异步延迟均为 0，候选写探针持久化分别为 105/446/1,771 且与候选写样本一致，到达上游前中断和投递失败均为 0；宝塔任务仅手工触发，第二实例被 MySQL 会话命名锁以 `release_rollout_lock_busy` 阻断且历史尝试保留。Linux Chromium、中文字体、桌面/390px E2E、MySQL 5.7 真实探针、文档门和生产同 commit 身份共 11/11 命令全部通过。证据 SHA-256 为 `7e3acbf0619f0370e025303ef0792b2697b6829d1d79d3eeb85e66fc4da88398`。该结果只证明惠州当前单机的应用发布与同机回滚能力，不是备用服务器、主机故障保护、多节点或 10,000 用户能力。

此前同机发布复验发现共享 MySQL 在其他数据库全表扫描期间，稳定与候选槽的单行写探针 P95 同步超过 600 ms，自动停止与回滚按合同生效。惠州 16 GiB 单机因此由宝塔有限任务固定 `innodb_buffer_pool_size=4096M`、`innodb_buffer_pool_instances=4`、`innodb_io_capacity=1000`、`innodb_io_capacity_max=4000`、`innodb_flush_neighbors=0`、`innodb_flush_method=O_DIRECT`，保留 0600 回滚快照并通过两 API 槽、Worker、Crawler 健康门；`flush_log=2/sync_binlog=1` 持久性合同和 5/25/100、1,800 秒、600 ms 门槛均未放宽。上述 schema v5 完整生产灰度已在该资源配置下重新签发。

M07-06 通过 `/opportunities/start` 和 `/api/v1/selection-journeys` 把普通成员的真实输入、采集任务、首个原始证据或 `succeeded_empty`/明确受阻终态、人工决策与证据查看串成一条可计时旅程。服务器从已登录会话解析组织和工作区并选择已启用 `google_news_search`，成员只需 `task:create`、`opportunity:read` 和 `opportunity:decide`，不得获得或使用 `provider:configure`、`collection:replay` 或平台权限。原始证据继续按组织、工作区、Provider 和来源键去重，但每次任务必须通过 `collection_task_evidence_links` 保存范围化关联；重复输入复用不可变证据时也必须先校验任务、子查询和租户范围并写关联审计，不能因命中旧证据而让新旅程停在 accepted。若同 GUID 的 Google RSS 仅改变未消费 XML 包装且规范 URL、Parser、Adapter、Schema 与规范载荷完全一致，复用旧不可变证据并在 `evidence.linked` 记录 `content_changed` 及新旧内容哈希；规范事实任一变化仍以去重冲突失败关闭，禁止覆盖。`SELECTION_ACCEPTANCE_DEADLINE_MS` 固定为 `180000`，启动检查拒绝放宽；创建、15 秒可见和 180 秒终态均由惠州单机宝塔有限任务的真实生产证据签发。构建 `162cb10664e6029284cf36594fba0d21a2e41f21` 的最新真实旅程以 4,081 ms 进入 `result_ready` 终态，普通 member 已记录 `observe` 决策并查看原始证据；模块自动验收 `78001216-8e65-44fb-81cf-9570f9f9534b` 的 11/11 命令通过，证据 SHA-256 为 `bff46ad304128bf14240517c538a3091aeff5d67ecc49c0518c6e9c4a63643c5`。演示数据、平台管理员代操作、手填组织 ID 或直接写库都不能计入验收；该结果不能代替 P08 容量验收。

M07-06 可复用上述 ScoutOps 项目专用 HTTP CONNECT 代理访问固定 Google News 来源，但代理配置不属于成员输入，普通成员验收账号也不得获得或读取代理凭证。生产签发仍以同一惠州单机、同一构建、固定 10 秒来源健康门和 180 秒旅程门为准；代理仅改变允许的出站传输路径，不改变来源、数据合同、权限或阈值。

P07 已在最终实现提交 `a4c2695d3a0071201ad066b22caca5631271eac1` 上完成 M07-01 至 M07-06 依赖顺序模块验收、`npm run verify:phase -- P07`、文档、计划、安全、宝塔、恢复、灰度和真实旅程收尾门；run_id/trace_id 为 `7b806598-f47a-4448-b09e-4e70fecc6113`。阶段报告和收尾报告 SHA-256 分别为 `b53ad84fb7a84a90aa477753d9588da153a17d700dc97883fa0a766400ce1786` 与 `bfbd6debf9bd0b6734533e8afe7b24062ad0918d36ca4b65b4f90b819f122a7b`。包含本状态记录的后续提交仍必须生成匹配 Git HEAD 的生产证据并重跑当前模块门；此处不声明备用服务器、主机故障保护、多节点或 10,000 用户能力。

M08-01 已按“长期仅一台服务器、不进行负载均衡”的最新生产决策完成 S0 单机运行基线：API 使用稳定节点/主机身份写入心跳，脱敏 `/api/v1/health/nodes` 对缺失、停止、过期和身份不匹配失败关闭；受 `platform:operate` 保护的运行视图同步写审计；桌面/390px 控制台明确展示单机、无负载均衡、无备用服务器、无多节点声明和容量未验证。`0030_load_balancing_m08_01.up.sql` 已在 MySQL 5.7.44 执行，其历史文件名和校验和不得重写；`load_balancer_observations` 只作为停用兼容表保留，运行代码不再读取。提交 `b55f7f814d7153e6a4a7958eb41a9bf6ff1e60e8` 已完成 5%/25%/100% 各 1,800 秒观察，晋级后宝塔 Nginx 只保留本机 4101 单上游、4103 候选停止；schema v1 生产证据 SHA-256 为 `0c7cd53311f9c778407e699747bc8d9b9d27b1fad18635fee1c05ff54a74e13c`，模块验收 run_id/trace_id 为 `fa76e44f-53d7-49da-8884-bac921aad580`。该门只证明当前单机运行基线，不形成多节点、高可用或 10,000 用户能力声明。

M08-02 已将同一台服务器上的宝塔 Redis 固定为 S0 单实例韧性边界：仅监听本机并保持 protected-mode，启用 AOF everysec 且保留 RDB save 规则，设置 `maxmemory 512mb`、`maxmemory-policy noeviction` 与 `maxclients 512`。平台运维 API 和桌面/390px 页面只返回脱敏的持久化、内存、连接、拒绝/淘汰与恢复结论，要求 `platform:operate` 并同步写入 MySQL 5.7 审计。提交 `cb81e04381c8424057c481853bceac749592cc6c` 已完成宝塔配置备份、受控重启、PING、随机范围读写清理、API/Worker/Crawler 恢复及 5%/25%/100% 各 1,800 秒观察；晋级后只保留 4101 单 API，4103 停止，schema v1 生产证据 SHA-256 为 `7baf6a349f410431c7c655cf8e5fdda8eda7a5b335e62ee1ecef052dcb56482a`。上述上限是资源保护配置，不是容量承诺；不启用负载均衡、Sentinel、Redis Cluster、副本或备用服务器。

M08-03 将同一台惠州服务器上的宝塔 MySQL 5.7 固定为 S0 单主韧性边界：`product_scout` 仍是唯一业务事实库，核验可写单主、ROW binlog、`innodb_flush_log_at_trx_commit=2`、`sync_binlog=1`、I/O/连接/慢查询/数据盘水位，以及 M07-04 同机独立加密副本和隔离恢复记录。平台运维 API 和桌面/390px 页面要求 `platform:operate`，观测、查看记录和审计在同一事务写入，并且不返回连接、账号、路径、binlog 文件或 SQL。历史 `deployment_release_write_probes` 的约 19.2 万宽随机索引行继续只读保留，`0032a_compact_release_write_probe_m08_03` 以自增 BIGINT 主键及 BINARY sample/build/nonce 键承接新样本；签名、202、单语句提交和固定门槛均未改变。提交 `93abf7e56209b7e87bbcbb0d98a8e7ebd506669c` 的发布 `c9a74285-07ef-40fa-bd1d-8de76022dbab` 已完成 5%/25%/100% 各 1,800 秒生产观察，样本为 147/822/3,343，错误率和异步滞后均为 0，读 P95 为 2/2/2 ms，写 P95 为 562/152/416 ms；紧凑持久写样本为 79/392/1,668。经预检的组提交参数 `binlog_group_commit_sync_delay=5000`、`binlog_group_commit_sync_no_delay_count=10` 已由宝塔持久化并重启验证，`sync_binlog` 保持 1。晋级后 Nginx 只保留 4101，4103 停止；schema v1 生产证据 SHA-256 为 `1dec9d197e67b97055f06fbe949ba2d51a343e718e5e38523760658856e23df7`，模块 run_id/trace_id 为 `e10ac4cc-c9b2-4ed8-aa80-c201d59911a5`。该结论不建设读副本、负载均衡或备用服务器，也不宣称容量、多节点或 10,000 用户能力。

M08-04 已把证据与导出固定在惠州当前单机的两个宝塔受控目录：组织/工作区范围路径、原子写入、导出 SHA-256、活动索引有界抽样、容量水位、M07-04 evidence/export 同机加密副本和隔离恢复事实均进入失败关闭门禁。`/api/v1/platform/operations/files` 与桌面/390px 运维页要求 `platform:operate`，观测、查看和审计在同一事务写入，且不返回路径、文件名、哈希、组织/工作区标识或凭证。构建 `a8024c1589b99b27a02e8eb58a561c3f0263add6` 已完成 5%/25%/100% 的 1,800/1,800/1,801 秒观察并晋级为单一 4101；20/20 个活动文件样本校验通过，同机加密副本和隔离恢复有效。生产证据 SHA-256 为 `80a2927dfae3ca9dd2a95d6850d527dac682b6058c2cdd5fd4c3ce6c49447365`，模块 run_id/trace_id 为 `db0d5d96-d5c7-43e9-8190-a7cff7775129`。该结果不建设共享存储、负载均衡或备用服务器，也不宣称容量、多节点或 10,000 用户能力。

M08-05 的实现合同固定为惠州单机一个宝塔 Node Worker、一个宝塔 Python Crawler、每来源有效并发 1 和每浏览器档案独占 1。M03-05 任务领取与全局 Worker/来源槽位在同一 MySQL 5.7 事务中完成，心跳和所有终态同步释放；M03-04 浏览器档案租约再叠加一个全局 Crawler 槽位，二者必须同时成功。Worker 在领取前检查归一化负载、可用内存和证据盘可用空间，触线时保持任务排队；Redis 仍只做组织/工作区范围的队列协调。`/api/v1/platform/operations/crawler-scheduler` 及桌面/390px 页面只向 `platform:operate` 返回脱敏聚合事实，过期回收同源、幂等并审计。修复提交 `efdb35081bdc5002eea1729e0af4583be3ae7523` 已使用独立发布重新完成 5/25/100 各 1,800 秒灰度、单一 4101 晋级、schema v1 同提交生产证据和 `npm run verify:module -- M08-05`；run_id/trace_id 为 `a6e9e5d7-dffd-4732-8706-29cd9cdc6ecb`。该验收只证明当前惠州单机调度合同，不建设或声明负载均衡、备用服务器、多节点、容量或 10,000 用户能力。

### 13.2 数据质量量化门槛

每个来源上线前使用冻结的标注回放集验收：有 100 条及以上有效样本时随机抽取至少 100 条；不足 100 条时全量抽检。字段正确以标注真值、原始页面/响应和规范化记录三者一致为准；缺失值不能被当作正确值。以下为首期默认门槛，来源特有阈值只能通过版本化规则提高或降低，并记录理由、样本量、计算日期和审批人。

| 指标 | 计算方式 | 首期门槛 | 未达到时的处理 |
|---|---|---:|---|
| 标题提取准确率 | 标题与标注真值一致的记录 ÷ 有标题标注记录 | ≥ 98% | 来源降为 `degraded`，不自动作为机会主证据 |
| 价格字段准确率 | 金额、价格类型和单位均正确的记录 ÷ 有价格标注记录 | ≥ 99% | 不进入利润计算 |
| 币种识别准确率 | 币种代码正确的记录 ÷ 有价格标注记录 | ≥ 99% | 不进入利润计算 |
| ASIN/商品 ID 匹配准确率 | 外部 ID 与标注商品一致的记录 ÷ 有 ID 标注记录 | ≥ 99.5% | 不更新既有竞品或机会 |
| URL 规范化正确率 | `canonical_url` 指向同一资源且去除可识别跟踪参数的记录 ÷ 抽检记录 | ≥ 99% | 不参与跨来源去重 |
| 重复数据比例 | 同一来源、同一规范 URL/外部 ID 在同一时间桶内的重复记录 ÷ 总记录 | ≤ 2% | 阻断批量写入并修复去重规则 |
| 供应商报价误匹配率 | 报价关联到错误供应商/规格的记录 ÷ 已人工核验报价 | ≤ 1% | 不进入成本确认与利润计算 |
| AI 分类人工抽检通过率 | 每周随机抽检至少 30 条，人工认可分类 ÷ 抽检条数 | ≥ 90% | 仅显示为 AI 草稿，暂停自动标签/路由 |
| 来源新鲜度达标率 | 在计划频率两倍内完成或受控受阻的计划任务 ÷ 应执行任务 | ≥ 95%（近 7 天且至少 20 次） | 标记来源过期，提示受影响业务对象 |
| 来源最低成功率 | `succeeded` 或 `completed_with_warnings` 且至少有一条可用证据的任务 ÷ 已完成任务 | ≥ 95%（近 7 天且至少 20 次） | 从默认调度降级，保留手工和回放入口 |
| 机会最低证据覆盖率 | 有效必需证据输入数 ÷ 适用必需证据输入数 | 自动“推荐”≥ 80%，且市场、竞争、成本三类各至少 1 条；“观察”≥ 50%；低于 50% 为 `insufficient` | 评分降低置信度；`insufficient` 不得自动推荐或生成可靠 ROI |

质量计算必须按来源、Parser 版本、目标市场和时间窗保存到 `reconciliation_runs` 与 `data_quality_issues`；页面显示来源质量状态、样本量、最近计算时间和受影响字段。任务“成功”只表示流程完成，不能绕过本表的字段与证据质量门槛。

### 13.3 不可跳过的验收场景

1. 新成员不接触 Provider 配置，在三分钟内完成一次真实选品任务和一次决策。
2. 平台超级管理员创建组织与组织管理员；组织管理员创建成员；成员只看授权工作区数据。
3. 项目所有者启用已完成目标地址、字段、频率、并发与保存规则配置的 Google News RSS 或其他来源，健康检查通过后自动产生任务、证据和趋势信号。
4. 管理员配置 1688 登录档案后，普通用户可发起找货任务；登录过期时只创建管理员待办，不向普通用户重复索权。
5. 新热点、竞品变动和任务状态在已打开的页面上自动更新；断网恢复后没有漏事件和重复通知。
6. 管理员可查看所有来源、采集状态、任务、死信、全部数据、全部机会、全部竞品、Token、日志和监控。
7. 普通用户无法访问平台 API、后台页面、其他组织数据、凭证、全局日志和死信重放接口。
8. Token 明文只显示一次；撤销后立即失效；所有创建/使用/撤销有审计。
9. 从加密备份恢复到隔离环境后，业务数据、审计链、对象证据、权限边界校验一致。
10. 发布后健康检查、来源健康、队列等待、错误率、性能指标、13.2 数据质量门槛和告警均达到发布门槛。

---

## 14. 最终执行纪律

1. 没有明确目标 URL、字段、采集规则、保存去重、健康检查、真实任务和证据，不开放该来源的普通用户入口；不得以授权书、合同、法务审核或 robots 检查缺失阻塞代码开发与本地测试。
2. 没有权限矩阵、API 守卫和跨组织测试，不开放任何新管理页面。
3. 没有加载、空、错误、无权限、过期和恢复状态，不视为页面完成。
4. 没有事件、幂等、重试、死信和审计，不视为“实时采集”完成。
5. 没有测试、监控、备份和回滚说明，不允许进入发布流程。
6. 所有新增字段、路由、事件、配置、来源和权限都必须同步更新 OpenAPI、数据字典、Feature Map、测试和运维手册。
