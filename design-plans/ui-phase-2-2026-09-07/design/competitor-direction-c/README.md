# P19/P20 竞品目录与监控规则 · C 方向

2026-09-09入口/直达增量：[正常入口与P20 create=1](../../COMPETITOR-ENTRY-QUERY-REVIEW.md)新增96PNG，当前682图/66场景/58控件变体268状态536双端实例。P20同名创建动作按pageActionVisualReferences独立归属；常规页不新增创建入口。回焦精确到入口，无入口直达回标题为离线提案。下面586等数字保留历史。

2026-09-09恢复增量：[主次恢复、只读空态与搜索](../../COMPETITOR-RECOVERY-STATE-REVIEW.md)新增190PNG，当前586图：60整页场景、49控件变体226状态/452双端实例。P20专属异常与fullPath样本、返回历史与load首个GET明确；额外变体不提升代表槽，生产未改，下面396等数字为历史。

2026-09-09对象操作增量：[对象选择、启停、任务、开合](../../COMPETITOR-OBJECT-STATE-REVIEW.md)新增126PNG，当前396图。新增12变体58状态和5整页场景；原型对象卡片显式type、详情内写入目标提示/禁用与进度归属完善。生产未改，旧图可从1bd2eb22追溯，两张待审图字节不变；下面270等数为历史。

2026-09-09次级增量：[关闭、取消、上一步与导航状态](../../COMPETITOR-SECONDARY-STATE-REVIEW.md)新增112PNG，当前270图。新增七个次级变体40状态、四个导航变体16状态；修正离线预置场景焦点返回入口。额外变体不作新动作、表单busy锁定不冒充现有Vue行为；旧图版本可从1fa3104d追溯，下面158图为前批记录。

2026-09-09控件增量：[四个关键提交按钮六态](../../COMPETITOR-CONTROL-STATE-REVIEW.md)。本次有意修改图稿CSS的hover/active/focus/disabled反馈及忙碌语义、离线提交pending模拟；旧图按新来源重拍，旧版在Git ce1adebc可追溯。新增24状态双端48图及collect-busy双端2图，当前48整页场景/158PNG；具体控件/页面仍待审。下面108图的归属复验段落为前一批历史。

2026-09-09增量复验：真实Vue的CP-B02/B03读/采集归属已局部修复，新增双端竞态回归；不改变本包HTML/CSS/JS或用户批准。旧来源基准见Git f0ed5f2f，Vue旧LF SHA256为49653e9dbc80617d96f77ac5c89e8a7580d0e732fbe8e54e17ed58757281c0c7；本次按实际源码和永久回归重跑原型验证/108图采集后记录新来源，而非把旧图哈希冒充当前执行。boundaryProof区分两项fixed-source-regression和三项UNFIXED；旧“未修复”文字仅对应尚未关闭项，完整结果见../../PROGRESS.md。

版本 COMPETITOR-C-r1；起始基线 7e589620；状态：具体图稿待审。用户选择C只确定方向，不代表批准本包、允许上线或完成73页。

[打开交互原型](index.html) · [打开全部图片图册](gallery.html) · [源与图片证据](evidence.json)

## 构图与使用

按frontend-design重构为白身份栏、蓝观察范围、对象目录与白证据阅读面；移动端顺序为范围、搜索与目录、对象事实、变化、历史。P20独立规则目录，不把P19详情换标题。主蓝#254a9c、正文#202c3d，16px正文/控件、13px辅助、44px触控与8/12/20px圆角。减少动态效果受系统偏好约束。旧衬线账页大编号和等权指标卡不沿用。

直接打开index.html，用顶部审核场景切换。数据全部是明确标注的合成合同样本；链接、POST、DELETE只记录内存意图，没有生产请求或持久化。三弹窗可点开、返回、取消、输入及模拟提交；错误场景保留输入，原型outcome可用于隔离失败演示。不要把“隔离成功”当数据库提交或任务真实执行。

## 本包覆盖与依据

- 当前53场景、396PNG：1440/390双端106张，27个精确控件变体138代表状态双端276张，更多菜单/空白删除原因/非法URL/按钮焦点与悬停10张，768/1024代表页4张。它们只是代表变体，不是全部动作/字段通过。
- 页面字段与动作来自CompetitorMonitor.vue、P19/P20规格及competitor-contract-review；服务/路由/仓储和Worker约束已绑定来源指纹。旧E2E文件只是本批参考来源，未在本轮重跑，不把绑定文件数当测试数。
- 九组真实setup函数隔离验证：变化按change_id关联提醒；价格按evidence_id取币种；创建精确可选字段；规则null目标/库存省阈值/数值0/重置；删除trim/revision；任务权限独立；采集受理与当前行轮询保留新任务；卸载清理；深链优先与新搜索清query。
- 真实源码仍存在：停用规则进入applicableRules、全局规则借当前币种、P19规则GET失败静默置空。这些已在函数隔离中复现；本包只改设计呈现，不改源码。窗口最早快照并非全历史基线。
- 三主题×两密度只覆盖P19代表主场景；云白/紫主题为兼容ID下的提案配色，不修改生产主题或历史主题图包。

## 按动作与弹窗审核

| 语义 / 图稿入口 | 已呈现与局部验证 | 尚未证明 |
| --- | --- | --- |
| CP-SEARCH / CLEAR / DETAIL | 本地标题、external_id、source_site筛选；深链优先；当前对象GET意图 | 真实history、迟到响应、KeepAlive切换、组织范围 |
| CP-CREATE | 三步、URL与字段约束、错误保留、忙碌、取消/重开保留字段；前两步不POST | 真实幂等/事务、所有重复点击与关闭竞态 |
| CP-RULE-NAV / CURRENT / BACK | 两个真实路由、指定目标query、只读深链不弹窗 | 浏览器history与所有来源组合 |
| CP-RULE-OPEN / SUBMIT / CLOSE | 工作区null目标、指定对象、价格/库存、库存省略阈值、0、失败保留、重开默认 | 真实后端/数据库、所有rank/review_count数值边界 |
| CP-COLLECT | 受理不冒充成功；pending/paused禁用；captcha/terminal/rate限制图 | 真实来源、Worker租约/重试/Outbox/通知 |
| CP-TOGGLE / MORE | 更多菜单分隔危险动作、状态+revision7意图 | 真实冲突/恢复与任务并发 |
| CP-DELETE | 原因trim/500上限、版本冲突、保留历史、空白阻止、取消零意图、重开清空 | 真实软删审计与读取失败、结果不确定性 |
| CP-TASK-CREATE / LINK | 价格与评论按各自事件/证据建意图；task:create独立；任务链接 | 实际创建、任务详情及长期跨刷新映射 |
| CP-SOURCE / HELP / STATE | 来源新窗口声明、帮助开合、错误/过期/权限/未知规则 | 实际导航目标运行、完整共享状态次操作矩阵 |

26个场景DOM动作标记（原有任务链接新增独立场景，评论任务是同语义的独立入口），不是全站去重动作分母，也不是26个完整业务验收。步骤submit和最终submit共用入口；不以初始DOM计数替代行为覆盖或新增业务动作。

三个弹窗均是有名称的原生dialog，默认焦点进入字段，Tab/Shift+Tab循环、Escape/取消/遮罩关闭后返回打开控件；提交中禁用关闭与输入是提案。初轮测试发现Tab可跳出后补约束复测通过，但真实Vue没有获得该修复。创建step变化与规则metric变化重新定位焦点；删除不新增永久历史删除能力。

## 明确不做的事 / 未关闭项

不新增规则编辑、删除、启停、导出、批量操作、自动决策或快照修改；不增加API字段、币种字段、数据库结构、依赖、配置、权限。阈值数值按实际服务校验，库存不发送threshold_value。已有生产算法/交易与AI边界不变，无需重启。

CP-G01–07不关闭。局部原型单次提交与取消验证不是所有异步竞态验收；监控读取数不证明机会竞争质量门。history-window图明确省略中间98条，只审核窗口边界文案，不证明完整100条长列表；所有主题×弹窗×密度、全部采集状态、长文本/真实辅助技术、实际Vue/会话/RBAC/SQL/Worker/通知以及部署签收均待办。720×500只测等效CSS重排，不声称真实200%浏览器缩放。

## 如何复验与收尾

- 最小源检查：`node scripts/verify-ui-phase2-competitor-source.mjs`。本批最小控件验证：`node scripts/verify-ui-phase2-competitor-c.mjs --smoke`，只读，不与capture同时使用。
- 只读复验：`node scripts/verify-ui-phase2-competitor-c.mjs`；先比较来源/PNG指纹，再跑离线浏览器。不会重画旧图。
- 有意重生成本包：`node scripts/verify-ui-phase2-competitor-c.mjs --capture`。只写本目录正式PNG、evidence.json和gallery.html；先审源码变化，不能借此消除未解释漂移。
- 标准门禁：verify:docs、verify:runtime-docs、verify:static-analysis、format:check及全站审计；准确结果见../../PROGRESS.md。
- 本包文件/永久验证器/396PNG是正式交付物，全部保留；没有一次性临时产物、dev server或远程服务。浏览器在finally中关闭。
- 审核请注明“P19或P20 / COMPETITOR-C-r1 / 场景 / 通过或修改意见”。逐页批准后再实施对应Vue。全站P21/P22缺页仍需补稿，本轮不宣布全站完成。

## 逐场景图片

| 页面 / 场景 | 桌面 1440 | 手机 390 |
| --- | --- | --- |
| P19 · 采集请求提交中（不是已受理任务执行中） | [查看](1440-collect-busy.png) | [查看](390-collect-busy.png) |
| P19 · 竞品目录与证据 | [查看](1440-directory.png) | [查看](390-directory.png) |
| P19 · 字段缺失与币种未知 | [查看](1440-partial.png) | [查看](390-partial.png) |
| P19 · 首次采集排队 | [查看](1440-pending.png) | [查看](390-pending.png) |
| P19 · 采集进行中 | [查看](1440-running.png) | [查看](390-running.png) |
| P19 · 验证码阻塞 | [查看](1440-blocked-captcha.png) | [查看](390-blocked-captcha.png) |
| P19 · 采集失败无快照 | [查看](1440-terminal.png) | [查看](390-terminal.png) |
| P19 · 暂停监控 | [查看](1440-paused.png) | [查看](390-paused.png) |
| P19 · 只读角色 | [查看](1440-readonly.png) | [查看](390-readonly.png) |
| P19 · 独立任务权限 | [查看](1440-task-only.png) | [查看](390-task-only.png) |
| P19 · 深链优先搜索 | [查看](1440-deep-link.png) | [查看](390-deep-link.png) |
| P19 · 搜索无结果 | [查看](1440-search-empty.png) | [查看](390-search-empty.png) |
| P19 · 首次空目录 | [查看](1440-empty.png) | [查看](390-empty.png) |
| P19 · 目录读取中 | [查看](1440-loading.png) | [查看](390-loading.png) |
| P19 · 目录读取失败 | [查看](1440-error.png) | [查看](390-error.png) |
| P19 · 会话过期 | [查看](1440-expired.png) | [查看](390-expired.png) |
| P19 · 无读取权限 | [查看](1440-forbidden.png) | [查看](390-forbidden.png) |
| P19 · 来源限流 | [查看](1440-rate-limited.png) | [查看](390-rate-limited.png) |
| P19 · 详情失败保留目录 | [查看](1440-detail-error.png) | [查看](390-detail-error.png) |
| P19 · 规则读取未知 | [查看](1440-rules-unknown.png) | [查看](390-rules-unknown.png) |
| P19 · 历史窗口边界 | [查看](1440-history-window.png) | [查看](390-history-window.png) |
| P19 · 提醒与任务分离 | [查看](1440-alerts-mixed.png) | [查看](390-alerts-mixed.png) |
| P19 · 添加 / 商品链接 | [查看](1440-create-link.png) | [查看](390-create-link.png) |
| P19 · 添加 / 市场信息 | [查看](1440-create-market.png) | [查看](390-create-market.png) |
| P19 · 添加 / 确认 | [查看](1440-create-confirm.png) | [查看](390-create-confirm.png) |
| P19 · 添加 / 失败保留 | [查看](1440-create-error.png) | [查看](390-create-error.png) |
| P19 · 添加 / 提交中 | [查看](1440-create-busy.png) | [查看](390-create-busy.png) |
| P19 · 删除 / 保留历史 | [查看](1440-delete.png) | [查看](390-delete.png) |
| P19 · 删除 / 版本冲突 | [查看](1440-delete-error.png) | [查看](390-delete-error.png) |
| P19 · 删除 / 提交中 | [查看](1440-delete-busy.png) | [查看](390-delete-busy.png) |
| P20 · 监控规则目录 | [查看](1440-rules.png) | [查看](390-rules.png) |
| P20 · 无监控规则 | [查看](1440-rules-empty.png) | [查看](390-rules-empty.png) |
| P20 · 只有停用规则 | [查看](1440-rules-disabled.png) | [查看](390-rules-disabled.png) |
| P20 · 对象空但规则仍存在 | [查看](1440-rules-no-objects.png) | [查看](390-rules-no-objects.png) |
| P20 · 规则读取失败 | [查看](1440-rules-error.png) | [查看](390-rules-error.png) |
| P20 · 规则读取中 | [查看](1440-rules-loading.png) | [查看](390-rules-loading.png) |
| P20 · 只读规则目录 | [查看](1440-rules-readonly.png) | [查看](390-rules-readonly.png) |
| P20 · 规则 / 工作区价格 | [查看](1440-rule-global.png) | [查看](390-rule-global.png) |
| P20 · 规则 / 指定竞品 | [查看](1440-rule-target.png) | [查看](390-rule-target.png) |
| P20 · 规则 / 库存 | [查看](1440-rule-availability.png) | [查看](390-rule-availability.png) |
| P20 · 规则 / 失败保留 | [查看](1440-rule-error.png) | [查看](390-rule-error.png) |
| P20 · 规则 / 提交中 | [查看](1440-rule-busy.png) | [查看](390-rule-busy.png) |
| P19 · deep-ocean / standard | [查看](1440-deep-ocean-standard.png) | [查看](390-deep-ocean-standard.png) |
| P19 · deep-ocean / compact | [查看](1440-deep-ocean-compact.png) | [查看](390-deep-ocean-compact.png) |
| P19 · cloud-white / standard | [查看](1440-cloud-white-standard.png) | [查看](390-cloud-white-standard.png) |
| P19 · cloud-white / compact | [查看](1440-cloud-white-compact.png) | [查看](390-cloud-white-compact.png) |
| P19 · aurora-purple / standard | [查看](1440-aurora-purple-standard.png) | [查看](390-aurora-purple-standard.png) |
| P19 · aurora-purple / compact | [查看](1440-aurora-purple-compact.png) | [查看](390-aurora-purple-compact.png) |

### 补充控件与断点

- [P19 · more-open · 1440px](1440-more-open.png)
- [P19 · delete-required · 1440px](1440-delete-required.png)
- [P19 · create-invalid · 1440px](1440-create-invalid.png)
- [P19 · button-focus · 1440px](1440-button-focus.png)
- [P19 · button-hover · 1440px](1440-button-hover.png)
- [P19 · more-open · 390px](390-more-open.png)
- [P19 · delete-required · 390px](390-delete-required.png)
- [P19 · create-invalid · 390px](390-create-invalid.png)
- [P19 · button-focus · 390px](390-button-focus.png)
- [P19 · button-hover · 390px](390-button-hover.png)
- [P19 · directory · 768px](768-directory.png)
- [P20 · rules · 768px](768-rules.png)
- [P19 · directory · 1024px](1024-directory.png)
- [P20 · rules · 1024px](1024-rules.png)
