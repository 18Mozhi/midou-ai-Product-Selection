window.DATA_RECORDS_SOURCE = (bridge) => {
  const {
    ref,
    computed,
    onMounted,
    onBeforeUnmount,
    onActivated,
    onDeactivated,
    watch,
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
    qualityVisited = ref(tab.value === "quality"),
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
    exportUnknown = ref(false),
    refreshing = ref(false);
  let activeController = null;
  let readSequence = 0,
    pageActive = true,
    resumeRead = false,
    detachedExport = null;
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
  const operationLocked = computed(
    () => refreshing.value || exporting.value || exportReasonOpen.value,
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
  function readScope() {
    return {
      entity: entity.value,
      query: query.value,
      status: status.value,
      page: page.value,
    };
  }
  function routeScope() {
    const routeEntity = ["trends", "opportunities", "competitors", "suppliers"].includes(
        queryValue("entity"),
      )
        ? queryValue("entity")
        : "trends",
      routeStatus = entityStatuses[routeEntity].includes(queryValue("status"))
        ? queryValue("status")
        : "";
    return {
      entity: routeEntity,
      query: queryValue("q").trim(),
      status: routeStatus,
      page: /^\d{1,3}$/.test(queryValue("page")) ? Math.max(1, Number(queryValue("page"))) : 1,
    };
  }
  function applyRouteScope() {
    const next = routeScope(),
      changed =
        next.entity !== entity.value ||
        next.query !== query.value ||
        next.status !== status.value ||
        next.page !== page.value;
    if (!changed) return false;
    entity.value = next.entity;
    query.value = next.query;
    queryDraft.value = next.query;
    status.value = next.status;
    statusDraft.value = next.status;
    page.value = next.page;
    return true;
  }
  async function syncRecordsUrl(scope = readScope()) {
    const next = {};
    if (scope.entity !== "trends") next.entity = scope.entity;
    if (scope.query) next.q = scope.query;
    if (scope.status) next.status = scope.status;
    if (scope.page > 1) next.page = String(scope.page);
    await router.replace({ query: next });
  }
  async function load(options = {}) {
    if (!pageActive) return;
    const sequence = ++readSequence;
    activeController?.abort("superseded");
    activeController = null;
    const hadData = Boolean(data.value?.items?.length);
    const scope = readScope();
    refreshing.value = true;
    if (!hadData) state.value = "loading";
    message.value = "";
    const params = new URLSearchParams({ domain: "data", entity: scope.entity });
    if (scope.query) params.set("query", scope.query);
    if (scope.status) params.set("status", scope.status);
    const controller = new AbortController();
    activeController = controller;
    const timer = window.setTimeout(() => controller.abort("request_timeout"), 15_000);
    try {
      if (options.updateUrl !== false) await syncRecordsUrl(scope);
      if (sequence !== readSequence || !pageActive) return;
      const response = await request(`/platform/management?${params}`, {
        signal: controller.signal,
      });
      if (sequence !== readSequence || !pageActive) return;
      requestId.value = response.request_id;
      data.value = response.data;
      snapshotScope.value = { entity: scope.entity, query: scope.query, status: scope.status };
      exportUnknown.value = false;
      const totalPages = Math.max(1, Math.ceil(response.data.items.length / pageSize));
      if (scope.page > totalPages) {
        page.value = totalPages;
        if (options.updateUrl !== false) await syncRecordsUrl({ ...scope, page: totalPages });
      }
      state.value = response.data.items.length ? "ready" : "empty";
    } catch (error) {
      if (sequence !== readSequence || !pageActive) return;
      const failure = error instanceof ApiClientError ? error : null;
      requestId.value = failure?.requestId ?? requestId.value;
      const timedOut = controller.signal.aborted && controller.signal.reason === "request_timeout";
      if (controller.signal.aborted && !timedOut) return;
      const hint = timedOut
        ? "读取超过 15 秒，已安全取消；上一份结果仍保留。"
        : (failure?.actionHint ?? "网络或服务异常，上一份结果仍保留。");
      message.value = hint;
      state.value = hadData ? "ready" : failure ? failureState(failure) : "blocked";
    } finally {
      window.clearTimeout(timer);
      if (activeController === controller) activeController = null;
      if (sequence === readSequence) refreshing.value = false;
    }
  }
  function applyExportSettlement(settlement) {
    requestId.value = settlement.requestId;
    if (settlement.kind === "success") {
      exportUnknown.value = false;
      message.value = "受控表格文件已生成，导出原因和记录数已写入平台审计。";
      return;
    }
    exportUnknown.value = settlement.unknown;
    message.value = settlement.message;
  }
  async function exportCsv() {
    if (
      exporting.value ||
      exportReasonOpen.value ||
      refreshing.value ||
      scopeMismatch.value ||
      exportUnknown.value
    )
      return;
    const exportScope = snapshotScope.value
      ? { ...snapshotScope.value }
      : { entity: entity.value, query: query.value, status: status.value };
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
    let settlement;
    try {
      const response = await requestResponse("/platform/management/data/exports", {
        method: "POST",
        headers: { accept: "text/csv" },
        body: {
          entity: exportScope.entity,
          query: exportScope.query,
          status: exportScope.status,
          reason: reason.trim(),
        },
      });
      const responseRequestId = response.headers.get("x-request-id") ?? requestId.value;
      const blob = await response.blob(),
        url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = `platform-${exportScope.entity}-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      settlement = { kind: "success", requestId: responseRequestId };
    } catch (error) {
      const failure = error instanceof ApiClientError ? error : null;
      settlement =
        failure && failure.status > 0
          ? {
              kind: "failure",
              message: failure.actionHint,
              requestId: failure.requestId,
              unknown: false,
            }
          : {
              kind: "failure",
              message:
                "导出结果未知。服务器可能已经生成文件或写入审计；请先核对导出记录，不要重复提交。",
              requestId: failure?.requestId ?? requestId.value,
              unknown: true,
            };
    } finally {
      exporting.value = false;
    }
    if (pageActive) applyExportSettlement(settlement);
    else detachedExport = settlement;
  }
  function selectEntity(value) {
    if (operationLocked.value || value === entity.value) return;
    entity.value = value;
    status.value = "";
    statusDraft.value = "";
    page.value = 1;
    void load();
  }
  function applyFilters() {
    if (operationLocked.value) return;
    query.value = queryDraft.value.trim();
    status.value = statusDraft.value;
    page.value = 1;
    void load();
  }
  function resetFilters() {
    if (operationLocked.value) return;
    query.value = "";
    queryDraft.value = "";
    status.value = "";
    statusDraft.value = "";
    page.value = 1;
    void load();
  }
  function goToPage(nextPage) {
    if (
      operationLocked.value ||
      nextPage < 1 ||
      nextPage > pagination.value.total_pages ||
      nextPage === page.value
    )
      return;
    page.value = nextPage;
    void syncRecordsUrl();
  }
  async function selectTab(value) {
    if (value === tab.value || exporting.value || exportReasonOpen.value) return;
    tab.value = value;
    if (value === "quality") {
      qualityVisited.value = true;
      await router.replace({ query: { view: "quality" } });
    } else {
      await syncRecordsUrl();
      if (!snapshotScope.value) void load({ updateUrl: false });
    }
  }
  onMounted(() => {
    if (tab.value === "records") void load();
  });
  watch(
    () => [
      route.path,
      route.query.view,
      route.query.entity,
      route.query.q,
      route.query.status,
      route.query.page,
      route.query.evidence,
      route.query.evidence_id,
      route.query.issue_id,
    ],
    ([path]) => {
      if (path !== "/platform-admin/data" || !pageActive) return;
      const nextTab =
        queryValue("view") === "quality" ||
        Boolean(queryValue("evidence") || queryValue("evidence_id") || queryValue("issue_id"))
          ? "quality"
          : "records";
      tab.value = nextTab;
      if (nextTab === "quality") {
        qualityVisited.value = true;
        return;
      }
      if (applyRouteScope()) void load({ updateUrl: false });
    },
  );
  function suspendRecords(reason) {
    const interrupted = Boolean(activeController);
    pageActive = false;
    readSequence += 1;
    activeController?.abort(reason);
    activeController = null;
    refreshing.value = false;
    resumeRead ||= reason === "deactivated" && interrupted;
    if (exportReasonOpen.value) cancelExportReason();
  }
  onBeforeUnmount(() => suspendRecords("unmounted"));
  onDeactivated(() => suspendRecords("deactivated"));
  onActivated(() => {
    pageActive = true;
    if (route.path !== "/platform-admin/data") return;
    const routeChanged = tab.value === "records" && applyRouteScope();
    if (detachedExport) {
      applyExportSettlement(detachedExport);
      detachedExport = null;
    }
    if (tab.value === "records" && (routeChanged || resumeRead || !snapshotScope.value))
      void load({ updateUrl: false });
    resumeRead = false;
  });

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
