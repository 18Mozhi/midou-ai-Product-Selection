window.REDIS_LOGIC = function (value) {
  const data = { value };
  const computed = (fn) => ({
    get value() {
      return fn();
    },
  });
  const purposeLabel = {
    cache: "缓存",
    queue: "队列与租约",
    rate: "限流",
    sse: "实时消息",
  };
  const resourceLabel = {
    collection_ready: "采集就绪队列",
    collection_task: "采集任务租约",
    other: "其他受限键",
  };
  const sampleStatusLabel = {
    sampled: "采样完成",
    partial: "部分采样",
    empty: "暂无受限键",
    unavailable: "采样不可用",
  };
  const evictionRisk = computed(() => {
    if (!data.value) return { level: "unknown", text: "尚无观测" };
    if (data.value.evicted_keys > 0)
      return {
        level: "blocked",
        text: `实例启动后已累计淘汰 ${data.value.evicted_keys} 个键，需先核对受影响队列与实时协调。`,
      };
    if (data.value.max_memory_policy !== "noeviction")
      return { level: "blocked", text: `当前策略 ${data.value.max_memory_policy} 允许静默淘汰。` };
    if (data.value.memory.usage_basis_points >= 8000)
      return {
        level: "warning",
        text: "noeviction 不会静默淘汰，但接近内存上限时新写入会失败。",
      };
    return { level: "ready", text: "noeviction 已启用，当前未记录键淘汰。" };
  });
  return { risk: evictionRisk.value, purposeLabel, resourceLabel, sampleStatusLabel };
};
