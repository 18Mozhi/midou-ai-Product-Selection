# P58 配额管理 · COMMERCIAL-C-r1

状态：C方向已选，**本页具体设计待审**。本包只交付离线可交互审核原型及完整截图，不修改生产配额、Vue、服务、数据库或支付规则。

## 设计决策

蓝色平台上下文、白色工作区。左对齐的“方案目录 / 组织配额”双任务结构，替换原长账页混排。全局方案数只在目录；组织名称、成功读取范围、观察时点、分配版本及半开统计周期紧邻用量。手机按同一事实字段展开，不压缩成仅三个数字。

颜色：导航蓝#102A63、操作蓝#1748B5、纸白#FFFFFF、背景灰#F3F6FA、正文墨蓝#17253C、警示棕#9A5800。微软雅黑/苹方中文正文16px，标题30/21px，元信息13px；热区44px。没有价格卡、等级推销、默认套餐、扣款或自动强制限额。摒弃通用等高卡片阵列，用方案额度条目、组织范围条与前后影响对照表达业务结构。

## 逐动作与字段审核

| 合同 | 新稿入口 / 状态 | 事实边界 |
| --- | --- | --- |
| CO58-LOAD/ORG | 双任务刷新、组织UUID读取/清除、失败重试 | 输入、在途请求、已读取组织分开；失败保留原范围 |
| CO58-FILTER/PAGE | 名称/code/说明搜索、三状态/全部、重置、方案20/调整10独立分页 | summary全局；原夹具1条与分页合成21/11条分开 |
| CO58-NEW/CREATE | 目录与全局空态两个入口，同一个七字段草稿窗 | code/name/description/三额度/reason；直接POST草稿，无第二确认 |
| CO58-EDIT/SAVE | 行编辑，七字段长窗，保存进入影响确认 | 不编辑code；完整字段、版本、原因；状态select保留三状态 |
| CO58-ACTIVATE/RETIRE | 草稿启用、启用退役的行快捷操作 | 入口条件不是完整服务状态机；使用组织只计active/suspended |
| CO58-ASSIGN | 组织页四字段分配/变更表单，再确认 | 当前页active方案加当前分配方案，不是远程全量搜索；datetime-local |
| CO58-SUSPEND/RESUME/END | 分配状态旁独立动作与独立确认 | active/suspended相应动作；ended不虚构恢复入口 |
| CO58-ADJUST | 五字段调整表单，再确认 | 三计量项、非零整数±10亿；可选生效/失效、原因 |
| CO58-REVOKE | active调整记录行撤销，再确认 | active不保证当前时刻有效；历史页不能求和推导全部配额 |
| 模态/技术披露 | 创建、编辑、影响确认；技术详情与源码边界说明 | 后两者是审核工具，不冒充新增业务API或第四类写入窗 |

26个原字段绑定逐一保留。当前表单编辑/分配原因minlength=2，服务trim后1–500，创建/调整前端无2字限制；差异未擅自统一。三额度0–10亿整数，创建code小写模式1–80、name≤120、description/reason≤500。服务会code小写化，不据此放宽前端约束。

首轮浏览器检查复现原code pattern的未转义连字符在HTML v模式报错；原型做等价转义，永久断言验证连字符/下划线合法、空格/大写不合法。生产源pattern未改，实施阶段仍须修复。创建在途及失败重试冻结原内容并保留原键；旧写成功不关闭或禁用新草稿窗口，仅是提案。

## 数据、影响与待实施修复

原始E2E数据从实际测试AST提取（o1/p1/a1并非合法业务UUID），单列original图。其他图为明确标注的合成数据，不冒充现有客户、业务方案或服务响应。用量按组织与周期[start,end)的全部记录COUNT；有效额由服务全部当前有效调整SUM后截零，不由可见历史页相加。

七组永久验证直接转译真实Vue函数、服务校验器与仓储read，并注入惰性请求/SQL适配器。复现：旧组织快照与新写目标混用、分页外当前方案预览缺失、未来调整提前算影响、截零反推丢失负值，以及旧成功关闭新窗口、重读错误被成功遮盖。创建/确认原本已有单飞和原幂等键保留，未错报为缺失。

待审原型分离输入/请求/快照、冻结写入内容、窗内错误、版本冲突/结果未知、旧窗口归属、写成功与刷新失败。**不是生产修复或完整Vue生命周期验收**。影响确认展示实际前值、拟变更记录/目标与原因；未来、过期、分页外或反推不可靠时不编造后值。分配和撤销的精确有效额预览仍需实现阶段算法与真实事实验证；不能把“重读后核对”当总纲预览要求已经完成。确认窗无新增原因字段。

## 验证与边界

运行 `node scripts/verify-ui-phase2-commercial-c.mjs --capture` 生成正式data/source-logic/PNG/evidence/图册；不带参数复核来源、每张PNG哈希、交互及链接。源函数仅隔离执行，没有HTTP或MySQL；GET真实服务也写读取审计，离线测试不触发该副作用。

1440×1000与390×844全场景；长模态连续滚动局部保留到底部，不以一张裁切图宣称全窗覆盖。320/759/760/761/768/1024断点、CSS 200%缩放、可见控件尺寸、模态Tab/ShiftTab/Escape和归还焦点检查。CSS缩放不是操作系统/浏览器原生缩放，未模拟手机软键盘或完整辅助技术。深色/高对比/紧凑为代表场景，不代表三主题两密度所有组合通过。

历史B2c合同表保留原哈希；相关7个历史来源逐一复核，新增E2E/模块测试来源绑定当前LF哈希。无API/config/env/schema/依赖/鉴权改动，OpenAPI与运行说明无需变更。无部署、无需重启。正式图与永久生成验证脚本为交付物，无临时服务器；浏览器在finally关闭。

## 审核入口

[打开离线交互原型](index.html)。可从底部场景选择器逐项查看。请重点审核双任务布局、手机长表单、配额前后差异表达及危险操作确认。C方向选择不等于具体稿获批；P58真实Vue/API、最小权限、SQL审计/幂等、生命周期、完整影响算法与全站73页部署签收仍待办。下一设计P59安全中心。

<!-- GALLERY:START -->
正式PNG：192张；81场景。

| 场景 | 桌面1440 | 手机390 |
| --- | --- | --- |
| 方案目录 / 三状态合成 (default) | [主图](1440-default.png) | [主图](390-default.png) |
| 原始E2E夹具 / 不当真实运营数据 (original) | [主图](1440-original.png) | [主图](390-original.png) |
| 组织用量 / 已读取范围 (organization) | [主图](1440-organization.png) | [主图](390-organization.png) |
| 组织尚未分配 (unassigned) | [主图](1440-unassigned.png) | [主图](390-unassigned.png) |
| 组织分配已暂停 (suspended) | [主图](1440-suspended.png) | [主图](390-suspended.png) |
| 组织分配已结束 (ended) | [主图](1440-ended.png) | [主图](390-ended.png) |
| 组织编号输入 (lookup) | [主图](1440-lookup.png) | [主图](390-lookup.png) |
| 组织编号格式错误 (lookup-invalid) | [主图](1440-lookup-invalid.png) | [主图](390-lookup-invalid.png) |
| 组织读取中 / 保留旧范围 (lookup-pending) | [主图](1440-lookup-pending.png) | [主图](390-lookup-pending.png) |
| 组织读取失败 / 保留旧范围 (lookup-error) | [主图](1440-lookup-error.png) | [主图](390-lookup-error.png) |
| 清除组织返回目录 (clear-organization) | [主图](1440-clear-organization.png) | [主图](390-clear-organization.png) |
| 筛选输入未提交 (filter-draft) | [主图](1440-filter-draft.png) | [主图](390-filter-draft.png) |
| 筛选已启用 (filter-active) | [主图](1440-filter-active.png) | [主图](390-filter-active.png) |
| 筛选已退役 (filter-retired) | [主图](1440-filter-retired.png) | [主图](390-filter-retired.png) |
| 筛选无匹配 (filter-empty) | [主图](1440-filter-empty.png) | [主图](390-filter-empty.png) |
| 筛选读取中 (filter-pending) | [主图](1440-filter-pending.png) | [主图](390-filter-pending.png) |
| 筛选失败保留旧条件 (filter-error) | [主图](1440-filter-error.png) | [主图](390-filter-error.png) |
| 全局没有方案 (empty) | [主图](1440-empty.png) | [主图](390-empty.png) |
| 首次读取中 (loading) | [主图](1440-loading.png) | [主图](390-loading.png) |
| 首次读取错误含401/403 (error) | [主图](1440-error.png) | [主图](390-error.png) |
| 请求过于频繁 (rate-limited) | [主图](1440-rate-limited.png) | [主图](390-rate-limited.png) |
| 依赖受阻 (blocked) | [主图](1440-blocked.png) | [主图](390-blocked.png) |
| 首次超时无旧快照 (timeout) | [主图](1440-timeout.png) | [主图](390-timeout.png) |
| 方案分页 / 首20条 (page-first) | [主图](1440-page-first.png) | [主图](390-page-first.png) |
| 方案分页 / 末页 (page-last) | [主图](1440-page-last.png) | [主图](390-page-last.png) |
| 调整历史 / 首10条 (adjustment-first) | [主图](1440-adjustment-first.png) | [主图](390-adjustment-first.png) |
| 调整历史 / 末页 (adjustment-last) | [主图](1440-adjustment-last.png) | [主图](390-adjustment-last.png) |
| 无调整记录 (adjustment-empty) | [主图](1440-adjustment-empty.png) | [主图](390-adjustment-empty.png) |
| 记录状态与时间生效不同 (adjustment-timing) | [主图](1440-adjustment-timing.png) | [主图](390-adjustment-timing.png) |
| 零有效配额 / 不反推调整 (quota-zero) | [主图](1440-quota-zero.png) | [主图](390-quota-zero.png) |
| 已用超过有效配额 (quota-over) | [主图](1440-quota-over.png) | [主图](390-quota-over.png) |
| 当前页无启用可选方案 (no-selectable) | [主图](1440-no-selectable.png) | [主图](390-no-selectable.png) |
| 当前方案在分页外 (current-off-page) | [主图](1440-current-off-page.png) | [主图](390-current-off-page.png) |
| 四字段分配表单 (assignment-form) | [主图](1440-assignment-form.png) | [主图](390-assignment-form.png) |
| 分配日期与原因错误 (assignment-invalid) | [主图](1440-assignment-invalid.png) | [主图](390-assignment-invalid.png) |
| 五字段人工调整 (adjustment-form) | [主图](1440-adjustment-form.png) | [主图](390-adjustment-form.png) |
| 调整量为零 (adjustment-zero) | [主图](1440-adjustment-zero.png) | [主图](390-adjustment-zero.png) |
| 失效早于生效 (adjustment-invalid-time) | [主图](1440-adjustment-invalid-time.png) | [主图](390-adjustment-invalid-time.png) |
| 七字段创建草稿 (create) | [主图](1440-create.png) | [主图](390-create.png) · [局部1](390-create-part1.png) |
| 创建字段错误 (create-invalid) | [主图](1440-create-invalid.png) | [主图](390-create-invalid.png) · [局部1](390-create-invalid-part1.png) |
| 配额下界0 (create-min) | [主图](1440-create-min.png) | [主图](390-create-min.png) · [局部1](390-create-min-part1.png) |
| 配额上界10亿 / 原因500字 (create-max) | [主图](1440-create-max.png) | [主图](390-create-max.png) · [局部1](390-create-max-part1.png) |
| 创建中 / 可关闭不等于取消 (create-saving) | [主图](1440-create-saving.png) | [主图](390-create-saving.png) · [局部1](390-create-saving-part1.png) |
| 创建失败 / 窗内可达 (create-error) | [主图](1440-create-error.png) | [主图](390-create-error.png) · [局部1](390-create-error-part1.png) |
| 七字段编辑启用方案 (edit-active) | [主图](1440-edit-active.png) | [主图](390-edit-active.png) · [局部1](390-edit-active-part1.png) |
| 编辑草稿方案 (edit-draft) | [主图](1440-edit-draft.png) | [主图](390-edit-draft.png) · [局部1](390-edit-draft-part1.png) |
| 编辑退役方案 (edit-retired) | [主图](1440-edit-retired.png) | [主图](390-edit-retired.png) · [局部1](390-edit-retired-part1.png) |
| 编辑原因单字符差异 (edit-invalid) | [主图](1440-edit-invalid.png) · [局部1](1440-edit-invalid-part1.png) | [主图](390-edit-invalid.png) · [局部1](390-edit-invalid-part1.png) |
| 保存方案 / 影响前后 (confirm-save) | [主图](1440-confirm-save.png) | [主图](390-confirm-save.png) · [局部1](390-confirm-save-part1.png) |
| 启用方案确认 (confirm-activate) | [主图](1440-confirm-activate.png) | [主图](390-confirm-activate.png) · [局部1](390-confirm-activate-part1.png) |
| 退役方案确认 (confirm-retire) | [主图](1440-confirm-retire.png) | [主图](390-confirm-retire.png) · [局部1](390-confirm-retire-part1.png) |
| 首次分配确认 (confirm-assign) | [主图](1440-confirm-assign.png) · [局部1](1440-confirm-assign-part1.png) | [主图](390-confirm-assign.png) · [局部1](390-confirm-assign-part1.png) |
| 变更分配 / 新周期不猜用量 (confirm-renew) | [主图](1440-confirm-renew.png) · [局部1](1440-confirm-renew-part1.png) | [主图](390-confirm-renew.png) · [局部1](390-confirm-renew-part1.png) |
| 暂停组织确认 (confirm-suspend) | [主图](1440-confirm-suspend.png) | [主图](390-confirm-suspend.png) |
| 恢复组织确认 (confirm-resume) | [主图](1440-confirm-resume.png) | [主图](390-confirm-resume.png) |
| 结束组织确认 (confirm-end) | [主图](1440-confirm-end.png) | [主图](390-confirm-end.png) |
| 增加当前配额确认 (confirm-adjust) | [主图](1440-confirm-adjust.png) | [主图](390-confirm-adjust.png) · [局部1](390-confirm-adjust-part1.png) |
| 减少配额 / 截零提示 (confirm-adjust-negative) | [主图](1440-confirm-adjust-negative.png) | [主图](390-confirm-adjust-negative.png) · [局部1](390-confirm-adjust-negative-part1.png) |
| 未来调整 / 不提前算当前配额 (confirm-adjust-future) | [主图](1440-confirm-adjust-future.png) | [主图](390-confirm-adjust-future.png) · [局部1](390-confirm-adjust-future-part1.png) |
| 已过期调整 / 预览限制 (confirm-adjust-expired) | [主图](1440-confirm-adjust-expired.png) | [主图](390-confirm-adjust-expired.png) · [局部1](390-confirm-adjust-expired-part1.png) |
| 撤销记录确认 (confirm-revoke) | [主图](1440-confirm-revoke.png) | [主图](390-confirm-revoke.png) |
| 撤销未来记录 / 不减当前配额 (confirm-revoke-future) | [主图](1440-confirm-revoke-future.png) | [主图](390-confirm-revoke-future.png) |
| 分页外目标 / 不编造影响值 (confirm-off-page) | [主图](1440-confirm-off-page.png) · [局部1](1440-confirm-off-page-part1.png) | [主图](390-confirm-off-page.png) · [局部1](390-confirm-off-page-part1.png) |
| 执行中冻结内容 (confirm-saving) | [主图](1440-confirm-saving.png) | [主图](390-confirm-saving.png) · [局部1](390-confirm-saving-part1.png) |
| 版本冲突 / 需重新核对 (confirm-conflict) | [主图](1440-confirm-conflict.png) | [主图](390-confirm-conflict.png) · [局部1](390-confirm-conflict-part1.png) |
| 执行失败 / 原操作重试 (confirm-error) | [主图](1440-confirm-error.png) | [主图](390-confirm-error.png) · [局部1](390-confirm-error-part1.png) |
| 写入结果未确认 (confirm-unknown) | [主图](1440-confirm-unknown.png) | [主图](390-confirm-unknown.png) · [局部1](390-confirm-unknown-part1.png) |
| 模拟写成功并重读 (write-success) | [主图](1440-write-success.png) | [主图](390-write-success.png) |
| 写成功但刷新失败 (success-refresh-error) | [主图](1440-success-refresh-error.png) | [主图](390-success-refresh-error.png) |
| 关闭窗口不撤销已发事务 (closed-pending) | [主图](1440-closed-pending.png) | [主图](390-closed-pending.png) |
| 旧响应不关闭新窗口（提案） (new-dialog-old-result) | [主图](1440-new-dialog-old-result.png) | [主图](390-new-dialog-old-result.png) · [局部1](390-new-dialog-old-result-part1.png) |
| 请求与标识披露 (technical) | [主图](1440-technical.png) | [主图](390-technical.png) |
| 实际源码问题与待审保护 (source-boundary) | [主图](1440-source-boundary.png) | [主图](390-source-boundary.png) · [局部1](390-source-boundary-part1.png) |
| 取消未发送确认 (cancelled) | [主图](1440-cancelled.png) | [主图](390-cancelled.png) |
| 按钮键盘焦点 (focus) | [主图](1440-focus.png) | [主图](390-focus.png) |
| 按钮悬停 (hover) | [主图](1440-hover.png) | [主图](390-hover.png) |
| 按钮按下 (pressed) | [主图](1440-pressed.png) | [主图](390-pressed.png) |
| 读取中按钮禁用 (disabled) | [主图](1440-disabled.png) | [主图](390-disabled.png) |
| 深色审核 (dark) | [主图](1440-dark.png) | [主图](390-dark.png) |
| 高对比审核 (contrast) | [主图](1440-contrast.png) | [主图](390-contrast.png) |
| 紧凑密度审核 (compact) | [主图](1440-compact.png) | [主图](390-compact.png) |
<!-- GALLERY:END -->
