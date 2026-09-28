# P47 · 保留旧目录时的刷新失败提示实施

## 改动

将已审核的保留快照提示接入实际 `ProviderAdapterCenter`。目录刷新失败且已有快照时，在筛选区后、目录前展示温和的状态说明、原服务端 `actionHint`、可展开的 `request_id` 和「重新刷新」按钮；旧目录、筛选、分页与详情保持不变。重试仍调用原 GET `load()`、12 秒超时及 API 客户端的安全重试；开始重试时提示隐藏，并将焦点移至持续存在的页面标题。成功后沿用既有“已刷新 N 个来源适配器状态”反馈。健康检查开始时清除此读取反馈展示态。

样式限定在 P47 C 页面，手机下改为单列并使用整行重试按钮。新增的 `refreshNotice` 仅区分刷新反馈模板，不替代或改变 `state/items/message/requestId` 的业务状态来源。

## 合同边界

- 不改 API/OpenAPI、请求方法/字段、错误分类、权限、数据、超时、安全重试、探针请求或后端。
- 不制造“已更新”提示，不猜服务端错误原因；固定说明明确旧快照仍可查看。
- 本地 fixture 仅验证 UI 和请求合同，不证明真实来源权限、探针或 MySQL 状态，也不构成正式 M07-03 验收。

## 验证

- `node --test tests/unit/ui-phase2-provider-adapter-refresh-failure.test.mjs`：4/4 通过，包含生产 SFC 编译、原请求/筛选合同、焦点 helper、样式作用域及不可变归档图包。
- `npx --no-install playwright test tests/e2e/m03-03-provider-adapter.spec.ts --project=desktop-chromium --project=mobile-390 --workers=1`：22/22 每端通过；新增失败→追踪→保留筛选/目录→标题焦点重试→恢复用例双端通过。
- `npm run build:web`、前端 202 资源预算、459 文件静态分析、格式、文档/73路由、计划结构与 `git diff --check` 均通过。
- 本地 fixture 仅验证浏览器展示和既有请求行为，不证明真实来源权限/健康探针、MySQL/RBAC 或正式 M07-03。

归档刷新失败审核图仍为独立历史材料，没有重写或把图包检查当作生产验收。部署结果、提交与线上 SHA 在本节下方续记。
