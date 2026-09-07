# Signal Ledger 生产实现

本设计包的共享视觉合同已落地到真实 Vue 应用，但本目录的全站概念图不是73个页面逐项实现或生产验收通过的证据。Route Catalog 的73个条目保留原有路由、API、权限、表单与业务状态；其中包含根跳转、内部开发页和fallback，不能全部计为正常生产业务页。

2026-09-07 的 Signal Ledger 2.1 在此基础上完成第一批黄金工作流强化：压缩公共壳层，首页改为任务优先，趋势页采用稳定的主从阅读工作台，机会页统一就绪度、筛选抽屉和弹窗动作语义。业务合同未改变。

## 生产入口

- `apps/web/src/design/tokens.css`：三套纸张主题、排版、间距、零圆角和语义颜色令牌。
- `apps/web/src/signal-ledger.css`：所有业务页、表格、指标、筛选器、状态、抽屉、弹窗和移动端的视觉合同。
- `apps/web/src/signal-ledger-workflows.css` 中的 `so-action-primary`、`so-action-secondary`、`so-action-quiet`、`so-action-danger`、`so-ledger-surface` 和 `so-dialog-manifest`：按受保护业务壳层懒加载的显式组件语义，不依赖按钮文案猜测视觉层级，也不增加公开入口首屏体积。
- `apps/web/src/components/NavigationShell.vue` 与 `apps/web/src/navigation-shell-scoped.css`：成员、组织、平台三套“身份条 + 横向模块索引 + 账页内容”壳层。
- `apps/web/src/components/AccountShell.vue`：账号级横向分区索引。
- `apps/web/src/components/LocalIdentity.vue`、`TenancyChooser.vue`、`ThemeStudio.vue`：公开入口、范围选择和外观设置账页。

## 兼容边界

- 主题持久化 ID 仍为 `deep-ocean`、`aurora-purple`、`cloud-white`，界面名称改为“信号纸”“档案纸”“净页白”。
- API、数据库、权限、路由、事件、任务和导出合同未改变。
- 桌面采用横向模块索引；840px 及以下采用抽屉与四个高频入口加“更多”的底部导航。
- 通用确认框与原生原因弹窗共享“影响清单 + 签认”视觉层级，原有焦点圈、Escape 和焦点归还行为不变。
- 趋势桌面页固定为 36/64 主从账页并独立滚动；1100px 及以下改为列表或详情单焦点切换。
- 机会高级筛选在 760px 及以下使用全屏层和底部固定操作带，筛选草稿在关闭再打开后保留。

## 审核依据

- 每页桌面概念图：`screens/desktop/`（独立HTML模板渲染，非Vue或生产实景）
- 每页移动概念图：`screens/mobile/`（独立HTML模板渲染，非Vue或生产实景）
- 全套系统设计板：`boards/`（概念设计，不能替代各业务动作和弹窗变体的执行证据）
- 核心实现图：`implementation-proof/`（按该目录说明为真实Vue与隔离API数据；不自动代表当前版本生产状态）
- 按钮清单：`button-inventory.md`
- 弹窗清单：`dialog-inventory.md`
- 页面矩阵：`page-matrix.md`

第二阶段的清单、证据类型与待验状态统一见 [实施账册](../ui-phase-2-2026-09-07/review.html)。旧按钮/弹窗清单是生成时的静态正则结果，不包括所有动态入口；不得当作当前完整业务覆盖分母。
