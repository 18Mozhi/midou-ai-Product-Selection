# M02-05 搜索与快捷创建

## 范围与依据

本模块实现当前组织、当前工作区内的全局搜索读取，以及按服务端能力过滤的快捷入口。布局和状态依据 `images-html` 的概念图 15–18，并继承 M02-01 主题和 M02-04 状态合同。通知中心仅保留真实 `/notifications` 入口；通知列表与详情仍由后续模块实现。

## 数据与服务合同

`search_documents` 保存兼容资源的最小投影：组织、工作区、资源类型与 ID、标题、副标题、站内路由、所需 capability、来源版本和更新时间。为保证核心流程不依赖缺失的投影写入者，读取查询同时直接联合当前范围内的 `tasks`、`opportunities`、`raw_evidence` 和 `collection_tasks`；四类结果分别要求 `task:read`、`opportunity:read`、`platform:operate`、`collection:replay`，并生成任务详情、机会详情、证据详情与采集任务详情站内深链。投影与事实表重复资源按类型和资源编号去重。

`DiscoveryService` 将查询限制在 2–100 字符、每页 1–20 条。MySQL 查询固定包含 `organization_id`、`workspace_id` 和 `required_capability`，转义 `%`、`_`、`!`，使用更新时间与 ID 稳定翻页，并丢弃非站内路由。证据与采集页面读取 `evidence`、`task` 查询参数后自动打开对应详情，因此搜索结果不是只到列表页。API 先解析活动会话上下文并以 `task:read` 产生同步授权决策，再返回带 `request_id`/`trace_id` 的无缓存信封。

## 快捷创建与非目标

`GET /api/v1/me/quick-actions?shell=member|organization_admin|platform_admin` 先校验请求壳层，再按该壳层的服务端能力返回入口。平台管理员无需伪造组织上下文。任务和找货入口使用 `?create=1` 直接打开真实创建表单；组织和平台入口同样进入对应页面的创建状态。该 API 不执行创建写入，也不创建额外异步服务。

本模块不新增环境变量或密钥；浏览器继续只使用既有 `VITE_API_BASE_URL`。权限来自服务端会话和 capability，前端按钮与菜单不是安全边界。
