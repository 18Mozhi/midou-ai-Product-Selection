// Derived from ProviderAdapterCenter.vue; inert bridge, not mounted Vue.
window.ADAPTER_C_SOURCE = (bridge) => {
  const {
    ref,
    computed,
    watch,
    onMounted,
    defineProps,
    createApiClient,
    ApiClientError,
    window,
    AbortController,
    DOMException,
  } = bridge;
  const props = defineProps(),
    request = createApiClient(props.apiBaseUrl),
    state = ref("loading"),
    items = ref([]),
    requestId = ref(""),
    query = ref(""),
    mode = ref("all"),
    providerStatus = ref("all"),
    registration = ref("all"),
    health = ref("all"),
    sort = ref("attention"),
    page = ref(1),
    pageSize = 20,
    probing = ref(null),
    refreshing = ref(false),
    lastUpdatedAt = ref(null),
    message = ref("");
  const failure = (status) =>
    status === 401
      ? "expired"
      : status === 403
        ? "forbidden"
        : [408, 425, 429, 502, 503, 504].includes(status)
          ? "blocked"
          : "error";
  const accessModeText = (value) =>
      ({
        public_page: "公开页面",
        public_rss: "公开订阅源",
        authenticated_browser: "登录浏览器",
        import: "文件导入",
        manual: "人工录入",
      })[value] ?? "其他方式",
    providerStatusText = (value) =>
      ({ draft: "草稿", disabled: "未启用", enabled: "已启用" })[value] ?? "未知状态",
    healthText = (value) =>
      ({ unknown: "待检查", ready: "健康", degraded: "降级", blocked: "受阻" })[value],
    errorText = (value) =>
      value === "adapter_not_registered"
        ? "尚未登记适配器"
        : value
          ? "检查失败，详见技术详情"
          : "无错误",
    runtimeCategoryText = (value) =>
      ({
        unknown: "暂无运行样本",
        healthy: "运行正常",
        network: "网络异常",
        parser: "解析异常",
        login: "登录异常",
        empty: "成功但无结果",
        other: "其他异常",
      })[value],
    circuitText = (item) => (item.runtime_circuit_state === "open" ? "来源已暂停" : "来源可调度"),
    recoveryText = (item) =>
      item.runtime_circuit_state === "closed"
        ? item.runtime_last_recovered_at
          ? `最近恢复 ${item.runtime_last_recovered_at.slice(0, 19).replace("T", " ")}`
          : "当前无需恢复"
        : item.runtime_recovery_gate_met
          ? "健康检查已通过，可前往采集调度解除暂停"
          : "需要执行晚于暂停时间的真实健康检查",
    percentText = (value) => (value === null ? "暂无样本" : `${(value / 100).toFixed(1)}%`);
  const healthPriority = {
      blocked: 0,
      degraded: 1,
      unknown: 2,
      ready: 3,
    },
    filtered = computed(() => {
      const keyword = query.value.trim().toLocaleLowerCase("zh-CN");
      return items.value.filter(
        (item) =>
          (!keyword ||
            [
              item.name,
              item.code,
              item.adapter_version ?? "",
              item.last_error_code ?? "",
              accessModeText(item.access_mode),
            ].some((value) => value.toLocaleLowerCase("zh-CN").includes(keyword))) &&
          (mode.value === "all" || item.access_mode === mode.value) &&
          (providerStatus.value === "all" || item.provider_status === providerStatus.value) &&
          (registration.value === "all" ||
            item.adapter_registered === (registration.value === "registered")) &&
          (health.value === "all" || item.health_status === health.value),
      );
    }),
    sorted = computed(() =>
      [...filtered.value].sort((left, right) => {
        if (sort.value === "name") return left.name.localeCompare(right.name, "zh-CN");
        if (sort.value === "recent")
          return (right.last_checked_at ?? "").localeCompare(left.last_checked_at ?? "");
        return (
          Number(right.runtime_circuit_state === "open") -
            Number(left.runtime_circuit_state === "open") ||
          Number(left.adapter_registered) - Number(right.adapter_registered) ||
          healthPriority[left.health_status] - healthPriority[right.health_status] ||
          left.name.localeCompare(right.name, "zh-CN")
        );
      }),
    ),
    totalPages = computed(() => Math.max(1, Math.ceil(sorted.value.length / pageSize))),
    pageItems = computed(() =>
      sorted.value.slice((page.value - 1) * pageSize, page.value * pageSize),
    ),
    registered = computed(() => items.value.filter((item) => item.adapter_registered).length);
  watch([query, mode, providerStatus, registration, health, sort], () => (page.value = 1));
  watch(totalPages, (value) => {
    if (page.value > value) page.value = value;
  });
  function resetFilters() {
    query.value = "";
    mode.value = "all";
    providerStatus.value = "all";
    registration.value = "all";
    health.value = "all";
    sort.value = "attention";
  }
  async function load() {
    const preserve = items.value.length > 0;
    if (!preserve) state.value = "loading";
    refreshing.value = true;
    message.value = "";
    const controller = new AbortController(),
      timer = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await request("/platform/provider-adapters", {
        signal: controller.signal,
      });
      requestId.value = response.request_id;
      items.value = response.data;
      lastUpdatedAt.value = new Date().toISOString();
      state.value = items.value.length ? "ready" : "empty";
      if (preserve) message.value = `已刷新 ${items.value.length} 个来源适配器状态`;
    } catch (error) {
      const apiError = error instanceof ApiClientError ? error : null;
      requestId.value = apiError?.requestId ?? "";
      if (preserve) {
        state.value = "ready";
        message.value =
          error instanceof DOMException && error.name === "AbortError"
            ? "刷新超时，已保留上一次成功数据"
            : (apiError?.actionHint ?? "刷新失败，已保留上一次成功数据");
      } else state.value = apiError ? failure(apiError.status) : "blocked";
    } finally {
      window.clearTimeout(timer);
      refreshing.value = false;
    }
  }
  async function probe(item) {
    if (probing.value) return;
    probing.value = item.id;
    message.value = "";
    try {
      const response = await request(`/platform/provider-adapters/${item.id}/health-check`, {
        method: "POST",
      });
      requestId.value = response.request_id;
      items.value = items.value.map((current) =>
        current.id === item.id ? response.data : current,
      );
      message.value =
        response.data.health_status === "ready"
          ? `${item.name} 健康检查通过`
          : `${item.name} 已记录受阻原因`;
    } catch (error) {
      const apiError = error instanceof ApiClientError ? error : null;
      requestId.value = apiError?.requestId ?? "";
      message.value = apiError?.actionHint ?? "依赖不可用，未伪造健康结果";
    } finally {
      probing.value = null;
    }
  }
  onMounted(load);

  return {
    state,
    items,
    requestId,
    query,
    mode,
    providerStatus,
    registration,
    health,
    sort,
    page,
    probing,
    refreshing,
    lastUpdatedAt,
    message,
    failure,
    accessModeText,
    providerStatusText,
    healthText,
    errorText,
    runtimeCategoryText,
    circuitText,
    recoveryText,
    percentText,
    filtered,
    sorted,
    totalPages,
    pageItems,
    registered,
    resetFilters,
    load,
    probe,
  };
};
