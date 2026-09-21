# P51 实际 Vue C 组合 · 批105

## 审核范围

本批使用实际 `/platform-admin/collection`、`CollectionRuntimeSurface` 与 `CollectionTaskCenter`，仅在本地审核层重构采集任务中心的蓝白身份、当前页指标、任务队列与只读任务详情。

## 保留的合同

- 列表继续按既有 `page`、`page_size=50` 与状态条件读取；当前页指标不改画成全站统计。
- 队列继续明确“覆盖不足不会自动给出推荐结论”。
- 详情继续展示任务、来源、缺失字段、尝试与事件事实。
- “人工重放”只作为现有详情入口展示：本批绝不点击、不发送 POST，也不创建任务。

## 本地核验

`node --test tests/unit/collection-task-page-preview.test.mjs` 通过。

`node scripts/verify-collection-task-page-preview.mjs --capture-review r1` 在 1440/390 各通过 8 项检查，生成队列与只读详情的双端永久审核图；每组 5 次本地 GET、零写入。

## 未覆盖

未验证真实会话、RBAC、数据库任务事实、人工重放、外部采集、Worker、失败状态、读屏、完整 URL 历史或生产环境；本批不构成生产验收。
