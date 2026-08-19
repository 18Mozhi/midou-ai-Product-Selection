# M04-06 供应链找货架构

供应链页面把“用户输入”与“来源事实”分开保存。成员提交关键词或机会后，API 创建现有 `collection_tasks`，由 `made_in_china_search` 与 `ec21_supplier_search` 两个独立适配器并行抓取公开供应商商品页；无需官方 API。单一站点返回验证码、限流或结构变化时，该来源明确失败，另一来源仍可形成候选。`CoreCollectionProjectionWorker` 只投影规范记录里的真实供应商、商品、价格、币种、图片、原页和观测时间。机会型找货列表用关联的机会名称作为 `display_name`，内部 `input_ref` UUID 只在详情中作为追溯编号，不再充当用户可读标题。ERP 导入还可形成带同一原始证据的历史成本候选。来源没有 MOQ、规格、交期、所在地、可信度、稳定性和风险时，候选保持 `incomplete`，缺失项明确展示。

采购成员以 `supplier_quote:manage` 补充 MOQ、规格、交期、所在地、可信度、稳定性、风险和证据，产生不可变 `supplier_quotes` 版本；旧版本不覆盖。对比只接受当前工作区至少两家、最多五家现行完整报价，并在每个已保存对比中使用相同字段顺序展开供应商、规格、MOQ、报价和交期，不自动评选“最优”。采购数量不得低于已确认 MOQ。搜索可重新采集或审计软删除，不删除候选证据。

当前生产找货链只使用 `made_in_china_search` 与 `ec21_supplier_search` 公开页执行器，`sourcing_searches.status` 不包含 `blocked_login`。因此供应链页不伪造登录续期入口；将来只有在登录型来源合同真实关联浏览器档案续期任务后，才可从受阻记录直达该任务。

读取使用 `sourcing:read`，所有查询按组织和工作区过滤。MySQL 5.7 保存真相；宝塔 Node Worker 使用租约、四次总尝试、1/5/15 分钟退避和死信。Redis 不保存报价或权限真相，不新增面板外生产服务。
