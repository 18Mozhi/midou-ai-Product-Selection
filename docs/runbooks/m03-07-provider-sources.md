# M03-07 自动热点来源运维与回滚

## 宝塔发布

1. 在宝塔备份 `product_scout` 数据库与证据目录。
2. 以 `product_scout` 业务账号在 `product_scout` 库执行 `0036_automatic_hotspot_sources.up.sql`；迁移兼容 MySQL 5.7 与 utf8mb4。本次来源配置接口不新增数据库迁移。
3. 发布统一后端与 Web 构建；确认宝塔只有一个名为“ai选品”的 Node 后端项目。
4. 在“ai选品”受限环境确认 `AUTOMATIC_SOURCE_SCHEDULER_POLL_MS=30000`，再通过宝塔重启该项目。
5. 检查 `/api/v1/health/ready`、Worker 心跳中的 `registered_sources`、来源中心数量以及一个真实组织的自动调度记录。

## 日常使用

- 普通用户：进入“热点趋势”，系统会自动更新；需要立即更新时点击“立即获取热点”。
- 平台管理员：进入“热点来源”，可直接编辑频率、超时、重试次数和启停状态；保存要求原因并写入平台审计，启动时的目录同步不会覆盖这些管理员配置。
- 自动目录包含 96 个 Google News RSS、40 个非 Google RSS/Atom 或公开页频道与 2 个 Amazon/eBay 固定公开榜单页面爬虫；其中 Shopify 资讯和 eBay 公告已切换到当前公开 HTML 页面。普通用户不需要配置官方 API Key。Walmart 当前返回人工验证页，保留为受控页面来源并明确显示受阻，不会伪造商品数据。
- 跨境自动来源只复用本项目受限代理，并仅允许代码目录中自动来源的固定主机；不设置服务器全局代理，也不会代理用户输入的网址。新增自动来源主机时必须同步目录测试、Feature Map 与本运维说明，然后通过宝塔重启“ai选品”。
- 登录型来源只使用平台管理员维护的受控浏览器档案。没有真实登录态或页面解析合同的来源保持禁用，不伪造结果，也不要求普通用户填写密钥。
- 调节自动调度器检查周期时修改 `AUTOMATIC_SOURCE_SCHEDULER_POLL_MS`（5000–300000），然后通过宝塔重启统一后端“ai选品”。

## 故障处理

- `waiting_for_platform_admin`：尚无活动平台超级管理员，目录不会写入；先按既有种子流程完成管理员激活。
- `adapter_not_registered`：来源仍处于待配置状态或部署版本不一致；不要伪造成功。
- `rate_limited`：保留任务和证据，等待状态机退避；不要提高并发绕过限制。
- `source_changed` / `parse_failed`：停用对应频道，保留 trace_id，更新解析器和合同测试后再恢复。
- 固定公开榜单页面无结果：先核对页面是否调整结构或返回地区/验证页面；解析器会以 `source_changed` 失败，不会把空白或错误页当成商品数据。
- 自动任务不生成：核对 `automatic_source_schedules.next_scheduled_at`、组织/默认工作区状态和统一后端 Worker 日志。
- 手动刷新失败：核对当前会话的活动组织/工作区、`trend:read`、Origin 与 Idempotency-Key。

所有排障都只检查“ai选品”项目自己的日志、表和证据；不得操作 PVE、其他项目、系统磁盘调度器或面板外服务。

## 回滚

先通过宝塔停止“ai选品”，回滚应用版本，再执行 `0036_automatic_hotspot_sources.down.sql`。Down 只删除自动调度、手动刷新幂等和平台账号幂等表，不删除 Provider、采集任务、原始证据、用户、组织或审计记录。若需要删除已产生的业务数据，必须另行取得数据删除授权。

最后通过宝塔启动“ai选品”，复查健康与单后端状态。回滚不创建独立 Worker、Crawler 或测试项目。

## 本次发布重启要求

来源适配器、自动调度筛选和 API 路由都在进程启动时加载。发布后必须通过宝塔重启统一 Node API 与 Node Worker；不需要重启 MySQL、Redis 或创建新服务。
