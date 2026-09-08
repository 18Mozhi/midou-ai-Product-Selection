# P25 审批中心 · APPROVAL-C-r1

2026-09-08 · C方向独立待审提案。43场景×双端86张主图，另有8张长内容下部图，共94 PNG；其中2张是非业务控件板。尚未获用户审稿通过，不是Vue、后端或生产完成报告。

[打开交互原型](index.html) · [桌面审批对照](1440-detail.png) · [手机审批对照](390-detail.png) · [证据清单与哈希](evidence.json)

## 怎么审核

先看队列→点击“核对依据”→提交与当前对照→证据/依据/节点→记录判断。再检查模板草稿、叠加发布确认、发起审批及它们的失败/忙碌状态。上方选择器属于审稿工具，不是生产功能；点击资源或通知链接只展示离线导航意图。

本稿继续C主蓝#254a9c、深蓝#193b80、正文#202c3d、辅助#58677b、底色#edf1f6、边界#dbe1e9。中文无衬线，控件16px、辅助13px、标题21–34px。队列使用蓝色审批范围目录，详情是居中宽阅读窗，不沿用旧侧抽屉；依据对照和记录判断分区，不复制P13个人任务目录。手机将对照改为同字段上下阅读，详情标题和关闭按钮随阅读保留。

frontend-design技能促成了宽阅读窗、单一字段对照表和移动固定标题；目检后去掉重复表头/空表、避免阅读区被标题遮挡。模板中审批人/超时接收人以及发起的资源编号直接可见，不再把必填工作藏进“技术配置”。这些是提案，不是生产组件已改。

## 原始事实与样例边界

数据由永久助手执行未修改的m05-02-approval-workflow.spec.ts的setup注册函数，并读取惰性GET回调；不执行测试内写请求。保留审批921、机会929、提交3/4=75%、当前4/4=100%、风险变化、规则版本、两节点、升级操作和两个模板。

原测试响应并不一致：模板目录current_version=1、详情锁定版本=3；节点escalated_at=null但历史有升级记录；同一成员ID具有不同展示名；列表meta.page_size=100而当前UI请求20。本稿明确保留独立响应，不把它们拼成一致数据库/身份/发布链，也不根据历史升级替换当前审批人。超时数字仅按固定离线时钟2026-08-10 08:00（Asia/Shanghai），不是线上当前告警。

扩展的已结束、无变化、字段移除、无快照、任务证据不适用、节点升级、21条分页与长文均标记为合成布局样例，不当真实事件。无变化/字段移除diff由真实compareApprovalDecisionContexts函数产生；合成上下文不代表实际数据库返回。原始数据不被提交或筛选更新。所有写入仅生成离线请求预览，绝不制造批准、发布或新增请求成功。

## 动作和弹窗覆盖

| 工作面 | 本稿合同 |
| --- | --- |
| 审批队列 | 待我处理/我发起的，审批中/已批准/已驳回/全部；每页20项；本人可决定及超时仅当前页统计。无发布模板只能配置模板，task:assign才显示管理/发起 |
| 详情与返回 | approval深链；关闭清approval；只接受/notifications或其query返回，资源/证据链接沿实际返回。不把关闭变成取消审批 |
| 依据对照 | captured与live_fallback分开；没有快照不造提交值/差异；任务不适用不显示100%；null保留未提供；提交快照缺失不直接说当前仍缺失 |
| 节点与历史 | 原审批人、当前审批人、超时接收人、期限和升级时间分别展示；升级不是批准。操作历史不变，技术编号可展开 |
| 批准/驳回 | task:assign且can_decide；原因1–1000字，发送原始reason与expected_version；空白禁用，缺失证据仅提示，不添加业务门槛 |
| 模板草稿 | name≤200、task/opportunity_decision、单节点name≤120、SLA整数1–43200、两个工作区成员选择；草稿未发布不能发起 |
| 模板发布 | 模板窗之上叠加发布窗；原current_version、expected_revision和trim原因（前端≤500，后端1000）；没有额外action字段 |
| 发起审批 | 只选已发布模板；resource_type由模板锁定，resource_id/title trim；存在/类型/范围仍需服务端验证 |
| 失败与关闭 | 每窗就近可见提示、输入保留。模板/发起关闭保留草稿；发布关闭清发布原因；详情重开清旧原因。忙碌字段锁定，关闭不声称撤销请求 |
| 键盘 | 详情/模板/发起/发布初焦点关闭、Tab/Shift+Tab循环；叠加窗Escape只关顶层并返回发布入口；真实遮罩坐标关闭，内部内容点击不关闭 |
| 读取 | 加载/空/错误/无权/过期/限流/版本变化与详情加载/404/失败分别显示；成员Promise.all失败保留整页失败语义，不宣称列表已完整加载；重试只记意图 |

真实源码的setFilter('')移除status，刷新又初始化pending已在VM复现。原型使用显式status=保留“全部”，但该调整尚未迁入Vue，AN-G01不能因此标已修复。setQueue/setPage/closeDetail的原query语义和安全通知返回亦有源验证。模板/发布/发起错误当前仍主要写页级notice；窗内反馈是本稿提案，不宣称源码已修复。

## 全图索引

| 场景 | 桌面1440×1000 | 手机390×844 |
| --- | --- | --- |
| 待我处理 | [查看](1440-normal.png) | [查看](390-normal.png) |
| 我发起的 | [查看](1440-requested.png) | [查看](390-requested.png) |
| 筛选为空 | [查看](1440-empty.png) | [查看](390-empty.png) |
| 没有已发布模板 | [查看](1440-no_templates.png) | [查看](390-no_templates.png) |
| 只读队列 | [查看](1440-readonly.png) | [查看](390-readonly.png) |
| 正在读取 | [查看](1440-loading.png) | [查看](390-loading.png) |
| 读取失败 | [查看](1440-error.png) | [查看](390-error.png) |
| 无权访问 | [查看](1440-forbidden.png) | [查看](390-forbidden.png) |
| 登录失效 | [查看](1440-expired.png) | [查看](390-expired.png) |
| 请求过于频繁 | [查看](1440-rate_limited.png) | [查看](390-rate_limited.png) |
| 版本变化 | [查看](1440-version_conflict.png) | [查看](390-version_conflict.png) |
| 成员依赖失败 | [查看](1440-member_error.png) | [查看](390-member_error.png) |
| 详情加载 | [查看](1440-detail_loading.png) | [查看](390-detail_loading.png) |
| 详情不存在 | [查看](1440-detail_missing.png) | [查看](390-detail_missing.png) |
| 详情失败 | [查看](1440-detail_error.png) | [查看](390-detail_error.png) |
| 提交与当前对照 | [查看](1440-detail.png) | [查看](390-detail.png) |
| 提交证据 | [查看](1440-evidence.png) | [查看](390-evidence.png) |
| 依据和规则 | [查看](1440-basis.png) | [查看](390-basis.png) |
| 依据下部与申请决定 | [查看](1440-basis-bottom.png) | [查看](390-basis-bottom.png) |
| 节点与历史 | [查看](1440-nodes.png) | [查看](390-nodes.png) |
| 技术信息 | [查看](1440-technical.png) | [查看](390-technical.png) |
| 记录判断 | [查看](1440-decision.png) | [查看](390-decision.png) |
| 无变化合成样例 | [查看](1440-unchanged.png) | [查看](390-unchanged.png) |
| 缺失字段合成样例 | [查看](1440-removed.png) | [查看](390-removed.png) |
| 无历史快照合成样例 | [查看](1440-fallback.png) | [查看](390-fallback.png) |
| 任务证据不适用合成样例 | [查看](1440-task.png) | [查看](390-task.png) |
| 上下文未提供合成样例 | [查看](1440-context_missing.png) | [查看](390-context_missing.png) |
| 不可决定的详情 | [查看](1440-detail_readonly.png) | [查看](390-detail_readonly.png) |
| 已结束合成样例 | [查看](1440-terminal.png) | [查看](390-terminal.png) |
| 节点升级合成样例 | [查看](1440-escalated.png) | [查看](390-escalated.png) |
| 模板草稿 | [查看](1440-template.png) | [查看](390-template.png) |
| 模板下部与已有模板 | [查看](1440-template-bottom.png) | [查看](390-template-bottom.png) |
| 模板失败 | [查看](1440-template_error.png) | [查看](390-template_error.png) |
| 模板失败下部 | [查看](1440-template_error-bottom.png) | [查看](390-template_error-bottom.png) |
| 模板处理中 | [查看](1440-template_busy.png) | [查看](390-template_busy.png) |
| 模板处理中下部 | [查看](1440-template_busy-bottom.png) | [查看](390-template_busy-bottom.png) |
| 叠加发布确认 | [查看](1440-publish.png) | [查看](390-publish.png) |
| 发布失败 | [查看](1440-publish_error.png) | [查看](390-publish_error.png) |
| 发布处理中 | [查看](1440-publish_busy.png) | [查看](390-publish_busy.png) |
| 发起审批 | [查看](1440-request.png) | [查看](390-request.png) |
| 发起失败 | [查看](1440-request_error.png) | [查看](390-request_error.png) |
| 发起处理中 | [查看](1440-request_busy.png) | [查看](390-request_busy.png) |
| 决定冲突保留 | [查看](1440-decision_error.png) | [查看](390-decision_error.png) |
| 决定处理中 | [查看](1440-decision_busy.png) | [查看](390-decision_busy.png) |
| 21条分页合成样例 | [查看](1440-pagination.png) | [查看](390-pagination.png) |
| 长标题/原因合成样例 | [查看](1440-long.png) | [查看](390-long.png) |
| 非业务控件板 | [查看](1440-controls.png) | [查看](390-controls.png) |

主页面截图为完整页面；弹窗为实际视口，依据/节点/判断有独立阅读位置；模板三态与依据补下部图，未通过扩高窗口冒充真实视口。

## 验证与复验

```powershell
node scripts/verify-ui-phase2-approval-c.mjs
# 仅在有意更新本包正式图时使用
node scripts/verify-ui-phase2-approval-c.mjs --capture
```

永久助手执行真实Vue源函数，核对模板/发起/发布/批准/驳回五body及失败状态，执行生产字段验证器的SLA/版本/原因校验；真实compare函数验证无变化与移除字段；真实listRequests方法经惰性pool检查两种范围、组织/工作区、排序分页。没有运行MySQL、真实授权或实际事务。

浏览器检查43双端场景，源/数据/94图片哈希、五body、失败保留、权限展示、全部刷新、分页、深链/安全返回、叠加窗焦点/取消、字段约束、原始事实不变、字号/触控与横向溢出；另验320/768/780/781/1024和390×667代表工作面。file://、HTTP阻断、0请求/0存储/0控制台错误，finally关闭全部浏览器上下文，不启动服务器、不安装依赖。

## 未覆盖与运行交接

这是P25首轮独立图包，不是完整生产验收。真实读取取消/归属、迟到写回、跨窗忙碌、成功后重读失败、完整角色与模板版本锁、不可变审计、Worker升级、三主题/密度、原生200%缩放/软键盘及屏幕阅读器仍待验证。批准/驳回真实结果不是按钮预览可以抵扣的。

未改真实Vue、API/OpenAPI、数据库、权限/升级规则、依赖、运行配置、旧图或coverage/审批结论。无环境变量或服务重启要求，未部署。HTML/CSS/JS/data/94PNG/README/evidence与两验证脚本都是永久交付；未创建本批临时文件或常驻服务。下一项W03通知中心，P25审稿/真实实现及全73页闭环保持待办。
