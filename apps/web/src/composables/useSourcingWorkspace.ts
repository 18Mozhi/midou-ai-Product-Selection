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
  dialog: "search" | "quote" | "purchase" | "delete";
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
    requestId = ref(""),
    dialogFailure = ref<SourcingDialogFailure | null>(null),
    notice = ref(""),
    busy = ref(false),
    showSearch = ref(false),
    query = ref(""),
    deleting = ref<Search | null>(null),
    deleteReason = ref(""),
    dialogGeneration = reactive<Record<SourcingDialogName, number>>({
      search: 0,
      quote: 0,
      purchase: 0,
      delete: 0,
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
    purchaseCandidate = ref<Candidate | null>(null),
    selectedQuotes = ref<string[]>([]),
    form = reactive({
      input_type: "keyword",
      input_ref: "",
    }),
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
    }),
    purchaseForm = reactive({
      quantity: 1,
      reason: "从供应链找货页面创建采购任务",
    });
  let listReadGeneration = 0,
    detailReadGeneration = 0,
    lifecycleGeneration = 0,
    listReadPending = false,
    pageActive = false,
    mounted = false,
    refreshOnActivation = false;
  const missingLabels: Record<string, string> = {
      moq: "最小起订量",
      specification: "规格",
      lead_time_days: "交期",
      location: "所在地",
      confidence_value: "可信度",
      stability_status: "稳定性",
      risk_level: "风险",
    },
    canManage = computed(() => props.capabilities.includes("supplier_quote:manage")),
    canConfirmCost = computed(() => props.capabilities.includes("cost:confirm")),
    canInspectCollection = computed(
      () =>
        props.capabilities.includes("platform:operate") ||
        props.capabilities.includes("platform:superadmin"),
    ),
    candidates = computed(() => selected.value?.candidates ?? []),
    searchName = (item: Search | null | undefined) =>
      item?.display_name || item?.input_ref || "供应商",
    filteredItems = computed(() => {
      const needle = query.value.trim().toLowerCase();
      return needle
        ? items.value.filter((item) =>
            `${searchName(item)} ${item.input_ref} ${item.status}`.toLowerCase().includes(needle),
          )
        : items.value;
    }),
    summary = computed(() => ({
      total: items.value.length,
      running: items.value.filter((item) => ["queued", "running"].includes(item.status)).length,
      candidates: items.value.reduce((sum, item) => sum + item.candidate_count, 0),
      ready: items.value.filter((item) => item.candidate_count > 0).length,
    })),
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
    journeyStage = computed(() => {
      if (!selected.value || !candidates.value.length) return 1;
      if (!candidates.value.some((item) => item.quote)) return 2;
      return 3;
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
      ({ keyword: "关键词", image: "图片", opportunity: "选品机会", product_url: "商品链接" })[
        value
      ] ?? "其他输入",
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
    statusText = (value: string) =>
      ({
        queued: "等待采集",
        running: "采集中",
        completed: "已完成",
        completed_with_warnings: "已完成但有缺失",
        ready: "可确认",
        incomplete: "待补齐",
        failed: "采集失败",
        succeeded_empty: "未找到可用候选",
      })[value] ?? value,
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
  async function load() {
    if (!pageActive) return;
    const generation = ++listReadGeneration,
      lifecycle = lifecycleGeneration,
      detailGenerationAtStart = detailReadGeneration;
    listReadPending = true;
    state.value = "loading";
    notice.value = "";
    selectedQuotes.value = [];
    try {
      const response = await request<Search[]>("/sourcing/searches");
      if (!ownsListRead(generation, lifecycle)) return;
      requestId.value = response.request_id;
      items.value = response.data;
      state.value = items.value.length ? "ready" : "empty";
      void loadComparisons();
      if (detailReadGeneration !== detailGenerationAtStart) {
        if (!items.value.some((item) => item.id === selected.value?.id)) selected.value = null;
        return;
      }
      const requestedRecord = typeof route.query.record === "string" ? route.query.record : "";
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
          route.query.record !== selectedId
        )
          await router.replace({ query: { ...route.query, record: selectedId } });
      }
    } catch (error) {
      if (!ownsListRead(generation, lifecycle)) return;
      if (error instanceof ApiClientError) {
        requestId.value = error.requestId;
        notice.value = error.actionHint;
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
    const generation = ++detailReadGeneration,
      lifecycle = lifecycleGeneration;
    if (selected.value?.id !== item.id) selectedQuotes.value = [];
    selected.value = item;
    try {
      const response = await request<Search>(`/sourcing/searches/${item.id}`);
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
    }
  }
  function ownsDetailRead(generation: number, lifecycle: number) {
    return pageActive && lifecycle === lifecycleGeneration && generation === detailReadGeneration;
  }
  function invalidatePageReads() {
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
  async function create() {
    if (busy.value) return;
    const attempt = startDialogAttempt("search"),
      routeAtSubmit = route.fullPath;
    if (await post("/sourcing/searches", form, attempt)) {
      if (!isCurrentDialogAttempt(attempt) || route.fullPath !== routeAtSubmit) {
        notice.value = "先前的找货请求已排队；当前打开的窗口与页面选择保持不变。";
        return;
      }
      closeSearch();
      await load();
      notice.value = "公开供应商网页采集已排队，候选与原始证据会自动回填。";
    } else if (!isCurrentDialogAttempt(attempt)) {
      notice.value = "先前的找货请求未完成；当前打开的窗口与页面选择保持不变。";
    }
  }
  function openSearch() {
    if (!canManage.value) return;
    dialogGeneration.search += 1;
    if (dialogFailure.value?.dialog === "search") dialogFailure.value = null;
    showSearch.value = true;
    void router.replace({ query: { ...route.query, create: "1" } });
  }
  function closeSearch() {
    dialogGeneration.search += 1;
    showSearch.value = false;
    if (dialogFailure.value?.dialog === "search") dialogFailure.value = null;
    void router.replace({ query: { ...route.query, create: undefined } });
  }
  function closeQuote() {
    dialogGeneration.quote += 1;
    quoteCandidate.value = null;
    if (dialogFailure.value?.dialog === "quote") dialogFailure.value = null;
  }
  function closePurchase() {
    dialogGeneration.purchase += 1;
    purchaseCandidate.value = null;
    if (dialogFailure.value?.dialog === "purchase") dialogFailure.value = null;
  }
  function openDelete() {
    dialogGeneration.delete += 1;
    if (dialogFailure.value?.dialog === "delete") dialogFailure.value = null;
    deleting.value = selected.value;
  }
  function closeDelete() {
    dialogGeneration.delete += 1;
    deleting.value = null;
    if (dialogFailure.value?.dialog === "delete") dialogFailure.value = null;
  }
  function resetQuery() {
    query.value = "";
  }
  function handleStatePrimary() {
    if (state.value === "empty" && canManage.value) openSearch();
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
  function openPurchase(candidate: Candidate) {
    if (!candidate.quote) return;
    dialogGeneration.purchase += 1;
    if (dialogFailure.value?.dialog === "purchase") dialogFailure.value = null;
    purchaseCandidate.value = candidate;
    purchaseForm.quantity = candidate.moq ?? 1;
    purchaseForm.reason = "从供应链找货页面创建采购任务";
  }
  async function purchase() {
    const candidate = purchaseCandidate.value;
    if (!candidate?.quote || busy.value) return;
    const attempt = startDialogAttempt("purchase"),
      candidateId = candidate.id,
      routeAtSubmit = route.fullPath;
    if (
      await post(
        "/sourcing/purchase-tasks",
        {
          quote_id: candidate.quote.id,
          quantity: Number(purchaseForm.quantity),
          reason: purchaseForm.reason.trim(),
        },
        attempt,
      )
    ) {
      if (
        !isCurrentDialogAttempt(attempt) ||
        route.fullPath !== routeAtSubmit ||
        purchaseCandidate.value?.id !== candidateId
      ) {
        notice.value = "先前的采购任务已排队；当前打开的窗口与页面选择保持不变。";
        return;
      }
      purchaseCandidate.value = null;
      notice.value = "采购任务已进入任务中心待消费队列。";
    } else if (!isCurrentDialogAttempt(attempt)) {
      notice.value = "先前的采购任务未完成；当前打开的窗口与页面选择保持不变。";
    }
  }
  async function refreshSearch() {
    if (!selected.value || busy.value) return;
    const searchIdAtSubmit = selected.value.id,
      routeGenerationAtSubmit = routeGeneration.value,
      result = await post(`/sourcing/searches/${searchIdAtSubmit}/refresh`, {});
    if (result) {
      if (
        routeGeneration.value !== routeGenerationAtSubmit ||
        selected.value?.id !== searchIdAtSubmit
      ) {
        notice.value = `先前记录的重新采集已排队，任务编号 ${result.task_id}；当前页面选择保持不变。`;
        return;
      }
      await load();
      notice.value = `重新采集已排队，任务编号 ${result.task_id}。`;
    }
  }
  async function removeSearch() {
    if (!deleting.value || !deleteReason.value.trim() || busy.value) return;
    const attempt = startDialogAttempt("delete"),
      deletedSearchId = deleting.value.id,
      routeAtSubmit = route.fullPath;
    busy.value = true;
    dialogFailure.value = null;
    try {
      const response = await request(`/sourcing/searches/${deleting.value.id}`, {
        method: "DELETE",
        body: { reason: deleteReason.value.trim() },
      });
      requestId.value = response.request_id;
      if (
        isCurrentDialogAttempt(attempt) &&
        route.fullPath === routeAtSubmit &&
        deleting.value?.id === deletedSearchId &&
        selected.value?.id === deletedSearchId
      ) {
        closeDelete();
        selected.value = null;
        deleteReason.value = "";
        await load();
        notice.value = "找货记录已删除，候选证据与审计仍保留。";
      } else {
        notice.value = "先前的找货记录删除已完成；当前打开的窗口与页面选择保持不变。";
      }
    } catch (error) {
      if (error instanceof ApiClientError) {
        requestId.value = error.requestId;
        notice.value = error.actionHint;
        if (isCurrentDialogAttempt(attempt))
          dialogFailure.value = {
            dialog: "delete",
            message: error.actionHint,
            requestId: error.requestId,
          };
      } else {
        notice.value = "依赖暂不可用，删除未完成。";
        if (isCurrentDialogAttempt(attempt))
          dialogFailure.value = {
            dialog: "delete",
            message: "依赖暂不可用，删除未完成。",
            requestId: "",
          };
      }
    } finally {
      busy.value = false;
    }
  }
  onMounted(() => {
    mounted = true;
    pageActive = true;
    showSearch.value = route.query.create === "1";
    query.value = typeof route.query.q === "string" ? route.query.q : "";
    const opportunityId =
      typeof route.query.opportunity_id === "string" ? route.query.opportunity_id : "";
    if (opportunityId) {
      form.input_type = "opportunity";
      form.input_ref = opportunityId;
    }
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
    () => route.query.record,
    (value) => {
      if (!pageActive || listReadPending) return;
      const requestedRecord = typeof value === "string" ? value : "",
        next =
          items.value.find((item) => item.id === requestedRecord) ??
          (!requestedRecord ? items.value[0] : null);
      if (next?.id === selected.value?.id) return;
      if (next) void detail(next, !requestedRecord);
      else if (requestedRecord) void load();
      else selected.value = null;
    },
    { flush: "sync" },
  );
  watch(query, (value) => {
    void router.replace({ query: { ...route.query, q: value || undefined, create: undefined } });
  });
  watch(
    () => route.query.create,
    (value) => {
      showSearch.value = value === "1" && canManage.value;
    },
  );

  return {
    route,
    state,
    items,
    selected,
    requestId,
    dialogFailure,
    notice,
    busy,
    showSearch,
    query,
    deleting,
    deleteReason,
    comparisons,
    comparisonFailure,
    comparisonLoading,
    loadComparisons,
    quoteCandidate,
    purchaseCandidate,
    selectedQuotes,
    form,
    quote,
    purchaseForm,
    canManage,
    canConfirmCost,
    canInspectCollection,
    candidates,
    searchName,
    filteredItems,
    summary,
    missingText,
    evidenceOptions,
    journeyStage,
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
    create,
    openSearch,
    closeSearch,
    closeQuote,
    closePurchase,
    openDelete,
    closeDelete,
    resetQuery,
    handleStatePrimary,
    handleStateSecondary,
    confirm,
    choose,
    openQuote,
    compare,
    openPurchase,
    purchase,
    refreshSearch,
    removeSearch,
  };
}
