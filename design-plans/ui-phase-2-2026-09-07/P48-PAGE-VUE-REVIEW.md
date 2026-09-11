# P48 · 来源频道默认目录实际 Vue r1

## 本批范围

以当前真实路由 `/platform-admin/providers/sources`、ProviderRuntimeSurface → ProviderSourceCenter 和 M03-07 的 146 条权威 fixture 为准。本批把默认目录做成可审核的 C 方向实际 Vue 页面：蓝色来源身份、连续四项统计账条、白色七筛选区、按用途分组的事实目录与独立分页。审核宿主只加载 P48 专属 CSS，**生产 SFC、脚本、事件和 API 均未改，未部署**。

frontend-design 用于移除旧渐变标题和独立卡片墙，建立“来源身份 → 全局口径 → 使用说明 → 筛选 → 目录”的阅读顺序；fixing-accessibility 用于核对原生 label、按钮/链接焦点、44px 目标和非颜色状态。

## 布局与动作

- 标题区保留“刷新来源”和“管理来源规则”，前者仍是原 GET，后者仍指向 P46。
- 四项统计继续是 146 / 138 / 42 / 1 的全目录口径，不随本地筛选或分页变化，也不把“自动采集”冒充真实任务成功。
- 七个原字段全部保留：搜索、业务类型、准备状态、市场、语言、接入模式、排序；重置继续恢复 URL 与第一页。
- 每页仍是 20 条，第二页显示 21–40；筛选、分页与重置均不增加目录 GET。
- 来源记录保留状态文字、策略、目标链接、七组事实和当前所有真实动作。桌面改为连续台账行；手机改为单列事实区，但本批没有隐藏字段，也没有提前实现待审“摘要→详情”。

## 实际证据

- [48 图总览](../../output/playwright/p48-source-page-review/index.html)：基线/审核 × 390/760/1024/1440；每组包含标题、统计、帮助说明、筛选、首条来源和第二页。
- [机器证据](../../output/playwright/p48-source-page-review/evidence.json)：8 次运行、148 项检查、48 张 PNG、62 个实际加载源码哈希。
- 146 条数据从 `tests/e2e/m03-07-provider-sources.spec.ts` 的 `automatic/setup/manual/sources` AST 直接提取，不复制或重写目录。
- 每个运行只有 1 次 provider-sources GET；业务类型筛选、翻页和重置均为本地行为。没有 POST/PUT、请求体、未知网络、外链跳转或运行错误。
- 四宽度均无页面横向溢出；审核版刷新、管理、搜索、重置、下一页五个代表控件均可键盘聚焦且至少 44×44px。

复验：`node --test tests/unit/ui-phase2-provider-sources-page.test.mjs`。重建图包：`node scripts/verify-ui-phase2-provider-sources-page.mjs --capture`。取证端口 59653/59690 已关闭；正式图包保留，无临时日志、草稿或测试数据。

## 待审与未覆盖

本批只申请默认目录整体布局与首条来源记录视觉审核。手机筛选折叠、目录→详情、空/错/权限/刷新状态，以及配置、版本、固定样本、兼容矩阵四个任务窗仍需分批实际 Vue 审核。未验证真实权限、MySQL、烟测外发、双人复核或生产部署；SC48/PR-G01 异步归属问题也没有被本批 CSS 修复。
