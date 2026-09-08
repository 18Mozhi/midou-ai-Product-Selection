# P55 · GOVERNANCE-C-r1 治理版本目录

具体稿待审：[交互原型](index.html)。C蓝色分类目录显示全局计数，白色记录区突出版本、组织归属及原模块入口。手机补齐自动化触发、动作及频控信息。没有本页保存、启停、审批或发布。正式截图与生成/验证源码是交付物，不是临时文件。

## 事实边界

- UI2-DG55 原评分/自动化夹具由 AST 提取，只有两种记录和三个摘要键。其他三类、状态、完整自动化字段、长文本及20/21分页均标记合成，不套用原评分夹具冒充其他类型。
- 六种全量COUNT与当前列表筛选总数独立。缺少摘要值显示破折号；来源配置历史是关联入口，不是第六种可编辑列表。无综合质量分。
- 评分/费用用revision；审批优先current_version；自动化用version；发布用app_version映射的name。原始API字段、状态和链接不变。自动化零频控在源模板被truthy条件隐藏，原型明确此显示边界，不推断不限频率。
- 搜索是服务端分类字段查询，输入120字；状态选项依实际Vue枚举；每页20、服务器收束页码。顶部入口跟目标分类，行及详情入口跟成功快照分类。只有自动化行附rule/action=edit，其他分类不附规则或租户参数。
- 工作台按钮只打开审核说明并显示精确原路径，不真的导航、不更换组织。说明不是生产业务弹窗；正确路径不是原模块授权/写入成功证据。
- 源脚本隔离执行验证五分类25种状态组合、版本/链接、保留快照、首次/保留失败、15秒单飞、URL页码。权限失败仍保留旧快照、忽略abort的晚响应仍更新引用已复现，未修改生产行为，不称真实生命周期或RBAC验收通过。
- 实际service参数验证及repository治理分支经惰性适配器验证五分类×0/1/20/21/100总量、全量/筛选计数、LIKE转义与纠正offset；不运行SQL。原夹具没有组织名时仍沿源“平台全局”回退，不能据此证明真实组织归属。
- 重排目录、详情字段手机等价、原生模态焦点与草稿解释为待审提案。深色/高对比仅草案；CSS zoom2不是原生浏览器缩放，未完成全部主题密度/读屏/软键盘/KeepAlive/历史导航或跨组织编辑回跳验收。

## 审核顺序

先比较五分类目录与详情，再查看筛选、旧范围保留、来源历史及精确跳转说明。请确认这套版本目录的布局和手机详情是否通过；C方向选择不等于本具体稿批准。

复验：`node scripts/verify-ui-phase2-governance-c.mjs`；加 `--capture` 重新生成正式图。沿用25源合同与ff46bfe9既有焦点测试的前后hash追溯，不改历史表。实际SQL、服务权限与目标工作台未运行，本原型HTTP/存储/业务写入为零，浏览器finally关闭。无配置、依赖或生产修改，无部署及重启。

<!-- GALLERY:START -->
正式PNG：179张；84场景。

| 场景 | 桌面1440 | 手机390 |
| --- | --- | --- |
| 原始评分记录 (default) | [主图](1440-default.png) | [主图](390-default.png) |
| 原始自动化记录 (automation) | [主图](1440-automation.png) | [主图](390-automation.png) |
| 首次读取 (loading) | [主图](1440-loading.png) | [主图](390-loading.png) |
| 首次过期 (expired) | [主图](1440-expired.png) | [主图](390-expired.png) |
| 首次无权限 (forbidden) | [主图](1440-forbidden.png) | [主图](390-forbidden.png) |
| 首次受阻 (blocked) | [主图](1440-blocked.png) | [主图](390-blocked.png) |
| 首次错误 (error) | [主图](1440-error.png) | [主图](390-error.png) |
| 目标切换 / 原快照保留 (pending) | [主图](1440-pending.png) | [主图](390-pending.png) |
| 目标失败 / 原快照保留 (failed) | [主图](1440-failed.png) | [主图](390-failed.png) |
| 重试成功 (recovered) | [主图](1440-recovered.png) | [主图](390-recovered.png) |
| 刷新超时 (timeout) | [主图](1440-timeout.png) | [主图](390-timeout.png) |
| 权限错误保留快照 / 源边界 (retained-forbidden) | [主图](1440-retained-forbidden.png) | [主图](390-retained-forbidden.png) |
| 筛选草稿 (filter-draft) | [主图](1440-filter-draft.png) | [主图](390-filter-draft.png) |
| 已应用筛选 (filter-applied) | [主图](1440-filter-applied.png) | [主图](390-filter-applied.png) |
| 列与密度设置 (settings) | [主图](1440-settings.png) | [主图](390-settings.png) |
| 紧凑记录 (compact) | [主图](1440-compact.png) | [主图](390-compact.png) |
| 深色草案 (dark) | [主图](1440-dark.png) | [主图](390-dark.png) |
| 高对比草案 (contrast) | [主图](1440-contrast.png) | [主图](390-contrast.png) |
| 合成20/21分页 (page-first) | [主图](1440-page-first.png) | [主图](390-page-first.png) |
| 合成末页1/21 (page-last) | [主图](1440-page-last.png) | [主图](390-page-last.png) |
| 翻页中原页保留 (page-pending) | [主图](1440-page-pending.png) | [主图](390-page-pending.png) |
| 翻页失败原页保留 (page-failed) | [主图](1440-page-failed.png) | [主图](390-page-failed.png) |
| 长名称、组织与构建标识 (long-detail) | [主图](1440-long-detail.png) · [局部1](1440-long-detail-part1.png) | [主图](390-long-detail.png) · [局部1](390-long-detail-part1.png) · [局部2](390-long-detail-part2.png) |
| 自动化零频控 / 原显示边界 (automation-zero) | [主图](1440-automation-zero.png) | [主图](390-automation-zero.png) · [局部1](390-automation-zero-part1.png) |
| 来源版本入口 / 审核说明 (provider-route) | [主图](1440-provider-route.png) | [主图](390-provider-route.png) |
| 请求编号复制失败模拟 (copy-failed) | [主图](1440-copy-failed.png) | [主图](390-copy-failed.png) |
| 按钮悬停 (hover) | [主图](1440-hover.png) | [主图](390-hover.png) |
| 键盘焦点 (focus) | [主图](1440-focus.png) | [主图](390-focus.png) |
| 按钮按下 (pressed) | [主图](1440-pressed.png) | [主图](390-pressed.png) |
| 评分规则 / 目录 (score_rules-list) | [主图](1440-score_rules-list.png) | [主图](390-score_rules-list.png) |
| 评分规则 / 详情 (score_rules-detail) | [主图](1440-score_rules-detail.png) | [主图](390-score_rules-detail.png) |
| 评分规则 / 技术展开 (score_rules-technical) | [主图](1440-score_rules-technical.png) | [主图](390-score_rules-technical.png) · [局部1](390-score_rules-technical-part1.png) |
| 评分规则 / 筛选为空 (score_rules-empty) | [主图](1440-score_rules-empty.png) | [主图](390-score_rules-empty.png) |
| 评分规则 / 状态选项 (score_rules-filter) | [主图](1440-score_rules-filter.png) | [主图](390-score_rules-filter.png) |
| 评分规则 / 精确工作台入口 (score_rules-route) | [主图](1440-score_rules-route.png) | [主图](390-score_rules-route.png) |
| 评分规则 / 草稿 (score_rules-status-draft) | [主图](1440-score_rules-status-draft.png) | [主图](390-score_rules-status-draft.png) |
| 评分规则 / 待审批 (score_rules-status-pending_approval) | [主图](1440-score_rules-status-pending_approval.png) | [主图](390-score_rules-status-pending_approval.png) |
| 评分规则 / 已批准 (score_rules-status-approved) | [主图](1440-score_rules-status-approved.png) | [主图](390-score_rules-status-approved.png) |
| 评分规则 / 启用 (score_rules-status-active) | [主图](1440-score_rules-status-active.png) | [主图](390-score_rules-status-active.png) |
| 评分规则 / 已退役 (score_rules-status-retired) | [主图](1440-score_rules-status-retired.png) | [主图](390-score_rules-status-retired.png) |
| 评分规则 / 已驳回 (score_rules-status-rejected) | [主图](1440-score_rules-status-rejected.png) | [主图](390-score_rules-status-rejected.png) |
| 评分规则 / 已回滚 (score_rules-status-rolled_back) | [主图](1440-score_rules-status-rolled_back.png) | [主图](390-score_rules-status-rolled_back.png) |
| 费用与风险 / 目录 (cost_rules-list) | [主图](1440-cost_rules-list.png) | [主图](390-cost_rules-list.png) |
| 费用与风险 / 详情 (cost_rules-detail) | [主图](1440-cost_rules-detail.png) | [主图](390-cost_rules-detail.png) · [局部1](390-cost_rules-detail-part1.png) |
| 费用与风险 / 技术展开 (cost_rules-technical) | [主图](1440-cost_rules-technical.png) | [主图](390-cost_rules-technical.png) · [局部1](390-cost_rules-technical-part1.png) |
| 费用与风险 / 筛选为空 (cost_rules-empty) | [主图](1440-cost_rules-empty.png) | [主图](390-cost_rules-empty.png) |
| 费用与风险 / 状态选项 (cost_rules-filter) | [主图](1440-cost_rules-filter.png) | [主图](390-cost_rules-filter.png) |
| 费用与风险 / 精确工作台入口 (cost_rules-route) | [主图](1440-cost_rules-route.png) | [主图](390-cost_rules-route.png) |
| 费用与风险 / 草稿 (cost_rules-status-draft) | [主图](1440-cost_rules-status-draft.png) | [主图](390-cost_rules-status-draft.png) |
| 费用与风险 / 待审批 (cost_rules-status-pending_approval) | [主图](1440-cost_rules-status-pending_approval.png) | [主图](390-cost_rules-status-pending_approval.png) |
| 费用与风险 / 已批准 (cost_rules-status-approved) | [主图](1440-cost_rules-status-approved.png) | [主图](390-cost_rules-status-approved.png) |
| 费用与风险 / 启用 (cost_rules-status-active) | [主图](1440-cost_rules-status-active.png) | [主图](390-cost_rules-status-active.png) |
| 费用与风险 / 已退役 (cost_rules-status-retired) | [主图](1440-cost_rules-status-retired.png) | [主图](390-cost_rules-status-retired.png) |
| 费用与风险 / 已驳回 (cost_rules-status-rejected) | [主图](1440-cost_rules-status-rejected.png) | [主图](390-cost_rules-status-rejected.png) |
| 费用与风险 / 已回滚 (cost_rules-status-rolled_back) | [主图](1440-cost_rules-status-rolled_back.png) | [主图](390-cost_rules-status-rolled_back.png) |
| 审批工作流 / 目录 (approval_templates-list) | [主图](1440-approval_templates-list.png) | [主图](390-approval_templates-list.png) |
| 审批工作流 / 详情 (approval_templates-detail) | [主图](1440-approval_templates-detail.png) | [主图](390-approval_templates-detail.png) |
| 审批工作流 / 技术展开 (approval_templates-technical) | [主图](1440-approval_templates-technical.png) | [主图](390-approval_templates-technical.png) · [局部1](390-approval_templates-technical-part1.png) |
| 审批工作流 / 筛选为空 (approval_templates-empty) | [主图](1440-approval_templates-empty.png) | [主图](390-approval_templates-empty.png) |
| 审批工作流 / 状态选项 (approval_templates-filter) | [主图](1440-approval_templates-filter.png) | [主图](390-approval_templates-filter.png) |
| 审批工作流 / 精确工作台入口 (approval_templates-route) | [主图](1440-approval_templates-route.png) | [主图](390-approval_templates-route.png) |
| 审批工作流 / 草稿 (approval_templates-status-draft) | [主图](1440-approval_templates-status-draft.png) | [主图](390-approval_templates-status-draft.png) |
| 审批工作流 / 已发布 (approval_templates-status-published) | [主图](1440-approval_templates-status-published.png) | [主图](390-approval_templates-status-published.png) |
| 审批工作流 / 已归档 (approval_templates-status-archived) | [主图](1440-approval_templates-status-archived.png) | [主图](390-approval_templates-status-archived.png) |
| 自动化规则 / 目录 (automation_rules-list) | [主图](1440-automation_rules-list.png) | [主图](390-automation_rules-list.png) |
| 自动化规则 / 详情 (automation_rules-detail) | [主图](1440-automation_rules-detail.png) | [主图](390-automation_rules-detail.png) · [局部1](390-automation_rules-detail-part1.png) |
| 自动化规则 / 技术展开 (automation_rules-technical) | [主图](1440-automation_rules-technical.png) | [主图](390-automation_rules-technical.png) · [局部1](390-automation_rules-technical-part1.png) |
| 自动化规则 / 筛选为空 (automation_rules-empty) | [主图](1440-automation_rules-empty.png) | [主图](390-automation_rules-empty.png) |
| 自动化规则 / 状态选项 (automation_rules-filter) | [主图](1440-automation_rules-filter.png) | [主图](390-automation_rules-filter.png) |
| 自动化规则 / 精确工作台入口 (automation_rules-route) | [主图](1440-automation_rules-route.png) | [主图](390-automation_rules-route.png) |
| 自动化规则 / 启用 (automation_rules-status-active) | [主图](1440-automation_rules-status-active.png) | [主图](390-automation_rules-status-active.png) |
| 自动化规则 / 暂停 (automation_rules-status-paused) | [主图](1440-automation_rules-status-paused.png) | [主图](390-automation_rules-status-paused.png) |
| 灰度与回滚 / 目录 (releases-list) | [主图](1440-releases-list.png) | [主图](390-releases-list.png) |
| 灰度与回滚 / 详情 (releases-detail) | [主图](1440-releases-detail.png) | [主图](390-releases-detail.png) |
| 灰度与回滚 / 技术展开 (releases-technical) | [主图](1440-releases-technical.png) | [主图](390-releases-technical.png) · [局部1](390-releases-technical-part1.png) |
| 灰度与回滚 / 筛选为空 (releases-empty) | [主图](1440-releases-empty.png) | [主图](390-releases-empty.png) |
| 灰度与回滚 / 状态选项 (releases-filter) | [主图](1440-releases-filter.png) | [主图](390-releases-filter.png) |
| 灰度与回滚 / 精确工作台入口 (releases-route) | [主图](1440-releases-route.png) | [主图](390-releases-route.png) |
| 灰度与回滚 / 已计划 (releases-status-planned) | [主图](1440-releases-status-planned.png) | [主图](390-releases-status-planned.png) |
| 灰度与回滚 / 预检通过 (releases-status-preflight_passed) | [主图](1440-releases-status-preflight_passed.png) | [主图](390-releases-status-preflight_passed.png) |
| 灰度与回滚 / 发布中 (releases-status-deploying) | [主图](1440-releases-status-deploying.png) | [主图](390-releases-status-deploying.png) |
| 灰度与回滚 / 运行健康 (releases-status-healthy) | [主图](1440-releases-status-healthy.png) | [主图](390-releases-status-healthy.png) |
| 灰度与回滚 / 失败 (releases-status-failed) | [主图](1440-releases-status-failed.png) | [主图](390-releases-status-failed.png) |
| 灰度与回滚 / 已回滚 (releases-status-rolled_back) | [主图](1440-releases-status-rolled_back.png) | [主图](390-releases-status-rolled_back.png) |
<!-- GALLERY:END -->
