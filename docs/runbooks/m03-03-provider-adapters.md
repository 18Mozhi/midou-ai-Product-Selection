# M03-03 Provider 适配器运维说明

## P47 手机空态当前验证（非生产）

`node scripts/verify-provider-adapter-empty-mobile-current.mjs` 无参数运行原App四宽度/
三空态场景，只用本地原测试样例，不出图、不写业务、不覆盖旧capture。未知参数或
`--capture`会在浏览器启动前拒绝。记录见 `design-plans/ui-phase-2-2026-09-07/P47-EMPTY-CURRENT-REPLAY.md`。
本验证工具不要求重启后端/采集器，不代表真实登记、权限或生产验收。

## 宝塔部署

1. 在宝塔备份 `product_scout`，用业务账号执行 `0016c_provider_adapters_m03_03.up.sql`。
2. 在 Node API 与后续调用适配器的 Node Worker 宝塔受限环境配置 `PROVIDER_ADAPTER_HEALTH_TIMEOUT_MS`、`PROVIDER_ADAPTER_MAX_RESPONSE_BYTES`、`PROVIDER_ADAPTER_MAX_ITEMS_PER_BATCH`；初始值以 `config/env.example` 为准。
3. 运行 `npm run build`，由宝塔重启 Node API；M03-03 不新增 systemd、独立 PM2、宿主机 crontab、面板外 Docker 或常驻采集进程。当前 Crawler 不调用该包，无需因本模块重启。
4. 访问 `/platform-admin/providers/adapters`。未在代码中注册的 Provider 显示“待登记”，健康检查显示“受阻”是预期的真实状态；原始 `adapter_not_registered` 只在“技术详情”展示，不得手工改为健康。
   已登记来源在首次健康检查前也应显示当前进程注册的适配器版本，但健康仍保持“待检查”；使用搜索、来源状态、登记状态、健康状态和排序定位来源，目录固定每页 20 条。刷新超时或失败时必须保留最近一次成功数据。
5. 核对来源健康的 24 小时窗口：成功率、P95 和样本量来自已完成子查询；网络、解析、登录和成功空结果必须分开显示。样本量为 0 时页面应显示“暂无样本”，不得用探针延迟填充运行 P95。
6. 核对“错误预算与恢复门”：连续运行失败和阈值必须分别来自 `provider_runtime_circuits` 与 `providers`。来源暂停后先在本页执行真实健康检查；只有检查结果为健康且时间晚于暂停时间，页面才显示可解除并直达采集调度。健康检查不得自动清零运行熔断，探针自身连续失败也不得冒充运行错误预算。
7. 在热点来源页选择一个已有真实 HTML/DOM 证据的公开页面或登录页面来源，打开“解析兼容矩阵”。页面版本必须等于留存证据的 SHA-256，解析结论必须与对应子查询成功或解析类失败一致；网络与登录失败只能显示待验证。没有证据时保持空状态，不得触发新采集或自动启停来源。

三个上限都在进程启动时读取，修改后必须由宝塔重启 Node API；Worker 在后续模块接入该包后也必须重启。每个 Provider 自身的 `timeout_ms` 继续生效，健康探针采用 Provider timeout 与全局健康 timeout 中较小者。

## 验证与恢复

```powershell
npm run verify:module -- M03-03
```

门禁覆盖运行时 scope/limit/字节/超时、normalize provenance、缺失实现失败关闭、provider:configure/Origin/幂等、MySQL 5.7 当前健康/不可变版本/审计、桌面与 390px 视觉和文档。MySQL 实测只在验证进程注册合成适配器，结束后清理 Provider、用户和健康记录，不会写入生产注册表。

390px 验证时，适配器应显示摘要卡片；详情抽屉必须保留健康检查按钮与完整业务字段，只有展开“技术详情”才显示来源 UUID、来源代码、原始接入模式、适配器版本和错误码。

### 过滤空结果恢复（第二阶段B1a）

在`/platform-admin/providers/adapters`输入不存在的搜索词，或选择没有结果的来源/登记/健康/模式组合；点击“清除筛选”后，应显示当前已读取来源，搜索框为空、四筛选为全部、排序为“需关注优先”、页码回第1页。工具栏“重置”效果相同。此操作不发送目录刷新或健康检查请求；如需最新后端状态，另点“刷新状态”。

永久定向入口为`npx --no-install playwright test tests/e2e/m03-03-provider-adapter.spec.ts --project=desktop-chromium --grep UI2-PR47 --workers=1`；最小通过后串行运行该文件完整desktop-chromium与mobile-390。四种空结果原因使用隔离API响应，断言六控件、结果、页码和零探针写入，不操作真实来源。

本次仅Web按钮复用既有重置函数和文案，无新配置、API、迁移或独立后端重启要求。实际更新仍由本地构建、既有宝塔部署器上传；部署器的既有迁移核对与Node停启窗口不能因本次为UI改动跳过。本批未部署。新设计图、完整可访问性/异步/真实权限验收见第二阶段合同中的未完成项。

### 第二阶段当前C页读取顺序核对

仓库根目录运行 `node scripts/verify-provider-adapter-read-current.mjs`。入口不接受参数，
在本地临时端口启动真实App，以390/760/761/1440宽度验证旧GET与健康检查交错返回；
接口全部拦截，无真实探针或数据库写入，结束自动关闭浏览器与宿主，不保存截图。
不要用旧 `verify-ui-phase2-provider-adapter-read-order.mjs --capture` 覆盖原历史包。
该入口只证明当前C页读取顺序和相关详情焦点，不替代真实权限、未知写结果或全站验收。
无新配置或环境变量，本批未改生产代码，无部署或重启要求。完整证据边界见
`design-plans/ui-phase-2-2026-09-07/P47-READ-CURRENT-REVIEW.md`。

### 第二阶段当前C页检查反馈核对

运行 `node scripts/verify-provider-adapter-feedback-current.mjs`，不接受参数或capture。
在390/760/761/1440验证等待焦点、来源间结果隔离、追踪、过期刷新抑制与关闭恢复；
仅本地接口样例，结束关闭临时端口与浏览器，不截图、不执行真实健康检查。
原反馈阶段44图保留，不使用旧驱动覆盖它们。无生产代码、配置或重启变更；不替代
真实权限、未知写结果、完整读屏器或全站验收。详细范围见
`design-plans/ui-phase-2-2026-09-07/P47-FEEDBACK-CURRENT-REVIEW.md`。

### 第二阶段加载、刷新失败与卸载回归

后续刷新焦点修复已改变原刷新失败驱动baseline的BODY期望；该旧驱动保留历史对照，
不能将其当前执行失败当作已获豁免。当前刷新键盘回归改用下面的焦点入口。

依次运行 `node scripts/verify-ui-phase2-provider-adapter-loading.mjs`、
`node scripts/verify-ui-phase2-provider-adapter-refresh-failure.mjs`、
`node scripts/verify-ui-phase2-provider-adapter-unmount.mjs`，不加capture。
均使用本地接口样例并自动关闭宿主；前两项包含当前页/待审提案对照，第三项观察真实
壳卸载与缓存淘汰。通过不代表重试BODY焦点或跨实例检查锁已修复，也不代表真实权限。
不需要新配置或生产重启。完整范围及旧110张图的版本对应见
`design-plans/ui-phase-2-2026-09-07/P47-READ-LIFECYCLE-CURRENT-REVIEW.md`。

### 第二阶段刷新等待焦点修复

旧刷新/空态/P46邻页图包的版本完整性由
`tests/unit/ui-phase2-adapter-historical-source.test.mjs`及原对应测试检查；仅精确恢复P47
拍摄时组件和37色色板，未知变更仍失败。历史解析器不用于当前运行或截图，原清单不改。
详情见`design-plans/ui-phase-2-2026-09-07/P47-HISTORICAL-GATE-CLOSURE.md`。

当前源码请运行 `node scripts/verify-provider-adapter-refresh-focus-current.mjs`：
只读实际当前App，不带任何参数、不截图；分页、手机实施源码经完整逆向链验证，原四宽度、
三种触发、成功/失败、焦点与GET次数断言保持。自动关闭临时浏览器和服务，无新配置
或生产重启要求。详细结果见
`design-plans/ui-phase-2-2026-09-07/P47-REFRESH-FOCUS-CURRENT-REVIEW.md`。
分页实施后的当前复验见`design-plans/ui-phase-2-2026-09-07/P47-REFRESH-PAGINATION-CURRENT-REVIEW.md`：
原图及旧结果不覆盖，当前四宽度8组152检查通过；未改变运行页面或生产配置。

后续手机空态视觉实施新增源码后，下面命令的精确before边界仍对应手机视觉实施前；
保留为该阶段验证，不直接用于当前源码重拍。最新手机空态实际组件验证见后续段落。

运行 `node scripts/verify-provider-adapter-refresh-focus.mjs`，验证四宽度前版/当前、
Enter/空格/鼠标刷新、等待和返回后的焦点。加 `--capture` 仅更新本修复的独立
`output/playwright/p47-refresh-focus`审核包，不改旧图。全部本地GET样例，无真实检查。
当前顶部刷新按钮持有焦点时，等待期间焦点留在标题区域；Tab可进入原有返回链接，
主动移开后响应不抢回。原刷新/重试/API及跨页锁规则不变，无新配置；将来正常宝塔
前端发布后刷新浏览器生效，本批未部署。详细验证和未完成项见
`design-plans/ui-phase-2-2026-09-07/P47-REFRESH-FOCUS-IMPLEMENTATION.md`。

### 运行恢复与兼容证据

当前权限/分页提案组合验证使用
`node scripts/verify-ui-phase2-provider-adapter-current-states.mjs --state=access`或
`--state=filter-pagination`；无capture不写图，保留实际手机空态和两处焦点保护。
这只是本地读取/焦点/路由组合验证，不部署或改变权限；历史图证不自动变为当前通过。
详情见`design-plans/ui-phase-2-2026-09-07/P47-MOBILE-PREVIEW-INTEGRATION.md`。

P47已批准手机空态现已接入组件：沿用760px边界显示温和文案、浅灰区域和蓝色操作，
宽屏保留原文案/样式。原登记链接、清除筛选与刷新逻辑不变。将来随宝塔前端正常发布
后刷新浏览器生效，无新配置或独立后端重启。
当前实施验收：`node scripts/verify-provider-adapter-empty-mobile.mjs --capture`，再执行
`node --test tests/unit/ui-phase2-provider-adapter-empty-mobile.test.mjs`。只写独立
`output/playwright/p47-empty-mobile-implementation`；不加capture不写图、不做图片文件比较。
全部本机GET样例，不代表真实登记、权限或生产验收。详细范围及失败复测记录见
`design-plans/ui-phase-2-2026-09-07/P47-EMPTY-MOBILE-IMPLEMENTATION.md`。

下列双焦点空态入口对应手机视觉实施前的完整源码，只保留历史阶段；不要用于当前
源码重拍。当前请使用上面的实际手机空态实施入口。

P47空态的当前源码回归使用`node scripts/verify-ui-phase2-provider-adapter-empty-refresh-current.mjs`；
加`--capture`只写独立`output/playwright/p47-empty-refresh-focus-current`，旧空态图包保留。
该入口验证空目录/两类筛选无结果，保留空态重置与刷新两处实际焦点保护；仅本机GET
样例，不执行真实登记或检查，不修改生产代码，无新配置或生产重启。
范围见`design-plans/ui-phase-2-2026-09-07/P47-EMPTY-REFRESH-CURRENT-REVIEW.md`。

来源暂停的移动详情必须同时显示错误预算、恢复门和真实健康检查按钮。检查通过后进入采集调度，按 M08-05 的二次确认解除当前来源；禁止直接改表、批量清零或使用早于暂停时间的旧健康结果。

热点来源的兼容矩阵在 390px 下使用单列卡片，不得横向溢出；主卡只显示截断页面指纹，完整 SHA-256 只在技术详情。该查询只读现有证据，不增加环境变量、迁移或常驻进程；单独发布 API 代码需要由宝塔重启统一 Node 后端，Web 静态文件同时替换。

- `adapter_not_registered`：确认该 Provider 是否属于 M03-07 已准入的真实来源；不要猜请求合同或伪造成功。
- `adapter_mode_mismatch`：Provider access_mode 与代码注册声明冲突，停止调用并修正版本化定义或适配器实现。
- `timeout` / `rate_limited` / `dependency_unavailable`：保留 request_id/trace_id，按 Provider 失败规则退避；M03-05 接入后由任务状态机负责重试和死信。
- `login_expired`：停止自动探针并由获授权人员处理凭证；不得绕过验证码、登录或平台限制。
- `invalid_payload` / `response_too_large`：隔离该结果，检查 Parser 与全局边界，不扩大上限掩盖合同错误。

回滚前按架构文档冻结入口并备份；down 迁移只删除适配器健康与操作历史，不删除 Provider 定义。恢复时同时恢复三张表和对应应用版本。
