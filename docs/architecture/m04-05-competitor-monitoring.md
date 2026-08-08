# M04-05 竞品监控架构

## 边界

本模块只接受已启用 Provider 对应的、字段完整且带 `source_ref_id` 与 `evidence_id` 的快照。API 不模拟外部采集，也不以示例值补齐缺失字段。竞品身份按组织、工作区、市场、来源站点和外部商品 ID 唯一。

## 数据流

`competitors` 保存身份和当前指针；`competitor_snapshots` 保存不可变快照。API 写入快照后仅创建 `competitor_snapshot_jobs`，宝塔 Node Worker 比较上一快照并把字段、前值、当前值、变化时间、证据和影响解释写入 `competitor_changes`。达到显式阈值时，`competitor_alerts` 同时记录通知和任务的 `queued` 状态，并写 `competitor_outbox`，由 P05 的通知与任务模块消费。

快照必含价格、货币、排名、评论数、评分、库存、采集时间、新鲜度和来源状态。首个快照建立基线，不制造变化。数值阈值按绝对变化量判断，库存仅支持任意变化或变为缺货。

## 运行与隔离

所有业务表都以组织和工作区过滤；读用 `competitor:read`，写用 `competitor:manage`。审计员没有写权限。MySQL 5.7 是真实状态，Worker 使用租约、四次总尝试、1/5/15 分钟退避和死信；Redis 不保存业务真相。没有新增面板外生产服务。
