<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { ApiClientError, createApiClient } from "../api-client";
const ProviderCompatibilityMatrixDialog = defineAsyncComponent(
  () => import("./ProviderCompatibilityMatrixDialog.vue"),
);
const ProviderParserSampleDialog = defineAsyncComponent(
  () => import("./ProviderParserSampleDialog.vue"),
);
const ProviderSourceDirectory = defineAsyncComponent(() => import("./ProviderSourceDirectory.vue"));
const ProviderSourceFilters = defineAsyncComponent(() => import("./ProviderSourceFilters.vue"));
const ProviderSourceConfigurationDialog = defineAsyncComponent(
  () => import("./ProviderSourceConfigurationDialog.vue"),
);
import type {
  ConfigurationVersion,
  ParserSample,
  ParserSampleCandidate,
  ParserSampleReplay,
  ProviderCompatibilitySummary,
  ProviderPageCompatibilityObservation,
  ProviderSourceItem as SourceItem,
  ProviderSourceViewState as ViewState,
} from "./provider-source-types";

const props = defineProps<{ apiBaseUrl: string }>();
const route = useRoute();
const router = useRouter();
const queryParam = (key: string) =>
  typeof route.query[key] === "string" ? route.query[key].toString() : "";
const request = createApiClient(props.apiBaseUrl);
const state = ref<ViewState>("loading");
const items = ref<SourceItem[]>([]);
const query = ref(queryParam("q"));
const category = ref(queryParam("category"));
const availability = ref(queryParam("availability"));
const market = ref(queryParam("market"));
const language = ref(queryParam("language"));
const accessMode = ref(queryParam("access_mode"));
const sort = ref(
  ["business", "attention", "name", "recent"].includes(queryParam("sort"))
    ? queryParam("sort")
    : "business",
);
const initialPage = Number.parseInt(queryParam("page"), 10);
const page = ref(Number.isInteger(initialPage) && initialPage > 0 ? initialPage : 1);
const pageSize = 20;
const refreshing = ref(false);
const refreshFeedback = ref<"idle" | "refreshing" | "success" | "failed">("idle");
const refreshFailureKind = ref<ViewState | null>(null);
const lastUpdatedAt = ref<string | null>(null);
const message = ref("");
const requestId = ref("");
const editing = ref<SourceItem | null>(null);
const saving = ref(false);
type ConfigurationSaveStage =
  | "idle"
  | "saving"
  | "saving_disabled"
  | "smoke_testing"
  | "enabling"
  | "success"
  | "partial"
  | "failed"
  | "conflict";
type ConfigurationReturnState = "idle" | "refreshing" | "success" | "failed";
type ConfigurationReturnOutcome = "saved" | "partial" | "conflict";
const configurationSaveStage = ref<ConfigurationSaveStage>("idle");
const configurationSaveTitle = ref("");
const configurationSaveDescription = ref("");
const configurationSaveRequestId = ref("");
const configurationReturnState = ref<ConfigurationReturnState>("idle");
const configurationReturnOutcome = ref<ConfigurationReturnOutcome>("saved");
const configurationReturnTitle = ref("");
const configurationReturnDescription = ref("");
const configurationReturnRequestId = ref("");
const configurationReturnHeading = ref<HTMLElement | null>(null);
const configurationReturnSourceName = ref("");
let configurationOperation = 0;
let configurationReturnOperation = 0;
let catalogLoadOperation = 0;
const testing = ref<string | null>(null);
const sampleSource = ref<SourceItem | null>(null);
const sampleLoading = ref(false);
const sampleReadLoaded = ref(false);
const sampleReadError = ref("");
const sampleReadRequestId = ref("");
const sampleActionMessage = ref("");
const sampleActionRequestId = ref("");
const sampleSaving = ref<string | null>(null);
const sampleReplaying = ref<string | null>(null);
const sampleReviewing = ref<string | null>(null);
const sampleOverview = reactive<{
  samples: ParserSample[];
  candidates: ParserSampleCandidate[];
}>({ samples: [], candidates: [] });
const latestReplay = ref<ParserSampleReplay | null>(null);
let sampleContextOperation = 0;
let sampleReadOperation = 0;
const versionSource = ref<SourceItem | null>(null);
const versionLoading = ref(false);
const versionHistory = ref<ConfigurationVersion[]>([]);
const versionCurrentVersion = ref<number | null>(null);
const rollingBack = ref<number | null>(null);
type VersionActionStage =
  | "idle"
  | "submitting"
  | "reloading"
  | "success"
  | "sync_failed"
  | "read_failed"
  | "conflict"
  | "forbidden"
  | "failed";
const versionActionStage = ref<VersionActionStage>("idle");
const versionActionTitle = ref("");
const versionActionDescription = ref("");
const versionActionRequestId = ref("");
const versionLastTarget = ref<number | null>(null);
const versionWriteConfirmed = ref(false);
let versionOwnership = 0;
const rollbackReason = ref("恢复已验证的来源采集设置");
const compatibilitySource = ref<SourceItem | null>(null);
const compatibilityLoading = ref(false);
const compatibilityError = ref("");
const compatibilityAdapterVersion = ref<string | null>(null);
const compatibilityRows = ref<ProviderPageCompatibilityObservation[]>([]);
const form = reactive({
  schedule_minutes: 15,
  timeout_ms: 20000,
  retry_limit: 3,
  status: "enabled",
  reason: "调整来源采集配置",
});
const automaticProductSourceCodes = new Set(["amazon_product", "1688_search"]);
const effectiveAvailability = (item: SourceItem): SourceItem["availability"] => {
  if (!automaticProductSourceCodes.has(item.code)) return item.availability;
  return item.provisioned?.status === "enabled" ? "automatic" : "setup_required";
};

const linkedProviderId = computed(() =>
  typeof route.query.provider_id === "string" ? route.query.provider_id : "",
);
const filtered = computed(() =>
  items.value.filter((item) => {
    const term = query.value.trim().toLowerCase();
    return (
      (!linkedProviderId.value || item.provisioned?.id === linkedProviderId.value) &&
      (!term ||
        `${item.name} ${item.code} ${item.markets.join(" ")} ${item.target_url}`
          .toLowerCase()
          .includes(term)) &&
      (!category.value || item.category === category.value) &&
      (!availability.value || effectiveAvailability(item) === availability.value) &&
      (!market.value || item.markets.includes(market.value)) &&
      (!language.value || item.languages.includes(language.value)) &&
      (!accessMode.value || item.access_mode === accessMode.value)
    );
  }),
);
const purposeDefinitions = [
  {
    key: "market_signals",
    label: "市场热点与消费者信号",
    description: "用于发现新闻、搜索趋势和社区讨论。",
  },
  {
    key: "product_competition",
    label: "商品与竞品观察",
    description: "用于观察商品、榜单和电商平台变化。",
  },
  {
    key: "supply_sourcing",
    label: "供应链找货",
    description: "用于查找供应商和货源线索。",
  },
] as const;
type SourcePurpose = (typeof purposeDefinitions)[number]["key"];
const sourcePurpose = (item: SourceItem): SourcePurpose =>
  item.category === "product_supply"
    ? "supply_sourcing"
    : item.category === "ecommerce"
      ? "product_competition"
      : "market_signals";
const availabilityPriority = (item: SourceItem) =>
  effectiveAvailability(item) === "setup_required"
    ? 0
    : effectiveAvailability(item) === "automatic" && item.provisioned?.status !== "enabled"
      ? 1
      : effectiveAvailability(item) === "automatic"
        ? 2
        : 3;
const sorted = computed(() =>
  [...filtered.value].sort((left, right) => {
    if (sort.value === "attention")
      return (
        availabilityPriority(left) - availabilityPriority(right) ||
        left.name.localeCompare(right.name, "zh-CN")
      );
    if (sort.value === "name") return left.name.localeCompare(right.name, "zh-CN");
    if (sort.value === "recent")
      return (
        (right.provisioned?.last_success?.finished_at ?? "").localeCompare(
          left.provisioned?.last_success?.finished_at ?? "",
        ) || left.name.localeCompare(right.name, "zh-CN")
      );
    return 0;
  }),
);
const totalPages = computed(() => Math.max(1, Math.ceil(sorted.value.length / pageSize)));
const pageItems = computed(() =>
  sorted.value.slice((page.value - 1) * pageSize, page.value * pageSize),
);
const groupedSources = computed(() =>
  purposeDefinitions
    .map((definition) => ({
      ...definition,
      items: pageItems.value.filter((item) => sourcePurpose(item) === definition.key),
      total: filtered.value.filter((item) => sourcePurpose(item) === definition.key).length,
    }))
    .filter((group) => group.items.length > 0),
);
const resultRange = computed(() => ({
  start: sorted.value.length ? (page.value - 1) * pageSize + 1 : 0,
  end: Math.min(page.value * pageSize, sorted.value.length),
}));
const counts = computed(() => ({
  all: items.value.length,
  automatic: items.value.filter((item) => effectiveAvailability(item) === "automatic").length,
  nonGoogle: items.value.filter(
    (item) =>
      effectiveAvailability(item) === "automatic" && !item.target_url.includes("news.google.com"),
  ).length,
  markets: new Set(items.value.flatMap((item) => item.markets)).size,
}));
const marketOptions = computed(() =>
  [...new Set(items.value.flatMap((item) => item.markets))].sort(),
);
const languageOptions = computed(() =>
  [...new Set(items.value.flatMap((item) => item.languages))].sort(),
);
const configurationPreview = computed(() => {
  const item = editing.value;
  if (!item?.provisioned) return null;
  const sameIntervalCount = items.value.filter(
    (candidate) =>
      candidate.provisioned?.id !== item.provisioned?.id &&
      candidate.availability === "automatic" &&
      candidate.provisioned?.status === "enabled" &&
      candidate.provisioned.schedule_minutes === form.schedule_minutes,
  ).length;
  const configuredLimit =
      item.provisioned.concurrency_snapshot?.configured_limit ?? item.concurrency_limit,
    activeCount = item.provisioned.concurrency_snapshot?.active_subquery_count ?? 0;
  return {
    same_interval_enabled_count: sameIntervalCount + (form.status === "enabled" ? 1 : 0),
    configured_limit: configuredLimit,
    active_count: activeCount,
    available_count: Math.max(0, configuredLimit - activeCount),
  };
});
function syncUrlState() {
  const next = {
    ...route.query,
    q: query.value || undefined,
    category: category.value || undefined,
    availability: availability.value || undefined,
    market: market.value || undefined,
    language: language.value || undefined,
    access_mode: accessMode.value || undefined,
    sort: sort.value === "business" ? undefined : sort.value,
    page: page.value === 1 ? undefined : String(page.value),
  };
  void router.replace({ query: next });
}
watch([query, category, availability, market, language, accessMode, sort], () => {
  if (page.value !== 1) page.value = 1;
  else syncUrlState();
});
watch(page, syncUrlState);
watch(totalPages, (value) => {
  if (page.value > value) page.value = value;
});
function resetFilters() {
  query.value = "";
  category.value = "";
  availability.value = "";
  market.value = "";
  language.value = "";
  accessMode.value = "";
  sort.value = "business";
}
function changePage(next: number) {
  page.value = Math.min(totalPages.value, Math.max(1, next));
  window.requestAnimationFrame(() => {
    document.getElementById("source-results")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  });
}
const failure = (status: number): ViewState =>
  status === 401
    ? "expired"
    : status === 403
      ? "forbidden"
      : [408, 425, 429, 502, 503, 504].includes(status)
        ? "blocked"
        : "error";
const categoryText = (value: SourceItem["category"]) =>
  ({
    news: "新闻",
    ecommerce: "电商平台",
    data: "趋势数据",
    community: "论坛社区",
    product_supply: "商品供应链",
  })[value];
const statusText = (item: SourceItem) => {
  const availability = effectiveAvailability(item);
  if (availability === "automatic")
    return item.provisioned?.status === "enabled"
      ? automaticProductSourceCodes.has(item.code)
        ? "自动采集"
        : "生产可用"
      : item.provisioned
        ? "待配置"
        : "等待同步";
  if (availability === "setup_required")
    return item.code === "amazon_product" && item.provisioned?.status === "disabled"
      ? "已停用"
      : "待配置";
  return "手工来源";
};
const policyText = (item: SourceItem) => {
  if (effectiveAvailability(item) !== "automatic") return item.policy_note;
  const interval = item.provisioned?.schedule_minutes ?? item.schedule_minutes;
  if (item.code === "amazon_product")
    return `系统按选品规则每 ${interval} 分钟抓取公开 Amazon 商品页；不使用官方 API，价格、评分和评论只保留页面真实披露值。`;
  if (item.code === "1688_search")
    return `已完成网页登录和来源验收；系统按选品规则每 ${interval} 分钟采集 1688 公开商品与供应商信息。`;
  return item.policy_note;
};
const modeText = (value: string) =>
  (
    ({
      public_rss: "公开 RSS/Atom 爬虫",
      public_page: "公开页面爬虫",
      authenticated_browser: "网页登录爬虫",
      import: "文件导入",
      manual: "人工录入",
    }) as Record<string, string>
  )[value] ?? value;
const successText = (item: SourceItem) => {
  const success = item.provisioned?.last_success;
  if (!success) return "尚无成功任务";
  const count = success.available_result_count
    ? `${success.available_result_count} 条结果`
    : "成功但无结果";
  return `${new Date(success.finished_at).toLocaleString("zh-CN")} · ${count}`;
};
const slaText = (item: SourceItem) =>
  item.availability === "automatic"
    ? `≤ ${item.provisioned?.schedule_minutes ?? item.schedule_minutes} 分钟（沿用采集计划）`
    : "未设自动 SLA";

async function api<T>(
  path: string,
  options: RequestInit = {},
  isCurrent: () => boolean = () => true,
) {
  try {
    const response = await request<T>(path, options);
    if (isCurrent()) requestId.value = response.request_id;
    return response.data;
  } catch (error) {
    const failure = error instanceof ApiClientError ? error : null;
    if (isCurrent()) {
      requestId.value = failure?.requestId ?? requestId.value;
      message.value = failure?.actionHint ?? "来源服务暂不可用";
    }
    throw error;
  }
}

async function load(options: { showFeedback?: boolean } = {}): Promise<boolean> {
  const operation = ++catalogLoadOperation;
  const preserve = items.value.length > 0;
  refreshFeedback.value = options.showFeedback && preserve ? "refreshing" : "idle";
  refreshFailureKind.value = null;
  if (options.showFeedback && preserve) requestId.value = "";
  if (!preserve) state.value = "loading";
  refreshing.value = true;
  message.value = "";
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const loadedItems =
      (await api<SourceItem[]>(
        "/platform/provider-sources",
        { signal: controller.signal },
        () => operation === catalogLoadOperation,
      )) ?? [];
    if (operation !== catalogLoadOperation) return false;
    items.value = loadedItems;
    lastUpdatedAt.value = new Date().toISOString();
    state.value = items.value.length ? "ready" : "empty";
    refreshFeedback.value = options.showFeedback && preserve ? "success" : "idle";
    if (linkedProviderId.value) {
      const linked = items.value.find((item) => item.provisioned?.id === linkedProviderId.value);
      message.value = linked ? `已定位关联来源：${linked.name}` : "关联来源不在当前来源目录中。";
    } else if (preserve) message.value = `已刷新 ${items.value.length} 个来源频道。`;
    return true;
  } catch (error) {
    if (operation !== catalogLoadOperation) return false;
    if (preserve) {
      state.value = "ready";
      const refreshFailure = error instanceof ApiClientError ? failure(error.status) : "blocked";
      refreshFailureKind.value = refreshFailure;
      refreshFeedback.value =
        options.showFeedback && !["expired", "forbidden"].includes(refreshFailure)
          ? "failed"
          : "idle";
      message.value =
        error instanceof DOMException && error.name === "AbortError"
          ? "刷新超时，已保留上一次成功加载的来源目录。"
          : `${message.value || "刷新失败。"} 已保留上一次成功加载的来源目录。`;
    } else state.value = error instanceof ApiClientError ? failure(error.status) : "blocked";
    return false;
  } finally {
    window.clearTimeout(timer);
    if (operation === catalogLoadOperation) refreshing.value = false;
  }
}

function setConfigurationSaveFeedback(
  stage: ConfigurationSaveStage,
  title: string,
  description: string,
  technicalRequestId = "",
) {
  configurationSaveStage.value = stage;
  configurationSaveTitle.value = title;
  configurationSaveDescription.value = description;
  configurationSaveRequestId.value = technicalRequestId;
  message.value = "";
  requestId.value = "";
}

function closeEdit() {
  if (saving.value) return;
  configurationOperation += 1;
  editing.value = null;
  setConfigurationSaveFeedback("idle", "", "");
}

async function focusConfigurationReturn(state: ConfigurationReturnState) {
  await nextTick();
  if (state === "failed")
    document
      .querySelector<HTMLElement>(".source-center .p48-source-configuration-return-retry")
      ?.focus({ preventScroll: true });
  else configurationReturnHeading.value?.focus({ preventScroll: true });
}

function configurationReturnCopy(
  outcome: ConfigurationReturnOutcome,
  state: Exclude<ConfigurationReturnState, "idle">,
) {
  const titles = {
    saved: {
      refreshing: "设置已保存，正在更新来源目录",
      success: "设置已保存，来源目录已更新",
      failed: "设置已保存，但来源目录尚未更新",
    },
    partial: {
      refreshing: "停用配置已保存，正在更新来源目录",
      success: "停用配置已保存，来源目录已更新",
      failed: "停用配置已保存，但来源目录尚未更新",
    },
    conflict: {
      refreshing: "正在读取最新配置",
      success: "已读取最新配置",
      failed: "最新配置暂时未能读取",
    },
  } as const;
  return titles[outcome][state];
}

async function refreshAfterConfigurationResult() {
  const operation = ++configurationReturnOperation;
  const outcome = configurationReturnOutcome.value;
  configurationReturnState.value = "refreshing";
  configurationReturnTitle.value = configurationReturnCopy(outcome, "refreshing");
  configurationReturnDescription.value =
    outcome === "conflict"
      ? "正在从服务端重新读取当前版本，请稍候。"
      : "刚才的写入已经完成；正在同步目录中的最新状态。";
  configurationReturnRequestId.value = "";
  message.value = "";
  requestId.value = "";
  await focusConfigurationReturn("refreshing");
  if (operation !== configurationReturnOperation) return;
  const refreshed = await load();
  if (operation !== configurationReturnOperation) return;
  const failedMessage = message.value;
  const failedRequestId = requestId.value;
  message.value = "";
  requestId.value = "";
  if (refreshed) {
    configurationReturnState.value = "success";
    configurationReturnTitle.value = configurationReturnCopy(outcome, "success");
    configurationReturnDescription.value =
      outcome === "conflict"
        ? `${configurationReturnSourceName.value} 已同步到服务端当前版本，可以重新打开编辑。`
        : outcome === "partial"
          ? `${configurationReturnSourceName.value} 的停用配置已同步；处理来源问题后再重新启用。`
          : `${configurationReturnSourceName.value} 的最新配置已经显示在目录中。`;
    await focusConfigurationReturn("success");
    return;
  }
  configurationReturnState.value = "failed";
  configurationReturnTitle.value = configurationReturnCopy(outcome, "failed");
  configurationReturnDescription.value =
    outcome === "conflict"
      ? `${failedMessage || "来源目录暂时无法读取。"} 当前页面不会把旧内容当作最新配置。`
      : `刚才的写入不会撤销。${failedMessage || "下方继续显示上次成功读取的来源目录。"}`;
  configurationReturnRequestId.value = failedRequestId;
  await focusConfigurationReturn("failed");
}

async function acknowledgeConfigurationSave() {
  if (!editing.value || !["success", "partial", "conflict"].includes(configurationSaveStage.value))
    return;
  configurationReturnOutcome.value =
    configurationSaveStage.value === "success"
      ? "saved"
      : configurationSaveStage.value === "partial"
        ? "partial"
        : "conflict";
  configurationReturnSourceName.value = editing.value.name;
  editing.value = null;
  setConfigurationSaveFeedback("idle", "", "");
  await nextTick();
  await refreshAfterConfigurationResult();
}

async function handleSourceStatePrimary() {
  if (state.value === "expired") {
    void router.push("/login");
    return;
  }
  const pageHeading = document.querySelector<HTMLElement>(".source-center .source-guide h2");
  pageHeading?.focus({ preventScroll: true });
  await load({ showFeedback: true });
  await nextTick();
  if (state.value === "ready") pageHeading?.focus({ preventScroll: true });
  else
    document
      .querySelector<HTMLElement>(".source-center .source-state-primary")
      ?.focus({ preventScroll: true });
}

async function handleSourceRefresh() {
  const pageHeading = document.querySelector<HTMLElement>(".source-center .source-guide h2");
  pageHeading?.focus({ preventScroll: true });
  await load({ showFeedback: true });
  await nextTick();
  if (refreshFeedback.value === "failed")
    document
      .querySelector<HTMLElement>(".source-center .source-refresh-primary")
      ?.focus({ preventScroll: true });
  else pageHeading?.focus({ preventScroll: true });
}

function beginEdit(item: SourceItem) {
  if (!item.provisioned) return;
  if (configurationReturnState.value === "refreshing") {
    catalogLoadOperation += 1;
    refreshing.value = false;
  }
  configurationOperation += 1;
  configurationReturnOperation += 1;
  configurationReturnState.value = "idle";
  message.value = "";
  requestId.value = "";
  setConfigurationSaveFeedback("idle", "", "");
  editing.value = item;
  Object.assign(form, {
    schedule_minutes: item.provisioned.schedule_minutes,
    timeout_ms: item.provisioned.timeout_ms,
    retry_limit: item.provisioned.retry_limit,
    status: item.provisioned.status === "enabled" ? "enabled" : "disabled",
    reason: "调整来源采集配置",
  });
}

async function save() {
  const editingSnapshot = editing.value;
  if (!editingSnapshot?.provisioned || saving.value) return;
  const operation = ++configurationOperation;
  const source = editingSnapshot.provisioned;
  const formSnapshot = { ...form };
  const isCurrent = () =>
    operation === configurationOperation && editing.value?.provisioned?.id === source.id;
  const isAutomatic = editingSnapshot.availability === "automatic";
  const requiresPublicSmoke =
    source.status !== "enabled" &&
    formSnapshot.status === "enabled" &&
    ["public_page", "public_rss"].includes(editingSnapshot.access_mode);
  saving.value = true;
  message.value = "";
  requestId.value = "";
  let stagedDisabled = false;
  try {
    setConfigurationSaveFeedback(
      requiresPublicSmoke ? "saving_disabled" : "saving",
      requiresPublicSmoke ? "正在先保存停用配置" : "正在保存采集设置",
      requiresPublicSmoke
        ? "来源继续保持停用；保存完成后才会执行真实页面烟测。"
        : "正在生成新的配置版本，请稍候。",
    );
    let saved = await api<any>(
      `/platform/provider-sources/${source.id}/configuration`,
      {
        method: "PUT",
        body: JSON.stringify({
          ...formSnapshot,
          status: requiresPublicSmoke ? "disabled" : formSnapshot.status,
          expected_version: source.version,
        }),
      },
      isCurrent,
    );
    if (!isCurrent()) return;
    if (requiresPublicSmoke) {
      stagedDisabled = true;
      Object.assign(source, saved);
      setConfigurationSaveFeedback(
        "smoke_testing",
        "停用配置已保存，正在进行真实页面烟测",
        "来源仍处于停用状态。烟测通过后才会继续启用。",
        requestId.value,
      );
      let smoke;
      try {
        smoke = await api<any>(
          `/platform/provider-adapters/${source.id}/health-check`,
          { method: "POST" },
          isCurrent,
        );
      } catch {
        if (isCurrent())
          setConfigurationSaveFeedback(
            "partial",
            "停用配置已保存，来源尚未启用",
            `真实页面烟测暂时无法完成。${message.value || "请稍后重新打开并重试。"}`,
            requestId.value,
          );
        return;
      }
      if (!isCurrent()) return;
      if (smoke?.health_status !== "ready") {
        setConfigurationSaveFeedback(
          "partial",
          "停用配置已保存，来源尚未启用",
          `真实页面烟测未通过：${smoke?.last_error_code ?? "来源暂不可用"}。处理来源问题后再重新启用。`,
          requestId.value,
        );
        return;
      }
      setConfigurationSaveFeedback(
        "enabling",
        "烟测已通过，正在启用来源",
        "正在把刚才验证过的配置写为启用状态。",
        requestId.value,
      );
      try {
        saved = await api<any>(
          `/platform/provider-sources/${source.id}/configuration`,
          {
            method: "PUT",
            body: JSON.stringify({ ...formSnapshot, expected_version: saved.version }),
          },
          isCurrent,
        );
      } catch {
        if (isCurrent())
          setConfigurationSaveFeedback(
            "partial",
            "停用配置已保存，来源尚未启用",
            `烟测已经通过，但启用状态没有写入。${message.value || "请重新读取最新配置后再试。"}`,
            requestId.value,
          );
        return;
      }
      if (!isCurrent()) return;
      Object.assign(source, saved);
    } else {
      Object.assign(source, saved);
    }
    setConfigurationSaveFeedback(
      "success",
      requiresPublicSmoke ? "烟测通过，来源已启用" : "采集设置已保存",
      requiresPublicSmoke
        ? "停用配置和启用状态都已写入，并保留了新的配置版本。"
        : isAutomatic
          ? "来源配置已保存；频率、超时、重试和启停状态不会再被启动同步覆盖。"
          : "设置已写入新的配置版本；完成网页登录和可用性检查前，来源不会进入自动采集。",
      requestId.value,
    );
  } catch (error) {
    if (isCurrent()) {
      const conflict = error instanceof ApiClientError && error.status === 409;
      setConfigurationSaveFeedback(
        stagedDisabled ? "partial" : conflict ? "conflict" : "failed",
        stagedDisabled
          ? "停用配置已保存，来源尚未启用"
          : conflict
            ? "配置已经更新，请重新读取"
            : "采集设置未能保存",
        stagedDisabled
          ? `停用配置已经保留。${message.value || "后续步骤没有完成。"}`
          : conflict
            ? "其他操作已经产生了新版本。关闭此窗并重新读取后，再基于最新配置修改。"
            : message.value || "请检查当前状态后重新保存。",
        requestId.value,
      );
    }
  } finally {
    if (isCurrent()) saving.value = false;
  }
}

onBeforeUnmount(() => {
  configurationOperation += 1;
  configurationReturnOperation += 1;
  catalogLoadOperation += 1;
});
async function loadConfigurationVersions(item: SourceItem) {
  if (!item.provisioned) return;
  message.value = "";
  requestId.value = "";
  const operation = ++versionOwnership;
  const providerId = item.provisioned.id;
  versionSource.value = item;
  versionLoading.value = true;
  versionHistory.value = [];
  versionCurrentVersion.value = null;
  rollbackReason.value = "恢复已验证的来源采集设置";
  versionLastTarget.value = null;
  versionWriteConfirmed.value = false;
  setVersionActionFeedback("idle", "", "");
  try {
    const result = await fetchConfigurationVersions(item);
    if (!ownsVersionOperation(operation, providerId)) return;
    versionLoading.value = false;
    if (result.ok) {
      applyConfigurationVersions(result);
    } else {
      setVersionActionFeedback("read_failed", result.title, result.description, result.requestId);
    }
  } finally {
    if (ownsVersionOperation(operation, providerId)) versionLoading.value = false;
  }
}

function setVersionActionFeedback(
  stage: VersionActionStage,
  title: string,
  description: string,
  technicalRequestId = "",
) {
  versionActionStage.value = stage;
  versionActionTitle.value = title;
  versionActionDescription.value = description;
  versionActionRequestId.value = technicalRequestId;
  message.value = "";
  requestId.value = "";
}

function ownsVersionOperation(operation: number, providerId: string) {
  return operation === versionOwnership && versionSource.value?.provisioned?.id === providerId;
}

function closeConfigurationVersions() {
  if (rollingBack.value !== null) return;
  versionOwnership += 1;
  versionSource.value = null;
  versionActionStage.value = "idle";
  versionActionRequestId.value = "";
  versionLastTarget.value = null;
  versionWriteConfirmed.value = false;
}

function configurationVersionFailure(error: unknown, mode: "read" | "rollback") {
  const failure = error instanceof ApiClientError ? error : null;
  if (mode === "read") {
    if (failure?.kind === "expired")
      return ["read_failed", "登录状态已失效", "重新登录后，可以再次读取配置历史。"] as const;
    if (failure?.kind === "forbidden")
      return [
        "read_failed",
        "当前权限还不能查看配置历史",
        "权限调整后，可以在此重新读取。",
      ] as const;
    if (failure?.kind === "rate_limited")
      return ["read_failed", "读取请求较多，请稍后再试", failure.actionHint] as const;
    return [
      "read_failed",
      "配置历史暂时未能读取",
      failure?.actionHint ?? "来源目录仍可使用；可以在此重新读取配置历史。",
    ] as const;
  }
  if (failure?.kind === "conflict")
    return [
      "conflict",
      "当前版本已经变化",
      "配置没有修改。请读取最新版本后，再选择需要恢复的版本。",
    ] as const;
  if (failure?.kind === "forbidden")
    return [
      "forbidden",
      "当前权限还不能恢复配置",
      "配置没有修改。权限调整后，可以重新读取历史再操作。",
    ] as const;
  if (failure?.kind === "expired")
    return [
      "failed",
      "登录状态已失效",
      "尚未确认生成新版本。重新登录并核对历史后再操作。",
    ] as const;
  return [
    "failed",
    "尚未确认生成新版本",
    "请保留当前原因并核对服务状态，再决定是否重新提交。",
  ] as const;
}

async function fetchConfigurationVersions(item: SourceItem) {
  try {
    const response = await request<any>(
      `/platform/provider-sources/${item.provisioned?.id}/configuration/versions`,
    );
    const currentVersion = Number(response.data?.current_version);
    if (!Number.isInteger(currentVersion) || currentVersion < 1)
      return {
        ok: false as const,
        title: "配置历史响应不完整",
        description: "当前版本编号无效；本窗不会把这次响应显示为有效历史。",
        requestId: response.request_id,
      };
    return {
      ok: true as const,
      currentVersion,
      versions: (response.data?.versions ?? []) as ConfigurationVersion[],
      requestId: response.request_id,
    };
  } catch (error) {
    const [, title, description] = configurationVersionFailure(error, "read");
    return {
      ok: false as const,
      title,
      description,
      requestId: error instanceof ApiClientError ? error.requestId : "",
    };
  }
}

function applyConfigurationVersions(result: {
  currentVersion: number;
  versions: ConfigurationVersion[];
}) {
  versionCurrentVersion.value = result.currentVersion;
  versionHistory.value = result.versions;
}

async function reloadVersionSurfaces(
  operation: number,
  sourceSnapshot: SourceItem,
  successTitle: string,
  successDescription: string,
) {
  const providerId = sourceSnapshot.provisioned?.id;
  if (!providerId) return false;
  const catalogLoaded = await load();
  if (!ownsVersionOperation(operation, providerId)) return false;
  const catalogFailure = message.value;
  const catalogRequestId = requestId.value;
  message.value = "";
  requestId.value = "";
  if (!catalogLoaded) {
    setVersionActionFeedback(
      "sync_failed",
      versionWriteConfirmed.value ? "新版本已生成，来源目录尚未更新" : "最新来源目录暂时未能读取",
      versionWriteConfirmed.value
        ? "本窗仍显示操作前历史，不会把旧内容当作最新结果。"
        : catalogFailure || "当前页面不会把旧内容当作最新配置。",
      catalogRequestId,
    );
    return false;
  }
  const refreshed = items.value.find((item) => item.code === sourceSnapshot.code);
  if (!refreshed?.provisioned) {
    setVersionActionFeedback(
      "sync_failed",
      versionWriteConfirmed.value ? "新版本已生成，来源目录尚未找到该来源" : "当前目录未找到该来源",
      "本窗保留已知历史，但不会把它标记为最新结果。",
    );
    return false;
  }
  versionSource.value = refreshed;
  const result = await fetchConfigurationVersions(refreshed);
  if (!ownsVersionOperation(operation, providerId)) return false;
  if (!result.ok) {
    setVersionActionFeedback(
      "sync_failed",
      versionWriteConfirmed.value ? "新版本已生成，配置历史尚未更新" : "最新配置历史暂时未能读取",
      versionWriteConfirmed.value
        ? "本窗仍显示操作前历史，不会把旧内容当作最新结果。"
        : result.description,
      result.requestId,
    );
    return false;
  }
  applyConfigurationVersions(result);
  setVersionActionFeedback("success", successTitle, successDescription, result.requestId);
  return true;
}

async function rollbackConfiguration(version: ConfigurationVersion) {
  const sourceSnapshot = versionSource.value;
  const source = sourceSnapshot?.provisioned;
  const expectedVersion = versionCurrentVersion.value;
  const reason = rollbackReason.value.trim();
  if (
    !sourceSnapshot ||
    !source ||
    expectedVersion === null ||
    !version.rollback_available ||
    reason.length < 2 ||
    rollingBack.value !== null
  )
    return;
  const operation = ++versionOwnership;
  const providerId = source.id;
  rollingBack.value = version.version;
  versionLastTarget.value = version.version;
  versionWriteConfirmed.value = false;
  setVersionActionFeedback(
    "submitting",
    "正在生成新的当前版本",
    `正在把第 ${version.version} 版的安全设置写成新版本；完成前不会再次提交。`,
  );
  try {
    const response = await request(
      `/platform/provider-sources/${providerId}/configuration/rollbacks`,
      {
        method: "POST",
        body: JSON.stringify({
          target_version: version.version,
          expected_version: expectedVersion,
          reason,
        }),
      },
    );
    if (!ownsVersionOperation(operation, providerId)) return;
    versionWriteConfirmed.value = true;
    setVersionActionFeedback(
      "reloading",
      "新版本已生成，正在核对目录与历史",
      "写入结果已经确认；正在读取新的当前版本。",
      response.request_id,
    );
    await reloadVersionSurfaces(
      operation,
      sourceSnapshot,
      "已生成新的当前版本",
      `已从第 ${version.version} 版恢复；原有历史保持不变。`,
    );
  } catch (error) {
    if (!ownsVersionOperation(operation, providerId)) return;
    const [stage, title, description] = configurationVersionFailure(error, "rollback");
    setVersionActionFeedback(
      stage,
      title,
      description,
      error instanceof ApiClientError ? error.requestId : "",
    );
  } finally {
    if (ownsVersionOperation(operation, providerId)) rollingBack.value = null;
  }
}

async function retryConfigurationVersions() {
  const sourceSnapshot = versionSource.value;
  const providerId = sourceSnapshot?.provisioned?.id;
  if (!sourceSnapshot || !providerId || rollingBack.value !== null) return;
  if (versionActionStage.value === "read_failed") {
    await loadConfigurationVersions(sourceSnapshot);
    return;
  }
  const operation = ++versionOwnership;
  const wroteVersion = versionWriteConfirmed.value;
  setVersionActionFeedback(
    "reloading",
    wroteVersion ? "正在重新核对目录与历史" : "正在读取最新版本",
    wroteVersion ? "不会再次提交回滚，只进行安全读取。" : "正在读取服务端当前版本。",
  );
  await reloadVersionSurfaces(
    operation,
    sourceSnapshot,
    wroteVersion ? "新的当前版本已确认" : "已读取最新版本",
    wroteVersion
      ? `第 ${versionLastTarget.value ?? "—"} 版已恢复为新的当前版本，原有历史保持不变。`
      : "配置历史已更新，可以重新选择需要恢复的版本。",
  );
}
async function testSource(item: SourceItem) {
  if (!item.provisioned || testing.value) return;
  testing.value = item.provisioned.id;
  message.value = "";
  try {
    const result = await api<any>(
      `/platform/provider-adapters/${item.provisioned.id}/health-check`,
      { method: "POST" },
    );
    message.value =
      result?.health_status === "ready"
        ? `${item.name} 匿名采集测试通过，未使用登录凭证。`
        : `${item.name} 已完成测试：${result?.last_error_code ?? "来源暂不可用"}。`;
  } catch {
    if (!message.value) message.value = "来源测试服务暂不可用，本次没有修改配置。";
  } finally {
    testing.value = null;
  }
}

async function loadCompatibility(item: SourceItem) {
  if (!item.provisioned) return;
  requestId.value = "";
  compatibilitySource.value = item;
  compatibilityLoading.value = true;
  compatibilityError.value = "";
  compatibilityAdapterVersion.value = null;
  compatibilityRows.value = [];
  try {
    const response = await request<ProviderCompatibilitySummary[]>("/platform/provider-adapters");
    requestId.value = response.request_id;
    const summary = response.data.find((candidate) => candidate.id === item.provisioned?.id);
    if (!summary) {
      compatibilityError.value = "当前来源没有对应的采集程序观测。";
      return;
    }
    compatibilityAdapterVersion.value = summary.adapter_version;
    compatibilityRows.value = summary.compatibility_matrix ?? [];
  } catch (error) {
    const failure = error instanceof ApiClientError ? error : null;
    requestId.value = failure?.requestId ?? requestId.value;
    compatibilityError.value = failure?.actionHint ?? "解析兼容矩阵暂不可用，请稍后重试。";
  } finally {
    compatibilityLoading.value = false;
  }
}
function ownsSampleContext(operation: number, providerId: string) {
  return operation === sampleContextOperation && sampleSource.value?.provisioned?.id === providerId;
}

function openParserSamples(item: SourceItem) {
  if (!item.provisioned) return;
  const operation = ++sampleContextOperation;
  sampleReadOperation += 1;
  sampleSource.value = item;
  sampleLoading.value = false;
  sampleReadLoaded.value = false;
  sampleReadError.value = "";
  sampleReadRequestId.value = "";
  sampleActionMessage.value = "";
  sampleActionRequestId.value = "";
  sampleOverview.samples = [];
  sampleOverview.candidates = [];
  latestReplay.value = null;
  message.value = "";
  requestId.value = "";
  void readParserSamples(item, operation);
}

function closeParserSamples() {
  sampleContextOperation += 1;
  sampleReadOperation += 1;
  sampleSource.value = null;
  sampleLoading.value = false;
  sampleReadLoaded.value = false;
  sampleReadError.value = "";
  sampleReadRequestId.value = "";
  sampleActionMessage.value = "";
  sampleActionRequestId.value = "";
}

async function readParserSamples(item: SourceItem, contextOperation: number) {
  const providerId = item.provisioned?.id;
  if (!providerId || !ownsSampleContext(contextOperation, providerId)) return false;
  const readOperation = ++sampleReadOperation;
  const isCurrent = () =>
    readOperation === sampleReadOperation && ownsSampleContext(contextOperation, providerId);
  sampleLoading.value = true;
  sampleReadError.value = "";
  try {
    const result = await api<any>(
      `/platform/provider-sources/${providerId}/parser-samples`,
      {},
      isCurrent,
    );
    if (!isCurrent()) return false;
    sampleOverview.samples = result?.samples ?? [];
    sampleOverview.candidates = result?.candidates ?? [];
    sampleReadLoaded.value = true;
    sampleReadError.value = "";
    sampleReadRequestId.value = "";
    return true;
  } catch {
    if (!isCurrent()) return false;
    sampleReadError.value = message.value || "固定样本列表暂时未能更新。";
    sampleReadRequestId.value = requestId.value;
    if (!sampleReadLoaded.value) {
      const errorMessage = sampleReadError.value;
      closeParserSamples();
      message.value = errorMessage;
    }
    message.value = "";
    requestId.value = "";
    return false;
  } finally {
    if (isCurrent()) sampleLoading.value = false;
  }
}

async function retryParserSamples() {
  const sourceSnapshot = sampleSource.value;
  const providerId = sourceSnapshot?.provisioned?.id;
  if (!sourceSnapshot || !providerId || sampleLoading.value) return;
  const operation = sampleContextOperation;
  if (
    (await readParserSamples(sourceSnapshot, operation)) &&
    ownsSampleContext(operation, providerId)
  ) {
    sampleActionMessage.value = "样本列表已更新；请依据当前样本状态继续操作。";
    sampleActionRequestId.value = requestId.value;
  }
}

async function createParserSample(candidate: ParserSampleCandidate) {
  const sourceSnapshot = sampleSource.value;
  const providerId = sourceSnapshot?.provisioned?.id;
  if (
    !sourceSnapshot ||
    !providerId ||
    sampleSaving.value ||
    sampleReplaying.value ||
    sampleReviewing.value
  )
    return;
  const operation = sampleContextOperation;
  const isCurrent = () => ownsSampleContext(operation, providerId);
  sampleSaving.value = candidate.browser_job_id;
  sampleActionMessage.value = "正在固定真实登录作业的样本。";
  sampleActionRequestId.value = "";
  try {
    await api(
      `/platform/provider-sources/${providerId}/parser-samples`,
      {
        method: "POST",
        body: JSON.stringify({
          browser_job_id: candidate.browser_job_id,
          name: `真实登录样本 ${new Date(candidate.captured_at).toLocaleString("zh-CN")}`,
        }),
      },
      isCurrent,
    );
    if (!isCurrent()) return;
    sampleActionRequestId.value = requestId.value;
    sampleActionMessage.value = "样本已固定，正在更新候选与样本列表。";
    if (await readParserSamples(sourceSnapshot, operation))
      sampleActionMessage.value = "已从真实登录作业固定样本；请执行差异回放后再启用来源。";
    else if (isCurrent())
      sampleActionMessage.value = "样本已固定，但列表暂未能更新；可重新读取列表。";
  } catch (error) {
    if (!isCurrent()) return;
    sampleActionMessage.value =
      error instanceof ApiClientError
        ? error.actionHint
        : "固定结果暂未确认，请读取样本列表后再决定下一步。";
    sampleActionRequestId.value = error instanceof ApiClientError ? error.requestId : "";
    message.value = "";
    requestId.value = "";
  } finally {
    if (isCurrent()) sampleSaving.value = null;
  }
}

async function replayParserSample(sample: ParserSample) {
  const sourceSnapshot = sampleSource.value;
  const providerId = sourceSnapshot?.provisioned?.id;
  if (
    !sourceSnapshot ||
    !providerId ||
    sampleSaving.value ||
    sampleReplaying.value ||
    sampleReviewing.value
  )
    return;
  const operation = sampleContextOperation;
  const isCurrent = () => ownsSampleContext(operation, providerId);
  sampleReplaying.value = sample.id;
  sampleActionMessage.value = "正在读取已保存快照并执行当前解析器回放。";
  sampleActionRequestId.value = "";
  try {
    const result = await api<ParserSampleReplay>(
      `/platform/provider-sources/${providerId}/parser-samples/${sample.id}/replays`,
      { method: "POST" },
      isCurrent,
    );
    if (!isCurrent()) return;
    latestReplay.value = result;
    sampleActionRequestId.value = requestId.value;
    sampleActionMessage.value = "回放结果已留存，正在更新样本列表。";
    if (await readParserSamples(sourceSnapshot, operation))
      sampleActionMessage.value =
        result.status === "passed"
          ? "固定样本与当前解析结果一致。"
          : "回放已留存差异，来源继续保持停用。";
    else if (isCurrent()) sampleActionMessage.value = "回放结果已留存，但样本列表暂未能更新。";
  } catch (error) {
    if (!isCurrent()) return;
    sampleActionMessage.value =
      error instanceof ApiClientError
        ? error.actionHint
        : "回放结果暂未确认，请读取样本列表后核对状态。";
    sampleActionRequestId.value = error instanceof ApiClientError ? error.requestId : "";
    message.value = "";
    requestId.value = "";
  } finally {
    if (isCurrent()) sampleReplaying.value = null;
  }
}
async function reviewParserSample(
  sample: ParserSample,
  decision: "approved" | "rejected",
  reason: string,
) {
  const sourceSnapshot = sampleSource.value;
  const providerId = sourceSnapshot?.provisioned?.id;
  if (
    !sourceSnapshot ||
    !providerId ||
    sampleSaving.value ||
    sampleReplaying.value ||
    sampleReviewing.value
  )
    return;
  const operation = sampleContextOperation;
  const isCurrent = () => ownsSampleContext(operation, providerId);
  sampleReviewing.value = sample.id;
  sampleActionMessage.value = "正在记录独立管理员的复核决定。";
  sampleActionRequestId.value = "";
  try {
    await api(
      `/platform/provider-sources/${providerId}/parser-samples/${sample.id}/reviews`,
      {
        method: "POST",
        body: JSON.stringify({
          decision,
          reason: reason.trim(),
          expected_version: sample.review_version,
        }),
      },
      isCurrent,
    );
    if (!isCurrent()) return;
    sampleActionRequestId.value = requestId.value;
    sampleActionMessage.value = "复核决定已记录，正在更新样本列表。";
    if (await readParserSamples(sourceSnapshot, operation))
      sampleActionMessage.value =
        decision === "approved"
          ? "固定样本审批通过；当前解析器回放一致后可启用来源。"
          : "固定样本已驳回并保留审计记录；请从新的真实作业重新固定样本。";
    else if (isCurrent()) sampleActionMessage.value = "复核决定已记录，但样本列表暂未能更新。";
  } catch (error) {
    if (!isCurrent()) return;
    sampleActionMessage.value =
      error instanceof ApiClientError
        ? error.actionHint
        : "复核结果暂未确认，请读取样本列表后核对状态。";
    sampleActionRequestId.value = error instanceof ApiClientError ? error.requestId : "";
    message.value = "";
    requestId.value = "";
  } finally {
    if (isCurrent()) sampleReviewing.value = null;
  }
}

onBeforeUnmount(() => {
  sampleContextOperation += 1;
  sampleReadOperation += 1;
});

onMounted(load);
</script>

<template>
  <section class="source-center source-center--p48 novice">
    <header class="source-guide">
      <div>
        <p>热点来源</p>
        <h2 tabindex="-1">多平台、多国家来源已自动登记</h2>
        <span>公开信息源由系统自动采集；需要登录的平台完成网页登录配置后才能运行。</span>
      </div>
      <div class="source-guide-actions">
        <small v-if="lastUpdatedAt">最近刷新 {{ lastUpdatedAt.slice(11, 19) }}</small>
        <button type="button" :disabled="refreshing" @click="handleSourceRefresh">
          {{ refreshing ? "刷新中…" : "刷新来源" }}
        </button>
        <RouterLink to="/platform-admin/providers">管理来源规则</RouterLink>
      </div>
    </header>
    <div class="source-metrics">
      <article>
        <small>全部来源</small><strong>{{ counts.all }}</strong
        ><span>代码目录</span>
      </article>
      <article>
        <small>自动采集</small><strong>{{ counts.automatic }}</strong
        ><span>已进入调度</span>
      </article>
      <article>
        <small>非谷歌自动源</small><strong>{{ counts.nonGoogle }}</strong
        ><span>电商 / 论坛 / 信息订阅</span>
      </article>
      <article>
        <small>市场覆盖</small><strong>{{ counts.markets }}</strong
        ><span>国家与全球市场</span>
      </article>
    </div>
    <aside class="source-help">
      <strong>已经替你配置好的部分</strong>
      <ol>
        <li>公开信息订阅和论坛频道会自动采集，不需要密钥。</li>
        <li>频率、超时、重试、启停可直接在本页修改。</li>
        <li>网页登录型平台需要先完成网页登录配置。</li>
      </ol>
    </aside>
    <ProviderSourceFilters
      v-if="state === 'ready'"
      :query="query"
      :category="category"
      :availability="availability"
      :market="market"
      :language="language"
      :access-mode="accessMode"
      :sort="sort"
      :market-options="marketOptions"
      :language-options="languageOptions"
      :result-count="filtered.length"
      @update:query="query = $event"
      @update:category="category = $event"
      @update:availability="availability = $event"
      @update:market="market = $event"
      @update:language="language = $event"
      @update:access-mode="accessMode = $event"
      @update:sort="sort = $event"
      @reset="resetFilters"
    />
    <p v-if="message && refreshFeedback === 'idle'" class="source-message" role="status">
      {{ message }} <code v-if="requestId">{{ requestId }}</code>
    </p>
    <section
      v-if="configurationReturnState !== 'idle'"
      class="p48-source-configuration-return"
      :data-state="configurationReturnState"
      :data-outcome="configurationReturnOutcome"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      :aria-busy="configurationReturnState === 'refreshing'"
    >
      <p>{{ configurationReturnState === "refreshing" ? "正在同步" : "同步结果" }}</p>
      <h2 ref="configurationReturnHeading" tabindex="-1">{{ configurationReturnTitle }}</h2>
      <p>{{ configurationReturnDescription }}</p>
      <details v-if="configurationReturnState === 'failed' && configurationReturnRequestId">
        <summary>技术详情</summary>
        <code>{{ configurationReturnRequestId }}</code>
      </details>
      <button
        v-if="configurationReturnState === 'failed'"
        type="button"
        class="p48-source-configuration-return-retry"
        @click="refreshAfterConfigurationResult"
      >
        重新读取来源目录
      </button>
    </section>
    <section
      v-if="state !== 'ready'"
      class="source-state-panel"
      :data-kind="state"
      :aria-busy="state === 'loading'"
      aria-live="polite"
      aria-atomic="true"
    >
      <p class="source-state-eyebrow">
        {{
          state === "expired"
            ? "会话状态"
            : state === "forbidden"
              ? "访问范围"
              : state === "blocked"
                ? "服务状态"
                : state === "error"
                  ? "读取结果"
                  : "来源目录"
        }}
      </p>
      <h2>
        {{
          state === "loading"
            ? "正在读取来源目录"
            : state === "empty"
              ? "还没有可显示的来源"
              : state === "expired"
                ? "登录状态已失效"
                : state === "forbidden"
                  ? "当前无法查看来源目录"
                  : state === "blocked"
                    ? "来源目录暂时不可用"
                    : "来源目录未能读取"
        }}
      </h2>
      <p class="source-state-description">
        {{
          state === "loading"
            ? "正在获取可用来源、准备状态和最近采集信息。"
            : state === "empty"
              ? "目录已成功读取，但当前没有来源频道。可以重新加载，确认登记结果。"
              : state === "expired"
                ? "为保护账号，当前未展示来源信息。重新登录后，可以继续查看来源目录。"
                : state === "forbidden"
                  ? "当前权限还不能读取这些内容。权限调整后，可以重新加载。"
                  : message || "来源服务暂时不可用，请稍后重新加载。"
        }}
      </p>
      <details v-if="requestId" class="source-state-technical">
        <summary>技术详情</summary>
        <code>{{ requestId }}</code>
      </details>
      <button
        v-if="state !== 'loading'"
        type="button"
        class="source-state-primary"
        @click="handleSourceStatePrimary"
      >
        {{ state === "expired" ? "重新登录" : "重新加载目录" }}
      </button>
    </section>
    <template v-else>
      <section
        class="source-refresh-host"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        :aria-busy="refreshFeedback === 'refreshing'"
      >
        <div
          v-if="refreshFeedback !== 'idle'"
          class="source-refresh-feedback"
          :data-kind="
            refreshFeedback === 'failed'
              ? refreshFailureKind === 'blocked'
                ? 'blocked'
                : 'failed'
              : refreshFeedback
          "
          :aria-labelledby="`source-refresh-${refreshFeedback}`"
        >
          <p>
            {{
              refreshFeedback === "refreshing"
                ? "目录更新"
                : refreshFeedback === "success"
                  ? "更新完成"
                  : refreshFailureKind === "blocked"
                    ? "服务状态"
                    : "更新结果"
            }}
          </p>
          <h3 :id="`source-refresh-${refreshFeedback}`">
            {{
              refreshFeedback === "refreshing"
                ? "正在更新来源目录"
                : refreshFeedback === "success"
                  ? "来源目录已更新"
                  : refreshFailureKind === "blocked"
                    ? "来源目录暂时未能更新"
                    : "最新目录未能更新"
            }}
          </h3>
          <p>
            {{
              refreshFeedback === "refreshing"
                ? `下方继续显示上次成功加载的 ${items.length} 个来源。刷新完成后会更新目录与最近刷新时间。`
                : message
            }}
          </p>
          <details v-if="refreshFeedback !== 'refreshing' && requestId">
            <summary>技术详情</summary>
            <code>{{ requestId }}</code>
          </details>
          <button
            v-if="refreshFeedback === 'failed'"
            type="button"
            class="source-refresh-primary"
            @click="handleSourceRefresh"
          >
            重新加载目录
          </button>
        </div>
      </section>
      <ProviderSourceDirectory
        :groups="groupedSources"
        :total-count="filtered.length"
        :page="page"
        :total-pages="totalPages"
        :range-start="resultRange.start"
        :range-end="resultRange.end"
        :category-text="categoryText"
        :status-text="statusText"
        :policy-text="policyText"
        :mode-text="modeText"
        :sla-text="slaText"
        :success-text="successText"
        :effective-availability="effectiveAvailability"
        :testing="testing"
        @page-change="changePage"
        @test="testSource"
        @edit="beginEdit"
        @compatibility="loadCompatibility"
        @versions="loadConfigurationVersions"
        @samples="openParserSamples"
      />
    </template>
    <ProviderSourceConfigurationDialog
      :editing="editing"
      :form="form"
      :preview="configurationPreview"
      :saving="saving"
      :save-stage="configurationSaveStage"
      :save-title="configurationSaveTitle"
      :save-description="configurationSaveDescription"
      :save-request-id="configurationSaveRequestId"
      :version-source="versionSource"
      :version-loading="versionLoading"
      :version-history="versionHistory"
      :version-action-stage="versionActionStage"
      :version-action-title="versionActionTitle"
      :version-action-description="versionActionDescription"
      :version-action-request-id="versionActionRequestId"
      :version-write-confirmed="versionWriteConfirmed"
      :rolling-back="rollingBack"
      :rollback-reason="rollbackReason"
      @close-edit="closeEdit"
      @acknowledge="acknowledgeConfigurationSave"
      @save="save"
      @close-versions="closeConfigurationVersions"
      @retry-versions="retryConfigurationVersions"
      @rollback="rollbackConfiguration"
      @update:form="Object.assign(form, $event)"
      @update:rollback-reason="rollbackReason = $event"
    />
    <ProviderParserSampleDialog
      v-if="sampleSource"
      :source-name="sampleSource.name"
      :loading="sampleLoading"
      :loaded="sampleReadLoaded"
      :read-error="sampleReadError"
      :read-request-id="sampleReadRequestId"
      :samples="sampleOverview.samples"
      :candidates="sampleOverview.candidates"
      :latest-replay="latestReplay"
      :saving-candidate-id="sampleSaving"
      :replaying-sample-id="sampleReplaying"
      :reviewing-sample-id="sampleReviewing"
      :message="sampleActionMessage"
      :request-id="sampleActionRequestId"
      @close="closeParserSamples"
      @create="createParserSample"
      @replay="replayParserSample"
      @review="reviewParserSample"
      @retry="retryParserSamples"
    />
    <ProviderCompatibilityMatrixDialog
      v-if="compatibilitySource"
      :source-name="compatibilitySource.name"
      :adapter-version="compatibilityAdapterVersion"
      :loading="compatibilityLoading"
      :error="compatibilityError"
      :request-id="requestId"
      :rows="compatibilityRows"
      @close="compatibilitySource = null"
    />
  </section>
</template>

<style scoped src="./ProviderSourceCenter.css"></style>
<style scoped src="./ProviderSourceCenter.p48.css"></style>
