# P14 趋势 · TREND-C-r1

状态：已选C方向，具体图稿待审；不是生产Vue、共享导航整合或真实权限/采集/治理验收。

[打开交互稿](index.html) · [源与图证据](evidence.json) · [P14规格](../../page-specs/P14.md) · [逐动作合同](../../trend-contract-review.md)

## 设计与交付

68场景×1440/390共136主图，另补10张长弹窗下部，共146张永久图。普通工作面为整页图；模态层仅截实际视口，长内容另给滚动下部，避免视口外背景被误认为可交互区域。

frontend-design用于C方向蓝色模式目录与白色工作面。主题列表与详情改为单一阅读焦点，不沿用旧36/64双滚动布局；明确返回但保留topic。详情把结论、证据、来源时间线和历史分组；规则与治理是独立模式，治理仍内联，四个业务弹窗保留类型。手机以三个文字模式入口、单列长表单、固定弹窗标题/操作区呈现，不缩小桌面双栏。共享NavigationShell不是本稿侧区，仍待整合。

基础数据直接抽取tests/e2e/ui-phase2-trend-contracts.spec.ts的fixture和change函数；时间固定2026-08-07，非实时市场事实。第二个同范围主题、来源分组/关键词、长文、分页41总数、质量工单/治理状态等均为明确合成变体，不证明任何真实主体授权、外部原文或实际数据库迁移。热度仅实际样例信号数，缺置信度和环比不填0、不造评分。

## 每个工作面与动作

| 工作面/动作 | 保留合同与待审改进 |
| --- | --- |
| 三模式 | topics/rules/governance；治理只给canManage演示主体。没有创建额外路由，全局壳层另审。 |
| 五筛选 | q/market/category/status/sort；市场仍只有全部/US，状态active/irrelevant/stale/全部，排序四种。页大小20，sort只作用当前页，不进入GET。 |
| 应用/清除 | 草稿与应用URL区分；清除恢复active和impact。新稿保留status=空字符串以表达全部，API GET仍省略status；真实Vue尚未修改。 |
| 保存视图链接 | 仅模拟复制当前已应用URL，非保存到服务端，不复制未应用草稿、不写真实剪贴板；失败提示可复制地址。 |
| 分页/选中/返回 | 页码边界与topic/query保留；返回只关闭详情焦点，不移除topic。当前目录两条样例，page-two的41条总数是分页布局变体，不声称已提供全量记录。 |
| 关注/取消 | PUT或DELETE /trends/:id/follow，无body，按返回followed更新；失败不改。busy局部禁用为待审保护。 |
| 创建监控 | 顶部、详情、规则标题与空态入口；不预填当前主题，取消重开默认US/en-US/60/1。八输入含独立language，与P12七字段表单不同。 |
| 规则提交 | 当前TrendRuleDialog.submit函数直接产出POST比较基准：关键词拆分/trim去空、不客户端去重，原始name/market/language与空分类null，渠道in_app；7周期选项、3门槛选项从源码抽取。 |
| 重复关键词 | 实际validateMonitoringRuleInput执行确认NFKC/小写归一后的重复报400；样例BEAUTY/beauty失败保留。本地演示只覆盖这一已验证后端拒绝分支，不代替所有服务端输入校验。 |
| 规则启停 | PATCH现有id、status、expected_version及原周期/来源门槛；第二次用返回版本。查看结果只取include_keywords[0]作q，不冒充精确规则ID筛选。 |
| 下次采集 | 已暂停且无时间→已暂停；已启用但无时间→尚未设置。当前Vue只按时间判暂停，图稿改正文案但未修源码。 |
| 转为机会 | /opportunities?source_topic_id=…&name=…&market=…&category=…，仅预填导航，不是POST，也不是/opportunities/start。 |
| 原文 | 原始canonical_url、target=_blank及noopener noreferrer；审核中只记录链接意图，不访问example.test。无删除证据动作。 |
| 异常工单 | warning/critical和2–500原因，POST精确topic/evidence URL；201新建或200复用成功后仅本实例禁用该证据按钮。失败留窗；该缓存不证明下一次读取没有工单。 |
| 无关/恢复 | 两个弹窗变体，共用status/reason.trim/expected_version，成功保留原证据和追加历史；本稿失败保留原因，原Vue失败关窗清空缺口仍未修。 |
| 时间线/历史 | 来源筛选仅用返回timeline_sources，未选择用aggregate；切主题清空选择；图示旁保留时间/数值，来源UUID不作普通标签。历史技术details可展开actor_id。 |
| 合并提议 | 候选限当前页、同市场/语言、active且非目标；精确source_topic_ids与版本，signal_ids=[]、新标题分类null。只入队，不执行合并。 |
| 拆分提议 | 精确signal_ids、新名称和可选分类，source_topic_ids=[]；原主题留一条由真实后端另验。本稿不擅自放宽/实现迁移。 |
| 提议草稿 | 切合并/拆分保持现有sourceIds/新标题草稿；expected_versions沿源码遍历sourceIds，切到split可能仍含此前合并选择，未伪称已改合同。离开治理销毁草稿，成功提议不自动reset。 |
| 确认/驳回 | 两种内联form；先取消零写，提交decision/reason/expected_version；按模拟重读状态展示。相同提议人被真实仓库403拒绝的文案作失败图，不用前端隐藏代替真实RBAC。 |
| 刷新来源 | trend:read仍可POST /provider-sources/refresh，固定隔离组织401/工作区402来自旧UI2-TR导航样例；成功只受理source_count，不自动load、不称采集完成。 |
| 错误恢复 | 列表/规则/治理失败不展示旧业务条目或就绪事实；expired到/login，forbidden到/select-context（不授予权限）。这些分区保护和次动作仍是待审提案。 |
| 弹窗行为 | 原生dialog，初焦点关闭键、Tab/Shift+Tab循环、Escape/取消返焦，忙碌中不关闭；失败留窗并将错误放入弹窗。手机筛选使用同类模态，桌面仍内联，不新增业务确认。 |

## 直接执行源码得到的缺口

永久助手执行TrendDashboard.applyFilters→syncFromRoute：选择全部状态后旧query去掉status，恢复时变active。另执行markIrrelevant并让write返回null：relevanceDialog=null且reason为空。evidence.json保留known-gap-not-fixed，不作为UI2-TR08/09已修复证明。

规则重复拒绝和rule/merge/split请求形状直接从真实源函数导出；其余本地交互按已读契约模拟。未执行浏览器真实Vue、SQL/Origin/幂等、真正第二管理员、跨组织和迟到响应，因此不注销TR10/11/12。最小样例的68状态不等于全控件运行分母冻结。

## 全部图

下表的lower为同一长弹窗滚动下部；与对应主图共同核对八字段和按钮。

| 场景 | 图 |
| --- | --- |
| topics | [1440](1440-topics.png) · [390](390-topics.png) |
| detail | [1440](1440-detail.png) · [390](390-detail.png) |
| detail-long | [1440](1440-detail-long.png) · [390](390-detail-long.png) |
| detail-no-evidence | [1440](1440-detail-no-evidence.png) · [390](390-detail-no-evidence.png) |
| detail-history | [1440](1440-detail-history.png) · [390](390-detail-history.png) |
| detail-source | [1440](1440-detail-source.png) · [390](390-detail-source.png) |
| detail-readonly | [1440](1440-detail-readonly.png) · [390](390-detail-readonly.png) |
| help | [1440](1440-help.png) · [390](390-help.png) |
| filter-open | [1440](1440-filter-open.png) · [390](390-filter-open.png) |
| filter-edited | [1440](1440-filter-edited.png) · [390](390-filter-edited.png) |
| filtered | [1440](1440-filtered.png) · [390](390-filtered.png) |
| all-status | [1440](1440-all-status.png) · [390](390-all-status.png) |
| copy-failed | [1440](1440-copy-failed.png) · [390](390-copy-failed.png) |
| page-two | [1440](1440-page-two.png) · [390](390-page-two.png) |
| empty | [1440](1440-empty.png) · [390](390-empty.png) |
| loading | [1440](1440-loading.png) · [390](390-loading.png) |
| error | [1440](1440-error.png) · [390](390-error.png) |
| expired | [1440](1440-expired.png) · [390](390-expired.png) |
| forbidden | [1440](1440-forbidden.png) · [390](390-forbidden.png) |
| blocked | [1440](1440-blocked.png) · [390](390-blocked.png) |
| detail-loading | [1440](1440-detail-loading.png) · [390](390-detail-loading.png) |
| detail-failed | [1440](1440-detail-failed.png) · [390](390-detail-failed.png) |
| followed | [1440](1440-followed.png) · [390](390-followed.png) |
| follow-busy | [1440](1440-follow-busy.png) · [390](390-follow-busy.png) |
| follow-failed | [1440](1440-follow-failed.png) · [390](390-follow-failed.png) |
| refresh-busy | [1440](1440-refresh-busy.png) · [390](390-refresh-busy.png) |
| refresh-started | [1440](1440-refresh-started.png) · [390](390-refresh-started.png) |
| refresh-failed | [1440](1440-refresh-failed.png) · [390](390-refresh-failed.png) |
| rules | [1440](1440-rules.png) · [390](390-rules.png) |
| rules-empty | [1440](1440-rules-empty.png) · [390](390-rules-empty.png) |
| rules-paused | [1440](1440-rules-paused.png) · [390](390-rules-paused.png) |
| rules-failed-sources | [1440](1440-rules-failed-sources.png) · [390](390-rules-failed-sources.png) |
| rules-error | [1440](1440-rules-error.png) · [390](390-rules-error.png) |
| rules-readonly | [1440](1440-rules-readonly.png) · [390](390-rules-readonly.png) |
| rule-open | [1440](1440-rule-open.png) · [1440 下部](1440-rule-open-lower.png) · [390](390-rule-open.png) · [390 下部](390-rule-open-lower.png) |
| rule-edited | [1440](1440-rule-edited.png) · [1440 下部](1440-rule-edited-lower.png) · [390](390-rule-edited.png) · [390 下部](390-rule-edited-lower.png) |
| rule-busy | [1440](1440-rule-busy.png) · [1440 下部](1440-rule-busy-lower.png) · [390](390-rule-busy.png) · [390 下部](390-rule-busy-lower.png) |
| rule-failed | [1440](1440-rule-failed.png) · [1440 下部](1440-rule-failed-lower.png) · [390](390-rule-failed.png) · [390 下部](390-rule-failed-lower.png) |
| rule-duplicate | [1440](1440-rule-duplicate.png) · [1440 下部](1440-rule-duplicate-lower.png) · [390](390-rule-duplicate.png) · [390 下部](390-rule-duplicate-lower.png) |
| rule-saved | [1440](1440-rule-saved.png) · [390](390-rule-saved.png) |
| anomaly-open | [1440](1440-anomaly-open.png) · [390](390-anomaly-open.png) |
| anomaly-edited | [1440](1440-anomaly-edited.png) · [390](390-anomaly-edited.png) |
| anomaly-busy | [1440](1440-anomaly-busy.png) · [390](390-anomaly-busy.png) |
| anomaly-failed | [1440](1440-anomaly-failed.png) · [390](390-anomaly-failed.png) |
| anomaly-existing | [1440](1440-anomaly-existing.png) · [390](390-anomaly-existing.png) |
| anomaly-created | [1440](1440-anomaly-created.png) · [390](390-anomaly-created.png) |
| irrelevant-open | [1440](1440-irrelevant-open.png) · [390](390-irrelevant-open.png) |
| irrelevant-busy | [1440](1440-irrelevant-busy.png) · [390](390-irrelevant-busy.png) |
| irrelevant-failed | [1440](1440-irrelevant-failed.png) · [390](390-irrelevant-failed.png) |
| irrelevant-saved | [1440](1440-irrelevant-saved.png) · [390](390-irrelevant-saved.png) |
| restore-open | [1440](1440-restore-open.png) · [390](390-restore-open.png) |
| restore-failed | [1440](1440-restore-failed.png) · [390](390-restore-failed.png) |
| restore-saved | [1440](1440-restore-saved.png) · [390](390-restore-saved.png) |
| governance | [1440](1440-governance.png) · [390](390-governance.png) |
| governance-empty | [1440](1440-governance-empty.png) · [390](390-governance-empty.png) |
| governance-error | [1440](1440-governance-error.png) · [390](390-governance-error.png) |
| merge-edited | [1440](1440-merge-edited.png) · [390](390-merge-edited.png) |
| split-edited | [1440](1440-split-edited.png) · [390](390-split-edited.png) |
| proposal-busy | [1440](1440-proposal-busy.png) · [390](390-proposal-busy.png) |
| proposal-failed | [1440](1440-proposal-failed.png) · [390](390-proposal-failed.png) |
| proposal-queued | [1440](1440-proposal-queued.png) · [390](390-proposal-queued.png) |
| confirm-open | [1440](1440-confirm-open.png) · [390](390-confirm-open.png) |
| confirm-failed | [1440](1440-confirm-failed.png) · [390](390-confirm-failed.png) |
| confirmed | [1440](1440-confirmed.png) · [390](390-confirmed.png) |
| reject-open | [1440](1440-reject-open.png) · [390](390-reject-open.png) |
| reject-failed | [1440](1440-reject-failed.png) · [390](390-reject-failed.png) |
| rejected | [1440](1440-rejected.png) · [390](390-rejected.png) |
| self-decision-failed | [1440](1440-self-decision-failed.png) · [390](390-self-decision-failed.png) |

## 验证与使用

运行 `node scripts/verify-ui-phase2-trend-c.mjs` 只读核对源/数据/图哈希，检查68双端状态、请求形状、无权限控件、来源刷新例外、筛选URL、四弹窗焦点、失败保留、治理提议/决定及字体/热区/溢出。加 `--capture` 才刷新本目录正式截图与evidence。既有依赖复用，浏览器finally关闭，不启动服务；HTTP/storage/真实剪贴板写入均为0。

未覆盖三主题/两密度、200%缩放/读屏、共享导航遮挡、真实历史/KeepAlive/跨scope归属、重复写入/迟到响应、全输入服务端校验、真实原文/数据库/审计/采集/治理执行。没有改Vue、API/OpenAPI、配置、依赖、数据库、旧图、coverage或审批，不需重启。P14首轮稿待审；全73页真实实现、完整验证、部署和用户签收仍未完成。
