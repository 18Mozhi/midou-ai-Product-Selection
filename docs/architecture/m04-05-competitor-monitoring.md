# M04-05 竞品监控架构

## 边界

本模块支持两条真实入口：外部 Provider 提交带证据的完整快照；普通成员提交 Amazon 商品 URL 后，由已启用的 `amazon_product` 公开页面适配器采集。后者不需要官方 API，也不以示例值补齐页面没有披露的字段。Amazon Parser v2 优先读取页面中的 Schema.org Product JSON-LD，以 SKU/商品 URL 确认 ASIN，并保留结构化字段路径与原始 JSON-LD 证据；仅在页面没有有效 Product 结构化数据时回退到既有语义 HTML 标记，无法形成真实商品记录时以 `source_changed` 失败关闭。竞品身份按组织、工作区、市场、来源站点和外部商品 ID 唯一。

## 数据流

`competitors` 保存身份、软删除状态和当前指针；`competitor_snapshots` 保存不可变快照。公开页采集先进入现有 `collection_tasks`，`CoreCollectionProjectionWorker` 把规范记录投影为快照，再由竞品比较 Worker 生成字段变化。达到显式阈值时，`competitor_alerts` 同时记录通知和任务的 `queued` 状态，并写 `competitor_outbox`，由 P05 的通知与任务模块消费。

公开页快照始终保存采集时间、来源状态、原始证据和商品地址；价格、货币、排名、评论数、评分和库存按页面真实披露保存，可为空但不能用零代替。首个快照建立基线，不制造变化。数值阈值按绝对变化量判断，库存仅支持任意变化或变为缺货。

竞品详情把最早不可变快照明确标为基线、最新快照标为当前值，并同时展示已记录变化数和对当前竞品生效的全局/专属阈值。价格变化的币种按变化证据 ID 回查对应当前快照，变化时间使用该记录的 `changed_at`，不从最新快照推断历史币种。

## 运行与隔离

所有业务表都以组织和工作区过滤；读用 `competitor:read`，写用 `competitor:manage`。审计员没有写权限。MySQL 5.7 是真实状态，Worker 使用租约、四次总尝试、1/5/15 分钟退避和死信；Redis 不保存业务真相。没有新增面板外生产服务。
