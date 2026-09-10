# 手机详情窗：共享焦点与背景隔离修复

2026-09-11，起点 main / ea005452。接续 P38 实际 Vue 预览发现的 Shift+Tab 离开详情窗问题；仅修复共享 `ResponsiveDataView.vue`，不扩大任何用户的局部视觉批准。此前报告中的“手机焦点隔离未修”由本增量取代，其他历史结论保留。

## 实现与兼容性

- 打开后焦点进入关闭按钮；Tab/Shift+Tab 在可见且可用的按钮、字段、链接及技术详情摘要之间循环，跳过禁用、隐藏及未展开内容。
- 打开时隔离已有页面背景，保存其原有 inert 值；关闭或卸载时恢复，不清掉原来已有的隔离。
- Escape、关闭按钮、遮罩及插槽关闭均归还焦点。刷新移除所选记录时关闭详情并回到列表，之后同 ID 再出现不自动重开；同 ID 的字段更新仍即时显示。
- 对已转交焦点的新弹窗不抢焦点。现有确认窗打开时，详情层暂停接收焦点并降到其后；取消后详情层恢复。监听仅限打开期间的 body 直接子节点，关闭/卸载即断开。

已核对 20 个消费组件及其详情插槽：普通字段/技术详情、RouterLink、close 后跳转、close 后打开弹窗、在详情上打开确认窗/原因窗。20 个消费文件、`ConfirmDialog.vue`、`AuditedReasonDialog.vue` 和 `use-modal-dialog.ts` 均未修改，原按钮名称、业务调用、权限及表单契约保持不变。

**为何本次保留浮层结构：**计划优先复用原生 `useModalDialog`。实际核对发现，现有 `ConfirmDialog` 使用 body 级 Teleport 自定义浮层；直接让下层详情使用原生 showModal，会把该确认窗置于不可操作的背景。本次遵循无障碍技能的局部修复约束，保留原结构并增加 inert 与焦点循环；原生原因窗另做兼容验证，不全站迁移弹窗库。还在实际截图中发现原确认层 z-index 100 低于详情层 260，故仅在确认窗存在时将详情层降至 99；普通详情布局与全部既有 CSS 保持原样。

## 验证与图证边界

当前五个源码候选及三个签名变更的接续关系见 [动作归属增量](responsive-detail-focus-contract-review.md)。旧合同原表保留，新增当前归属不放宽全局“未引用候选必须为零”检查。

`scripts/verify-responsive-data-view-focus.mjs` 使用实际三个 Vue 组件和现有 CSS，在隔离测试插槽中验证：390/760 各 4 组手机流程，761/1440 各 1 组桌面保持，共 10 组；生成 4 张手机键盘/嵌套确认/返焦图。确认窗通过可点击命中检查，不只检查 DOM 焦点；测试不提交业务操作，不请求业务 API。原有 inert、单关闭按钮循环、记录删除、卸载清理均有覆盖。

永久图证：`output/playwright/responsive-data-view-focus/`。它是组件级实际 Vue 证据，使用现行样式，不是新 C 页面设计稿或用户批准。P38 独立预览继续使用原待审 C CSS，替换旧焦点失败断言为正向隔离/循环检查；原有 403 快照与复制拒绝问题仍按未完成项记录。

四张组件验证图：[关闭按钮焦点](../../output/playwright/responsive-data-view-focus/390-close-focus.png)、[展开后操作焦点](../../output/playwright/responsive-data-view-focus/390-expanded-control-focus.png)、[叠加确认窗](../../output/playwright/responsive-data-view-focus/390-nested-confirm.png)、[回到列表](../../output/playwright/responsive-data-view-focus/390-returned-to-list.png)。这些样例用于验证键盘与层级，不是邀请把现行全局主题当作 C 重设计批准。

相关历史 HTML 提案保持独立类型，不能因为来源组件修复就变成实际 Vue。历史合同表不改写：`scripts/lib/ui-phase2-responsive-focus-contract.mjs` 仅允许 ea005452 的旧组件指纹到本次已验证的精确指纹，核对真实组件测试及图证，不放行未知改动；受影响提案仍须运行原验证器重新采集当前来源。图片是否有变化与批准状态分别核对，不仅手改哈希。

21 个受影响提案已重跑各自验证器，原 HTML/CSS/数据未修改。33 张重捕获图出现少量边缘栅格差异：尺寸全部一致，每张 1–74 个像素、最大单通道差 13；精确前后哈希、像素数与坐标见 `shared-mobile-detail-capture-review.json`。回归逐张核对，不添加全局误差容忍，也不算用户批准。P38 原局部图与真实 Vue 预览另有各自验证门。

收尾结果：21 提案共重捕获 3423 PNG；P38 实际预览 32 组、42 图及独立局部提案 28 组、16 图通过，后两套原图未变。新增共享证据测试 4/4、既有共享与 P38 相关测试 10/10 通过。全量单测首次 838/840，两项失败均为上述三个源码位置缺少当前归属；仅补文档后该审计文件 21/21 复测通过，其余已通过且输入未变的测试未重复运行。Web 类型/构建、文档门和前端体积门通过。主设计审计仍为 102 包、15069 PNG、来源/图片漂移为零；完整页面验收仍 unproven。

```powershell
node scripts/verify-responsive-data-view-focus.mjs
node --test tests/unit/responsive-data-view.test.mjs tests/unit/responsive-data-view-focus.test.mjs
node scripts/verify-ui-phase2-platform-overview-vue-preview.mjs
```

## 交付与剩余

未改 API/后端/Worker/Python/数据库、OpenAPI、环境变量、依赖、权限或部署流程；Feature Map 仅记录前端行为与验证入口。没有新增用户调节项，继续使用“查看详情”及既有关闭入口。

本次未部署；随获审版本本地构建后走既定宝塔流程。此纯前端修复本身不要求 API/Worker/Python 重启；部署器自身的停服行为仍按发布门核对。所有本机临时 Vite 与浏览器在 finally 中关闭；4 张图、证据、报告和验证脚本为永久交付，不是待删除的临时产物。

仍待：完整页面/主题/真实权限与接口回归、P38 待审布局及其他逐页审核、复制拒绝反馈、403 快照策略决策和全站发布验收。本报告不代表 73 页工作完成，也不代表所有消费页面的真实业务动作已验收。
