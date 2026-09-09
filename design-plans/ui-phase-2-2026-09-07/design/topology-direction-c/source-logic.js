window.TOPOLOGY_LOGIC = function (value) {
  const data = { value };
  const computed = (fn) => ({
    get value() {
      return fn();
    },
  });
  const alertLabels = {
    worker_scheduler_heartbeat_stale: "任务调度心跳过期",
    worker_scheduler_backpressure: "任务调度发生背压",
    worker_scheduler_recent_failures: "最近一分钟存在失败",
    worker_scheduler_suspected_stuck: "存在疑似卡死任务",
    worker_scheduler_queue_circuit_open: "队列连续失败已熔断",
    worker_scheduler_snapshot_publish_failed: "调度状态写入失败",
    backend_restart_loop: "后端连续重启",
    worker_business_result_failed: "业务处理返回失败",
  };
  const queueLabels = {
    collection_tasks: "采集任务",
    auth_delivery: "账号通知",
    business_task_projection: "业务任务投影",
    approval_escalation: "审批升级",
    notification_outbox: "站内通知",
    webhook_deliveries: "Webhook 投递",
    opportunity_refresh: "机会刷新",
    opportunity_scoring: "机会评分",
    opportunity_profit: "利润计算",
    competitor_monitor: "竞品监控",
    sourcing_projection: "供应链投影",
    trend_projection: "趋势投影",
    ai_analysis: "AI 分析",
    report_exports: "报表导出",
    automation_rules: "自动化规则",
    core_collection_projection: "采集事实投影",
    automatic_rule_sources: "规则采集",
    automatic_full_sources: "全量采集",
  };
  const healthEndpointLabels = {
    live: "进程存活",
    ready: "同步依赖就绪",
    available: "业务可处理",
  };
  const healthOutcomeLabels = {
    succeeded: "正常",
    http_error: "接口异常",
    timeout: "探测超时",
    network_error: "连接失败",
  };
  const queueRows = computed(() =>
    (data.value?.worker_scheduler?.queues ?? []).map((queue) => {
      const agingBoost = Math.max(0, queue.effective_priority - queue.priority);
      const maximumAgingBoost = Math.max(0, queue.maximum_aging_boost ?? 0);
      return {
        ...queue,
        aging_boost: agingBoost,
        starvation_risk:
          queue.due &&
          !queue.running &&
          queue.queue_delay_ms > 0 &&
          maximumAgingBoost > 0 &&
          agingBoost >= maximumAgingBoost,
      };
    }),
  );
  const exceptionalQueues = computed(() =>
    queueRows.value.filter(
      (queue) =>
        queue.running ||
        queue.due ||
        queue.consecutive_failures > 0 ||
        queue.suspected_stuck ||
        queue.circuit_state === "open" ||
        queue.starvation_risk,
    ),
  );
  return {
    queues: queueRows.value,
    exceptional: exceptionalQueues.value,
    queueLabels,
    alertLabels,
    healthEndpointLabels,
    healthOutcomeLabels,
  };
};
