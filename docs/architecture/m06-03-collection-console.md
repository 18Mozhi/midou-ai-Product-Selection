# M06-03 来源与采集控制台

控制台按概念图 62–64 组合来源表、任务状态、最近尝试、死信和质量摘要。来源是平台全局合同；任务、尝试、死信和质量记录始终复用同一 `organization_id` / `workspace_id` 过滤条件。`provider_id` 通过 `collection_subqueries` 的真实任务来源关联筛选任务、尝试和死信，并直接筛选质量问题；时间窗口固定为最近 24 小时、7 天、30 天或全部时间，分别使用任务更新时间、尝试/死信创建时间和质量问题更新时间。无筛选时是平台管理员被授权的全局运营视图。

错误根因只按 `collection_dead_letters.error_code` 聚合已经进入死信的失败任务，不把仍在自动重试或尚未进入死信的尝试计入死信总数，也不推断或改写错误。选择根因后，最近尝试和死信使用同一精确错误码下钻；原始错误码仅留在“技术详情”，主界面展示中文说明。页面的既有管理链接使用中文用途名，不暴露 `provider_registry` 等内部模块键。

采集告警类别只做用户界面归类，不改写真实根因：`network_error`、`dns_error`、`timeout` 显示为“网络”，`login_required`、`session_expired`、`blocked_login` 显示为“登录”，`captcha`、`blocked_captcha` 显示为“验证码”，`parser_error`、`parser_failed`、`parse_failed`、`source_changed` 显示为“解析”；其余真实错误码显示“其他”。下钻、重放和审计仍使用原始精确错误码，禁止把类别当成服务端筛选或重试规则。

新接口只读并写 `collection_console_views` 与 `platform_audit_events`；平台审计元数据同时保存来源、时间窗口和错误根因筛选。来源配置、健康检查、浏览器运行、任务详情、死信重放和质量处理继续由 M03 的真实 API 完成，不复制写合同。异步租约、重试、限流、Outbox 和死信仍归已有 Worker/Crawler 所有。

批量安全重放只组合 M03-05 已有的单任务 `POST /platform/collection/tasks/{taskId}/replay`，不创建第二套重放状态机。操作者从当前筛选结果中明确勾选最多 20 条 `open` 死信并填写 2–500 字原因；确认框固定展示死信数、根因、组织数和工作区数，且要求勾选影响确认并输入“确认重放”。每条请求使用同一批次 UUID 与来源任务 UUID 派生的独立 Idempotency-Key，服务端继续逐条校验 `collection:replay`、同源、死信状态和子查询完整性，并保留原任务、尝试、事件与审计。并发状态变化只使对应条目失败，已成功条目不会因重试重复克隆；页面分别报告成功和失败数量。
