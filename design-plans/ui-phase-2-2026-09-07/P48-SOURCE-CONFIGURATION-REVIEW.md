# P48 · 编辑采集设置实际 Vue r1

## 本批范围

以当前真实路由 `/platform-admin/providers/sources`、ProviderRuntimeSurface → ProviderSourceCenter → ProviderSourceConfigurationDialog、M03-07 的权威 fixture 与现有保存函数为准。本批只重构第一个任务窗“编辑采集设置”的默认字段结构和“停用公开来源改为启用”组合；Vite 在审核宿主中精确变换当前配置 SFC 并加载独立 CSS，**生产 SFC、保存函数、API、权限、数据库、环境与依赖均未改，未部署**。

本批使用 ibelick/fixing-accessibility 约束持续字段标签、帮助关联、首焦点、Tab 循环、Escape 关闭、背景隔离和触发点归还。视觉继续采用 C 方向：蓝色来源身份区、连续白色表单区、浅蓝影响预览和橙色烟测前置提示，不沿用旧的通用米灰卡片窗。

## 字段与组合

- 蓝色身份区同时给出来源名、接入类型、当前启停状态和配置版本；说明保存会记录原因并保留历史版本。
- 五个真实输入保持原合同：采集频率 1–10080、单次超时 1000–120000、失败重试 0–10，均为整数；状态只含 enabled/disabled；变更原因 2–500 字符。
- 每个字段具有持久可见标签和就近帮助文字，并用 `aria-describedby` 建立程序化关联；代表输入、选择器及主按钮高度均至少 44px。
- 保存前影响继续使用当前计算：同频来源只表示可能进入同一调度窗口；并发占用只表示当前待执行/执行中快照，不预测未来。
- 网页登录来源的“启用”明确不代表已经完成登录或来源验收。
- 停用的公开来源改为启用时，明确展示“先保存停用版 → 真实页面烟测 → 通过后二次启用”；烟测失败时已保存的停用配置仍保留，不再误解为零写入。

## 模态交互

- 打开后焦点进入窗标题；Tab 与 Shift+Tab 在窗内循环，背景内容处于 inert 隔离状态。
- Escape、关闭按钮和取消按钮都关闭当前窗；保存处理中关闭入口禁用。
- 关闭后移除背景隔离并把焦点归还到原“编辑采集设置”按钮。
- 手机窗使用完整视口滚动，底部结果说明与取消/主操作保持粘附；桌面为 820px 宽的集中任务面。

## 实际证据

- [12 图总览](../../output/playwright/p48-source-configuration-review/index.html)：390/760/1024/1440 下的网页登录停用默认态与公开来源烟测启用态；390/760 另有变更原因与底部操作组合图。
- [机器证据](../../output/playwright/p48-source-configuration-review/evidence.json)：8 次实际 App 运行、120 项检查、12 张 PNG、59 个实际加载源码哈希。
- 每组只读取 1 次来源目录；打开、切换状态、Tab、Escape 和截图没有 POST/PUT、请求体、未知网络、外链、运行错误或水平溢出。
- 三项数值约束、五字段帮助关联、表单有效性、烟测提示条件、44px 代表控件、首焦点、背景 inert、Tab 循环和焦点归还均由浏览器断言。

复验：`node --test tests/unit/ui-phase2-provider-source-configuration.test.mjs`。重建图包：`node scripts/verify-ui-phase2-provider-source-configuration.mjs --capture`。取证随机端口已关闭；正式图包保留。

## 待审与未覆盖

本批只申请配置窗的默认字段结构、网页登录停用组合、公开来源烟测启用组合及基础模态交互审核。没有触发真实保存、烟测或二次 PUT；保存中、成功、烟测失败、PUT 失败、版本冲突和重读失败仍需下一批逐项验证。配置历史、固定样本、兼容矩阵另外三个任务窗、401/403 刷新边界、SC48/PR-G01、真实权限/MySQL/外部来源及生产部署仍未覆盖。

## 当前生产源码复核 r2

后续 P48 拆分了配置弹窗与来源详情入口，因此 r1 保留为当时的提案/捕获，不再拿它的旧源码绑定代表当前实现。r2 直接运行当前 `ProviderSourceCenter` 与 `ProviderSourceEditDialog`，手机先进入来源详情再打开配置；不向生产组件注入旧字段模板。另为三个数字输入显式增加 `step="1"`，使整数约束在真实表单标记中可直接核验。

- 新图与证据：[r2 图册](../../output/playwright/p48-source-configuration-review-r2/index.html)、[r2 机器证据](../../output/playwright/p48-source-configuration-review-r2/evidence.json)。
- 1440/1024/760/390 四宽度、两种来源场景：8 组、120 项检查、12 张图、53 个实际加载源码哈希。仍只有目录 GET；无写入、未知网络或运行错误。
- 复验：`node scripts/verify-ui-phase2-provider-source-configuration.mjs` 与 `node --test tests/unit/ui-phase2-provider-source-configuration.test.mjs`。新版本捕获命令为 `node scripts/verify-ui-phase2-provider-source-configuration.mjs --capture rN`；目录已存在会失败，不覆盖 r1/r2。
- 视觉方向按用户本轮“剩余全部通过”授权自动通过；这里只记录配置窗视觉与本地拦截交互，不代表生产写入、权限或来源烟测验收。

## 当前证据格式校验与源码指纹校准 r4

格式检查要求仓库 P48 验证脚本遵循 Prettier；格式化只改变脚本排版、不改变页面或场景。重新采集并将自动化断言切换到 r4，r1–r3 图册继续保留。

- [r4 图册](../../output/playwright/p48-source-configuration-review-r4/index.html)；8 组、120 项检查、12 张图、53 个源码哈希。
