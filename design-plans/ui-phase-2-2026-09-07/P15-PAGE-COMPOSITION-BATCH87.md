# P15 实际 Vue C 组合 · 批次87

本批新增审核用 Vite 转换，保留 `NavigationShell.vue` 的成员守卫、导航和路由行为，以及 `OpportunityWorkspace.vue`、`OpportunityListPanel.vue`、`AutomaticSelectionReadinessPanel.vue`、`OpportunityWorkspaceDialogs.vue` 的真实列表、四类队列、筛选、五步配置只读投影、趋势预填和原生弹窗调用。审核层重构为蓝白机会工作台：先核对质量门，再由人决定采纳；不保留旧账页标题、米色背景、圆角卡片或营销式布局。

实际 Vue 在 1440/390 与两种动效偏好下通过 44 项检查，零写入：默认队列只读取 `selection_view=recommended`，规则候选、采集中和全部队列继续使用原有 URL 状态；批量入口仅出现在 all 且有有效选择时；趋势来源参数只预填创建窗，未自动创建或采纳。r2 图册包含默认、规则候选、全量批量影响预览、趋势预填和读取失败的双端 10 PNG/7 个受控来源指纹。

无需重启、部署或配置变更。转换和图册仅供用户审核，未改生产机会组件、共享导航、API、队列规则、质量门、权限、趋势预填语义或批量写入。真实会话/RBAC、成员读取失败、ERP 导入、创建/批量实际写入、跨页选择范围、读屏和生产验收仍待完成。
