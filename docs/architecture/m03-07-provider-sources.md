# M03-07 首批来源实现

## 已接入来源与边界

M03-07 只实现两个已有明确合同的来源：`google_news_search` 使用 Google News 关键词 RSS，`manual_product_supply_csv` 使用操作者显式提交的商品与供应链 CSV。未接入 Amazon、Keepa、1688、eBay 或 Etsy，因为当前仓库没有已确认的生产凭证、授权范围和真实接口合同。

Google News 目标固定为 `https://news.google.com/rss/search?q={urlEncodedQuery}&hl=en-US&gl=US&ceid=US:en`。调用方只能提交 1–200 字符关键词，不能提交 URL；适配器拒绝重定向、非 XML 响应、超过 2 MB 的响应和合同变化。端点可访问只证明健康探针可达，不等于允许生产再分发或长期保存，所以目录策略为 `owner_review_required`，登记后仍是 `disabled`。

CSV 来源固定为 `inline://product-supply-csv-v1`，表头严格为 `external_id,title,price,currency,supplier_name,moq,canonical_url,observed_at`。文件最多 1 MB、101 行（含表头），单任务只持久化前 20 条；价格、币种、MOQ、URL 和时间均在适配器边界验证。

## 数据流

1. 平台运营以 `provider:configure` 读取固定目录并登记来源。登记写入 Provider 版本历史，但状态强制为 `disabled`，不会启动采集。
2. 所有者在现有来源定义页复核政策、字段、频率和保存期限后显式更新为 `enabled`。
3. 具备 `collection:replay` 的平台操作者在指定活动组织和工作区创建回放。API 校验同源 Origin 与 Idempotency-Key，在一个事务中写入 `provider_source_replay_runs`、M03-05 task/subquery/event/outbox。
4. 宝塔 Node Worker 使用 Redis 范围租约领取任务，按 Provider code 解析固定适配器。每条结果先保存 M03-06 原始证据文件，再写规范化记录和逐字段 provenance。
5. Worker 保存 task、subquery、attempt、replay run 的真实结果；空结果、部分结果、受阻和失败不会伪装为成功。

字段血缘保留 RSS 标签路径或 CSV 行列路径、Parser/Adapter 版本和源值 SHA-256。去重范围固定为 organization + workspace + provider + external ID；相同内容幂等，不同内容冲突。

## 权限、隔离与失败

- 目录和登记：`provider:configure`；回放：`collection:replay`。
- 所有写请求要求登录 Session、同源 Origin 和 Idempotency-Key。
- 回放前验证 Provider 已启用，组织与工作区存在、相属且均为 active。
- 外连地址由代码目录固定，未提供通用 URL、Header、Cookie 或凭证注入面。
- retryable 网络、DNS、超时按 M03-05 的 1/5/15 分钟退避；限流使用延后时间；权限、来源变化、解析失败和空结果保留明确状态与错误码。

## 运行配置

本模块复用 `PROVIDER_ADAPTER_*`、`COLLECTION_TASK_*`、`EVIDENCE_ROOT` 和 `EVIDENCE_MAX_RAW_BYTES`。代码内部对首批来源施加更小的 2 MB/1 MB/20 条上限，因此没有新增可绕过安全边界的 URL 或批量环境变量。配置指纹包含运行时上限；修改后必须由宝塔分别重启 Node API 和 Node Worker。
