# P54 · DATA-QUALITY-C-r1 证据与质量审核图册

具体稿待审。沿用用户选择的 C 方向，不沿用旧页布局；蓝色平台上下文与白色事实工作区，三任务视图分别阅读，详情与处置分开。本段与[近期记录图册](../data-records-direction-c/README.md)共同覆盖 P54 的设计范围，不代表 Vue 实现、生产部署或整页签收。

入口：[可交互原型](index.html)。所有图为本地浏览器实际渲染，不是 AI 示意图片。截图中英文 ID、域名、摘要均来自测试夹具或明确标记的合成状态；不含客户原文、真实 grant、路径、凭证或文件下载。

## 事实与改进边界

- 原始数据直接从 m03-06 E2E 的 ids/evidence/issue/run、dashboard 默认参数、lineage 响应 AST 提取，未将计划当作数据。原夹具仅各一条、未包含 memberOptions/openIssues/criticalIssues，原 Vue 回退本页计数；原 meta.page_size=50 与请求 20 不一致，不能证明真实分页。
- API 全量计数、当前页到期风险、最近 20 次核对中的首次指标分别标明。无数据不是零；没有总质量分。证据/问题搜索只在当前页，保留未 trim 的源搜索语义；核对下钻不是全量异常查询。
- 单解决 expected_version 必须真实整数；批处理服务 Number 转换版本，1–50 唯一问题、原因 2–500 字。attribute/assign/close 不删除证据。指派需全部同组织活动成员；批处理事务全部成功或回滚。隔离适配器不证明真实 MySQL 锁、幂等、事件或 Outbox。
- 原单解决和批处理 ConfirmDialog 均只输入短语，没有影响勾选。原详情与原因表单是内嵌 aside；新原生模态、手机可见批选、固定预览范围、客户端上限、等待禁用、迟到保护与写/读独立反馈均为待审提案，不是生产已修复。
- 完整溯源增加现有响应 quality_issues 的只读展示；没有增加接口字段。下载分为授权与访问，原型只模拟意图；签发成功不等于文件完整性验证。未知结果不自动重新签发或提交。
- 20/21 分页、成员、已解决/缺值、长文本与指标状态为补充合成。原始夹具的成功写后 dashboard 仍可返回原问题，图中明确“模拟”，没有用本地改数伪装实库成功。
- C 白色主稿之外的深色/高对比是主题草案；六边界宽度和 CSS zoom=2 为局部测试，不代表全部主题密度组合、真实浏览器缩放、软键盘、读屏或 Vue KeepAlive/历史导航验收。

## 操作审核范围

Q54 TAB/SEARCH/LOAD/PAGE/RUN；证据摘要/完整溯源/技术展开/受控下载；问题详情/关联证据/手机批选；三种批处理原因/范围预览/短语/取消；单解决原因/预检查/确认；列显隐至少一列/密度/冻结。关闭、Escape、返回焦点、禁用、处理中、成功、读取失败、冲突和结果未知有独立图或行为断言。复制仅显示失败模拟，不访问系统剪贴板。

源惰性执行复现：详情关闭后重开与旧详情覆盖、重复授权/解决请求、写成功覆盖刷新失败、筛选隐藏选择、批处理预览后动作漂移、超过 50 项及陈旧成员未在旧预览拦截。详见 evidence.json 的源绑定与检查，不能把原型代次保护当成真实 Vue 生命周期修复。

## 如何审核与复验

请先审 default / issues / runs 的双端布局，再审 lineage、单解决与三种批处理，最后确认下载、未知结果及冲突的文案。C 选择不代表本轮具体稿已批准；审核后才能进入对应生产实现。

复验：`node scripts/verify-ui-phase2-data-quality-c.mjs`；重新生成正式图：同命令附 `--capture`。生成器绑定 25 项历史合同，m06-02 既有 ff46bfe9 焦点测试改动分别核对提交前后完整 hash，不覆盖历史表。HTTP/浏览器错误/存储必须为零，浏览器 finally 关闭。无服务、重启或部署；无需环境变量或依赖变更。

<!-- GALLERY:START -->
正式PNG：179张；72场景。

| 场景 | 桌面1440 | 手机390 |
| --- | --- | --- |
| 证据 / 原始夹具 (default) | [主图](1440-default.png) | [主图](390-default.png) |
| 问题 / 原始夹具 (issues) | [主图](1440-issues.png) | [主图](390-issues.png) |
| 核对 / 原始夹具 (runs) | [主图](1440-runs.png) | [主图](390-runs.png) |
| 七指标混合状态（合成） (metrics-mixed) | [主图](1440-metrics-mixed.png) | [主图](390-metrics-mixed.png) |
| 七指标均缺失（合成） (metrics-empty) | [主图](1440-metrics-empty.png) | [主图](390-metrics-empty.png) |
| 当前页已到期（合成） (risk-expired) | [主图](1440-risk-expired.png) | [主图](390-risk-expired.png) |
| 观测缺失 / 风险未知（合成） (risk-unknown) | [主图](1440-risk-unknown.png) | [主图](390-risk-unknown.png) |
| 本地搜索无结果 (local-empty) | [主图](1440-local-empty.png) | [主图](390-local-empty.png) |
| 核对下钻无本页匹配 (run-empty) | [主图](1440-run-empty.png) | [主图](390-run-empty.png) |
| 核对下钻有匹配 (run-match) | [主图](1440-run-match.png) | [主图](390-run-match.png) |
| 隐藏选择仍在预览范围 (selection-hidden) | [主图](1440-selection-hidden.png) | [主图](390-selection-hidden.png) |
| 已解决 / 原因与责任（合成） (issue-resolved) | [主图](1440-issue-resolved.png) | [主图](390-issue-resolved.png) · [局部1](390-issue-resolved-part1.png) |
| 缺少关联及数值（合成） (issue-null) | [主图](1440-issue-null.png) | [主图](390-issue-null.png) · [局部1](390-issue-null-part1.png) |
| 证据完整记录 (evidence-detail) | [主图](1440-evidence-detail.png) | [主图](390-evidence-detail.png) |
| 完整溯源 (lineage) | [主图](1440-lineage.png) · [局部1](1440-lineage-part1.png) | [主图](390-lineage.png) · [局部1](390-lineage-part1.png) · [局部2](390-lineage-part2.png) |
| 完整溯源 / 技术标识展开 (lineage-technical) | [主图](1440-lineage-technical.png) · [局部1](1440-lineage-technical-part1.png) | [主图](390-lineage-technical.png) · [局部1](390-lineage-technical-part1.png) · [局部2](390-lineage-technical-part2.png) · [局部3](390-lineage-technical-part3.png) |
| 问题 / 技术标识展开 (issue-technical) | [主图](1440-issue-technical.png) | [主图](390-issue-technical.png) · [局部1](390-issue-technical-part1.png) |
| 技术编号 / 复制失败模拟 (copy-failed) | [主图](1440-copy-failed.png) · [局部1](1440-copy-failed-part1.png) | [主图](390-copy-failed.png) · [局部1](390-copy-failed-part1.png) · [局部2](390-copy-failed-part2.png) · [局部3](390-copy-failed-part3.png) |
| 溯源读取中 (lineage-loading) | [主图](1440-lineage-loading.png) | [主图](390-lineage-loading.png) |
| 溯源失败 (lineage-error) | [主图](1440-lineage-error.png) | [主图](390-lineage-error.png) |
| 长中文 / URL 与技术标识 (long-lineage) | [主图](1440-long-lineage.png) · [局部1](1440-long-lineage-part1.png) | [主图](390-long-lineage.png) · [局部1](390-long-lineage-part1.png) · [局部2](390-long-lineage-part2.png) · [局部3](390-long-lineage-part3.png) |
| 质量问题详情 (issue-detail) | [主图](1440-issue-detail.png) | [主图](390-issue-detail.png) · [局部1](390-issue-detail-part1.png) |
| 受控下载说明 (download-ready) | [主图](1440-download-ready.png) | [主图](390-download-ready.png) |
| 授权签发中 (download-busy) | [主图](1440-download-busy.png) | [主图](390-download-busy.png) |
| 签发不等于下载完成 (download-success) | [主图](1440-download-success.png) | [主图](390-download-success.png) |
| 授权结果未知 (download-unknown) | [主图](1440-download-unknown.png) | [主图](390-download-unknown.png) |
| 授权拒绝 / 依赖失败 (download-error) | [主图](1440-download-error.png) | [主图](390-download-error.png) |
| 服务合同 / 授权失效 403 (download-expired) | [主图](1440-download-expired.png) | [主图](390-download-expired.png) |
| 服务合同 / 证据不存在或非活动 404 (download-missing) | [主图](1440-download-missing.png) | [主图](390-download-missing.png) |
| 服务合同 / 完整性失败 409 (download-integrity) | [主图](1440-download-integrity.png) | [主图](390-download-integrity.png) |
| 服务合同 / 未配置签名 503 (download-no-key) | [主图](1440-download-no-key.png) | [主图](390-download-no-key.png) |
| 解决原因 / 空 (resolve-empty) | [主图](1440-resolve-empty.png) | [主图](390-resolve-empty.png) |
| 解决原因 / 1 字禁用 (resolve-short) | [主图](1440-resolve-short.png) | [主图](390-resolve-short.png) |
| 解决原因 / 可预检查 (resolve-valid) | [主图](1440-resolve-valid.png) | [主图](390-resolve-valid.png) |
| 解决原因 / 500 字 (resolve-limit) | [主图](1440-resolve-limit.png) | [主图](390-resolve-limit.png) |
| 解决 / 短语待输入 (resolve-confirm) | [主图](1440-resolve-confirm.png) | [主图](390-resolve-confirm.png) · [局部1](390-resolve-confirm-part1.png) |
| 解决 / 短语正确 (resolve-ready) | [主图](1440-resolve-ready.png) | [主图](390-resolve-ready.png) · [局部1](390-resolve-ready-part1.png) |
| 解决 / 提交中 (resolve-busy) | [主图](1440-resolve-busy.png) | [主图](390-resolve-busy.png) · [局部1](390-resolve-busy-part1.png) |
| 解决 / 版本冲突 (resolve-conflict) | [主图](1440-resolve-conflict.png) | [主图](390-resolve-conflict.png) · [局部1](390-resolve-conflict-part1.png) |
| 解决 / 结果未知 (resolve-unknown) | [主图](1440-resolve-unknown.png) | [主图](390-resolve-unknown.png) · [局部1](390-resolve-unknown-part1.png) |
| 解决写成功 / 读取失败 (resolve-read-failed) | [主图](1440-resolve-read-failed.png) | [主图](390-resolve-read-failed.png) · [局部1](390-resolve-read-failed-part1.png) |
| 解决 / 模拟反馈 (resolve-success) | [主图](1440-resolve-success.png) | [主图](390-resolve-success.png) · [局部1](390-resolve-success-part1.png) |
| 批量归因 (batch-attribute) | [主图](1440-batch-attribute.png) | [主图](390-batch-attribute.png) |
| 批量指派（合成成员） (batch-assign) | [主图](1440-batch-assign.png) | [主图](390-batch-assign.png) |
| 批量指派 / 固定成员确认 (batch-assign-confirm) | [主图](1440-batch-assign-confirm.png) | [主图](390-batch-assign-confirm.png) · [局部1](390-batch-assign-confirm-part1.png) |
| 无可用同组织成员 (batch-no-member) | [主图](1440-batch-no-member.png) | [主图](390-batch-no-member.png) |
| 批量解决 (batch-close) | [主图](1440-batch-close.png) | [主图](390-batch-close.png) |
| 批量解决 / 固定范围确认 (batch-close-confirm) | [主图](1440-batch-close-confirm.png) | [主图](390-batch-close-confirm.png) · [局部1](390-batch-close-confirm-part1.png) |
| 批处理 / 范围确认 (batch-confirm) | [主图](1440-batch-confirm.png) | [主图](390-batch-confirm.png) · [局部1](390-batch-confirm-part1.png) |
| 批处理 / 短语正确 (batch-ready) | [主图](1440-batch-ready.png) | [主图](390-batch-ready.png) · [局部1](390-batch-ready-part1.png) |
| 批处理 / 提交中 (batch-busy) | [主图](1440-batch-busy.png) | [主图](390-batch-busy.png) · [局部1](390-batch-busy-part1.png) |
| 批处理 / 整批冲突 (batch-conflict) | [主图](1440-batch-conflict.png) | [主图](390-batch-conflict.png) · [局部1](390-batch-conflict-part1.png) |
| 批处理 / 结果未知 (batch-unknown) | [主图](1440-batch-unknown.png) | [主图](390-batch-unknown.png) · [局部1](390-batch-unknown-part1.png) |
| 批处理写成功 / 读取失败 (batch-read-failed) | [主图](1440-batch-read-failed.png) | [主图](390-batch-read-failed.png) · [局部1](390-batch-read-failed-part1.png) |
| 批处理 / 模拟反馈 (batch-success) | [主图](1440-batch-success.png) | [主图](390-batch-success.png) · [局部1](390-batch-success-part1.png) |
| 20/21 条分页（合成） (page-first) | [主图](1440-page-first.png) | [主图](390-page-first.png) |
| 最后 1/21 条（合成） (page-last) | [主图](1440-page-last.png) | [主图](390-page-last.png) |
| 翻页中保留原页 (page-wait) | [主图](1440-page-wait.png) | [主图](390-page-wait.png) |
| 翻页失败保留原页 (page-failed) | [主图](1440-page-failed.png) | [主图](390-page-failed.png) |
| 列 / 密度 / 冻结设置 (settings) | [主图](1440-settings.png) | [主图](390-settings.png) |
| 紧凑列表 (compact) | [主图](1440-compact.png) | [主图](390-compact.png) |
| 深色主题草案 (dark) | [主图](1440-dark.png) | [主图](390-dark.png) |
| 高对比主题草案 (contrast) | [主图](1440-contrast.png) | [主图](390-contrast.png) |
| 首次加载 (loading) | [主图](1440-loading.png) | [主图](390-loading.png) |
| 全空 (empty) | [主图](1440-empty.png) | [主图](390-empty.png) |
| 会话过期 (expired) | [主图](1440-expired.png) | [主图](390-expired.png) |
| 无权限 (forbidden) | [主图](1440-forbidden.png) | [主图](390-forbidden.png) |
| 依赖受阻 (blocked) | [主图](1440-blocked.png) | [主图](390-blocked.png) |
| 首次错误 (error) | [主图](1440-error.png) | [主图](390-error.png) |
| 按钮悬停 (hover) | [主图](1440-hover.png) | [主图](390-hover.png) |
| 按钮键盘焦点 (focus) | [主图](1440-focus.png) | [主图](390-focus.png) |
| 按钮按下 (pressed) | [主图](1440-pressed.png) | [主图](390-pressed.png) |
<!-- GALLERY:END -->
