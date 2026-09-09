# 全站动作与弹窗覆盖对账

基线8e54f6d8；机器对账加人工源语义映射，不替代用户审核。

- 当前源候选1478；旧登记1477；新身份16，旧表独有身份15。签名变化不等于增删业务能力。
- 已具体语义对应2页/64源位置/32组；其中路由动作31组，其余明确排除。其余71页未完成此级映射，不称没有图或没有测试。
- 原覆盖门与用户批准保持；静态合同已有引用，不表示六态或全弹窗已验收。

## 逐页缺口

| 页 | 旧静态关联候选（非运行分母） | 语义审阅 | 下一步 |
| --- | --- | --- | --- |
| [P01 正在进入](page-specs/P01.md) | 3 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P02 登录](page-specs/P02.md) | 18 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P03 注册](page-specs/P03.md) | 18 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P04 找回密码](page-specs/P04.md) | 18 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P05 验证邮箱](page-specs/P05.md) | 18 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P06 重置密码](page-specs/P06.md) | 18 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P07 安全设置](page-specs/P07.md) | 18 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P08 选择组织与工作区](page-specs/P08.md) | 13 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P09 快速引导](page-specs/P09.md) | 6 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P10 外观偏好](page-specs/P10.md) | 11 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P11 个人中心](page-specs/P11.md) | 20 | [15组](action-reviews/P11.json) | 0个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P12 今日行动](page-specs/P12.md) | 56 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P13 今日工作](page-specs/P13.md) | 111 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P14 热点趋势](page-specs/P14.md) | 107 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P15 选品机会](page-specs/P15.md) | 158 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P16 创建选品](page-specs/P16.md) | 46 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P17 评分规则](page-specs/P17.md) | 64 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P18 机会详情](page-specs/P18.md) | 158 | 未逐项映射 | 优先核对分段组合及每个动作/弹窗 |
| [P19 竞品监控](page-specs/P19.md) | 75 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P20 竞品监控规则](page-specs/P20.md) | 75 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P21 供应链与利润](page-specs/P21.md) | 90 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P22 费用与利润规则](page-specs/P22.md) | 66 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P23 全部任务](page-specs/P23.md) | 111 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P24 任务详情](page-specs/P24.md) | 111 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P25 审批中心](page-specs/P25.md) | 78 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P26 通知中心](page-specs/P26.md) | 59 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P27 自动化规则](page-specs/P27.md) | 55 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P28 报表与导出](page-specs/P28.md) | 50 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P29 治理概览](page-specs/P29.md) | 167 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P30 成员与邀请](page-specs/P30.md) | 167 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P31 角色与权限](page-specs/P31.md) | 167 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P32 工作区管理](page-specs/P32.md) | 167 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P33 团队管理](page-specs/P33.md) | 167 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P34 审批模板](page-specs/P34.md) | 167 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P35 组织数据](page-specs/P35.md) | 167 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P36 组织令牌](page-specs/P36.md) | 167 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P37 组织审计](page-specs/P37.md) | 167 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P38 平台概览](page-specs/P38.md) | 66 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P39 账号与组织](page-specs/P39.md) | 142 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P40 组织管理](page-specs/P40.md) | 142 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P41 创建组织](page-specs/P41.md) | 142 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P42 组织详情](page-specs/P42.md) | 142 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P43 用户管理](page-specs/P43.md) | 142 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P44 管理员管理](page-specs/P44.md) | 142 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P45 角色权限](page-specs/P45.md) | 142 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P46 来源设置](page-specs/P46.md) | 181 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P47 采集程序](page-specs/P47.md) | 181 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P48 热点来源](page-specs/P48.md) | 181 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P49 1688 启用检查](page-specs/P49.md) | 181 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P50 凭证与档案](page-specs/P50.md) | 181 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P51 采集任务](page-specs/P51.md) | 123 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P52 采集总览](page-specs/P52.md) | 123 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P53 网页登录采集](page-specs/P53.md) | 123 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P54 数据中心](page-specs/P54.md) | 104 | [17组](action-reviews/P54.json) | 102个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P55 质量与规则](page-specs/P55.md) | 71 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P56 内容管理](page-specs/P56.md) | 116 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P57 通知管理](page-specs/P57.md) | 116 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P58 配额管理](page-specs/P58.md) | 79 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P59 安全中心](page-specs/P59.md) | 75 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P60 开放平台](page-specs/P60.md) | 87 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P61 系统状态](page-specs/P61.md) | 116 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P62 链路日志](page-specs/P62.md) | 72 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P63 接口覆盖证据](page-specs/P63.md) | 116 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P64 备份与恢复](page-specs/P64.md) | 53 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P65 发布管理](page-specs/P65.md) | 54 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P66 服务拓扑](page-specs/P66.md) | 49 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P67 Redis 运行](page-specs/P67.md) | 42 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P68 MySQL 运行](page-specs/P68.md) | 42 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P69 文件存储](page-specs/P69.md) | 42 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P70 采集调度](page-specs/P70.md) | 59 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P71 容量边界](page-specs/P71.md) | 50 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P72 界面状态](page-specs/P72.md) | 13 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P73 页面不存在](page-specs/P73.md) | 3 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |

## P11具体结论

AccountShell与PersonalCenter的20个源位置对应15组已有合同ID：14组P11可用语义动作，1组旧局部Tab由accountShell=true排除；含4类写入，表单/按钮不重复计数。五个分区链接保留独立变体，不改路由数。两源没有弹窗，不能为填数量增加确认框。

P11新增personal-composed-direction-c连续五分区提案、资料保存忙碌稿及204张双端图。14组代表控件适用六态均与具体selector/scene绑定；通用样本板不抵扣业务验收。0个未映射代表槽不等于全变体/输入/真实history或写入通过；P18/P54连续稿已交但不等于全语义完成，下一核P18源语义与P54下列缺口，未获具体稿批准前不替换生产Vue。

## 使用与证据

- `node scripts/audit-ui-phase2-action-coverage.mjs`只读复验；`--write`只生成本报告和[action-coverage-audit.json](action-coverage-audit.json)。
- 输入沿用历史[actions](actions.json)、[dialogs](dialogs.json)及当前合同扫描；人工映射在action-reviews/Pxx.json，沿用合同actionId，不设竞争编号。
- [P11映射](action-reviews/P11.json)逐项列原源ID、条件、handler、变体、双端场景与原型验证器、未覆盖项。存在引用不等于测试已通过；当次运行结果见[PROGRESS](PROGRESS.md)。
- 来源漂移、未知候选、漏项/重复映射、无合同ID、缺图/视口、假批准均失败关闭。全局HTML/图像哈希用既有`audit-ui-phase2-design-delivery.mjs`单独复核，不把此处场景存在检查当图片正确性。
- 不改变API/OpenAPI/配置/依赖/数据库/生产，无重启要求；两个报告和验证器为永久交付物，无一次性临时产物。

## P54 局部动作与共享消费者

[逐项机器清单](action-reviews/P54.json)：44个局部源位置 → 17组；4类写入，其余含读取、导航、本地展示/选择。7个本地v-model，9处调用/内嵌容器，14个明确变体。此处不是全页共享源的去重分母；原静态导入关联数不与本数相减当缺失按钮。

原六态仍保守未映射，须判断适用性并绑定逐动作selector/state；有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| DG54-VIEW 切换近期记录与证据质量 / navigation | 2处；records、quality | [records:default](design/data-composed-direction-c/gallery.html)、[quality:default](design/data-composed-direction-c/gallery.html)；其余见JSON | 原质量区卸载；常驻提案改变切区状态策略。初始深链、history、KeepAlive未验证。 |
| DG54-ENTITY 选择四类近期数据 / read | 1处；trends、opportunities、competitors、suppliers | [records:trends](design/data-composed-direction-c/gallery.html)、[records:opportunities](design/data-composed-direction-c/gallery.html)；其余见JSON | 查询草稿保留与状态清空需跨四类逐项验证；旧快照不改变业务范围，导出等待仍可能漂移。 |
| DG54-FILTER 应用或重置近期筛选 / read | 5处；drawer-open、drawer-close、form-submit、enter、apply、reset | [records:filter](design/data-composed-direction-c/gallery.html)、[records:query-draft](design/data-composed-direction-c/gallery.html)；其余见JSON | 原生提交与Enter、抽屉submit.capture顺序、SQL LIKE和供应商字段范围尚非实际链验收。 |
| DG54-EXPORT 受控CSV导出 / write | 4处；open、ask、submit、cancel、download | [records:export](design/data-composed-direction-c/gallery.html)、[records:export-empty](design/data-composed-direction-c/gallery.html)；其余见JSON | 真实客户端原因无最大长度；服务器2–300。请求与文件名使用可变entity；新稿固定条件/未知防重只是提案，未证真实CSV/审计/重复幂等。 |
| DG54-LOAD 读取与状态重试 / read | 1处；first、empty、error、expired、forbidden、blocked、retry、timeout | [records:loading](design/data-composed-direction-c/gallery.html)、[records:empty](design/data-composed-direction-c/gallery.html)；其余见JSON | 15秒abort非完整生命周期代次保护；失败保留仅有旧行时，不把空数据旧状态一概称快照保留。 |
| DG54-TECH 展开记录技术标识 / local | 2处；desktop-row、mobile-detail | [records:detail](design/data-composed-direction-c/gallery.html)、[records:long-detail](design/data-composed-direction-c/gallery.html)；其余见JSON | 这是行ID展开，不是页尾TechnicalDetails复制；所有类型/长ID状态与共享复制消费者另验。 |
| DG54-PAGE 近期记录本地分页 / read | 2处；previous、next、first、last | [records:page-21](design/data-composed-direction-c/gallery.html)、[records:page-two](design/data-composed-direction-c/gallery.html)；其余见JSON | 同一原型场景图不证明真实浏览器history/滚动/每种实体分页。 |
| Q54-LOAD 质量状态恢复读取 / read | 1处；loading、empty、error、forbidden、expired、blocked、primary | [quality:loading](design/data-composed-direction-c/gallery.html)、[quality:empty](design/data-composed-direction-c/gallery.html)；其余见JSON | 原ready模板没有独立刷新按钮；稿中刷新/清搜索按钮属于待审新增呈现。实际状态组件primary可达性与权限未验。 |
| Q54-TAB 切换证据问题核对 / read | 3处；evidence、issues、runs | [quality:default](design/data-composed-direction-c/gallery.html)、[quality:issues](design/data-composed-direction-c/gallery.html)；其余见JSON | 真实switchTab不清query/selectedRunId；离线稿会清，需审核差异，不当作同语义实现。 |
| Q54-EVIDENCE 读取或关闭完整证据溯源 / read | 5处；evidence-desktop、evidence-mobile、issue-desktop、issue-mobile、close | [quality:lineage](design/data-composed-direction-c/gallery.html)、[quality:lineage-loading](design/data-composed-direction-c/gallery.html)；其余见JSON | 真实结果落aside无代次；稿改为模态并展示quality_issues，不证明真实迟到详情隔离/授权。 |
| Q54-DOWNLOAD 签发并访问原文下载 / write | 2处；desktop、mobile、grant、access | [quality:download-ready](design/data-composed-direction-c/gallery.html)、[quality:download-busy](design/data-composed-direction-c/gallery.html)；其余见JSON | 原入口无确认窗；稿新增说明/签发窗。签发与实际下载错误不能混为同回执，未验证真实字节、SHA、授权或访问审计。 |
| Q54-TECH 展开证据或问题技术标识 / local | 2处；evidence-mobile、issue-mobile | [quality:lineage-technical](design/data-composed-direction-c/gallery.html)、[quality:issue-technical](design/data-composed-direction-c/gallery.html)；其余见JSON | 新完整溯源技术区不是两个原移动详情展开消费者的逐项证据；不能以复制按钮替代summary验收。 |
| Q54-RUN 当前加载问题的核对下钻 / local | 2处；drill、clear、matched、empty | [quality:run-match](design/data-composed-direction-c/gallery.html)、[quality:run-empty](design/data-composed-direction-c/gallery.html)；其余见JSON | 不查全库异常，跨页缺问题不能伪称没有异常；切内部tab后原runId仍保留。 |
| Q54-BATCH 开放问题批处理预检与提交 / write | 3处；attribute、assign、close、preview、cancel、confirm | [quality:batch-attribute](design/data-composed-direction-c/gallery.html)、[quality:batch-assign](design/data-composed-direction-c/gallery.html)；其余见JSON | 源预检没校验50上限；提交读可变选择/动作/成员/原因，无冻结快照。原ConfirmDialog不接busy；整批SQL/版本/幂等和原型锁定不可混同。 |
| Q54-SELECT 切换开放问题选择 / local | 1处；select、deselect、disabled-closed、hidden-selected | [quality:issues](design/data-composed-direction-c/gallery.html)、[quality:selection-hidden](design/data-composed-direction-c/gallery.html)；其余见JSON | 真实手机无checkbox；原型新增手机选择/清选择。checkbox在源可重复push，同组ID与批量后端去重不是一回事。 |
| Q54-RESOLVE 单问题原因与解决确认 / write | 6处；desktop-open、mobile-open、aside-close、preview、cancel、confirm | [quality:resolve-empty](design/data-composed-direction-c/gallery.html)、[quality:resolve-short](design/data-composed-direction-c/gallery.html)；其余见JSON | 写成功后load吞错再覆盖notice；原confirm短语trim比较，稿用严格全等。取消返回/重复提交/闭窗归属与真实审计仍待验。 |
| Q54-PAGE 证据与问题共享服务端页码 / read | 2处；previous、next、first、last、waiting、failed | [quality:page-first](design/data-composed-direction-c/gallery.html)、[quality:page-last](design/data-composed-direction-c/gallery.html)；其余见JSON | 原翻页失败保留数据但page已变；提案保留已成功页，不能当作源实现已修复。 |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| PlatformDataCenter.vue / queryDraft | 近期查询草稿；apply时trim后才成为query | 120字符边界/Enter/提交与SQL LIKE、供应商字段差异需真实链验证。 |
| PlatformDataCenter.vue / statusDraft | 随entity状态集选择；apply提交，类型切换清空 | 四类型13状态组合与失败旧快照要分开，不按新类型解释旧行。 |
| DataQualityCenter.vue / query | 质量当前已加载集合本地检索，不trim，不提交GET | 原内部切tab不清query；原型会清，存在行为差异。 |
| DataQualityCenter.vue / batchAction | attribute/assign/close；不同动作决定成员字段适用性 | 预览后改变动作可漂移；源未冻结，三个操作不以一个确认图全验。 |
| DataQualityCenter.vue / batchAssignee | 仅assign显示，候选来自所选问题组织活动成员 | 原预览到提交仍可变，不能编造实际组织成员。 |
| DataQualityCenter.vue / batchReason | 批量原因，maxlength500，预检trim>=2 | 原型模态改版，0/1/2/500/超限和长内容/软键盘仍需完整状态映射。 |
| DataQualityCenter.vue / reason | 单问题原因，maxlength500；每次beginResolve清空 | 字段与共享AuditedReasonDialog同名但范围不同，不能混用2–300限制。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| PlatformDataCenter.vue / ResponsiveFilterDrawer.1 / records-filter | responsive-filter / matching-dialog-scene | [records:filter](design/data-composed-direction-c/gallery.html) | 原生submit/Enter关闭与返焦、所有错误/主题需每消费者验证。 |
| PlatformDataCenter.vue / ResponsiveDataView.1 / trends | responsive-row-detail / matching-dialog-scene | [records:detail](design/data-composed-direction-c/gallery.html) | 仅原始热点示例详情，不代表所有状态行。 |
| PlatformDataCenter.vue / ResponsiveDataView.1 / opportunities | responsive-row-detail / related-scene-only | [records:opportunities](design/data-composed-direction-c/gallery.html) | 有列表图，但该实体完整详情/全部字段打开图尚未显式关联。 |
| PlatformDataCenter.vue / ResponsiveDataView.1 / competitors | responsive-row-detail / related-scene-only | [records:competitors](design/data-composed-direction-c/gallery.html) | 有列表图，非打开竞品记录详情证明。 |
| PlatformDataCenter.vue / ResponsiveDataView.1 / suppliers | responsive-row-detail / related-scene-only | [records:original-supplier](design/data-composed-direction-c/gallery.html) | 有原供应记录列表，供应商/地点完整详情需单独出图映射。 |
| PlatformDataCenter.vue / AuditedReasonDialog.1 / export-reason | native-reason-dialog / matching-dialog-scene | [records:export](design/data-composed-direction-c/gallery.html) | 原型是新固定范围表单，真实源请求/文件名竞态未修。 |
| DataQualityCenter.vue / ResponsiveDataView.1 / evidence-row | responsive-row-detail / matching-dialog-scene | [quality:evidence-detail](design/data-composed-direction-c/gallery.html) | 完整记录稿已存在；真实shared.show/close及完整溯源交接待Vue验收。 |
| DataQualityCenter.vue / ResponsiveDataView.2 / issue-row | responsive-row-detail / matching-dialog-scene | [quality:issue-detail](design/data-composed-direction-c/gallery.html) | 新稿移动选择为新增，原组件及所有已解决/缺证据组合仍待验。 |
| DataQualityCenter.vue / aside.1 / evidence-lineage | inline-aside / proposal-shape-differs | [quality:lineage](design/data-composed-direction-c/gallery.html) | 提案改为模态且展示关联问题；原aside无代次/初焦点，不能等价接受。 |
| DataQualityCenter.vue / aside.2 / single-reason | inline-aside / proposal-shape-differs | [quality:resolve-valid](design/data-composed-direction-c/gallery.html) | 提案改为独立原因模态；源aside关闭、原因保留规则与并发需确认。 |
| DataQualityCenter.vue / ConfirmDialog.1 / single-confirm | confirmation-dialog / matching-dialog-scene | [quality:resolve-confirm](design/data-composed-direction-c/gallery.html) | 源canConfirm会trim，原型严格等于；原组件取消/重复确认与源POST待验。 |
| DataQualityCenter.vue / ConfirmDialog.2 / attribute-confirm | confirmation-dialog / matching-dialog-scene | [quality:batch-confirm](design/data-composed-direction-c/gallery.html) | 源使用可变选择/原因；后端全有或全无需真实SQL证据。 |
| DataQualityCenter.vue / ConfirmDialog.2 / assign-confirm | confirmation-dialog / matching-dialog-scene | [quality:batch-assign-confirm](design/data-composed-direction-c/gallery.html) | 成员为合成示例；真实组织/活动状态/版本并发未验。 |
| DataQualityCenter.vue / ConfirmDialog.2 / close-confirm | confirmation-dialog / matching-dialog-scene | [quality:batch-close-confirm](design/data-composed-direction-c/gallery.html) | 只变问题不删原文；原POST/审计/短语trim与并发未验。 |

### 明确保留的边界

- 同页常驻组合已交294PNG；实际质量v-if卸载、浏览器history/深链、scope/晚到响应未合并真实Vue。
- 17组源动作已有场景关联，但未提供全部action-specific selector/state证据；102个六态槽保守未映射，不意味着没有截图。
- 实体完整详情三变体仅关联列表；Q54源tab保留query/runId与原型清空、短语trim与原型严格全等的差异须具体审核。
- 原质量无ready刷新/清搜索/清选择、无手机checkbox；原型额外入口仍是待审行为，不新增现行源合同ID。
- PlatformShell及UiStatePanel内部控件、表格列显隐/冻结/密度、TechnicalDetails复制必须按调用方再映射；不在44个局部源位置内。
- ConfirmDialog共享typedText适用，acknowledged因本页destructive=false不显示；AuditedReasonDialog内部reason与质量reason分域；TableViewControls密度字段未冒充本页7个v-model。
- ResponsiveDataView的三个调用/六种内容变体不能拿一个shared测试全验；同类动态行、空字段与主题密度交叉场景还未穷尽。
