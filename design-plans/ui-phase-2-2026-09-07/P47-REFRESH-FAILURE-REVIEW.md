# P47 · 刷新失败并保留旧目录 r1

## 目标与边界

起点 `main/255f03f9`，实际 App 和 ProviderAdapterCenter；使用 frontend-design 延续批准的 C 蓝白工作台、fixing-accessibility 检查原生操作/追踪/focus。本批只做独立审核预览，**生产组件、API、权限、数据、重试策略和部署均不变**。

现状刷新失败时确实保留旧 `items`、筛选、分页和详情，但提示位于完整目录及分页之后，手机用户可能看不到；API action hint 也不保证重复说明“旧数据仍保留”。提案在筛选区之后、目录之前增加局部提示：

- 眉题「更新未完成」、标题「最新状态暂未更新」。
- 固定说明「当前仍显示上一次成功读取的数据，可以继续查看。」明确当前视图不是最新快照；后端原 action hint 原样保留，不猜错误原因。
- 原 request_id 改以「本次刷新追踪」原生 details 展示；编号仍由当前组件原值提供。
- 蓝色「重新刷新」调用原 `load`，不改接口、请求体、安全 GET 重试或 12 秒超时。失败提示开始重试后消失，成功后回到原「已刷新 N 个来源适配器状态」。

为准确区分刷新成功、刷新失败与健康检查反馈，预览新增非持久化 `refreshNotice` 展示状态；它仅决定哪个提示模板显示，不改原 `state/items/message/requestId`。probe 开始会清空此展示状态，原详情内来源归属反馈继续独立。

## 键盘焦点事实

第一次提案曾在重试前聚焦顶部刷新按钮；实际 Chromium 表明按钮变为 HTML disabled 后仍会失焦到 BODY，因此未保留该方案。最终预览给持续存在的 P47 标题 header 增加 `tabindex=-1`，内联重试激活时先将焦点移到本页标题区，再执行原 load；使用 `preventScroll` 且标题区有可见蓝色轮廓。

基线仍通过顶部按钮重试并记录 BODY 失焦；审核稿记录 heading 焦点，成功返回后两者均不被异步回执再次抢走。此修复尚未进入生产，也不是完整读屏/焦点验收。

## 证据

- [54 图总览](../../output/playwright/p47-refresh-failure-review/index.html)：基线/审核 × 390/760/1440 × 409/403/503 × 失败/展开追踪/重试中，共 18 组、387 项检查。
- [证据清单](../../output/playwright/p47-refresh-failure-review/evidence.json)：170 个当前原始源指纹、PNG 哈希与尺寸。
- 原 M03-03 fixture 的两条来源及导航通过 AST 提取；搜索「公开趋势」后仍为 1 项，概要保持 2/1/1/1。失败、追踪、重试均不清除数据或筛选。
- 409/403 各 1 次失败 GET；503 沿用实际 ApiClient 安全重试 3 次。每组随后仅一次显式重试 GET 并本地成功，无 POST、请求体或未知网络。
- 失败提示 `role=status`、审核组合 `aria-atomic=true`；details 和按钮均为原生控件、至少 44px，无横向溢出。测试覆盖 helper 精确锚点漂移失败、组件编译、展示状态、局部焦点 wrapper 和样式隔离。

复验：`node --test tests/unit/ui-phase2-provider-adapter-refresh-failure.test.mjs`。重建图包：`node scripts/verify-ui-phase2-provider-adapter-refresh-failure.mjs --capture`。

本地返回仅验证 UI 与请求合同，不是实网权限/依赖/探针/数据库结果；没有覆盖 AbortController 12 秒真实超时、离页中止或全部读屏。本轮 Vite/Chromium 端口 51038/51127 已关闭；早期失败验证端口 50872 也由 finally 关闭。正式审核图包保留，无临时测试文件、日志或进程。

## 待审

手机 390px 失败与展开追踪组合待用户审核；不代表内联重试焦点、其他宽度、整页或生产批准。此前“读取中”新稿仍待用户答复；首次读取失败措辞、空态焦点、跨页在途锁、真实探针和全 73 页继续开放。
