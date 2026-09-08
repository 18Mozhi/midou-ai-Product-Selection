# P18 AI、血缘与经营复盘 · REVIEW-C-r1

状态：C 方向已选，具体图稿待审核。51 场景 × 桌面 1440 / 手机 390，共 102 张永久 PNG；2 种 AI 抽检原因弹窗（通过/驳回），11 字段经营复盘保持页内表单。

[打开交互稿](index.html) · [查看源码和图片证据](evidence.json) · [机会核心稿](../opportunity-detail-direction-c/README.md) · [利润稿](../profit-direction-c/README.md) · [分析事实稿](../insights-direction-c/README.md)

## 设计方案与审核重点

本批使用 frontend-design：延续 C 方向蓝色目录与白色工作面，但三个任务采用不同的信息结构。

- 颜色：目录蓝 #254a9c、正文深灰 #202c3d、辅助灰 #58677b、底色 #edf1f6、纸白 #ffffff、错误红 #9b342e。
- 字体：Microsoft YaHei UI / Microsoft YaHei 中文系统字体，正文和输入 16px、元数据 13px，层级用字号与留白区分，不给每个字段加装饰标签。
- AI：左侧分析记录目录，右侧摘要、分类与缺失提示，输入出处按需展开；“生成新分析”与“抽检”职责分开。
- 血缘：按源返回的业务分组列出节点、状态、完整失败码和时间，没有后端边关系就不画因果箭头。
- 复盘：当前返回记录、服务端校准快照和事实明细；录入另一个页内工作面，分周期、销售广告、采购利润、来源四组，不新建业务路由。
- 移动端：蓝目录折叠、阅读区单列、表单单列；弹窗顶部标题/底部操作保持可读、正文可滚动，44px 热区与 reduced-motion。
- 方案自检：不把三页切成相同卡片、不虚增进度数字。目检后增加 AI 操作区与记录目录间距，移除无意义的重复“填写实际值”提示。

```text
蓝色工作目录 | AI：记录目录 | 原始辅助输出 + 抽检
             | 血缘：影响范围 + 分组节点（不是因果图）
             | 复盘：服务端基线 + 不可变事实 / 11字段录入
```

## 事实来源

AI 原始请求/结果来自 tests/e2e/m04-07-ai-analysis.spec.ts；完整 SHA-256、模型名、提示合同、结果 ID 与 source_refs 都可核对。模型名只是历史结果出处，不是浏览器模型配置；无密钥、模型端点或模型调用。

血缘使用 tests/m04-02/business-lineage.test.mjs 的 rows，执行实际仓库 lineage 方法，通过惰性查询适配器返回 11 种节点及原始路由、9 次查询参数。保持该夹具的 opportunity-1，不改造为 AI 夹具的 UUID；页面明确说明两者不是同一生产业务链。固定验证时钟 2026-08-23T03:00Z，3600 秒只是读取快照，不是当前新鲜度。

复盘行来自 tests/m04-02/operating-feedback.test.mjs；实际仓库 operatingFeedback 方法生成历史、不同币种、零值和亏损四个离线结果。生产读取按 period_end / created_at / id 排序最多 20 行：显示“已返回条数”，不称所有周期，也不合并同周期记录。

零值、读取/写入错误、已审状态、多个请求等都是明确的合成布局场景，不是生产证据。血缘降级/无失败场景只保留相应节点并同步关联 ID/观测状态，不假造缺失节点。页面保留完整状态（例如 failed_terminal:parser_failed），不只显示冒号前的状态。

## 每个工作面的字段与操作

| 工作面 | 字段或动作 | 展示边界 |
| --- | --- | --- |
| AI 输出 | status、created_at、attempt_count、last_error_code、摘要、classifications、missing_fields、source_refs | 没有 result 不生成内容；queued/leased/retry/terminal/dead_letter 分开 |
| AI 出处 | 请求/结果 ID、input_sha256、prompt_contract_version、model_name、provider_request_id | 展开原值，不改写 AI 输出，不把结果当事实 |
| AI 抽检 | review_status、outcome、notes、reviewed_by、reviewed_at | 只有 opportunity:decide 且 pending 有操作；两种原因分别绑定 result_id |
| 血缘 | freshness、failure_impact、nodes、request_ids、trace_ids | 所有返回节点可展开，保留缺失；数量有限额不是完整全历史 |
| 血缘节点 | kind、id、label、status、occurred_at、request_id、trace_id、route | URL 按源数据记录；目标页面授权由原路由守卫执行 |
| 复盘摘要 | 返回 facts 数量、calibration 全部四项及规则/决定基线 | 比率不加变化正号；偏差才有正负；null 不是 0 |
| 复盘明细 | 周期、销量、销售额、广告、退货、交期、利润、币种、来源、说明 | 原事实不覆盖、无自动规则更新/决定 |
| 复盘展开 | 事实 ID、评分/利润规则快照、决定、预测利润/币种、报价交期、观测/创建时间、request/trace | 不丢审计链，不把缺失基线拼成数字 |
| 复盘录入 | period_start/end、sales_units、revenue_amount、ad_spend_amount、returned_units、purchase_lead_time_days、actual_profit_amount、currency、source_ref、notes | 11 可见字段；observed_at 在提交时生成，不增加时间输入 |

## 写入合同与恢复

- 生成：POST /opportunities/:id/ai-analyses，body 仅 expected_version；实际函数成功后 load 并 setTab(ai)，排队不自动产生结果或改变机会事实。
- 抽检：POST /ai-analyses/:resultId/reviews，body 为 outcome / trim 后 notes，没有 expected_version；通过/驳回各自弹窗、取消不写入、失败保留原因、提交成功仅改抽检记录而不改 content。
- 读取：GET /opportunities/:id/ai-analyses；只读身份可重试读取，没有生成/抽检操作。
- 复盘：POST /opportunities/:id/operating-feedback，11 字段加当前 expected_version 和提交时 observed_at，币种大写。源函数只替换 operating_feedback、清 source_ref / notes，保留数值和日期，不 load、不改机会版本/评分/决定。
- 表单校验依据服务端：周期合法且结束不早于开始，退货数不大于销量，数量为非负整数，交期最多 3650 天；销售额/广告非负，利润允许负值；币种 3 字母、来源必填≤255、说明≤1000。永久助手验证非法日期、周期、退货、分数销量与亏损。
- 预置复盘输入对应一次固定成功返回：追加独立ID、当前notes和时间的新事实，旧事实完整保留。新样例快照为待决定且缺预测利润/报价交期，因此相应偏差为null，不沿用历史基线。同一场景重复提交或任意改填的其他值只记录精确请求意图并明确未模拟成功，不伪造新返回，也不在浏览器重算偏差。

## 已核对缺口，不冒充已修复 Vue

1. loadAi 失败保留旧数组；源模板旧记录不受 loading/error 分支约束。本稿标识旧数据并暂停其抽检。非数组响应原函数回退 [] / ready，本稿改为格式异常，不误称无分析。
2. useAuditedReason 在 submit 时关闭请求，父级随后才 write；实际函数组合验证失败时也已经关闭。本稿保留弹窗原因；提交中收起不取消，失败后可恢复原因，取消后再次打开重置。恢复后的取消也会移除旧恢复入口。
3. 前端最小 trim 长度为 2，后端校验允许 1 且最多 1000；本稿保留前端 2，补齐后端上限，不修改规则。永久助手分别执行两侧校验，真实后端已审冲突仍由服务处理。
4. 血缘 observed_at 存在但 age_seconds 为 null 时，源模板 ??0 会显示零。图稿显示未提供；这是静态模板合同证据，不声称真实仓库在正常数据下必然产出该组合。
5. 未知写入保留输入、暂停再次提交；接受后读取失败保留接受事实并只重试读取。都是待审保守交互，尚未迁入真实 Vue。
6. 后端校准同币种才比较利润，分母为零时相应比率为 null；离线源仓库已验证，前端只读结果。不是实际 SQL/RBAC/服务事务认证。

本图稿不注销 OP07–OP10 或全站门；真实跨机会/组织迟到响应、抽检结果竞争、幂等键、模型调用/输出验证、数据库权限和软键盘尚未通过本次验证。两种原因弹窗与51场景不等于所有主题/密度/按钮六态/200%缩放完备。

## 使用和验证

打开交互稿后使用顶部场景选择器；左侧目录只切换本稿工作面。业务节点和返回链接仅记录导航意图，不连接生产。

```powershell
node scripts/verify-ui-phase2-review-c.mjs --capture
node scripts/verify-ui-phase2-review-c.mjs
```

第一条重建永久 PNG 和 evidence.json；第二条重新执行源函数/交互断言并校验源、数据、图片哈希。复用既有 Playwright，file://运行，HTTP=0、localStorage/sessionStorage=0，浏览器 finally 关闭。主场景全页，弹窗按真实视口截取，未把视口外背景冒充可见。

覆盖双端51场景、11字段、两原因的trim/取消/焦点循环/失败保留/收起后恢复、原文不可变、AI旧记录与读失败、血缘完整错误/导航、复盘请求/零与亏损/可比基线。没有新增临时文件、服务或监听端口；图稿、数据、PNG、证据和验证脚本是永久交付。

没有修改生产 Vue/API/OpenAPI/DB/权限/模型配置/依赖；无需重启，未部署。本批与前三批需要整合为完整P18后再按审核结果进入真实实现；全73页及生产签收仍未完成。

## 全部图片

| 场景 | 桌面 | 手机 |
| --- | --- | --- |
| AI / 待抽检结果 | [1440](1440-ai.png) | [390](390-ai.png) |
| AI / 输入与出处展开 | [1440](1440-ai-details.png) | [390](390-ai-details.png) |
| AI / 真实空记录 | [1440](1440-ai-empty.png) | [390](390-ai-empty.png) |
| AI / 正在读取 | [1440](1440-ai-loading.png) | [390](390-ai-loading.png) |
| AI / 首次读取失败 | [1440](1440-ai-error.png) | [390](390-ai-error.png) |
| AI / 失败保留旧记录 | [1440](1440-ai-stale-error.png) | [390](390-ai-stale-error.png) |
| AI / 非数组响应 | [1440](1440-ai-malformed.png) | [390](390-ai-malformed.png) |
| AI / 只读 | [1440](1440-ai-readonly.png) | [390](390-ai-readonly.png) |
| AI / 已排队无输出 | [1440](1440-ai-queued.png) | [390](390-ai-queued.png) |
| AI / 已领取无输出 | [1440](1440-ai-leased.png) | [390](390-ai-leased.png) |
| AI / 等待重试 | [1440](1440-ai-retry.png) | [390](390-ai-retry.png) |
| AI / 处理终止 | [1440](1440-ai-terminal.png) | [390](390-ai-terminal.png) |
| AI / 死信 | [1440](1440-ai-dead-letter.png) | [390](390-ai-dead-letter.png) |
| AI / 已通过 | [1440](1440-ai-approved.png) | [390](390-ai-approved.png) |
| AI / 已驳回 | [1440](1440-ai-rejected.png) | [390](390-ai-rejected.png) |
| AI / 新旧记录分开 | [1440](1440-ai-multiple.png) | [390](390-ai-multiple.png) |
| 生成分析 / 提交中 | [1440](1440-ai-queue-busy.png) | [390](390-ai-queue-busy.png) |
| 生成分析 / 已接受 | [1440](1440-ai-queue-success.png) | [390](390-ai-queue-success.png) |
| 生成分析 / 明确拒绝 | [1440](1440-ai-queue-failed.png) | [390](390-ai-queue-failed.png) |
| 生成分析 / 接受后重读失败 | [1440](1440-ai-reload-error.png) | [390](390-ai-reload-error.png) |
| 通过抽检 / 空原因 | [1440](1440-approved-empty.png) | [390](390-approved-empty.png) |
| 通过抽检 / 已填写 | [1440](1440-approved-filled.png) | [390](390-approved-filled.png) |
| 通过抽检 / 提交中 | [1440](1440-approved-busy.png) | [390](390-approved-busy.png) |
| 通过抽检 / 失败保留 | [1440](1440-approved-failed.png) | [390](390-approved-failed.png) |
| 驳回抽检 / 空原因 | [1440](1440-rejected-empty.png) | [390](390-rejected-empty.png) |
| 驳回抽检 / 已填写 | [1440](1440-rejected-filled.png) | [390](390-rejected-filled.png) |
| 驳回抽检 / 提交中 | [1440](1440-rejected-busy.png) | [390](390-rejected-busy.png) |
| 驳回抽检 / 失败保留 | [1440](1440-rejected-failed.png) | [390](390-rejected-failed.png) |
| 抽检 / 结果待核对 | [1440](1440-review-unknown.png) | [390](390-review-unknown.png) |
| 血缘 / 返回节点 | [1440](1440-lineage.png) | [390](390-lineage.png) |
| 血缘 / 技术标识与错误 | [1440](1440-lineage-details.png) | [390](390-lineage-details.png) |
| 血缘 / 无节点 | [1440](1440-lineage-empty.png) | [390](390-lineage-empty.png) |
| 血缘 / 距今时间未提供 | [1440](1440-lineage-age-unknown.png) | [390](390-lineage-age-unknown.png) |
| 血缘 / 关联标识缺失 | [1440](1440-lineage-no-correlation.png) | [390](390-lineage-no-correlation.png) |
| 血缘 / 降级 | [1440](1440-lineage-degraded.png) | [390](390-lineage-degraded.png) |
| 血缘 / 未发现失败影响 | [1440](1440-lineage-none.png) | [390](390-lineage-none.png) |
| 复盘 / 事实与可比基线 | [1440](1440-feedback.png) | [390](390-feedback.png) |
| 复盘 / 完整历史快照 | [1440](1440-feedback-details.png) | [390](390-feedback-details.png) |
| 复盘 / 尚无事实 | [1440](1440-feedback-empty.png) | [390](390-feedback-empty.png) |
| 复盘 / 无可比基线 | [1440](1440-feedback-incomparable.png) | [390](390-feedback-incomparable.png) |
| 复盘 / 零与无法计算 | [1440](1440-feedback-zero.png) | [390](390-feedback-zero.png) |
| 复盘 / 实际亏损 | [1440](1440-feedback-loss.png) | [390](390-feedback-loss.png) |
| 复盘 / 只读 | [1440](1440-feedback-readonly.png) | [390](390-feedback-readonly.png) |
| 录入 / 11字段默认值 | [1440](1440-form.png) | [390](390-form.png) |
| 录入 / 已填事实 | [1440](1440-form-filled.png) | [390](390-form-filled.png) |
| 录入 / 提交中 | [1440](1440-form-busy.png) | [390](390-form-busy.png) |
| 录入 / 明确失败保留 | [1440](1440-form-failed.png) | [390](390-form-failed.png) |
| 录入 / 周期错误 | [1440](1440-form-period.png) | [390](390-form-period.png) |
| 录入 / 退货量错误 | [1440](1440-form-returns.png) | [390](390-form-returns.png) |
| 录入 / 成功追加独立记录 | [1440](1440-form-success.png) | [390](390-form-success.png) |
| 录入 / 写入结果待核对 | [1440](1440-form-unknown.png) | [390](390-form-unknown.png) |
