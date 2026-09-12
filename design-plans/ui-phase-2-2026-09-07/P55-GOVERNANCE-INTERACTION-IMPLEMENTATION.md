# P55 · 治理目录 C 方向交互实现

日期：2026-09-12
路由：`/platform-admin/governance`
状态：真实 Vue 已实现并完成本地夹具验证；用户视觉审核、真实 MySQL/RBAC 与生产验收待办。

## 实现结果

- 用深蓝五分类目录替换旧的通用大标题、KPI 卡片与同款表格结构；白色工作面优先展示版本、责任范围、状态和所属工作台。
- 桌面使用五列表格与原生详情窗；手机使用横向分类目录、摘要列表与字段等价的底部详情。
- 筛选草稿、已应用条件、目标分类与成功快照分离。等待或失败时，记录类型、版本和工作台链接继续绑定成功快照。
- 首次无权限时使用温和文案，不展示旧内容；筛选无结果与全局无数据保持不同说明。
- 自动化详情展示触发事件、严重度、动作标题、动作类型、频控次数和窗口；零次数保留为事实，不推断不限频率。
- 请求以代次隔离；KeepAlive 停用中止 GET 并关闭详情，重新激活后刷新但不重写 URL。
- `ResponsiveDataView` 与 `ResponsiveFilterDrawer` 只增加可选 `appearance="governance"`，默认消费者不变。

## 动作闭环

[action-reviews/P55.json](action-reviews/P55.json)把23个局部源位置归并为8组：

| 动作 | 范围 |
| --- | --- |
| DG55-SECTION | 五分类选择与读取 |
| DG55-PROVIDER | 桌面/手机来源版本入口 |
| DG55-LOAD | 刷新、首次失败重试、激活刷新 |
| DG55-WORKBENCH | 顶部、行、手机详情和桌面详情的所属工作台入口 |
| DG55-FILTER | 响应式筛选、提交、应用与重置 |
| DG55-DETAIL | 桌面详情打开、取消、顶部/底部关闭 |
| DG55-TECH | 桌面行、手机详情和桌面详情的技术展开 |
| DG55-PAGE | 上一页、下一页与服务端页码收束 |

页面无 POST/PATCH，不新增启停、审批、发布或删除动作；目标工作台仍由目标页独立授权。

## 当前 Vue 证据

目录：[design/governance-direction-c/vue-implementation](design/governance-direction-c/vue-implementation/)

共12张 PNG 与12份 JSON，桌面1440、手机390各覆盖：

1. 五分类治理目录；
2. 默认评分规则；
3. 自动化完整详情；
4. 筛选无结果；
5. 首次权限拒绝；
6. 读取失败保留成功快照。

每份 JSON 记录路由、视口、源码哈希、断言状态与水平溢出检查。证据来自实际 Vue 夹具，不是静态 HTML 提案，也不代表真实生产数据。

## 验证边界

已验证：类型检查、P55双端夹具、旧DG55保留快照、分类/筛选/分页、完整自动化字段、0频控、原生详情关闭、KeepAlive停用/激活、当前截图无水平溢出。

仍待验证：真实登录与platform:operate、五张表和provider_versions的生产数据、目标页RBAC/跨组织编辑落点、长浏览器历史、真实读屏/软键盘、共享NavigationShell重构、生产部署与用户签收。

静态[GOVERNANCE-C-r1](design/governance-direction-c/README.md)继续绑定main/ce50835a，用于复现设计推导；当前实现证据独立保存，二者不可互相冒充。
