window.SCHEDULER_LOGIC = function (value, query = "", filter = "attention", page = 1) {
  const data = { value },
    providerQuery = { value: query },
    providerFilter = { value: filter },
    providerPage = { value: page },
    computed = (fn) => ({
      get value() {
        return fn();
      },
    });
  const providerPageSize = 12;
  const queueSummary = computed(() => {
    const providers = data.value?.providers ?? [];
    return {
      queued: providers.reduce((sum, item) => sum + item.queued_tasks, 0),
      oldest: providers.reduce(
        (oldest, item) => Math.max(oldest, item.longest_queue_wait_seconds),
        0,
      ),
      starvationRisks: providers.filter(
        (item) =>
          item.queued_tasks > 0 &&
          item.sample_count_24h > 0 &&
          item.queue_wait_p95_seconds > 0 &&
          item.longest_queue_wait_seconds > item.queue_wait_p95_seconds,
      ).length,
    };
  });
  const filteredProviders = computed(() => {
    const query = providerQuery.value.trim().toLocaleLowerCase();
    return [...(data.value?.providers ?? [])]
      .filter((item) => !query || item.code.toLocaleLowerCase().includes(query))
      .filter((item) => {
        if (providerFilter.value === "all") return true;
        if (providerFilter.value === "open") return item.circuit_state === "open";
        if (providerFilter.value === "queued") return item.queued_tasks > 0;
        return (
          item.circuit_state === "open" || item.queued_tasks > 0 || item.consecutive_failures > 0
        );
      })
      .sort(
        (left, right) =>
          Number(right.circuit_state === "open") - Number(left.circuit_state === "open") ||
          right.queued_tasks - left.queued_tasks ||
          right.consecutive_failures - left.consecutive_failures ||
          left.code.localeCompare(right.code),
      );
  });
  const providerPageCount = computed(() =>
    Math.max(1, Math.ceil(filteredProviders.value.length / providerPageSize)),
  );
  const pagedProviders = computed(() => {
    if (providerPage.value > providerPageCount.value) providerPage.value = providerPageCount.value;
    const offset = (providerPage.value - 1) * providerPageSize;
    return filteredProviders.value.slice(offset, offset + providerPageSize);
  });
  const expiredLeaseImpact = computed(() => {
    const impact = data.value?.expired_leases;
    if (!impact || impact.total === 0) return "当前没有过期租约；确认后不会修改任何活动槽位。";
    const types = [
      impact.worker ? `Worker ${impact.worker}` : "",
      impact.crawler ? `Crawler ${impact.crawler}` : "",
      impact.provider ? `来源 ${impact.provider}` : "",
    ].filter(Boolean);
    return `将回收 ${impact.total} 个过期槽位（${types.join("、")}），关联 ${impact.task_count} 个采集任务；最早于 ${impact.oldest_expired_at ? time(impact.oldest_expired_at) : "时间未知"} 到期。活动租约不会被修改。`;
  });
  const time = (value) =>
    new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(value));
  const processLabel = (value) => (value === "node_worker" ? "Node Worker" : "Python Crawler");
  const duration = (seconds) => {
    if (seconds < 60) return `${seconds} 秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时`;
    return `${Math.floor(seconds / 86400)} 天`;
  };
  const rate = (basisPoints) =>
    basisPoints == null ? "样本不足" : `${(basisPoints / 100).toFixed(1)}%`;
  const milliseconds = (value) =>
    value == null
      ? "样本不足"
      : value < 1000
        ? `${Math.round(value)} ms`
        : `${(value / 1000).toFixed(1)} 秒`;
  const bytes = (value) => {
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
    return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
  };
  const queueRiskText = (item) => {
    if (item.queued_tasks === 0) return "无排队，无饥饿风险";
    if (item.sample_count_24h === 0 || item.queue_wait_p95_seconds <= 0)
      return "缺少近 24 小时等待基线，需持续观察";
    if (item.longest_queue_wait_seconds > item.queue_wait_p95_seconds)
      return "最长等待已高于近 24 小时 P95，存在饥饿风险";
    return "最长等待仍在近 24 小时 P95 范围内";
  };
  return {
    providers: pagedProviders.value,
    total: filteredProviders.value.length,
    pages: providerPageCount.value,
    page: providerPage.value,
    summary: queueSummary.value,
    expired: expiredLeaseImpact.value,
    duration,
    rate,
    milliseconds,
    bytes,
    queueRiskText,
  };
};
function canConfirm(input) {
  if (input.destructive && !input.acknowledged) return false;
  const required = input.confirmationText?.trim();
  return !required || input.typedText?.trim() === required;
}
window.SCHEDULER_CONFIRM = canConfirm;
