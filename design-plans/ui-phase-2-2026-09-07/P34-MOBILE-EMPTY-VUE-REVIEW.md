# P34 手机模板空结果区域 · 真实 Vue 实施

2026-09-10，基线 main / `bae3cbe722ecfee23b6b8331fd9104599ffa22a2`。上一轮是真实手机筛选区的落地，本轮实施用户另外批准的空结果区域，不扩大成整页通过。

## 实施范围

按 [局部批准](P34-MOBILE-EMPTY-COMPOSITION-APPROVAL.md)，在真实 `OrganizationApprovalPanel.vue` 中，只有“已返回模板数量大于0、当前筛选结果为0、屏幕宽度不超过760px”时展示新空结果组合：筛选/已返回数量、每页6个、浅灰提示、原说明和清除筛选按钮。

数字取自实际 `templates.length`、`filteredTemplates.length` 和已有 `templatePageSize`，不使用组织汇总或虚构总量。接口未返回任何模板时仍沿用“暂无审批模板”原状态，没有无效的清除入口。桌面仍显示原空结果排版；审批记录视图未改。

按钮复用 `resetTemplates()`；新加的唯一脚本状态是搜索输入的DOM ref，清除后将焦点交还仍在页面上的搜索框，防止按钮消失后键盘焦点丢失。五条件默认值、分页和URL规则、其他视图条件、无关查询键以及模板选择规则均保持。没有API请求、持久化写入、权限变动或新校验规则。

颜色继续从组件加载的 `design/approval-filter-tokens.css` 读取，只向筛选区和本空结果区声明局部语义颜色；灰底为批准稿的 `#f5f7fb`，标题19px、正文16px、按钮至少44px。frontend-design用于限定布局与色值，Playwright复用项目验证工具，不安装新技能CLI或依赖。

## 来源与图片边界

- [真实空结果区域](../../output/playwright/p34-mobile-template-filters/empty-region-390.png) · [真实键盘焦点状态](../../output/playwright/p34-mobile-template-filters/empty-clear-focus-390.png) · [证据清单](../../output/playwright/p34-mobile-template-filters/evidence.json)。焦点图证明操作链，不额外代表焦点视觉获批。
- 原90/244/150张C提案图仍全部保留，两个已批准PNG由已有单测钉住SHA256。没有重采提案或替换批准对象。
- 当前子组件动作位置从13增加至14。控件证据保留初版32控件/244图及其历史proposalOnly元信息，在 `implementedBindings` 单列新增手机清除按钮与原 `template-clear-empty` 图稿入口的关系；14个源位置全量核对，不靠忽略新增位置维持旧计数。原proposal的桌面清除按钮仍是提案，不属于本次实施。
- 字段证据仅更新真实搜索DOM ref的源属性；刷新来源时只允许精确的 `templateQuery/ref=templateSearchInput` 差异，不忽略其他字段属性变化。

## 验证与使用

扩展现有真实子Vue宿主，四宽度390/760/761/1440共120项检查、7张永久截图。以本轮前一提交为基线，16项内存逐像素对比覆盖原记录视图、记录空结果、桌面模板与桌面无匹配，以及未返回模板状态。首次误用更早的筛选区实施前基线，导致手机整图比较包含上轮已批准差异；改为本轮真实基线后通过，没有据此回退产品代码。

手机验证数量来源、实际灰底/文字色值、字号/按钮尺寸、键盘Space与鼠标清除、焦点回搜索、其他视图和无关URL保留；零模板不出现清除按钮。原220输入/200链接恢复、两视图查询历史恢复以及只读零API/外部请求继续验证。Vue script单测允许唯一DOM ref声明，其他原业务脚本仍逐字相等。

```powershell
node scripts/verify-ui-phase2-org-approvals-mobile-filters.mjs --capture
node scripts/verify-ui-phase2-org-approvals-mobile-filters.mjs
node scripts/verify-ui-phase2-org-approvals-query.mjs --capture
node scripts/verify-ui-phase2-org-approvals-c.mjs --refresh-sources
node scripts/verify-ui-phase2-org-approvals-controls-c.mjs --refresh-sources
node scripts/verify-ui-phase2-org-approvals-fields-c.mjs --refresh-sources
```

真实Vue截图可用capture更新；已批准提案图只能保留并重验，见上一轮[证据维护流程](P34-MOBILE-FILTER-VUE-REVIEW.md)。验证宿主探测空闲端口、仅绑定127.0.0.1，并在finally关闭Vite与浏览器。

在本地原审批模板页面输入不匹配条件，手机宽度下即可查看；清除只作用于模板筛选。无需配置调节。本轮未部署，当前无需重启；正式上线仍需既有本地构建和宝塔发布流程。不涉及 `.env.example`、OpenAPI、后端生产者/消费者或数据库迁移，因此这些文件未改。

顶部刷新组合仍待用户答复，目录、详情、父级异常、整页C、全73页及生产验收仍未完成。局部批准及此宿主证据不代替真实父页面/API/SQL/权限/生命周期验收。

最终验证：27项定向、702/702完整单测、类型检查/前端构建、251资源预算、静态检查、153文档/73路由与运行文档门通过；120项实Vue及38项原查询恢复通过。101包14995提案PNG审计零源/图片漂移，审核入口双端通过。首次动作合同审计发现新增清除位置尚未列入原表，已补精确源签名并通过重验。审核下载临时目录、单测fixture及隔离浏览器/Vite均已清理；7张手机区域图、8张查询图及对应证据为永久交付，保留构建产物与既有依赖缓存。
