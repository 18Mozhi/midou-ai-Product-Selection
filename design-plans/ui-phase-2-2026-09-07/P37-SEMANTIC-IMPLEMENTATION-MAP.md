# P37 组织审计 · 源码与设计对应

状态：源码级登记，不是实际Vue重构完成或权限/生产验收。全部P37具体视觉仍待审，不替基础筛选与手机详情问题作答。

[逐项机器清单](action-reviews/P37.json) · [全站登记](ACTION-COVERAGE-REVIEW.md) · [172张控件图](../../output/playwright/p37-controls-review/index.html) · [38张字段图](../../output/playwright/p37-fields-review/index.html)

## 实际范围

23个父/子源码入口归为16组：11组本页动作、5组排除、0组事件转发、0写入。父层13个入口中只有刷新和重载属于本页；审批专有恢复、资料、成员、资源授权及四处共享原因来源分别排除。排除表示非本页触发，不保证父共享原因窗在跨页时绝无遗留状态。

| 范围 | 核对结果 |
| --- | --- |
| 应用条件 | form提交和submit按钮归同一动作；trim/ISO/时间拒绝后调用applyFilters |
| 重置 | 清七条件及页内搜索，再读第一页；不能当成纯本地清空 |
| 高级条件/技术详情 | 原生details，开/合不新增业务动作或弹窗 |
| 系统记录/记录选择 | 分别切systemEventsExpanded与selectedId；连接事件默认隐藏但不删除 |
| 加载更多 | nextCursor且原始loadedQuery为空；纯空格也会隐藏按钮 |
| 两字段复制 | request_id与trace_id分别关联；真实源码没有缺失ID禁用或迟到反馈归属保护 |
| 八本地字段 | loadedQuery及form的七条件；另六个父资料字段明确排除 |
| 六结构/九上下文 | 父资料form和共享原因窗；子数据说明aside、筛选form、已选/空详情aside。不是六个业务弹窗 |

父模板当前是最后一个`v-else`挂载OrganizationAuditPanel，不是`v-else-if="view === 'audit'"`。七个绑定属性精确登记，零组件事件：

- applyFilters → applyAuditFilters → loadAuditPage(next)，替换首批。
- loadMore → loadMoreAudit → loadAuditPage(auditFilters.value,true)，追加现有游标。
- 父readView("audit")只调auditPath，不请求组织治理摘要；GET路径仍为当前组织的audit-events。

19个控件变体中的15个源相关变体覆盖所有本页候选；另4变体属于3种便捷提案：清空页内搜索、手机筛选开/合、返回时间线。两个复制控件的disabled状态单列为提案。210张独立字段/控件/组合图全部可追溯，未强行填入统一六态槽，66个通用槽仍待适用性判定/映射。原104图及两份外部图包不重写。

## 验证与边界

新增六项测试覆盖：23入口的精确覆盖/遗漏拒绝、14字段和6结构顺序、两个函数参数及v-else真实条件、其他页原因排除、全部210图与提案隔离、空格搜索/复制已知差异。正负测试会拒绝改变loadMore的append参数、错接父handler或把approval改为approved。

收尾验证：全部UI专项540/540通过；生成器和全站动作汇总只读复验一致，73路由/153文档、运行说明及格式门通过。统一102图包/15069PNG来源和图片零漂移，不把该图包数量与本页210独立图重复相加。此次不重跑已知未变化的P35失败色值门，不声称全项目测试绿色。

首次全站汇总发现新清单缺少旧汇总器要求的顶层inputs索引；只补本清单索引并增加断言，没有改汇总规则。全站登记现为38页、767唯一源位置、754组、621路由动作与68转发组；整页批准仍0，不能以登记页数当交付页数。

```powershell
node scripts/build-ui-phase2-org-audit-review.mjs --check
node --test tests/unit/ui-phase2-org-audit-review.test.mjs
node scripts/audit-ui-phase2-action-coverage.mjs
```

`--write`仅用于更新本页登记JSON；图册点击即可审核，不用启动服务。真实Vue、URL反向恢复、OG-G05异步问题、后台失败条件/事实错位、父共享窗跨路由状态和实际授权仍未验收，后续继续按已确认范围实施。

本批不改生产Vue/CSS、API/OpenAPI、env、依赖、数据库或权限；无需重启，未部署。既有P35颜色门失败及修复授权待答，不放宽测试，未提交，commit hash不适用。未创建临时文件、截图或服务；现有图为永久交付，不删除。全73页C方向实施、部署和用户签收目标继续。
