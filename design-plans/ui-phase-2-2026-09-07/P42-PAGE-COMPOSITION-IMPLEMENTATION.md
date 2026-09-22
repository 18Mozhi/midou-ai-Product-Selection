# P42 组织详情 C 方向生产实施

## 已实施

- 真实 `/platform-admin/organizations/:organizationId` 详情弹窗已采用已审核的 C 分区：桌面左侧蓝色组织身份/事实、右侧白色资料工作区；手机改为单列，身份事实收拢到顶部，保存操作固定在可达底栏。
- 组织状态、成员数、工作区数明确区分已知零值和“尚未读取”；当前概览没有该目标时，文案只说明本次列表未返回，不推断删除或权限撤销。
- 保留组织名 2–120、时区必填且最多 64、保留天数整数 30–3650 的既有校验；保存仍使用原 PATCH 字段，停用/恢复仍使用原 POST 状态及原因合同，原因窗继续通过现有审计弹窗呈现。
- 新增组织详情状态组合函数并抽离已存在的组织写入归属逻辑。关闭、切换路由、KeepAlive 离页和卸载会隔离旧结果；已发写入不取消。保存成功但概览重读失败时，界面展示服务端写入回执、清除未知关系计数，并将“已保存”和“最新资料未读取”分别反馈，支持主动重读。

## 组件边界

- `PlatformAccountCenter.vue` 负责 API/路由、概览读取与反馈接线。
- `use-platform-organization-detail-state.ts` 负责选中组织与路由详情状态同步。
- `use-platform-organization-actions.ts` 负责已有原因确认与写入归属，并按重读结果同步写入回执。
- `PlatformOrganizationDetailDialog.vue` 只负责详情与状态布局；`PlatformAccountDialogs.vue` 复用原审计原因输入，不新增 API 或字段。

## 验证

- P42 定向单元测试：32/32 通过，覆盖写入归属、状态/原因请求合同、只读历史截图绑定、C生产结构与回执/重读失败反馈。
- 更新后的组织详情 E2E 在桌面 Chromium 与390px手机各1项，2/2通过；GET概览、失败/成功PATCH与幂等键均由本地拦截夹具提供，未写入真实组织。
- `npm run typecheck:web` 通过。
- `npm run verify:docs`、`npm run format:check`、`npm run verify:static-analysis` 与 `npm run build:web` 通过。`npm run verify:frontend-budget` 未通过：既有全局入口 CSS 为129451 bytes，超过122880 bytes限额；本批没有修改全局CSS或放宽预算。
- 本轮全量 `npm run test:unit` 执行2281项，1982通过、299失败；已观察到的失败包括历史源码摘要与归档像素证据绑定旧版本。其余失败未逐项归因，因此全量门禁明确记为未通过；本批定向集合32项通过。
- 宝塔部署成功，生产 `health/live` 返回 `ok` 且 `build_sha=aab4560f0951f575ea9635e2addbd19e977bffbf`；`health/ready` 返回 `ready`。P42组织详情深链返回 HTTP 200，HTML 应用壳及其 JS/CSS 静态资源均返回 HTTP 200。均为只读核验，未执行真实组织写入。

## 未覆盖

自动化不会创建、修改或停用真实组织；不证明生产 MySQL、审计、RBAC 或正式 M07-03 验收。没有变更 API/OpenAPI、数据库、权限规则、配置、依赖或部署拓扑。历史审核图与生产实现分别留档，不以预览图充当真实服务验收。
