# P43 创建与改密跨窗口归属 · 当前回放

## 本轮范围

继续全73页C方向重构。起点main / af239b08b69f7d97cd0372f9840a70009eeef0c7，
592项既有变更、暂存为空。上一轮两步改密及详情顶部仍待用户审核，不升级批准。
使用UI技能路由和既有Playwright驱动；依据产品总纲账号基线、页规格、原创建/改密归属
报告，追踪当前父Vue、useUserCreationOwner、usePlatformUserDetail及直接回归。

当前生产源码已有保护，本轮不重复实施或调整行为。旧创建回执不关闭/污染新表单，
旧改密回执不关闭同账号重开或另一账号的详情；仍保留原成功通知、列表重读和草稿规则。

## 历史门与当前门分离

原两历史测试6项4过2失败，均为ResponsiveDataView捕获b9e635与当前8669cbd来源不符。
新历史读取器固定四份完整manifest、原Git与165项来源绑定（跨包重复计数）：

| 历史包 | manifest提交 | 捕获父Vue来源 | 来源数 | 原图 |
| --- | --- | --- | ---: | ---: |
| 创建baseline | b93caa7f | 01af0262，原驱动明确载入 | 41 | 32 |
| 创建current | b93caa7f | b93caa7f | 42 | 32 |
| 改密baseline | 05c5ebe0 | b93caa7f，原驱动明确载入 | 41 | 40 |
| 改密current | 05c5ebe0 | 05c5ebe0 | 41 | 40 |

代码中固定完整40位Git提交及完整manifest SHA；只有两baseline父组件使用明确来源例外。
全部blob按捕获SHA核对，无当前源码兜底。原144图、旧缺陷/修复前后行为断言保留，
创建包补上三个组件转换SHA核对。原历史名称里的current只代表当时修复版本，不是今天。

新当前入口只允许create-current/password-current两个阶段，拒绝baseline重拍。固定
原驱动完整SHA，只转移输出目录、解析导入并接入已有P43 current预览helper；完整逆向
比较证明交互、断言、请求与finally未改。浏览器使用当前原始Vue，经原审核模板/CSS组合。
旧P43目录/创建、安全图包、共享helper及生产CSS/组件不修改。

## 当前浏览器与图证

[当前72图](../../output/playwright/p43-lifecycle-current-replay-r1/index.html) /
[完整清单](../../output/playwright/p43-lifecycle-current-replay-r1/evidence.json)

| 当前组合 | 场景 | 检查 | 图片 | 与历史current字节相同 |
| --- | ---: | ---: | ---: | ---: |
| 创建回执 | 16 | 160 | 32 | 13 |
| 改密回执 | 20 | 220 | 40 | 0 |
| 合计 | 36 | 380 | 72 | 13 |

390/1440双端；先不截图预跑全部，再独立捕获全部。59图字节不同、全部尺寸未变，不称
像素一致或自动批准。分包当前来源44/43，聚合54项含折入CSS和回放辅助代码。
当前来源、转换结果、全部检查和请求观察与原current合同逐项核对，旧图片未覆盖。

创建：正常、关闭、重开、二次重开，成功/失败交叉；每场景一个本地拦截POST，合计
16POST/24GET。新邮箱和密码草稿保持，不出现第二次创建，旧失败不写入新窗。
改密：正常、只关密码、关详情、重开同账号、切换另一账号，成功/失败交叉；每场景
一个原账号本地拦截POST，合计20POST/58GET；第二账号零写入，等待时改密入口仍禁用，
未强点禁用控件或改内部Vue状态制造路径。取消不等于取消已发送请求。

原E2E样例A及明确的合成B保留；B为空组织/会话，不是真实账号或授权结果。全部密码只
使用合成匹配标记，原membership缺organization_id继续披露，不补造数据。人工查看
390重开创建成功后、390切换账号改密成功后，证据显示新草稿/替换详情保留；不提交新
视觉批准问题，不重复索要此前待审组合的确认。

## 定向验证与完整门

原6项修复后全过，3项新来源/驱动定向保护通过，30项实际函数归属回归通过。
最终以下8文件54项通过、零失败/取消/跳过，27979ms：

- `tests/unit/ui-phase2-user-create-lifecycle.test.mjs`
- `tests/unit/ui-phase2-user-password-lifecycle.test.mjs`
- `tests/unit/ui-phase2-user-lifecycle-review-capture-boundary.test.mjs`
- `tests/unit/platform-user-creation-owner.test.mjs`
- `tests/unit/platform-user-password-ownership.test.mjs`
- `tests/unit/ui-phase2-user-review-capture-boundary.test.mjs`
- `tests/unit/ui-phase2-user-security-review-capture-boundary.test.mjs`
- `tests/unit/ui-phase2-account-unit-gate.test.mjs`

直接函数回归验证路由往返、缓存停用/卸载、失效原因确认和selected缺失；这些不冒充
完整App/KeepAlive真实浏览器导航验证。原草稿保留、只取消密码但原详情有效时的关闭规则
保持，敏感字段清理、完整导航、真实RBAC/SQL/会话撤销/MFA与生产验收仍未完成。

P43这批历史门收拢后，再执行一次全库CLI，以新报告取代推算旧失败数。入口为
`node scripts/verify-ui-phase2-user-lifecycle-unit-gate.mjs`，固定新报告
`P43-LIFECYCLE-CAPTURE-UNIT-RESULT.json`，完整TAP诊断需与终态失败数量一致；报告存在后
拒绝启动第二轮或覆盖。原P44报告保持不变。首轮271文件1554项1427过127失败，
370600ms，全部127项诊断与CLI终态对齐，零取消/跳过。相较P44完整报告按失败名称多重集
比较，六项P43来源失败消失，新增一项真实工作区格式门失败；初报告不是无新增回归。

### 新增格式门失败的原因与修复

额外内存探针复用原verify-code-style流程，没有临时脚本或改写工作区：741个文件一次
传给Prettier，参数33876字符，子进程status=null/error.code=ENAMETOOLONG。原验证器
未输出spawn错误，只留下exit1，不能当作某个文件格式不合格或忽略这项失败。

仅修复工具调用：新增code-style-command-batches，按含引号/转义保守估算的24000
UTF-16预算拆分，原清单/顺序不变，所有批次照常检查、任一失败仍阻断，明确输出启动
失败诊断。原Prettier规则、640行长、生产检查、--check/--write与基线规则保持。
没有新依赖、配置或环境变量，README和Feature Map同步使用说明。

4项分批单测通过，覆盖900条含空格/中文路径、预算边界、无遗漏/重排、失败后仍检查
后续批次、spawn错误不冒充成功。原格式门2项复测通过，真实工作区只做--check、不
改写源码；隔离--write只在测试自建库内执行，该库已删除并核对不存在：
`C:/Users/23136/AppData/Local/Temp/scoutops-code-style-4QQSJ7`。

原失败报告保留，重复执行预检在子测试启动前拒绝且报告字节不变。修复后全库用独立
`scripts/verify-ui-phase2-user-lifecycle-unit-gate-r2.mjs`及
`P43-LIFECYCLE-r2-CAPTURE-UNIT-RESULT.json`，不覆盖首轮诊断。

最终r2：272文件1558项1432过126失败，354223ms，exit1，零取消/跳过；126项完整诊断
与CLI终态逐项对齐。相对P44的1539项/132失败，按失败名称多重集、路径反斜线转义
归一后减少六项P43来源失败，无新增失败名称；相对本轮首跑仅消除整库格式门失败。
这不是全库通过，也不把既有失败都视为无害。r2报告重复执行预检在子测试启动前拒绝，
完整报告字节未变。新的四项分批测试计入1558；报告防覆盖检查是之后的独立检查。
格式fixtureCleanup记录创建/删除同一路径，另核对不存在：
`C:/Users/23136/AppData/Local/Temp/scoutops-code-style-fSjlGm`。

本轮文档153项、运行文档一致性、代码Prettier与定向diff检查通过。没有产品运行代码
变化，不重复前端build；格式门及整个单测链已在修复后重验。剩余126项及完整App导航、
其他控件/页面和真实生产验收继续，不以本批局部证明缩小原目标。

## 使用及收尾边界

`node scripts/verify-ui-phase2-user-lifecycle-review-current-replay.mjs`无参数只回放当前
两个组合、不截图、不访问生产；`--smoke`只创建。当前来源检查运行新boundary测试。
完整图包已存在，`--capture`/`--resume`在启动浏览器前拒绝覆盖；改动后应建立新版本
而非覆盖原证据。无生产配置、调参、迁移或重启要求。

本轮无新增临时脚本、调试日志或失败图包；现有格式门创建并在finally清理临时隔离库，
路径见上方与r2报告fixtureCleanup。72图及来源清单、永久测试和两轮全库报告属于
交付物保留。回放服务和浏览器均由原finally关闭；60477、60616、60877、61012已核对
无监听。此前策略拒绝清理的四目录不重试、不绕过，仍保留：

- `D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p44-current-replay-r1`
- `D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p44-current-replay-r2`
- `D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p47-c-e2e-temp`
- `C:/Users/23136/AppData/Local/Temp/scoutops-p44-p46-replay-37f4e02d2ecd4dc5bf27ef9bffe270dd`

不改生产Vue/CSS、API/OpenAPI、后端/插件/Python消费链、环境变量、数据库、依赖或权限；
生产契约同步不适用本轮审核辅助变化。文档/功能地图同步当前证据和调用命令，不运行
历史部署或迁移。工作区有混合既有变更且发布门未完成，未暂存/提交/部署，commit hash
不适用。全73页重构、逐项审核与生产签收目标保持不变。
