# P52 实际 Vue C 组合 · 批106

## 审核范围

本批使用实际 `/platform-admin/collection/overview`、`CollectionRuntimeSurface` 与 `CollectionOperationsConsole`，仅在本地审核层重构采集总览的蓝白身份、来源健康、根因、尝试和死信工作流。

## 保留的合同

- 保留总览 GET 的既有范围、来源健康、统计、根因、尝试和死信事实。
- 来源健康继续独立表达为平台当前健康，不与组织、窗口或错误根因统计混为同一口径。
- 保留批量安全重放入口，但本批不展开预览、不输入原因、不确认，也不发送 POST。

## 本地核验

`node --test tests/unit/collection-overview-page-preview.test.mjs` 通过。

`node scripts/verify-collection-overview-page-preview.mjs --capture-review r1` 在 1440/390 各通过 5 项检查，生成总览双端永久审核图；每组 2 次本地 GET、零写入。

## 未覆盖

未验证真实会话、RBAC、数据库事实、范围提交、根因下钻、分页、批量预览/重放、外部采集、Worker、失败状态、读屏或生产环境；本批不构成生产验收。
