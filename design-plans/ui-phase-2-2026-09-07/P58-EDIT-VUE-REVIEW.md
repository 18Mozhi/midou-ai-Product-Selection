# P58 · 编辑配额方案 C 方向局部审核

## 本轮范围

使用 ui-skills-root / frontend-design，延续已选择的 C 方向：深蓝版本与操作说明，浅灰步骤区，
白色方案资料、基础配额、状态与原因三组字段；桌面左右分区，390/760 单列。
这是实际 App / Vue 的隔离预览，不是生产文件修改，也不是创建窗审核自动通过。

- 版本取自选中记录的 `expected_version`，不是猜测下一个版本；本地原 E2E 样例为版本 2。
- 保留七字段、两个按钮、原三个状态、所有业务指令、原 required/minlength/maxlength/min/max。
- 帮助文字就近关联 aria-describedby，名称/说明的帮助不并入原字段可访问名称。
- 原“保存新版本”实际只执行 savePlan → prepare → 影响确认；局部预览改为“预览修改影响”。
- 明确取消影响预览会关闭本次修改，不会返回编辑窗；不擅自改成保留草稿或恢复编辑。
- 目检发现旧 header p 等宽字体泄漏，显式覆盖为当前 C 中文无衬线字体及正常字距，并重新出图。

## 当前源码与流程证据

[完整图册](../../output/playwright/p58-edit-current-review/index.html) /
[机器证据](../../output/playwright/p58-edit-current-review/evidence.json)。

基线为未改造的 CommercialOperationsCenter；review 仅转换编辑 dialog 模板及注入局部 CSS。
完整 script、原 styles、其他模板（包括原确认窗）逐字不变；全部原指令及表单属性由 AST 核对。
fixture 从现有 `tests/e2e/m06-06-commercial.spec.ts` 唯一数据与导航对象 AST 提取。

390/760/1440 × baseline/review，6 组、168 检查、33 张连续 PNG、163 个原始源指纹。
三宽度背景指纹一致。每组一次本地 commercial GET，无 POST/PATCH、无真实 HTTP/写入。
原确认窗 `original-impact` 图片仅留作流程证据，不属于本轮重设计或视觉审批范围。

已验证：

- 原生模态、名称初焦点、无横向溢出；review 九个控件均至少 44px。
- 必填原因的原 2 字最小限制（真实键入触发），三个数值原生上下界与整数 step 限制。
- 修改名称/说明/三额度/状态/原因后，原影响区列出 3 个组织、三配额前后值及启用 → 已退役。
- 预览期间只有一个原生模态且无写请求；取消关闭两个窗口，原编辑入口恢复焦点。
- 重新打开恢复原目录数据而非取消的修改；编辑窗 Escape/取消均回原入口。
- 图片记录每段滚动位置/尺寸/原生顶层状态，连续覆盖完整滚动区域，不只截第一屏。

早期测试的“退役”预期与实际 statusText 的“已退役”不符，改为真实输出；未改产品状态文案。
原原因字段保留前端 minlength=2；这不是对服务端原因策略的新裁决。

## 未覆盖与待审

待审核当前手机编辑窗的版本说明、字段分区、帮助文字与底部操作组合。
原确认窗完整布局、确认执行、保存等待/失败/版本冲突、读屏/软键盘/严格 Tab 循环、
跨路由生命周期、真实权限/幂等/MySQL/审计及全页/生产验收均未完成。
原影响算法的其他边界未在此修复；创建结果未知时原键原内容策略仍等用户确认。
此前三个创建相关视觉审核仍各自待答，不被本轮替代或重复询问。

## 复验与交付

生成：`node scripts/verify-ui-phase2-commercial-edit.mjs --capture`。
定向：`node --test tests/unit/ui-phase2-commercial-edit-review.test.mjs`（3 项）。
与此前 17 项创建预览测试和 6 项 DIAGNOSTIC 合并为 26 项；诊断通过仍只说明风险复现，不是修复。

样式调节仅在 `implementation/commercial-edit-preview.css` 的 p58-revise-review / p58-revise-c
边界；生产没有加载该文件。不新增依赖、API、配置、环境变量、数据库或权限合同，OpenAPI 无需改。
原创建图包未改。PNG/JSON/HTML 是保留的正式审核产物；无一次性测试脚本/日志，浏览器和 Vite 已关闭。
无需生产重启，未部署。全库提交门禁仍未清除，不把定向验证替代全库验收；本批未提交，commit hash 不适用。
