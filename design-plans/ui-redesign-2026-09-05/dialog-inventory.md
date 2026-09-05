# 弹窗逐项清单

扫描到 56 个 `<dialog>` / `role="dialog"` 实例。统一重构为“编辑式决策面板”，要求：动作标题、影响清单、取消可达、Esc 语义、失败留在原位、技术字段折叠。10 类完整图位于 `boards/dialog-*.png`。

| # | 源码位置 | 当前标题 | 新面板类型 |
| --- | --- | --- | --- |
| 1 | [apps/web/src/components/ApprovalWorkspace.vue:495](../../apps/web/src/components/ApprovalWorkspace.vue#L495) | {{ selected.title }} | 业务面板 |
| 2 | [apps/web/src/components/ApprovalWorkspace.vue:763](../../apps/web/src/components/ApprovalWorkspace.vue#L763) | 新建审批模板草稿 | 业务面板 |
| 3 | [apps/web/src/components/ApprovalWorkspace.vue:819](../../apps/web/src/components/ApprovalWorkspace.vue#L819) | 发布审批模板 | 业务面板 |
| 4 | [apps/web/src/components/ApprovalWorkspace.vue:841](../../apps/web/src/components/ApprovalWorkspace.vue#L841) | 发起审批 | 业务面板 |
| 5 | [apps/web/src/components/AuditedReasonDialog.vue:38](../../apps/web/src/components/AuditedReasonDialog.vue#L38) | {{ title }} | 审计批注 |
| 6 | [apps/web/src/components/AutomationRuleCenter.vue:452](../../apps/web/src/components/AutomationRuleCenter.vue#L452) | {{ selected.name }} | 业务面板 |
| 7 | [apps/web/src/components/AutomationRuleCenter.vue:488](../../apps/web/src/components/AutomationRuleCenter.vue#L488) | {{ editing ? "编辑自动化规则" : "创建自动化规则" }} | 分段创建 |
| 8 | [apps/web/src/components/CollectionTaskCenter.vue:710](../../apps/web/src/components/CollectionTaskCenter.vue#L710) | 动态弹窗 | 业务面板 |
| 9 | [apps/web/src/components/CommercialOperationsCenter.vue:951](../../apps/web/src/components/CommercialOperationsCenter.vue#L951) | 创建配额方案草稿 | 分段创建 |
| 10 | [apps/web/src/components/CommercialOperationsCenter.vue:1015](../../apps/web/src/components/CommercialOperationsCenter.vue#L1015) | 编辑配额方案 | 业务面板 |
| 11 | [apps/web/src/components/CommercialOperationsCenter.vue:1058](../../apps/web/src/components/CommercialOperationsCenter.vue#L1058) | 确认{{ pending.title }}？ | 业务面板 |
| 12 | [apps/web/src/components/CompetitorMonitor.vue:929](../../apps/web/src/components/CompetitorMonitor.vue#L929) | 添加竞品监控 | 业务面板 |
| 13 | [apps/web/src/components/CompetitorMonitor.vue:1018](../../apps/web/src/components/CompetitorMonitor.vue#L1018) | 新建监控规则 | 业务面板 |
| 14 | [apps/web/src/components/CompetitorMonitor.vue:1080](../../apps/web/src/components/CompetitorMonitor.vue#L1080) | 删除竞品监控 | 高影响签章 |
| 15 | [apps/web/src/components/CostRuleConsole.vue:727](../../apps/web/src/components/CostRuleConsole.vue#L727) | 新建费用规则草稿 | 业务面板 |
| 16 | [apps/web/src/components/CostRuleConsole.vue:856](../../apps/web/src/components/CostRuleConsole.vue#L856) | {{ actionTitle }} | 业务面板 |
| 17 | [apps/web/src/components/CredentialAssetCenter.vue:757](../../apps/web/src/components/CredentialAssetCenter.vue#L757) | {{ editor === "rotate" ? `轮换 ${selected?.name}` : "创建凭证资产" }} | 敏感资产 |
| 18 | [apps/web/src/components/CredentialAssetCenter.vue:837](../../apps/web/src/components/CredentialAssetCenter.vue#L837) | 创建浏览器档案引用 | 敏感资产 |
| 19 | [apps/web/src/components/CredentialAssetCenter.vue:900](../../apps/web/src/components/CredentialAssetCenter.vue#L900) | 导入已经登录的浏览器档案 | 敏感资产 |
| 20 | [apps/web/src/components/DiscoveryOverlay.vue:195](../../apps/web/src/components/DiscoveryOverlay.vue#L195) | {{ mode === "search" ? "搜索当前工作区" : "选择已授权入口" }} | 业务面板 |
| 21 | [apps/web/src/components/NotificationCenter.vue:512](../../apps/web/src/components/NotificationCenter.vue#L512) | {{ selected.title }} | 业务面板 |
| 22 | [apps/web/src/components/NotificationCenter.vue:590](../../apps/web/src/components/NotificationCenter.vue#L590) | 通知偏好 | 业务面板 |
| 23 | [apps/web/src/components/OpportunityWorkspace.vue:924](../../apps/web/src/components/OpportunityWorkspace.vue#L924) | 批量{{ batchAction === "assign" ? "指派" : batchAction === "archive" ? "归档" : "复核" }} | 业务面板 |
| 24 | [apps/web/src/components/OpportunityWorkspaceDialogs.vue:44](../../apps/web/src/components/OpportunityWorkspaceDialogs.vue#L44) | 从米豆 ERP 商品列表导入 | 业务面板 |
| 25 | [apps/web/src/components/OpportunityWorkspaceDialogs.vue:91](../../apps/web/src/components/OpportunityWorkspaceDialogs.vue#L91) | 创建机会候选 | 分段创建 |
| 26 | [apps/web/src/components/OpportunityWorkspaceDialogs.vue:124](../../apps/web/src/components/OpportunityWorkspaceDialogs.vue#L124) | 记录{{ decisionLabel[decisionAction] }}决定 | 业务面板 |
| 27 | [apps/web/src/components/OrganizationCreationWizard.vue:46](../../apps/web/src/components/OrganizationCreationWizard.vue#L46) | 新建组织 | 分段创建 |
| 28 | [apps/web/src/components/PlatformAccountDialogs.vue:61](../../apps/web/src/components/PlatformAccountDialogs.vue#L61) | {{ createUserTitle }} | 业务面板 |
| 29 | [apps/web/src/components/PlatformAccountDialogs.vue:116](../../apps/web/src/components/PlatformAccountDialogs.vue#L116) | 强制重置密码 | 业务面板 |
| 30 | [apps/web/src/components/PlatformAccountDialogs.vue:139](../../apps/web/src/components/PlatformAccountDialogs.vue#L139) | {{ reasonTitle }} | 业务面板 |
| 31 | [apps/web/src/components/PlatformGovernanceCenter.vue:510](../../apps/web/src/components/PlatformGovernanceCenter.vue#L510) | {{ selected.name }} | 业务面板 |
| 32 | [apps/web/src/components/PlatformManagementCenter.vue:595](../../apps/web/src/components/PlatformManagementCenter.vue#L595) | 审核热点内容 | 审计批注 |
| 33 | [apps/web/src/components/PlatformMessageEditor.vue:20](../../apps/web/src/components/PlatformMessageEditor.vue#L20) | {{ form.kind === "email" ? "平台邮件" : "平台通知" }} | 业务面板 |
| 34 | [apps/web/src/components/PlatformOrganizationDetailDialog.vue:29](../../apps/web/src/components/PlatformOrganizationDetailDialog.vue#L29) | 未找到该组织 | 记录卷宗 |
| 35 | [apps/web/src/components/PlatformUserDetailDialog.vue:39](../../apps/web/src/components/PlatformUserDetailDialog.vue#L39) | {{ detail.user.email }} | 记录卷宗 |
| 36 | [apps/web/src/components/ProviderCompatibilityMatrixDialog.vue:26](../../apps/web/src/components/ProviderCompatibilityMatrixDialog.vue#L26) | 解析器与页面版本 · {{ sourceName }} | 业务面板 |
| 37 | [apps/web/src/components/ProviderParserSampleDialog.vue:63](../../apps/web/src/components/ProviderParserSampleDialog.vue#L63) | 固定样本回放 · {{ sourceName }} | 业务面板 |
| 38 | [apps/web/src/components/ProviderRegistry.vue:752](../../apps/web/src/components/ProviderRegistry.vue#L752) | {{ editing ? "编辑来源" : "登记来源" }} | 业务面板 |
| 39 | [apps/web/src/components/ProviderSourceConfigurationDialog.vue:58](../../apps/web/src/components/ProviderSourceConfigurationDialog.vue#L58) | {{ editing.name }} | 业务面板 |
| 40 | [apps/web/src/components/ProviderSourceConfigurationDialog.vue:159](../../apps/web/src/components/ProviderSourceConfigurationDialog.vue#L159) | 版本、差异与回滚 · {{ versionSource.name }} | 高影响签章 |
| 41 | [apps/web/src/components/ReportCenter.vue:444](../../apps/web/src/components/ReportCenter.vue#L444) | {{ labels[selectedExport.report_type as ReportType] }} | 业务面板 |
| 42 | [apps/web/src/components/ResponsiveDataView.vue:60](../../apps/web/src/components/ResponsiveDataView.vue#L60) | detailTitle(selected) | 业务面板 |
| 43 | [apps/web/src/components/ScoreRuleConsole.vue:491](../../apps/web/src/components/ScoreRuleConsole.vue#L491) | 新建评分规则草稿 | 业务面板 |
| 44 | [apps/web/src/components/ScoreRuleConsole.vue:574](../../apps/web/src/components/ScoreRuleConsole.vue#L574) | 发布影响预览 · {{ previewRule.version_code }} | 业务面板 |
| 45 | [apps/web/src/components/ScoreRuleConsole.vue:675](../../apps/web/src/components/ScoreRuleConsole.vue#L675) | {{ actionLabels[action] }} · {{ selected.version_code }} | 业务面板 |
| 46 | [apps/web/src/components/SourcingWorkspaceDialogs.vue:92](../../apps/web/src/components/SourcingWorkspaceDialogs.vue#L92) | 发起供应商找货 | 业务面板 |
| 47 | [apps/web/src/components/SourcingWorkspaceDialogs.vue:139](../../apps/web/src/components/SourcingWorkspaceDialogs.vue#L139) | 确认完整供应商报价 | 业务面板 |
| 48 | [apps/web/src/components/SourcingWorkspaceDialogs.vue:211](../../apps/web/src/components/SourcingWorkspaceDialogs.vue#L211) | 创建采购任务 | 分段创建 |
| 49 | [apps/web/src/components/SourcingWorkspaceDialogs.vue:280](../../apps/web/src/components/SourcingWorkspaceDialogs.vue#L280) | 删除找货记录 | 高影响签章 |
| 50 | [apps/web/src/components/TaskBatchActions.vue:49](../../apps/web/src/components/TaskBatchActions.vue#L49) | 确认批量{{ actionLabel(action) }} | 业务面板 |
| 51 | [apps/web/src/components/TaskDetailPanel.vue:225](../../apps/web/src/components/TaskDetailPanel.vue#L225) | {{ actionEditor === "transfer" ? "转交任务" : actionEditor === "delay" ? "调整任务期限" : actionEditor === "progress" ? "更新任务进度" : actionEditor === "pause" ? "暂停任务" : "取消任务" }} | 记录卷宗 |
| 52 | [apps/web/src/components/TaskWorkspace.vue:874](../../apps/web/src/components/TaskWorkspace.vue#L874) | {{ editing ? "编辑任务" : "新建任务" }} | 业务面板 |
| 53 | [apps/web/src/components/TaskWorkspace.vue:933](../../apps/web/src/components/TaskWorkspace.vue#L933) | 删除任务 | 高影响签章 |
| 54 | [apps/web/src/components/TrendDashboard.vue:682](../../apps/web/src/components/TrendDashboard.vue#L682) | 创建数据质量工单 | 分段创建 |
| 55 | [apps/web/src/components/TrendDashboard.vue:722](../../apps/web/src/components/TrendDashboard.vue#L722) | {{ relevanceDialog === "irrelevant" ? "标记为无关" : "恢复为相关" }} | 业务面板 |
| 56 | [apps/web/src/components/TrendRuleDialog.vue:52](../../apps/web/src/components/TrendRuleDialog.vue#L52) | 创建趋势监控 | 分段创建 |
