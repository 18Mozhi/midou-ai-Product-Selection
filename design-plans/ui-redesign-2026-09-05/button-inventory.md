# 按钮逐项清单

扫描到 648 个真实 `<button>`。所有按钮保留现有业务语义，但视觉统一进入“行动块”系统：默认、悬停、键盘聚焦、按下、禁用、处理中六态；44px 最小热区；图标按钮必须有可读名称。完整图见 [按钮系统](boards/button-system.png)。

| # | 源码位置 | 当前文字或表达式 | 新层级 |
| --- | --- | --- | --- |
| 1 | [apps/web/src/components/Alibaba1688AcceptanceCenter.vue:300](../../apps/web/src/components/Alibaba1688AcceptanceCenter.vue#L300) | {{ refreshing ? "刷新中…" : "刷新检查结果" }} | 次/上下文 |
| 2 | [apps/web/src/components/Alibaba1688AcceptanceCenter.vue:329](../../apps/web/src/components/Alibaba1688AcceptanceCenter.vue#L329) | 重新读取 | 次/上下文 |
| 3 | [apps/web/src/components/Alibaba1688AcceptanceCenter.vue:466](../../apps/web/src/components/Alibaba1688AcceptanceCenter.vue#L466) | {{ scheduling ? "提交中…" : "发起登录验收运行" }} | 主/提交 |
| 4 | [apps/web/src/components/ApiFoundation.vue:63](../../apps/web/src/components/ApiFoundation.vue#L63) | 重新检查 | 次/上下文 |
| 5 | [apps/web/src/components/ApprovalQueuePanel.vue:35](../../apps/web/src/components/ApprovalQueuePanel.vue#L35) | 待我处理 | 次/上下文 |
| 6 | [apps/web/src/components/ApprovalQueuePanel.vue:38](../../apps/web/src/components/ApprovalQueuePanel.vue#L38) | 我发起的 | 次/上下文 |
| 7 | [apps/web/src/components/ApprovalQueuePanel.vue:43](../../apps/web/src/components/ApprovalQueuePanel.vue#L43) | {{ item.label }} | 次/上下文 |
| 8 | [apps/web/src/components/ApprovalQueuePanel.vue:59](../../apps/web/src/components/ApprovalQueuePanel.vue#L59) | 发起审批 | 次/上下文 |
| 9 | [apps/web/src/components/ApprovalQueuePanel.vue:62](../../apps/web/src/components/ApprovalQueuePanel.vue#L62) | 配置模板 | 次/上下文 |
| 10 | [apps/web/src/components/ApprovalQueuePanel.vue:68](../../apps/web/src/components/ApprovalQueuePanel.vue#L68) | {{ item.current_node_ordinal }} {{ statusText(item.status) }} 需要你处理 {{ resourceText(item.resource_type) }} {{ item.title }} {{ item.template_name }} · {{ item.current_node_name \|\| "流程已结束" }} {{ item.escalated_at ? "节点已升级" : "处理期限" }} {{ item.escalated_at ? "已转交超时接收人" : time(item.due_at) }} 查看 → | 次/上下文 |
| 11 | [apps/web/src/components/ApprovalWorkspace.vue:401](../../apps/web/src/components/ApprovalWorkspace.vue#L401) | 管理模板 | 次/上下文 |
| 12 | [apps/web/src/components/ApprovalWorkspace.vue:404](../../apps/web/src/components/ApprovalWorkspace.vue#L404) | ＋ 发起审批 | 次/上下文 |
| 13 | [apps/web/src/components/ApprovalWorkspace.vue:405](../../apps/web/src/components/ApprovalWorkspace.vue#L405) | 配置第一个模板 | 次/上下文 |
| 14 | [apps/web/src/components/ApprovalWorkspace.vue:459](../../apps/web/src/components/ApprovalWorkspace.vue#L459) | 刷新最新状态 | 次/上下文 |
| 15 | [apps/web/src/components/ApprovalWorkspace.vue:482](../../apps/web/src/components/ApprovalWorkspace.vue#L482) | 关闭提示 | 次/上下文 |
| 16 | [apps/web/src/components/ApprovalWorkspace.vue:485](../../apps/web/src/components/ApprovalWorkspace.vue#L485) | 上一页 | 次/上下文 |
| 17 | [apps/web/src/components/ApprovalWorkspace.vue:487](../../apps/web/src/components/ApprovalWorkspace.vue#L487) | = pageCount" @click="setPage(page + 1)">下一页 | 次/上下文 |
| 18 | [apps/web/src/components/ApprovalWorkspace.vue:502](../../apps/web/src/components/ApprovalWorkspace.vue#L502) | × | 次/上下文 |
| 19 | [apps/web/src/components/ApprovalWorkspace.vue:735](../../apps/web/src/components/ApprovalWorkspace.vue#L735) | 驳回 批准并流转 | 高影响 |
| 20 | [apps/web/src/components/ApprovalWorkspace.vue:805](../../apps/web/src/components/ApprovalWorkspace.vue#L805) | 取消 保存草稿 | 次/上下文 |
| 21 | [apps/web/src/components/ApprovalWorkspace.vue:815](../../apps/web/src/components/ApprovalWorkspace.vue#L815) | 发布 | 次/上下文 |
| 22 | [apps/web/src/components/ApprovalWorkspace.vue:836](../../apps/web/src/components/ApprovalWorkspace.vue#L836) | 返回 | 次/上下文 |
| 23 | [apps/web/src/components/ApprovalWorkspace.vue:837](../../apps/web/src/components/ApprovalWorkspace.vue#L837) | 确认发布 | 主/提交 |
| 24 | [apps/web/src/components/ApprovalWorkspace.vue:863](../../apps/web/src/components/ApprovalWorkspace.vue#L863) | 取消 发起 | 次/上下文 |
| 25 | [apps/web/src/components/AuditedReasonDialog.vue:50](../../apps/web/src/components/AuditedReasonDialog.vue#L50) | × | 次/上下文 |
| 26 | [apps/web/src/components/AuditedReasonDialog.vue:66](../../apps/web/src/components/AuditedReasonDialog.vue#L66) | 取消 | 次/上下文 |
| 27 | [apps/web/src/components/AuditedReasonDialog.vue:67](../../apps/web/src/components/AuditedReasonDialog.vue#L67) | 确认提交 | 主/提交 |
| 28 | [apps/web/src/components/AuditSecurityCenter.vue:114](../../apps/web/src/components/AuditSecurityCenter.vue#L114) | 平台审计 组织审计 审计员仅可读取，不能重放任务或管理凭证 动作 结果 全部 成功 失败 已阻止 资源类型 筛选 | 次/上下文 |
| 29 | [apps/web/src/components/AuditSecurityCenter.vue:167](../../apps/web/src/components/AuditSecurityCenter.vue#L167) | 重新加载 | 次/上下文 |
| 30 | [apps/web/src/components/AuditSecurityCenter.vue:172](../../apps/web/src/components/AuditSecurityCenter.vue#L172) | 刷新 | 次/上下文 |
| 31 | [apps/web/src/components/AuditSecurityCenter.vue:179](../../apps/web/src/components/AuditSecurityCenter.vue#L179) | {{ outcomeLabel(event.outcome) }} {{ new Date(event.occurred_at).toLocaleString("zh-CN") }} {{ event.action }} {{ event.resource_type }} {{ event.resource_id?.slice(0, 12) \|\| "全局" }} {{ event.request_id.slice(0, 12) }} 加载更多 | 次/上下文 |
| 32 | [apps/web/src/components/AuthorizationCenter.vue:107](../../apps/web/src/components/AuthorizationCenter.vue#L107) | 重新加载 | 次/上下文 |
| 33 | [apps/web/src/components/AuthorizationCenter.vue:112](../../apps/web/src/components/AuthorizationCenter.vue#L112) | 重新加载 | 次/上下文 |
| 34 | [apps/web/src/components/AuthorizationCenter.vue:141](../../apps/web/src/components/AuthorizationCenter.vue#L141) | {{ role.name.slice(0, 1) }} {{ role.name }} 角色编号：{{ role.code }} {{ role.description }} {{ role.capabilities.length }} 项动作 | 次/上下文 |
| 35 | [apps/web/src/components/AutomationRuleCenter.vue:369](../../apps/web/src/components/AutomationRuleCenter.vue#L369) | 创建规则 | 次/上下文 |
| 36 | [apps/web/src/components/AutomationRuleCenter.vue:399](../../apps/web/src/components/AutomationRuleCenter.vue#L399) | 重新加载 | 次/上下文 |
| 37 | [apps/web/src/components/AutomationRuleCenter.vue:444](../../apps/web/src/components/AutomationRuleCenter.vue#L444) | 查看详情 编辑 {{ rule.status === "active" ? "暂停" : "恢复" }} | 高影响 |
| 38 | [apps/web/src/components/AutomationRuleCenter.vue:459](../../apps/web/src/components/AutomationRuleCenter.vue#L459) | × | 次/上下文 |
| 39 | [apps/web/src/components/AutomationRuleCenter.vue:498](../../apps/web/src/components/AutomationRuleCenter.vue#L498) | {{ template.name }} {{ template.description }} | 次/上下文 |
| 40 | [apps/web/src/components/AutomationRuleCenter.vue:619](../../apps/web/src/components/AutomationRuleCenter.vue#L619) | 取消 | 次/上下文 |
| 41 | [apps/web/src/components/AutomationRuleCenter.vue:620](../../apps/web/src/components/AutomationRuleCenter.vue#L620) | {{ previewing ? "正在试运行…" : "试运行并预览影响" }} {{ editing ? "保存修改" : "创建并启用" }} | 次/上下文 |
| 42 | [apps/web/src/components/BackupRecoveryCenter.vue:150](../../apps/web/src/components/BackupRecoveryCenter.vue#L150) | {{ refreshing ? "正在刷新…" : "刷新事实" }} | 次/上下文 |
| 43 | [apps/web/src/components/BackupRecoveryCenter.vue:165](../../apps/web/src/components/BackupRecoveryCenter.vue#L165) | 重新核验 | 次/上下文 |
| 44 | [apps/web/src/components/BackupRecoveryCenter.vue:179](../../apps/web/src/components/BackupRecoveryCenter.vue#L179) | 重新核验 | 次/上下文 |
| 45 | [apps/web/src/components/CapacityBoundaryCenter.vue:234](../../apps/web/src/components/CapacityBoundaryCenter.vue#L234) | load()"> {{ refreshing ? "刷新中…" : "刷新实测事实" }} {{ saving ? "签认中…" : "签认恢复演练" }} | 次/上下文 |
| 46 | [apps/web/src/components/CapacityBoundaryCenter.vue:257](../../apps/web/src/components/CapacityBoundaryCenter.vue#L257) | load()">重新核验 | 次/上下文 |
| 47 | [apps/web/src/components/CapacityBoundaryCenter.vue:277](../../apps/web/src/components/CapacityBoundaryCenter.vue#L277) | load()" > 重新核验 | 次/上下文 |
| 48 | [apps/web/src/components/CollectionOperationsConsole.vue:361](../../apps/web/src/components/CollectionOperationsConsole.vue#L361) | {{ refreshing ? "正在刷新" : "刷新数据" }} | 次/上下文 |
| 49 | [apps/web/src/components/CollectionOperationsConsole.vue:402](../../apps/web/src/components/CollectionOperationsConsole.vue#L402) | 重置 | 次/上下文 |
| 50 | [apps/web/src/components/CollectionOperationsConsole.vue:405](../../apps/web/src/components/CollectionOperationsConsole.vue#L405) | {{ refreshing ? "正在应用" : "应用范围" }} | 主/提交 |
| 51 | [apps/web/src/components/CollectionOperationsConsole.vue:414](../../apps/web/src/components/CollectionOperationsConsole.vue#L414) | 重试 | 次/上下文 |
| 52 | [apps/web/src/components/CollectionOperationsConsole.vue:433](../../apps/web/src/components/CollectionOperationsConsole.vue#L433) | 重新读取 | 次/上下文 |
| 53 | [apps/web/src/components/CollectionOperationsConsole.vue:534](../../apps/web/src/components/CollectionOperationsConsole.vue#L534) | sourceDisplayLimit" type="button" class="collection-source-disclosure" :aria-expanded="sourcesExpanded" @click="sourcesExpanded = !sourcesExpanded" > {{ sourcesExpanded ? `收起来源，仅看前 ${sourceDisplayLimit} 个` : `查看全部 ${data.sources.length} 个来源（还有 ${hiddenSourceCount} 个）` }} | 次/上下文 |
| 54 | [apps/web/src/components/CollectionOperationsConsole.vue:573](../../apps/web/src/components/CollectionOperationsConsole.vue#L573) | 清除根因筛选 | 次/上下文 |
| 55 | [apps/web/src/components/CollectionOperationsConsole.vue:588](../../apps/web/src/components/CollectionOperationsConsole.vue#L588) | {{ errorLabel(root.error_code) }} {{ root.total }} 次 · 最近 {{ when(root.latest_at) }} 告警类别：{{ errorCategory(root.error_code) }} | 次/上下文 |
| 56 | [apps/web/src/components/CollectionOperationsConsole.vue:698](../../apps/web/src/components/CollectionOperationsConsole.vue#L698) | 上一页 | 次/上下文 |
| 57 | [apps/web/src/components/CollectionOperationsConsole.vue:709](../../apps/web/src/components/CollectionOperationsConsole.vue#L709) | = data.pagination.attempts.total_pages " @click="goToPage('attempts', data.pagination.attempts.page + 1)" > 下一页 | 次/上下文 |
| 58 | [apps/web/src/components/CollectionOperationsConsole.vue:757](../../apps/web/src/components/CollectionOperationsConsole.vue#L757) | {{ batchBusy ? "正在重放" : "预览批量重放" }} | 次/上下文 |
| 59 | [apps/web/src/components/CollectionOperationsConsole.vue:786](../../apps/web/src/components/CollectionOperationsConsole.vue#L786) | 上一页 | 次/上下文 |
| 60 | [apps/web/src/components/CollectionOperationsConsole.vue:797](../../apps/web/src/components/CollectionOperationsConsole.vue#L797) | = data.pagination.dead_letters.total_pages " @click="goToPage('dead_letters', data.pagination.dead_letters.page + 1)" > 下一页 | 次/上下文 |
| 61 | [apps/web/src/components/CollectionRuntimeCenter.vue:278](../../apps/web/src/components/CollectionRuntimeCenter.vue#L278) | {{ refreshing ? "刷新中…" : "刷新数据" }} | 次/上下文 |
| 62 | [apps/web/src/components/CollectionRuntimeCenter.vue:281](../../apps/web/src/components/CollectionRuntimeCenter.vue#L281) | {{ saving ? "回收中…" : "回收过期运行" }} | 次/上下文 |
| 63 | [apps/web/src/components/CollectionRuntimeCenter.vue:410](../../apps/web/src/components/CollectionRuntimeCenter.vue#L410) | 查询 | 主/提交 |
| 64 | [apps/web/src/components/CollectionRuntimeCenter.vue:411](../../apps/web/src/components/CollectionRuntimeCenter.vue#L411) | 重置 | 次/上下文 |
| 65 | [apps/web/src/components/CollectionRuntimeCenter.vue:532](../../apps/web/src/components/CollectionRuntimeCenter.vue#L532) | 上一页 | 次/上下文 |
| 66 | [apps/web/src/components/CollectionRuntimeCenter.vue:540](../../apps/web/src/components/CollectionRuntimeCenter.vue#L540) | = pagination.total_pages" @click="goToPage(pagination.page + 1)" > 下一页 | 次/上下文 |
| 67 | [apps/web/src/components/CollectionTaskCenter.vue:486](../../apps/web/src/components/CollectionTaskCenter.vue#L486) | {{ listLoading ? "正在刷新…" : "刷新任务" }} | 次/上下文 |
| 68 | [apps/web/src/components/CollectionTaskCenter.vue:501](../../apps/web/src/components/CollectionTaskCenter.vue#L501) | 重新读取 | 次/上下文 |
| 69 | [apps/web/src/components/CollectionTaskCenter.vue:614](../../apps/web/src/components/CollectionTaskCenter.vue#L614) | 查看 | 次/上下文 |
| 70 | [apps/web/src/components/CollectionTaskCenter.vue:659](../../apps/web/src/components/CollectionTaskCenter.vue#L659) | 打开完整任务详情 | 次/上下文 |
| 71 | [apps/web/src/components/CollectionTaskCenter.vue:696](../../apps/web/src/components/CollectionTaskCenter.vue#L696) | 上一页 | 次/上下文 |
| 72 | [apps/web/src/components/CollectionTaskCenter.vue:700](../../apps/web/src/components/CollectionTaskCenter.vue#L700) | = totalPages \|\| listLoading" @click="changePage(page + 1)" > 下一页 | 次/上下文 |
| 73 | [apps/web/src/components/CollectionTaskCenter.vue:729](../../apps/web/src/components/CollectionTaskCenter.vue#L729) | 重试 | 次/上下文 |
| 74 | [apps/web/src/components/CollectionTaskCenter.vue:730](../../apps/web/src/components/CollectionTaskCenter.vue#L730) | 关闭 | 次/上下文 |
| 75 | [apps/web/src/components/CollectionTaskCenter.vue:742](../../apps/web/src/components/CollectionTaskCenter.vue#L742) | × | 次/上下文 |
| 76 | [apps/web/src/components/CollectionTaskCenter.vue:894](../../apps/web/src/components/CollectionTaskCenter.vue#L894) | {{ saving ? "正在创建重放任务…" : "人工重放" }} | 次/上下文 |
| 77 | [apps/web/src/components/CommercialOperationsCenter.vue:585](../../apps/web/src/components/CommercialOperationsCenter.vue#L585) | {{ refreshing ? "读取中…" : "刷新数据" }} | 次/上下文 |
| 78 | [apps/web/src/components/CommercialOperationsCenter.vue:588](../../apps/web/src/components/CommercialOperationsCenter.vue#L588) | 新建配额方案 | 主/提交 |
| 79 | [apps/web/src/components/CommercialOperationsCenter.vue:598](../../apps/web/src/components/CommercialOperationsCenter.vue#L598) | 读取组织 | 次/上下文 |
| 80 | [apps/web/src/components/CommercialOperationsCenter.vue:599](../../apps/web/src/components/CommercialOperationsCenter.vue#L599) | 清除组织 | 次/上下文 |
| 81 | [apps/web/src/components/CommercialOperationsCenter.vue:625](../../apps/web/src/components/CommercialOperationsCenter.vue#L625) | 重新读取 | 次/上下文 |
| 82 | [apps/web/src/components/CommercialOperationsCenter.vue:659](../../apps/web/src/components/CommercialOperationsCenter.vue#L659) | 暂停 恢复 结束 | 高影响 |
| 83 | [apps/web/src/components/CommercialOperationsCenter.vue:728](../../apps/web/src/components/CommercialOperationsCenter.vue#L728) | {{ data.assignment ? "确认调整" : "确认分配" }} | 次/上下文 |
| 84 | [apps/web/src/components/CommercialOperationsCenter.vue:770](../../apps/web/src/components/CommercialOperationsCenter.vue#L770) | 提交调整 | 次/上下文 |
| 85 | [apps/web/src/components/CommercialOperationsCenter.vue:785](../../apps/web/src/components/CommercialOperationsCenter.vue#L785) | 撤销 | 次/上下文 |
| 86 | [apps/web/src/components/CommercialOperationsCenter.vue:807](../../apps/web/src/components/CommercialOperationsCenter.vue#L807) | 上一页 | 次/上下文 |
| 87 | [apps/web/src/components/CommercialOperationsCenter.vue:814](../../apps/web/src/components/CommercialOperationsCenter.vue#L814) | = data.adjustment_pagination.total_pages" @click="changeAdjustmentPage(adjustmentPage + 1)" > 下一页 | 次/上下文 |
| 88 | [apps/web/src/components/CommercialOperationsCenter.vue:834](../../apps/web/src/components/CommercialOperationsCenter.vue#L834) | 新建方案 | 主/提交 |
| 89 | [apps/web/src/components/CommercialOperationsCenter.vue:848](../../apps/web/src/components/CommercialOperationsCenter.vue#L848) | 查询 | 次/上下文 |
| 90 | [apps/web/src/components/CommercialOperationsCenter.vue:849](../../apps/web/src/components/CommercialOperationsCenter.vue#L849) | 重置 | 次/上下文 |
| 91 | [apps/web/src/components/CommercialOperationsCenter.vue:887](../../apps/web/src/components/CommercialOperationsCenter.vue#L887) | 编辑 | 次/上下文 |
| 92 | [apps/web/src/components/CommercialOperationsCenter.vue:888](../../apps/web/src/components/CommercialOperationsCenter.vue#L888) | 启用 | 次/上下文 |
| 93 | [apps/web/src/components/CommercialOperationsCenter.vue:904](../../apps/web/src/components/CommercialOperationsCenter.vue#L904) | 退役 | 高影响 |
| 94 | [apps/web/src/components/CommercialOperationsCenter.vue:939](../../apps/web/src/components/CommercialOperationsCenter.vue#L939) | 上一页 | 次/上下文 |
| 95 | [apps/web/src/components/CommercialOperationsCenter.vue:941](../../apps/web/src/components/CommercialOperationsCenter.vue#L941) | = data.pagination.total_pages" @click="changePage(page + 1)" > 下一页 | 次/上下文 |
| 96 | [apps/web/src/components/CommercialOperationsCenter.vue:958](../../apps/web/src/components/CommercialOperationsCenter.vue#L958) | 关闭 | 次/上下文 |
| 97 | [apps/web/src/components/CommercialOperationsCenter.vue:1006](../../apps/web/src/components/CommercialOperationsCenter.vue#L1006) | 取消 | 次/上下文 |
| 98 | [apps/web/src/components/CommercialOperationsCenter.vue:1007](../../apps/web/src/components/CommercialOperationsCenter.vue#L1007) | {{ mutating ? "创建中…" : "创建草稿" }} | 主/提交 |
| 99 | [apps/web/src/components/CommercialOperationsCenter.vue:1051](../../apps/web/src/components/CommercialOperationsCenter.vue#L1051) | 取消 保存新版本 | 次/上下文 |
| 100 | [apps/web/src/components/CommercialOperationsCenter.vue:1079](../../apps/web/src/components/CommercialOperationsCenter.vue#L1079) | 取消 | 次/上下文 |
| 101 | [apps/web/src/components/CommercialOperationsCenter.vue:1080](../../apps/web/src/components/CommercialOperationsCenter.vue#L1080) | {{ mutating ? "执行中…" : "确认执行" }} | 主/提交 |
| 102 | [apps/web/src/components/CompetitorMonitor.vue:619](../../apps/web/src/components/CompetitorMonitor.vue#L619) | {{ enabledRules.length ? "新建监控规则" : "配置第一条阈值" }} | 主/提交 |
| 103 | [apps/web/src/components/CompetitorMonitor.vue:656](../../apps/web/src/components/CompetitorMonitor.vue#L656) | 创建第一条规则 | 次/上下文 |
| 104 | [apps/web/src/components/CompetitorMonitor.vue:669](../../apps/web/src/components/CompetitorMonitor.vue#L669) | 配置监控阈值 | 主/提交 |
| 105 | [apps/web/src/components/CompetitorMonitor.vue:677](../../apps/web/src/components/CompetitorMonitor.vue#L677) | 添加竞品监控 | 主/提交 |
| 106 | [apps/web/src/components/CompetitorMonitor.vue:680](../../apps/web/src/components/CompetitorMonitor.vue#L680) | 添加竞品 | 次/上下文 |
| 107 | [apps/web/src/components/CompetitorMonitor.vue:683](../../apps/web/src/components/CompetitorMonitor.vue#L683) | 查看监控规则 | 次/上下文 |
| 108 | [apps/web/src/components/CompetitorMonitor.vue:721](../../apps/web/src/components/CompetitorMonitor.vue#L721) | {{ item.title }} {{ item.source_site }} · {{ item.market }} {{ snapshotPrice(item.latest_snapshot) }} 等待首次采集 {{ statusText(item.status) }} 查看详情 → | 次/上下文 |
| 109 | [apps/web/src/components/CompetitorMonitor.vue:746](../../apps/web/src/components/CompetitorMonitor.vue#L746) | {{ selected.status !== "active" ? "恢复后可采集" : collectionPending ? "采集中…" : latest ? "立即采集" : "重新尝试首次采集" }} 当前竞品规则 | 次/上下文 |
| 110 | [apps/web/src/components/CompetitorMonitor.vue:763](../../apps/web/src/components/CompetitorMonitor.vue#L763) | {{ selected.status === "active" ? "暂停监控" : "恢复监控" }} 删除竞品监控 | 高影响 |
| 111 | [apps/web/src/components/CompetitorMonitor.vue:771](../../apps/web/src/components/CompetitorMonitor.vue#L771) | {{ selected.status === "active" ? "暂停监控" : "恢复监控" }} 删除竞品监控 | 高影响 |
| 112 | [apps/web/src/components/CompetitorMonitor.vue:889](../../apps/web/src/components/CompetitorMonitor.vue#L889) | 生成验证任务 | 次/上下文 |
| 113 | [apps/web/src/components/CompetitorMonitor.vue:943](../../apps/web/src/components/CompetitorMonitor.vue#L943) | × | 次/上下文 |
| 114 | [apps/web/src/components/CompetitorMonitor.vue:1009](../../apps/web/src/components/CompetitorMonitor.vue#L1009) | 取消 上一步 {{ busy ? "保存中…" : createStep === 3 ? "确认并开始采集" : "下一步" }} | 次/上下文 |
| 115 | [apps/web/src/components/CompetitorMonitor.vue:1032](../../apps/web/src/components/CompetitorMonitor.vue#L1032) | × | 次/上下文 |
| 116 | [apps/web/src/components/CompetitorMonitor.vue:1075](../../apps/web/src/components/CompetitorMonitor.vue#L1075) | 取消 启用规则 | 次/上下文 |
| 117 | [apps/web/src/components/CompetitorMonitor.vue:1093](../../apps/web/src/components/CompetitorMonitor.vue#L1093) | × | 高影响 |
| 118 | [apps/web/src/components/CompetitorMonitor.vue:1115](../../apps/web/src/components/CompetitorMonitor.vue#L1115) | 取消 确认删除 | 高影响 |
| 119 | [apps/web/src/components/ConfirmDialog.vue:123](../../apps/web/src/components/ConfirmDialog.vue#L123) | {{ cancelLabel }} {{ confirmLabel }} | 次/上下文 |
| 120 | [apps/web/src/components/CostRuleConsole.vue:524](../../apps/web/src/components/CostRuleConsole.vue#L524) | 新建规则版本 | 次/上下文 |
| 121 | [apps/web/src/components/CostRuleConsole.vue:559](../../apps/web/src/components/CostRuleConsole.vue#L559) | {{ nextCostRule ? "创建后续版本" : "创建首个规则" }} | 次/上下文 |
| 122 | [apps/web/src/components/CostRuleConsole.vue:583](../../apps/web/src/components/CostRuleConsole.vue#L583) | 重置 | 次/上下文 |
| 123 | [apps/web/src/components/CostRuleConsole.vue:589](../../apps/web/src/components/CostRuleConsole.vue#L589) | {{ rule.name }} {{ rule.market }} · {{ rule.platform }} · {{ rule.version_code }} {{ statusLabels[rule.status] ?? rule.status }} 修订 {{ rule.revision }} | 次/上下文 |
| 124 | [apps/web/src/components/CostRuleConsole.vue:608](../../apps/web/src/components/CostRuleConsole.vue#L608) | 上一页 | 次/上下文 |
| 125 | [apps/web/src/components/CostRuleConsole.vue:610](../../apps/web/src/components/CostRuleConsole.vue#L610) | = pageCount" @click="page++">下一页 | 次/上下文 |
| 126 | [apps/web/src/components/CostRuleConsole.vue:657](../../apps/web/src/components/CostRuleConsole.vue#L657) | 提交审批 | 主/提交 |
| 127 | [apps/web/src/components/CostRuleConsole.vue:665](../../apps/web/src/components/CostRuleConsole.vue#L665) | 选品经理批准 | 次/上下文 |
| 128 | [apps/web/src/components/CostRuleConsole.vue:672](../../apps/web/src/components/CostRuleConsole.vue#L672) | 选品经理拒绝 | 高影响 |
| 129 | [apps/web/src/components/CostRuleConsole.vue:680](../../apps/web/src/components/CostRuleConsole.vue#L680) | 组织管理员批准 | 次/上下文 |
| 130 | [apps/web/src/components/CostRuleConsole.vue:687](../../apps/web/src/components/CostRuleConsole.vue#L687) | 组织管理员拒绝 | 高影响 |
| 131 | [apps/web/src/components/CostRuleConsole.vue:696](../../apps/web/src/components/CostRuleConsole.vue#L696) | 发布规则 | 次/上下文 |
| 132 | [apps/web/src/components/CostRuleConsole.vue:703](../../apps/web/src/components/CostRuleConsole.vue#L703) | 回滚到历史版本 | 高影响 |
| 133 | [apps/web/src/components/CostRuleConsole.vue:740](../../apps/web/src/components/CostRuleConsole.vue#L740) | × | 次/上下文 |
| 134 | [apps/web/src/components/CostRuleConsole.vue:849](../../apps/web/src/components/CostRuleConsole.vue#L849) | 取消 {{ busy ? "保存中…" : "保存草稿" }} | 次/上下文 |
| 135 | [apps/web/src/components/CostRuleConsole.vue:869](../../apps/web/src/components/CostRuleConsole.vue#L869) | × | 次/上下文 |
| 136 | [apps/web/src/components/CostRuleConsole.vue:893](../../apps/web/src/components/CostRuleConsole.vue#L893) | 取消 {{ busy ? "提交中…" : `确认${actionLabels[pendingAction.action]}` }} | 次/上下文 |
| 137 | [apps/web/src/components/CrawlerSchedulerCenter.vue:403](../../apps/web/src/components/CrawlerSchedulerCenter.vue#L403) | load()"> {{ refreshing ? "正在刷新…" : "刷新运行事实" }} 回收过期租约 | 次/上下文 |
| 138 | [apps/web/src/components/CrawlerSchedulerCenter.vue:426](../../apps/web/src/components/CrawlerSchedulerCenter.vue#L426) | load()">重新核验 | 次/上下文 |
| 139 | [apps/web/src/components/CrawlerSchedulerCenter.vue:440](../../apps/web/src/components/CrawlerSchedulerCenter.vue#L440) | load()"> 重新核验 | 次/上下文 |
| 140 | [apps/web/src/components/CrawlerSchedulerCenter.vue:561](../../apps/web/src/components/CrawlerSchedulerCenter.vue#L561) | 解除熔断 | 次/上下文 |
| 141 | [apps/web/src/components/CrawlerSchedulerCenter.vue:582](../../apps/web/src/components/CrawlerSchedulerCenter.vue#L582) | 上一页 | 次/上下文 |
| 142 | [apps/web/src/components/CrawlerSchedulerCenter.vue:586](../../apps/web/src/components/CrawlerSchedulerCenter.vue#L586) | = providerPageCount" @click="providerPage += 1" > 下一页 | 次/上下文 |
| 143 | [apps/web/src/components/CredentialAssetCenter.vue:526](../../apps/web/src/components/CredentialAssetCenter.vue#L526) | {{ refreshing ? "刷新中…" : "刷新数据" }} | 次/上下文 |
| 144 | [apps/web/src/components/CredentialAssetCenter.vue:536](../../apps/web/src/components/CredentialAssetCenter.vue#L536) | 配置网页登录 关联运行档案 新建凭证资产 | 次/上下文 |
| 145 | [apps/web/src/components/CredentialAssetCenter.vue:577](../../apps/web/src/components/CredentialAssetCenter.vue#L577) | 创建第一个凭证 | 次/上下文 |
| 146 | [apps/web/src/components/CredentialAssetCenter.vue:626](../../apps/web/src/components/CredentialAssetCenter.vue#L626) | 更新资料 撤销 | 次/上下文 |
| 147 | [apps/web/src/components/CredentialAssetCenter.vue:776](../../apps/web/src/components/CredentialAssetCenter.vue#L776) | × | 次/上下文 |
| 148 | [apps/web/src/components/CredentialAssetCenter.vue:829](../../apps/web/src/components/CredentialAssetCenter.vue#L829) | 取消 | 次/上下文 |
| 149 | [apps/web/src/components/CredentialAssetCenter.vue:832](../../apps/web/src/components/CredentialAssetCenter.vue#L832) | {{ saving ? "加密写入中…" : editor === "rotate" ? "确认轮换" : "加密保存" }} | 主/提交 |
| 150 | [apps/web/src/components/CredentialAssetCenter.vue:852](../../apps/web/src/components/CredentialAssetCenter.vue#L852) | × | 次/上下文 |
| 151 | [apps/web/src/components/CredentialAssetCenter.vue:894](../../apps/web/src/components/CredentialAssetCenter.vue#L894) | 取消 | 次/上下文 |
| 152 | [apps/web/src/components/CredentialAssetCenter.vue:897](../../apps/web/src/components/CredentialAssetCenter.vue#L897) | 保存档案引用 | 主/提交 |
| 153 | [apps/web/src/components/CredentialAssetCenter.vue:915](../../apps/web/src/components/CredentialAssetCenter.vue#L915) | × | 次/上下文 |
| 154 | [apps/web/src/components/CredentialAssetCenter.vue:974](../../apps/web/src/components/CredentialAssetCenter.vue#L974) | 打开{{ loginNeedsAuthentication ? "登录" : "来源" }}页面 ↗ | 次/上下文 |
| 155 | [apps/web/src/components/CredentialAssetCenter.vue:977](../../apps/web/src/components/CredentialAssetCenter.vue#L977) | 从当前浏览器读取 Cookie | 次/上下文 |
| 156 | [apps/web/src/components/CredentialAssetCenter.vue:988](../../apps/web/src/components/CredentialAssetCenter.vue#L988) | 取消 {{ saving ? "加密保存中…" : "加密保存并启用" }} | 次/上下文 |
| 157 | [apps/web/src/components/DataQualityCenter.vue:511](../../apps/web/src/components/DataQualityCenter.vue#L511) | 证据 质量问题 核对运行 | 次/上下文 |
| 158 | [apps/web/src/components/DataQualityCenter.vue:572](../../apps/web/src/components/DataQualityCenter.vue#L572) | 详情 下载 | 次/上下文 |
| 159 | [apps/web/src/components/DataQualityCenter.vue:611](../../apps/web/src/components/DataQualityCenter.vue#L611) | 读取完整溯源 | 次/上下文 |
| 160 | [apps/web/src/components/DataQualityCenter.vue:620](../../apps/web/src/components/DataQualityCenter.vue#L620) | 下载证据 | 次/上下文 |
| 161 | [apps/web/src/components/DataQualityCenter.vue:662](../../apps/web/src/components/DataQualityCenter.vue#L662) | 返回全部问题 | 次/上下文 |
| 162 | [apps/web/src/components/DataQualityCenter.vue:694](../../apps/web/src/components/DataQualityCenter.vue#L694) | 预览影响范围 | 次/上下文 |
| 163 | [apps/web/src/components/DataQualityCenter.vue:754](../../apps/web/src/components/DataQualityCenter.vue#L754) | 查看证据 | 次/上下文 |
| 164 | [apps/web/src/components/DataQualityCenter.vue:761](../../apps/web/src/components/DataQualityCenter.vue#L761) | 记录解决 | 次/上下文 |
| 165 | [apps/web/src/components/DataQualityCenter.vue:831](../../apps/web/src/components/DataQualityCenter.vue#L831) | 查看关联证据 | 次/上下文 |
| 166 | [apps/web/src/components/DataQualityCenter.vue:842](../../apps/web/src/components/DataQualityCenter.vue#L842) | 记录解决 | 次/上下文 |
| 167 | [apps/web/src/components/DataQualityCenter.vue:883](../../apps/web/src/components/DataQualityCenter.vue#L883) | 查看异常字段与样本 | 次/上下文 |
| 168 | [apps/web/src/components/DataQualityCenter.vue:893](../../apps/web/src/components/DataQualityCenter.vue#L893) | 上一页 | 次/上下文 |
| 169 | [apps/web/src/components/DataQualityCenter.vue:897](../../apps/web/src/components/DataQualityCenter.vue#L897) | = totalPages" @click="goToPage(page + 1)" > 下一页 | 次/上下文 |
| 170 | [apps/web/src/components/DataQualityCenter.vue:912](../../apps/web/src/components/DataQualityCenter.vue#L912) | × | 次/上下文 |
| 171 | [apps/web/src/components/DataQualityCenter.vue:953](../../apps/web/src/components/DataQualityCenter.vue#L953) | × | 次/上下文 |
| 172 | [apps/web/src/components/DataQualityCenter.vue:963](../../apps/web/src/components/DataQualityCenter.vue#L963) | 确认前检查 | 次/上下文 |
| 173 | [apps/web/src/components/DeploymentFoundation.vue:162](../../apps/web/src/components/DeploymentFoundation.vue#L162) | 回滚模式 | 高影响 |
| 174 | [apps/web/src/components/DeploymentFoundation.vue:165](../../apps/web/src/components/DeploymentFoundation.vue#L165) | {{ state === "rollback" ? "恢复实时状态" : "重新核验" }} | 次/上下文 |
| 175 | [apps/web/src/components/DiscoveryOverlay.vue:210](../../apps/web/src/components/DiscoveryOverlay.vue#L210) | × | 次/上下文 |
| 176 | [apps/web/src/components/FileAuditFoundation.vue:52](../../apps/web/src/components/FileAuditFoundation.vue#L52) | 隔离通过 授权拒绝 审计脱敏 | 次/上下文 |
| 177 | [apps/web/src/components/FileResilienceCenter.vue:155](../../apps/web/src/components/FileResilienceCenter.vue#L155) | {{ refreshing ? "正在刷新…" : "刷新文件事实" }} | 次/上下文 |
| 178 | [apps/web/src/components/FileResilienceCenter.vue:170](../../apps/web/src/components/FileResilienceCenter.vue#L170) | 重新核验 | 次/上下文 |
| 179 | [apps/web/src/components/FileResilienceCenter.vue:197](../../apps/web/src/components/FileResilienceCenter.vue#L197) | 重新核验 | 次/上下文 |
| 180 | [apps/web/src/components/HomeDashboard.vue:286](../../apps/web/src/components/HomeDashboard.vue#L286) | {{ setupBusy ? "正在恢复…" : "恢复自动选品" }} | 次/上下文 |
| 181 | [apps/web/src/components/HomeDashboard.vue:294](../../apps/web/src/components/HomeDashboard.vue#L294) | {{ setupOpen ? "收起设置" : "开始设置" }} | 次/上下文 |
| 182 | [apps/web/src/components/HomeDashboard.vue:375](../../apps/web/src/components/HomeDashboard.vue#L375) | {{ setupBusy ? "正在启用…" : "保存并开始自动选品" }} | 主/提交 |
| 183 | [apps/web/src/components/LocalIdentity.vue:413](../../apps/web/src/components/LocalIdentity.vue#L413) | 忘记密码？ | 次/上下文 |
| 184 | [apps/web/src/components/LocalIdentity.vue:417](../../apps/web/src/components/LocalIdentity.vue#L417) | {{ requestState === "loading" ? "正在安全处理…" : mode === "login" ? "登录" : mode === "register" ? "创建账号" : mode === "forgot" ? "发送重置说明" : mode === "mfa-challenge" ? "验证并登录" : "更新密码" }} | 主/提交 |
| 185 | [apps/web/src/components/LocalIdentity.vue:452](../../apps/web/src/components/LocalIdentity.vue#L452) | 返回登录 | 次/上下文 |
| 186 | [apps/web/src/components/LocalIdentity.vue:482](../../apps/web/src/components/LocalIdentity.vue#L482) | 修改密码并撤销当前会话 | 主/提交 |
| 187 | [apps/web/src/components/LocalIdentity.vue:494](../../apps/web/src/components/LocalIdentity.vue#L494) | 开始绑定认证器 | 主/提交 |
| 188 | [apps/web/src/components/LocalIdentity.vue:506](../../apps/web/src/components/LocalIdentity.vue#L506) | 确认并完成安全设置 | 主/提交 |
| 189 | [apps/web/src/components/LocalIdentity.vue:515](../../apps/web/src/components/LocalIdentity.vue#L515) | 返回登录 | 主/提交 |
| 190 | [apps/web/src/components/LocalIdentity.vue:540](../../apps/web/src/components/LocalIdentity.vue#L540) | 开始绑定认证器 | 主/提交 |
| 191 | [apps/web/src/components/LocalIdentity.vue:553](../../apps/web/src/components/LocalIdentity.vue#L553) | 确认并启用 | 主/提交 |
| 192 | [apps/web/src/components/LocalIdentity.vue:576](../../apps/web/src/components/LocalIdentity.vue#L576) | 停用并撤销全部会话 | 高影响 |
| 193 | [apps/web/src/components/LocalIdentity.vue:591](../../apps/web/src/components/LocalIdentity.vue#L591) | 撤销 | 次/上下文 |
| 194 | [apps/web/src/components/LocalIdentity.vue:596](../../apps/web/src/components/LocalIdentity.vue#L596) | 创建本地账号 | 次/上下文 |
| 195 | [apps/web/src/components/LocalIdentity.vue:604](../../apps/web/src/components/LocalIdentity.vue#L604) | 返回登录 | 次/上下文 |
| 196 | [apps/web/src/components/MySqlFoundation.vue:52](../../apps/web/src/components/MySqlFoundation.vue#L52) | 合同通过 验收受阻 回滚中 | 高影响 |
| 197 | [apps/web/src/components/MySqlResilienceCenter.vue:169](../../apps/web/src/components/MySqlResilienceCenter.vue#L169) | {{ refreshing ? "正在刷新…" : "刷新运行事实" }} | 次/上下文 |
| 198 | [apps/web/src/components/MySqlResilienceCenter.vue:184](../../apps/web/src/components/MySqlResilienceCenter.vue#L184) | 重新核验 | 次/上下文 |
| 199 | [apps/web/src/components/MySqlResilienceCenter.vue:211](../../apps/web/src/components/MySqlResilienceCenter.vue#L211) | 重新核验 | 次/上下文 |
| 200 | [apps/web/src/components/NavigationShell.vue:338](../../apps/web/src/components/NavigationShell.vue#L338) | 菜单 | 次/上下文 |
| 201 | [apps/web/src/components/NavigationShell.vue:350](../../apps/web/src/components/NavigationShell.vue#L350) | 主题 | 次/上下文 |
| 202 | [apps/web/src/components/NavigationShell.vue:354](../../apps/web/src/components/NavigationShell.vue#L354) | 搜索 快捷键 | 次/上下文 |
| 203 | [apps/web/src/components/NavigationShell.vue:372](../../apps/web/src/components/NavigationShell.vue#L372) | 创建选品 | 主/提交 |
| 204 | [apps/web/src/components/NavigationShell.vue:483](../../apps/web/src/components/NavigationShell.vue#L483) | 重新检查 | 次/上下文 |
| 205 | [apps/web/src/components/NavigationShell.vue:567](../../apps/web/src/components/NavigationShell.vue#L567) | 更多 | 次/上下文 |
| 206 | [apps/web/src/components/NavigationShell.vue:578](../../apps/web/src/components/NavigationShell.vue#L578) | {{ theme.name }} {{ activeTheme === theme.id ? "当前主题 · " : "" }}{{ theme.caption }} | 次/上下文 |
| 207 | [apps/web/src/components/NotificationCenter.vue:400](../../apps/web/src/components/NotificationCenter.vue#L400) | 通知偏好 全部已读 | 次/上下文 |
| 208 | [apps/web/src/components/NotificationCenter.vue:426](../../apps/web/src/components/NotificationCenter.vue#L426) | {{ x.t }} 仅未读 {{ item.t }} | 次/上下文 |
| 209 | [apps/web/src/components/NotificationCenter.vue:479](../../apps/web/src/components/NotificationCenter.vue#L479) | 重新加载 | 次/上下文 |
| 210 | [apps/web/src/components/NotificationCenter.vue:486](../../apps/web/src/components/NotificationCenter.vue#L486) | {{ label(item.category).slice(0, 1) }} {{ item.title }} {{ displayBody(item) }} {{ time(item.created_at) }} {{ item.read_at ? "已读" : "未读" }} · {{ statusLabel(item.workflow_status) }} 1"> · 已合并 {{ item.group_count }} 条同根因通知 | 次/上下文 |
| 211 | [apps/web/src/components/NotificationCenter.vue:508](../../apps/web/src/components/NotificationCenter.vue#L508) | 上一页 | 次/上下文 |
| 212 | [apps/web/src/components/NotificationCenter.vue:510](../../apps/web/src/components/NotificationCenter.vue#L510) | = pageCount" @click="setFilters({ page: page + 1 })">下一页 | 次/上下文 |
| 213 | [apps/web/src/components/NotificationCenter.vue:519](../../apps/web/src/components/NotificationCenter.vue#L519) | × | 次/上下文 |
| 214 | [apps/web/src/components/NotificationCenter.vue:549](../../apps/web/src/components/NotificationCenter.vue#L549) | 开始处理 | 次/上下文 |
| 215 | [apps/web/src/components/NotificationCenter.vue:557](../../apps/web/src/components/NotificationCenter.vue#L557) | 关闭 | 次/上下文 |
| 216 | [apps/web/src/components/NotificationCenter.vue:565](../../apps/web/src/components/NotificationCenter.vue#L565) | 重新打开 | 次/上下文 |
| 217 | [apps/web/src/components/NotificationCenter.vue:607](../../apps/web/src/components/NotificationCenter.vue#L607) | 取消 保存 | 次/上下文 |
| 218 | [apps/web/src/components/OnboardingGuide.vue:61](../../apps/web/src/components/OnboardingGuide.vue#L61) | {{ index }} | 次/上下文 |
| 219 | [apps/web/src/components/OpenPlatformCenter.vue:485](../../apps/web/src/components/OpenPlatformCenter.vue#L485) | {{ refreshing ? "读取中…" : "读取" }} | 主/提交 |
| 220 | [apps/web/src/components/OpenPlatformCenter.vue:496](../../apps/web/src/components/OpenPlatformCenter.vue#L496) | 复制密钥 我已安全保存 | 次/上下文 |
| 221 | [apps/web/src/components/OpenPlatformCenter.vue:529](../../apps/web/src/components/OpenPlatformCenter.vue#L529) | 重试 | 次/上下文 |
| 222 | [apps/web/src/components/OpenPlatformCenter.vue:534](../../apps/web/src/components/OpenPlatformCenter.vue#L534) | 接口访问账号 {{ data.summary.clients.total }} {{ data.summary.clients.active }} 个可用 · {{ data.summary.clients.expired }} 个过期 | 次/上下文 |
| 223 | [apps/web/src/components/OpenPlatformCenter.vue:546](../../apps/web/src/components/OpenPlatformCenter.vue#L546) | 事件回调地址 {{ data.summary.webhooks.total }} {{ data.summary.webhooks.active }} 个启用 | 次/上下文 |
| 224 | [apps/web/src/components/OpenPlatformCenter.vue:555](../../apps/web/src/components/OpenPlatformCenter.vue#L555) | 投递记录 {{ data.summary.deliveries.total }} {{ data.summary.deliveries.retry_scheduled }} 个重试 · {{ data.summary.deliveries.dead_letter }} 个多次失败 | 次/上下文 |
| 225 | [apps/web/src/components/OpenPlatformCenter.vue:637](../../apps/web/src/components/OpenPlatformCenter.vue#L637) | {{ actionBusy ? "提交中…" : activeView === "clients" ? "创建接口访问账号" : "创建事件回调地址" }} | 主/提交 |
| 226 | [apps/web/src/components/OpenPlatformCenter.vue:659](../../apps/web/src/components/OpenPlatformCenter.vue#L659) | {{ refreshing ? "刷新中…" : "刷新" }} | 次/上下文 |
| 227 | [apps/web/src/components/OpenPlatformCenter.vue:691](../../apps/web/src/components/OpenPlatformCenter.vue#L691) | 应用 重置 | 主/提交 |
| 228 | [apps/web/src/components/OpenPlatformCenter.vue:698](../../apps/web/src/components/OpenPlatformCenter.vue#L698) | 清除筛选 | 次/上下文 |
| 229 | [apps/web/src/components/OpenPlatformCenter.vue:738](../../apps/web/src/components/OpenPlatformCenter.vue#L738) | 轮换 撤销 | 次/上下文 |
| 230 | [apps/web/src/components/OpenPlatformCenter.vue:805](../../apps/web/src/components/OpenPlatformCenter.vue#L805) | 轮换密钥 撤销账号 | 次/上下文 |
| 231 | [apps/web/src/components/OpenPlatformCenter.vue:848](../../apps/web/src/components/OpenPlatformCenter.vue#L848) | {{ row.status === "active" ? "停用" : "启用" }} 测试 轮换密钥 | 高影响 |
| 232 | [apps/web/src/components/OpenPlatformCenter.vue:913](../../apps/web/src/components/OpenPlatformCenter.vue#L913) | {{ row.status === "active" ? "停用回调" : "启用回调" }} 发送测试 轮换密钥 | 高影响 |
| 233 | [apps/web/src/components/OpenPlatformCenter.vue:963](../../apps/web/src/components/OpenPlatformCenter.vue#L963) | 重放 由 Worker 处理 技术详情 {{ row.last_error_code \|\| row.id }} {{ row.endpoint_name }} {{ statusText(row.status) }} · {{ eventText(row.event_type) }} · 已尝试 {{ row.attempt_count }} 次 事件 {{ eventText(row.event_type) }} 当前状态 {{ statusText(row.status) }} 尝试次数 {{ row.attempt_count }} 次 响应状态 {{ row.response_status ?? (row.last_error_code ? "投递失败" : "—") }} 下次可用 {{ formatTime(row.available_at) }} 更新时间 {{ formatTime(row.updated_at) }} 技术详情 投递 ID {{ row.id }} 回调 ID {{ row.endpoint_id }} 组织 ID {{ row.organization_id }} 错误代码 {{ row.last_error_code }} 重放 | 次/上下文 |
| 234 | [apps/web/src/components/OpenPlatformCenter.vue:1054](../../apps/web/src/components/OpenPlatformCenter.vue#L1054) | 上一页 = currentPagination.total_pages" @click="goToPage(currentPagination.page + 1)" > 下一页 | 次/上下文 |
| 235 | [apps/web/src/components/OpportunityAiPanel.vue:31](../../apps/web/src/components/OpportunityAiPanel.vue#L31) | 生成新分析 | 次/上下文 |
| 236 | [apps/web/src/components/OpportunityAiPanel.vue:40](../../apps/web/src/components/OpportunityAiPanel.vue#L40) | 重试读取 | 次/上下文 |
| 237 | [apps/web/src/components/OpportunityAiPanel.vue:86](../../apps/web/src/components/OpportunityAiPanel.vue#L86) | 抽检通过 | 次/上下文 |
| 238 | [apps/web/src/components/OpportunityAiPanel.vue:89](../../apps/web/src/components/OpportunityAiPanel.vue#L89) | 抽检驳回 | 次/上下文 |
| 239 | [apps/web/src/components/OpportunityCostReviewQueue.vue:76](../../apps/web/src/components/OpportunityCostReviewQueue.vue#L76) | 驳回 | 次/上下文 |
| 240 | [apps/web/src/components/OpportunityCostReviewQueue.vue:77](../../apps/web/src/components/OpportunityCostReviewQueue.vue#L77) | 通过 | 次/上下文 |
| 241 | [apps/web/src/components/OpportunityCostReviewQueue.vue:85](../../apps/web/src/components/OpportunityCostReviewQueue.vue#L85) | 取消 | 次/上下文 |
| 242 | [apps/web/src/components/OpportunityCostReviewQueue.vue:86](../../apps/web/src/components/OpportunityCostReviewQueue.vue#L86) | 提交 | 主/提交 |
| 243 | [apps/web/src/components/OpportunityDecisionPanel.vue:115](../../apps/web/src/components/OpportunityDecisionPanel.vue#L115) | 采纳建议 继续观察 驳回 | 主/提交 |
| 244 | [apps/web/src/components/OpportunityDecisionPanel.vue:127](../../apps/web/src/components/OpportunityDecisionPanel.vue#L127) | 继续观察 | 次/上下文 |
| 245 | [apps/web/src/components/OpportunityDecisionPanel.vue:128](../../apps/web/src/components/OpportunityDecisionPanel.vue#L128) | 驳回 | 次/上下文 |
| 246 | [apps/web/src/components/OpportunityDecisionPanel.vue:144](../../apps/web/src/components/OpportunityDecisionPanel.vue#L144) | 创建补采任务 | 次/上下文 |
| 247 | [apps/web/src/components/OpportunityDetailInsights.vue:67](../../apps/web/src/components/OpportunityDetailInsights.vue#L67) | 重试读取 | 次/上下文 |
| 248 | [apps/web/src/components/OpportunityDetailInsights.vue:75](../../apps/web/src/components/OpportunityDetailInsights.vue#L75) | 采集竞品 | 次/上下文 |
| 249 | [apps/web/src/components/OpportunityDetailInsights.vue:83](../../apps/web/src/components/OpportunityDetailInsights.vue#L83) | 采集供应商 | 次/上下文 |
| 250 | [apps/web/src/components/OpportunityDetailInsights.vue:124](../../apps/web/src/components/OpportunityDetailInsights.vue#L124) | 重新评分 | 次/上下文 |
| 251 | [apps/web/src/components/OpportunityDetailInsights.vue:214](../../apps/web/src/components/OpportunityDetailInsights.vue#L214) | 重试读取 | 次/上下文 |
| 252 | [apps/web/src/components/OpportunityDetailInsights.vue:222](../../apps/web/src/components/OpportunityDetailInsights.vue#L222) | 立即采集竞品 | 次/上下文 |
| 253 | [apps/web/src/components/OpportunityEvidencePanel.vue:55](../../apps/web/src/components/OpportunityEvidencePanel.vue#L55) | EVIDENCE_BATCH_SIZE" type="button" @click="collapse"> 收起到最新 {{ EVIDENCE_BATCH_SIZE }} 条 | 次/上下文 |
| 254 | [apps/web/src/components/OpportunityEvidencePanel.vue:58](../../apps/web/src/components/OpportunityEvidencePanel.vue#L58) | 继续显示 {{ Math.min(EVIDENCE_BATCH_SIZE, hiddenCount) }} 条（剩余 {{ hiddenCount }} 条） | 次/上下文 |
| 255 | [apps/web/src/components/OpportunityFeedbackPanel.vue:118](../../apps/web/src/components/OpportunityFeedbackPanel.vue#L118) | {{ busy ? "正在写入…" : "写入复盘事实" }} | 主/提交 |
| 256 | [apps/web/src/components/OpportunityListPanel.vue:176](../../apps/web/src/components/OpportunityListPanel.vue#L176) | {{ option.label }} | 次/上下文 |
| 257 | [apps/web/src/components/OpportunityListPanel.vue:233](../../apps/web/src/components/OpportunityListPanel.vue#L233) | 筛选 重置 | 主/提交 |
| 258 | [apps/web/src/components/OpportunityListPanel.vue:287](../../apps/web/src/components/OpportunityListPanel.vue#L287) | 批量指派 | 次/上下文 |
| 259 | [apps/web/src/components/OpportunityListPanel.vue:288](../../apps/web/src/components/OpportunityListPanel.vue#L288) | 批量复核 | 次/上下文 |
| 260 | [apps/web/src/components/OpportunityListPanel.vue:289](../../apps/web/src/components/OpportunityListPanel.vue#L289) | 批量归档 | 高影响 |
| 261 | [apps/web/src/components/OpportunityListPanel.vue:347](../../apps/web/src/components/OpportunityListPanel.vue#L347) | 上一页 | 次/上下文 |
| 262 | [apps/web/src/components/OpportunityListPanel.vue:349](../../apps/web/src/components/OpportunityListPanel.vue#L349) | = pageCount" @click="emit('page', page + 1)"> 下一页 | 次/上下文 |
| 263 | [apps/web/src/components/OpportunityMobileShell.vue:17](../../apps/web/src/components/OpportunityMobileShell.vue#L17) | 概览 市场 | 次/上下文 |
| 264 | [apps/web/src/components/OpportunityMobileShell.vue:18](../../apps/web/src/components/OpportunityMobileShell.vue#L18) | 竞争 利润 | 次/上下文 |
| 265 | [apps/web/src/components/OpportunityMobileShell.vue:19](../../apps/web/src/components/OpportunityMobileShell.vue#L19) | 风险 | 次/上下文 |
| 266 | [apps/web/src/components/OpportunityProfitPanel.vue:158](../../apps/web/src/components/OpportunityProfitPanel.vue#L158) | 提交双人复核 重新计算 | 主/提交 |
| 267 | [apps/web/src/components/OpportunityWorkspace.vue:697](../../apps/web/src/components/OpportunityWorkspace.vue#L697) | 从 ERP 导入 手工添加 | 次/上下文 |
| 268 | [apps/web/src/components/OpportunityWorkspace.vue:789](../../apps/web/src/components/OpportunityWorkspace.vue#L789) | 采集 Amazon 竞品 采集公开供应商 检查评分规则 {{ item[1] }} | 次/上下文 |
| 269 | [apps/web/src/components/OpportunityWorkspace.vue:820](../../apps/web/src/components/OpportunityWorkspace.vue#L820) | {{ item[1] }} | 次/上下文 |
| 270 | [apps/web/src/components/OpportunityWorkspace.vue:963](../../apps/web/src/components/OpportunityWorkspace.vue#L963) | 返回 | 次/上下文 |
| 271 | [apps/web/src/components/OpportunityWorkspace.vue:964](../../apps/web/src/components/OpportunityWorkspace.vue#L964) | 确认执行 | 主/提交 |
| 272 | [apps/web/src/components/OpportunityWorkspaceDialogs.vue:57](../../apps/web/src/components/OpportunityWorkspaceDialogs.vue#L57) | × | 次/上下文 |
| 273 | [apps/web/src/components/OpportunityWorkspaceDialogs.vue:83](../../apps/web/src/components/OpportunityWorkspaceDialogs.vue#L83) | 取消 | 次/上下文 |
| 274 | [apps/web/src/components/OpportunityWorkspaceDialogs.vue:84](../../apps/web/src/components/OpportunityWorkspaceDialogs.vue#L84) | {{ busy ? "读取并导入中…" : "从当前浏览器读取" }} | 主/提交 |
| 275 | [apps/web/src/components/OpportunityWorkspaceDialogs.vue:104](../../apps/web/src/components/OpportunityWorkspaceDialogs.vue#L104) | × | 次/上下文 |
| 276 | [apps/web/src/components/OpportunityWorkspaceDialogs.vue:118](../../apps/web/src/components/OpportunityWorkspaceDialogs.vue#L118) | 取消 | 次/上下文 |
| 277 | [apps/web/src/components/OpportunityWorkspaceDialogs.vue:119](../../apps/web/src/components/OpportunityWorkspaceDialogs.vue#L119) | {{ busy ? "创建中…" : "创建机会" }} | 主/提交 |
| 278 | [apps/web/src/components/OpportunityWorkspaceDialogs.vue:137](../../apps/web/src/components/OpportunityWorkspaceDialogs.vue#L137) | × | 次/上下文 |
| 279 | [apps/web/src/components/OpportunityWorkspaceDialogs.vue:144](../../apps/web/src/components/OpportunityWorkspaceDialogs.vue#L144) | 取消 | 次/上下文 |
| 280 | [apps/web/src/components/OpportunityWorkspaceDialogs.vue:145](../../apps/web/src/components/OpportunityWorkspaceDialogs.vue#L145) | {{ busy ? "保存中…" : "确认记录" }} | 主/提交 |
| 281 | [apps/web/src/components/OrganizationAdminCenter.vue:922](../../apps/web/src/components/OrganizationAdminCenter.vue#L922) | {{ refreshing ? "正在刷新…" : "刷新数据" }} | 次/上下文 |
| 282 | [apps/web/src/components/OrganizationAdminCenter.vue:962](../../apps/web/src/components/OrganizationAdminCenter.vue#L962) | 重新加载 | 次/上下文 |
| 283 | [apps/web/src/components/OrganizationAdminCenter.vue:1071](../../apps/web/src/components/OrganizationAdminCenter.vue#L1071) | {{ busy ? "正在保存…" : "保存并审计" }} | 次/上下文 |
| 284 | [apps/web/src/components/OrganizationApprovalPanel.vue:320](../../apps/web/src/components/OrganizationApprovalPanel.vue#L320) | 审批记录 {{ approvals.length }} | 次/上下文 |
| 285 | [apps/web/src/components/OrganizationApprovalPanel.vue:323](../../apps/web/src/components/OrganizationApprovalPanel.vue#L323) | 模板版本 {{ templates.length }} | 次/上下文 |
| 286 | [apps/web/src/components/OrganizationApprovalPanel.vue:377](../../apps/web/src/components/OrganizationApprovalPanel.vue#L377) | 重置 | 次/上下文 |
| 287 | [apps/web/src/components/OrganizationApprovalPanel.vue:437](../../apps/web/src/components/OrganizationApprovalPanel.vue#L437) | 上一页 | 次/上下文 |
| 288 | [apps/web/src/components/OrganizationApprovalPanel.vue:438](../../apps/web/src/components/OrganizationApprovalPanel.vue#L438) | = requestPageCount" @click="requestPage++">下一页 | 次/上下文 |
| 289 | [apps/web/src/components/OrganizationApprovalPanel.vue:505](../../apps/web/src/components/OrganizationApprovalPanel.vue#L505) | 重置 | 次/上下文 |
| 290 | [apps/web/src/components/OrganizationApprovalPanel.vue:510](../../apps/web/src/components/OrganizationApprovalPanel.vue#L510) | {{ template.workspace_name }} {{ template.name }} {{ resourceLabel(template.resource_type) }} · {{ template.node_count }} 个节点 {{ templateLabel(template.status) }} | 次/上下文 |
| 291 | [apps/web/src/components/OrganizationApprovalPanel.vue:528](../../apps/web/src/components/OrganizationApprovalPanel.vue#L528) | 上一页 | 次/上下文 |
| 292 | [apps/web/src/components/OrganizationApprovalPanel.vue:529](../../apps/web/src/components/OrganizationApprovalPanel.vue#L529) | = templatePageCount" @click="templatePage++"> 下一页 | 次/上下文 |
| 293 | [apps/web/src/components/OrganizationAuditPanel.vue:362](../../apps/web/src/components/OrganizationAuditPanel.vue#L362) | {{ busy ? "正在查询…" : "应用筛选" }} | 主/提交 |
| 294 | [apps/web/src/components/OrganizationAuditPanel.vue:363](../../apps/web/src/components/OrganizationAuditPanel.vue#L363) | 重置筛选 | 次/上下文 |
| 295 | [apps/web/src/components/OrganizationAuditPanel.vue:382](../../apps/web/src/components/OrganizationAuditPanel.vue#L382) | 系统连接记录 {{ hiddenSystemEventCount }} 条 高频技术事件默认收起，不影响审计总数、筛选或追踪。 {{ systemEventsExpanded ? "收起" : "展开" }} | 次/上下文 |
| 296 | [apps/web/src/components/OrganizationAuditPanel.vue:395](../../apps/web/src/components/OrganizationAuditPanel.vue#L395) | {{ outcomeLabel(event.outcome)[0] }} {{ actionLabel(event.action) }} {{ resourceLabel(event.resource_type) }} · {{ formatTime(event.occurred_at) }} {{ event.action }} {{ outcomeLabel(event.outcome) }} | 次/上下文 |
| 297 | [apps/web/src/components/OrganizationAuditPanel.vue:434](../../apps/web/src/components/OrganizationAuditPanel.vue#L434) | {{ busy ? "正在加载…" : "加载更多记录" }} | 次/上下文 |
| 298 | [apps/web/src/components/OrganizationAuditPanel.vue:477](../../apps/web/src/components/OrganizationAuditPanel.vue#L477) | {{ copyState === "request:copied" ? "已复制" : copyState === "request:failed" ? "复制失败" : "复制" }} | 次/上下文 |
| 299 | [apps/web/src/components/OrganizationAuditPanel.vue:489](../../apps/web/src/components/OrganizationAuditPanel.vue#L489) | {{ copyState === "trace:copied" ? "已复制" : copyState === "trace:failed" ? "复制失败" : "复制" }} | 次/上下文 |
| 300 | [apps/web/src/components/OrganizationCreationWizard.vue:125](../../apps/web/src/components/OrganizationCreationWizard.vue#L125) | 取消 | 次/上下文 |
| 301 | [apps/web/src/components/OrganizationCreationWizard.vue:126](../../apps/web/src/components/OrganizationCreationWizard.vue#L126) | 上一步 | 次/上下文 |
| 302 | [apps/web/src/components/OrganizationCreationWizard.vue:129](../../apps/web/src/components/OrganizationCreationWizard.vue#L129) | 下一步：选择管理员 | 次/上下文 |
| 303 | [apps/web/src/components/OrganizationCreationWizard.vue:132](../../apps/web/src/components/OrganizationCreationWizard.vue#L132) | {{ busy ? "正在创建…" : "确认创建" }} | 次/上下文 |
| 304 | [apps/web/src/components/OrganizationDataPanel.vue:313](../../apps/web/src/components/OrganizationDataPanel.vue#L313) | 工作区比较 {{ comparisons.length }} | 次/上下文 |
| 305 | [apps/web/src/components/OrganizationDataPanel.vue:316](../../apps/web/src/components/OrganizationDataPanel.vue#L316) | 导出履历 {{ exports.length }} | 次/上下文 |
| 306 | [apps/web/src/components/OrganizationDataPanel.vue:353](../../apps/web/src/components/OrganizationDataPanel.vue#L353) | 重置筛选 | 次/上下文 |
| 307 | [apps/web/src/components/OrganizationDataPanel.vue:396](../../apps/web/src/components/OrganizationDataPanel.vue#L396) | 上一页 = workspacePageCount" @click="workspacePage += 1" > 下一页 | 次/上下文 |
| 308 | [apps/web/src/components/OrganizationDataPanel.vue:468](../../apps/web/src/components/OrganizationDataPanel.vue#L468) | 重置筛选 | 次/上下文 |
| 309 | [apps/web/src/components/OrganizationDataPanel.vue:514](../../apps/web/src/components/OrganizationDataPanel.vue#L514) | 上一页 = exportPageCount" @click="exportPage += 1" > 下一页 | 次/上下文 |
| 310 | [apps/web/src/components/OrganizationMemberPanel.vue:72](../../apps/web/src/components/OrganizationMemberPanel.vue#L72) | {{ busy ? "正在创建…" : "创建邀请" }} | 次/上下文 |
| 311 | [apps/web/src/components/OrganizationMemberPanel.vue:87](../../apps/web/src/components/OrganizationMemberPanel.vue#L87) | 待接受 {{ pendingInvitations.length }} | 次/上下文 |
| 312 | [apps/web/src/components/OrganizationMemberPanel.vue:93](../../apps/web/src/components/OrganizationMemberPanel.vue#L93) | 已失效 {{ expiredInvitations.length }} | 次/上下文 |
| 313 | [apps/web/src/components/OrganizationMemberPanel.vue:112](../../apps/web/src/components/OrganizationMemberPanel.vue#L112) | 撤销邀请 | 次/上下文 |
| 314 | [apps/web/src/components/OrganizationMemberPanel.vue:169](../../apps/web/src/components/OrganizationMemberPanel.vue#L169) | 重置筛选 | 次/上下文 |
| 315 | [apps/web/src/components/OrganizationMemberPanel.vue:201](../../apps/web/src/components/OrganizationMemberPanel.vue#L201) | 分配角色 | 次/上下文 |
| 316 | [apps/web/src/components/OrganizationMemberPanel.vue:204](../../apps/web/src/components/OrganizationMemberPanel.vue#L204) | {{ member.status === "active" ? "禁用成员" : "恢复成员" }} | 次/上下文 |
| 317 | [apps/web/src/components/OrganizationMemberPanel.vue:214](../../apps/web/src/components/OrganizationMemberPanel.vue#L214) | 上一页 | 次/上下文 |
| 318 | [apps/web/src/components/OrganizationMemberPanel.vue:223](../../apps/web/src/components/OrganizationMemberPanel.vue#L223) | = memberPageCount" @click="emit('updateMemberPage', memberPage + 1)" > 下一页 | 次/上下文 |
| 319 | [apps/web/src/components/OrganizationRolePanel.vue:246](../../apps/web/src/components/OrganizationRolePanel.vue#L246) | {{ item.label }} | 次/上下文 |
| 320 | [apps/web/src/components/OrganizationRolePanel.vue:273](../../apps/web/src/components/OrganizationRolePanel.vue#L273) | {{ role.name.slice(0, 1) }} {{ role.name }} {{ role.description }} {{ role.capabilities.length }} 项 | 次/上下文 |
| 321 | [apps/web/src/components/OrganizationRolePanel.vue:338](../../apps/web/src/components/OrganizationRolePanel.vue#L338) | 重置 | 次/上下文 |
| 322 | [apps/web/src/components/OrganizationRolePanel.vue:413](../../apps/web/src/components/OrganizationRolePanel.vue#L413) | 重置 | 次/上下文 |
| 323 | [apps/web/src/components/OrganizationRolePanel.vue:448](../../apps/web/src/components/OrganizationRolePanel.vue#L448) | {{ showGrantForm ? "取消创建" : "创建授权" }} | 次/上下文 |
| 324 | [apps/web/src/components/OrganizationRolePanel.vue:518](../../apps/web/src/components/OrganizationRolePanel.vue#L518) | {{ busy ? "正在创建…" : "创建并写入审计" }} | 次/上下文 |
| 325 | [apps/web/src/components/OrganizationRolePanel.vue:525](../../apps/web/src/components/OrganizationRolePanel.vue#L525) | {{ status === "all" ? `全部 ${grantTotal}` : `${grantStatusText(status)} ${grantCounts[status] ?? 0}` }} | 次/上下文 |
| 326 | [apps/web/src/components/OrganizationRolePanel.vue:550](../../apps/web/src/components/OrganizationRolePanel.vue#L550) | {{ grantStatusText(grant.effective_status) }} {{ resourceTypeText(grant.resource_type) }} · {{ targetLabel(grant.grantee_membership_id) }} {{ workspaceLabel(grant.workspace_id) }} 到期 {{ formatTime(grant.expires_at) }} | 次/上下文 |
| 327 | [apps/web/src/components/OrganizationRolePanel.vue:631](../../apps/web/src/components/OrganizationRolePanel.vue#L631) | {{ busy ? "正在保存…" : "延长授权" }} | 次/上下文 |
| 328 | [apps/web/src/components/OrganizationRolePanel.vue:632](../../apps/web/src/components/OrganizationRolePanel.vue#L632) | 撤销授权 | 高影响 |
| 329 | [apps/web/src/components/OrganizationRolePanel.vue:646](../../apps/web/src/components/OrganizationRolePanel.vue#L646) | 上一页 | 次/上下文 |
| 330 | [apps/web/src/components/OrganizationRolePanel.vue:654](../../apps/web/src/components/OrganizationRolePanel.vue#L654) | = grantPageCount" @click="emit('updateGrantPage', grantMeta.page + 1)" > 下一页 | 次/上下文 |
| 331 | [apps/web/src/components/OrganizationRolePanel.vue:665](../../apps/web/src/components/OrganizationRolePanel.vue#L665) | 创建首条授权 | 次/上下文 |
| 332 | [apps/web/src/components/OrganizationRolePanel.vue:670](../../apps/web/src/components/OrganizationRolePanel.vue#L670) | 查看全部授权 | 次/上下文 |
| 333 | [apps/web/src/components/OrganizationTeamPanel.vue:178](../../apps/web/src/components/OrganizationTeamPanel.vue#L178) | 新建团队 | 次/上下文 |
| 334 | [apps/web/src/components/OrganizationTeamPanel.vue:215](../../apps/web/src/components/OrganizationTeamPanel.vue#L215) | 取消 | 次/上下文 |
| 335 | [apps/web/src/components/OrganizationTeamPanel.vue:274](../../apps/web/src/components/OrganizationTeamPanel.vue#L274) | {{ createBusy ? "正在创建…" : "创建并写入审计" }} | 主/提交 |
| 336 | [apps/web/src/components/OrganizationTeamPanel.vue:290](../../apps/web/src/components/OrganizationTeamPanel.vue#L290) | 全部 {{ teams.length }} | 次/上下文 |
| 337 | [apps/web/src/components/OrganizationTeamPanel.vue:297](../../apps/web/src/components/OrganizationTeamPanel.vue#L297) | 正常使用 {{ activeCount }} | 次/上下文 |
| 338 | [apps/web/src/components/OrganizationTeamPanel.vue:304](../../apps/web/src/components/OrganizationTeamPanel.vue#L304) | 已归档 {{ archivedCount }} | 次/上下文 |
| 339 | [apps/web/src/components/OrganizationTeamPanel.vue:324](../../apps/web/src/components/OrganizationTeamPanel.vue#L324) | 重置筛选 | 次/上下文 |
| 340 | [apps/web/src/components/OrganizationTeamPanel.vue:328](../../apps/web/src/components/OrganizationTeamPanel.vue#L328) | {{ team.name.slice(0, 1) }} {{ team.name }} {{ team.member_count }} 名成员 · {{ team.lead_email \|\| "未设负责人" }} 有默认流程 {{ statusText(team.status) }} | 次/上下文 |
| 341 | [apps/web/src/components/OrganizationTeamPanel.vue:357](../../apps/web/src/components/OrganizationTeamPanel.vue#L357) | 清除筛选 | 次/上下文 |
| 342 | [apps/web/src/components/OrganizationTeamPanel.vue:365](../../apps/web/src/components/OrganizationTeamPanel.vue#L365) | 创建团队 | 次/上下文 |
| 343 | [apps/web/src/components/OrganizationTeamPanel.vue:372](../../apps/web/src/components/OrganizationTeamPanel.vue#L372) | 上一页 | 次/上下文 |
| 344 | [apps/web/src/components/OrganizationTeamPanel.vue:381](../../apps/web/src/components/OrganizationTeamPanel.vue#L381) | = pageCount" @click="page += 1" > 下一页 | 次/上下文 |
| 345 | [apps/web/src/components/OrganizationTeamPanel.vue:446](../../apps/web/src/components/OrganizationTeamPanel.vue#L446) | 分配成员 | 次/上下文 |
| 346 | [apps/web/src/components/OrganizationTeamPanel.vue:453](../../apps/web/src/components/OrganizationTeamPanel.vue#L453) | 移除成员 | 次/上下文 |
| 347 | [apps/web/src/components/OrganizationTokenPanel.vue:313](../../apps/web/src/components/OrganizationTokenPanel.vue#L313) | 复制明文 | 次/上下文 |
| 348 | [apps/web/src/components/OrganizationTokenPanel.vue:314](../../apps/web/src/components/OrganizationTokenPanel.vue#L314) | 我已安全保存 | 次/上下文 |
| 349 | [apps/web/src/components/OrganizationTokenPanel.vue:374](../../apps/web/src/components/OrganizationTokenPanel.vue#L374) | {{ days }} 天 | 次/上下文 |
| 350 | [apps/web/src/components/OrganizationTokenPanel.vue:421](../../apps/web/src/components/OrganizationTokenPanel.vue#L421) | {{ busy ? "正在创建并写入审计…" : "创建并显示一次明文" }} | 主/提交 |
| 351 | [apps/web/src/components/OrganizationTokenPanel.vue:471](../../apps/web/src/components/OrganizationTokenPanel.vue#L471) | 重置筛选 | 次/上下文 |
| 352 | [apps/web/src/components/OrganizationTokenPanel.vue:508](../../apps/web/src/components/OrganizationTokenPanel.vue#L508) | 轮换密钥 | 次/上下文 |
| 353 | [apps/web/src/components/OrganizationTokenPanel.vue:516](../../apps/web/src/components/OrganizationTokenPanel.vue#L516) | 撤销访问 | 高影响 |
| 354 | [apps/web/src/components/OrganizationTokenPanel.vue:546](../../apps/web/src/components/OrganizationTokenPanel.vue#L546) | 上一页 | 次/上下文 |
| 355 | [apps/web/src/components/OrganizationTokenPanel.vue:554](../../apps/web/src/components/OrganizationTokenPanel.vue#L554) | = pageCount" @click="tokenPage += 1" > 下一页 | 次/上下文 |
| 356 | [apps/web/src/components/OrganizationWorkspacePanel.vue:135](../../apps/web/src/components/OrganizationWorkspacePanel.vue#L135) | 新建工作区 | 次/上下文 |
| 357 | [apps/web/src/components/OrganizationWorkspacePanel.vue:168](../../apps/web/src/components/OrganizationWorkspacePanel.vue#L168) | 取消 | 次/上下文 |
| 358 | [apps/web/src/components/OrganizationWorkspacePanel.vue:219](../../apps/web/src/components/OrganizationWorkspacePanel.vue#L219) | {{ createBusy ? "正在创建…" : "创建并写入审计" }} | 主/提交 |
| 359 | [apps/web/src/components/OrganizationWorkspacePanel.vue:235](../../apps/web/src/components/OrganizationWorkspacePanel.vue#L235) | 全部 {{ workspaces.length }} | 次/上下文 |
| 360 | [apps/web/src/components/OrganizationWorkspacePanel.vue:242](../../apps/web/src/components/OrganizationWorkspacePanel.vue#L242) | 正常使用 {{ activeCount }} | 次/上下文 |
| 361 | [apps/web/src/components/OrganizationWorkspacePanel.vue:249](../../apps/web/src/components/OrganizationWorkspacePanel.vue#L249) | 已归档 {{ archivedCount }} | 次/上下文 |
| 362 | [apps/web/src/components/OrganizationWorkspacePanel.vue:270](../../apps/web/src/components/OrganizationWorkspacePanel.vue#L270) | 重置筛选 | 次/上下文 |
| 363 | [apps/web/src/components/OrganizationWorkspacePanel.vue:274](../../apps/web/src/components/OrganizationWorkspacePanel.vue#L274) | {{ workspace.name.slice(0, 1) }} {{ workspace.name }} {{ workspace.member_count }} 名明确范围成员 · 第 {{ workspace.version }} 版 默认 {{ statusText(workspace.status) }} | 次/上下文 |
| 364 | [apps/web/src/components/OrganizationWorkspacePanel.vue:305](../../apps/web/src/components/OrganizationWorkspacePanel.vue#L305) | 清除筛选 | 次/上下文 |
| 365 | [apps/web/src/components/OrganizationWorkspacePanel.vue:313](../../apps/web/src/components/OrganizationWorkspacePanel.vue#L313) | 创建工作区 | 次/上下文 |
| 366 | [apps/web/src/components/OrganizationWorkspacePanel.vue:320](../../apps/web/src/components/OrganizationWorkspacePanel.vue#L320) | 上一页 | 次/上下文 |
| 367 | [apps/web/src/components/OrganizationWorkspacePanel.vue:329](../../apps/web/src/components/OrganizationWorkspacePanel.vue#L329) | = pageCount" @click="page += 1" > 下一页 | 次/上下文 |
| 368 | [apps/web/src/components/OrganizationWorkspacePanel.vue:389](../../apps/web/src/components/OrganizationWorkspacePanel.vue#L389) | {{ selectedWorkspace.status === "active" ? selectedIsDefault ? "默认工作区不可归档" : "归档工作区" : "恢复工作区" }} | 次/上下文 |
| 369 | [apps/web/src/components/PersonalCenter.vue:291](../../apps/web/src/components/PersonalCenter.vue#L291) | 刷新 | 次/上下文 |
| 370 | [apps/web/src/components/PersonalCenter.vue:303](../../apps/web/src/components/PersonalCenter.vue#L303) | 重新加载 | 次/上下文 |
| 371 | [apps/web/src/components/PersonalCenter.vue:307](../../apps/web/src/components/PersonalCenter.vue#L307) | {{ item.name }} | 次/上下文 |
| 372 | [apps/web/src/components/PersonalCenter.vue:352](../../apps/web/src/components/PersonalCenter.vue#L352) | 保存资料 | 次/上下文 |
| 373 | [apps/web/src/components/PersonalCenter.vue:407](../../apps/web/src/components/PersonalCenter.vue#L407) | 修改并撤销全部会话 | 次/上下文 |
| 374 | [apps/web/src/components/PersonalCenter.vue:416](../../apps/web/src/components/PersonalCenter.vue#L416) | 撤销会话 | 次/上下文 |
| 375 | [apps/web/src/components/PersonalCenter.vue:432](../../apps/web/src/components/PersonalCenter.vue#L432) | 保存偏好 | 次/上下文 |
| 376 | [apps/web/src/components/PlatformAccountCenter.vue:626](../../apps/web/src/components/PlatformAccountCenter.vue#L626) | {{ rolesLoading ? "正在刷新…" : "刷新角色目录" }} | 次/上下文 |
| 377 | [apps/web/src/components/PlatformAccountCenter.vue:631](../../apps/web/src/components/PlatformAccountCenter.vue#L631) | 新建组织 {{ tab === "admins" ? "新建管理员" : "新建用户" }} {{ refreshing ? "正在刷新…" : "刷新数据" }} | 次/上下文 |
| 378 | [apps/web/src/components/PlatformAccountCenter.vue:663](../../apps/web/src/components/PlatformAccountCenter.vue#L663) | 重新加载 | 次/上下文 |
| 379 | [apps/web/src/components/PlatformAccountCenter.vue:668](../../apps/web/src/components/PlatformAccountCenter.vue#L668) | 重新检查 | 次/上下文 |
| 380 | [apps/web/src/components/PlatformAccountCenter.vue:718](../../apps/web/src/components/PlatformAccountCenter.vue#L718) | 搜索 重置 | 次/上下文 |
| 381 | [apps/web/src/components/PlatformAccountCenter.vue:733](../../apps/web/src/components/PlatformAccountCenter.vue#L733) | 重新加载 | 次/上下文 |
| 382 | [apps/web/src/components/PlatformAccountCenter.vue:743](../../apps/web/src/components/PlatformAccountCenter.vue#L743) | 清除筛选 | 次/上下文 |
| 383 | [apps/web/src/components/PlatformAccountCenter.vue:744](../../apps/web/src/components/PlatformAccountCenter.vue#L744) | 新建组织 | 次/上下文 |
| 384 | [apps/web/src/components/PlatformAccountCenter.vue:769](../../apps/web/src/components/PlatformAccountCenter.vue#L769) | 清除筛选 | 次/上下文 |
| 385 | [apps/web/src/components/PlatformAccountCenter.vue:770](../../apps/web/src/components/PlatformAccountCenter.vue#L770) | 新建管理员 | 次/上下文 |
| 386 | [apps/web/src/components/PlatformAccountDialogs.vue:110](../../apps/web/src/components/PlatformAccountDialogs.vue#L110) | 取消 | 次/上下文 |
| 387 | [apps/web/src/components/PlatformAccountDialogs.vue:111](../../apps/web/src/components/PlatformAccountDialogs.vue#L111) | 确认创建 | 次/上下文 |
| 388 | [apps/web/src/components/PlatformAccountDialogs.vue:133](../../apps/web/src/components/PlatformAccountDialogs.vue#L133) | 取消 | 次/上下文 |
| 389 | [apps/web/src/components/PlatformAccountDialogs.vue:134](../../apps/web/src/components/PlatformAccountDialogs.vue#L134) | 确认重置 | 次/上下文 |
| 390 | [apps/web/src/components/PlatformAccountDialogs.vue:153](../../apps/web/src/components/PlatformAccountDialogs.vue#L153) | 取消 | 次/上下文 |
| 391 | [apps/web/src/components/PlatformAccountDialogs.vue:154](../../apps/web/src/components/PlatformAccountDialogs.vue#L154) | 确认执行 | 次/上下文 |
| 392 | [apps/web/src/components/PlatformAdminRecords.vue:47](../../apps/web/src/components/PlatformAdminRecords.vue#L47) | 账号详情 | 次/上下文 |
| 393 | [apps/web/src/components/PlatformAdminRecords.vue:74](../../apps/web/src/components/PlatformAdminRecords.vue#L74) | 打开账号详情 | 次/上下文 |
| 394 | [apps/web/src/components/PlatformContentPagination.vue:15](../../apps/web/src/components/PlatformContentPagination.vue#L15) | 上一页 | 次/上下文 |
| 395 | [apps/web/src/components/PlatformContentPagination.vue:22](../../apps/web/src/components/PlatformContentPagination.vue#L22) | = pagination.total_pages" @click="$emit('change', pagination.page + 1)" > 下一页 | 次/上下文 |
| 396 | [apps/web/src/components/PlatformDashboard.vue:223](../../apps/web/src/components/PlatformDashboard.vue#L223) | {{ pending ? "刷新中…" : "刷新" }} | 次/上下文 |
| 397 | [apps/web/src/components/PlatformDashboard.vue:232](../../apps/web/src/components/PlatformDashboard.vue#L232) | 重新读取 重新登录 {{ refreshError }} 重新刷新 | 次/上下文 |
| 398 | [apps/web/src/components/PlatformDashboard.vue:448](../../apps/web/src/components/PlatformDashboard.vue#L448) | providerHealthLimit" type="button" class="platform-provider-disclosure" :aria-expanded="providerHealthExpanded" @click="providerHealthExpanded = !providerHealthExpanded" > {{ providerHealthExpanded ? `收起来源，仅看前 ${providerHealthLimit} 个` : `查看全部 ${data.provider_health.length} 个来源（还有 ${hiddenProviderHealthCount} 个）` }} | 次/上下文 |
| 399 | [apps/web/src/components/PlatformDataCenter.vue:284](../../apps/web/src/components/PlatformDataCenter.vue#L284) | 近期记录 | 次/上下文 |
| 400 | [apps/web/src/components/PlatformDataCenter.vue:290](../../apps/web/src/components/PlatformDataCenter.vue#L290) | 证据与质量 | 次/上下文 |
| 401 | [apps/web/src/components/PlatformDataCenter.vue:302](../../apps/web/src/components/PlatformDataCenter.vue#L302) | {{ item.label }} | 次/上下文 |
| 402 | [apps/web/src/components/PlatformDataCenter.vue:330](../../apps/web/src/components/PlatformDataCenter.vue#L330) | {{ refreshing ? "正在筛选…" : "筛选" }} | 次/上下文 |
| 403 | [apps/web/src/components/PlatformDataCenter.vue:331](../../apps/web/src/components/PlatformDataCenter.vue#L331) | 重置 | 次/上下文 |
| 404 | [apps/web/src/components/PlatformDataCenter.vue:338](../../apps/web/src/components/PlatformDataCenter.vue#L338) | {{ exporting ? "正在导出…" : "导出表格文件" }} | 次/上下文 |
| 405 | [apps/web/src/components/PlatformDataCenter.vue:355](../../apps/web/src/components/PlatformDataCenter.vue#L355) | 重新加载 | 次/上下文 |
| 406 | [apps/web/src/components/PlatformDataCenter.vue:453](../../apps/web/src/components/PlatformDataCenter.vue#L453) | 上一页 | 次/上下文 |
| 407 | [apps/web/src/components/PlatformDataCenter.vue:461](../../apps/web/src/components/PlatformDataCenter.vue#L461) | = pagination.total_pages" @click="goToPage(pagination.page + 1)" > 下一页 | 次/上下文 |
| 408 | [apps/web/src/components/PlatformGovernanceCenter.vue:291](../../apps/web/src/components/PlatformGovernanceCenter.vue#L291) | {{ refreshing ? "刷新中…" : "刷新事实" }} | 次/上下文 |
| 409 | [apps/web/src/components/PlatformGovernanceCenter.vue:313](../../apps/web/src/components/PlatformGovernanceCenter.vue#L313) | 应用筛选 | 主/提交 |
| 410 | [apps/web/src/components/PlatformGovernanceCenter.vue:314](../../apps/web/src/components/PlatformGovernanceCenter.vue#L314) | 重置 | 次/上下文 |
| 411 | [apps/web/src/components/PlatformGovernanceCenter.vue:333](../../apps/web/src/components/PlatformGovernanceCenter.vue#L333) | 重新加载 | 次/上下文 |
| 412 | [apps/web/src/components/PlatformGovernanceCenter.vue:342](../../apps/web/src/components/PlatformGovernanceCenter.vue#L342) | {{ item.label }} | 次/上下文 |
| 413 | [apps/web/src/components/PlatformGovernanceCenter.vue:398](../../apps/web/src/components/PlatformGovernanceCenter.vue#L398) | 查看详情 {{ section === "automation_rules" ? "编辑规则" : "进入工作台" }} 技术详情 {{ item.version_code \|\| item.id }} {{ row.name }} · {{ statusName(row.status) }} {{ row.organization_name \|\| "平台全局" }} · {{ versionText(row) }} 所属组织 {{ row.organization_name \|\| "平台全局" }} 工作区或阶段 {{ row.workspace_name \|\| row.stage \|\| "—" }} 类型 {{ typeName(row.trigger_event_type \|\| row.resource_type \|\| row.platform \|\| section) }} 当前状态 {{ statusName(row.status) }} 版本 {{ versionText(row) }} 更新时间 {{ row.updated_at ? new Date(row.updated_at).toLocaleString("zh-CN") : "—" }} 技术详情 记录 ID {{ row.id }} 版本代码 {{ row.version_code }} {{ section === "automation_rules" ? "进入规则编辑" : "进入所属工作台" }} {{ rangeLabel }} 1" aria-label="治理页码"> 上一页 | 次/上下文 |
| 414 | [apps/web/src/components/PlatformGovernanceCenter.vue:481](../../apps/web/src/components/PlatformGovernanceCenter.vue#L481) | = pagination.total_pages" @click="goToPage(pagination.page + 1)" > 下一页 | 次/上下文 |
| 415 | [apps/web/src/components/PlatformGovernanceCenter.vue:522](../../apps/web/src/components/PlatformGovernanceCenter.vue#L522) | × | 次/上下文 |
| 416 | [apps/web/src/components/PlatformLogCenter.vue:265](../../apps/web/src/components/PlatformLogCenter.vue#L265) | {{ exporting ? "正在导出…" : "导出当前筛选" }} | 次/上下文 |
| 417 | [apps/web/src/components/PlatformLogCenter.vue:268](../../apps/web/src/components/PlatformLogCenter.vue#L268) | {{ refreshing ? "正在刷新…" : "刷新日志" }} | 次/上下文 |
| 418 | [apps/web/src/components/PlatformLogCenter.vue:294](../../apps/web/src/components/PlatformLogCenter.vue#L294) | 重置 | 次/上下文 |
| 419 | [apps/web/src/components/PlatformLogCenter.vue:297](../../apps/web/src/components/PlatformLogCenter.vue#L297) | 检索 | 次/上下文 |
| 420 | [apps/web/src/components/PlatformLogCenter.vue:317](../../apps/web/src/components/PlatformLogCenter.vue#L317) | 重新加载 | 次/上下文 |
| 421 | [apps/web/src/components/PlatformManagementCenter.vue:383](../../apps/web/src/components/PlatformManagementCenter.vue#L383) | 发布通知 | 次/上下文 |
| 422 | [apps/web/src/components/PlatformManagementCenter.vue:386](../../apps/web/src/components/PlatformManagementCenter.vue#L386) | 发送邮件 | 次/上下文 |
| 423 | [apps/web/src/components/PlatformManagementCenter.vue:387](../../apps/web/src/components/PlatformManagementCenter.vue#L387) | {{ refreshing ? "刷新中…" : "刷新数据" }} | 次/上下文 |
| 424 | [apps/web/src/components/PlatformManagementCenter.vue:414](../../apps/web/src/components/PlatformManagementCenter.vue#L414) | 重新加载 | 次/上下文 |
| 425 | [apps/web/src/components/PlatformManagementCenter.vue:616](../../apps/web/src/components/PlatformManagementCenter.vue#L616) | 取消 确认更新 | 次/上下文 |
| 426 | [apps/web/src/components/PlatformManagementFilter.vue:61](../../apps/web/src/components/PlatformManagementFilter.vue#L61) | 筛选 重置 | 次/上下文 |
| 427 | [apps/web/src/components/PlatformManagementRecordList.vue:75](../../apps/web/src/components/PlatformManagementRecordList.vue#L75) | 展示 无关 过期 | 次/上下文 |
| 428 | [apps/web/src/components/PlatformManagementRecordList.vue:133](../../apps/web/src/components/PlatformManagementRecordList.vue#L133) | 设为展示中 | 次/上下文 |
| 429 | [apps/web/src/components/PlatformManagementRecordList.vue:142](../../apps/web/src/components/PlatformManagementRecordList.vue#L142) | 标记无关 | 次/上下文 |
| 430 | [apps/web/src/components/PlatformManagementRecordList.vue:152](../../apps/web/src/components/PlatformManagementRecordList.vue#L152) | 标记过期 | 次/上下文 |
| 431 | [apps/web/src/components/PlatformManagementRecordList.vue:218](../../apps/web/src/components/PlatformManagementRecordList.vue#L218) | 重新投递 | 次/上下文 |
| 432 | [apps/web/src/components/PlatformManagementRecordList.vue:226](../../apps/web/src/components/PlatformManagementRecordList.vue#L226) | 抑制投递 | 次/上下文 |
| 433 | [apps/web/src/components/PlatformManagementRecordList.vue:278](../../apps/web/src/components/PlatformManagementRecordList.vue#L278) | 重新投递 | 次/上下文 |
| 434 | [apps/web/src/components/PlatformManagementRecordList.vue:288](../../apps/web/src/components/PlatformManagementRecordList.vue#L288) | 抑制投递 | 次/上下文 |
| 435 | [apps/web/src/components/PlatformMessageEditor.vue:32](../../apps/web/src/components/PlatformMessageEditor.vue#L32) | × | 次/上下文 |
| 436 | [apps/web/src/components/PlatformMessageEditor.vue:117](../../apps/web/src/components/PlatformMessageEditor.vue#L117) | 取消 | 次/上下文 |
| 437 | [apps/web/src/components/PlatformMessageEditor.vue:118](../../apps/web/src/components/PlatformMessageEditor.vue#L118) | {{ saving ? "保存中…" : "保存草稿" }} | 次/上下文 |
| 438 | [apps/web/src/components/PlatformMessageWorkbench.vue:65](../../apps/web/src/components/PlatformMessageWorkbench.vue#L65) | 编辑 | 次/上下文 |
| 439 | [apps/web/src/components/PlatformMessageWorkbench.vue:66](../../apps/web/src/components/PlatformMessageWorkbench.vue#L66) | {{ item.kind === "email" ? "发送" : "发布" }} | 次/上下文 |
| 440 | [apps/web/src/components/PlatformMessageWorkbench.vue:69](../../apps/web/src/components/PlatformMessageWorkbench.vue#L69) | 取消草稿 | 次/上下文 |
| 441 | [apps/web/src/components/PlatformNotificationPagination.vue:17](../../apps/web/src/components/PlatformNotificationPagination.vue#L17) | 上一页 | 次/上下文 |
| 442 | [apps/web/src/components/PlatformNotificationPagination.vue:24](../../apps/web/src/components/PlatformNotificationPagination.vue#L24) | = pagination.total_pages" @click="$emit('change', pagination.page + 1)" > 下一页 | 次/上下文 |
| 443 | [apps/web/src/components/PlatformOrganizationDetailDialog.vue:40](../../apps/web/src/components/PlatformOrganizationDetailDialog.vue#L40) | 重新加载 | 次/上下文 |
| 444 | [apps/web/src/components/PlatformOrganizationDetailDialog.vue:43](../../apps/web/src/components/PlatformOrganizationDetailDialog.vue#L43) | 返回组织列表 | 次/上下文 |
| 445 | [apps/web/src/components/PlatformOrganizationDetailDialog.vue:52](../../apps/web/src/components/PlatformOrganizationDetailDialog.vue#L52) | 关闭 | 次/上下文 |
| 446 | [apps/web/src/components/PlatformOrganizationDetailDialog.vue:112](../../apps/web/src/components/PlatformOrganizationDetailDialog.vue#L112) | {{ organization.status === "active" ? "停用组织" : "恢复组织" }} | 高影响 |
| 447 | [apps/web/src/components/PlatformOrganizationDetailDialog.vue:120](../../apps/web/src/components/PlatformOrganizationDetailDialog.vue#L120) | 关闭 | 次/上下文 |
| 448 | [apps/web/src/components/PlatformOrganizationDetailDialog.vue:121](../../apps/web/src/components/PlatformOrganizationDetailDialog.vue#L121) | 保存组织资料 | 次/上下文 |
| 449 | [apps/web/src/components/PlatformOrganizationRecords.vue:44](../../apps/web/src/components/PlatformOrganizationRecords.vue#L44) | 查看详情 | 次/上下文 |
| 450 | [apps/web/src/components/PlatformOrganizationRecords.vue:79](../../apps/web/src/components/PlatformOrganizationRecords.vue#L79) | 打开组织详情 | 次/上下文 |
| 451 | [apps/web/src/components/PlatformRoleComparison.vue:197](../../apps/web/src/components/PlatformRoleComparison.vue#L197) | 重置 | 次/上下文 |
| 452 | [apps/web/src/components/PlatformUserDetailDialog.vue:51](../../apps/web/src/components/PlatformUserDetailDialog.vue#L51) | 关闭 | 次/上下文 |
| 453 | [apps/web/src/components/PlatformUserDetailDialog.vue:105](../../apps/web/src/components/PlatformUserDetailDialog.vue#L105) | 撤销 | 次/上下文 |
| 454 | [apps/web/src/components/PlatformUserDetailDialog.vue:117](../../apps/web/src/components/PlatformUserDetailDialog.vue#L117) | {{ currentRoles().includes(code) ? "撤销" : "授予" }}{{ roleText(code) }} | 次/上下文 |
| 455 | [apps/web/src/components/PlatformUserDetailDialog.vue:127](../../apps/web/src/components/PlatformUserDetailDialog.vue#L127) | {{ selected?.status === "active" ? "停用登录" : "恢复登录" }} | 高影响 |
| 456 | [apps/web/src/components/PlatformUserDetailDialog.vue:130](../../apps/web/src/components/PlatformUserDetailDialog.vue#L130) | 强制改密 | 次/上下文 |
| 457 | [apps/web/src/components/PlatformUserDetailDialog.vue:131](../../apps/web/src/components/PlatformUserDetailDialog.vue#L131) | 撤销全部会话 | 次/上下文 |
| 458 | [apps/web/src/components/PlatformUserDetailDialog.vue:134](../../apps/web/src/components/PlatformUserDetailDialog.vue#L134) | 关闭 | 次/上下文 |
| 459 | [apps/web/src/components/PlatformUserDetailDialog.vue:141](../../apps/web/src/components/PlatformUserDetailDialog.vue#L141) | 重试 | 次/上下文 |
| 460 | [apps/web/src/components/PlatformUserDetailDialog.vue:142](../../apps/web/src/components/PlatformUserDetailDialog.vue#L142) | 关闭 | 次/上下文 |
| 461 | [apps/web/src/components/PlatformUserMembershipForm.vue:73](../../apps/web/src/components/PlatformUserMembershipForm.vue#L73) | 加入组织 | 次/上下文 |
| 462 | [apps/web/src/components/PlatformUserRecords.vue:43](../../apps/web/src/components/PlatformUserRecords.vue#L43) | 账号详情 | 次/上下文 |
| 463 | [apps/web/src/components/PlatformUserRecords.vue:80](../../apps/web/src/components/PlatformUserRecords.vue#L80) | 打开账号详情 | 次/上下文 |
| 464 | [apps/web/src/components/ProviderAdapterCenter.vue:241](../../apps/web/src/components/ProviderAdapterCenter.vue#L241) | {{ refreshing ? "刷新中…" : "刷新状态" }} | 次/上下文 |
| 465 | [apps/web/src/components/ProviderAdapterCenter.vue:326](../../apps/web/src/components/ProviderAdapterCenter.vue#L326) | 重置 | 次/上下文 |
| 466 | [apps/web/src/components/ProviderAdapterCenter.vue:337](../../apps/web/src/components/ProviderAdapterCenter.vue#L337) | 清除筛选 | 次/上下文 |
| 467 | [apps/web/src/components/ProviderAdapterCenter.vue:433](../../apps/web/src/components/ProviderAdapterCenter.vue#L433) | {{ probing === item.id ? "检查中…" : "健康检查" }} | 次/上下文 |
| 468 | [apps/web/src/components/ProviderAdapterCenter.vue:521](../../apps/web/src/components/ProviderAdapterCenter.vue#L521) | {{ probing === row.id ? "检查中…" : "执行健康检查" }} | 次/上下文 |
| 469 | [apps/web/src/components/ProviderAdapterCenter.vue:565](../../apps/web/src/components/ProviderAdapterCenter.vue#L565) | 上一页 | 次/上下文 |
| 470 | [apps/web/src/components/ProviderAdapterCenter.vue:567](../../apps/web/src/components/ProviderAdapterCenter.vue#L567) | 下一页 | 次/上下文 |
| 471 | [apps/web/src/components/ProviderCompatibilityMatrixDialog.vue:34](../../apps/web/src/components/ProviderCompatibilityMatrixDialog.vue#L34) | × | 次/上下文 |
| 472 | [apps/web/src/components/ProviderParserSampleDialog.vue:70](../../apps/web/src/components/ProviderParserSampleDialog.vue#L70) | × | 次/上下文 |
| 473 | [apps/web/src/components/ProviderParserSampleDialog.vue:85](../../apps/web/src/components/ProviderParserSampleDialog.vue#L85) | {{ savingCandidateId === candidate.browser_job_id ? "保存中…" : "固定为样本" }} | 次/上下文 |
| 474 | [apps/web/src/components/ProviderParserSampleDialog.vue:118](../../apps/web/src/components/ProviderParserSampleDialog.vue#L118) | {{ replayingSampleId === sample.id ? "回放中…" : "运行差异回放" }} | 次/上下文 |
| 475 | [apps/web/src/components/ProviderParserSampleReview.vue:38](../../apps/web/src/components/ProviderParserSampleReview.vue#L38) | 审批通过 | 主/提交 |
| 476 | [apps/web/src/components/ProviderParserSampleReview.vue:45](../../apps/web/src/components/ProviderParserSampleReview.vue#L45) | 驳回样本 | 主/提交 |
| 477 | [apps/web/src/components/ProviderRegistry.vue:484](../../apps/web/src/components/ProviderRegistry.vue#L484) | ＋ 新建来源 | 次/上下文 |
| 478 | [apps/web/src/components/ProviderRegistry.vue:515](../../apps/web/src/components/ProviderRegistry.vue#L515) | 再次刷新 | 次/上下文 |
| 479 | [apps/web/src/components/ProviderRegistry.vue:526](../../apps/web/src/components/ProviderRegistry.vue#L526) | 登记第一个来源 | 次/上下文 |
| 480 | [apps/web/src/components/ProviderRegistry.vue:534](../../apps/web/src/components/ProviderRegistry.vue#L534) | {{ refreshing ? "刷新中…" : "刷新真实数据" }} | 次/上下文 |
| 481 | [apps/web/src/components/ProviderRegistry.vue:582](../../apps/web/src/components/ProviderRegistry.vue#L582) | 重置 | 次/上下文 |
| 482 | [apps/web/src/components/ProviderRegistry.vue:591](../../apps/web/src/components/ProviderRegistry.vue#L591) | 清除筛选条件 | 次/上下文 |
| 483 | [apps/web/src/components/ProviderRegistry.vue:638](../../apps/web/src/components/ProviderRegistry.vue#L638) | 编辑 | 次/上下文 |
| 484 | [apps/web/src/components/ProviderRegistry.vue:699](../../apps/web/src/components/ProviderRegistry.vue#L699) | 编辑来源 | 次/上下文 |
| 485 | [apps/web/src/components/ProviderRegistry.vue:742](../../apps/web/src/components/ProviderRegistry.vue#L742) | 上一页 | 次/上下文 |
| 486 | [apps/web/src/components/ProviderRegistry.vue:743](../../apps/web/src/components/ProviderRegistry.vue#L743) | = pageCount" @click="page++">下一页 | 次/上下文 |
| 487 | [apps/web/src/components/ProviderRegistry.vue:767](../../apps/web/src/components/ProviderRegistry.vue#L767) | × | 次/上下文 |
| 488 | [apps/web/src/components/ProviderRegistry.vue:778](../../apps/web/src/components/ProviderRegistry.vue#L778) | {{ index + 1 }} {{ label }} | 次/上下文 |
| 489 | [apps/web/src/components/ProviderRegistry.vue:790](../../apps/web/src/components/ProviderRegistry.vue#L790) | 应用技术模板 | 次/上下文 |
| 490 | [apps/web/src/components/ProviderRegistry.vue:936](../../apps/web/src/components/ProviderRegistry.vue#L936) | 1" type="button" class="secondary" @click="editorStep--"> 上一步 | 次/上下文 |
| 491 | [apps/web/src/components/ProviderRegistry.vue:944](../../apps/web/src/components/ProviderRegistry.vue#L944) | 下一步 | 次/上下文 |
| 492 | [apps/web/src/components/ProviderRegistry.vue:945](../../apps/web/src/components/ProviderRegistry.vue#L945) | 0"> {{ saving ? "保存中…" : editing ? "保存新版本" : "创建来源" }} | 主/提交 |
| 493 | [apps/web/src/components/ProviderSourceCenter.vue:606](../../apps/web/src/components/ProviderSourceCenter.vue#L606) | {{ refreshing ? "刷新中…" : "刷新来源" }} | 次/上下文 |
| 494 | [apps/web/src/components/ProviderSourceCenter.vue:688](../../apps/web/src/components/ProviderSourceCenter.vue#L688) | 重置筛选 | 次/上下文 |
| 495 | [apps/web/src/components/ProviderSourceCenter.vue:706](../../apps/web/src/components/ProviderSourceCenter.vue#L706) | 重新加载 | 次/上下文 |
| 496 | [apps/web/src/components/ProviderSourceCenter.vue:790](../../apps/web/src/components/ProviderSourceCenter.vue#L790) | {{ testing === item.provisioned.id ? "测试中…" : "匿名测试" }} 编辑采集设置 解析兼容矩阵 版本与回滚 配置网页登录 固定样本回放 登录准备状态 等待系统登记 没有符合筛选条件的来源。 上一页 | 高影响 |
| 497 | [apps/web/src/components/ProviderSourceCenter.vue:847](../../apps/web/src/components/ProviderSourceCenter.vue#L847) | 下一页 | 次/上下文 |
| 498 | [apps/web/src/components/ProviderSourceConfigurationDialog.vue:71](../../apps/web/src/components/ProviderSourceConfigurationDialog.vue#L71) | × | 次/上下文 |
| 499 | [apps/web/src/components/ProviderSourceConfigurationDialog.vue:152](../../apps/web/src/components/ProviderSourceConfigurationDialog.vue#L152) | 取消 | 次/上下文 |
| 500 | [apps/web/src/components/ProviderSourceConfigurationDialog.vue:153](../../apps/web/src/components/ProviderSourceConfigurationDialog.vue#L153) | {{ saving ? "处理中…" : requiresSmokeTest(editing, form) ? "烟测并启用" : "保存配置" }} | 次/上下文 |
| 501 | [apps/web/src/components/ProviderSourceConfigurationDialog.vue:172](../../apps/web/src/components/ProviderSourceConfigurationDialog.vue#L172) | × | 次/上下文 |
| 502 | [apps/web/src/components/ProviderSourceConfigurationDialog.vue:196](../../apps/web/src/components/ProviderSourceConfigurationDialog.vue#L196) | {{ rollingBack === version.version ? "恢复中…" : "恢复此版本" }} | 次/上下文 |
| 503 | [apps/web/src/components/RedisFoundation.vue:54](../../apps/web/src/components/RedisFoundation.vue#L54) | 可连接 依赖失败 恢复中 | 次/上下文 |
| 504 | [apps/web/src/components/RedisResilienceCenter.vue:192](../../apps/web/src/components/RedisResilienceCenter.vue#L192) | {{ refreshing ? "正在刷新…" : "刷新运行事实" }} | 次/上下文 |
| 505 | [apps/web/src/components/RedisResilienceCenter.vue:207](../../apps/web/src/components/RedisResilienceCenter.vue#L207) | 重新核验 | 次/上下文 |
| 506 | [apps/web/src/components/RedisResilienceCenter.vue:234](../../apps/web/src/components/RedisResilienceCenter.vue#L234) | 重新核验 | 次/上下文 |
| 507 | [apps/web/src/components/ReleaseRolloutCenter.vue:154](../../apps/web/src/components/ReleaseRolloutCenter.vue#L154) | {{ refreshing ? "正在刷新…" : "刷新发布事实" }} | 次/上下文 |
| 508 | [apps/web/src/components/ReleaseRolloutCenter.vue:175](../../apps/web/src/components/ReleaseRolloutCenter.vue#L175) | 重新核验 | 次/上下文 |
| 509 | [apps/web/src/components/ReleaseRolloutCenter.vue:188](../../apps/web/src/components/ReleaseRolloutCenter.vue#L188) | 重新核验 | 次/上下文 |
| 510 | [apps/web/src/components/ReportCenter.vue:295](../../apps/web/src/components/ReportCenter.vue#L295) | 导出当前报表 CSV | 次/上下文 |
| 511 | [apps/web/src/components/ReportCenter.vue:298](../../apps/web/src/components/ReportCenter.vue#L298) | {{ labels[v] }} | 次/上下文 |
| 512 | [apps/web/src/components/ReportCenter.vue:333](../../apps/web/src/components/ReportCenter.vue#L333) | 重新加载 | 次/上下文 |
| 513 | [apps/web/src/components/ReportCenter.vue:402](../../apps/web/src/components/ReportCenter.vue#L402) | {{ refreshing ? "正在刷新…" : "刷新状态" }} | 次/上下文 |
| 514 | [apps/web/src/components/ReportCenter.vue:425](../../apps/web/src/components/ReportCenter.vue#L425) | {{ downloadingId === item.id ? "正在下载…" : "下载" }} {{ regeneratingId === item.id ? "正在提交…" : "重新生成" }} | 次/上下文 |
| 515 | [apps/web/src/components/ReportCenter.vue:439](../../apps/web/src/components/ReportCenter.vue#L439) | 查看详情 | 次/上下文 |
| 516 | [apps/web/src/components/ReportCenter.vue:451](../../apps/web/src/components/ReportCenter.vue#L451) | × | 次/上下文 |
| 517 | [apps/web/src/components/ReportCenter.vue:508](../../apps/web/src/components/ReportCenter.vue#L508) | {{ regeneratingId === selectedExport.id ? "正在提交…" : "重新生成" }} | 次/上下文 |
| 518 | [apps/web/src/components/ResourceGrantCenter.vue:212](../../apps/web/src/components/ResourceGrantCenter.vue#L212) | {{ showCreate ? "取消" : "新建授权" }} | 次/上下文 |
| 519 | [apps/web/src/components/ResourceGrantCenter.vue:251](../../apps/web/src/components/ResourceGrantCenter.vue#L251) | 重新加载 | 次/上下文 |
| 520 | [apps/web/src/components/ResourceGrantCenter.vue:285](../../apps/web/src/components/ResourceGrantCenter.vue#L285) | {{ busy ? "正在保存" : "创建并审计" }} 不得超过 30 天；到期自动失效。 {{ item === "all" ? "全部" : statusLabel(item as ResourceGrantStatus) }} | 主/提交 |
| 521 | [apps/web/src/components/ResourceGrantCenter.vue:306](../../apps/web/src/components/ResourceGrantCenter.vue#L306) | 创建首条授权 | 次/上下文 |
| 522 | [apps/web/src/components/ResourceGrantCenter.vue:310](../../apps/web/src/components/ResourceGrantCenter.vue#L310) | {{ statusLabel(grant.effective_status) }} {{ typeLabel(grant.resource_type) }} · {{ grant.resource_id.slice(0, 8) }} {{ grant.actions.join(" · ") }} 到期 {{ new Date(grant.expires_at).toLocaleString("zh-CN") }} | 次/上下文 |
| 523 | [apps/web/src/components/ResourceGrantCenter.vue:356](../../apps/web/src/components/ResourceGrantCenter.vue#L356) | 延长授权 撤销授权 | 主/提交 |
| 524 | [apps/web/src/components/ResponsiveDataView.vue:46](../../apps/web/src/components/ResponsiveDataView.vue#L46) | 查看详情 | 次/上下文 |
| 525 | [apps/web/src/components/ResponsiveDataView.vue:54](../../apps/web/src/components/ResponsiveDataView.vue#L54) | 关闭详情 | 图标 |
| 526 | [apps/web/src/components/ResponsiveDataView.vue:71](../../apps/web/src/components/ResponsiveDataView.vue#L71) | × | 次/上下文 |
| 527 | [apps/web/src/components/ResponsiveFilterDrawer.vue:80](../../apps/web/src/components/ResponsiveFilterDrawer.vue#L80) | {{ label }} {{ activeCount }} 项已选 调 | 次/上下文 |
| 528 | [apps/web/src/components/ResponsiveFilterDrawer.vue:97](../../apps/web/src/components/ResponsiveFilterDrawer.vue#L97) | 关闭筛选条件 | 图标 |
| 529 | [apps/web/src/components/ResponsiveFilterDrawer.vue:115](../../apps/web/src/components/ResponsiveFilterDrawer.vue#L115) | × | 次/上下文 |
| 530 | [apps/web/src/components/RuntimeTopologyCenter.vue:373](../../apps/web/src/components/RuntimeTopologyCenter.vue#L373) | {{ refreshing ? "正在刷新…" : "刷新运行事实" }} | 次/上下文 |
| 531 | [apps/web/src/components/RuntimeTopologyCenter.vue:389](../../apps/web/src/components/RuntimeTopologyCenter.vue#L389) | 重新核验 | 次/上下文 |
| 532 | [apps/web/src/components/RuntimeTopologyCenter.vue:411](../../apps/web/src/components/RuntimeTopologyCenter.vue#L411) | 重新核验 | 次/上下文 |
| 533 | [apps/web/src/components/RuntimeTopologyCenter.vue:630](../../apps/web/src/components/RuntimeTopologyCenter.vue#L630) | {{ showAllQueues ? "仅看运行与异常" : `查看全部 ${queueRows.length} 个队列策略` }} | 次/上下文 |
| 534 | [apps/web/src/components/ScoreRuleConsole.vue:396](../../apps/web/src/components/ScoreRuleConsole.vue#L396) | 新建规则版本 | 次/上下文 |
| 535 | [apps/web/src/components/ScoreRuleConsole.vue:413](../../apps/web/src/components/ScoreRuleConsole.vue#L413) | 创建首个草稿 请联系具备规则提交权限的成员创建首个草稿。 创建新版本补齐配置 | 次/上下文 |
| 536 | [apps/web/src/components/ScoreRuleConsole.vue:459](../../apps/web/src/components/ScoreRuleConsole.vue#L459) | 预览影响 | 次/上下文 |
| 537 | [apps/web/src/components/ScoreRuleConsole.vue:466](../../apps/web/src/components/ScoreRuleConsole.vue#L466) | 提交 批准 拒绝 启用 回滚 | 高影响 |
| 538 | [apps/web/src/components/ScoreRuleConsole.vue:504](../../apps/web/src/components/ScoreRuleConsole.vue#L504) | × | 次/上下文 |
| 539 | [apps/web/src/components/ScoreRuleConsole.vue:567](../../apps/web/src/components/ScoreRuleConsole.vue#L567) | 取消 {{ busy ? "保存中…" : "保存草稿" }} | 次/上下文 |
| 540 | [apps/web/src/components/ScoreRuleConsole.vue:587](../../apps/web/src/components/ScoreRuleConsole.vue#L587) | × | 次/上下文 |
| 541 | [apps/web/src/components/ScoreRuleConsole.vue:594](../../apps/web/src/components/ScoreRuleConsole.vue#L594) | 重试预览 | 次/上下文 |
| 542 | [apps/web/src/components/ScoreRuleConsole.vue:657](../../apps/web/src/components/ScoreRuleConsole.vue#L657) | 上一页 第 {{ preview.page }} 页 = preview.total \|\| previewing" @click="changePreviewPage(preview.page + 1)" > 下一页 | 次/上下文 |
| 543 | [apps/web/src/components/ScoreRuleConsole.vue:690](../../apps/web/src/components/ScoreRuleConsole.vue#L690) | × | 次/上下文 |
| 544 | [apps/web/src/components/ScoreRuleConsole.vue:710](../../apps/web/src/components/ScoreRuleConsole.vue#L710) | 取消 确认{{ actionLabels[action] }} | 次/上下文 |
| 545 | [apps/web/src/components/SecurityOperationsCenter.vue:382](../../apps/web/src/components/SecurityOperationsCenter.vue#L382) | {{ refreshing ? "正在刷新…" : "刷新数据" }} | 次/上下文 |
| 546 | [apps/web/src/components/SecurityOperationsCenter.vue:395](../../apps/web/src/components/SecurityOperationsCenter.vue#L395) | 重新读取 | 次/上下文 |
| 547 | [apps/web/src/components/SecurityOperationsCenter.vue:448](../../apps/web/src/components/SecurityOperationsCenter.vue#L448) | 查询 | 主/提交 |
| 548 | [apps/web/src/components/SecurityOperationsCenter.vue:449](../../apps/web/src/components/SecurityOperationsCenter.vue#L449) | 重置 | 次/上下文 |
| 549 | [apps/web/src/components/SecurityOperationsCenter.vue:599](../../apps/web/src/components/SecurityOperationsCenter.vue#L599) | 上一页 第 {{ mainPagination.page }} / {{ mainPagination.total_pages }} 页 = mainPagination.total_pages" @click="goPage('main', mainPagination.page + 1)" > 下一页 | 次/上下文 |
| 550 | [apps/web/src/components/SecurityOperationsCenter.vue:726](../../apps/web/src/components/SecurityOperationsCenter.vue#L726) | 上一页 第 {{ mainPagination.page }} / {{ mainPagination.total_pages }} 页 = mainPagination.total_pages" @click="goPage('main', mainPagination.page + 1)" > 下一页 | 次/上下文 |
| 551 | [apps/web/src/components/SecurityOperationsCenter.vue:873](../../apps/web/src/components/SecurityOperationsCenter.vue#L873) | 上一页 第 {{ mainPagination.page }} / {{ mainPagination.total_pages }} 页 = mainPagination.total_pages" @click="goPage('main', mainPagination.page + 1)" > 下一页 | 次/上下文 |
| 552 | [apps/web/src/components/SecurityOperationsCenter.vue:1009](../../apps/web/src/components/SecurityOperationsCenter.vue#L1009) | 上一页 第 {{ tokenPagination.page }} / {{ tokenPagination.total_pages }} 页 = tokenPagination.total_pages" @click="goPage('token', tokenPagination.page + 1)" > 下一页 | 次/上下文 |
| 553 | [apps/web/src/components/SecurityOperationsCenter.vue:1165](../../apps/web/src/components/SecurityOperationsCenter.vue#L1165) | 上一页 第 {{ mainPagination.page }} / {{ mainPagination.total_pages }} 页 = mainPagination.total_pages" @click="goPage('main', mainPagination.page + 1)" > 下一页 | 次/上下文 |
| 554 | [apps/web/src/components/SelectionJourney.vue:300](../../apps/web/src/components/SelectionJourney.vue#L300) | {{ busy ? "正在创建真实任务…" : "创建真实选品任务" }} | 主/提交 |
| 555 | [apps/web/src/components/SelectionJourney.vue:444](../../apps/web/src/components/SelectionJourney.vue#L444) | {{ busy ? "正在保存…" : "保存审计决策" }} | 主/提交 |
| 556 | [apps/web/src/components/SelectionJourney.vue:464](../../apps/web/src/components/SelectionJourney.vue#L464) | 开始下一次 | 次/上下文 |
| 557 | [apps/web/src/components/SourcingWorkspace.vue:399](../../apps/web/src/components/SourcingWorkspace.vue#L399) | 发起供应商找货 | 次/上下文 |
| 558 | [apps/web/src/components/SourcingWorkspace.vue:447](../../apps/web/src/components/SourcingWorkspace.vue#L447) | {{ searchName(item) }} {{ inputTypeText(item.input_type) }} · {{ statusText(item.status) }} {{ item.candidate_count }} 个候选 查看详情 → | 次/上下文 |
| 559 | [apps/web/src/components/SourcingWorkspace.vue:469](../../apps/web/src/components/SourcingWorkspace.vue#L469) | 重新采集 | 次/上下文 |
| 560 | [apps/web/src/components/SourcingWorkspace.vue:476](../../apps/web/src/components/SourcingWorkspace.vue#L476) | 删除找货记录 | 高影响 |
| 561 | [apps/web/src/components/SourcingWorkspace.vue:630](../../apps/web/src/components/SourcingWorkspace.vue#L630) | 确认报价 创建采购任务 | 次/上下文 |
| 562 | [apps/web/src/components/SourcingWorkspace.vue:648](../../apps/web/src/components/SourcingWorkspace.vue#L648) | 保存报价对比 | 次/上下文 |
| 563 | [apps/web/src/components/SourcingWorkspaceDialogs.vue:104](../../apps/web/src/components/SourcingWorkspaceDialogs.vue#L104) | × | 次/上下文 |
| 564 | [apps/web/src/components/SourcingWorkspaceDialogs.vue:134](../../apps/web/src/components/SourcingWorkspaceDialogs.vue#L134) | 取消 开始公开网页采集 | 次/上下文 |
| 565 | [apps/web/src/components/SourcingWorkspaceDialogs.vue:151](../../apps/web/src/components/SourcingWorkspaceDialogs.vue#L151) | × | 次/上下文 |
| 566 | [apps/web/src/components/SourcingWorkspaceDialogs.vue:206](../../apps/web/src/components/SourcingWorkspaceDialogs.vue#L206) | 取消 确认新版本 | 次/上下文 |
| 567 | [apps/web/src/components/SourcingWorkspaceDialogs.vue:226](../../apps/web/src/components/SourcingWorkspaceDialogs.vue#L226) | × | 次/上下文 |
| 568 | [apps/web/src/components/SourcingWorkspaceDialogs.vue:266](../../apps/web/src/components/SourcingWorkspaceDialogs.vue#L266) | 取消 确认创建 | 次/上下文 |
| 569 | [apps/web/src/components/SourcingWorkspaceDialogs.vue:292](../../apps/web/src/components/SourcingWorkspaceDialogs.vue#L292) | × | 高影响 |
| 570 | [apps/web/src/components/SourcingWorkspaceDialogs.vue:311](../../apps/web/src/components/SourcingWorkspaceDialogs.vue#L311) | 取消 确认删除 | 高影响 |
| 571 | [apps/web/src/components/TableViewControls.vue:95](../../apps/web/src/components/TableViewControls.vue#L95) | {{ freezeFirst ? "首列已冻结" : "首列未冻结" }} | 次/上下文 |
| 572 | [apps/web/src/components/TaskBatchActions.vue:41](../../apps/web/src/components/TaskBatchActions.vue#L41) | 批量暂停 | 高影响 |
| 573 | [apps/web/src/components/TaskBatchActions.vue:42](../../apps/web/src/components/TaskBatchActions.vue#L42) | 批量继续 | 次/上下文 |
| 574 | [apps/web/src/components/TaskBatchActions.vue:43](../../apps/web/src/components/TaskBatchActions.vue#L43) | 批量延期 | 次/上下文 |
| 575 | [apps/web/src/components/TaskBatchActions.vue:44](../../apps/web/src/components/TaskBatchActions.vue#L44) | 批量调整负责人 | 次/上下文 |
| 576 | [apps/web/src/components/TaskBatchActions.vue:47](../../apps/web/src/components/TaskBatchActions.vue#L47) | 批量取消 | 高影响 |
| 577 | [apps/web/src/components/TaskBatchActions.vue:109](../../apps/web/src/components/TaskBatchActions.vue#L109) | 返回 确认执行 | 次/上下文 |
| 578 | [apps/web/src/components/TaskDetailPanel.vue:123](../../apps/web/src/components/TaskDetailPanel.vue#L123) | 开始 | 主/提交 |
| 579 | [apps/web/src/components/TaskDetailPanel.vue:131](../../apps/web/src/components/TaskDetailPanel.vue#L131) | 继续 | 主/提交 |
| 580 | [apps/web/src/components/TaskDetailPanel.vue:139](../../apps/web/src/components/TaskDetailPanel.vue#L139) | 完成 | 次/上下文 |
| 581 | [apps/web/src/components/TaskDetailPanel.vue:146](../../apps/web/src/components/TaskDetailPanel.vue#L146) | 更新进度 | 次/上下文 |
| 582 | [apps/web/src/components/TaskDetailPanel.vue:156](../../apps/web/src/components/TaskDetailPanel.vue#L156) | 暂停 | 高影响 |
| 583 | [apps/web/src/components/TaskDetailPanel.vue:164](../../apps/web/src/components/TaskDetailPanel.vue#L164) | 调整期限 | 次/上下文 |
| 584 | [apps/web/src/components/TaskDetailPanel.vue:172](../../apps/web/src/components/TaskDetailPanel.vue#L172) | 转交负责人 | 次/上下文 |
| 585 | [apps/web/src/components/TaskDetailPanel.vue:180](../../apps/web/src/components/TaskDetailPanel.vue#L180) | 编辑任务 | 次/上下文 |
| 586 | [apps/web/src/components/TaskDetailPanel.vue:183](../../apps/web/src/components/TaskDetailPanel.vue#L183) | 取消任务 | 高影响 |
| 587 | [apps/web/src/components/TaskDetailPanel.vue:192](../../apps/web/src/components/TaskDetailPanel.vue#L192) | 删除任务 | 高影响 |
| 588 | [apps/web/src/components/TaskDetailPanel.vue:221](../../apps/web/src/components/TaskDetailPanel.vue#L221) | {{ busy ? "正在提交…" : "添加评论" }} | 次/上下文 |
| 589 | [apps/web/src/components/TaskDetailPanel.vue:308](../../apps/web/src/components/TaskDetailPanel.vue#L308) | 返回 {{ busy ? "正在提交…" : "确认提交" }} | 次/上下文 |
| 590 | [apps/web/src/components/TaskListPanel.vue:72](../../apps/web/src/components/TaskListPanel.vue#L72) | {{ item.label }} {{ item.count }} | 次/上下文 |
| 591 | [apps/web/src/components/TaskListPanel.vue:114](../../apps/web/src/components/TaskListPanel.vue#L114) | 应用 | 主/提交 |
| 592 | [apps/web/src/components/TaskListPanel.vue:115](../../apps/web/src/components/TaskListPanel.vue#L115) | 重置 | 次/上下文 |
| 593 | [apps/web/src/components/TaskListPanel.vue:131](../../apps/web/src/components/TaskListPanel.vue#L131) | 清除选择 | 次/上下文 |
| 594 | [apps/web/src/components/TaskListPanel.vue:145](../../apps/web/src/components/TaskListPanel.vue#L145) | 重置筛选 | 次/上下文 |
| 595 | [apps/web/src/components/TaskListPanel.vue:146](../../apps/web/src/components/TaskListPanel.vue#L146) | 新建任务 | 次/上下文 |
| 596 | [apps/web/src/components/TaskListPanel.vue:181](../../apps/web/src/components/TaskListPanel.vue#L181) | 删除任务 | 高影响 |
| 597 | [apps/web/src/components/TaskWorkspace.vue:726](../../apps/web/src/components/TaskWorkspace.vue#L726) | ＋ 新建任务 | 次/上下文 |
| 598 | [apps/web/src/components/TaskWorkspace.vue:732](../../apps/web/src/components/TaskWorkspace.vue#L732) | 业务任务 | 次/上下文 |
| 599 | [apps/web/src/components/TaskWorkspace.vue:735](../../apps/web/src/components/TaskWorkspace.vue#L735) | 导出任务 | 次/上下文 |
| 600 | [apps/web/src/components/TaskWorkspace.vue:770](../../apps/web/src/components/TaskWorkspace.vue#L770) | 重新加载 | 次/上下文 |
| 601 | [apps/web/src/components/TaskWorkspace.vue:870](../../apps/web/src/components/TaskWorkspace.vue#L870) | 上一页 | 次/上下文 |
| 602 | [apps/web/src/components/TaskWorkspace.vue:872](../../apps/web/src/components/TaskWorkspace.vue#L872) | = pageCount" @click="setPage(page + 1)">下一页 | 次/上下文 |
| 603 | [apps/web/src/components/TaskWorkspace.vue:899](../../apps/web/src/components/TaskWorkspace.vue#L899) | 取消 {{ busy ? "正在提交…" : editing ? "保存修改" : "创建任务" }} | 次/上下文 |
| 604 | [apps/web/src/components/TaskWorkspace.vue:951](../../apps/web/src/components/TaskWorkspace.vue#L951) | 取消 {{ busy ? "正在删除…" : "确认删除" }} | 高影响 |
| 605 | [apps/web/src/components/TechnicalDetails.vue:43](../../apps/web/src/components/TechnicalDetails.vue#L43) | {{ copied === item.label ? "已复制" : "复制" }} | 次/上下文 |
| 606 | [apps/web/src/components/TenancyChooser.vue:153](../../apps/web/src/components/TenancyChooser.vue#L153) | 当前账号 | 次/上下文 |
| 607 | [apps/web/src/components/TenancyChooser.vue:200](../../apps/web/src/components/TenancyChooser.vue#L200) | 返回组织列表 | 次/上下文 |
| 608 | [apps/web/src/components/TenancyChooser.vue:211](../../apps/web/src/components/TenancyChooser.vue#L211) | 返回组织列表 | 次/上下文 |
| 609 | [apps/web/src/components/TenancyChooser.vue:215](../../apps/web/src/components/TenancyChooser.vue#L215) | 创建并进入选品空间 | 次/上下文 |
| 610 | [apps/web/src/components/TenancyChooser.vue:235](../../apps/web/src/components/TenancyChooser.vue#L235) | ← 返回组织 | 次/上下文 |
| 611 | [apps/web/src/components/TenancyChooser.vue:253](../../apps/web/src/components/TenancyChooser.vue#L253) | {{ organization.name.slice(0, 1) }} {{ organization.name }} {{ organization.slug }} · {{ organization.timezone }} {{ recentOrganizationIds.includes(organization.id) ? "最近使用 · " : "" }}选择 → | 次/上下文 |
| 612 | [apps/web/src/components/TenancyChooser.vue:272](../../apps/web/src/components/TenancyChooser.vue#L272) | 清除搜索 | 次/上下文 |
| 613 | [apps/web/src/components/TenancyChooser.vue:276](../../apps/web/src/components/TenancyChooser.vue#L276) | ⌁ {{ workspace.name }} {{ workspace.status === "active" ? "可进入" : "已归档" }} {{ state === "selecting" && selectedWorkspace?.id === workspace.id ? "正在选择…" : "进入工作区 →" }} | 次/上下文 |
| 614 | [apps/web/src/components/ThemeStudio.vue:185](../../apps/web/src/components/ThemeStudio.vue#L185) | 刷新偏好 | 次/上下文 |
| 615 | [apps/web/src/components/ThemeStudio.vue:200](../../apps/web/src/components/ThemeStudio.vue#L200) | {{ theme.name }} {{ theme.mode }} · {{ theme.caption }} {{ selected === theme.id ? "当前预览" : "选择预览" }} | 次/上下文 |
| 616 | [apps/web/src/components/ThemeStudio.vue:222](../../apps/web/src/components/ThemeStudio.vue#L222) | {{ density.name }} {{ density.caption }} | 次/上下文 |
| 617 | [apps/web/src/components/ThemeStudio.vue:237](../../apps/web/src/components/ThemeStudio.vue#L237) | 撤销预览 {{ state === "saving" ? "正在保存…" : "保存主题" }} | 次/上下文 |
| 618 | [apps/web/src/components/TrendChangeQueue.vue:107](../../apps/web/src/components/TrendChangeQueue.vue#L107) | 合并主题 | 次/上下文 |
| 619 | [apps/web/src/components/TrendChangeQueue.vue:110](../../apps/web/src/components/TrendChangeQueue.vue#L110) | 拆分主题 | 次/上下文 |
| 620 | [apps/web/src/components/TrendChangeQueue.vue:137](../../apps/web/src/components/TrendChangeQueue.vue#L137) | 提交确认队列 | 主/提交 |
| 621 | [apps/web/src/components/TrendChangeQueue.vue:170](../../apps/web/src/components/TrendChangeQueue.vue#L170) | 驳回 | 次/上下文 |
| 622 | [apps/web/src/components/TrendChangeQueue.vue:171](../../apps/web/src/components/TrendChangeQueue.vue#L171) | 确认执行 | 次/上下文 |
| 623 | [apps/web/src/components/TrendChangeQueue.vue:188](../../apps/web/src/components/TrendChangeQueue.vue#L188) | 取消 | 次/上下文 |
| 624 | [apps/web/src/components/TrendChangeQueue.vue:189](../../apps/web/src/components/TrendChangeQueue.vue#L189) | 提交{{ decision.action === "confirm" ? "确认" : "驳回" }} | 主/提交 |
| 625 | [apps/web/src/components/TrendDashboard.vue:460](../../apps/web/src/components/TrendDashboard.vue#L460) | 创建第一条监控规则 | 主/提交 |
| 626 | [apps/web/src/components/TrendDashboard.vue:468](../../apps/web/src/components/TrendDashboard.vue#L468) | {{ busy === "/provider-sources/refresh" ? "正在启动…" : "立即刷新来源" }} | 主/提交 |
| 627 | [apps/web/src/components/TrendDashboard.vue:477](../../apps/web/src/components/TrendDashboard.vue#L477) | 管理监控规则 | 次/上下文 |
| 628 | [apps/web/src/components/TrendDashboard.vue:480](../../apps/web/src/components/TrendDashboard.vue#L480) | 趋势主题 监控规则 {{ rules.length }} 合并与拆分 {{ changeRequests.filter((item) => item.status === "pending").length }} | 次/上下文 |
| 629 | [apps/web/src/components/TrendDashboard.vue:529](../../apps/web/src/components/TrendDashboard.vue#L529) | {{ topic.title }} {{ topic.market }} · {{ topic.category \|\| "未分类" }} · {{ statusLabel(topic.status) }} {{ topic.source_count }} 个来源 · 新鲜度 {{ freshness(topic.source_fresh_at) }} {{ confidenceLabel(topic) }} · 已关注 {{ topic.heat.value }} 热度 / 条信号 {{ statusLabel(topic.status) }} | 次/上下文 |
| 630 | [apps/web/src/components/TrendDashboard.vue:555](../../apps/web/src/components/TrendDashboard.vue#L555) | 上一页 | 次/上下文 |
| 631 | [apps/web/src/components/TrendDashboard.vue:557](../../apps/web/src/components/TrendDashboard.vue#L557) | = pageCount" @click="goPage(page + 1)"> 下一页 | 次/上下文 |
| 632 | [apps/web/src/components/TrendDashboard.vue:601](../../apps/web/src/components/TrendDashboard.vue#L601) | ＋ 创建规则 | 次/上下文 |
| 633 | [apps/web/src/components/TrendDashboard.vue:613](../../apps/web/src/components/TrendDashboard.vue#L613) | 创建监控规则 | 次/上下文 |
| 634 | [apps/web/src/components/TrendDashboard.vue:661](../../apps/web/src/components/TrendDashboard.vue#L661) | {{ item.status === "enabled" ? "暂停" : "启用" }} | 高影响 |
| 635 | [apps/web/src/components/TrendDashboard.vue:664](../../apps/web/src/components/TrendDashboard.vue#L664) | 查看趋势结果 | 次/上下文 |
| 636 | [apps/web/src/components/TrendDashboard.vue:695](../../apps/web/src/components/TrendDashboard.vue#L695) | × | 次/上下文 |
| 637 | [apps/web/src/components/TrendDashboard.vue:715](../../apps/web/src/components/TrendDashboard.vue#L715) | 取消 {{ busy.includes("quality-issues") ? "创建中…" : "创建质量工单" }} | 次/上下文 |
| 638 | [apps/web/src/components/TrendDashboard.vue:737](../../apps/web/src/components/TrendDashboard.vue#L737) | × | 次/上下文 |
| 639 | [apps/web/src/components/TrendDashboard.vue:753](../../apps/web/src/components/TrendDashboard.vue#L753) | 取消 确认并记录 | 次/上下文 |
| 640 | [apps/web/src/components/TrendDetailPanel.vue:48](../../apps/web/src/components/TrendDetailPanel.vue#L48) | {{ detail.followed ? "已关注" : "关注" }} 创建监控 转为机会 标记无关 恢复为相关 | 次/上下文 |
| 641 | [apps/web/src/components/TrendEvidenceTimeline.vue:61](../../apps/web/src/components/TrendEvidenceTimeline.vue#L61) | {{ qualityIssueIds[item.id] ? "已建质量工单" : "报告异常" }} | 次/上下文 |
| 642 | [apps/web/src/components/TrendFilterPanel.vue:57](../../apps/web/src/components/TrendFilterPanel.vue#L57) | 筛选 清除 保存视图链接 | 主/提交 |
| 643 | [apps/web/src/components/TrendRuleDialog.vue:59](../../apps/web/src/components/TrendRuleDialog.vue#L59) | × | 次/上下文 |
| 644 | [apps/web/src/components/TrendRuleDialog.vue:97](../../apps/web/src/components/TrendRuleDialog.vue#L97) | 取消 | 次/上下文 |
| 645 | [apps/web/src/components/TrendRuleDialog.vue:98](../../apps/web/src/components/TrendRuleDialog.vue#L98) | {{ busy ? "保存中…" : "创建并启用" }} | 主/提交 |
| 646 | [apps/web/src/components/UiStatePanel.vue:71](../../apps/web/src/components/UiStatePanel.vue#L71) | {{ primaryLabel \|\| copy.primary }} {{ secondaryLabel \|\| copy.secondary }} | 主/提交 |
| 647 | [apps/web/src/components/UiStateShowcase.vue:106](../../apps/web/src/components/UiStateShowcase.vue#L106) | {{ labels[kind] }} | 次/上下文 |
| 648 | [apps/web/src/components/UiStateShowcase.vue:117](../../apps/web/src/components/UiStateShowcase.vue#L117) | 查看高影响确认弹窗 | 次/上下文 |
