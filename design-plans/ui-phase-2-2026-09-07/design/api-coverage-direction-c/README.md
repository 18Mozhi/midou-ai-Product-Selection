# P63 接口覆盖证据 · API-COVERAGE-C-r1

状态：C方向具体稿的视觉已按用户 2026-09-24 全局授权通过。目录来自当前本地源码，报告和长字段均为合成或原E2E夹具；没有读取生产报告或执行接口探测。

## 设计与完整范围

依据frontend-design技能，建立蓝色报告身份与本页阅读导航、白色全目录口径/接口证据/角色和静态声明。不是新增主导航入口，P63仍为超级管理员二级工具。六项规模与覆盖指标分开，报告current只写“可关联”；记录计数包括拒绝与受阻，五维通过数另列。

接口明细重构为可滚动完整目录和同一操作的字段阅读区。手机先选操作，再在页内读证据；没有新增业务详情弹窗。七类信息保留，额外读取响应已有HTTP、能力、请求/追踪编号与分开的记录/预期角色。五维采用原生展开，测试ID/latest_result不再只依赖title悬停。全部返回记录可滚动选择，不增加本地分页、更多或下载按钮；300上限场景明确总匹配与本次返回的区别。

蓝#102A63、操作蓝#1748B5、白#FFFFFF、灰#F3F6FA、墨#17253C、警示棕#9A5800；微软雅黑/苹方16px正文、13px辅助、44px热区、左对齐。只读查询、页面分区与证据展开采用即时反馈，无健康动画或绿色成功总分。

| 实际范围 | 对应稿件 | 边界 |
| --- | --- | --- |
| 刷新、失败重试 | 首次加载/拒绝/限流/依赖、在途与失败 | 不运行生产探测 |
| query/status、筛选/重置 | 桌面表单、手机筛选窗、草稿与快照 | 120/40服务边界；UI仅五种结果选项 |
| 七类接口信息 | 完整目录选择、页内阅读、长字段 | 没有业务模态、写入或下载 |
| 五证据维度 | 正常、鉴权、参数、幂等、故障展开 | not_applicable与not_run不混合 |
| 报告和分组 | current/missing/invalid/outdated、结果、维度、角色及来源声明 | 全目录统计不随查询变化 |

## 真实来源与限制

源构建器解析当前YAML为225路径/258操作，不使用旧单测或总纲基线的223/256。原E2E的256总量、255分组、单操作、单角色夹具原样单独说明，不能证明完整目录。正常稿将六条合成角色记录关联到真实目录，其中一条outcome=not_run，所以全局有探测结果为5、角色关联数合计为6；绝不混用分母。

六组源隔离检查执行实际目录解析/报告关联/过滤/聚合、内存readFile、父api/load和服务management方法：头部schema/ID策略/数量/指纹一致、单项ID与适用性回退、build SHA与同method/path权限/metadata变化不改变关联判断、九类查询与六结果、301返回300、操作ID冲突、读取缺失/无效、重复GET/旧响应覆盖/跨domain迟到、403丢失分类及120/40边界。角色预期与metadata最长前缀仅为声明；未运行真实Vue、SQL、RBAC、生产报告或原历史固定256测试套件。

原型快照归属、迟到响应保护、明确零匹配、手机焦点和证据展开是待审提案，未修复生产页面。原父通用读取没有15秒中止，不能沿用其他页面时限；当前原型也不宣称新增运行参数。筛选不写入P63 URL。代表深色/高对比/紧凑与CSS200%检查不等同完整主题密度、原生浏览器缩放、KeepAlive/前进后退或辅助技术通过。

## 使用、验证与后续

双端45场景90PNG、91图册链接及来源指纹无参复验通过；九查询、五UI结果、五维展开、目录末项、301/300缩小筛选、草稿/旧快照/迟到ID、首读错误、键盘焦点与六断点/CSS200%通过。人工看图修正空结果标签高度和深色文字/背景继承，加入回归断言。15个相关历史来源绑定中14个不变，1个E2E既有焦点变更由ff46bfe9前后对象精确追溯，未覆盖旧合同表。HTTP、浏览器错误与持久存储均0；文档/运行文档/静态分析/格式门禁通过。这些结果不代表真实应用的全主题、完整可访问性或生产验收。

[打开离线交互原型](index.html)，底部切换场景；读取在途时提供明确标记的模拟响应工具。全目录列表可滚动，选择后阅读七类信息及展开五维证据。生成命令：`node scripts/verify-ui-phase2-api-coverage-c.mjs --capture`；去掉参数复验来源和图片指纹。正式图展示每种状态与控件，不是258个真实操作逐项通过的证据。

本包无生产Vue/API/OpenAPI/env/schema/依赖/权限修改，无部署或重启；Worker/Python无关不改。具体稿审核、真实报告与目录/构建关联、六角色/五维实际验收及全73页实施部署签收待办。下一W08 P62链路日志；P61已有代表稿，不重复计数。正式原型/图片/证据和永久验证脚本为交付物，测试浏览器finally关闭，不启动临时服务。

<!-- GALLERY:START -->
正式PNG：90张；45场景。

| 场景 | 桌面1440 | 手机390 |
| --- | --- | --- |
| 当前目录与部分合成证据 (default) | [主图](1440-default.png) | [主图](390-default.png) |
| 接口选择与完整证据 (operations) | [主图](1440-operations.png) | [主图](390-operations.png) |
| 六角色与三类声明 (sources) | [主图](1440-sources.png) | [主图](390-sources.png) |
| 报告缺失 (missing) | [主图](1440-missing.png) | [主图](390-missing.png) |
| 报告JSON无效 (invalid) | [主图](1440-invalid.png) | [主图](390-invalid.png) |
| 报告与目录不匹配 (outdated) | [主图](1440-outdated.png) | [主图](390-outdated.png) |
| 历史E2E夹具原样说明 (original) | [主图](1440-original.png) | [主图](390-original.png) |
| 报告可关联不代表构建SHA一致 (different-build) | [主图](1440-different-build.png) | [主图](390-different-build.png) |
| 单操作ID不符，回退未执行 (wrong-operation-id) | [主图](1440-wrong-operation-id.png) | [主图](390-wrong-operation-id.png) |
| 维度适用性不符，回退未执行 (wrong-applicability) | [主图](1440-wrong-applicability.png) | [主图](390-wrong-applicability.png) |
| 首次加载 (loading) | [主图](1440-loading.png) | [主图](390-loading.png) |
| 首次403权限拒绝 (forbidden) | [主图](1440-forbidden.png) | [主图](390-forbidden.png) |
| 首次401会话过期 (expired) | [主图](1440-expired.png) | [主图](390-expired.png) |
| 首次429限流 (rate_limited) | [主图](1440-rate_limited.png) | [主图](390-rate_limited.png) |
| 首次依赖受阻 (blocked) | [主图](1440-blocked.png) | [主图](390-blocked.png) |
| 首次读取失败 (error) | [主图](1440-error.png) | [主图](390-error.png) |
| 筛选抽屉 (filter-open) | [主图](1440-filter-open.png) | [主图](390-filter-open.png) |
| 输入草稿未应用 (filter-draft) | [主图](1440-filter-draft.png) | [主图](390-filter-draft.png) |
| 筛选在途保留旧快照 (filter-pending) | [主图](1440-filter-pending.png) | [主图](390-filter-pending.png) |
| 读取失败不误改报告归属 (filter-error) | [主图](1440-filter-error.png) | [主图](390-filter-error.png) |
| 零匹配但保留全目录统计 (no-match) | [主图](1440-no-match.png) | [主图](390-no-match.png) |
| 测试编号不属于搜索范围 (search-test-id) | [主图](1440-search-test-id.png) | [主图](390-search-test-id.png) |
| 最近结果不属于搜索范围 (search-latest-result) | [主图](1440-search-latest-result.png) | [主图](390-search-latest-result.png) |
| 120字符关键词边界 (query-max) | [主图](1440-query-max.png) | [主图](390-query-max.png) |
| 目录最后一条可达 (catalog-last) | [主图](1440-catalog-last.png) | [主图](390-catalog-last.png) |
| 301合成操作仅返回300条 (limit-300) | [主图](1440-limit-300.png) | [主图](390-limit-300.png) |
| 长路径、操作ID和证据文本 (long) | [主图](1440-long.png) | [主图](390-long.png) |
| 深色代表场景 (dark) | [主图](1440-dark.png) | [主图](390-dark.png) |
| 高对比代表场景 (contrast) | [主图](1440-contrast.png) | [主图](390-contrast.png) |
| 紧凑目录代表场景 (compact) | [主图](1440-compact.png) | [主图](390-compact.png) |
| 刷新悬停 (hover) | [主图](1440-hover.png) | [主图](390-hover.png) |
| 刷新按下 (pressed) | [主图](1440-pressed.png) | [主图](390-pressed.png) |
| 键盘焦点 (focus) | [主图](1440-focus.png) | [主图](390-focus.png) |
| 结果筛选：成功 (result-success) | [主图](1440-result-success.png) | [主图](390-result-success.png) |
| 结果筛选：空结果 (result-empty) | [主图](1440-result-empty.png) | [主图](390-result-empty.png) |
| 结果筛选：受阻 (result-blocked) | [主图](1440-result-blocked.png) | [主图](390-result-blocked.png) |
| 结果筛选：越权拒绝 (result-unauthorized) | [主图](1440-result-unauthorized.png) | [主图](390-result-unauthorized.png) |
| 结果筛选：未执行 (result-not_run) | [主图](1440-result-not_run.png) | [主图](390-result-not_run.png) |
| 展开正常请求 (evidence-normal) | [主图](1440-evidence-normal.png) | [主图](390-evidence-normal.png) |
| 展开鉴权拒绝 (evidence-authorization) | [主图](1440-evidence-authorization.png) | [主图](390-evidence-authorization.png) |
| 展开参数校验 (evidence-parameters) | [主图](1440-evidence-parameters.png) | [主图](390-evidence-parameters.png) |
| 展开幂等/并发 (evidence-idempotency) | [主图](1440-evidence-idempotency.png) | [主图](390-evidence-idempotency.png) |
| 展开故障注入 (evidence-fault) | [主图](1440-evidence-fault.png) | [主图](390-evidence-fault.png) |
| 公开接口不适用维度 (not-applicable) | [主图](1440-not-applicable.png) | [主图](390-not-applicable.png) |
| 未登录受阻记录（无独立筛选选项） (unauthenticated-record) | [主图](1440-unauthenticated-record.png) | [主图](390-unauthenticated-record.png) |
<!-- GALLERY:END -->
