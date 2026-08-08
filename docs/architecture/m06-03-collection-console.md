# M06-03 来源与采集控制台

控制台按概念图 62–64 组合来源表、任务状态、最近尝试、死信和质量摘要。来源是平台全局合同；任务、尝试、死信和质量记录始终复用同一 organization_id/workspace_id 过滤条件。无筛选时是平台管理员被授权的全局运营视图。

新接口只读并写 `collection_console_views` 与 `platform_audit_events`。来源配置、健康检查、浏览器运行、任务详情、死信重放和质量处理继续由 M03 的真实 API 完成，不复制写合同。异步租约、重试、限流、Outbox 和死信仍归已有 Worker/Crawler 所有。
