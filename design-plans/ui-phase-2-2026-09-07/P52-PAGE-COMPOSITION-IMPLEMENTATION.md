# P52 采集总览 C 方向生产实施

## 已实施

- `CollectionOperationsConsole.vue` 迁移到已审核的蓝白采集控制台构图，加入生产范围标记 `collection-ops--review`。
- 标题使用页面唯一 `h1`；来源健康、任务状态、质量问题、错误根因、最近尝试、死信和批量安全重放入口保留既有数据流与动作合同。
- `platform-operations.css` 增加生产范围内的桌面/手机 C 方向样式、焦点态和触控尺寸，不改变总览 GET、重放预览或 POST 合同。

## 验证

- `node --test tests/unit/collection-overview-page-preview.test.mjs`：通过。
- `node scripts/verify-collection-overview-page-preview.mjs --capture-review r2`：1440/390 双端各 5 项检查，零写入；截图与 manifest 已刷新。
- `npm run typecheck:web`、`npm run format:check`、`npm run build:web`：通过。

## 未覆盖

本批未验证真实会话、RBAC、数据库事实、批量预览/重放、Worker、外部采集或正式 M07-03 生产证据；本地 fixture 不等同生产验收。
