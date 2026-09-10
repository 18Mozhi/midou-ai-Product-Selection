window.DATA_RECORDS_SOURCE = (bridge) => {
  const {
    ref,
    computed,
    onMounted,
    onBeforeUnmount,
    useRoute,
    useRouter,
    defineProps,
    createApiClient,
    createApiResponseClient,
    ApiClientError,
    window,
    AbortController,
    URLSearchParams,
    URL,
    document,
  } = bridge;
  function useAuditedReason() {
    const request = ref(null);
    let resolveRequest = null;
    const open = computed(() => request.value !== null);
    function ask(input) {
      if (resolveRequest) resolveRequest(null);
      request.value = {
        title: input.title,
        description: input.description ?? "原因会写入审计记录。",
        initialValue: input.initialValue ?? "",
        minimumLength: input.minimumLength ?? 2,
        ...(input.workspaceRestore ? { workspaceRestore: { ...input.workspaceRestore } } : {}),
      };
      return new Promise((resolve) => {
        resolveRequest = resolve;
      });
    }
    function finish(value) {
      const resolve = resolveRequest;
      resolveRequest = null;
      request.value = null;
      resolve?.(value);
    }
    return {
      request,
      open,
      ask,
      submit: (value) => finish(value),
      cancel: () => finish(null),
    };
  }

  const entityStatuses = {
    trends: ["active", "irrelevant", "stale", "archived"],
    opportunities: ["pending", "adopted", "observing", "rejected"],
    competitors: ["active", "paused"],
    suppliers: ["incomplete", "ready", "quarantined"],
  };
  const statusLabels = {
    trends: { active: "展示中", irrelevant: "无关", stale: "已过期", archived: "已归档" },
    opportunities: {
      pending: "待决策",
      adopted: "已采纳",
      observing: "观察中",
      rejected: "已拒绝",
    },
    competitors: { active: "监控中", paused: "已暂停" },
    suppliers: { incomplete: "信息不完整", ready: "可评估", quarantined: "已隔离" },
  };
  const props = defineProps(),
    request = createApiClient(props.apiBaseUrl),
    requestResponse = createApiResponseClient(props.apiBaseUrl),
    route = useRoute(),
    router = useRouter(),
    queryValue = (name) => {
      const value = route.query[name];
      return typeof value === "string" ? value : "";
    },
    initialEntity = ["trends", "opportunities", "competitors", "suppliers"].includes(
      queryValue("entity"),
    )
      ? queryValue("entity")
      : "trends",
    hasQualityDeepLink = Boolean(
      queryValue("evidence") || queryValue("evidence_id") || queryValue("issue_id"),
    ),
    initialStatus = entityStatuses[initialEntity].includes(queryValue("status"))
      ? queryValue("status")
      : "",
    pageSize = 20,
    tab = ref(queryValue("view") === "quality" || hasQualityDeepLink ? "quality" : "records"),
    entity = ref(initialEntity),
    query = ref(queryValue("q").trim()),
    queryDraft = ref(query.value),
    status = ref(initialStatus),
    statusDraft = ref(initialStatus),
    page = ref(/^\d{1,3}$/.test(queryValue("page")) ? Math.max(1, Number(queryValue("page"))) : 1),
    state = ref("loading"),
    data = ref({ summary: {}, items: [] }),
    snapshotScope = ref(null),
    message = ref(""),
    requestId = ref(""),
    exporting = ref(false),
    refreshing = ref(false);
  let activeController = null;
  const {
    request: exportReasonRequest,
    open: exportReasonOpen,
    ask: askExportReason,
    submit: submitExportReason,
    cancel: cancelExportReason,
  } = useAuditedReason();
  const entities = [
    { value: "trends", label: "热点", primary: "信号", secondary: "来源" },
    { value: "opportunities", label: "机会", primary: "证据", secondary: "来源" },
    { value: "competitors", label: "竞品", primary: "版本", secondary: "变更" },
    {
      value: "suppliers",
      label: "供应商",
      primary: "最小起订量",
      secondary: "报价",
    },
  ];
  const current = computed(() =>
    entities.find((item) => item.value === (snapshotScope.value?.entity ?? entity.value)),
  );
  const scopeMismatch = computed(() =>
    Boolean(
      snapshotScope.value &&
      (snapshotScope.value.entity !== entity.value ||
        snapshotScope.value.query !== query.value ||
        snapshotScope.value.status !== status.value),
    ),
  );
  const snapshotLabel = computed(() =>
    snapshotScope.value
      ? `${current.value.label} · 搜索：${snapshotScope.value.query || "不限"} · 状态：${snapshotScope.value.status ? statusName(snapshotScope.value.status, snapshotScope.value.entity) : "全部"}`
      : "",
  );
  const summary = computed(() => Object.entries(data.value?.summary ?? {}));
  const statusOptions = computed(() => entityStatuses[entity.value]);
  const activeFilterCount = computed(
    () => Number(Boolean(queryDraft.value.trim())) + Number(Boolean(statusDraft.value)),
  );
  const statusName = (value, owner = entity.value) =>
    statusLabels[owner][String(value)] ?? "状态未知";
  const summaryName = (key) =>
    key === "total" ? "当前筛选" : statusName(key, current.value.value);
  const pagination = computed(() => {
      const total = data.value?.items?.length ?? 0,
        totalPages = total ? Math.ceil(total / pageSize) : 0;
      return {
        page: totalPages ? Math.min(page.value, totalPages) : 1,
        page_size: pageSize,
        total,
        total_pages: totalPages,
      };
    }),
    pagedItems = computed(() => {
      const start = (pagination.value.page - 1) * pageSize;
      return (data.value?.items ?? []).slice(start, start + pageSize);
    }),
    rangeLabel = computed(() => {
      if (!pagination.value.total) return "0 条";
      const start = (pagination.value.page - 1) * pageSize + 1,
        end = Math.min(pagination.value.page * pageSize, pagination.value.total);
      return `${start}–${end} / ${pagination.value.total} 条`;
    });
  function failureState(error) {
    return error.kind === "expired" || error.kind === "forbidden"
      ? error.kind
      : error.kind === "blocked" || error.kind === "rate_limited"
        ? "blocked"
        : "error";
  }
  async function syncRecordsUrl() {
    const next = {};
    if (entity.value !== "trends") next.entity = entity.value;
    if (query.value) next.q = query.value;
    if (status.value) next.status = status.value;
    if (page.value > 1) next.page = String(page.value);
    await router.replace({ query: next });
  }
  async function load(options = {}) {
    if (refreshing.value) return;
    const hadData = Boolean(data.value?.items?.length);
    const scope = { entity: entity.value, query: query.value, status: status.value };
    refreshing.value = true;
    if (!hadData) state.value = "loading";
    message.value = "";
    const params = new URLSearchParams({ domain: "data", entity: entity.value });
    if (query.value.trim()) params.set("query", query.value.trim());
    if (status.value) params.set("status", status.value);
    const controller = new AbortController();
    activeController = controller;
    const timer = window.setTimeout(() => controller.abort(), 15_000);
    try {
      if (options.updateUrl !== false) await syncRecordsUrl();
      const response = await request(`/platform/management?${params}`, {
        signal: controller.signal,
      });
      requestId.value = response.request_id;
      data.value = response.data;
      snapshotScope.value = scope;
      const totalPages = Math.max(1, Math.ceil(response.data.items.length / pageSize));
      if (page.value > totalPages) {
        page.value = totalPages;
        if (options.updateUrl !== false) await syncRecordsUrl();
      }
      state.value = response.data.items.length ? "ready" : "empty";
    } catch (error) {
      const failure = error instanceof ApiClientError ? error : null;
      requestId.value = failure?.requestId ?? requestId.value;
      const hint = controller.signal.aborted
        ? "读取超过 15 秒，已安全取消；上一份结果仍保留。"
        : (failure?.actionHint ?? "网络或服务异常，上一份结果仍保留。");
      message.value = hint;
      state.value = hadData ? "ready" : failure ? failureState(failure) : "blocked";
    } finally {
      window.clearTimeout(timer);
      if (activeController === controller) activeController = null;
      refreshing.value = false;
    }
  }
  async function exportCsv() {
    if (exporting.value || exportReasonOpen.value || refreshing.value || scopeMismatch.value)
      return;
    const reason = await askExportReason({
      title: "填写受控导出原因",
      description: "导出原因会与筛选范围、操作者和文件审计记录一起保存。",
      initialValue: "平台运营数据核对",
    });
    if (reason === null) return;
    if (reason.trim().length < 2) {
      message.value = "导出原因至少需要 2 个字。";
      return;
    }
    exporting.value = true;
    try {
      const response = await requestResponse("/platform/management/data/exports", {
        method: "POST",
        headers: { accept: "text/csv" },
        body: {
          entity: entity.value,
          query: query.value.trim(),
          status: status.value,
          reason: reason.trim(),
        },
      });
      requestId.value = response.headers.get("x-request-id") ?? requestId.value;
      const blob = await response.blob(),
        url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = `platform-${entity.value}-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      message.value = "受控表格文件已生成，导出原因和记录数已写入平台审计。";
    } catch (error) {
      const failure = error instanceof ApiClientError ? error : null;
      requestId.value = failure?.requestId ?? requestId.value;
      message.value = failure?.actionHint ?? "受控导出未完成";
    } finally {
      exporting.value = false;
    }
  }
  function selectEntity(value) {
    if (refreshing.value || value === entity.value) return;
    entity.value = value;
    status.value = "";
    statusDraft.value = "";
    page.value = 1;
    void load();
  }
  function applyFilters() {
    if (refreshing.value) return;
    query.value = queryDraft.value.trim();
    status.value = statusDraft.value;
    page.value = 1;
    void load();
  }
  function resetFilters() {
    if (refreshing.value) return;
    query.value = "";
    queryDraft.value = "";
    status.value = "";
    statusDraft.value = "";
    page.value = 1;
    void load();
  }
  function goToPage(nextPage) {
    if (
      refreshing.value ||
      nextPage < 1 ||
      nextPage > pagination.value.total_pages ||
      nextPage === page.value
    )
      return;
    page.value = nextPage;
    void syncRecordsUrl();
  }
  async function selectTab(value) {
    if (value === tab.value) return;
    tab.value = value;
    if (value === "quality") await router.replace({ query: { view: "quality" } });
    else {
      await syncRecordsUrl();
      if (!data.value.items.length) void load({ updateUrl: false });
    }
  }
  onMounted(() => {
    if (tab.value === "records") void load();
  });
  onBeforeUnmount(() => activeController?.abort());

  return {
    entityStatuses,
    statusLabels,
    entities,
    entity,
    query,
    queryDraft,
    status,
    statusDraft,
    page,
    tab,
    state,
    data,
    snapshotScope,
    scopeMismatch,
    snapshotLabel,
    current,
    summary,
    statusOptions,
    activeFilterCount,
    statusName,
    summaryName,
    pagination,
    pagedItems,
    rangeLabel,
    message,
    requestId,
    exporting,
    refreshing,
    exportReasonOpen,
    submitExportReason,
    cancelExportReason,
    exportCsv,
    load,
    applyFilters,
    resetFilters,
    selectEntity,
    selectTab,
    goToPage,
  };
};
window.DATA_RECORDS_FIXTURE = (entity) => {
  const supplier = entity === "suppliers";
  return {
    domain: "data",
    entity,
    summary: { total: 1, [supplier ? "ready" : "active"]: 1 },
    items: [
      {
        id: supplier ? "supplier-54" : "trend-54",
        title: supplier ? "隔离供应商" : "隔离热点",
        organization_name: "测试组织",
        workspace_name: "测试工作区",
        status: supplier ? "ready" : "active",
        metric_primary: 8,
        metric_secondary: 2,
        updated_at: "2026-09-08T00:00:00.000Z",
      },
    ],
    observed_at: "2026-09-08T00:00:00.000Z",
  };
};
