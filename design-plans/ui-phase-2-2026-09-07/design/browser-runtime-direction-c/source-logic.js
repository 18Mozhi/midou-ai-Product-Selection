// Actual Vue script + original E2E snapshot, not a Vue mount or HTTP.
window.RUNTIME_C_SOURCE = (bridge) => {
  const {
    ref,
    computed,
    onBeforeUnmount,
    onMounted,
    useRoute,
    useRouter,
    defineProps,
    createApiClient,
    ApiClientError,
    window,
    AbortController,
    URLSearchParams,
  } = bridge;
  const props = defineProps(),
    request = createApiClient(props.apiBaseUrl),
    route = useRoute(),
    router = useRouter(),
    queryValue = (name) => {
      const value = route.query[name];
      return typeof value === "string" ? value : "";
    },
    allowedStatuses = new Set([
      "running",
      "succeeded",
      "succeeded_empty",
      "blocked",
      "failed",
      "timed_out",
      "cancelled",
    ]),
    initialStatus = allowedStatuses.has(queryValue("status")) ? queryValue("status") : "all",
    initialPage = /^\d{1,6}$/.test(queryValue("page")) ? Number(queryValue("page")) : 1,
    state = ref("loading"),
    profiles = ref([]),
    runs = ref([]),
    pagination = ref({ page: 1, page_size: 25, total: 0, total_pages: 0 }),
    runMetrics = ref({ total: 0, abnormal: 0, duplicate_risk: 0 }),
    requestId = ref(""),
    message = ref(""),
    query = ref(queryValue("q").trim()),
    queryDraft = ref(query.value),
    status = ref(initialStatus),
    page = ref(Math.max(1, initialPage)),
    observedAt = ref(""),
    confirming = ref(false),
    saving = ref(false),
    refreshing = ref(false);
  let activeController = null;
  const activeLeases = computed(() => profiles.value.filter((item) => item.lease)),
    expiredLeaseRisks = computed(() =>
      profiles.value.filter(
        (item) =>
          item.lease &&
          observedAt.value &&
          new Date(item.lease.expires_at).getTime() <= new Date(observedAt.value).getTime(),
      ),
    );
  const failure = (kind) =>
    kind === "expired" || kind === "forbidden"
      ? kind
      : kind === "blocked" || kind === "rate_limited"
        ? "blocked"
        : "error";
  async function syncUrl() {
    const next = {};
    if (query.value) next.q = query.value;
    if (status.value !== "all") next.status = status.value;
    if (page.value > 1) next.page = String(page.value);
    await router.replace({ query: next });
  }
  async function load(options = {}) {
    if (refreshing.value) return;
    const hadData = Boolean(observedAt.value);
    refreshing.value = true;
    if (!hadData) state.value = "loading";
    message.value = "";
    const search = new URLSearchParams({ page: String(page.value) });
    if (query.value) search.set("q", query.value);
    if (status.value !== "all") search.set("status", status.value);
    const controller = new AbortController();
    activeController = controller;
    const timer = window.setTimeout(() => controller.abort(), 15_000);
    try {
      if (options.updateUrl !== false) await syncUrl();
      const response = await request(`/platform/crawler-runtime?${search}`, {
        signal: controller.signal,
      });
      requestId.value = response.request_id;
      profiles.value = response.data.profiles;
      runs.value = response.data.runs;
      runMetrics.value = response.data.run_metrics;
      pagination.value = response.data.pagination;
      const requestedPage = page.value;
      page.value = response.data.pagination.page;
      observedAt.value = response.data.observed_at;
      state.value = profiles.value.length || runMetrics.value.total ? "ready" : "empty";
      if (requestedPage !== page.value) await syncUrl();
    } catch (error) {
      const apiError = error instanceof ApiClientError ? error : null,
        hint = controller.signal.aborted
          ? "读取超过 15 秒，已安全取消；当前已验证数据仍保留。"
          : (apiError?.actionHint ?? "网络或服务异常，当前已验证数据仍保留。");
      requestId.value = apiError?.requestId ?? requestId.value;
      if (hadData) {
        message.value = hint.includes("当前已验证数据仍保留")
          ? hint
          : `${hint} 当前已验证数据仍保留。`;
        state.value = "ready";
      } else {
        message.value = hint;
        state.value = apiError ? failure(apiError.kind) : "blocked";
      }
    } finally {
      window.clearTimeout(timer);
      if (activeController === controller) activeController = null;
      refreshing.value = false;
    }
  }
  function applyFilters() {
    if (refreshing.value) return;
    query.value = queryDraft.value.trim();
    page.value = 1;
    void load();
  }
  function resetFilters() {
    if (refreshing.value) return;
    query.value = "";
    queryDraft.value = "";
    status.value = "all";
    page.value = 1;
    void load();
  }
  function goToPage(nextPage) {
    if (refreshing.value || nextPage < 1 || nextPage > pagination.value.total_pages) return;
    page.value = nextPage;
    void load();
  }
  async function recover() {
    if (saving.value || expiredLeaseRisks.value.length === 0) return;
    saving.value = true;
    try {
      const response = await request("/platform/crawler-runtime/recover-expired", {
        method: "POST",
        body: {},
      });
      requestId.value = response.request_id;
      const notice = `已回收 ${response.data.recovered} 个过期租约`;
      await load({ updateUrl: false });
      message.value = notice;
    } catch (error) {
      if (error instanceof ApiClientError) {
        requestId.value = error.requestId;
        message.value = error.actionHint;
      } else message.value = "依赖不可用，未执行回收";
    } finally {
      saving.value = false;
      confirming.value = false;
    }
  }
  const time = (value) =>
    value
      ? new Intl.DateTimeFormat("zh-CN", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(new Date(value))
      : "—";
  const statusText = (value) =>
    ({
      running: "运行中",
      succeeded: "成功",
      succeeded_empty: "成功但无结果",
      blocked: "已拦截",
      failed: "失败",
      timed_out: "已超时",
      cancelled: "已取消",
    })[value] ?? value;
  const errorText = (value) =>
    value
      ? ({
          blocked_login: "登录已失效",
          blocked_captcha: "需要验证码",
          blocked_robots: "网站限制采集",
          lease_expired: "运行租约已过期",
        }[value] ?? "查看详情获取原因")
      : "无错误";
  const expiryForecast = (profile) => {
    if (!profile.credential_expires_at || !observedAt.value) return "未提供有效期，无法预测";
    const remainingMs =
      new Date(profile.credential_expires_at).getTime() - new Date(observedAt.value).getTime();
    if (!Number.isFinite(remainingMs)) return "有效期不可用";
    if (remainingMs <= 0) return `已到期 · ${time(profile.credential_expires_at)}`;
    const remainingDays = Math.max(1, Math.ceil(remainingMs / 86_400_000));
    return `${remainingDays <= 7 ? "即将到期" : "预计到期"} · ${remainingDays} 天后 · ${time(profile.credential_expires_at)}`;
  };
  const leaseExpired = (profile) =>
    Boolean(
      profile.lease &&
      observedAt.value &&
      new Date(profile.lease.expires_at).getTime() <= new Date(observedAt.value).getTime(),
    );
  const rangeLabel = computed(() => {
    if (!pagination.value.total) return "0 条";
    const start = (pagination.value.page - 1) * pagination.value.page_size + 1,
      end = Math.min(pagination.value.page * pagination.value.page_size, pagination.value.total);
    return `${start}–${end} / ${pagination.value.total} 条`;
  });
  onMounted(() => load());
  onBeforeUnmount(() => activeController?.abort());

  return {
    state,
    profiles,
    runs,
    pagination,
    runMetrics,
    requestId,
    message,
    query,
    queryDraft,
    status,
    page,
    observedAt,
    confirming,
    saving,
    refreshing,
    activeLeases,
    expiredLeaseRisks,
    failure,
    syncUrl,
    load,
    applyFilters,
    resetFilters,
    goToPage,
    recover,
    time,
    statusText,
    errorText,
    expiryForecast,
    leaseExpired,
    rangeLabel,
    allowedStatuses,
  };
};
window.RUNTIME_C_FIXTURE = (url) => {
  const profiles = [
    {
      id: "00000000-0000-4000-8000-000000000811",
      code: "market-us",
      name: "US Market Profile",
      provider_id: "00000000-0000-4000-8000-000000000812",
      provider_name: "Market Browser",
      status: "active",
      target_domain: "market.example.test",
      credential_expires_at: "2026-08-10T20:02:00.000Z",
      login_status: "valid",
      last_failure: null,
      lease: {
        run_id: "00000000-0000-4000-8000-000000000821",
        lease_owner: "crawler-s0-01",
        leased_at: "2026-08-07T20:00:00.000Z",
        heartbeat_at: "2026-08-07T20:01:00.000Z",
        expires_at: "2026-08-07T20:02:00.000Z",
      },
    },
    {
      id: "00000000-0000-4000-8000-000000000813",
      code: "supplier-cn",
      name: "Supplier Profile",
      provider_id: "00000000-0000-4000-8000-000000000814",
      provider_name: "Supplier Browser",
      status: "active",
      target_domain: "supplier.example.test",
      credential_expires_at: null,
      login_status: "unknown",
      last_failure: null,
      lease: null,
    },
    {
      id: "00000000-0000-4000-8000-000000000815",
      code: "archive-only",
      name: "Disabled Profile",
      provider_id: "00000000-0000-4000-8000-000000000816",
      provider_name: "Archived Source",
      status: "disabled",
      target_domain: "archive.example.test",
      credential_expires_at: "2026-08-01T00:00:00.000Z",
      login_status: "expired",
      last_failure: null,
      lease: null,
    },
  ];
  const runs = [
    {
      id: "00000000-0000-4000-8000-000000000821",
      organization_id: "00000000-0000-4000-8000-000000000831",
      workspace_id: "00000000-0000-4000-8000-000000000841",
      provider_id: profiles[0].provider_id,
      crawler_profile_id: profiles[0].id,
      status: "running",
      page_count: 2,
      item_count: 18,
      detail_count: 4,
      duration_ms: null,
      error_code: null,
      request_id: "request-running",
      trace_id: "trace-running",
      started_at: "2026-08-07T20:00:00.000Z",
      finished_at: null,
    },
    {
      id: "00000000-0000-4000-8000-000000000822",
      organization_id: "00000000-0000-4000-8000-000000000832",
      workspace_id: "00000000-0000-4000-8000-000000000842",
      provider_id: profiles[1].provider_id,
      crawler_profile_id: profiles[1].id,
      status: "succeeded",
      page_count: 3,
      item_count: 42,
      detail_count: 12,
      duration_ms: 8432,
      error_code: null,
      request_id: "request-success",
      trace_id: "trace-success",
      started_at: "2026-08-07T19:45:00.000Z",
      finished_at: "2026-08-07T19:45:08.432Z",
    },
    {
      id: "00000000-0000-4000-8000-000000000823",
      organization_id: "00000000-0000-4000-8000-000000000833",
      workspace_id: "00000000-0000-4000-8000-000000000843",
      provider_id: profiles[0].provider_id,
      crawler_profile_id: profiles[0].id,
      status: "blocked",
      page_count: 1,
      item_count: 0,
      detail_count: 0,
      duration_ms: 913,
      error_code: "blocked_captcha",
      request_id: "request-blocked",
      trace_id: "trace-blocked",
      started_at: "2026-08-07T19:30:00.000Z",
      finished_at: "2026-08-07T19:30:00.913Z",
    },
  ];
  function runtimeSnapshot(url) {
    const params = new URL(url).searchParams,
      selectedStatus = params.get("status"),
      query = (params.get("q") ?? "").toLowerCase(),
      page = Number(params.get("page") ?? "1"),
      filtered = runs.filter(
        (item) =>
          (!selectedStatus || item.status === selectedStatus) &&
          (!query ||
            [item.id, item.error_code, item.request_id, item.trace_id].some((value) =>
              value?.toLowerCase().includes(query),
            )),
      );
    return {
      profiles,
      runs: filtered,
      run_metrics: { total: runs.length, abnormal: 1, duplicate_risk: 0 },
      pagination: {
        page,
        page_size: 25,
        total: filtered.length,
        total_pages: filtered.length ? 1 : 0,
      },
      filters: { status: selectedStatus, query: query || null },
      observed_at: "2026-08-07T20:02:00.000Z",
    };
  }

  return runtimeSnapshot(url);
};
