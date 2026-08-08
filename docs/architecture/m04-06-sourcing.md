# M04-06 供应链找货架构

供应链页面把“用户输入”与“来源事实”分开保存。`sourcing_searches` 记录关键词、图片、机会或商品链接及当前工作区已完成的采集任务；Worker 只投影 `product-supply-csv-v1` 的真实规范化记录。现有来源没有规格、交期、所在地、可信度、稳定性和风险时，候选保持 `incomplete`，缺失项明确展示。

采购成员以 `supplier_quote:manage` 带证据确认完整报价，产生不可变 `supplier_quotes` 版本；旧版本不覆盖。对比只接受当前工作区至少两家、最多五家现行完整报价，展示规格、报价、MOQ、交期、稳定性和风险，不自动评选“最优”。采购数量不得低于 MOQ，创建入口只把请求可靠写入 `sourcing_purchase_tasks` 与 Outbox，P05 任务中心消费后更新投递状态。

读取使用 `sourcing:read`，所有查询按组织和工作区过滤。MySQL 5.7 保存真相；宝塔 Node Worker 使用租约、四次总尝试、1/5/15 分钟退避和死信。Redis 不保存报价或权限真相，不新增面板外生产服务。
