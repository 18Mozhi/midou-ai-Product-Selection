# M06-06 商业运营预留

本模块只建立套餐、配额、用量和人工调整的运营边界，不实现支付扣款，也不定义价格、币种、税率、发票或支付 Provider。平台运营管理员通过 `/platform-admin/commercial` 和 `/api/v1/platform/commercial/*` 操作，统一要求浏览器会话与 `platform:operate`；写操作还要求同源、`Idempotency-Key`、原因和版本锁。

## 数据与真相边界

- `commercial_plans` 保存版本化套餐名称、说明和配额 JSON；没有系统编造的默认套餐或默认价格。
- `organization_plan_assignments` 保存组织当前套餐及明确账期；`commercial_quota_adjustments` 保存带原因、有效期和撤销状态的人工增减量。
- 当前计量项固定来自已有持久化事实：`collection_tasks`、`open_api_usage` 和 `report_exports`，分别映射 `collection_tasks`、`open_api_requests`、`report_exports`。读取按组织与当前账期聚合，不用 Redis 或浏览器值替代事实。
- 有效配额等于套餐基础配额加当前有效人工调整，并以零为下限。模块不自动阻断业务请求；它提供后续策略可消费的真实配额视图，避免在没有业务规则时猜测强制行为。
- 读取写 `commercial_views`、平台审计和 `commercial_events`。变更同时写平台审计；组织级变更还在同一事务写 `outbox_events`。全局套餐事件允许 `organization_id` 为空，组织分配与调整必须有组织范围。

## API、权限和状态

读取接口可选 `organization_id`；不带组织时只返回套餐，不查询任何组织用量。创建套餐为草稿；页面可编辑配额并生成新版本。组织可首次分配，也可通过同一受控接口续期或变更套餐和账期，并可暂停、恢复或结束；调整及撤销同样使用版本化写入。相同 actor、路由和 Idempotency-Key 返回原结果，并发写由 MySQL 唯一键串行化。

页面依据 `images-html` 概念图 70 和 71，使用暗色卡片与配额比较层级；提供套餐编辑、会员续期/变更、暂停/恢复/结束、`loading`、`empty`、字段错误、`rate_limited`、依赖 `blocked`、确认和恢复状态。390px 下表单、套餐、用量与调整记录改为单列，状态文字和数值不依赖颜色。

## 异步边界

M06-06 没有支付结算、周期重置或额外 Worker/Crawler。用量在 Node API 中从 MySQL 同步聚合；组织级变更只投递既有事务 outbox，由已有宝塔 Node Worker 基础设施消费。不得为本模块创建面板外服务。
