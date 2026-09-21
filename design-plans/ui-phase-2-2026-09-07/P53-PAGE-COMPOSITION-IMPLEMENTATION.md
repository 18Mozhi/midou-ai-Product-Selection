# P53 网页采集运行 C 方向生产实施

## 已实施

- `CollectionRuntimeCenter.vue` 迁移到已审核的蓝白运行中心构图，加入生产范围标记 `crawler-center--review`。
- 标题使用页面唯一 `h1`；档案与租约、运行指标、筛选、运行表格、分页、回收确认和技术追踪保留原数据流与动作合同。
- `crawler-runtime.css` 增加生产范围内的桌面/手机 C 方向样式、焦点态和触控尺寸，不改变回收 API、租约语义或登录状态判断。

## 验证

- `node --test tests/unit/browser-runtime-page-preview.test.mjs`：通过。
- `node scripts/verify-browser-runtime-page-preview.mjs --capture-review r2`：1440/390 双端各 6 项检查，零写入；截图与 manifest 已刷新。
- `npm run typecheck:web`、`npm run format:check`、`npm run build:web`：通过。

## 未覆盖

本批未验证真实浏览器进程、MySQL 租约、RBAC、回收写入、Python 采集、分页详情或正式 M07-03 生产证据；本地 fixture 不等同生产验收。
