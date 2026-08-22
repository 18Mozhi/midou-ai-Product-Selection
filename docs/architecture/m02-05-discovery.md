# M02-05 搜索与快捷创建

## 范围与依据

本模块实现当前组织、当前工作区内的全局搜索读取，以及按服务端能力过滤的快捷入口。布局和状态依据 `images-html` 的概念图 15–18，并继承 M02-01 主题和 M02-04 状态合同。通知中心仅保留真实 `/notifications` 入口；通知列表与详情仍由后续模块实现。

## 数据与服务合同

`search_documents` 保存兼容资源的最小投影：组织、工作区、资源类型与 ID、标题、副标题、站内路由、所需 capability、来源版本和更新时间。为保证核心流程不依赖缺失的投影写入者，读取查询同时直接联合当前范围内的 `tasks`、`opportunities`、`raw_evidence` 和 `collection_tasks`；四类结果分别要求 `task:read`、`opportunity:read`、`platform:operate`、`collection:replay`，并生成任务详情、机会详情、证据详情与采集任务详情站内深链。投影与事实表重复资源按类型和资源编号去重。

`DiscoveryService` 将查询限制在 2–100 字符、每页 1–20 条。MySQL 查询固定包含 `organization_id`、`workspace_id` 和 `required_capability`，转义 `%`、`_`、`!`，使用更新时间与 ID 稳定翻页，并丢弃非站内路由。搜索可按四类真实对象、对象自身状态和负责人名称或账号继续收敛；状态只匹配事实表的原始状态，负责人只适用于具有 `assignee_id` 或 `owner_id` 的任务与机会，不把创建者猜成负责人。结果返回真实状态和负责人展示名，浏览器再翻译为业务文案。证据与采集页面读取 `evidence`、`task` 查询参数后自动打开对应详情，因此搜索结果不是只到列表页。API 先解析活动会话上下文并以 `task:read` 产生同步授权决策，再返回带 `request_id`/`trace_id` 的无缓存信封。

## 快捷创建与非目标

`GET /api/v1/me/quick-actions?shell=member|organization_admin|platform_admin` 先校验请求壳层，再按该壳层的服务端能力过滤并使用壳层角色优先级排序入口。平台管理员无需伪造组织上下文。浏览器仅在当前 SPA 生命周期内保存最近点击的最多五个入口，并把最近使用项提升到该角色入口之前；不写 Cookie、localStorage 或服务端行为画像。任务和找货入口使用 `?create=1` 直接打开真实创建表单；组织和平台入口同样进入对应页面的创建状态。界面展示业务说明和“最近使用”，不暴露 capability 代码。该 API 不执行创建写入，也不创建额外异步服务。

本模块不新增环境变量或密钥；浏览器继续只使用既有 `VITE_API_BASE_URL`。权限来自服务端会话和 capability，前端按钮与菜单不是安全边界。
