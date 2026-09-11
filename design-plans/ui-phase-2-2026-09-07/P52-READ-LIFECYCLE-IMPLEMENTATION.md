# P52 · 读取生命周期与查询连续性实施

日期：2026-09-12

起点：`main/f03ebdfd`

页面：`/platform-admin/collection/overview`
生产组件：`apps/web/src/components/CollectionOperationsConsole.vue`

## 已实施

- 同路由 history 变化会恢复 `organization_id`、`workspace_id`、`provider_id`、`window`、`error_code`、`attempt_page` 与 `dead_letter_page`，并按恢复后的完整范围重新读取；不依赖组件重挂载。
- 每次 GET 固定自己的范围和分页快照、递增读取代次并中止旧读取；旧成功、旧失败和旧 `finally` 均不能覆盖新查询或提前解除 loading。
- 15 秒超时仍显示既有超时提示；`superseded`、`deactivated`、`unmounted` 中止不再冒充超时或依赖错误。
- KeepAlive 离页会中止等待中的读取并记录“返回续读”；只在该读取确实被打断时恢复一次，普通缓存返回不强制刷新。
- `attempts` 纳入事实可见性判断；只有尝试记录的合法响应进入 ready 并展示最近尝试，不再误报整页为空。
- 无效深链范围不再永久停在 loading，而是使用既有校验文字进入可恢复受阻状态。

## 保持不变

- GET 路径、查询字段、默认窗口、两套分页、服务端审计与权限合同不变。
- 不改变未知 query 的既有丢弃规则、来源排序、8 条折叠规则或各区块统计口径。
- 不修改批量重放目标、原因、幂等键、串行策略、失败处理或确认弹窗。
- 不改变 401/403 刷新是否保留既有快照；该安全策略继续单独核定。
- 不修改 CSS、C 方向图稿、API、数据库、环境变量、依赖或部署配置。

## 验证证据

- 永久 E2E：`tests/e2e/m06-03-collection-console.spec.ts`。
- 旧代码新增 8 个双端断言全部失败；同批既有来源 0/1/8/9 数量断言 8 项继续通过，证明失败边界集中在查询/生命周期/空态判定。
- 修复后 UI2-CL52 双端 16/16；完整 M06-03 `desktop-chromium` + `mobile-390` 28/28。
- `npm run build:web` 通过。所有请求均为 Playwright 本地拦截，不代表真实 API、审计、MySQL、权限或 Worker 验收。

## 仍待

- 批量重放的目标与原因冻结、离页和部分成功后的写入归属、未知结果不重复提交。
- 401/403 刷新后的快照安全呈现规则。
- 具体 C 视觉审核、全主题/密度/缩放/读屏、真实链路、宝塔部署与生产验收。
