(() => {
  const labels = {
    accepted: "已受理",
    active: "正常",
    adopted: "已采纳",
    blocked: "已受阻",
    blocked_captcha: "验证码受阻",
    blocked_login: "登录已失效",
    blocked_robots: "站点规则受阻",
    cancelled: "已取消",
    closed: "已关闭",
    completed: "已完成",
    completed_with_warnings: "完成但有缺失",
    dead_letter: "失败待处理",
    enabled: "已启用",
    failed: "失败",
    failed_terminal: "终止失败",
    in_progress: "处理中",
    insufficient: "证据不足",
    insufficient_data: "数据不足",
    leased: "已领取",
    observing: "持续观察",
    open: "未处理",
    paused: "已暂停",
    parsing: "解析中",
    pending: "待处理",
    persisted: "已持久化",
    queued: "排队中",
    rate_limited: "限速等待",
    rejected: "已驳回",
    retry_scheduled: "等待重试",
    running: "执行中",
    scheduled: "已排队",
    stale: "数据已过期",
    succeeded: "成功",
    succeeded_empty: "成功但无结果",
    todo: "待处理",
    validating: "校验中",
  };
  const statusLabel = (value) => (value ? (labels[value] ?? "待确认") : "未提供");
  const technicalStatus = (value) => value ?? "unknown";
  const durationLabel = (seconds) => {
    const safe = Math.max(0, Number(seconds) || 0),
      days = Math.floor(safe / 86400),
      hours = Math.floor((safe % 86400) / 3600),
      minutes = Math.floor((safe % 3600) / 60);
    if (days) return `${days} 天 ${hours} 小时`;
    if (hours) return `${hours} 小时 ${minutes} 分钟`;
    return `${minutes} 分钟`;
  };

  const isException = function isException(item) {
    return (
      Boolean(item.error_code) ||
      ["blocked", "failed", "timed_out", "dead_letter", "degraded", "denied"].some((status) =>
        item.status.includes(status),
      )
    );
  };
  const taskLink = (item) =>
    item.task_id
      ? `/platform-admin/collection?task=${encodeURIComponent(item.task_id)}&from=${encodeURIComponent("/platform-admin/logs")}`
      : "";
  const providerLink = (item) =>
    item.provider_id
      ? `/platform-admin/providers/sources?provider_id=${encodeURIComponent(item.provider_id)}&from=${encodeURIComponent("/platform-admin/logs")}`
      : "";
  const sourceName = (value) => ({ api: "API", worker: "Worker", crawler: "爬虫" })[value] ?? value;
  const eventName = (value) =>
    ({
      "platform.dashboard.read": "读取平台运行事实",
      "platform.collection.requested": "提交采集请求",
      "platform.provider.test.failed": "来源测试失败",
      "collection.task.started": "采集任务开始",
      "collection.task.failed": "采集任务失败",
      "crawler.run.timed_out": "爬虫运行超时",
    })[value] ?? value;
  const resourceName = (value) =>
    ({
      platform_dashboard: "平台运行事实",
      collection_task: "采集任务",
      crawler_run: "爬虫运行",
      provider: "来源",
      export_probe: "导出校验",
    })[value] ?? value;
  const logStatusName = (value) => (value === "timed_out" ? "已超时" : statusLabel(value));
  const when = (value) => new Date(value).toLocaleString("zh-CN");
  const shortId = (value) => (value.length > 16 ? `${value.slice(0, 12)}…` : value);
  function chains(rows) {
    const items = { value: rows };
    return (() => {
      const groups = new Map();
      for (const item of items.value) {
        const traceId = item.trace_id || `missing:${item.source}:${item.id}`;
        groups.set(traceId, [...(groups.get(traceId) ?? []), item]);
      }
      return [...groups.entries()].map(([traceId, chainItems]) => {
        const chronological = [...chainItems].sort(
          (left, right) =>
            new Date(left.occurred_at).getTime() - new Date(right.occurred_at).getTime(),
        );
        return {
          traceId,
          items: chronological,
          sources: [...new Set(chainItems.map((item) => item.source))],
          exceptionCount: chainItems.filter(isException).length,
          startedAt: chronological[0]?.occurred_at ?? "",
          endedAt: chronological.at(-1)?.occurred_at ?? "",
        };
      });
    })();
  }
  window.LOG_SOURCE = {
    chains,
    isException,
    taskLink,
    providerLink,
    sourceName,
    eventName,
    resourceName,
    logStatusName,
    when,
    shortId,
  };
})();
