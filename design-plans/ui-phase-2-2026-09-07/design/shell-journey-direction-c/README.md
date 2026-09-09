# 成员导航与 P16 真实工作面 · C 组合待审

版本 **SHELL-JOURNEY-C-r1**。本次解决原壳层稿只有右侧说明占位、无法判断与实际页面组合的缺口。左侧是专用审核 Vue 壳层；右侧直接挂载现有 SelectionJourney，叠加本包 CSS 的横向阶段栏提案。**不是生产 NavigationShell 已重构，也不是 P16 原布局批准已包含此次横排变化。**

[9张组合图](index.html) · [证据清单](evidence.json) · [原P16布局与旧壳层的真实Vue对照](../../../../output/playwright/p16-c-r2-review/index.html) · [三壳层原独立稿](../shell-direction-c/README.md)

## 请审核的结构变化

- 成员全局目录在左，P16四阶段放在内容顶部，避免把全局导航和页面阶段做成两列相邻蓝色侧栏；阶段仍由真实任务状态决定。
- 上方只保留一次当前组织/工作区范围披露，不重复旧页码、Signal Ledger标题及“已连接”健康暗示。真实P16标题、输入、候选、决策和五门逻辑保持。
- 桌面宽工作面仍将候选与决策分栏，较窄工作面上下排列；手机使用原生导航弹窗和按实际授权入口数分配的底栏，不补造空菜单。
- 主题、搜索、快捷创建只保留入口并明确提示本组合未装配；这些动作不能据此验收。组织/平台壳层不在本包范围。

本批只请求审核以上组合布局，不请求批准全部按钮状态、服务端鉴权、全站或生产发布。若不通过可保留原已审P16独立布局，另调组合，不覆盖原批准记录。

## 图册与验证范围

| 场景 | 桌面 | 手机 |
| --- | --- | --- |
| 输入首屏 | [1440](1440-input.png) | [390](390-input.png) |
| 返回机会列表再回来，保留草稿 | [1440](1440-return-draft.png) | [390](390-return-draft.png) |
| 候选未选择 | [1440](1440-candidate-unselected.png) | [390](390-candidate-unselected.png) |
| 选择第二候选，五门通过 | [1440](1440-five-gates.png) | [390](390-five-gates.png) |
| 手机导航弹窗 | 不适用：左侧目录 | [390](390-navigation-open.png) |

截图为整页，手机导航弹窗为视口；整页图中的固定底栏仍按截图时的视口位置出现，不代表随文档中段定位。完整验证另将页面滚到底部，检查最终操作不会被固定底栏遮住。

43项本地检查包括四阶段、菜单来源、双端及768/1024/1280无横溢出、导航圆点尺寸、手机底栏无空列、真实RouterLink返回机会列表、KeepAlive草稿保留、真实候选五门、原生弹窗首尾焦点/Escape回焦、跨桌面断点关闭并回到可见品牌入口、导航开关不改候选内容、最终操作在滚动末端可命中。没有点击创建或保存，业务POST为0；唯一业务读取为被拦截的当前selection-journey GET。不是完整导航生命周期、范围切换、真实服务器、全部六态、所有主题/密度或无障碍认证。

源样本严格来自当前P16合同测试的roles/capabilities/platform字段，通过AST提取；浏览器执行当前authorizedNavigation、canOpenRoute和shellRoleSummary，目录来自真实生成路由表。原M02-03壳层样本没有P16必需能力，已被首次断言拒绝，没有悄悄扩权；本包P16样本只得到1个授权菜单，这不是生产全部成员菜单数量。没有组织/工作区名字时仅显示明确默认文案，不跨样本借名。候选和五门复用既有P16数据助手；没有混入其他壳层账号、服务健康或业务结论。

目视发现并修正的是本包专用CSS：横向阶段数字圆点被flex列压窄，桌面导航开关被较高优先级规则意外显示，以及单入口手机底栏预留五列。现有SelectionJourney.vue/selection-journey.css均未改。底栏命中检查区分“已在视口内但被固定条覆盖”和“用户滚动到末端可达”，不把scrollIntoViewIfNeeded当成遮挡检测。

## 复现和更新

```powershell
node scripts/verify-ui-phase2-shell-journey-c.mjs --smoke
node scripts/verify-ui-phase2-shell-journey-c.mjs --capture
node scripts/verify-ui-phase2-shell-journey-c.mjs
```

复用现有Vue/Vite/Playwright/TypeScript依赖。验证器临时启动localhost:5175，端口占用时失败关闭；只在验证器提供`/__shell_journey_preview/`和对应虚拟模块，生产路由中不存在。浏览器封锁外部网络及未登记API，持久化只发生在隔离浏览器上下文，结束清除测试键并关闭上下文、浏览器和Vite。无需常驻服务或生产重启。

无参数模式检查源/图哈希并重跑验证；capture更新本目录永久交付PNG/index/evidence。生产Vue、API/OpenAPI、DB/迁移、env、依赖、权限、发布和旧批准均未修改。源发生变化后应复核再重拍，不能用旧图片或单纯重写指纹冒称当前实现。具体组合审核、全局浮层装配、其他角色/页面与生产部署验收继续待办。
