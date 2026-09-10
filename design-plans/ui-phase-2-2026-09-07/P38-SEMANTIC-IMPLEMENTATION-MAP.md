# P38 入口组合与完整局部源码对应

2026-09-11；基线 main/fae70505。本轮是待审组合与验证交付，不是全页实施完成或生产上线。

## 本轮实图

[8张实际Vue入口图册](../../output/playwright/p38-entry-links/index.html)：390与1440分别展示运营能力输入、超级管理员能力输入下的「平台事实」「待办与常用入口」。沿用既有 C 隔离样式与当前 Vue，不改此前待审构图；frontend-design 用于维持已选 C 语言，Playwright 用于渲染与逐入口点击核对。

手机：[运营事实](../../output/playwright/p38-entry-links/390-operate-facts.png) / [运营入口](../../output/playwright/p38-entry-links/390-operate-shortcuts.png) / [超级管理员事实](../../output/playwright/p38-entry-links/390-superadmin-facts.png) / [超级管理员入口](../../output/playwright/p38-entry-links/390-superadmin-shortcuts.png)。桌面图在同一图册。所有新图待审，不默认批准旧问题。

样例来自现有 E2E：基础dashboard和独立三点trend；不重新计算或协调成功率与趋势总量。截图区域是实际组件局部，不是整页截图；无AI补画或拼图。

## 来源与控件对应

[逐项合同](platform-overview-semantic-contract-review.md)和[机器映射](action-reviews/P38.json)覆盖 PlatformDashboard、ResponsiveDataView、TableViewControls、TechnicalDetails 共30个源位置，明确归并20组：19组页面交互、1组共享预览定义关联；没有本页业务写入动作。两处 v-model 为 windowCode 和 density，密度通过模型/watch生效，未因扫描器不计纯v-model而遗漏。一个来源容器登记正常/未知/长字段三种图稿关联。

父接线按实际 NavigationShell 动态 surface → lazy PlatformDashboard → KeepAlive component → surfaceProps 核对；不是 PlatformManagementCenter 父子关系。父层源码指纹单独保存，不把整个壳层其他按钮误算为 P38。P38 两处共享技术详情只传 requestId；来源/告警的原生技术折叠没有复制，通用组件 trace/items 不虚构为本页字段。

114个通用代表视觉状态槽仍待逐项判断/映射；不代表缺少114张图。已有91图稿、42实际Vue图、18工具栏图、16来源提案与共享复制8图保持各自证据类型，见 [Vue预览](P38-VUE-PREVIEW-REVIEW.md)、[工具栏](P38-TOOLBAR-REVIEW.md)、[来源提案](P38-PROVIDER-DETAIL-REVIEW.md)、[共享复制](TECHNICAL-COPY-FEEDBACK-REVIEW.md)。本次8张组合不充当全部按钮六态。

## 验证范围

永久脚本 `node scripts/verify-ui-phase2-platform-entry-links.mjs`：390/760/761/1440四宽度、20组检查、52次真实链接点击。`--capture` 重新生成本轮8张图、index.html、evidence.json；截图由当前样例运行产生，重捕获后需重新检查登记指纹。

- 运营能力输入为7个正常入口；超级管理员为10个，两者相差组织/用户相关3处。改变能力参数不额外发GET。
- 点击每宽度10个正常入口、2个趋势空态入口、1个首次401登录入口，核对完整路径/query及返回原URL。10个正常入口热区至少44×44。
- 清空能力输入会隐藏3处入口，但子组件仍显示既有事实。此测试明确表明：子组件显隐不是授权门。
- 只挂载实际子组件与真实 surfaceProps，使用最小 catch-all router；目标地址的页面没有挂载。未测试完整父壳/KeepAlive、目标页操作、真实登录或后端RBAC。
- 所有业务请求只mock本地GET；未触及真实平台观测/审计写入、数据库或生产。无页面异常或额外外部请求。

`node scripts/build-ui-phase2-platform-overview-review.mjs --check` 复核30个来源、父接线、导航分母和图像/来源指纹；`--write` 只生成对应JSON和合同。`node --test tests/unit/ui-phase2-platform-overview-review.test.mjs` 包含漏项、假批准、错误转发、指纹/目标漂移的负向测试。

本轮结果：7/7定向测试、604/604 UI阶段回归通过；全站动作对账、73路由/153项文档门及格式门通过。102图包/15069原PNG完整性检查无漂移，覆盖门与全页完成状态仍未通过。本轮未改生产源/依赖，未重复运行生产构建或后端测试；8张新局部图由独立证据与单测校验，不混入原图数量。

## 交付边界与下一步

不改生产Vue/CSS、API/OpenAPI、业务规则、权限、数据库、配置、依赖或其他页面。无部署，无服务重启；本次图册直接打开即可审核。临时Vite与浏览器均已关闭；8 PNG和index/evidence为请求的永久审核产物，未产生一次性脚本/日志。

全站对账同时发现P54登记遗留两条共享修复前指纹。本轮仅同步ResponsiveDataView/TechnicalDetails当前来源并注明消费者仍未验收；不重写P54源、原图、动作或批准，不把共享修复等同P54全流程通过。

ready刷新401/403后旧快照展示策略仍待用户答复，不默认改变；新入口组合、其他未答局部视觉、完整 C 父壳与全73页交付仍未验收。全站已登记页数不等于完成页数，批准/生产门保持不变。
