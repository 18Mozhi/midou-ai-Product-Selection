# P39 组织与账号概览 · ACCOUNT-OVERVIEW-C-r1

具体提案待用户审核。起点main/da750f6，2026-09-09；C方向已选择，但本稿不是获批Vue实现、生产或全站完成。共40场景×双端=80主图，加创建加入组织/失败/超级管理员的6局部图，合计86PNG（含2张非业务控件板）。

[打开可交互审核稿](index.html)。file://独立运行，右上场景选择器属于审核工具。管理链接只记跳转意图，创建用户只记录内存method/path/body，不调用真实API、不提供伪鉴权/Origin/Idempotency-Key。P41组织创建及P42资料/三原因窗口属于后续独立路由稿，本包验证P39调用路径，不冒充已交它们全部图。

## 1. 设计方案与取舍

用frontend-design把全局规模放入蓝色管理目录，把当前组织结果放入白色单一阅读面，创建入口与列表查询不抢同一层级。不是旧巨幅标题加三张指标卡。色板：目录#254a9c、深蓝#193b80、文字#202c3d、辅助#58677b、线#dbe1e9、背景#edf1f6；白色结果面、中文微软雅黑无衬线，正文16px/辅助至少13px/非复选操作44px。

桌面构图是“左侧全局规模与组织/用户/管理员分流 | 右侧组织记录与查询”。移动先标题与新建入口，再紧凑全局汇总，随后组织记录；第一条组织名称在390×844首屏内。首次目检发现蓝色汇总抢在标题前且过高，已重排并压缩，不把所有内容缩成桌面比例。错误就近表达事实归属，开关状态有文字；动效仅服务按压/展开，reduced-motion下保持静态。

组织表保留5列、隐藏列至少留1列、首个可见列冻结及两种局部密度。移动保留筛选抽屉和组织只读预览；创建用户用分组字段窗，授权选择与身份字段分开。弹窗不增加人工原因，后台角色规则未变。此处不是新全局主题/密度实现。

## 2. 真实数据边界

原overview通过现有m06-01-platform-accounts.spec.ts AST抽取：组织正常2/全部3、用户可登录16/全部18、平台管理员2，而三个数组各只有1条；不把原fixture改成“行数=总量”。12组织/长内容/零计数/状态筛选为明确合成变体，该变体组织汇总12/9；本地匹配只做演示，不冒充MySQL排序或字符集匹配。基准记录created/updated在2026-08，审核时间固定2026-09-09，不是线上观测。

| 面 | 真实读取/范围 |
| --- | --- |
| 页面及API | /platform-admin/accounts，platform:superadmin。不是运营权限或组织管理员权限 |
| 概览GET | /api/v1/platform/accounts?query&status；每个数组最多200，summary全局不受筛选影响 |
| 组织结果 | 后端组织name/slug匹配与组织status；概览正文只显示organizations，不混入邮箱命中的users |
| 计数 | member_count=COUNT DISTINCT memberships.id，未限关系状态；workspace_count也未限活动状态 |
| 原组织筛选 | 全部、active、disabled、archived；后两者不合并值，disabled可导致组织零命中 |
| 新建用户组织选项 | 当前筛选后的organizations数组，最多200；非active选项禁用，不额外读取全库组织 |
| 角色目录 | 普通概览load不读/platform/roles；不能因角色目录失败将概览标失败 |
| 概览列表 | 没有服务端分页/游标/导出，不新增“下一页”或假总量 |

后端overview服务trim+截断query120/status30、固定limit200；惰性SQL构造核对LIKE转义、name/slug、四路独立查询及summary无筛选参数，没有执行SQL。没有因样式修改API/数据库/权限。

## 3. 全部本页动作与跨页衔接

| 动作族 | 本稿表现与真实合同 |
| --- | --- |
| PA-REFRESH | 列表刷新、首次错误重新加载、失败旧事实重新读取；pending禁止重复。12秒abort由源函数手动回调验证，原型timeout是合成场景 |
| PA-FILTER / RESET | 显式label；query/status写URL并保留其他键。提交移动先关闭筛选，重置是button不自动关闭，取消保留输入 |
| PA-NAV | 组织管理/用户管理/管理员管理分别到/platform-admin/organizations、/users、/admins，绝对路径不带旧query |
| PA-ORG-CREATE | P39页头→/platform-admin/organizations/new即P41；没有新增本概览空态第二个新建按钮。源取消回/platform-admin/organizations，不保证回本概览 |
| PA-ORG-DETAIL | 桌面查看详情或移动预览内打开→/platform-admin/organizations/{id}即P42；源关闭回组织列表，不虚构保留原筛选返回 |
| PA-T | 5列设置/至少留一列/冻结首可见列/standard与compact，只在当前实例，不写API/存储 |
| PA-S-PREVIEW | 移动组织名、标识、成员、工作区、状态和UUID details；打开P42与关闭预览顺序保留 |
| PA-Q-FILTER | 移动筛选窗，关闭/遮罩/Escape/焦点；桌面内联。不将原生select当业务弹窗 |
| PA-USER-CREATE | 本页标题“新建用户或平台管理员”，默认普通用户；见下节，无P39用户列表/用户详情/改密/角色撤回操作 |

P41两步三字段、P42三字段与保存/停用/恢复原因仍需各自全量设计、跨页渲染、Vue和API验证。这里没有用一行成功提示伪造它们已完成。

## 4. 创建用户五字段与反馈

邮箱type=email/required/max254；临时密码type=password/required/min12/max128/autocomplete=new-password；平台角色为空、运营、安全、超级四值；组织可空、非active禁选；选组织后显示member/organization_admin。POST /platform/accounts/users五字段，空platform_role_code与organization_id转null，organization_role_code仍存在；不添加reason、expected_version或邀请参数。

源openCreateUser清空表单，closeCreateUser只关窗并清错误，密码仍在组件内存直到再打开；本稿保留并验证，不宣称取消已擦除密码。所有合成值不会进入存储、日志或真实系统，不曾创建真实账号。初登改密/MFA文本来源于源码，不是本轮真实登录/MFA验收。

创建忙碌时防重，仍允许取消；关闭不表示撤销已发送写入。本稿将“创建成功”与“回读失败”分别提示；仅内存模拟事务成功，回读继续使用固定样本，不凭图中提示声称数据库已新增记录。旧写返回不能关闭/报错到新窗，结束后新窗确认按钮恢复可用；后台读取回来保留已打开表单的输入及焦点。这些是提案保护，源业务未修。

创建窗点背景不关闭；关闭按钮/取消/Escape与返焦均验。移动预览/筛选可背景关闭；本稿native模态加显式Tab/Shift+Tab循环是提案，不表示源ResponsiveDataView的inert/focus缺口已修。表单空/短密码拒绝没有写意图；三平台角色及加入组织的完整body、错误保留、成功与回读失败都有对应场景/测试。

## 5. 源函数证据与差异

永久辅助器执行实际PlatformAccountCenter script的函数/computed和显式watch回调，ref/router/request为惰性替身；不是Vue挂载。已验证：

- query/status初始截断、trim/replace、保留其他URL键；同条件读取与changed query的watch路径。
- 原概览组织列表/全局summary分离、P41打开/取消和P42打开/关闭四路径。
- 读取单飞与12000ms abort回调；已有数据时所有错误保留ready。
- 新建用户五字段及null、取消留密码、重新打开清空。
- 读取在途时改变query，watch调用被single-flight跳过，旧数据到达而新query仍在，未自动补读。
- 原创建成功后load失败被吞，后续“账号已创建”覆盖读取失败提示。
- 原旧创建成功晚到会关闭新创建窗，且新邮箱仍在form里；真实源只复现旧成功，本稿另验旧成功/失败均不污染新窗。

原型明确“当前输入/已读取条件”，避免旧事实假冒新查询结果；保留权限错误旧快照是源风险展示，没有擅自改变安全行为。完整请求调度/历史/KeepAlive与401/403处置仍待具体实现与审核。

## 6. 验证与未覆盖

命令：node scripts/verify-ui-phase2-account-overview-c.mjs --capture生成永久图/evidence；无参数先核对源/静态数据/PNG的SHA256，再跑离线浏览器交互。没有安装依赖、启动Vite/API或创建新生产服务。双端40场景、列设置/密度/冻结、组织预览/筛选/创建模态、三状态/邮箱结果、精确跳转与POST、必填/短密码、单飞/错误恢复、旧创建结果归属、后台读回不关闭新表单均验证；759/760/768/1024覆盖长字段/创建等局部断点。移动普通页第一条组织名首屏可见，弹窗整窗/局部图分别记载。

浏览器HTTP/console/pageerror/存储/cookies为0，所有contexts在finally关闭。仅测试内存请求，没有真实授权、MySQL事务、密码哈希、登录、MFA、邮件/通知或宝塔验证。原生200%缩放、真实软键盘/屏幕阅读器、完整六角色三主题/全局密度、刷新时组织选项消失、preview记录消失/复现、跨宽度已开抽屉、真正URL前进后退/KeepAlive和剩余写并发仍待验。本地创建保护不能当全平台PA-D01/02已关闭。

## 7. 双端场景图

| 场景 | 桌面1440 | 移动390 |
| --- | --- | --- |
| 默认 · 原单条夹具 | [1440](1440-normal.png) | [390](390-normal.png) |
| 12组织 · 合成 | [1440](1440-many.png) | [390](390-many.png) |
| 长名称与编号 | [1440](1440-long.png) | [390](390-long.png) |
| 零成员零工作区 | [1440](1440-zero_counts.png) | [390](390-zero_counts.png) |
| 平台无组织 | [1440](1440-empty.png) | [390](390-empty.png) |
| 筛选无组织 | [1440](1440-filtered_empty.png) | [390](390-filtered_empty.png) |
| 邮箱查询 · 本页仅组织 | [1440](1440-email_query.png) | [390](390-email_query.png) |
| 正常组织筛选 | [1440](1440-active.png) | [390](390-active.png) |
| 已停用组织筛选 | [1440](1440-archived.png) | [390](390-archived.png) |
| 已停用账号状态 · 无组织 | [1440](1440-disabled.png) | [390](390-disabled.png) |
| 首次读取中 | [1440](1440-loading.png) | [390](390-loading.png) |
| 首次读取失败 | [1440](1440-error.png) | [390](390-error.png) |
| 首次读取超时 | [1440](1440-timeout.png) | [390](390-timeout.png) |
| 后台读取中 | [1440](1440-refreshing.png) | [390](390-refreshing.png) |
| 新条件失败 · 旧事实 | [1440](1440-refresh_failed.png) | [390](390-refresh_failed.png) |
| 权限错误 · 保留旧快照 | [1440](1440-refresh_forbidden.png) | [390](390-refresh_forbidden.png) |
| 登录过期 · 保留旧快照 | [1440](1440-refresh_expired.png) | [390](390-refresh_expired.png) |
| 条件已改但未查询 | [1440](1440-draft_changed.png) | [390](390-draft_changed.png) |
| 桌面列设置 | [1440](1440-columns.png) | [390](390-columns.png) |
| 桌面仅剩一列 | [1440](1440-one_column.png) | [390](390-one_column.png) |
| 桌面紧凑密度 | [1440](1440-compact.png) | [390](390-compact.png) |
| 取消冻结 | [1440](1440-unfrozen.png) | [390](390-unfrozen.png) |
| 移动筛选抽屉 | [1440](1440-filter_open.png) | [390](390-filter_open.png) |
| 移动组织预览 | [1440](1440-preview.png) | [390](390-preview.png) |
| 移动预览技术详情 | [1440](1440-preview_technical.png) | [390](390-preview_technical.png) |
| 新建普通用户 | [1440](1440-create_user.png) | [390](390-create_user.png) |
| 创建并加入组织 | [1440](1440-create_member.png) | [390](390-create_member.png) |
| 新建运营管理员 | [1440](1440-create_operations.png) | [390](390-create_operations.png) |
| 新建安全管理员 | [1440](1440-create_security.png) | [390](390-create_security.png) |
| 新建超级管理员 | [1440](1440-create_super.png) | [390](390-create_super.png) |
| 创建失败保留输入 | [1440](1440-create_error.png) | [390](390-create_error.png) |
| 创建处理中 | [1440](1440-create_busy.png) | [390](390-create_busy.png) |
| 创建成功反馈 | [1440](1440-create_success.png) | [390](390-create_success.png) |
| 创建成功但重读失败 | [1440](1440-create_refresh_error.png) | [390](390-create_refresh_error.png) |
| 表单校验失败 | [1440](1440-create_invalid.png) | [390](390-create_invalid.png) |
| 重新打开空表单 | [1440](1440-create_reopened.png) | [390](390-create_reopened.png) |
| 刷新悬停 | [1440](1440-hover.png) | [390](390-hover.png) |
| 刷新聚焦 | [1440](1440-focus.png) | [390](390-focus.png) |
| 刷新按下 | [1440](1440-pressed.png) | [390](390-pressed.png) |
| 按钮六态 · 审核工具 | [1440](1440-controls.png) | [390](390-controls.png) |

创建局部：[加入组织桌面](1440-create_member-detail.png)、[移动](390-create_member-detail.png)、[失败桌面](1440-create_error-detail.png)、[移动](390-create_error-detail.png)、[超级管理员桌面](1440-create_super-detail.png)、[移动](390-create_super-detail.png)。主图遇模态使用视口截取，防止整页拼接固定弹窗；details局部图不是额外业务窗口。桌面filter_open/preview场景依真实断点不打开移动窗，不冒充该端已有移动交互。

## 8. 交付与审核

本批新增四原型文件、86永久PNG、README/evidence、两永久脚本，直接同步P39规格、W05合同、计划与Feature Map提案说明；无生产apps、API/OpenAPI、后端/Python、schema/迁移、权限、.env、依赖或部署器改变，无新参数、消费者契约或重启需求。这些运行面与当前离线交付无关，未改它们。

没有新增临时文件、日志、下载或测试服务，浏览器已关闭；永久审核图保留，旧文件与旧临时材料不动。最终commit见本次回复。请审ACCOUNT-OVERVIEW-C-r1布局、字段/弹窗和反馈方案；下一P40组织管理，随后P41/P42目的页全变体，完整73页Vue实现、宝塔发布与用户签收仍未完成。
