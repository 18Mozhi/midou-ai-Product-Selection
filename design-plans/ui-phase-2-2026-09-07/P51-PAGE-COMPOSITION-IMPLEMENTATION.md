# P51 采集任务中心 C 方向生产实施

## 已实施

- `CollectionTaskCenter.vue` 迁移到已审核的蓝白任务中心构图，加入生产范围标记 `collection-task-center--review`。
- 标题使用页面唯一 `h1`；当前页指标、任务队列、筛选、只读详情、技术追踪和人工重放入口保留原数据流与动作合同。
- `collection-tasks.css` 增加生产范围内的桌面/手机 C 方向样式、焦点态和触控尺寸，不改变分页、详情读取或人工重放规则。

## 组件边界

- `CollectionTaskCenter`：路由级数据读取、筛选、分页与详情编排。
- `ResponsiveDataView`：桌面表格与手机详情呈现。
- `ConfirmDialog`：人工重放确认壳，仅保留现有受控入口。

## 验证

- `node --test tests/unit/collection-task-page-preview.test.mjs`：通过。
- `node scripts/verify-collection-task-page-preview.mjs --capture-review r2`：1440/390 双端各 8 项检查，零写入；截图与 manifest 已刷新。
- `npm run typecheck:web`、`npm run format:check`、`npm run build:web`：通过。

## 未覆盖

本批未验证真实会话、RBAC、数据库任务事实、人工重放、Worker、失败状态、读屏或正式 M07-03 生产证据；本地 fixture 不等同生产验收。

## 2026-09-24 视觉审核与线上静态资源核验

- 用户授权剩余视觉状态自动通过，P51 C 方向页面视觉审核记录为通过；修正 E2E 对页面唯一 `h1` 的过期级别断言，并以当前实际 Vue 刷新 Windows Chromium 桌面/390px 快照基线。
- P51 双端完整 E2E：桌面 18/18、手机 18/18；定向页面单测、文档门、格式检查通过。
- 生产 `/platform-admin/collection` 返回 HTTP 200；`CollectionTaskCenter-DbUxrG8P.js` 与 `CollectionTaskCenter-bvM7acia.css` 均 HTTP 200，SHA-256 分别为 `732534822d524ed2b0dac9df45457619b8fd3f703fb5ab3809ad8db5d5908e93`、`1f73c33e2a3d4746383f188dc26611ea2aeaa9514f4d450f3073da15bfa57537`，与本地 `apps/web/dist/assets` 一致。
- 本轮只有测试、截图基线和审核台账变化，没有新的运行时代码；线上静态资源已与本地一致，因此没有触发全量宝塔发布、服务重启或重复迁移。
- 以上只证明该页面静态资源当前在线且版本一致，不替代真实会话/RBAC、MySQL、人工重放、Worker 或 M07-03 验收。
