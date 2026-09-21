# P43 用户目录、详情与创建组合的当前回放

## 本轮范围

继续全73页C重构，不以局部检查替代设计签收或宝塔验收。起点main /
af239b08b69f7d97cd0372f9840a70009eeef0c7，576项既有工作区变更、暂存为空。
P44创建组合仍待用户回复；本轮不扩大任何已有批准。

使用UI技能选择现有Playwright驱动，不安装依赖、生成静态替代页面或改变运行页面。
依据P43页规格、产品总纲平台账号管理合同及当前PlatformAccountCenter/Dialogs/Detail。

## 已复现与修复

原两份测试9项7过2失败：旧截图绑定的ResponsiveDataView来源与当前不一致。
另对当前原始父组件直接调用旧预览，明确在nav/筛选紧邻锚点失败；旧测试的历史来源
重构曾隐藏这项当前装配问题。本轮不修改原共享user-page-preview、P44辅助文件或生产。

新增P43专用`ui-phase2-user-page-current-preview.mjs`：暂取出精确的P44条件标题，完成
原P43审核装配后放回筛选前，保留原`v-if`、文案及class。P43用户模式不显示这个管理员
专属标题，不借此改变用户/管理员页签规则。当前完整script、动态指令、表达式和原生
控件合同保持；未知标题/锚点漂移拒绝。新helper只供审核宿主，不进入生产导入链。

新增`ui-phase2-user-review-historical-capture.mjs`固定page/create两份完整manifest、
原Git提交及77项来源绑定（跨包重复计数）。全部Git blob逐项核对SHA；缺失或未知来源
拒绝，无当前源码兜底。原154张PNG、请求记录和变换结果全部保留，不改旧哈希。
两原测试只分离捕获来源，当前原始Vue结构测试独立执行；原9项最终全部通过。

## 当前图证

[图包入口](../../output/playwright/p43-current-replay-r1/index.html) /
[聚合来源与差异清单](../../output/playwright/p43-current-replay-r1/evidence.json)

| 当前组合 | 浏览器检查 | PNG | 与旧图字节不同 |
| --- | ---: | ---: | ---: |
| 用户目录、详情与读取状态 | 266 | 68 | 20 |
| 创建用户字段、控件及反馈 | 293 | 86 | 13 |
| 合计 | 559 | 154 | 33 |

四宽度390/760/761/1440、两组8个宽度组合，先不截图预跑全部通过，再正式捕获。
完整原驱动SHA固定；除输出目录和静态导入解析（指向新P43预览helper），全文件逆向
比较一致，原交互、请求断言及finally未改。没有插入新CSS或修改业务处理器。

原Vue/CSS经审核模板组合，不是完整未转换App。53项聚合来源包含折入CSS及新审核
入口/辅助文件；原、新分包指纹与全部图片逐项核对。121图字节相同，33不同但尺寸均
保持，不称像素一致、不使用容差放过图像差异。没有新全局壳层或主题验收结论。

60本地拦截GET、8本地拦截POST，无真实账号创建。创建仍严格五个原字段、幂等键、
合成密码匹配标记，普通用户空平台角色/组织转null，默认组织角色保持。目录/详情仅
GET，原因取消不写；详情重试与停用样例动作禁用遵守原断言，不代表真实权限通过。
原membership样例缺organization_id，保留并披露，没有补造组织授权事实或纠正样例。

人工查看当前390详情顶部、760筛选区。详情顶部身份、关闭按钮与四项事实布局提交用户
审核，尚未收到回复；下方组织授权表单及真实数据完整性不包括在该问题中。

## 验证与使用

新增5项保护：当前标题/动态绑定、原驱动完整逆向、历史manifest/blob、当前来源/图像/
请求保持，以及完整包在浏览器启动前拒绝capture/resume。最终以下5文件25项全部通过：

- `tests/unit/ui-phase2-user-page-preview.test.mjs`
- `tests/unit/ui-phase2-user-create-preview.test.mjs`
- `tests/unit/ui-phase2-user-review-capture-boundary.test.mjs`
- `tests/unit/ui-phase2-admin-review-capture-boundary.test.mjs`
- `tests/unit/ui-phase2-account-capture-boundary.test.mjs`

后两份确认P44和P39当前图包依赖及原图仍完整，未被本轮接入污染。
日常回放：`node scripts/verify-ui-phase2-user-review-current-replay.mjs`，只运行当前审核
组合、不截图、不覆盖图包。来源检查用上述新boundary测试。`--capture`仅首次创建新包，
`--resume`仅续跑未完成且来源仍一致的完整分包；完整r1存在后二者都在启动浏览器前拒绝。
页面样式/行为今后变化需新版本图包，不得覆盖旧批准证据。

本轮无共享运行代码、依赖、配置变化，因此不重复生产构建或全库长测试；完整验证采用
直接与相邻图包保护套件。最近全库仍是P44阶段1539项1407过132失败，不是本轮重跑，
不能直接减去两项推算当前失败总数。P43改密、原因、创建/密码归属历史门等剩余项继续，
不以本轮两组合证明全部弹窗完成。

## 收尾与未完成

临时Vite/Chromium由finally关闭，端口57584、57636、57731、57785在收尾另核对无监听。
没有创建临时草稿、诊断日志或失败图包；正式154图、来源清单和永久测试作为交付物保留。
此前四处清理被策略拒绝的目录本轮不重试：
`D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p44-current-replay-r1`；
`D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p44-current-replay-r2`；
`D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p47-c-e2e-temp`；
`C:/Users/23136/AppData/Local/Temp/scoutops-p44-p46-replay-37f4e02d2ecd4dc5bf27ef9bffe270dd`。

不改运行Vue/CSS、API/OpenAPI、后端/插件/Python生产消费链、数据库、环境变量、依赖、
安全或权限规则；生产契约同步不适用本轮审核辅助改动，无需调参、重启或迁移。
工作区混有此前变更，发布门未关闭，未暂存/提交/部署，commit hash不适用。
当前新组合待审，全73页正式重构、其他控件/状态、真实账号权限及生产签收仍未完成。
