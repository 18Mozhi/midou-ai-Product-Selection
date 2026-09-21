# P39 历史图证边界与当前重放

本批是第二阶段整体验收门修复，不是新设计批准或生产发布。当前完整73页目标保持。

## 复现与原因

三文件原11项测试中7通过/4失败。旧图的来源检查直接读取后来修改过的共享组件，
包括 ResponsiveDataView、筛选抽屉和 use-modal-dialog，导致历史证据被混当成当前验收。
不把新增 discardReturnFocus 方法删除以满足旧快照，也不把当前哈希写回旧证据。

三个完整原manifest分别固定在原提交：

| 图包 | 原提交 | 图数 | 原来源数 |
| --- | --- | --- | --- |
| filter | 797e8af35a8a1209ce3b007a21e8678ba8d98cc0 | 18 | 39 |
| create | 6e01d1cfeb22edd7346770d47340e8bd9c9f1d0f | 42 | 38 |
| page | 4cfea9db0376ef6bc2f1266ecba1961c06e550a0 | 28 | 42 |

读取完整Git blob并验证原来源哈希；未知阶段、缺失文件或损坏对象直接失败，不回退到
当前源码。旧图片字节、控件断言、请求断言及pending批准状态不变。历史检查不再证明
当前页面，当前页面由下面的独立原断言重放覆盖。

## 当前重放及必要修复

使用既有Playwright/Vite驱动，在内存中仅解析静态导入与重定向输出，不创建临时脚本，
不替换实际Vue源。三驱动原文件完整哈希固定，所有浏览器断言和请求样例保留。
原样例均拦截本地GET/POST，不会创建真实账号，不证明后端筛选/审计/MFA/权限。

首次filter82检查18图、create121检查42图通过，page在开启服务前失败。实际父组件的
nav与筛选器之间新增了P44管理员目录标题，旧审核布局插入器要求两者紧邻。
仅调整该插入器关闭nav之后的锚点，保留已有条件标题；旧源生成结果完全不变，当前
源的整个script和全部原生指令绑定完全相同。没有删除新标题或回退生产组件。

恢复时先验证已完成两包的当前来源、原检查和全部图片，直接复用，没有重复重拍。
只运行未完成page：57检查28图。最终260检查88张当前图，84张字节完全一致，4张
差异保留为比较证据，不自动批准。图库：`output/playwright/p39-current-replay-r1/index.html`，
当前来源和精确变化表见同目录 `evidence.json`。这些仍是组件级C提案，不是完整App壳层。

四张字节差异：filter/1440-reset-focus、create/390-pending、create/1440-failure、
create/1440-failure-bottom；所有尺寸相同。差异不以提高容差抹去，也不等于生产回归已获豁免。

按RGBA逐像素精确计数分别为9、69、6、6；边界分别为[0,8,1,12]、[21,274,28,508]、
[758,12,759,16]、[758,12,759,16]。人工对照筛选、手机等待与桌面失败未发现文案/布局
变化；没有把微小差异置零，也不由此宣称全部状态视觉验收。当前三包来源数45/44/48，
汇总加审核驱动及递归样式依赖55份原始来源。

## 运行方式与边界

```powershell
node scripts/verify-ui-phase2-account-current-replay.mjs --smoke
node scripts/verify-ui-phase2-account-current-replay.mjs
node --test tests/unit/ui-phase2-account-capture-boundary.test.mjs tests/unit/ui-phase2-account-create-preview.test.mjs tests/unit/ui-phase2-account-filter-preview.test.mjs tests/unit/ui-phase2-account-page-preview.test.mjs tests/unit/ui-phase2-account-unit-gate.test.mjs
```

smoke只运行filter无图；无参数运行三包无图。`--capture`独占r1目录，存在就拒绝。
`--resume`仅用于本次中断采集恢复，已有包逐项验证后复用；完整交付后不要使用该参数
重新写汇总，日常复核使用无参数。三个原驱动的原输出目录和旧图不变。

全库CLI报告驱动：`node scripts/verify-ui-phase2-account-unit-gate.mjs`，无参数，执行
`node --test --test-concurrency=8 tests/unit/*.test.mjs`。只在完整footer与失败数逐项对齐后
写入独占 `P39-CAPTURE-UNIT-RESULT.json`，避免工具输出截断导致失败名单丢失；没有用
programmatic node:test.run冒充CLI完整运行。既有结果文件不覆盖，测试失败仍非零退出。
本次结果已存在，后续再次运行会在启动测试子进程之前拒绝。需要新一轮全库复核时，
按独立版本记录新证据，不删除或覆盖这份结果。

不改API、数据库、环境变量、依赖、权限、草稿或实际生产行为；OpenAPI不适用。
无生产导入、重启或部署。开始main/af239b08、548项混合在途变化，暂存为空。
本批图和脚本为永久审核/验证交付物，无新增临时文件。测试服务在finally关闭。
旧清理阻塞未扩大或重试删除，仍保留：

- `D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\p47-c-e2e-temp`
- `C:\Users\23136\AppData\Local\Temp\scoutops-p44-p46-replay-37f4e02d2ecd4dc5bf27ef9bffe270dd`

## 本批最终验证与交接

原11项7过4失败 → 修复后11/11；新增来源/驱动/当前绑定和CLI汇总测试共5项通过，
当前模板完整script/指令额外1项通过。全库CLI共267文件、1531项：1392过、139失败、
0取消/跳过，494412.3112ms，exit1。139条完整失败诊断均与footer对齐；原始结果不截断，
见 `P39-CAPTURE-UNIT-RESULT.json`。按文件名转义归一后，比旧147失败少8条，无新增名称；
其中本批P39修复4条，另外4条是前批P47重放，不能归功于本批。

全库结束后为报告命令补了“文件存在先拒绝、不得再启动完整测试”的局部前置检查，
该工具3项定向测试通过。没有再次跑全库或把这1个新增测试算进上面的1531项。
格式、73路由/153必需文档、运行文档及相关git diff --check通过。

完整测试子进程56436已结束；50310/50450/50491/50700均无监听。完整单测的隔离格式
夹具由其finally自行清理，已核对没有本轮新建的scoutops-code-style目录遗留；未删除
既有用户目录。图证为永久交付物保留。最终560项混合在途变化、暂存为空，因完整门
仍失败不提交、不部署、不重启。下一步继续共享依赖与剩余139条失败的逐项复现。
