# M04-04 利润与成本 Runbook

## 宝塔部署

1. 在维护窗口按发布清单执行 `0017d_profit_cost_m04_04.up.sql`、`0064_governed_workflow_confirmations.up.sql` 与 `0072_automatic_quality_evaluation.up.sql`，确认 MySQL 5.7、`product_scout` 业务账号和 `utf8mb4`。
2. 在宝塔 Node 项目中部署 API 和 Worker 构建；不得创建面板外 PM2、systemd、crontab 或 Docker 服务。
3. 在宝塔 Worker 受限环境设置 `PROFIT_CALCULATION_POLL_MS` 与 `PROFIT_CALCULATION_LEASE_SECONDS`，然后重启宝塔 Node Worker。API 路由变更后同时重启宝塔 Node API。
4. 访问 `/sourcing` 创建显式费用规则，完成选品经理与组织管理员双审批后发布；未审批规则不会参与计算。
5. 自动证据评估由 `AUTOMATIC_SELECTION_EVALUATION_POLL_MS` 与 `AUTOMATIC_SELECTION_EVALUATION_LEASE_SECONDS` 控制。修改后通过宝塔重启 Node Worker；无需新增服务。
6. Amazon/1688 跨币种规则必须保存币种对、换算值、生效日期和 HTTPS 来源页面；发布前由选品经理与组织管理员分别审批。汇率依据需要更新时创建新规则版本，不能改写历史利润运行。

## 首版 Amazon 手机壳费用口径

- `platform_fee=15%`：按 [Amazon US 公开推荐费率](https://sell.amazon.com/pricing)中 Electronics Accessories 在 100 USD 以内的费率保守配置。Amazon 也明确说明实际费率分类可能不同，因此上线商品仍应在 [Revenue Calculator](https://sell.amazon.com/pricing/estimate) 或 Seller Central Fee Preview 核对。
- `payment_fee=0%`、`tax=0%`：仅表示当前规则没有另行计入独立支付手续费和卖家承担税费，不表示现实中永远没有这些成本。
- `fulfillment=4 USD/件`：是小型轻件试运行估值，不是固定官方费率。[Amazon FBA 官方口径](https://sell.amazon.com/fulfill.html)按尺寸和重量变化；取得包装尺寸和重量后必须建立新规则版本替换。
- `logistics=1 USD/件`：是中国到 FBA 入仓的首版业务缓冲，不是平台公布价格；取得真实货代报价后必须建立新规则版本替换。
- `CNY→USD=0.149014`、生效日 `2026-09-04`：由 [ECB 同日参考汇率](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html) EUR/USD 1.1622 除以 EUR/CNY 7.7994 得出。ECB 明确其参考汇率仅供信息使用，所以这里只作为有来源、可复算的试算依据，不冒充实际结算汇率。
- 该规则必须设置 `automatic_scope.product_family=phone_case`。系统对非手机壳、型号不一致、版本冲突、少于三条高置信 1688 报价或缺少上述依据的商品保持“规则命中候选”。

## 运行检查

- 确认队列没有长时间 `leased`，失败按 1/5/15 分钟重试，四次后进入 `dead_letter`。
- 对 `insufficient_data` 先检查 `missing_fields`；不得直接把缺失费用或汇率填为零。
- 汇率 Provider 必须已启用并声明 `exchange_rate`。停用 Provider 后，新计算不再选用其报价；既有运行仍保留原汇率快照。
- 使用 `request_id` / `trace_id` 对照 `opportunity_events` 和 `opportunity_outbox`。
- 使用两个不同活动成员验收成本复核：提交后新输入不应出现在 `current_inputs`，指定复核人通过后才成为当前输入；驳回、截止前提醒、逾期升级都不得激活输入。通知 Worker 发送前会复查 review 仍为 `pending`。
- 自动证据成本显示 `confirmation_mode=automatic_evidence`，必须能追溯 Amazon 售价证据、1688 报价证据、匹配样本数和公式版本；它不创建人工复核记录，也不能覆盖更新的人工当前输入。

## 调节与回滚

- 轮询间隔允许 250–60000 ms，租约允许 30–3600 秒；修改后必须在宝塔重启 Node Worker。
- 费用业务值不可通过环境变量调整；应创建新规则版本并重新完成双审批。
- 业务回滚：对当前活动规则调用 `rollback` 并指定同市场同平台的已批准或停用版本，后续任务使用目标版本，历史运行不改写。
- 数据库回滚：停止宝塔 Node API/Worker，确认没有 M04-04 业务数据需要保留后执行 down migration。该操作删除利润与费用表，属于破坏性操作，生产执行前必须备份并获得明确授权。
- 只回滚 0064 会删除成本复核历史，并把每组最新成本退化为当前输入；必须先停止统一 Node 后端、导出审批审计并由业务确认该语义。应用或回滚 0064 后通过宝塔重启统一 Node 后端，Python、MySQL 与 Redis 无需重启。
