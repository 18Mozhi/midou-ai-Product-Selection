# P53 实际 Vue C 组合 · 批107

## 审核范围

本批使用实际 `/platform-admin/collection/browser-runtime`、`CollectionRuntimeSurface` 与 `CollectionRuntimeCenter`，仅在本地审核层重构网页采集运行的蓝白身份、档案与租约、运行结果和恢复提示。

## 保留的合同

- 保留档案元数据、活动租约、过期占用风险、全量运行指标和运行列表的现有读取口径。
- 档案有效期、登录状态和租约占用继续分开表达；不声称站点已实际登录或可采集。
- “回收过期运行”只作为既有全局操作入口展示；本批不打开确认、不发送 POST，也不回收租约。

## 本地核验

`node --test tests/unit/browser-runtime-page-preview.test.mjs` 通过。

`node scripts/verify-browser-runtime-page-preview.mjs --capture-review r1` 在 1440/390 各通过 6 项检查，生成运行中心的双端永久审核图；每组 2 次本地 GET、零写入。

## 未覆盖

未验证真实会话、RBAC、浏览器进程、MySQL 租约、搜索/分页、运行详情、确认回收、Python 采集、失败状态、读屏或生产环境；本批不构成生产验收。
