# P38 平台运行概览 · PLATFORM-OVERVIEW-C-r1

2026-09-11 来源重验：真实 P38 脚本新增[时间窗同步](../../P38-WINDOW-SYNC-REVIEW.md)，模板/CSS 未改。本 HTML 的控制器、数据和具体审核状态不变；重跑原验证器更新来源指纹，不把本稿的历史/预览行为算作当前 Vue 证明。

状态：具体图稿待用户审核；不是线上页面、Vue实现或第二阶段完成。起点 main / 386336c，2026-09-09。用户选择C只批准方向，不等于本版本具体页面通过。

[打开可交互稿](index.html)。本稿为 file:// 离线审核工具；右上场景选择器不是生产功能。控制台链接拦截为精确跳转意图，复制使用内存合成适配器。共有43场景双端86主图、2异常区域局部图、3移动来源预览局部图，91 PNG；其中2张controls是非业务审核工具，不计新增业务页。桌面列设置场景在移动端按真实合同不显示桌面工具，不把同名图冒充移动列面板。

## 1. 构图与视觉决定

使用frontend-design：蓝色页内目录负责定位，白色内容以“异常与处理入口→结果趋势/系统→来源→队列/规模”组织。首屏将需要关注与窗内待处理区分，不再使用等权指标卡墙。C色板 #254a9c / #193b80 / 白底 / #202c3d；中文无衬线，正文16、辅助至少13、操作至少44px。移动目录为横向短入口，指标与来源纵向阅读，来源保留只读预览。蓝目录是页内概念，不替代已交W01全局壳层。

状态同时有文字，不仅靠红黄绿。趋势成功实线/失败虚线并带点，单点不绘制虚构连线，全零保留真实零；新增逐点文本替代为提案。减少动态效果时关闭非必要运动。来源表的标准/紧凑是已有局部表格密度，不等于已完成全站两密度/三主题。

目检桌面正常/列设置和移动异常/长预览；修复移动待处理数值与标签连成一行的问题。首轮发现审核工具select继承13px，已改为16px并定向复验。补验原生预览Shift+Tab时出现body中间焦点，增加原型显式Tab双边界循环；生产不改。初次路径探查沿用了规格短路径，定位至真实计划子目录后读取，没有创建错误路径文件。

## 2. 数据与权限不混用

原 dashboard、独立15来源、3点trend来自 tests/e2e/m06-02-platform-dashboard.spec.ts AST，未自造线上事实。原组织42/用户318/来源3、96.4%、7待处理、2关注、700MB与12MB保持；15来源夹具单独替换来源及启用数，异常provider-15优先、先8后15。原三点成功43/失败3与96.4%并不一致，保留原fixture差异，不重算成功率；原默认趋势空也不把成功率改零。所有数据观测时间为2026-08-08，不宣称当天生产。窗15m/7d/30d、长字段、零/缺失及错误切换是明确合成场景，不是后端返回证据。

| 观察项 | 实际口径 |
| --- | --- |
| 组织、用户、启用来源 | 当前规模，不随窗筛选 |
| 任务成功率、待处理、过期租约 | collection_tasks updated_at >= since；成功终态与失败终态，不是来源观测比率 |
| 趋势 | 更新时间分桶，≤24h小时，其余按日；无数据不是0 |
| 来源健康 | 启用来源 + 窗内观测；异常优先，仅本地展开 |
| queues | 当前各状态，无since；不要求与窗内queue_backlog相等，条宽只是限幅装饰 |
| open_alerts / alerts | 前者质量未解决总数+窗失败任务+窗过期租约；后者最近返回列表，不是同一分母 |
| 文件 | 当前有效文件总字节 / 窗内新增有效文件字节，不是磁盘占用率 |
| activity | 响应有此字段，源页面没有展示，不新增活动按钮 |

页面与GET要求platform:operate。组织/用户明细及“管理组织和用户”另限platform:superadmin；正常稿是运营角色，superadmin场景仅演示额外入口，不证明真实权限。GET服务端写platform_dashboard_views及platform_audit_events事务，不能称数据库零写。生产/MySQL/审计这轮均没有执行。

## 3. 每项控件与预览

| 合同 | 本稿交互与边界 |
| --- | --- |
| PA38-WINDOW | 四窗select，URL replace保留其他query，内存GET精确window；读取中禁用。审核场景切换重置为该场景，不模拟真实浏览器历史复入 |
| PA38-REFRESH | 页头刷新、首读错误重新读取、旧快照重新刷新；pending单飞，成功替快照，失败留旧观测范围 |
| PA38-COLLECTION / ROOTCAUSE | /platform-admin/collection；/platform-admin/collection/overview?root_cause=1，不在本页重放 |
| PA38-ORGANIZATIONS / USERS | /platform-admin/organizations、/platform-admin/users，超级管理员入口 |
| PA38-SOURCES / DATA / QUEUE | /platform-admin/providers/sources、/platform-admin/data、/platform-admin/collection/overview；包含趋势空态恢复与常用入口 |
| PA38-LOGIN | /login，不凭旧文案承诺自动返回 |
| PA38-PROVIDERS | 原8项/全部15本地切换，不发GET、不改变后端启用规则 |
| PA-T-COLUMNS / COLUMN | 原生details、四列checkbox，至少一列，最后一列禁用；冻结首个可见列，不强绑来源列 |
| PA-T-FREEZE / DENSITY | 组件内存冻结开关、standard/compact，不落存储或API |
| PA38-TECH | 告警编号/组织/工作区及移动来源id/code原生details，无处理/复制业务动作。预览额外披露原始status为提案 |
| PA-X-EXPAND / COPY | 只有requestId，不造traceId。复制反馈1500ms，失败就近提示；防迟到归属仅在提案，系统剪贴板未调用 |
| PA-S-PREVIEW | 仅移动入口；正常、未知枚举、长内容三变体。初焦关闭、Tab/Shift+Tab、Escape、按钮、遮罩和返焦；本稿native showModal替代源自定义overlay，仅提案 |
| 审核工具 | 场景选择、静态六态板、跳转意图提示，不是新增生产业务能力 |

没有业务写入确认窗、来源启停、凭证测试、导出、直接处理告警或新权限/API。原provider status=critical排序优先但显示“未知”的不一致保留：unknown_provider图和移动技术详情披露原值，不暗改枚举。原parsing/validating文字回退“其他状态”由源函数检查记录，未伪造生产修复。

## 4. 验证证据与剩余差异

永久脚本：node scripts/verify-ui-phase2-platform-overview-c.mjs --capture 重新采证；无参数先核对真实源码/静态数据/所有PNG SHA256，再运行离线浏览器交互。数据辅助器执行真实Vue脚本的函数/computed，依赖均是惰性替身：验证8/15排序、趋势43/3/坐标、null/0、字节、四URL、非法窗回退24h、保留query、重复刷新只读一次、12000ms abort回调。不是Vue挂载、真实计时12秒、SQL执行、权限或生产证明。

已离线复现：7d切换失败保留24h；ready时401/403仍显示旧数据；只有trend会判empty；TechnicalDetails复制拒绝没有catch。原型用明确旧快照范围、读取离开代次、复制编号归属及失败提示展示可审核方案。保留旧数据的权限风险并未在生产修复；是否在401/403隐藏旧数据属于待审核产品行为，不能将提案保护泛化为全生命周期完成。

Playwright验证1440/390的43场景、四URL、精确7类控制台导航与登录、8/15展开、表格最后一列/首可见冻结/两密度、无样本/0和真实趋势坐标、失败快照恢复、重复读取、离开后旧响应拒绝、复制拒绝/1500ms/旧请求复制反馈丢弃、移动预览三变体与键盘/遮罩/返焦。另验759/760/768/1024无页面溢出及长字段。浏览器HTTP/错误/cookies/localStorage/sessionStorage均0，finally关闭全部上下文。

追加W05合同门发现NavigationShell的历史指纹过期；核对既有243941a改动及真实load/watch/unmount，再同步唯一源指纹与语义说明。该提交只保护壳层导航读取及关闭搜索，不解决P38自身读窗/权限错误；其余31源与128候选/24绑定不变，不单纯覆盖hash掩盖差异。实际检查结果见PROGRESS。

仍未验：挂载Vue路由反向query watch与KeepAlive、实际API重试/鉴权/MySQL审计、完整六角色、三主题/全局密度、原生200%缩放、真实手机软键盘/屏幕阅读器、预览记录消失/复现时序与全部复制并发。资料一致性提示、逐点文本、原生模态、异常归属都是本地提案，不是全站修复。91图不是全站146正式槽位或实现图已齐全的证明，未改review状态。

## 5. 双端全图索引

| 场景 | 桌面1440 | 移动390 |
| --- | --- | --- |
| 默认 · 原始三来源夹具 | [1440](1440-normal.png) | [390](390-normal.png) |
| 超级管理员入口 | [1440](1440-superadmin.png) | [390](390-superadmin.png) |
| 三点趋势 · 独立夹具 | [1440](1440-trend.png) | [390](390-trend.png) |
| 单点趋势 · 合成 | [1440](1440-trend_single.png) | [390](390-trend_single.png) |
| 全零趋势 · 合成 | [1440](1440-trend_zero.png) | [390](390-trend_zero.png) |
| 成功率无样本 | [1440](1440-null_rate.png) | [390](390-null_rate.png) |
| 成功率为零 | [1440](1440-zero_rate.png) | [390](390-zero_rate.png) |
| 空平台 | [1440](1440-empty.png) | [390](390-empty.png) |
| 仅趋势被判空 · 源边界 | [1440](1440-only_trend.png) | [390](390-only_trend.png) |
| 首次读取中 | [1440](1440-loading.png) | [390](390-loading.png) |
| 首次读取失败 | [1440](1440-blocked.png) | [390](390-blocked.png) |
| 首次读取超时 | [1440](1440-timeout.png) | [390](390-timeout.png) |
| 离线失败 | [1440](1440-offline.png) | [390](390-offline.png) |
| 无权访问 | [1440](1440-forbidden.png) | [390](390-forbidden.png) |
| 登录过期 | [1440](1440-expired.png) | [390](390-expired.png) |
| 读取受限流 | [1440](1440-rate_limited.png) | [390](390-rate_limited.png) |
| 刷新中保留快照 | [1440](1440-refreshing.png) | [390](390-refreshing.png) |
| 切窗失败 · 旧快照 | [1440](1440-refresh_failed.png) | [390](390-refresh_failed.png) |
| 刷新超时 | [1440](1440-refresh_timeout.png) | [390](390-refresh_timeout.png) |
| 刷新权限撤回 · 源边界 | [1440](1440-refresh_forbidden.png) | [390](390-refresh_forbidden.png) |
| 刷新登录过期 · 源边界 | [1440](1440-refresh_expired.png) | [390](390-refresh_expired.png) |
| 15分钟 · 合成范围 | [1440](1440-window15m.png) | [390](390-window15m.png) |
| 7天 · 合成范围 | [1440](1440-window7d.png) | [390](390-window7d.png) |
| 30天 · 合成范围 | [1440](1440-window30d.png) | [390](390-window30d.png) |
| 15来源 · 默认8项 | [1440](1440-many_providers.png) | [390](390-many_providers.png) |
| 15来源 · 全部展开 | [1440](1440-all_providers.png) | [390](390-all_providers.png) |
| 暂无启用来源 | [1440](1440-no_providers.png) | [390](390-no_providers.png) |
| 未知状态 · 原值披露 | [1440](1440-unknown_provider.png) | [390](390-unknown_provider.png) |
| 长名称与编号 · 合成 | [1440](1440-long_fields.png) | [390](390-long_fields.png) |
| 无近期告警 | [1440](1440-no_alerts.png) | [390](390-no_alerts.png) |
| 无队列记录 | [1440](1440-no_queues.png) | [390](390-no_queues.png) |
| 请求编号展开 | [1440](1440-technical.png) | [390](390-technical.png) |
| 告警关联信息展开 | [1440](1440-alert_details.png) | [390](390-alert_details.png) |
| 请求编号复制成功 | [1440](1440-copy_success.png) | [390](390-copy_success.png) |
| 请求编号复制失败 | [1440](1440-copy_failed.png) | [390](390-copy_failed.png) |
| 桌面列设置 | [1440](1440-columns.png) | [390](390-columns.png) |
| 仅一列 · 禁止全部隐藏 | [1440](1440-one_column.png) | [390](390-one_column.png) |
| 桌面紧凑密度 | [1440](1440-compact.png) | [390](390-compact.png) |
| 取消首可见列冻结 | [1440](1440-unfrozen.png) | [390](390-unfrozen.png) |
| 刷新悬停 | [1440](1440-hover.png) | [390](390-hover.png) |
| 刷新焦点 | [1440](1440-focus.png) | [390](390-focus.png) |
| 刷新按下 | [1440](1440-pressed.png) | [390](390-pressed.png) |
| 控件六态 · 非业务工具 | [1440](1440-controls.png) | [390](390-controls.png) |

局部：[桌面异常区](1440-attention-detail.png)、[移动异常区](390-attention-detail.png)、[移动来源正常](390-preview-normal.png)、[未知枚举](390-preview-unknown_provider.png)、[长字段预览](390-preview-long_fields.png)。预览局部图仅展示弹窗，背景焦点隔离另由脚本验证，不冒充整页截图。

## 6. 交付与操作

本轮只新增原型、91张永久图、来源辅助器/验证器及直接相关规格/计划/合同/Feature Map提案说明。没有改apps/API/OpenAPI/数据库/迁移/权限/.env/依赖/部署器；无新环境变量、配置参数、安装或重启要求。不涉及插件或Python消费者运行契约，故不改它们。这里是离线设计，不部署。

图片、evidence、README和脚本均为用户审核永久交付，不是待清理临时文件。没有本轮临时文件、日志、fixture写入或开发服务；Playwright浏览器均已关闭，既有旧材料不动。最终提交hash见本次回复。用户审PLATFORM-OVERVIEW-C-r1具体布局、信息层级、预览及错误策略；C方向本身不重复询问。下一批P39组织与账号概览，完整73页实现、验证、宝塔发布与用户签收仍未完成。
