# P21 供应链与利润 · C方向整页待审提案

2026-09-09：[逐动作审核入口](../../SOURCING-SEMANTIC-REVIEW.md)已将54源位置归38组，关联本包145图；仍缺170代表状态槽的逐控件证据。本轮没有改图、提升批准或实施生产，SC-G01–08继续待处理。

SOURCING-C-r1；起始main/b30fb8a2；62场景、145PNG。具体页面未获审，方向C不是逐页批准或部署许可。

[交互原型](index.html) · [全部图片图册](gallery.html) · [来源与验证证据](evidence.json)

## 新构图与使用

按frontend-design的流程导向构图：白身份栏、蓝找货记录范围、白色候选阅读面；报价与对象操作放在同一行的右区，证据和缺项留在事实旁。对比与机会成本是同一记录下的本地可键盘切换内容区，不新增路由/API/存储。手机顺序为范围、记录、来源状态、内容和选择操作栏；对比逐供应商纵排，不把五列压成小字。

直接打开index.html，在顶部选择审核场景。所有报价、供应商、成本、版本和响应都是合成合同样本；外链使用保留示例域名，不对应真实商品。点击只记录内存请求/导航意图，不连接HTTP/SQL/生产，不下单、不付款、不采集或提交真实审批。生产代码/费用算法不变。

## 覆盖与事实边界

- 62主场景双端124张；9张长弹窗下半部图；第六选择拒绝、低于MOQ及主按钮focus/hover双端8张；768/1024代表页4张，共145张。普通页全长、模态图只截实际视口，避免把视口外未遮罩内容误当弹窗效果。
- 货源、来源进度、ERP线索、2–5对比、四种搜索、报价确认、MOQ采购、原因删除与机会成本三种身份（已生效/待复核/计算快照）均有提案。
- 显式0和缺失不同；已有MOQ=1/交期=7/可信度=80只是来源表单默认，图中提示逐项核实，不宣称来自采集。报价不发送原始price/currency修改字段。稳定性variable按现有选项表达为波动，不改后端枚举。
- 已保存对比绑定保存时的报价ID，不说今天仍是现行报价。格式提示仅归一全半角、大小写和空白，不换算单位或判断等价。
- ERP历史参考不是确认报价；到岸价待费用规则计算。仅calculated场景显示明确合成的服务端利润快照；缺输入、待复核、重算排队均不在浏览器计算或制造ROI。
- 成本提交需要另一名活动cost:confirm复核人，expected_version来自机会；复核采用独立review版本3；采购使用quote_id和MOQ。P22费用版本双角色审批不放进P21，也不把不同合同混成同一个版本字段。

## 动作 / 弹窗映射

| 来源语义 | 场景与局部验证 | 未覆盖的运行边界 |
| --- | --- | --- |
| SC-S-OPEN/CLOSE/SUBMIT | keyword/image/opportunity/product_url，required、取消保留、两字段原样POST、错误/忙碌 | 来源条款真实校验、所有并发关闭/重开 |
| SC-SEARCH/DETAIL/NAV | 搜索、记录切换、真实from/机会/采集明细目标、独立平台权限 | 实际history、KeepAlive、范围与迟到结果 |
| SC-QUOTE | 四窗之一；九报价字段及candidate_id、时间本地转UTC、0、原始价格不可编辑 | 当前报价事务、证据归属、datalist越权不能由前端证明 |
| SC-SELECT/COMPARE | 1项禁保存、2–5可保存、第六不勾选、取消已有选择、精确quote IDs | 实际报价is_current/同范围校验、写后持久结果 |
| SC-PURCHASE | 版本/MOQ/证据同屏，99低于100不提交、trim原因、重开默认 | 真实采购任务消费者与执行 |
| SC-DELETE/REFRESH | trim原因、不编revision，历史保留，失败保留输入/取消；刷新只有排队 | 真实软删审计、写成功后GET失败/迟到归属 |
| SC-COST-SUBMIT/RECALCULATE | 九字段、reviewer、机会version7；原始观察时刻；缺输入无ROI | 真实双人/数据库/24h提醒与升级 |
| SC-COST-REVIEW | 按can_review显式显示，两种内联原因，review.version3与trim原因、取消 | 真实后端身份、过期、跨记录并发 |
| SC-SOURCE/ERP/STATE | 新窗口声明、错误/限流/空态、纯重读意图 | 目的地运行、全共享状态主次动作矩阵 |

场景DOM有28个动作标记，包含本地内容切换/复核入口的变体，不是全站去重动作分母或28个完整业务验收。成本提交与成本复核是内联表单，不算第五/第六弹窗。来源四窗的原生dialog焦点循环、Escape/遮罩取消和归还、窗内错误、busy锁是新提案；未应用到实际Vue。

## 源码证据与未修复项

九组真实setup隔离检查执行SourcingWorkspace、SourcingCostConfirmationPanel与SourcingComparisonPanel，Vue reactivity真实、transport/router/checkbox宿主为替身；不是实际DOM组件挂载或SQL验证。

已复现：比较历史GET失败阻断已有找货列表；刷新成功notice被load清空；variable缺中文映射；成本Promise.all在reviewer读取失败时不形成新快照。源报价默认1/7/80与cost时间默认仍保留。图稿的独立降级/准确提示/焦点约束不能当这些源码缺口已修。源代码无计时GET，不把后台投影等同页面轮询。

SC-G01–08保持开放。当前仅9宽度×5代表面、双端主要交互、纽约/上海报价时间抽样；720×500是等效CSS重排，不是真实200%缩放或辅助技术。三主题两密度仅代表主面，不覆盖所有弹窗/内容/错误组合。长文本、完整主题矩阵、真实Vue/RBAC/SQL/Worker/通知/事务/所有竞态及生产签收均待办；此前E2E文件仅来源绑定，本轮未重跑。

## 复验 / 交付

- 源最小检查：`node scripts/verify-ui-phase2-sourcing-source.mjs`。
- 只读复验：`node scripts/verify-ui-phase2-sourcing-c.mjs`，比较来源/图片指纹后跑隔离浏览器。
- 有意重生成本包：`node scripts/verify-ui-phase2-sourcing-c.mjs --capture`；只写本包正式PNG、evidence.json和gallery.html。不得刷新其他包掩盖漂移。
- 项目门禁和清理准确记录见[本轮记录](../../PROGRESS.md)。正式145PNG、图册与两永久验证器保留；无一次性临时文件/服务，验证浏览器finally关闭。
- 不改生产Vue/API/OpenAPI、配置、依赖、数据库、权限、原费用规则或历史证据；无需重启。P22仍待单独整页交稿；所有73页实施、审核、部署和签收没有完成。

审核请注明“P21 / SOURCING-C-r1 / 场景 / 通过或修改意见”。不能由选C自动批准任何一页。

## 逐场景图片

| 场景 | 桌面1440 | 手机390 |
| --- | --- | --- |
| 完整找货工作台 | [查看](1440-workspace.png) | [查看](390-workspace.png) |
| 关键词记录 / 无机会成本 | [查看](1440-keyword-record.png) | [查看](390-keyword-record.png) |
| 待确认报价字段 | [查看](1440-missing-quote.png) | [查看](390-missing-quote.png) |
| 只读货源 | [查看](1440-readonly.png) | [查看](390-readonly.png) |
| 独立成本权限 | [查看](1440-cost-only.png) | [查看](390-cost-only.png) |
| 受权采集明细 | [查看](1440-platform-inspect.png) | [查看](390-platform-inspect.png) |
| 首次排队 | [查看](1440-queued.png) | [查看](390-queued.png) |
| 来源执行中 | [查看](1440-running.png) | [查看](390-running.png) |
| 部分来源受阻 | [查看](1440-source-blocked.png) | [查看](390-source-blocked.png) |
| 采集失败 | [查看](1440-failed.png) | [查看](390-failed.png) |
| 采集成功无候选 | [查看](1440-empty-result.png) | [查看](390-empty-result.png) |
| 无找货记录 | [查看](1440-empty.png) | [查看](390-empty.png) |
| 正在读取 | [查看](1440-loading.png) | [查看](390-loading.png) |
| 读取失败 | [查看](1440-error.png) | [查看](390-error.png) |
| 会话过期 | [查看](1440-expired.png) | [查看](390-expired.png) |
| 无权限 | [查看](1440-forbidden.png) | [查看](390-forbidden.png) |
| 限流 | [查看](1440-rate-limited.png) | [查看](390-rate-limited.png) |
| 搜索无结果 | [查看](1440-search-empty.png) | [查看](390-search-empty.png) |
| 详情失败 | [查看](1440-detail-error.png) | [查看](390-detail-error.png) |
| 对比历史读取失败 | [查看](1440-comparison-error.png) | [查看](390-comparison-error.png) |
| ERP参考不作为确认报价 | [查看](1440-erp.png) | [查看](390-erp.png) |
| 选择一家 | [查看](1440-select-one.png) | [查看](390-select-one.png) |
| 选择两家 | [查看](1440-select-two.png) | [查看](390-select-two.png) |
| 最多五家 | [查看](1440-select-five.png) | [查看](390-select-five.png) |
| 已保存对比 | [查看](1440-comparison.png) | [查看](390-comparison.png) |
| 规格仅格式差异 | [查看](1440-spec-format.png) | [查看](390-spec-format.png) |
| 规格不一致 | [查看](1440-spec-different.png) | [查看](390-spec-different.png) |
| 找货输入 / keyword | [查看](1440-search-keyword.png) | [查看](390-search-keyword.png) |
| 找货输入 / image | [查看](1440-search-image.png) | [查看](390-search-image.png) |
| 找货输入 / opportunity | [查看](1440-search-opportunity.png) | [查看](390-search-opportunity.png) |
| 找货输入 / product_url | [查看](1440-search-product_url.png) | [查看](390-search-product_url.png) |
| 找货失败保留 | [查看](1440-search-error.png) | [查看](390-search-error.png) |
| 找货提交中 | [查看](1440-search-busy.png) | [查看](390-search-busy.png) |
| 确认新报价版本 | [查看](1440-quote.png) | [查看](390-quote.png) |
| 缺字段预填非事实 | [查看](1440-quote-defaults.png) | [查看](390-quote-defaults.png) |
| 报价失败保留 | [查看](1440-quote-error.png) | [查看](390-quote-error.png) |
| 报价提交中 | [查看](1440-quote-busy.png) | [查看](390-quote-busy.png) |
| 锁定报价与MOQ | [查看](1440-purchase.png) | [查看](390-purchase.png) |
| 采购失败保留 | [查看](1440-purchase-error.png) | [查看](390-purchase-error.png) |
| 采购提交中 | [查看](1440-purchase-busy.png) | [查看](390-purchase-busy.png) |
| 删除保留证据 | [查看](1440-delete.png) | [查看](390-delete.png) |
| 删除失败保留 | [查看](1440-delete-error.png) | [查看](390-delete-error.png) |
| 删除提交中 | [查看](1440-delete-busy.png) | [查看](390-delete-busy.png) |
| 利润输入不足 | [查看](1440-cost-missing.png) | [查看](390-cost-missing.png) |
| 已计算历史快照 | [查看](1440-cost-calculated.png) | [查看](390-cost-calculated.png) |
| 成本待复核 | [查看](1440-cost-pending.png) | [查看](390-cost-pending.png) |
| 复核超时不自动批准 | [查看](1440-cost-overdue.png) | [查看](390-cost-overdue.png) |
| 复核通过记录 | [查看](1440-cost-approved.png) | [查看](390-cost-approved.png) |
| 复核驳回记录 | [查看](1440-cost-rejected.png) | [查看](390-cost-rejected.png) |
| 成本只读 | [查看](1440-cost-readonly.png) | [查看](390-cost-readonly.png) |
| 内联通过原因 | [查看](1440-cost-review-approved.png) | [查看](390-cost-review-approved.png) |
| 内联驳回原因 | [查看](1440-cost-review-rejected.png) | [查看](390-cost-review-rejected.png) |
| 成本读取失败 | [查看](1440-cost-error.png) | [查看](390-cost-error.png) |
| 无可选复核人 | [查看](1440-cost-reviewers-empty.png) | [查看](390-cost-reviewers-empty.png) |
| 成本提交失败保留 | [查看](1440-cost-submit-error.png) | [查看](390-cost-submit-error.png) |
| 利润重算排队 | [查看](1440-cost-recalculating.png) | [查看](390-cost-recalculating.png) |
| deep-ocean / standard | [查看](1440-deep-ocean-standard.png) | [查看](390-deep-ocean-standard.png) |
| deep-ocean / compact | [查看](1440-deep-ocean-compact.png) | [查看](390-deep-ocean-compact.png) |
| cloud-white / standard | [查看](1440-cloud-white-standard.png) | [查看](390-cloud-white-standard.png) |
| cloud-white / compact | [查看](1440-cloud-white-compact.png) | [查看](390-cloud-white-compact.png) |
| aurora-purple / standard | [查看](1440-aurora-purple-standard.png) | [查看](390-aurora-purple-standard.png) |
| aurora-purple / compact | [查看](1440-aurora-purple-compact.png) | [查看](390-aurora-purple-compact.png) |

### 长表单、控件和断点补图

- [quote-lower · 1440px](1440-quote-lower.png)
- [quote-defaults-lower · 1440px](1440-quote-defaults-lower.png)
- [quote-error-lower · 1440px](1440-quote-error-lower.png)
- [quote-busy-lower · 1440px](1440-quote-busy-lower.png)
- [sixth-rejected · 1440px](1440-sixth-rejected.png)
- [purchase-below-moq · 1440px](1440-purchase-below-moq.png)
- [button-focus · 1440px](1440-button-focus.png)
- [button-hover · 1440px](1440-button-hover.png)
- [quote-lower · 390px](390-quote-lower.png)
- [quote-defaults-lower · 390px](390-quote-defaults-lower.png)
- [quote-error-lower · 390px](390-quote-error-lower.png)
- [quote-busy-lower · 390px](390-quote-busy-lower.png)
- [purchase-error-lower · 390px](390-purchase-error-lower.png)
- [sixth-rejected · 390px](390-sixth-rejected.png)
- [purchase-below-moq · 390px](390-purchase-below-moq.png)
- [button-focus · 390px](390-button-focus.png)
- [button-hover · 390px](390-button-hover.png)
- [workspace · 768px](768-workspace.png)
- [cost-calculated · 768px](768-cost-calculated.png)
- [workspace · 1024px](1024-workspace.png)
- [cost-calculated · 1024px](1024-cost-calculated.png)
