# P50 · 凭证编辑弹窗焦点闭环实际 Vue 实施 r1

## 本批范围

补齐 `/platform-admin/credentials` 的四类敏感编辑窗：创建凭证、轮换资料、关联运行档案与网页登录导入。生产 `CredentialAssetCenter.vue` 现使用原生 `<dialog>.showModal()` 和共享 `useModalDialog`，获得浏览器顶层模态、背景不可交互、Escape 关闭及触发控件返焦；撤销继续复用既有 `ConfirmDialog` 自定义 `alertdialog`。未改变字段、默认值、请求体、权限或持久化规则。

`ui-skills-root` 选择 `fixing-accessibility`，据此把可访问名称、初始焦点、Tab/Shift+Tab 边界、Escape、遮罩关闭和返焦作为独立验收项；没有仅凭 `role="dialog"` 宣称完成。

## 已实现交互

- 创建、轮换、档案引用和登录导入由全屏原生 `dialog` 承载，标题通过独立 `aria-labelledby` 关联。
- `showModal()` 打开后，初始焦点进入首个业务字段；原有局部 Tab 循环继续排除禁用控件。
- Escape、窗口内遮罩、取消和右上关闭统一走同一清理出口；成功保存由共享钩子把焦点归还发起按钮。
- KeepAlive 停用前丢弃已缓存页面的返焦目标，避免页面离开后把焦点抢回不可见触发控件。
- 原生弹窗与内层表单都使用 border-box，390/760/1024/1440 不产生水平溢出。
- 撤销确认保持共享自定义 `alertdialog`，继续显式 `aria-modal="true"`、初始取消焦点、双向 Tab 循环和 Escape 返焦；本批不扩大为全站确认框迁移。

## 实际证据

- [20 图总览](../../output/playwright/p50-credential-editor-focus-review/index.html)：5 状态 × 390/760/1024/1440。
- [机器证据](../../output/playwright/p50-credential-editor-focus-review/evidence.json)：20 次真实 App/Router/NavigationShell/KeepAlive 运行、236 项检查、20 张 PNG、170 个实际加载源码哈希。
- 四种编辑窗逐一验证原生 `DIALOG`、`open`、`:modal`、标题名称、首字段焦点和可见焦点；五种状态都验证 Tab/Shift+Tab 首末循环、Escape 关闭和触发按钮返焦，登录窗另验遮罩关闭返焦。
- 每次只有导航、会话和三项凭证数据 GET；无写请求、请求体、外部网络、真实秘密、Cookie、助手、加密、数据库或生产访问，零运行时错误。
- 永久 E2E 另验证四种编辑窗和保存成功返焦；M03-02 桌面与 390px 共 48/48 通过。本报告的截图只展示合成只读状态，不以图片代替请求合同测试。

复验：`node --test tests/unit/ui-phase2-credential-editor-focus.test.mjs`。重建：`node scripts/verify-ui-phase2-credential-editor-focus.mjs --capture`。

## 视觉与交付边界

五种图在审核层统一为 C 方向：四类编辑窗使用蓝白信息结构，撤销保留红色高影响层级。该审核 CSS 未进入生产；本批生产变更只有弹窗语义、焦点生命周期和尺寸约束。当前未部署，不需要新增配置、迁移、后端重启或依赖。

本批只申请创建、轮换、关联档案、网页登录和撤销五种弹窗的布局与焦点状态审核，不代表真实保存、真实扩展、服务端域校验、加密/MySQL、权限、轮换自动重放、主题/密度、200% 缩放、跨 KeepAlive 实例结算或生产验收。到期/时区/null 语义仍需真实业务规则后处理。
