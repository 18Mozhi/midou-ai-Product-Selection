# Signal Ledger 生产实现

本设计包已落地到真实 Vue 应用。Route Catalog 的 73 个页面继续使用原有路由、API、权限、表单与业务状态，但全部继承同一套 Signal Ledger 视觉合同。

## 生产入口

- `apps/web/src/design/tokens.css`：三套纸张主题、排版、间距、零圆角和语义颜色令牌。
- `apps/web/src/signal-ledger.css`：所有业务页、表格、指标、筛选器、状态、抽屉、弹窗和移动端的视觉合同。
- `apps/web/src/components/NavigationShell.vue` 与 `apps/web/src/navigation-shell-scoped.css`：成员、组织、平台三套“身份条 + 横向模块索引 + 账页内容”壳层。
- `apps/web/src/components/AccountShell.vue`：账号级横向分区索引。
- `apps/web/src/components/LocalIdentity.vue`、`TenancyChooser.vue`、`ThemeStudio.vue`：公开入口、范围选择和外观设置账页。

## 兼容边界

- 主题持久化 ID 仍为 `deep-ocean`、`aurora-purple`、`cloud-white`，界面名称改为“信号纸”“档案纸”“净页白”。
- API、数据库、权限、路由、事件、任务和导出合同未改变。
- 桌面采用横向模块索引；840px 及以下采用抽屉与四个高频入口加“更多”的底部导航。
- 通用确认框与原生原因弹窗共享“影响清单 + 签认”视觉层级，原有焦点圈、Escape 和焦点归还行为不变。

## 审核依据

- 每页桌面图：`pages/desktop/`
- 每页移动图：`pages/mobile/`
- 全套系统审查图：`boards/`
- 按钮清单：`button-inventory.md`
- 弹窗清单：`dialog-inventory.md`
- 页面矩阵：`page-matrix.md`
