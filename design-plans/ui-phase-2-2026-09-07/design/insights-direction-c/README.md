# P18 分析事实 · INSIGHTS-C-r1

状态：C 方向已选；具体图稿待审核。41 场景 × 桌面 1440 / 手机 390，共 82 张永久 PNG；零业务弹窗。本批仅补市场、竞争、风险及概览关联/评分工作面，不代表完整 P18 或全 73 页完成。

[打开交互稿](index.html) · [图与源码证据](evidence.json) · [上批核心稿](../opportunity-detail-direction-c/README.md) · [利润成本稿](../profit-direction-c/README.md)

## 设计与审核重点

蓝色目录、白色单一事实工作面：概览将竞品与供应分栏；评分按维度形成可展开明细；市场用事实范围说明，不画无来源的增长曲线；风险等级与覆盖对照。手机目录折叠，字段纵向展开，不缩小正文。正文与控件 16px、元数据 13px、按钮 44px；原生 details 支持键盘，遵守 reduced-motion。目检修正了桌面品牌孤字换行。

审核时选择顶部场景，下方目录切换工作面；原有业务链接只记录导航意图，不跳转生产。评分是 overview 内部工作面，不新增业务 tab 或 API。不同状态是固定隔离案例，不模拟真实 Worker 完成时间。

## 数据来源与边界

- 机会/规则维度来自 tests/e2e/m04-03-scoring.spec.ts；80.2、权重、加权分均展示原快照，不本地计算。
- 竞品事实来自 tests/e2e/m04-05-competitors.spec.ts，仅投影当前 OpportunityCompetitorSummary 字段。净水杯机会与手机壳竞品的关联是跨夹具排版样例，不是真实业务匹配；页面底部始终提醒。
- 供应搜索/候选数量、零值/缺失/高低风险/过时和错误等变体均为合成布局样例，不是生产判断。评分为零时各维度与加权分也置零，避免样例内部矛盾。
- 市场只有机会整体 evidence_count/source_count 与 market 覆盖，不能把所有关联证据叫趋势信号。风险只有 risk_level 和 section_status.risk，不能虚构六项通过清单。竞争仅最近快照，不补历史曲线或未提供的商品外链。
- 风险 covered 也不代表本响应提供了逐项评估；保存 low 不覆盖 insufficient_data。真实零价格/评分/评论数与 null 分开，缺失不回退零。
- 新鲜度展示原字段，不根据今天日期改写历史事实；旧夹具 fresh 不代表目前仍新鲜。
- 前端读取能力的 manage/read 投影按现有代码；后台 GET 仍各自要求 competitor:read / sourcing:read，POST 要求 competitor:manage / supplier_quote:manage，重新评分要求 opportunity:decide。这里只测试界面投影，不认证真实授权继承。

## 动作与状态合同

| 操作 | 真实 Vue 意图（API 客户端相对路径） | 原行为 / 图稿边界 |
| --- | --- | --- |
| 采集竞品 | POST /opportunities/:id/competitor-discovery；空 body | 返回 task_id 后提示排队，不自动重读或增长数量 |
| 采集供应 | POST /sourcing/searches；input_type=opportunity、input_ref=当前 ID | 无 expected_version；排队不等于供应能力已核实 |
| 重新评分 | POST /opportunities/:id/score-runs；expected_version=当前版本 | 成功触发 load，一次调用不代表新评分已出；旧快照不变 |
| 关联重读 | 按能力 GET /competitors 和 /sourcing/searches | 仅当前机会严格匹配，供应还要求 input_type=opportunity |
| 来源明细 | 原生 details 展开/收起 | 展示已有维度/证据 ID 或竞品记录标识，不编造详情 URL |
| 相关页面 | 原有竞品、供应、规则、机会证据/利润、机会列表入口 | 本地记录导航，不写入业务、不替代真实路由守卫 |

脚本执行实际 loadDownstream、discoverCompetitors、discoverSuppliers、queueScore 函数：验证四种读取权限组合、精确筛选、候选累计、三种 POST body 和成功/失败重读次数。竞品 1、快照 2、搜索 2、候选累计 5；两个错误范围的 99 条样例被排除。候选累计不宣称去重供应商数。

## 现有缺口与待审提案

实际 Promise.all 中供应读取失败会使整个关联组 error，竞品本轮成功也不能展示；旧数组仍保留。已用源函数内存执行复现，未改 Vue，也未擅自拆分读取契约。本稿将提示改为“关联数据本轮读取未完成”，不声称两个接口都失败，不展示隐藏旧值为成功。

未知写入不宣称未写入，并暂停再提交、提供任务核对入口；评分排队成功后重读失败保留成功事实，只重试读取，重读前禁重复排队。这些为保守待审交互，并非已存在的 Vue 能力。来源展开、中文维度标签与 busy/目录保护也仅在图稿。固定场景切换隔离旧延迟完成不等于真实跨机会/组织竞态已解决。

读取 loading/error/真实空/无权限分开；采集与评分包含提交中、排队、明确拒绝，另有结果未知与成功后重读失败。生成图没有真实 POST、鉴权、幂等校验、任务写入或数据库读写；未覆盖真实 Vue 重读错误传播、组织切换迟到响应、软键盘、200%缩放、三主题两密度或所有按钮六态，不注销 OP07–OP10。

## 验证与使用

在仓库根目录运行：

```powershell
node scripts/verify-ui-phase2-insights-c.mjs --capture
node scripts/verify-ui-phase2-insights-c.mjs
```

首条重建永久图片与 evidence.json；第二条重新执行来源/交互断言并比对所有源/数据/图片哈希。复用现有 Playwright，file:// 运行，无服务器；HTTP=0、storage=0，浏览器在 finally 关闭。验证字体/热区、无横溢出、零值/缺失、权限、准确 body、快照不变、恢复不重复写、目录与 details 键盘操作。其他宽度/生产能力不由本证据担保。

本批没有修改真实 Vue/API/OpenAPI/数据库/配置/依赖，无部署、无需重启。图片、数据、交互稿和验证脚本属于用户要求的永久交付；没有新建临时文件或服务，未处理来源不明或历史受限文件。

## 全部图片

| 场景 | 桌面 | 手机 |
| --- | --- | --- |
| 概览 / 关联数量 | [1440](1440-overview.png) | [390](390-overview.png) |
| 评分 / 历史运行 | [1440](1440-score.png) | [390](390-score.png) |
| 评分 / 展开证据 | [1440](1440-score-details.png) | [390](390-score-details.png) |
| 评分 / 缺失输入 | [1440](1440-score-missing.png) | [390](390-score-missing.png) |
| 评分 / 真实零值 | [1440](1440-score-zero.png) | [390](390-score-zero.png) |
| 评分 / 尚无运行 | [1440](1440-score-no-run.png) | [390](390-score-no-run.png) |
| 评分 / 只读 | [1440](1440-score-readonly.png) | [390](390-score-readonly.png) |
| 市场 / 汇总非需求结论 | [1440](1440-market.png) | [390](390-market.png) |
| 市场 / 覆盖不足 | [1440](1440-market-missing.png) | [390](390-market-missing.png) |
| 市场 / 零条证据 | [1440](1440-market-empty.png) | [390](390-market-empty.png) |
| 竞争 / 最近快照 | [1440](1440-competition.png) | [390](390-competition.png) |
| 竞争 / 出处展开 | [1440](1440-competition-details.png) | [390](390-competition-details.png) |
| 竞争 / 确认空结果 | [1440](1440-competition-empty.png) | [390](390-competition-empty.png) |
| 竞争 / 尚无快照 | [1440](1440-competition-no-snapshot.png) | [390](390-competition-no-snapshot.png) |
| 竞争 / 字段缺失 | [1440](1440-competition-null.png) | [390](390-competition-null.png) |
| 竞争 / 零值保留 | [1440](1440-competition-zero.png) | [390](390-competition-zero.png) |
| 竞争 / 过时事实 | [1440](1440-competition-stale.png) | [390](390-competition-stale.png) |
| 竞争 / 无读取权限 | [1440](1440-competition-no-access.png) | [390](390-competition-no-access.png) |
| 竞争 / 正在读取 | [1440](1440-competition-loading.png) | [390](390-competition-loading.png) |
| 竞争 / 关联读取失败 | [1440](1440-competition-error.png) | [390](390-competition-error.png) |
| 风险 / 未知且覆盖不足 | [1440](1440-risk.png) | [390](390-risk.png) |
| 风险 / 低风险不等于完整 | [1440](1440-risk-low-missing.png) | [390](390-risk-low-missing.png) |
| 风险 / 高风险已保存 | [1440](1440-risk-high.png) | [390](390-risk-high.png) |
| 风险 / 覆盖状态非逐项清单 | [1440](1440-risk-covered.png) | [390](390-risk-covered.png) |
| 概览 / 真实空结果 | [1440](1440-overview-empty.png) | [390](390-overview-empty.png) |
| 概览 / 正在读取 | [1440](1440-overview-loading.png) | [390](390-overview-loading.png) |
| 概览 / 关联读取失败 | [1440](1440-overview-error.png) | [390](390-overview-error.png) |
| 概览 / 仅竞品可读 | [1440](1440-overview-comp-only.png) | [390](390-overview-comp-only.png) |
| 概览 / 仅供应可读 | [1440](1440-overview-supplier-only.png) | [390](390-overview-supplier-only.png) |
| 概览 / 均无读取权限 | [1440](1440-overview-no-access.png) | [390](390-overview-no-access.png) |
| 采集竞品 / 提交中 | [1440](1440-competitor-busy.png) | [390](390-competitor-busy.png) |
| 采集竞品 / 已排队 | [1440](1440-competitor-queued.png) | [390](390-competitor-queued.png) |
| 采集竞品 / 明确拒绝 | [1440](1440-competitor-failed.png) | [390](390-competitor-failed.png) |
| 采集供应 / 提交中 | [1440](1440-supplier-busy.png) | [390](390-supplier-busy.png) |
| 采集供应 / 已排队 | [1440](1440-supplier-queued.png) | [390](390-supplier-queued.png) |
| 采集供应 / 明确拒绝 | [1440](1440-supplier-failed.png) | [390](390-supplier-failed.png) |
| 重新评分 / 提交中 | [1440](1440-score-busy.png) | [390](390-score-busy.png) |
| 重新评分 / 已排队旧分仍在 | [1440](1440-score-queued.png) | [390](390-score-queued.png) |
| 重新评分 / 明确拒绝 | [1440](1440-score-failed.png) | [390](390-score-failed.png) |
| 重新评分 / 成功后重读失败 | [1440](1440-score-reload-error.png) | [390](390-score-reload-error.png) |
| 操作 / 结果待核对 | [1440](1440-write-unknown.png) | [390](390-write-unknown.png) |

## 后续

市场/竞争/风险图稿补齐了上一批待办中的三个分区；P18 的 AI、血缘、复盘和相应操作/两种 AI 原因弹窗继续出图。P18 汇总整合、具体稿审核、真实 Vue 实现及全 73 页部署验收仍待完成。P16 采纳规则冲突保持待确认，不在本批改变。
