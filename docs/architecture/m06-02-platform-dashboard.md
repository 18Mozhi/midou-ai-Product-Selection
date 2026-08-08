# M06-02 平台驾驶舱

`/platform-admin` 使用高分辨率图 10 的深色驾驶舱布局，但所有数字来自当前 MySQL 5.7。读模型聚合活动组织/用户、启用来源与时间窗内子查询、任务终态和积压、开放质量问题、活动文件体积与窗内增长。没有任务样本时成功率为 `null`；没有来源样本时为 `unknown`。

`GET /api/v1/platform/dashboard` 只允许具备 `platform:operate` 的平台身份，不依赖组织会话。响应不包含凭证、Cookie、业务 payload 或文件路径；告警仅带组织/工作区 ID、错误码、严重度和时间。每次敏感全局读取在同一事务写 `platform_dashboard_views` 与 `platform_audit_events`，关联 request_id/trace_id。

驾驶舱同步读取既有 Worker/Crawler/Outbox 状态，不拥有异步任务，也不新建常驻进程。队列告警阈值只影响显示状态。当前仍是宝塔 S0 单机交付，不代表多节点或 10,000 用户能力。
