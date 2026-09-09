# P10 外观与 P12 首页：实施前逐项审核

基线 `8f0d5554`。C方向已选，具体页面未批准。本轮把真实源码与既有150张图对应起来，不增加重复图片、不替换生产界面。

## 审核入口

| 页面 | 全部已有图 | 源码逐项清单 | 本次范围 |
| --- | --- | --- | --- |
| P10 外观设置 | [86图](design/appearance-direction-c/README.md) | [P10.json](action-reviews/P10.json) | 11源位置/11组，3主题与2密度是受控按钮，无v-model；2个aside不是弹窗 |
| P12 首页 | [64图](design/home-direction-c/README.md) | [P12.json](action-reviews/P12.json) | 20源位置/14组，7字段、1内联form、2个原生details，无本地弹窗 |

清单逐组列出真实条件、处理函数、源候选、动态变体、双端场景和未完成事项。P10的66个视觉槽与P12的84个槽仍未逐action selector映射；这不表示缺150张图，也不表示既有控件样例已覆盖所有实例六态。

## P10：必须分开的三种事实

| 事实 | 实际来源 | 不能误称 |
| --- | --- | --- |
| 当前主题预览 | selected及applyTheme；生产会更新DOM并写本地主题缓存 | 服务器已保存 |
| 服务器主题记录 | GET/PUT返回的saved.theme/version；PUT只传theme/expected_version | 密度也随之保存，或预览一定与返回值同步 |
| 当前会话密度 | preferredDensity和DOM；行政壳层可强制compact | 新的持久化偏好或主题脏状态 |

撤销只恢复主题，不撤销密度。源choose/chooseDensity在saving时早退，但radio本身没有disabled；restore仅按dirty禁用且能在保存中执行。隔离源码复验再次得到selected=deep-ocean、saved=aurora-purple、state=saved、dirty=true，实际源码未修。C稿的统一忙碌锁、按键导航和分开显示保存/预览结果是待审改进。

源blocked合并了网络、限流和部分冲突，统一提示未选择范围；新稿只在明确范围错误显示选择工作区。GET校验theme，PUT返回直接赋saved；保存失败保留预览，不沿用共享主题浮层的回滚语义。版本、幂等、真实存储、三壳层整合和全部主题/密度仍需实际实现验收。

## P12：不能按文案合并的入口

| 入口 | 精确目标或操作 |
| --- | --- |
| 顶部推荐清单／队列全部数量 | `/opportunities`，无view |
| 待采纳计数 | `/opportunities?view=recommended` |
| 候选提示／候选计数 | `/opportunities?view=rule_candidates` |
| 采集提示／采集计数 | `/opportunities?view=evidence_pending` |
| 推荐与本人待办/异常条目 | 各自服务端item.route原样 |
| 创建选品 | `/opportunities/start`，只导航 |
| 恢复自动选品 | 只PATCH第一条paused规则，使用该规则原版本/周期/门槛 |

空推荐区优先候选、其次采集，提示入口互斥；底部计数链接并不互斥。actions排除opportunity后与health拼接，changes/follows只计入total，未逐项展示。运行详情的candidate_count与rule_candidate_count不是同一字段，流程标记也不是每个商品已通过质量门的证明。

七字段表单保留原关键词拆分（不去重）、十市场语言映射、空分类null、in_app渠道和数字周期/来源门槛。不新增字段、批量恢复或自动采纳。

源码复验区分两种失败：明确not_configured且规则GET失败时，rules=[]并自动展开首次设置；缺automatic_selection时，显示回退未配置/零，但**load不会因此自动展开表单**。C稿的独立失败/未知显示、忙碌锁和恢复链接仍未迁入Vue。

另已核对父级：`/home`为reset_on_scope，NavigationShell的缓存key包含组织/工作区，最多保留12个实例，并通过surfaceProps传capabilities。因此不能仅凭HomeDashboard没有scope watcher就宣称没有范围隔离。回到旧缓存key是否刷新、旧请求完成归属、完整壳层下手机首条推荐是否可达仍需运行验收。

## 已验证与下一步

使用requirement-to-implementation按真实入口拆解本批范围，UI技能路由确认这轮是语义与证据核对，不额外改变视觉设计。实际核对ThemeStudio、theme.ts、HomeDashboard、HomeAutomationOverview及父级传参/缓存key；源/依赖指纹在两份JSON绑定。

- P10既有源码检查9组通过，包括预览缓存替身、密度不PUT、精确版本body、错误映射和未修保存/撤销竞态。
- P12复用buildHomeDesignData，实际函数隔离检查10市场POST、5周期/3来源选项、无权限/无关键词零调用、首条恢复及两类读取缺口；没有HTTP、SQL或真实采集。
- `node scripts/audit-ui-phase2-action-coverage.mjs`检查当前源身份、合同、输入、容器、图场景及各视口引用；`node scripts/audit-ui-phase2-design-delivery.mjs`检查既有产物指纹。完整本轮运行结果见PROGRESS，不把引用当实际Vue验收。

下一批继续P13及后续业务列表/共享消费者。全局14页已有局部语义清单，59页仍待同级核对；全部控件/主题/生命周期、具体用户批准和真实Vue/部署签收未完成。

本轮不改生产源码、API/OpenAPI、主题兼容ID、配置/.env、数据库/迁移、权限或依赖，不部署、无需重启。没有创建临时文件或服务；两清单与本说明是永久交付，旧图不删。请按页号、场景写“通过”或具体修改意见。
