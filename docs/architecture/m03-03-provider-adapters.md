# M03-03 Provider 适配器

## 范围与合同

M03-03 在 `@scoutops/provider-adapters` 固定 `collect`、`normalize`、`healthCheck` 三个方法和六种 access mode，但不猜测任何具体平台的请求方法、参数、鉴权或返回字段。适配器以 M03-01 的 Provider `code` 为 key 注册；code 未注册或 access mode 不匹配时失败关闭。M03-07 才登记首批真实来源实现，M03-04 才接入登录页浏览器执行，M03-05 才交付队列、租约、重试和死信状态机。

`collect` 必须携带 organization_id、workspace_id、request_id、trace_id、Provider 技术合同和受控 limit。统一运行时限制批次条数、响应字节数和超时，拒绝缺少 scope、超限或格式错误的结果。`normalize` 产出 external_id、observed_at、canonical_url、业务 fields、evidence_ref 和 Provider/Adapter/Parser provenance；原始证据持久化归 M03-06。健康检查不接受组织上下文，因为 Provider 与适配器是平台全局技术资产。

## 健康、审计与权限

`provider_adapter_health` 保存每个 Provider 的当前健康结果，`provider_adapter_health_versions` 保存不可变快照，`provider_adapter_operations` 保存操作人、幂等键和 request_id/trace_id。探针仅允许 `provider:configure`，写入要求同源 Origin 与 Idempotency-Key；响应只返回注册状态、版本、稳定错误码、连续失败次数和延迟，不返回凭证、Cookie、原始 payload 或其他组织数据。

来源健康页另外从最近 24 小时已完成的 `collection_subqueries` 读取真实运行样本，按来源展示成功率、P95 耗时和样本量。运行问题按稳定错误码明确归入网络、解析、登录；`succeeded_empty` 单独显示为“成功但无结果”，既不伪装成普通成功，也不误记为失败。窗口没有样本时返回 null/0，不用健康探针推断运行成功率。

同页把来源运行错误预算定义为 `provider_runtime_circuits.consecutive_failures` 相对 Provider 自身 `circuit_failure_threshold` 的剩余额度；这是现有运行熔断合同，不另造百分比、时间窗或统一阈值。熔断打开后，只有晚于 `opened_at` 的真实 `ready` 健康检查才满足恢复门；健康检查只证明依赖已经恢复，不会自动关闭熔断。最终解除仍从采集调度执行既有同源、幂等、审计动作。探针连续失败次数与运行熔断连续失败次数分别展示，不能互相替代。

来源详情的兼容矩阵复用仍在保留期内的 `browser_evidence_artifacts` DOM 片段和 `raw_evidence` HTML：完整 `content_sha256` 是“页面版本”，与证据当时的 `parser_version`、对应子查询终态和稳定错误码聚合。成功或成功空结果证明该组合曾兼容；只有解析类错误证明不兼容；同一组合同时出现两者标为结果不一致；网络、登录或未终态只标待验证。每个 Provider 最多返回最近八组，不返回页面正文、URL、组织、工作区、任务或请求标识，也不据此自动启停来源。

生产启动创建空的适配器注册表，因此在 M03-07 之前健康检查会真实记录 `blocked / adapter_not_registered`，不会用模拟成功掩盖缺失实现。错误分类只保留 timeout、rate_limited、login_expired、adapter_not_registered、invalid_payload 等稳定代码；异常正文和敏感 payload 不进入数据库或 API。

适配器目录的登记状态与版本直接来自当前 API 进程的只读注册表，因此首次健康检查前也必须展示真实实现版本；健康状态、检查时间与健康版本仍只来自 MySQL 探针记录，不能用“代码已注册”冒充“健康”。页面对完整来源目录提供名称/代码/版本/错误码搜索、来源/登记/健康筛选、排序和固定 20 条分页；刷新失败或 12 秒超时会保留上一次成功数据并给出明确反馈。

平台适配器页在桌面保留运行事实表格；760px 及以下使用来源健康摘要卡片与详情抽屉，并在抽屉内保留真实健康检查动作。错误预算显示连续运行失败、来源阈值、剩余额度和恢复门下一步；满足恢复门时直达采集调度，不在健康页旁路解除。接入模式、来源状态、登记状态、健康状态和已知错误在主界面使用中文，来源 UUID、来源代码、原始接入模式、适配器版本和错误码只在“技术详情”展示；该呈现转换不改变 API 的稳定状态码合同。

热点来源页对公开页面和登录页面来源提供“解析兼容矩阵”详情入口。主视图只展示截断后的 `sha256:` 页面版本、解析器版本、兼容结论、次数和最近观测时间；完整 64 位 SHA-256 只在技术详情中展示。没有仍在保留期内的 DOM/HTML 证据时明确显示暂无可比较版本，不使用适配器健康探针或快照 schema 伪造页面版本。

## 回滚

先在宝塔停止触发适配器健康检查的入口并停止 API/Worker，备份 `product_scout` 后执行 `0016c_provider_adapters_m03_03.down.sql`。down 按 operations、health versions、health 顺序删除，保留 M03-01 Provider 定义；随后回滚应用和环境上限，由宝塔重启。删除健康历史会永久失去探针审计，未验证备份前禁止生产执行。
