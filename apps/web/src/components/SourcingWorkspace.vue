<script setup lang="ts">
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
import SourcingComparisonPanel from "./SourcingComparisonPanel.vue";
import SourcingCostConfirmationPanel from "./SourcingCostConfirmationPanel.vue";
import SourcingWorkspaceDialogs from "./SourcingWorkspaceDialogs.vue";
import UiStatePanel from "./UiStatePanel.vue";
import type {
  SourcingCandidate as Candidate,
  SourcingComparison,
  SourcingSearch as Search,
  SourcingState as State,
} from "./sourcing-workspace-types";
import "../sourcing.css";
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
const props = withDefaults(defineProps<{ apiBaseUrl: string; capabilities?: string[] }>(), {
    capabilities: () => [],
  }),
  route = useRoute(),
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
    ({ low: "低", medium: "中", high: "高", unknown: "待确认" })[value ?? ""] ?? (value || "缺失"),
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
</script>
<template>
  <section class="sourcing-workspace sourcing-workspace--review">
    <section class="member-module-guide">
      <div>
        <p>供应链与利润怎么用</p>
        <h3>从机会或商品出发，查找真实货源并比较到岸利润</h3>
        <span
          >先发起货源搜索，再确认供应商报价；系统最多并排比较五家，并明确标出缺少运费、税费或平台费的项目。</span
        >
      </div>
      <ol>
        <li>输入关键词、图片或商品链接</li>
        <li>爬取货源候选</li>
        <li>确认报价与起订量</li>
        <li>补齐费用后比较利润</li>
      </ol>
    </section>
    <nav class="sourcing-tabs">
      <RouterLink to="/sourcing" aria-current="page">供应商找货</RouterLink
      ><RouterLink to="/sourcing/cost-rules">费用与利润规则</RouterLink>
    </nav>
    <ol class="sourcing-journey" aria-label="找货流程">
      <li :aria-current="journeyStage === 1 ? 'step' : undefined">1 搜索货源</li>
      <li :aria-current="journeyStage === 2 ? 'step' : undefined">2 确认报价</li>
      <li :aria-current="journeyStage === 3 ? 'step' : undefined">3 对比供应商</li>
      <li>4 创建采购任务</li>
    </ol>
    <header class="sourcing-head">
      <div>
        <p>供应商发现</p>
        <h1 id="sourcing-page-title" tabindex="-1">供应链找货</h1>
        <span>采集事实先投影为候选；缺失规格、交期、地点、可信度与风险时禁止进入可靠对比。</span>
      </div>
      <button v-if="canManage" type="button" @click="openSearch">发起供应商找货</button>
    </header>
    <p v-if="notice" class="sourcing-notice">
      {{ notice }} <code v-if="requestId">{{ requestId }}</code>
    </p>
    <section class="sourcing-summary" aria-label="供应链找货数据总览">
      <article>
        <span>找货任务</span><b>{{ summary.total }}</b>
      </article>
      <article>
        <span>采集中</span><b>{{ summary.running }}</b>
      </article>
      <article>
        <span>真实候选</span><b>{{ summary.candidates }}</b>
      </article>
      <article>
        <span>已有结果</span><b>{{ summary.ready }}</b>
      </article>
    </section>
    <div class="sourcing-toolbar">
      <label
        >搜索找货记录<input
          v-model="query"
          type="search"
          placeholder="关键词、机会编号或状态" /></label
      ><span>共 {{ filteredItems.length }} 条结果</span>
    </div>
    <UiStatePanel
      v-if="state !== 'ready'"
      :kind="state"
      :request-id="requestId"
      :action-hint="notice"
      :primary-label="state === 'empty' && !canManage ? '重新加载' : ''"
      @primary="handleStatePrimary"
      @secondary="handleStateSecondary"
    />
    <UiStatePanel
      v-else-if="!filteredItems.length"
      kind="empty"
      title="没有匹配的找货记录"
      description="当前搜索条件没有命中记录；清空搜索后可继续查看原有找货结果。"
      primary-label="清空搜索"
      :secondary-label="canManage ? '发起新找货' : '重新加载'"
      @primary="resetQuery"
      @secondary="canManage ? openSearch() : load()"
    />
    <div v-else class="sourcing-layout">
      <aside>
        <button
          v-for="item in filteredItems"
          :key="item.id"
          :class="{ selected: selected?.id === item.id }"
          @click="detail(item)"
        >
          <b>{{ searchName(item) }}</b
          ><small>{{ inputTypeText(item.input_type) }} · {{ statusText(item.status) }}</small
          ><em>{{ item.candidate_count }} 个候选</em><strong>查看详情 →</strong>
        </button>
      </aside>
      <section v-if="selected" class="sourcing-detail" aria-label="找货记录详情">
        <header>
          <div>
            <p>{{ inputTypeText(selected.input_type) }}</p>
            <h3>{{ searchName(selected) }}</h3>
            <code v-if="selected.input_type === 'opportunity'"
              >机会编号 {{ selected.input_ref }}</code
            >
          </div>
          <div class="sourcing-actions">
            <template v-if="canManage">
              <button type="button" :disabled="busy" @click="refreshSearch">
                重新采集
              </button></template
            ><RouterLink
              class="sourcing-cost-link"
              :to="{ path: '/sourcing/cost-rules', query: { from: route.fullPath } }"
              >费用与利润规则</RouterLink
            ><button v-if="canManage" type="button" class="danger ghost" @click="openDelete">
              删除找货记录
            </button>
          </div>
        </header>
        <p v-if="selected.missing_fields.length" class="missing">
          当前候选仍缺：{{ missingText }}。必须人工带证据确认。
        </p>
        <SourcingCostConfirmationPanel
          v-if="selected.input_type === 'opportunity'"
          :api-base-url="apiBaseUrl"
          :opportunity-id="selected.input_ref"
          :can-confirm-cost="canConfirmCost"
        />
        <section v-if="selected.collection_progress" class="sourcing-progress">
          <header>
            <div>
              <small>完整采集进度</small>
              <h4>{{ statusText(selected.collection_progress.status) }}</h4>
            </div>
            <strong
              >{{
                selected.collection_progress.successful_subqueries +
                selected.collection_progress.failed_subqueries +
                selected.collection_progress.blocked_subqueries
              }}
              / {{ selected.collection_progress.total_subqueries }} 个来源已结束</strong
            >
          </header>
          <progress
            :value="
              selected.collection_progress.successful_subqueries +
              selected.collection_progress.failed_subqueries +
              selected.collection_progress.blocked_subqueries
            "
            :max="Math.max(1, selected.collection_progress.total_subqueries)"
          ></progress>
          <dl>
            <div>
              <dt>成功</dt>
              <dd>{{ selected.collection_progress.successful_subqueries }}</dd>
            </div>
            <div>
              <dt>执行中 / 等待</dt>
              <dd>{{ selected.collection_progress.active_subqueries }}</dd>
            </div>
            <div>
              <dt>失败</dt>
              <dd>{{ selected.collection_progress.failed_subqueries }}</dd>
            </div>
            <div>
              <dt>受阻</dt>
              <dd>{{ selected.collection_progress.blocked_subqueries }}</dd>
            </div>
          </dl>
          <RouterLink
            v-if="canInspectCollection"
            :to="`/platform-admin/collection?task=${selected.collection_task_id}`"
            >查看采集任务明细</RouterLink
          >
        </section>
        <section v-if="selected.erp_reference" class="sourcing-erp-reference">
          <img
            v-if="selected.erp_reference.image_url"
            :src="selected.erp_reference.image_url"
            :alt="selected.erp_reference.title"
          />
          <div>
            <small>ERP 货源线索 · 不是已确认报价</small>
            <h4>{{ selected.erp_reference.title }}</h4>
            <p>供应商编码：{{ selected.erp_reference.supplier_code ?? "ERP 未提供" }}</p>
            <p>ERP 历史参考成本：{{ erpCosts.length ? erpCosts.join(" / ") : "未提供" }}</p>
            <span
              >仍需爬取供应商商品页、最小起订量、规格、交期与所在地后，才能形成可比较报价。</span
            >
            <footer>
              <a :href="selected.erp_reference.source_url" target="_blank" rel="noopener noreferrer"
                >打开 ERP 商品列表 ↗</a
              ><code>证据 {{ selected.erp_reference.evidence_id }}</code>
            </footer>
          </div>
        </section>
        <section v-if="!candidates.length" class="sourcing-pending">
          <strong>找货任务已经建立，尚未取得真实供应商报价</strong>
          <p>
            任务已经提交到公开供应商网页爬虫。系统不会虚构供应商、起订量或报价；可以点击“重新采集”，任务结束后真实候选会自动显示在这里。
          </p>
          <span v-if="selected.missing_fields.length">待补齐：{{ missingText }}</span>
        </section>
        <section class="supplier-cards">
          <article v-for="item in candidates" :key="item.id" :data-ready="item.status === 'ready'">
            <header>
              <label v-if="canManage && item.quote"
                ><input
                  type="checkbox"
                  :checked="selectedQuotes.includes(item.quote.id)"
                  @change="choose(item, $event)"
                />加入对比</label
              ><b>{{ item.supplier_name }}</b
              ><span>{{ statusText(item.status) }}</span>
            </header>
            <h4>{{ item.product_title }}</h4>
            <dl>
              <div data-priority="primary">
                <dt>报价</dt>
                <dd>{{ item.currency }} {{ item.quoted_price }}</dd>
              </div>
              <div data-priority="primary">
                <dt>最小起订量（MOQ）</dt>
                <dd>{{ item.moq ?? "待确认" }}</dd>
              </div>
              <div data-priority="primary">
                <dt>报价新鲜度</dt>
                <dd>{{ timeText(item.quote?.observed_at ?? item.observed_at) }}</dd>
              </div>
              <div data-priority="primary">
                <dt>到岸价</dt>
                <dd>待费用规则计算</dd>
              </div>
              <div data-priority="primary">
                <dt>交期</dt>
                <dd>{{ item.lead_time_days == null ? "待确认" : `${item.lead_time_days} 天` }}</dd>
              </div>
              <div>
                <dt>规格</dt>
                <dd>{{ item.specification ?? "缺失" }}</dd>
              </div>
              <div>
                <dt>所在地</dt>
                <dd>{{ item.location ?? "缺失" }}</dd>
              </div>
              <div>
                <dt>稳定性 / 风险</dt>
                <dd>
                  {{ stabilityText(item.quote?.stability_status) }} /
                  {{ riskText(item.quote?.risk_level) }}
                </dd>
              </div>
            </dl>
            <ul v-if="item.missing_fields.length" class="supplier-missing-actions">
              <li v-for="field in candidateMissingText(item)" :key="field">
                {{ field }}：确认报价时补齐
              </li>
            </ul>
            <footer>
              <a :href="item.original_url" target="_blank" rel="noopener noreferrer"
                >打开外部原始商品页（新窗口）</a
              ><time>采集于 {{ timeText(item.observed_at) }}</time
              ><code>证据 {{ item.evidence_id }}</code
              ><button v-if="canManage && !item.quote" type="button" @click="openQuote(item)">
                确认报价</button
              ><button v-else-if="canManage" type="button" @click="openPurchase(item)">
                创建采购任务
              </button>
            </footer>
          </article>
        </section>
        <SourcingComparisonPanel
          :comparisons="comparisons"
          :failure="comparisonFailure"
          :loading="comparisonLoading"
          @retry="loadComparisons"
        />
      </section>
    </div>
    <aside
      v-if="canManage && selectedQuotes.length"
      class="sourcing-compare-tray"
      aria-live="polite"
    >
      <strong>已选 {{ selectedQuotes.length }} / 5 家供应商</strong>
      <span>{{ selectedQuotes.length < 2 ? "至少再选一家才能对比" : "可以保存本次报价对比" }}</span>
      <button type="button" :disabled="selectedQuotes.length < 2 || busy" @click="compare">
        保存报价对比
      </button>
    </aside>
    <SourcingWorkspaceDialogs
      v-if="canManage"
      :show-search="showSearch"
      :search-form="form"
      :quote-candidate="quoteCandidate"
      :quote="quote"
      :evidence-options="evidenceOptions"
      :purchase-candidate="purchaseCandidate"
      :purchase-form="purchaseForm"
      :deleting="deleting"
      :delete-reason="deleteReason"
      :busy="busy"
      :failure="dialogFailure"
      @close-search="closeSearch"
      @create="create"
      @close-quote="closeQuote"
      @confirm-quote="confirm"
      @close-purchase="closePurchase"
      @purchase="purchase"
      @close-delete="closeDelete"
      @remove-search="removeSearch"
      @update-delete-reason="deleteReason = $event"
    />
  </section>
</template>
