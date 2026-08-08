# M04-07 AI 辅助分析架构

API 在事务内读取当前组织和工作区的机会、证据引用、最近评分与利润运行，生成不可变输入快照和 SHA-256；浏览器只拿到状态、脱敏模型名和结果，不接触模型地址或密钥。AI 输出固定为摘要、分类观察和缺失提示，必须引用快照声明的 `source_refs`，并标记 `ai_generated`。任何未知字段、伪造引用或非法 JSON 都会使任务重试或死信，不能写入结果。

宝塔 Node Worker 通过 OpenAI 兼容 `/chat/completions` JSON mode 调用模型，并在本地再次执行严格 schema 与引用白名单校验。这一兼容选择遵循官方文档对 JSON mode 的边界：JSON 有效性不等于 schema 可靠性，因此应用必须验证并处理不完整或非法输出。AI 不计算或覆盖价格、评分、利润、资质、风险结论与决策。

官方依据：[Structured model outputs](https://developers.openai.com/api/docs/guides/structured-outputs) 与 [Create chat completion](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)。

结果在 MySQL 5.7 中不可变保存，人工抽检另写 `ai_analysis_reviews`，只改变审核状态。读取使用 `opportunity:read`，排队与抽检使用 `opportunity:decide`；事件、Outbox、request_id、trace_id、输入哈希、提示合同版本和 Provider 请求标识均可追踪。
