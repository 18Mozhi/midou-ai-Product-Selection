# Amazon 请求身份与 1688 LAN 健康检查

## 生产依据

2026-10-18，后续链路优先调度生效后，先前等待的 9 个详情、竞品和找货任务实际被领取，但受到来源熔断阻断。Amazon 最近连续五次 network_error，标准健康页使用旧 Chrome 请求身份时仍失败；同一公开爬虫策略允许的地址，使用 ScoutOpsPublicCrawler/1.0 得到 HTTP 200、可解析商品。单次成功不能证明永久可用，也不能据此断言历史错误的唯一原因。

1688 LAN 节点真实 POST 返回 success、items 等原有响应字段，样本十条均可解析；来源健康却没有实际记录，注册的是旧浏览器占位健康实现。不能以服务可访问为由直接清空熔断，必须补齐真实健康及审计流程。

## 实现

- Amazon 适配器 v10 的页面请求与 robots 检查使用同一 PUBLIC_CRAWLER_USER_AGENT，即 ScoutOpsPublicCrawler/1.0。删除该适配器旧 Chrome 冒用头；不切换代理、不绕过 robots、验证页、鉴权或限流。解析字段版本仍为 amazon-public-product-v5。
- 将既有 LAN 客户端和解析器移到 packages/provider-sources，Worker 原路径只转导出，同一套六节点、固定鉴权、字段、60 条上限、字节限制、故障切换及禁止重定向逻辑继续复用，不复制实现。
- API 注册来源时，仅在已有 LAN_1688_TOKEN 配置存在时使用 1688-lan-health-adapter-v1。真实健康检查复用同一 LAN 客户端，对用户提供的固定 Amazon 示例图执行图搜并校验原响应格式。健康结果不返回候选、不持久化商品或供应商事实、不计产出；空合法响应也只能证明接口可工作。
- 无 token 时保留原浏览器验证 gate。旧浏览器采集入口仍由原适配器处理，Worker 的正式图搜继续使用原 LAN 执行路径，不用健康样本替换业务图片或结果。
- Registry 增加内部可选、严格校验的逐适配器健康期限；API 的 1688 使用已有 LAN_1688_TIMEOUT_MS，同时取来源 timeout_ms 较小值。其他来源继续使用 PROVIDER_ADAPTER_HEALTH_TIMEOUT_MS。没有新增环境变量、HTTP 参数、数据库迁移、依赖或 Python 变化。
- 所有 token 均只在后端配置及 LAN 请求头中使用；来源列表、健康结果和规范化事实不携带凭证。

## 验证及运行

tests/unit/source-transport-health.test.mjs 覆盖请求身份一致、共享实现、真实请求结构、健康不泄露候选/凭证、规范化溯源、未配置 gate、失败和取消、逐来源超时及非法期限拒绝。既有 LAN 图片、60 条响应、六节点、重定向、证据和 Amazon 结构/验证页保护测试保留。

ProviderAdapterCenter 使用既有健康 POST 和待完成状态，没有额外的短期限写请求计时器；API 响应字段不变，因此前端无需增加字段或配置。OpenAPI 只补充既有健康行为说明。config/env.example 同步既有两个超时的适用范围，实际环境值未改变。

正式部署后重启唯一宝塔 Node 项目 ai选品。先用现有 ProviderAdapterService 执行真实健康检查，再由 CrawlerSchedulerRepository 审核晚于熔断时间的 ready 记录并恢复；健康接口本身不会启用来源、批准条款或清空熔断。没有可自动放行的模拟健康结果。商品业务任务仍须独立采集和验收，日百品未完成。
