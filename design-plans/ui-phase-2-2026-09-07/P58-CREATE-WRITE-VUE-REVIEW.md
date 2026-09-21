# P58 · 创建草稿等待与拒绝反馈审核

## 本批范围

承接 [创建窗视觉稿](P58-CREATE-VUE-REVIEW.md)，新增独立实际 Vue 审核层，不修改生产
CommercialOperationsCenter。此前手机创建布局尚待答复；本批不把 P47 空态批准当成 P58 批准。
使用 ui-skills-root / fixing-accessibility 聚焦等待期间关闭保护、持续焦点和窗内错误播报。

原 createPlan 已有单飞及失败保留幂等键，不能当作新增能力。原等待状态仅禁用底部按钮，
顶部关闭与 Escape 仍可退出，七字段仍可编辑；拒绝提示仅写在 native modal 背后的页面。
审核层将七字段与顶部关闭绑定原 mutating，取消/Escape 同样受保护；提交时聚焦持续存在的
标题，并显示 role=status 等待说明。已知 HTTP 拒绝后在窗内 role=alert 展示原 action_hint，
复用 TechnicalDetails 展开编号，恢复编辑，保留输入。原页面 notice 仍保留。

只插入局部反馈与入口 wrapper，去除这些明确增量后全业务脚本逐字等于当前生产源码；
原 createPlan 的请求体、单飞、幂等键、成功流程与异常处理均保留。无依赖或共享模态改动。

## 图册与验证

[42 张正式图册](../../output/playwright/p58-create-write-review/index.html) /
[证据清单](../../output/playwright/p58-create-write-review/evidence.json)。

- baseline/review × 390/760/1440 × conflict/forbidden：12 组、216 检查、42 PNG、165 原始源。
- 每组先悬挂本地 POST，再返回明确 409 或 403；人工再提交一次，共 24 次本地拒绝，无真实写入。
- 保留原版等待退出和背景错误反例；预览等待时七字段禁用、关闭禁用、Escape 留窗、标题持有焦点。
- 重复 submit 不产生第二个等待请求；拒绝恢复字段并保留输入，人工重试的 body 与幂等键不变。
- 错误编号从真实 DOM 校验，取消后回原入口；每组只一次 commercial GET，无意外网络或运行错误。
- 基础数据/导航仍从现有 M06-06 E2E AST 提取；拒绝文案及编号为本地模拟样例，不是服务端验收。
- 连续局部图覆盖长窗；人工目检手机等待、手机权限拒绝及桌面冲突反馈，没有横跨分区的重叠。

永久单测覆盖 Vue 编译、原脚本逆变换、窗外模板/原样式不变、关闭与提交 guard、隔离 CSS、
当前源指纹与完整图片。原创建窗 24 图与其四项测试不变；原商业静态 192 图未改。
样式证据收集首次拒绝了设计目录的 CSS import；只在本地 runner 明确纳入已知基础样式并对
应用源继续使用原限制，未放宽共享收集器。修正后完整 12 组重跑通过。

## 未覆盖与使用方式

这些是审核提案而非生产修复：成功写入、成功后重读失败、无 HTTP 结果、离页/新窗归属、
完整 Tab 闭环、读屏/软键盘、编号复制、真实 MySQL/RBAC/幂等/审计均未验。
本批编号跟随原 requestId，未验证并发读取时的归属；不得据此宣称所有请求追踪已隔离。
没有新增 API、配置、env、数据库或权限合同，后端、Worker/Python、OpenAPI 无需变更。
无需重启，未部署；全 73 页交付及既有全库失败仍开放，不用局部通过替代发布门禁。

生成：`node scripts/verify-ui-phase2-commercial-create-write.mjs --capture`。
验证：`node --test tests/unit/ui-phase2-commercial-create-review.test.mjs tests/unit/ui-phase2-commercial-create-write-review.test.mjs`。
图册为正式交付物保留。Vite/Chromium 由 finally 关闭，临时服务使用 5173；不保留后台服务。
未新增临时脚本或日志，失败中间图由最终 42 图覆盖并经 manifest 清单校验。
全库门禁尚未通过，本批未提交，commit hash 不适用。
