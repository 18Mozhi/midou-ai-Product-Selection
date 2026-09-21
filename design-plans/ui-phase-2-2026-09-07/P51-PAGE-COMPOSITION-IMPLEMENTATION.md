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
