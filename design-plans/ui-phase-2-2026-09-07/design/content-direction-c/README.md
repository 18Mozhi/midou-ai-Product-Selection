# P56 内容管理 · CONTENT-C-r1

状态：C 方向静态首稿已冻结；[当前真实Vue证据](vue-implementation/README.md)另行保存并待审核。静态图不是生产部署凭证。

[打开交互图稿](index.html)

## 设计范围

蓝色导航、白色事实工作区；主题和状态为主轴，归属与观测事实分层。覆盖桌面七列、移动摘要/完整事实、四状态筛选、分页、视图设置、三种审核目标、原因校验、忙状态、取消、冲突/错误/结果不明、成功后刷新失败、旧结果归属及主题/长内容边界。图册底部场景选择与模拟响应按钮只用于审核，不进入生产。

数据来自原 E2E fixture，只有一条热点记录，135 是测试夹具计数，不代表实际完整分页。20/21条分页、长内容、缺值与各边界状态均为显式合成数据。无客户数据、网络请求、SQL或审计写入。

## 事实与待审提案

- 现有契约：标题/分类/市场搜索；同查询全部状态计数与状态内列表计数区分；四状态可读，仅展示/无关/过期可写；无正文编辑、归档写入、独立详情请求。
- 原审核允许同状态提交，原因trim后2–300，携带expected_version；不新增口令或勾选确认。
- 本静态稿当时提出：独立筛选草稿与请求快照；空结果保留查询统计；单次提交与实例归属；错误进弹窗；写入/刷新双结果；未知结果禁止自动重试。上述项目现已进入真实Vue，实施与验证边界以[P56实现说明](../../P56-CONTENT-INTERACTION-IMPLEMENTATION.md)为准；本目录仍固定旧源码回放。
- 错误展示沿用文本提示，不将原api包装器已丢弃的结构化错误类型虚构成现有能力。冲突等场景用于拟议交互说明，真实分类仍须实现时核实。
- 技术校验运行真实TS函数的无网络适配器；仓储验证使用惰性连接替身，不是MySQL或审计验收。原内容源码存在重复提交、迟到响应关闭新弹窗、成功覆盖刷新失败等已复现风险，未在本批修复。

## 验证与实施边界

生成：`node scripts/verify-ui-phase2-content-c.mjs --capture`；复核：`node scripts/verify-ui-phase2-content-c.mjs`。检查源码/历史重绑定、PNG哈希、双端交互、弹窗连续滚动、焦点、尺寸、断点、CSS 200%缩放与零HTTP。

后续仍需实际Vue、六角色、真实会话/同源/幂等键、MySQL5.7事务与审计、缓存返回、移动软键盘及生产部署验证。无需重启，当前未部署。历史合同哈希表保留；P56相关16项绑定单独校验，E2E焦点测试变更精确重绑定，未宣称整份P56/P57/P63联合合同全部未变。

## 正式图册

<!-- GALLERY:START -->
正式PNG：120张；57场景。

| 场景 | 桌面1440 | 手机390 |
| --- | --- | --- |
| 默认工作台 · 原 E2E 样例 (default) | [主图](1440-default.png) | [主图](390-default.png) |
| 首次读取中 (loading) | [主图](1440-loading.png) | [主图](390-loading.png) |
| 空结果 · 拟保留查询统计 (empty) | [主图](1440-empty.png) | [主图](390-empty.png) |
| 首次读取失败 (first-error) | [主图](1440-first-error.png) | [主图](390-first-error.png) |
| 保留快照刷新中 (refreshing) | [主图](1440-refreshing.png) | [主图](390-refreshing.png) |
| 刷新失败保留旧数据 (retained-error) | [主图](1440-retained-error.png) | [主图](390-retained-error.png) |
| 首次读取超时 (first-timeout) | [主图](1440-first-timeout.png) | [主图](390-first-timeout.png) |
| 已有快照读取超时 (retained-timeout) | [主图](1440-retained-timeout.png) | [主图](390-retained-timeout.png) |
| 筛选草稿 (filter-draft) | [主图](1440-filter-draft.png) | [主图](390-filter-draft.png) |
| 已应用展示中筛选 (filter-active) | [主图](1440-filter-active.png) | [主图](390-filter-active.png) |
| 已归档可读筛选 (filter-archived) | [主图](1440-filter-archived.png) | [主图](390-filter-archived.png) |
| 120 字搜索边界 (filter-long) | [主图](1440-filter-long.png) | [主图](390-filter-long.png) |
| 筛选无结果 (filter-empty) | [主图](1440-filter-empty.png) | [主图](390-filter-empty.png) |
| 目标筛选等待 · 原快照归属 (filter-pending) | [主图](1440-filter-pending.png) | [主图](390-filter-pending.png) |
| 目标筛选失败 · 原快照归属 (filter-error) | [主图](1440-filter-error.png) | [主图](390-filter-error.png) |
| 合成分页第一页 (page-first) | [主图](1440-page-first.png) | [主图](390-page-first.png) |
| 合成分页最后页 (page-last) | [主图](1440-page-last.png) | [主图](390-page-last.png) |
| 翻页等待保留原页 (page-pending) | [主图](1440-page-pending.png) | [主图](390-page-pending.png) |
| 翻页失败原页归属 (page-error) | [主图](1440-page-error.png) | [主图](390-page-error.png) |
| 服务端校正越界页 (page-corrected) | [主图](1440-page-corrected.png) | [主图](390-page-corrected.png) |
| 完整事实详情 (detail) | [主图](1440-detail.png) | [主图](390-detail.png) · [局部1](390-detail-part1.png) |
| 技术信息展开 (technical) | [主图](1440-technical.png) | [主图](390-technical.png) · [局部1](390-technical-part1.png) |
| 长标题与归属详情 (long-detail) | [主图](1440-long-detail.png) | [主图](390-long-detail.png) · [局部1](390-long-detail-part1.png) · [局部2](390-long-detail-part2.png) |
| 缺失事实不补造 (missing-detail) | [主图](1440-missing-detail.png) | [主图](390-missing-detail.png) · [局部1](390-missing-detail-part1.png) |
| 归档内容只读状态 (archived-detail) | [主图](1440-archived-detail.png) | [主图](390-archived-detail.png) · [局部1](390-archived-detail-part1.png) |
| 七列视图设置 (settings) | [主图](1440-settings.png) | [主图](390-settings.png) |
| 至少一列 (one-column) | [主图](1440-one-column.png) | [主图](390-one-column.png) |
| 紧凑密度 (compact) | [主图](1440-compact.png) | [主图](390-compact.png) |
| 首列冻结 (frozen) | [主图](1440-frozen.png) | [主图](390-frozen.png) |
| 深色主题 (dark) | [主图](1440-dark.png) | [主图](390-dark.png) |
| 高对比主题 (contrast) | [主图](1440-contrast.png) | [主图](390-contrast.png) |
| 键盘焦点 (focus) | [主图](1440-focus.png) | [主图](390-focus.png) |
| 悬停 (hover) | [主图](1440-hover.png) | [主图](390-hover.png) |
| 按下 (pressed) | [主图](1440-pressed.png) | [主图](390-pressed.png) |
| 恢复展示审核 (review-active) | [主图](1440-review-active.png) | [主图](390-review-active.png) |
| 标记无关审核 (review-irrelevant) | [主图](1440-review-irrelevant.png) | [主图](390-review-irrelevant.png) |
| 标记过期审核 (review-stale) | [主图](1440-review-stale.png) | [主图](390-review-stale.png) |
| 原因空值 (reason-empty) | [主图](1440-reason-empty.png) | [主图](390-reason-empty.png) |
| 原因不足两字 (reason-one) | [主图](1440-reason-one.png) | [主图](390-reason-one.png) |
| 仅空白原因 (reason-spaces) | [主图](1440-reason-spaces.png) | [主图](390-reason-spaces.png) |
| 原因两字边界 (reason-min) | [主图](1440-reason-min.png) | [主图](390-reason-min.png) |
| 原因300字边界 (reason-max) | [主图](1440-reason-max.png) | [主图](390-reason-max.png) |
| 程序赋值超长保护 (reason-over) | [主图](1440-reason-over.png) | [主图](390-reason-over.png) |
| 同状态仍可提交 · 明确提示 (same-status) | [主图](1440-same-status.png) | [主图](390-same-status.png) |
| 审核提交中 (review-pending) | [主图](1440-review-pending.png) | [主图](390-review-pending.png) |
| 审核失败 · 弹窗内保留原因 (review-error) | [主图](1440-review-error.png) | [主图](390-review-error.png) |
| 版本冲突 · 重新读取 (review-conflict) | [主图](1440-review-conflict.png) | [主图](390-review-conflict.png) |
| 无权错误提示 · 不伪造专属状态 (review-forbidden) | [主图](1440-review-forbidden.png) | [主图](390-review-forbidden.png) |
| 结果未确认 · 不自动重试 (review-unknown) | [主图](1440-review-unknown.png) | [主图](390-review-unknown.png) |
| 模拟写入与刷新均成功 (review-success) | [主图](1440-review-success.png) | [主图](390-review-success.png) |
| 模拟写入成功但刷新失败 (success-refresh-error) | [主图](1440-success-refresh-error.png) | [主图](390-success-refresh-error.png) |
| 关闭不取消已发审核 (closed-pending) | [主图](1440-closed-pending.png) | [主图](390-closed-pending.png) |
| 旧结果不关闭新审核 (new-review-old-result) | [主图](1440-new-review-old-result.png) | [主图](390-new-review-old-result.png) |
| 取消未提交审核 (cancelled) | [主图](1440-cancelled.png) | [主图](390-cancelled.png) |
| 数据不足不等于事实可靠 (insufficient-data) | [主图](1440-insufficient-data.png) | [主图](390-insufficient-data.png) |
| 未知状态原值保留 (unknown-status) | [主图](1440-unknown-status.png) | [主图](390-unknown-status.png) |
| 源码与拟议改动边界 (source-boundary) | [主图](1440-source-boundary.png) | [主图](390-source-boundary.png) |
<!-- GALLERY:END -->
