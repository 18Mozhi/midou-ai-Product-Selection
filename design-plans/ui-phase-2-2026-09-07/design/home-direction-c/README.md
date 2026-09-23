# P12 首页 · HOME-C-r1

状态：用户已授权剩余页面视觉自动通过，HOME-C-r1 作为 P12 页面设计基线。此处仍是独立工作面；真实 Vue 实施见 [P12 实施记录](../../P12-PAGE-COMPOSITION-IMPLEMENTATION.md)，本图册本身不代表完整 NavigationShell 或生产验收。

[打开交互稿](index.html) · [源与截图证据](evidence.json) · [P12规格](../../page-specs/P12.md) · [共享导航稿](../shell-direction-c/README.md)

## 交付与设计

32场景×1440/390，共64张永久整页图。frontend-design将首页重新组织为蓝色工作范围提示、白色人工决策清单、本人待办/异常和下置的自动发现进度。运行详情与数据说明保留原生details；首次规则是内联表单，不增加弹窗。移动主动作独占一行，两次动作并列，正常首条推荐在844px视口内；这只证明独立工作面，不代表加入共享顶/底导航后仍满足首屏验收。

本稿蓝色侧区不是全站导航替代物；共享壳层、搜索与主题已有独立提案，仍需整合。样例记录与计数明确合成；样例时间固定2026-09-07，不作为当前生产事实。实际HomeDashboardService在隔离repository上排序和分组，前端只沿返回顺序展示。未运行MySQL过滤或证明真实权限。推荐总数与本人返回条目数不必一致，不能用一条演示记录反推总量。合成候选总量17，待采纳4/质量门候选5/采集中8；检查样例内部数量不矛盾，不以此推断真实跨状态业务恒等式。

## 每个动作的边界

| 动作                 | 保留合同与提案                                                                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 创建选品             | /opportunities/start，仅导航，不在首页创建机会。                                                                                                                             |
| 管理规则/查看规则    | /trends?section=rules；读取规则需trend:read，创建/恢复需trend:manage；链接不等于服务端授权。                                                                                 |
| 查看推荐清单/全部N条 | /opportunities，无view参数。                                                                                                                                                 |
| 四计数               | 待采纳→view=recommended；规则命中→view=rule_candidates；采集中→view=evidence_pending；运行规则→trends的rules分区。                                                           |
| 推荐条目             | 原样item.route；value_score为null不补0分，非整数显示一位小数。                                                                                                               |
| 本人事项             | actions去除opportunity后接health，原顺序/route；不重排跨区优先级，不添加操作按钮。changes/follows目前只进入total，未伪造逐项展示。                                           |
| 空推荐               | 规则候选优先，其次采集中，二者互斥；都为0时不添加假进度入口。                                                                                                                |
| 两处details          | 原生展开/收起与键盘Enter，无读写请求；运行规则、全部候选、质量门候选、已采纳以及两时间保留。                                                                                 |
| 首次设置             | name/include_keywords/negative_keywords/market/category/collection_interval_minutes/recommendation_min_source_count共七输入；市场10项、频率5项、来源3项来自当前Vue。         |
| 创建规则             | POST /trends/monitoring-rules；语言、默认名称、null分类、in_app渠道和数字保持原合同。关键词英文/中文逗号及换行拆分、trim去空，不擅自去重。required与长度500/500/80/120保持。 |
| 收起/再展开          | 不清输入；创建成功关表单但保留输入。写入中锁定表单与重复提交保护已在实际 Vue 实施，空关键词原生必填及输入法/读屏细节仍需专项无障碍验收。                                     |
| 恢复自动选品         | PATCH第一条paused规则，status=enabled、expected_version及原周期/门槛；不是全部恢复。失败保留版本和暂停项。                                                                   |
| 成功后重读           | 区分写入成功和首页读取成功；重读失败保留成功事实，不自动再POST或PATCH。图中的采集状态来自明确模拟的后续GET，而非成功文案推断爬虫已完成。                                     |
| 错误恢复             | 重新读取沿现有首页→规则读取集合；过期补/login、无权限补/select-context真实路由，明确不授予权限。新稿不保留无监听的假次动作，但实际UiStatePanel消费者尚未改。                 |

## 当前源码缺口的可复现实证

永久助手直接执行HomeDashboard的load与selection表达式，使用受限内存请求替身：

- summary明确not_configured、规则GET抛错：当前源码rules=[]、setupOpen=true、state=empty，误当首次无规则。新稿改为“规则读取失败”，不开放创建/恢复，提供原读取集合重试。
- summary缺automatic_selection、规则GET抛错：当前selection回退未配置和所有0。新稿显示自动状态未知，隐藏未知推荐/计数/设置，已知本人事项仍显示。

本段记录图稿生成时的 known-gap-not-fixed 状态；缺失值、规则读取失败、异步读取代次、忙碌重复提交及写后重读失败已在真实 Vue 中修正并做本地 E2E。测试替身不证明真实页面缓存切换、生产身份权限或实际采集安全。

永久助手也执行实际createRule/resumeRule函数，得到十市场POST与首条PATCH作为浏览器请求形状的比较基准；调用的request/load均为内存替身，不验证幂等键、后端事务或采集调度。

## 全部图

| 场景               | 桌面 / 手机                                                                       |
| ------------------ | --------------------------------------------------------------------------------- |
| 运行中             | [1440](1440-running.png) · [390](390-running.png)                                 |
| 需检查             | [1440](1440-attention.png) · [390](390-attention.png)                             |
| 运行详情展开       | [1440](1440-runtime-open.png) · [390](390-runtime-open.png)                       |
| 数据说明展开       | [1440](1440-truth-open.png) · [390](390-truth-open.png)                           |
| 长原因与异常       | [1440](1440-long-items.png) · [390](390-long-items.png)                           |
| 规则候选优先       | [1440](1440-candidates.png) · [390](390-candidates.png)                           |
| 采集中             | [1440](1440-collecting.png) · [390](390-collecting.png)                           |
| 诚实空态           | [1440](1440-quiet.png) · [390](390-quiet.png)                                     |
| 缺少评分           | [1440](1440-no-score.png) · [390](390-no-score.png)                               |
| 自动状态缺失       | [1440](1440-unknown-selection.png) · [390](390-unknown-selection.png)             |
| 规则读取失败       | [1440](1440-rules-failed.png) · [390](390-rules-failed.png)                       |
| 规则读取中         | [1440](1440-rules-loading.png) · [390](390-rules-loading.png)                     |
| 首次设置           | [1440](1440-not-configured.png) · [390](390-not-configured.png)                   |
| 收起设置           | [1440](1440-setup-closed.png) · [390](390-setup-closed.png)                       |
| 七字段编辑         | [1440](1440-setup-edited.png) · [390](390-setup-edited.png)                       |
| 关键词无有效项     | [1440](1440-setup-invalid.png) · [390](390-setup-invalid.png)                     |
| 创建忙碌           | [1440](1440-setup-busy.png) · [390](390-setup-busy.png)                           |
| 创建失败           | [1440](1440-setup-failed.png) · [390](390-setup-failed.png)                       |
| 创建成功           | [1440](1440-setup-saved.png) · [390](390-setup-saved.png)                         |
| 创建成功但重读失败 | [1440](1440-setup-saved-read-failed.png) · [390](390-setup-saved-read-failed.png) |
| 暂停规则           | [1440](1440-paused.png) · [390](390-paused.png)                                   |
| 恢复忙碌           | [1440](1440-resume-busy.png) · [390](390-resume-busy.png)                         |
| 恢复失败           | [1440](1440-resume-failed.png) · [390](390-resume-failed.png)                     |
| 仅首条恢复         | [1440](1440-resumed.png) · [390](390-resumed.png)                                 |
| 只读未配置         | [1440](1440-readonly.png) · [390](390-readonly.png)                               |
| 只读暂停           | [1440](1440-readonly-paused.png) · [390](390-readonly-paused.png)                 |
| 首页加载           | [1440](1440-loading.png) · [390](390-loading.png)                                 |
| 首页失败           | [1440](1440-error.png) · [390](390-error.png)                                     |
| 登录过期           | [1440](1440-expired.png) · [390](390-expired.png)                                 |
| 无权限             | [1440](1440-forbidden.png) · [390](390-forbidden.png)                             |
| 限流               | [1440](1440-rate-limited.png) · [390](390-rate-limited.png)                       |
| 依赖受阻           | [1440](1440-blocked.png) · [390](390-blocked.png)                                 |

## 验证与使用

仓库根目录运行 `node scripts/verify-ui-phase2-home-c.mjs`，只读比较数据/真实源/PNG哈希并运行32双端场景、十市场精确POST、第一暂停规则PATCH、空值/失败/保留、链接与details、字体/44px热区/溢出检查。使用 `--capture` 才刷新本目录永久64图和evidence.json。复用现有Playwright/TypeScript，无新增依赖；浏览器finally关闭，不启动服务，HTTP和storage写入为0。

未覆盖实际Vue、MySQL/RBAC、会话、真实采集、幂等/重复并发、KeepAlive/组织切换、共享导航整合、200%缩放/读屏、三主题两密度与生产。未改API/OpenAPI、数据库、配置、依赖、coverage或审核记录，无需生产重启。P12及全73页的正式审核、真实Vue、完整测试和部署仍待完成。
