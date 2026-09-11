# P48 · 手机筛选与来源页内详情实际 Vue r1

## 本批范围

以当前真实路由 `/platform-admin/providers/sources`、ProviderRuntimeSurface → ProviderSourceCenter 和 M03-07 的 146 条权威 fixture 为准。本批在已审阅的 P48 C 默认目录上增加手机专属审核层：搜索与结果数常驻、六项次级筛选折叠、来源两事实摘要，以及目录内展开的完整来源详情。审核时由 Vite 精确替换当前 SFC 并加载 P48 专属 CSS；**生产 SFC、脚本、事件、API、权限和数据均未改，未部署**。

frontend-design 用于把手机主路径收敛为“搜索 → 摘要判断 → 查看详情”，避免七筛选和全部技术字段同时占满首屏；fixing-accessibility 用于补充原生按钮、`aria-expanded` / `aria-controls`、44px 目标、键盘开合、进入详情首焦点及返回触发器焦点。

## 布局与交互

- 搜索框和“找到 146 个来源”始终可见；业务类型、准备状态、市场、语言、接入模式、排序共六项进入“更多筛选与排序”。展开区最高 440px，可独立滚动；顶部图与滚动到底图分别证明字段入口和“重置筛选”可达。
- 手机目录记录先显示来源身份、可用性、采集方式与最近成功，只隐藏视觉上的次级事实，不删除原字段。
- “查看来源详情”在当前目录页内展开选中来源，只保留所属用途组和该条记录；详情继续显示原说明、来源链接、七项事实及匿名测试、编辑采集设置、版本与回滚三个真实动作。
- 键盘打开详情后焦点进入“返回来源目录”；关闭后恢复到原“查看来源详情”。筛选按钮 Enter 开合后焦点保持，不新增路由、读取或写入。
- 1024px 与 1440px 不展示手机控件；筛选区和首条记录分别与上一批 P48 C 页面进行原始 PNG 像素比较，四组均为 0 像素差异。

## 实际证据

- [24 图总览](../../output/playwright/p48-source-mobile-review/index.html)：页面基线/手机审核 × 390/760/1024/1440；手机审核包含筛选折叠、展开顶部、展开底部、目录摘要、详情及返回，桌面保留筛选与记录基线。
- [机器证据](../../output/playwright/p48-source-mobile-review/evidence.json)：8 次运行、94 项检查、24 张 PNG、172 个实际加载源码哈希、4 组桌面零差异比较。
- 146 条数据仍从 `tests/e2e/m03-07-provider-sources.spec.ts` 的 `automatic/setup/manual/sources` AST 直接提取；每组仅 1 次 provider-sources GET，详情开关没有额外 GET。
- 所有运行均无 POST/PUT、请求体、未知网络、外链跳转、运行错误或水平溢出；390px 与 760px 均验证 6 项筛选、7 项详情事实、3 个原动作和 44px 开合/返回目标。

复验：`node --test tests/unit/ui-phase2-provider-sources-mobile.test.mjs`。重建图包：`node scripts/verify-ui-phase2-provider-sources-mobile.mjs --capture`。本次取证端口记录在 evidence，验证结束后均已关闭；正式图包保留，没有生成临时日志、下载或测试数据。

## 待审与未覆盖

本批只申请 P48 手机筛选折叠/展开、来源摘要/页内详情及返回焦点的布局与视觉审核。默认目录整体和首条桌面记录仍等待上一批审核；空/错/权限/刷新状态，以及配置、版本、固定样本、兼容矩阵四个任务窗仍需后续实际 Vue 审核。没有验证真实权限、MySQL、烟测外发、双人复核、SC48/PR-G01 或生产部署，也不把本批评审稿视为最终生产实现。
