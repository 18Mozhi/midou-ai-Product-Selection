# M04-02 机会工作台运维与回滚

## 宝塔运行

- Node API 与 Node Worker 均继续由宝塔面板管理，不创建额外生产服务。
- `OPPORTUNITY_REFRESH_POLL_MS` 与 `OPPORTUNITY_REFRESH_LEASE_SECONDS` 只放在宝塔受限环境；修改后在面板重启 Node Worker。
- 上线先执行 MySQL 5.7 迁移 `0017b_opportunities_m04_02.up.sql`，再重启 Node API 和 Node Worker，最后检查 `/api/v1/health/ready`。
- 发布自动发现选品逻辑后，确认商品型 `gnews_*` 主题能建立 `trend_topic` 来源候选、关联至少一条真实证据并保持 `insufficient_data`；普通新闻与数据频道不得批量生成候选。

## 观测和处置

- 使用 request_id/trace_id 关联 `opportunity_events`、`opportunity_outbox` 和 `opportunity_refresh_jobs`。
- `retry_scheduled` 会按 1/5/15 分钟退避；`failed_terminal` 表示来源已失效等不可重试输入，`dead_letter` 表示依赖错误耗尽四次。
- 页面显示 `insufficient_data` 或 `unknown` 是事实状态，不应通过手工 SQL 填入分数、ROI 或低风险。

## 回滚

先在宝塔关闭机会入口并停止 Node Worker，回滚应用版本，再执行 `0017b_opportunities_m04_02.down.sql`。只有确认无需保留本模块业务数据时才执行结构回滚；审计或证据需要留存时应先完成受控归档，不得以删除掩盖失败。恢复时重新应用迁移、启动 API/Worker，并运行 `npm run verify:module -- M04-02`。
