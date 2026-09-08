# P18 机会详情：C 方向核心图稿

版本：OPPORTUNITY-DETAIL-C-core-r1。状态：待审核，非最终页面、非生产验收。

[打开交互图稿](index.html) · [源码与图片哈希证据](evidence.json) · [完整页面规格](../../page-specs/P18.md) · [机会合同](../../opportunity-contract-review.md)

## 本批范围

51 场景 × 1440×1000 / 390×844，共 **102 张永久 PNG**。页面截图使用全页；三种人工决定弹窗使用真实视口，不用超长页面图伪装弹窗可见区域。本批只覆盖结论核心、证据和决策历史；不是完整 P18，也不代表全 73 页任务完成。

利润与成本、风险、市场、竞争、AI 辅助、业务血缘、经营复盘七个分区仅保留真实导航键并标记待设计，不算业务工作面。成本/反馈内联输入、AI 两种原因弹窗、评分/利润/AI 排队及竞品/供应采集操作均待后续批次。

## 为什么这样重新布局

沿用用户选择的 C 方向，而非旧账页布局。目录蓝 #254a9c 承担核对导航，深蓝 #193b80 用于交互；白色工作面、冷灰 #edf1f6 背景、正文 #202c3d、分隔 #dbe1e9。正文及控件 16px，元数据 13px，以微软雅黑 UI / 微软雅黑 / 等线为中文字体栈，信息左对齐。

桌面左侧是核对目录，右侧先显示机会身份，再把系统建议与人工决定明确分开；五项质量门各自显示通过/缺失，数量不代替采纳规则。证据以来源清单呈现，决定以历史记录呈现，不套同一种指标卡。手机目录默认折叠，可展开十个入口；第一轮目检发现完整目录挤出结论，已修正并重出全部图。没有装饰性动效；按钮状态与焦点用于解释操作结果。

## 操作与状态对应

| 操作 | 本批图稿与核对 | 保留的实际边界 |
| --- | --- | --- |
| 返回来源列表 | 页面顶栏；图稿只记导航意图 | 当前 helper 仅接受单斜杠本地路径，不是完整路由白名单 |
| 十个分区入口 | 桌面目录 / 手机展开；当前入口标识 | overview 移除 tab，其他保留 tab 与 from，replace 语义；七区待设计 |
| 运行信息 | technical 场景，按需展开 | ID、版本、评分规则、阶段停留；无新 API |
| 五项质量门 | 推荐/候选/每项缺失/汇总未通过 | recommended 且 all_passed 才有采纳；不以通过数计算权限 |
| 提前人工处理 | early；观察与驳回 | 未开放候选采纳，不触碰 P16 的待决规则 |
| 三种人工决定 | 各自空/已填/busy/503保留/成功，共15场景 | 原始原因和当前 expected_version；后端 trim，必填且≤1000 |
| 弹窗取消 / Esc | 取消零写、重开清原因、焦点归还 | 请求已提交后关闭不取消；在途对象竞态仍未在 Vue 验收 |
| 记录失败 | 弹窗内错误/关联字段/显式重试 | 不自动重复写；真实 DB/幂等与网络恢复未认证 |
| 冲突 / 结果未知 | 两个独立保守恢复提案 | 要求先核对新版本/历史；不声称当前 Vue 已禁止重试 |
| 创建补采任务 | blockers，busy 与返回导航检查 | POST expected_version；真实函数分别验证新建/复用后重读与任务详情导航 |
| 查看已有任务 | progress/cleared | 现有入口是 /tasks?task=id，不偷换成创建完成的 /tasks/id 导航 |
| 重新决定定位 | redecision | 先核对最新证据；焦点落在现有决定区域 |
| 原文 | evidence/evidence-long | canonical_url，_blank + noopener noreferrer；图稿阻止实际打开，零外网请求 |
| 更多 / 收起证据 | evidence-20/40/41 | 20→40→41，收起20；数组或机会ID替换重置20，维持返回顺序 |
| 历史记录 | 空/三种决定/长原因 | 原因、版本、时间、操作者；全部为隔离布局样例 |
| 主读取 | loading/empty/error/forbidden/expired/blocked/profit-error | 利润依赖失败仍阻断主详情；404不是空。重试为内存恢复演示 |

## 数据与证据边界

永久助手 scripts/lib/ui-phase2-opportunity-detail-design-data.mjs 从当前源文件 AST 提取函数，在 VM 执行：canAdopt 六种组合、decide 三动作成功/失败、startDecision 清原因、后端原因验证、补采新建/复用及导航、证据20/40/41和收起、返回/tab helper。data.js 与每次提取结果深比较。

推荐样本来自历史 m04-02 夹具，基础详情来自 UI2-OP 夹具；护肤样例不是实际自动评估支持范围或真实推荐。当前实际自动评估的类目边界未改动。41证据、长文本、历史、补数状态为明确合成布局状态；不制造真实来源、评分或用户活动。

已在当前源码复现两处缺口：摘要与决定弹窗重复 opportunity-decision-title；未知传输错误显示“未写入任何状态”。图稿使用唯一标题ID、对未知结果不保证未写入。这些是待审改进，**没有修改 Vue**。冲突阻止直接重发、busy编辑保护、错误关联与焦点也是提案，不冒充已修复实际生命周期。

隔离 HTML 无 HTTP、真实 storage、数据库、权限授予或生产写入。源函数 VM 执行不等于真实 Vue E2E。AI/下游读取、真实事务/跨租户/迟到响应、200%缩放/软键盘、三主题两密度和实际部署均未验收。

## 验证与使用

当前结果：capture与无参数复验均通过51场景双端，102PNG与清单相符、106个链接存在。文档/运行文档/静态分析/格式检查通过；生产源码未改，不能据此推导真实Vue或生产验收通过。

本地打开 index.html，通过顶部审核场景切换。业务导航只记录内存意图，不进入真实系统；审核控件不是生产页面组成部分。

在仓库根目录执行：

```powershell
node scripts/verify-ui-phase2-opportunity-detail-c.mjs --capture
node scripts/verify-ui-phase2-opportunity-detail-c.mjs
```

首次命令重新生成本目录永久图片与证据；第二条验证源文件和图片哈希，再验证双端交互。检查包括三动作精确body、失败保留、空白原因、打开清空、Tab/ShiftTab/Esc、关闭后提交继续、只读/质量门、证据41条、已有/新建任务路径、目录与主读取。只检查本稿正文≥13px、控件≥16px、主要表单控件≥44px与横向溢出，不等于完整无障碍认证。

本批未引入环境变量、API、配置、依赖或数据库迁移，因此 .env.example/OpenAPI 与生产启动命令不适用；无需重启或部署。没有新增临时文件/服务，浏览器上下文 finally 关闭，102 PNG 与 evidence.json 是应保留的审核交付物。

## 全部图片

| 场景键（顶部选择器有中文名称） | 桌面 | 手机 |
| --- | --- | --- |
| directory-open | [查看](1440-directory-open.png) | [查看](390-directory-open.png) |
| recommended | [查看](1440-recommended.png) | [查看](390-recommended.png) |
| collecting | [查看](1440-collecting.png) | [查看](390-collecting.png) |
| candidate | [查看](1440-candidate.png) | [查看](390-candidate.png) |
| early | [查看](1440-early.png) | [查看](390-early.png) |
| readonly | [查看](1440-readonly.png) | [查看](390-readonly.png) |
| technical | [查看](1440-technical.png) | [查看](390-technical.png) |
| blockers | [查看](1440-blockers.png) | [查看](390-blockers.png) |
| progress | [查看](1440-progress.png) | [查看](390-progress.png) |
| cleared | [查看](1440-cleared.png) | [查看](390-cleared.png) |
| redecision | [查看](1440-redecision.png) | [查看](390-redecision.png) |
| long | [查看](1440-long.png) | [查看](390-long.png) |
| gate-summary-pending | [查看](1440-gate-summary-pending.png) | [查看](390-gate-summary-pending.png) |
| evidence-empty | [查看](1440-evidence-empty.png) | [查看](390-evidence-empty.png) |
| evidence | [查看](1440-evidence.png) | [查看](390-evidence.png) |
| evidence-20 | [查看](1440-evidence-20.png) | [查看](390-evidence-20.png) |
| evidence-40 | [查看](1440-evidence-40.png) | [查看](390-evidence-40.png) |
| evidence-41 | [查看](1440-evidence-41.png) | [查看](390-evidence-41.png) |
| evidence-long | [查看](1440-evidence-long.png) | [查看](390-evidence-long.png) |
| history-empty | [查看](1440-history-empty.png) | [查看](390-history-empty.png) |
| history | [查看](1440-history.png) | [查看](390-history.png) |
| history-long | [查看](1440-history-long.png) | [查看](390-history-long.png) |
| loading | [查看](1440-loading.png) | [查看](390-loading.png) |
| empty | [查看](1440-empty.png) | [查看](390-empty.png) |
| error | [查看](1440-error.png) | [查看](390-error.png) |
| forbidden | [查看](1440-forbidden.png) | [查看](390-forbidden.png) |
| expired | [查看](1440-expired.png) | [查看](390-expired.png) |
| blocked | [查看](1440-blocked.png) | [查看](390-blocked.png) |
| profit-error | [查看](1440-profit-error.png) | [查看](390-profit-error.png) |
| missing-score | [查看](1440-missing-score.png) | [查看](390-missing-score.png) |
| missing-market | [查看](1440-missing-market.png) | [查看](390-missing-market.png) |
| missing-competition | [查看](1440-missing-competition.png) | [查看](390-missing-competition.png) |
| missing-cost | [查看](1440-missing-cost.png) | [查看](390-missing-cost.png) |
| missing-risk | [查看](1440-missing-risk.png) | [查看](390-missing-risk.png) |
| adopt-empty | [查看](1440-adopt-empty.png) | [查看](390-adopt-empty.png) |
| adopt-edited | [查看](1440-adopt-edited.png) | [查看](390-adopt-edited.png) |
| adopt-busy | [查看](1440-adopt-busy.png) | [查看](390-adopt-busy.png) |
| adopt-failed | [查看](1440-adopt-failed.png) | [查看](390-adopt-failed.png) |
| adopt-success | [查看](1440-adopt-success.png) | [查看](390-adopt-success.png) |
| observe-empty | [查看](1440-observe-empty.png) | [查看](390-observe-empty.png) |
| observe-edited | [查看](1440-observe-edited.png) | [查看](390-observe-edited.png) |
| observe-busy | [查看](1440-observe-busy.png) | [查看](390-observe-busy.png) |
| observe-failed | [查看](1440-observe-failed.png) | [查看](390-observe-failed.png) |
| observe-success | [查看](1440-observe-success.png) | [查看](390-observe-success.png) |
| reject-empty | [查看](1440-reject-empty.png) | [查看](390-reject-empty.png) |
| reject-edited | [查看](1440-reject-edited.png) | [查看](390-reject-edited.png) |
| reject-busy | [查看](1440-reject-busy.png) | [查看](390-reject-busy.png) |
| reject-failed | [查看](1440-reject-failed.png) | [查看](390-reject-failed.png) |
| reject-success | [查看](1440-reject-success.png) | [查看](390-reject-success.png) |
| decision-conflict | [查看](1440-decision-conflict.png) | [查看](390-decision-conflict.png) |
| decision-unknown | [查看](1440-decision-unknown.png) | [查看](390-decision-unknown.png) |

## 审核与接续

请核对结论/证据/历史的整体布局、手机目录、三种决定弹窗和失败提示。方向 C 已选定，具体稿仍待审核。本批不注销 OP07–OP10、完整 P18 及全73页交付；下一项接续利润与成本工作面。P16 采纳规则冲突继续等待用户决定，不因本稿实施作出默认选择。
