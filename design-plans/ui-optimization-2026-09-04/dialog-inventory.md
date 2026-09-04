# 弹窗逐项清单

共扫描 56 个 `<dialog>` / `role="dialog"` 实例。统一要求：标题即动作、影响范围置顶、取消可达、Esc 语义明确、提交失败留在当前弹窗、技术标识折叠。对应 10 类图见 `boards/dialog-*.png`。

| # | 源码位置 | 当前标题 | 归一类型 |
| --- | --- | --- | --- |
| 1 | [apps/web/src/components/ApprovalWorkspace.vue:608](../../apps/web/src/components/ApprovalWorkspace.vue#L608) | {{ selected.title }} | 业务弹窗 |
| 2 | [apps/web/src/components/ApprovalWorkspace.vue:876](../../apps/web/src/components/ApprovalWorkspace.vue#L876) | 新建审批模板草稿 | 业务弹窗 |
| 3 | [apps/web/src/components/ApprovalWorkspace.vue:932](../../apps/web/src/components/ApprovalWorkspace.vue#L932) | 发布审批模板 | 业务弹窗 |
| 4 | [apps/web/src/components/ApprovalWorkspace.vue:954](../../apps/web/src/components/ApprovalWorkspace.vue#L954) | 发起审批 | 业务弹窗 |
| 5 | [apps/web/src/components/AuditedReasonDialog.vue:38](../../apps/web/src/components/AuditedReasonDialog.vue#L38) | {{ title }} | 审计理由 |
| 6 | [apps/web/src/components/AutomationRuleCenter.vue:452](../../apps/web/src/components/AutomationRuleCenter.vue#L452) | {{ selected.name }} | 业务弹窗 |
| 7 | [apps/web/src/components/AutomationRuleCenter.vue:488](../../apps/web/src/components/AutomationRuleCenter.vue#L488) | {{ editing ? "编辑自动化规则" : "创建自动化规则" }} | 创建向导 |
| 8 | [apps/web/src/components/CollectionTaskCenter.vue:710](../../apps/web/src/components/CollectionTaskCenter.vue#L710) | 动态弹窗 | 业务弹窗 |
| 9 | [apps/web/src/components/CommercialOperationsCenter.vue:951](../../apps/web/src/components/CommercialOperationsCenter.vue#L951) | 创建配额方案草稿 | 创建向导 |
| 10 | [apps/web/src/components/CommercialOperationsCenter.vue:1015](../../apps/web/src/components/CommercialOperationsCenter.vue#L1015) | 编辑配额方案 | 业务弹窗 |
| 11 | [apps/web/src/components/CommercialOperationsCenter.vue:1058](../../apps/web/src/components/CommercialOperationsCenter.vue#L1058) | 确认{{ pending.title }}？ | 业务弹窗 |
| 12 | [apps/web/src/components/CompetitorMonitor.vue:895](../../apps/web/src/components/CompetitorMonitor.vue#L895) | 添加竞品监控 | 业务弹窗 |
| 13 | [apps/web/src/components/CompetitorMonitor.vue:984](../../apps/web/src/components/CompetitorMonitor.vue#L984) | 新建监控规则 | 业务弹窗 |
| 14 | [apps/web/src/components/CompetitorMonitor.vue:1046](../../apps/web/src/components/CompetitorMonitor.vue#L1046) | 删除竞品监控 | 高影响确认 |
| 15 | [apps/web/src/components/CostRuleConsole.vue:579](../../apps/web/src/components/CostRuleConsole.vue#L579) | 新建费用规则草稿 | 业务弹窗 |
| 16 | [apps/web/src/components/CostRuleConsole.vue:667](../../apps/web/src/components/CostRuleConsole.vue#L667) | {{ actionTitle }} | 业务弹窗 |
| 17 | [apps/web/src/components/CredentialAssetCenter.vue:757](../../apps/web/src/components/CredentialAssetCenter.vue#L757) | {{ editor === "rotate" ? `轮换 ${selected?.name}` : "创建凭证资产" }} | 敏感输入 |
| 18 | [apps/web/src/components/CredentialAssetCenter.vue:837](../../apps/web/src/components/CredentialAssetCenter.vue#L837) | 创建浏览器档案引用 | 敏感输入 |
| 19 | [apps/web/src/components/CredentialAssetCenter.vue:900](../../apps/web/src/components/CredentialAssetCenter.vue#L900) | 导入已经登录的浏览器档案 | 敏感输入 |
| 20 | [apps/web/src/components/DiscoveryOverlay.vue:195](../../apps/web/src/components/DiscoveryOverlay.vue#L195) | {{ mode === "search" ? "搜索当前工作区" : "选择已授权入口" }} | 业务弹窗 |
| 21 | [apps/web/src/components/NotificationCenter.vue:512](../../apps/web/src/components/NotificationCenter.vue#L512) | {{ selected.title }} | 业务弹窗 |
| 22 | [apps/web/src/components/NotificationCenter.vue:590](../../apps/web/src/components/NotificationCenter.vue#L590) | 通知偏好 | 业务弹窗 |
| 23 | [apps/web/src/components/OpportunityWorkspace.vue:912](../../apps/web/src/components/OpportunityWorkspace.vue#L912) | 批量{{ batchAction === "assign" ? "指派" : batchAction === "archive" ? "归档" : "复核" }} | 业务弹窗 |
| 24 | [apps/web/src/components/OpportunityWorkspaceDialogs.vue:44](../../apps/web/src/components/OpportunityWorkspaceDialogs.vue#L44) | 从米豆 ERP 商品列表导入 | 业务弹窗 |
| 25 | [apps/web/src/components/OpportunityWorkspaceDialogs.vue:91](../../apps/web/src/components/OpportunityWorkspaceDialogs.vue#L91) | 创建机会候选 | 创建向导 |
| 26 | [apps/web/src/components/OpportunityWorkspaceDialogs.vue:124](../../apps/web/src/components/OpportunityWorkspaceDialogs.vue#L124) | 记录{{ decisionLabel[decisionAction] }}决定 | 业务弹窗 |
| 27 | [apps/web/src/components/OrganizationCreationWizard.vue:46](../../apps/web/src/components/OrganizationCreationWizard.vue#L46) | 新建组织 | 创建向导 |
| 28 | [apps/web/src/components/PlatformAccountDialogs.vue:61](../../apps/web/src/components/PlatformAccountDialogs.vue#L61) | {{ createUserTitle }} | 业务弹窗 |
| 29 | [apps/web/src/components/PlatformAccountDialogs.vue:116](../../apps/web/src/components/PlatformAccountDialogs.vue#L116) | 强制重置密码 | 业务弹窗 |
| 30 | [apps/web/src/components/PlatformAccountDialogs.vue:139](../../apps/web/src/components/PlatformAccountDialogs.vue#L139) | {{ reasonTitle }} | 业务弹窗 |
| 31 | [apps/web/src/components/PlatformGovernanceCenter.vue:510](../../apps/web/src/components/PlatformGovernanceCenter.vue#L510) | {{ selected.name }} | 业务弹窗 |
| 32 | [apps/web/src/components/PlatformManagementCenter.vue:595](../../apps/web/src/components/PlatformManagementCenter.vue#L595) | 审核热点内容 | 审计理由 |
| 33 | [apps/web/src/components/PlatformMessageEditor.vue:20](../../apps/web/src/components/PlatformMessageEditor.vue#L20) | {{ form.kind === "email" ? "平台邮件" : "平台通知" }} | 业务弹窗 |
| 34 | [apps/web/src/components/PlatformOrganizationDetailDialog.vue:29](../../apps/web/src/components/PlatformOrganizationDetailDialog.vue#L29) | 未找到该组织 | 记录详情 |
| 35 | [apps/web/src/components/PlatformUserDetailDialog.vue:33](../../apps/web/src/components/PlatformUserDetailDialog.vue#L33) | {{ detail.user.email }} | 记录详情 |
| 36 | [apps/web/src/components/ProviderCompatibilityMatrixDialog.vue:26](../../apps/web/src/components/ProviderCompatibilityMatrixDialog.vue#L26) | 解析器与页面版本 · {{ sourceName }} | 业务弹窗 |
| 37 | [apps/web/src/components/ProviderParserSampleDialog.vue:63](../../apps/web/src/components/ProviderParserSampleDialog.vue#L63) | 固定样本回放 · {{ sourceName }} | 业务弹窗 |
| 38 | [apps/web/src/components/ProviderRegistry.vue:752](../../apps/web/src/components/ProviderRegistry.vue#L752) | {{ editing ? "编辑来源" : "登记来源" }} | 业务弹窗 |
| 39 | [apps/web/src/components/ProviderSourceConfigurationDialog.vue:58](../../apps/web/src/components/ProviderSourceConfigurationDialog.vue#L58) | {{ editing.name }} | 业务弹窗 |
| 40 | [apps/web/src/components/ProviderSourceConfigurationDialog.vue:159](../../apps/web/src/components/ProviderSourceConfigurationDialog.vue#L159) | 版本、差异与回滚 · {{ versionSource.name }} | 高影响确认 |
| 41 | [apps/web/src/components/ReportCenter.vue:444](../../apps/web/src/components/ReportCenter.vue#L444) | {{ labels[selectedExport.report_type as ReportType] }} | 业务弹窗 |
| 42 | [apps/web/src/components/ResponsiveDataView.vue:60](../../apps/web/src/components/ResponsiveDataView.vue#L60) | detailTitle(selected) | 业务弹窗 |
| 43 | [apps/web/src/components/ScoreRuleConsole.vue:431](../../apps/web/src/components/ScoreRuleConsole.vue#L431) | 新建评分规则草稿 | 业务弹窗 |
| 44 | [apps/web/src/components/ScoreRuleConsole.vue:514](../../apps/web/src/components/ScoreRuleConsole.vue#L514) | 发布影响预览 · {{ previewRule.version_code }} | 业务弹窗 |
| 45 | [apps/web/src/components/ScoreRuleConsole.vue:615](../../apps/web/src/components/ScoreRuleConsole.vue#L615) | {{ actionLabels[action] }} · {{ selected.version_code }} | 业务弹窗 |
| 46 | [apps/web/src/components/SourcingWorkspaceDialogs.vue:92](../../apps/web/src/components/SourcingWorkspaceDialogs.vue#L92) | 发起供应商找货 | 业务弹窗 |
| 47 | [apps/web/src/components/SourcingWorkspaceDialogs.vue:139](../../apps/web/src/components/SourcingWorkspaceDialogs.vue#L139) | 确认完整供应商报价 | 业务弹窗 |
| 48 | [apps/web/src/components/SourcingWorkspaceDialogs.vue:211](../../apps/web/src/components/SourcingWorkspaceDialogs.vue#L211) | 创建采购任务 | 创建向导 |
| 49 | [apps/web/src/components/SourcingWorkspaceDialogs.vue:280](../../apps/web/src/components/SourcingWorkspaceDialogs.vue#L280) | 删除找货记录 | 高影响确认 |
| 50 | [apps/web/src/components/TaskBatchActions.vue:49](../../apps/web/src/components/TaskBatchActions.vue#L49) | 确认批量{{ actionLabel(action) }} | 业务弹窗 |
| 51 | [apps/web/src/components/TaskDetailPanel.vue:199](../../apps/web/src/components/TaskDetailPanel.vue#L199) | {{ actionEditor === "transfer" ? "转交任务" : actionEditor === "delay" ? "调整任务期限" : actionEditor === "progress" ? "更新任务进度" : actionEditor === "pause" ? "暂停任务" : "取消任务" }} | 记录详情 |
| 52 | [apps/web/src/components/TaskWorkspace.vue:831](../../apps/web/src/components/TaskWorkspace.vue#L831) | {{ editing ? "编辑任务" : "新建任务" }} | 业务弹窗 |
| 53 | [apps/web/src/components/TaskWorkspace.vue:890](../../apps/web/src/components/TaskWorkspace.vue#L890) | 删除任务 | 高影响确认 |
| 54 | [apps/web/src/components/TrendDashboard.vue:651](../../apps/web/src/components/TrendDashboard.vue#L651) | 创建数据质量工单 | 创建向导 |
| 55 | [apps/web/src/components/TrendDashboard.vue:691](../../apps/web/src/components/TrendDashboard.vue#L691) | {{ relevanceDialog === "irrelevant" ? "标记为无关" : "恢复为相关" }} | 业务弹窗 |
| 56 | [apps/web/src/components/TrendRuleDialog.vue:52](../../apps/web/src/components/TrendRuleDialog.vue#L52) | 创建趋势监控 | 创建向导 |
