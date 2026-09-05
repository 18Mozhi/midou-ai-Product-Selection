# ScoutOps 全新 UI 重构审核包

## 审核入口

启动静态服务后打开 `index.html`。审核台包含 73 个真实路由的桌面与移动稿、3 张基础系统板和 10 张弹窗板。

## 这版与旧版的关系

旧版视觉和布局不作为继承基础。本包重新定义导航、页面模板、颜色、字体、按钮、表单、状态、弹窗和移动端结构；只保留真实路由、业务任务、权限范围与按钮/弹窗源码清单作为事实依据。

## 建议审核顺序

1. `boards/design-system.png`：先确认整体风格是否彻底脱离旧版。
2. `screens/desktop/12-home.png`、`15-opportunities.png`、`18-opportunities__opportunityId.png`：确认首页、列表和详情三种核心构图。
3. `screens/mobile/12-home.png` 与 `18-opportunities__opportunityId.png`：确认移动端不是桌面缩小版。
4. `boards/button-system.png`、`state-system.png` 与 10 张弹窗板：确认细节合同。
5. 再按审核台筛选逐页查看 73 条路由。

## 文件说明

- `FULL-RECOMMENDATIONS.md`：全局与逐页优化建议。
- `page-matrix.md`：路由、角色、全新布局、焦点和图片索引。
- `button-inventory.md`：每一个真实按钮的源码位置和新层级。
- `dialog-inventory.md`：每一个真实弹窗的源码位置和新类型。
- `screens/desktop` / `screens/mobile`：逐路由设计图。
- `boards`：视觉、按钮、状态与弹窗设计板。

## 重新生成与验证

`node design-plans/ui-redesign-2026-09-05/build.mjs`

`node design-plans/ui-redesign-2026-09-05/verify.mjs`
