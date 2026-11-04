import type { SourcingListPageMeta, SourcingListSummary } from "@scoutops/contracts";
import { sourcingRecordStatusText } from "../components/sourcing-record-status";
import {
  computed,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { ApiClientError, createApiClient, type ApiFailureKind } from "../api-client";
import { useSourcingComparisons } from "../composables/useSourcingComparisons";
import type {
  SourcingCandidate as Candidate,
  SourcingComparison,
  SourcingSearch as Search,
  SourcingState as State,
} from "../components/sourcing-workspace-types";
type SourcingDialogFailure = {
  dialog: "quote";
  message: string;
  requestId: string;
};
type SourcingDialogName = SourcingDialogFailure["dialog"];
type SourcingDialogAttempt = {
  dialog: SourcingDialogName;
  generation: number;
  routeGeneration: number;
};
export type SourcingWorkspaceProps = { apiBaseUrl: string; capabilities?: string[] };

export function useSourcingWorkspace(props: SourcingWorkspaceProps & { capabilities: string[] }) {
  const route = useRoute(),
    router = useRouter(),
    request = createApiClient(props.apiBaseUrl),
    state = ref<State>("loading"),
    items = ref<Search[]>([]),
    selected = ref<Search | null>(null),
    detailLoading = ref(false),
    requestId = ref(""),
    dialogFailure = ref<SourcingDialogFailure | null>(null),
    notice = ref(""),
    busy = ref(false),
    query = ref(""),
    serverPaging = ref(true),
    recordPage = ref(1),
    recordTotal = ref(0),
    serverSummary = ref<SourcingListSummary | null>(null),
    dialogGeneration = reactive<Record<SourcingDialogName, number>>({
      quote: 0,
    }),
    routeGeneration = ref(0),
    {
      comparisons,
      comparisonFailure,
      comparisonLoading,
      loadComparisons,
      setActive: setComparisonsActive,
    } = useSourcingComparisons(request),
    quoteCandidate = ref<Candidate | null>(null),
    selectedQuotes = ref<string[]>([]),
    quote = reactive({
      moq: 1,
      specification: "",
      lead_time_days: 7,
      location: "",
      confidence_value: 80,
      stability_status: "unknown",
      risk_level: "unknown",
      observed_at: new Date().toISOString().slice(0, 16),
      evidence_id: "",
    });
  let listReadGeneration = 0,
    detailReadGeneration = 0,
    lifecycleGeneration = 0,
    listReadPending = false,
    pageActive = false,
    mounted = false,
    refreshOnActivation = false;
  let listReadController: AbortController | null = null,
    detailReadController: AbortController | null = null;
  let syncingListRoute = false;
  let listTargetRecord: string | undefined;
  let queryTimer: ReturnType<typeof setTimeout> | null = null;
  const recordPageSize = 20;
  const missingLabels: Record<string, string> = {
      supplier_listing: "供应商商品资料",
      moq: "最小起订量",
      specification: "规格",
      lead_time_days: "交期",
      location: "所在地",
      confidence_value: "可信度",
      stability_status: "稳定性",
      risk_level: "风险",
    },
    canManage = computed(() => props.capabilities.includes("supplier_quote:manage")),
    canInspectCollection = computed(
      () =>
        props.capabilities.includes("platform:operate") ||
        props.capabilities.includes("platform:superadmin"),
    ),
    candidates = computed(() => selected.value?.candidates ?? []),
    searchName = (item: Search | null | undefined) =>
      item?.display_name || item?.input_ref || "供应商",
    filteredItems = computed(() => {
      if (serverPaging.value) return items.value;
      const needle = query.value.trim().toLowerCase();
      return needle
        ? items.value.filter((item) =>
            `${searchName(item)} ${item.input_ref} ${item.status}`.toLowerCase().includes(needle),
          )
        : items.value;
    }),
    summary = computed(
      () =>
        serverSummary.value ?? {
          total: items.value.length,
          running: items.value.filter((item) => ["queued", "running"].includes(item.status)).length,
          candidates: items.value.reduce((sum, item) => sum + item.candidate_count, 0),
          ready: items.value.filter((item) => item.candidate_count > 0).length,
        },
    ),
    missingText = computed(() =>
      (selected.value?.missing_fields ?? []).map((x) => missingLabels[x] ?? x).join("、"),
    ),
    evidenceOptions = computed(() => {
      const options = candidates.value.map((candidate) => ({
        id: candidate.evidence_id,
        label: `${candidate.supplier_name} · ${candidate.product_title}`,
      }));
      if (selected.value?.erp_reference)
        options.push({
          id: selected.value.erp_reference.evidence_id,
          label: `ERP · ${selected.value.erp_reference.title}`,
        });
      return [...new Map(options.map((option) => [option.id, option])).values()];
    }),
    erpCosts = computed(() => {
      const reference = selected.value?.erp_reference;
      if (!reference) return [];
      return [
        reference.cost_cny == null ? null : `人民币 ${reference.cost_cny}`,
        reference.cost_usd == null ? null : `美元 ${reference.cost_usd}`,
      ].filter((value): value is string => Boolean(value));
    }),
    inputTypeText = (value: string) =>
      ({ keyword: "关键词", image: "图片", opportunity: "选品", product_url: "商品链接" })[value] ??
      "其他输入",
    candidateMissingText = (candidate: Candidate) =>
      candidate.missing_fields.map((field) => missingLabels[field] ?? field),
    timeText = (value: string) =>
      new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(value)),
    localDateTimeInput = (value: string) => {
      const observed = new Date(value);
      return new Date(observed.getTime() - observed.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 16);
    },
    statusText = sourcingRecordStatusText,
    stabilityText = (value: string | undefined) =>
      ({ stable: "稳定", volatile: "波动", unknown: "待确认" })[value ?? ""] ?? (value || "缺失"),
    riskText = (value: string | undefined) =>
      ({ low: "低", medium: "中", high: "高", unknown: "待确认" })[value ?? ""] ??
      (value || "缺失"),
    stateFrom = (kind: ApiFailureKind): State =>
      kind === "expired" || kind === "forbidden"
        ? kind
        : kind === "blocked" || kind === "rate_limited"
          ? "blocked"
          : "error";
  const matchingTotal = computed(() =>
    serverPaging.value ? recordTotal.value : filteredItems.value.length,
  );
  const recordPages = computed(() => Math.max(1, Math.ceil(matchingTotal.value / recordPageSize)));
  const visibleRecords = computed(() =>
    serverPaging.value
      ? items.value
      : filteredItems.value.slice(
          (recordPage.value - 1) * recordPageSize,
          recordPage.value * recordPageSize,
        ),
  );
  async function replaceListRoute(query: Record<string, any>) {
    syncingListRoute = true;
    try {
      await router.replace({ query });
    } finally {
      syncingListRoute = false;
    }
  }
  function changeRecordPage(next: number) {
    const page = Math.max(1, Math.min(next, recordPages.value));
    if (serverPaging.value) {
      void router.push({
        query: {
          ...route.query,
          q: query.value.trim() || undefined,
          page: String(
            query.value.trim() !== (typeof route.query.q === "string" ? route.query.q.trim() : "")
              ? 1
              : page,
          ),
          record: undefined,
          create: undefined,
        },
      });
    } else {
      recordPage.value = page;
      const first = visibleRecords.value[0];
      if (first) void detail(first);
    }
  }
  async function load(locateRecord: unknown = false) {
    if (!pageActive) return;
    listReadController?.abort();
    detailReadController?.abort();
    detailReadGeneration += 1;
    detailLoading.value = false;
    const controller = new AbortController();
    listReadController = controller;
    const generation = ++listReadGeneration,
      lifecycle = lifecycleGeneration,
      detailGenerationAtStart = detailReadGeneration;
    listTargetRecord = typeof route.query.record === "string" ? route.query.record : undefined;
    listReadPending = true;
    state.value = "loading";
    notice.value = "";
    selectedQuotes.value = [];
    try {
      const requestedRecord = typeof route.query.record === "string" ? route.query.record : "";
      const page =
        typeof route.query.page === "string" && /^[1-9][0-9]*$/.test(route.query.page)
          ? Number(route.query.page)
          : 1;
      const q = typeof route.query.q === "string" ? route.query.q.trim() : "";
      const params = new URLSearchParams({ page_size: String(recordPageSize) });
      if (requestedRecord && (!route.query.page || locateRecord === true))
        params.set("record", requestedRecord);
      else params.set("page", String(page));
      if (q) params.set("q", q);
      const response = await request<Search[]>(`/sourcing/searches?${params}`, {
        signal: controller.signal,
      });
      if (!ownsListRead(generation, lifecycle)) return;
      requestId.value = response.request_id;
      const meta = response.meta as SourcingListPageMeta | undefined;
      if (
        meta &&
        (!Number.isSafeInteger(meta.page) ||
          meta.page < 1 ||
          meta.page_size !== recordPageSize ||
          !Number.isSafeInteger(meta.total) ||
          meta.total < 0 ||
          !meta.summary)
      )
        throw new Error("invalid_sourcing_page_meta");
      serverPaging.value = Boolean(meta);
      serverSummary.value = meta?.summary ?? null;
      recordTotal.value = meta?.total ?? response.data.length;
      recordPage.value = meta?.page ?? page;
      items.value = response.data;
      state.value = items.value.length ? "ready" : "empty";
      void loadComparisons();
      if (meta && !items.value.length && route.query.page !== String(meta.page))
        await replaceListRoute({
          ...route.query,
          page: String(meta.page),
          record: undefined,
          create: undefined,
        });
      if (detailReadGeneration !== detailGenerationAtStart) {
        if (!items.value.some((item) => item.id === selected.value?.id)) selected.value = null;
        return;
      }
      selected.value =
        items.value.find((x) => x.id === requestedRecord) ??
        items.value.find((x) => x.id === selected.value?.id) ??
        items.value[0] ??
        null;
      if (selected.value) {
        const selectedId = selected.value.id;
        await detail(selected.value, false);
        if (
          ownsListRead(generation, lifecycle) &&
          selected.value?.id === selectedId &&
          (route.query.record !== selectedId ||
            (serverPaging.value && route.query.page !== String(recordPage.value)))
        )
          await replaceListRoute({
            ...route.query,
            record: selectedId,
            page: serverPaging.value ? String(recordPage.value) : route.query.page,
            create: undefined,
          });
      }
    } catch (error) {
      if (!ownsListRead(generation, lifecycle)) return;
      if (error instanceof ApiClientError) {
        requestId.value = error.requestId;
        notice.value = error.actionHint;
        if (error.kind === "expired" || error.kind === "forbidden") {
          items.value = [];
          selected.value = null;
          serverSummary.value = null;
          recordTotal.value = 0;
        }
        state.value = stateFrom(error.kind);
      } else state.value = "blocked";
    } finally {
      if (generation === listReadGeneration && lifecycle === lifecycleGeneration)
        listReadPending = false;
    }
  }
  function ownsListRead(generation: number, lifecycle: number) {
    return pageActive && lifecycle === lifecycleGeneration && generation === listReadGeneration;
  }
  async function detail(item: Search, syncRoute = true) {
    if (!pageActive) return;
    if (detailLoading.value && selected.value?.id === item.id) return;
    detailReadController?.abort();
    const controller = new AbortController();
    detailReadController = controller;
    detailLoading.value = true;
    const generation = ++detailReadGeneration,
      lifecycle = lifecycleGeneration;
    if (selected.value?.id !== item.id) selectedQuotes.value = [];
    selected.value = item;
    try {
      const response = await request<Search>(`/sourcing/searches/${item.id}`, {
        signal: controller.signal,
      });
      if (!ownsDetailRead(generation, lifecycle)) return;
      requestId.value = response.request_id;
      selected.value = response.data;
      if (syncRoute && route.query.record !== item.id)
        await router.replace({ query: { ...route.query, record: item.id, create: undefined } });
    } catch (error) {
      if (!ownsDetailRead(generation, lifecycle)) return;
      if (error instanceof ApiClientError) {
        requestId.value = error.requestId;
        notice.value = error.actionHint;
      } else notice.value = "详情暂不可用，列表状态未被覆盖。";
    } finally {
      if (detailReadController === controller) {
        detailReadController = null;
        detailLoading.value = false;
      }
    }
  }
  function ownsDetailRead(generation: number, lifecycle: number) {
    return pageActive && lifecycle === lifecycleGeneration && generation === detailReadGeneration;
  }
  function invalidatePageReads() {
    if (queryTimer) clearTimeout(queryTimer);
    queryTimer = null;
    listReadController?.abort();
    detailReadController?.abort();
    listReadController = detailReadController = null;
    detailLoading.value = false;
    lifecycleGeneration += 1;
    listReadGeneration += 1;
    detailReadGeneration += 1;
    listReadPending = false;
  }
  function isCurrentDialogAttempt(attempt: SourcingDialogAttempt) {
    return (
      dialogGeneration[attempt.dialog] === attempt.generation &&
      routeGeneration.value === attempt.routeGeneration
    );
  }
  function startDialogAttempt(dialog: SourcingDialogName): SourcingDialogAttempt {
    return {
      dialog,
      generation: dialogGeneration[dialog],
      routeGeneration: routeGeneration.value,
    };
  }
  async function post(path: string, body: unknown, attempt?: SourcingDialogAttempt) {
    busy.value = true;
    notice.value = "";
    dialogFailure.value = null;
    try {
      const response = await request<any>(path, { method: "POST", body });
      requestId.value = response.request_id;
      return response.data;
    } catch (error) {
      if (error instanceof ApiClientError) {
        requestId.value = error.requestId;
        notice.value = error.actionHint;
        if (attempt && isCurrentDialogAttempt(attempt))
          dialogFailure.value = {
            dialog: attempt.dialog,
            message: error.actionHint,
            requestId: error.requestId,
          };
      } else {
        notice.value = "依赖暂不可用，未写入状态。";
        if (attempt && isCurrentDialogAttempt(attempt))
          dialogFailure.value = {
            dialog: attempt.dialog,
            message: "依赖暂不可用，未写入状态。",
            requestId: "",
          };
      }
      return null;
    } finally {
      busy.value = false;
    }
  }
  function closeQuote() {
    dialogGeneration.quote += 1;
    quoteCandidate.value = null;
    if (dialogFailure.value?.dialog === "quote") dialogFailure.value = null;
  }
  function resetQuery() {
    query.value = "";
  }
  function handleStatePrimary() {
    if (state.value === "empty" && query.value.trim()) resetQuery();
    else void load();
  }
  function handleStateSecondary() {
    if (state.value === "empty") resetQuery();
    else void load();
  }
  async function confirm() {
    if (!quoteCandidate.value || busy.value) return;
    const attempt = startDialogAttempt("quote"),
      candidateId = quoteCandidate.value.id,
      routeAtSubmit = route.fullPath;
    if (
      await post(
        "/sourcing/quotes",
        {
          candidate_id: quoteCandidate.value.id,
          ...quote,
          observed_at: new Date(quote.observed_at).toISOString(),
        },
        attempt,
      )
    ) {
      if (
        !isCurrentDialogAttempt(attempt) ||
        route.fullPath !== routeAtSubmit ||
        quoteCandidate.value?.id !== candidateId
      ) {
        notice.value = "先前的报价确认已完成；当前打开的窗口与页面选择保持不变。";
        return;
      }
      quoteCandidate.value = null;
      await load();
      notice.value = "报价已按新版本确认，原始候选和证据未改写。";
    } else if (!isCurrentDialogAttempt(attempt)) {
      notice.value = "先前的报价确认未完成；当前打开的窗口与页面选择保持不变。";
    }
  }
  function choose(candidate: Candidate, event: Event) {
    if (!candidate.quote) return;
    const id = candidate.quote.id,
      index = selectedQuotes.value.indexOf(id);
    if (index >= 0) selectedQuotes.value.splice(index, 1);
    else if (selectedQuotes.value.length < 5) selectedQuotes.value.push(id);
    else notice.value = "一次最多比较五家供应商。";
    const checkbox = event.target;
    if (checkbox instanceof HTMLInputElement) checkbox.checked = selectedQuotes.value.includes(id);
  }
  function openQuote(candidate: Candidate) {
    dialogGeneration.quote += 1;
    if (dialogFailure.value?.dialog === "quote") dialogFailure.value = null;
    quoteCandidate.value = candidate;
    quote.moq = candidate.moq ?? 1;
    quote.specification = candidate.specification ?? "";
    quote.lead_time_days = candidate.lead_time_days ?? 7;
    quote.location = candidate.location ?? "";
    quote.confidence_value = candidate.confidence_value ?? 80;
    quote.stability_status = candidate.quote?.stability_status ?? "unknown";
    quote.risk_level = candidate.quote?.risk_level ?? "unknown";
    quote.observed_at = localDateTimeInput(candidate.observed_at);
    quote.evidence_id = candidate.evidence_id;
  }
  async function compare() {
    if (busy.value) return;
    const selectedCount = selectedQuotes.value.length;
    const selectedIds = [...selectedQuotes.value],
      searchIdAtSubmit = selected.value?.id,
      routeGenerationAtSubmit = routeGeneration.value;
    if (
      await post("/sourcing/comparisons", {
        name: `${searchName(selected.value)} 报价对比`,
        quote_ids: selectedIds,
      })
    ) {
      if (
        routeGeneration.value !== routeGenerationAtSubmit ||
        selected.value?.id !== searchIdAtSubmit ||
        selectedQuotes.value.join("\u0000") !== selectedIds.join("\u0000")
      ) {
        notice.value = `已保存 ${selectedCount} 家报价对比；当前页面选择保持不变。`;
        return;
      }
      selectedQuotes.value = [];
      await load();
      notice.value = `已保存 ${selectedCount} 家报价对比。`;
    }
  }
  onMounted(() => {
    mounted = true;
    pageActive = true;
    query.value = typeof route.query.q === "string" ? route.query.q : "";
    void load();
  });
  onActivated(() => {
    if (!mounted || !refreshOnActivation) return;
    refreshOnActivation = false;
    pageActive = true;
    setComparisonsActive(true);
    void load();
  });
  onDeactivated(() => {
    pageActive = false;
    refreshOnActivation = true;
    invalidatePageReads();
    setComparisonsActive(false);
  });
  onBeforeUnmount(() => {
    mounted = false;
    pageActive = false;
    refreshOnActivation = false;
    invalidatePageReads();
    setComparisonsActive(false);
  });
  watch(
    () => route.fullPath,
    () => {
      routeGeneration.value += 1;
    },
  );
  watch(
    () => [route.query.page, route.query.q],
    () => {
      if (!pageActive || route.path !== "/sourcing" || syncingListRoute) return;
      if (queryTimer) clearTimeout(queryTimer);
      queryTimer = null;
      query.value = typeof route.query.q === "string" ? route.query.q : "";
      if (serverPaging.value) void load();
    },
    { flush: "sync" },
  );
  watch(
    () => route.query.record,
    (value) => {
      if (!pageActive || syncingListRoute) return;
      const requestedRecord = typeof value === "string" ? value : "",
        next =
          items.value.find((item) => item.id === requestedRecord) ??
          (!requestedRecord ? items.value[0] : null);
      if (listReadPending) {
        if (
          (requestedRecord || undefined) !== listTargetRecord &&
          requestedRecord !== selected.value?.id
        )
          void load(true);
        return;
      }
      if (next?.id === selected.value?.id) return;
      if (next) void detail(next, !requestedRecord);
      else if (requestedRecord) void load(true);
      else selected.value = null;
    },
    { flush: "sync" },
  );
  watch(query, (value) => {
    if (
      !pageActive ||
      route.path !== "/sourcing" ||
      syncingListRoute ||
      value.trim() === (typeof route.query.q === "string" ? route.query.q.trim() : "")
    )
      return;
    if (queryTimer) clearTimeout(queryTimer);
    if (!serverPaging.value) {
      void replaceListRoute({ ...route.query, q: value || undefined, create: undefined });
      return;
    }
    invalidatePageReads();
    queryTimer = setTimeout(() => {
      queryTimer = null;
      if (pageActive)
        void router.replace({
          query: {
            ...route.query,
            q: value.trim() || undefined,
            page: "1",
            record: undefined,
            create: undefined,
          },
        });
    }, 300);
  });

  return {
    route,
    state,
    items,
    selected,
    detailLoading,
    requestId,
    dialogFailure,
    notice,
    busy,
    query,
    serverPaging,
    recordPage,
    recordPages,
    visibleRecords,
    matchingTotal,
    changeRecordPage,
    comparisons,
    comparisonFailure,
    comparisonLoading,
    loadComparisons,
    quoteCandidate,
    selectedQuotes,
    quote,
    canManage,
    canInspectCollection,
    candidates,
    searchName,
    filteredItems,
    summary,
    missingText,
    evidenceOptions,
    erpCosts,
    inputTypeText,
    candidateMissingText,
    timeText,
    localDateTimeInput,
    statusText,
    stabilityText,
    riskText,
    load,
    detail,
    closeQuote,
    resetQuery,
    handleStatePrimary,
    handleStateSecondary,
    confirm,
    choose,
    openQuote,
    compare,
  };
}
