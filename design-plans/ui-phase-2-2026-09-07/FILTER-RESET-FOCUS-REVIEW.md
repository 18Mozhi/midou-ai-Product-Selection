# 手机筛选重置焦点 · 独立修复与回归

后续收尾更新：[当前静态合同接续](platform-account-current-contract.md) 已修复下文旧独立检查的历史漂移问题，保留旧表并严格核对当前源码，不再需要豁免该失败。下文“暂不提交/提交确认待答”保留为此前时点记录；最终Git状态与验证结果以本轮收尾为准，视觉和生产批准范围不变。

2026-09-11，起点 `main/07c492963f56e266864143cfadaa1e6f6ef5627d`。本批修复 P43 实际审核回放发现的共享筛选抽屉问题，不改变待审构图和用户批准范围。

[修复后8图](../../output/playwright/filter-reset-focus/current/index.html) · [旧版诊断8图](../../output/playwright/filter-reset-focus/baseline/index.html) · [当前证据](../../output/playwright/filter-reset-focus/current/evidence.json) · [旧版证据](../../output/playwright/filter-reset-focus/baseline/evidence.json)

## 改动与边界

使用 `fixing-accessibility` 技能，仅修改 `ResponsiveFilterDrawer.vue` 的局部焦点处理。手机抽屉打开、活动条件归零，且当前抽屉内按钮在更新后禁用并仍占据焦点或焦点落到 body 时，转移到原关闭按钮。Escape 随后可关闭并归还入口焦点。模板、样式、字段、筛选请求和桌面行为不变。

不抢走输入框、抽屉外控件、另一弹窗或新焦点；非零条件、桌面、已关闭、按钮仍可用、更新期间关闭/转桌面/卸载均不转移。8个直接调用组件未改：CollectionOperationsConsole、OpportunityListPanel、PlatformAccountCenter、PlatformDataCenter、PlatformGovernanceCenter、PlatformLogCenter、PlatformManagementFilter、TrendFilterPanel。共享边界检查不等于8个页面的完整端到端验收。

## 证据及历史关联

同一宿主在390/760/761/1440运行：旧版76项诊断检查，当前80项回归检查，各34项源指纹、8张手机PNG。实际未转换的 P43 父组件与生产CSS，鼠标和键盘重置分别回放；每宽度4次拦截GET，验证清空query且保留keep参数，无写入。另用明确的合成插槽验证输入、外部焦点、另一原生弹窗和卸载边界。不是完整App/KeepAlive、真实权限、移动端软键盘或完整无障碍验收。

旧版确实丢焦点且Escape不关闭；当前重置后聚焦关闭按钮，Escape关闭并聚焦入口。旧图不覆盖、不改为通过。历史图源通过 `scripts/lib/ui-phase2-filter-reset-baseline.mjs` 精确关联：仅接受该文件的以下两版，未知版本失败关闭。

- 旧LF SHA-256：`daa1cda68e206b85f5cfa687ae9ee70795a20e2a67d79501cc22fbf53c162a39`
- 新LF SHA-256：`a566080f7b00f13c8890ea8ef5b002296b39e9b7fe10f324a4fe754226dec011`

已有图包的源/PNG核对保留；历史关联标记为 `historical-LF-exact-revision-not-current-acceptance`，不代表旧图已回放新实现。本批回归单独使用current目录，不能把此窄范围修复扩为P43布局批准。

额外运行的旧独立 `verify-ui-phase2-platform-account-contract.mjs` 因ResponsiveDataView历史候选签名而失败。用其可注入reader读取起点提交的全部文件，确认失败消息及actual/expected与当前完全相同；不是本次引入。旧表保留，当前交付使用已有增量合同审计与本批独立证据，未伪称该旧检查通过。

## 复现与交付

```powershell
node scripts/verify-ui-phase2-filter-reset-focus.mjs --baseline
node scripts/verify-ui-phase2-filter-reset-focus.mjs
node --test tests/unit/responsive-filter-drawer.test.mjs tests/unit/responsive-filter-reset-focus.test.mjs
# 仅重新生成正式证据图时追加 --capture。
```

无需调参；手机打开有条件的筛选，重置后按Escape验证关闭及入口焦点。无新增依赖、环境变量、配置、API/OpenAPI、数据库或权限变更；因此不修改后端、Python、部署配置。生产组件已局部修复，但本批不部署、不重启；未来发布需按既有宝塔前端构建部署流程。

16PNG、两份证据和图册为正式交付物，不是待删临时截图。浏览器和Vite由finally关闭，无额外临时脚本；最终端口、Git及验证结果以本批收尾记录为准。完整73页C实施、待审组合和生产验收继续，不能宣称整体完成。

## 本批收尾记录

721项相关回归全部通过；P43实际C审核宿主四宽度266项回放通过且不覆盖旧图。本批独立旧版76/当前80检查、前端类型检查和构建、文档门禁、格式检查及diff检查通过。102个既有图包审计源/PNG漂移为0，但完整交付仍未证实。端口65272/65345/65386/65433/65501/49854最终均无监听；无新建的非交付临时文件待删，项目必需构建输出保留。

旧独立合同检查的既有失败仍未修复，因此遵守“检查失败不自动提交”的项目规则，保留本批工作区改动，暂不提交。需用户确认是否允许在明确保留此既有失败的前提下提交本批焦点修复；commit hash不适用。未部署、无需重启，不把局部代码及验证通过描述为全部任务完成。
