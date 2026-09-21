# P54 近期记录 · DATA-RECORDS-C-r1

状态：C 风格首轮具体稿已进入真实 Vue，双端默认态与导出未知态待审核。**这是 P54 的近期业务记录段，不是 P54 整页完成**；证据/问题/对账/下载/解决/批处理仍是下一交付段，不能用本实现抵扣。当前方向选择不等于本页具体稿批准，尚未部署。

[交互审核稿](index.html) · [验证证据](evidence.json) · [真实 Vue 实现说明](../../P54-RECORDS-INTERACTION-IMPLEMENTATION.md) · [真实 Vue 审核图（桌面默认）](vue-implementation/P54-1440-records-default.png)

## 布局与事实层级

蓝色侧目录固定四类数据的定位，白色工作面承接范围、筛选、返回集摘要与七列表格；手机是顶部类型切换、筛选抽屉与摘要卡→只读详情。不是把四类数据拆成四套重复页面。导出从记录区域进入独立原因窗，不混入证据下载或质量问题处置。

采用frontend-design技能建立上述任务关系。C 基础色蓝#254a9c、白#ffffff、底色#edf1f6、正文#202c3d、次文#58677b、风险#8c3c32；中文系统字体与左对齐。控件字16px起，说明13px起，热区44px起；标准/紧凑密度、七列显隐至少一列和冻结首个可见列保留。不新增字体或依赖。

人工看图复核覆盖桌面供应商、手机首页/筛选/导出原因：将桌面记录标题与按钮上下排列，避免挤压；修正分页/复制控件继承14px字号，统一16px。快照摘要只表达本次返回集，不使用“大盘总量”视觉。具体审美仍待用户审核，工具尺寸通过不替代图稿批准。

## 操作与图稿对应

| 原动作      | 本稿对应 / 限制                                                                             |
| ----------- | ------------------------------------------------------------------------------------------- |
| DG54-VIEW   | 近期记录与证据质量真实路由意图；质量入口只展示“下一段待交”审核说明，不伪造质量业务页        |
| DG54-ENTITY | 四类切换清状态、回第一页、保留搜索；旧快照仍按旧类型解释                                    |
| DG54-FILTER | 查询120字符、各类型13种状态、提交/Enter/重置；手机抽屉取消保留草稿，提交关闭                |
| DG54-LOAD   | 首次错误/空结果重载；15秒模拟超时与保留记录提示；新旧范围不混用                             |
| DG54-PAGE   | 返回最近100条内本地20条分页；翻页不新发GET                                                  |
| DG54-DETAIL | 手机记录窗保留所有字段/技术ID；桌面新增同一只读详情入口为待审提案                           |
| DG54-EXPORT | 原因/取消/关闭/提交，空/不足/2/300/301边界、处理中/明确失败/未知/模拟完成；无勾选或确认短语 |
| 共享消费者  | 七列显隐、冻结、密度、技术展开、模拟复制成功或拒绝；筛选/记录/原因三类模态焦点闭环          |

没有编辑、删除、原模块详情链接、导入、增添组织筛选或“删除证据”动作。供应商一栏写明“供应商/地点”，来自现有category/market投影；竞品写“来源站点/市场”，不改数据字段。

## 数据、导出与证据边界

AST提取UI2-DG54的原始单热点/单供应商夹具，两者无category/market时显示破折号；不填造缺失值。四类型/13状态补充数据由真实仓储readManagement方法在惰性SQL行适配器上投影。0/1/20/21/100分页为合成边界，不声称原E2E包含全套分页。

真实SQL先搜索后LIMIT100，摘要归纳返回集，不是全历史数量。热点/机会/竞品搜索名称、组织与工作区；供应商搜索产品标题、供应商名称和组织，不搜工作区。真实LIKE有通配语义；原型只提供有限本地匹配示例，不等同MySQL排序、字符集、比较或真实查询验证。真实仓储null/undefined数字转0的行为保留并标注，不能把它解释为新测量事实；不在本轮改变持久化/返回合同。

导出POST `/platform/management/data/exports` 请求体仍是entity/query/status/reason，使用已提交条件而非草稿，不传当前分页；服务器重新查询，UTF-8 BOM十列CSV，csvCell按现有首字符规则处理公式起始值并转义引号。此路由校验会话、platform:operate、Origin，但没有服务端幂等结果检查，不能说重复导出只写一次审计。原型只记录请求与文件名意图，不创建CSV、不写审计、不操作系统剪贴板。

## 真实已复现与待审保护

原源函数惰性执行确认：snapshotScope保留旧类型和范围且禁用导出；列表单飞/15秒、初始URL校验和页码纠正。也复现了原因await期间变更entity导致请求范围漂移，响应等待期间再次变更entity导致文件名漂移；忽略abort的晚到读仍更新数据引用。源脚本/服务/仓储执行不是Vue挂载、真实HTTP/SQL/文件下载。

指纹沿革：25源合同中24份未变；m06-02 E2E已在既有`ff46bfe9c620a422d95cab9689489b07fb6b95ea`增加数据/日志导出原因焦点测试，历史合同未同步该文件hash。本验证器同时读取该提交前后Git对象核对旧/新指纹，再校验当前文件，保留历史表不静默替换；这不是本轮修改生产源码或测试。

真实 Vue 已固定原因窗打开时的已提交范围与文件命名，锁定进行中的范围变化，并用代次拒绝旧结果；未知导出结果不自动重发，需成功重读当前范围后解除。共享原因框增加可选最大长度，只有 P54 传入300，其他消费者行为不变。TechnicalDetails复制反馈不在本批调整。

## 使用与验收

仓库根运行 `node scripts/verify-ui-phase2-data-records-c.mjs` 复验；加 `--capture` 重新生成正式图。复用已有Playwright与Prettier，无服务/依赖安装。图、数据和验证器是永久交付物，不是临时文件。

覆盖原函数、source/PNG指纹、双视口交互与六断点、CSS zoom2、焦点、热区及零网络/零存储。CSS zoom2不是浏览器原生200%缩放。真实 Vue 已验证同路由历史、KeepAlive读取中止/恢复、质量工作态保留与导出未知结果锁；SQL字符比较/权限/Origin/审计/CSV下载、暗色和高对比全主题、屏幕阅读器仍待验。

本批修改生产前端组件与E2E；无API/环境变量/配置/依赖/数据库改动，无部署或重启。后续继续同一P54证据质量段；全73页重设计、审核、实现与宝塔部署签收保持未完成。

## 双端图册

<!-- GALLERY:START -->

正式PNG：115张；57场景。

| 场景                                         | 桌面1440                                 | 手机390                                                          |
| -------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| 原始热点记录 (default)                       | [主图](1440-default.png)                 | [主图](390-default.png)                                          |
| 原始供应商记录 (original-supplier)           | [主图](1440-original-supplier.png)       | [主图](390-original-supplier.png)                                |
| 补充热点状态 (trends)                        | [主图](1440-trends.png)                  | [主图](390-trends.png)                                           |
| 补充机会状态 (opportunities)                 | [主图](1440-opportunities.png)           | [主图](390-opportunities.png)                                    |
| 补充竞品状态 (competitors)                   | [主图](1440-competitors.png)             | [主图](390-competitors.png)                                      |
| 补充供应商状态 (suppliers)                   | [主图](1440-suppliers.png)               | [主图](390-suppliers.png)                                        |
| 查询无记录 (empty)                           | [主图](1440-empty.png)                   | [主图](390-empty.png)                                            |
| 首次读取中 (loading)                         | [主图](1440-loading.png)                 | [主图](390-loading.png)                                          |
| 登录已过期 (expired)                         | [主图](1440-expired.png)                 | [主图](390-expired.png)                                          |
| 无权限 (forbidden)                           | [主图](1440-forbidden.png)               | [主图](390-forbidden.png)                                        |
| 依赖受阻 (blocked)                           | [主图](1440-blocked.png)                 | [主图](390-blocked.png)                                          |
| 首次读取失败 (error)                         | [主图](1440-error.png)                   | [主图](390-error.png)                                            |
| 保留快照刷新中 (refreshing)                  | [主图](1440-refreshing.png)              | [主图](390-refreshing.png)                                       |
| 刷新失败保留范围 (refresh-error)             | [主图](1440-refresh-error.png)           | [主图](390-refresh-error.png)                                    |
| 读取超时 (refresh-timeout)                   | [主图](1440-refresh-timeout.png)         | [主图](390-refresh-timeout.png)                                  |
| 类型切换等待 (scope-pending)                 | [主图](1440-scope-pending.png)           | [主图](390-scope-pending.png)                                    |
| 类型切换失败 (scope-error)                   | [主图](1440-scope-error.png)             | [主图](390-scope-error.png)                                      |
| 尚未提交草稿 (query-draft)                   | [主图](1440-query-draft.png)             | [主图](390-query-draft.png)                                      |
| 120字符查询 (query-max)                      | [主图](1440-query-max.png)               | [主图](390-query-max.png)                                        |
| 查询成功 (filtered)                          | [主图](1440-filtered.png)                | [主图](390-filtered.png)                                         |
| 21条第一页 (page-21)                         | [主图](1440-page-21.png)                 | [主图](390-page-21.png)                                          |
| 21条第二页 (page-two)                        | [主图](1440-page-two.png)                | [主图](390-page-two.png)                                         |
| 最近100条上限 (limit-100)                    | [主图](1440-limit-100.png)               | [主图](390-limit-100.png)                                        |
| 第二页导出完整筛选范围 (export-page-two)     | [主图](1440-export-page-two.png)         | [主图](390-export-page-two.png)                                  |
| 筛选抽屉 (filter)                            | [主图](1440-filter.png)                  | [主图](390-filter.png)                                           |
| 只读记录详情 (detail)                        | [主图](1440-detail.png)                  | [主图](390-detail.png)                                           |
| 长记录详情 (long-detail)                     | [主图](1440-long-detail.png)             | [主图](390-long-detail.png) · [局部1](390-long-detail-part1.png) |
| 导出原因 (export)                            | [主图](1440-export.png)                  | [主图](390-export.png)                                           |
| 空原因 (export-empty)                        | [主图](1440-export-empty.png)            | [主图](390-export-empty.png)                                     |
| 原因不足 (export-short)                      | [主图](1440-export-short.png)            | [主图](390-export-short.png)                                     |
| 300字原因 (export-max)                       | [主图](1440-export-max.png)              | [主图](390-export-max.png)                                       |
| 超过300字原因 (export-over)                  | [主图](1440-export-over.png)             | [主图](390-export-over.png)                                      |
| 导出处理中 (export-running)                  | [主图](1440-export-running.png)          | [主图](390-export-running.png)                                   |
| 导出模拟成功 (export-success)                | [主图](1440-export-success.png)          | [主图](390-export-success.png)                                   |
| 导出明确失败 (export-error)                  | [主图](1440-export-error.png)            | [主图](390-export-error.png)                                     |
| 导出结果未知 (export-unknown)                | [主图](1440-export-unknown.png)          | [主图](390-export-unknown.png)                                   |
| 列显隐 (columns)                             | [主图](1440-columns.png)                 | [主图](390-columns.png)                                          |
| 紧凑密度 (compact)                           | [主图](1440-compact.png)                 | [主图](390-compact.png)                                          |
| 请求编号 (technical)                         | [主图](1440-technical.png)               | [主图](390-technical.png)                                        |
| 模拟复制被拒绝 (copy-failed)                 | [主图](1440-copy-failed.png)             | [主图](390-copy-failed.png)                                      |
| 证据质量下一段（审核说明） (quality-handoff) | [主图](1440-quality-handoff.png)         | [主图](390-quality-handoff.png)                                  |
| 悬停 (hover)                                 | [主图](1440-hover.png)                   | [主图](390-hover.png)                                            |
| 按下 (pressed)                               | [主图](1440-pressed.png)                 | [主图](390-pressed.png)                                          |
| 键盘焦点 (focus)                             | [主图](1440-focus.png)                   | [主图](390-focus.png)                                            |
| 热点 / 展示中 (trends-active)                | [主图](1440-trends-active.png)           | [主图](390-trends-active.png)                                    |
| 热点 / 无关 (trends-irrelevant)              | [主图](1440-trends-irrelevant.png)       | [主图](390-trends-irrelevant.png)                                |
| 热点 / 已过期 (trends-stale)                 | [主图](1440-trends-stale.png)            | [主图](390-trends-stale.png)                                     |
| 热点 / 已归档 (trends-archived)              | [主图](1440-trends-archived.png)         | [主图](390-trends-archived.png)                                  |
| 机会 / 待决策 (opportunities-pending)        | [主图](1440-opportunities-pending.png)   | [主图](390-opportunities-pending.png)                            |
| 机会 / 已采纳 (opportunities-adopted)        | [主图](1440-opportunities-adopted.png)   | [主图](390-opportunities-adopted.png)                            |
| 机会 / 观察中 (opportunities-observing)      | [主图](1440-opportunities-observing.png) | [主图](390-opportunities-observing.png)                          |
| 机会 / 已拒绝 (opportunities-rejected)       | [主图](1440-opportunities-rejected.png)  | [主图](390-opportunities-rejected.png)                           |
| 竞品 / 监控中 (competitors-active)           | [主图](1440-competitors-active.png)      | [主图](390-competitors-active.png)                               |
| 竞品 / 已暂停 (competitors-paused)           | [主图](1440-competitors-paused.png)      | [主图](390-competitors-paused.png)                               |
| 供应商 / 信息不完整 (suppliers-incomplete)   | [主图](1440-suppliers-incomplete.png)    | [主图](390-suppliers-incomplete.png)                             |
| 供应商 / 可评估 (suppliers-ready)            | [主图](1440-suppliers-ready.png)         | [主图](390-suppliers-ready.png)                                  |
| 供应商 / 已隔离 (suppliers-quarantined)      | [主图](1440-suppliers-quarantined.png)   | [主图](390-suppliers-quarantined.png)                            |

<!-- GALLERY:END -->
