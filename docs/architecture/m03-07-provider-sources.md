# M03-07 全网热点与来源目录

## 面向用户的结果

来源中心不再只显示两个技术条目。代码目录现在包含 100 个以上可解释的“来源频道”，分成新闻、电商、数据、社区和商品供应五类：

- 96 个公开 Google News RSS 固定频道由 8 个市场与 12 个主题组合而成，属于可自动采集频道；系统启动时自动登记并启用。
- Amazon、Keepa、1688、TikTok Shop、Reddit、YouTube、Similarweb、Semrush 等来源作为真实平台接入项预登记。没有官方凭证、已确认接口合同或合规浏览器档案时，它们保持“待配置”，不会伪造实时数据。
- Google News 关键词和商品供应 CSV 保留为用户手动采集入口。

这里的“100+”是可独立调度、审计和展示的来源频道数量，不宣称它们全部是相互独立的平台。页面明确显示“自动采集 / 待配置 / 手动导入”，小白用户不需要理解 Provider、Adapter 或 Parser 才能知道下一步。

## 自动与手动数据流

1. Node API 启动时以代码目录同步 `providers`。已存在来源只更新合同字段并保留人工状态；新自动频道登记为 `enabled`，待配置与手动来源登记为 `disabled`。
2. Node Worker 的 `MySqlAutomaticSourceScheduler` 为每个活动组织默认工作区建立 `automatic_source_schedules`。每次按偏移量轮转 16 个自动频道，避免一个任务一次抓取全部频道；完整轮转后等待 15 分钟。
3. 普通成员在热点页点击“立即获取热点”时，`POST /api/v1/provider-sources/refresh` 用当前组织、工作区和幂等键创建一次包含最多 100 个已启用自动频道的任务。
4. Worker 继续复用 M03-05 状态机、Redis 范围租约和 M03-06 不可变证据链；每条结果带 Provider、Adapter、Parser 和字段路径溯源。
5. 待配置来源没有适配器且默认禁用，因此不能进入自动任务；系统宁可显示“需要配置”也不把聚合新闻当成该平台官方销量或价格。

## 安全、权限与限制

- 来源目录：`provider:configure`；人工回放：`collection:replay`；热点页立即刷新：`trend:read`。
- 所有写请求要求 HttpOnly Session、同源 Origin 和 `Idempotency-Key`。
- 固定 RSS 地址由代码生成，只允许 HTTPS `news.google.com`，拒绝重定向、凭证、任意 URL 和调用方覆盖。
- 项目专用代理仍只作用于固定 Google News 请求；不设置系统或其他项目的全局代理。
- RSS 单响应最多 2 MB、单频道单批最多 20 条；原始证据与规范化记录仍按组织、工作区、来源和外部 ID 隔离去重。

## 配置与运行边界

`AUTOMATIC_SOURCE_SCHEDULER_POLL_MS` 控制 Worker 检查到期组织的周期，默认 30000 毫秒；修改后需要通过宝塔重启统一后端“ai选品”。通用采集仍复用 `COLLECTION_TASK_*`、`PROVIDER_ADAPTER_*`、`PROVIDER_PROXY_*` 和 `EVIDENCE_*`。

生产只保留一个宝塔 Node 后端项目“ai选品”。API、Worker 与采集职责由该项目统一拉起；不新增独立 Node/Python 项目、面板外服务、负载均衡或多节点能力。
