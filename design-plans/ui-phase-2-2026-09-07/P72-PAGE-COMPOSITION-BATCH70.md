# P72 实际 Vue C 组合 · 批次70

P72 原有 RECOVERY-C-r1 是离线稿。本批新增仅审核用的 Vite 转换：保留 `UiStateShowcase.vue` 的 script、query.state、八态选择、动作演示、确认短语、焦点循环、Escape/取消返焦和开发环境排除生产构建的合同，移除旧的轨道装饰构图，改为蓝色状态身份、八态选择器、当前状态工作区及独立高影响确认区。

`tests/unit/ui-state-page-preview.test.mjs`通过；实际 Vue 在1440/390与两种动效下共80项检查，无 API 请求或页面错误。r1图册为默认页与确认窗的双端4 PNG/42来源指纹，适用于状态选择、加载态无动作和本地确认组合审核，不代表真实服务故障、授权撤销、审计、后端写入或生产验收。

批70复核：八态按钮保留aria-pressed与aria-controls；loading仍不渲染动作；确认必须先勾选并输入去空格后的“确认撤销”，Escape关闭后焦点回到触发按钮。该确认只令`confirmed`成为组件内存事实，不产生网络写入。手机状态选择为两列，弹窗长内容在自身滚动且底部操作保持可达。

实施续记：用户后续明确“剩下的全部通过，你无需暂停”，C 方向据此自动采纳。实际模板与样式已迁入 `UiStateShowcase.vue`，实施、生产排除及部署证据见[P72 实施记录](P72-PAGE-COMPOSITION-IMPLEMENTATION.md)。本文件保留批70当时的审核期历史，不再代表当前交付状态。
