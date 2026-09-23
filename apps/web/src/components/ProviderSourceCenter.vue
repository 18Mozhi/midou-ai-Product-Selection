<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ApiClientError, createApiClient } from "../api-client";
import ProviderCompatibilityMatrixDialog from "./ProviderCompatibilityMatrixDialog.vue";
import ProviderParserSampleDialog from "./ProviderParserSampleDialog.vue";
import ProviderSourceDirectory from "./ProviderSourceDirectory.vue";
import ProviderSourceFilters from "./ProviderSourceFilters.vue";
import ProviderSourceConfigurationDialog from "./ProviderSourceConfigurationDialog.vue";
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
const testing = ref<string | null>(null);
const sampleSource = ref<SourceItem | null>(null);
const sampleLoading = ref(false);
const sampleSaving = ref<string | null>(null);
const sampleReplaying = ref<string | null>(null);
const sampleReviewing = ref<string | null>(null);
const sampleOverview = reactive<{
  samples: ParserSample[];
  candidates: ParserSampleCandidate[];
}>({ samples: [], candidates: [] });
const latestReplay = ref<ParserSampleReplay | null>(null);
const versionSource = ref<SourceItem | null>(null);
const versionLoading = ref(false);
const versionHistory = ref<ConfigurationVersion[]>([]);
const versionCurrentVersion = ref<number | null>(null);
const rollingBack = ref<number | null>(null);
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

async function api<T>(path: string, options: RequestInit = {}) {
  try {
    const response = await request<T>(path, options);
    requestId.value = response.request_id;
    return response.data;
  } catch (error) {
    const failure = error instanceof ApiClientError ? error : null;
    requestId.value = failure?.requestId ?? requestId.value;
    message.value = failure?.actionHint ?? "来源服务暂不可用";
    throw error;
  }
}

async function load(options: { showFeedback?: boolean } = {}) {
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
    items.value =
      (await api<SourceItem[]>("/platform/provider-sources", { signal: controller.signal })) ?? [];
    lastUpdatedAt.value = new Date().toISOString();
    state.value = items.value.length ? "ready" : "empty";
    refreshFeedback.value = options.showFeedback && preserve ? "success" : "idle";
    if (linkedProviderId.value) {
      const linked = items.value.find((item) => item.provisioned?.id === linkedProviderId.value);
      message.value = linked ? `已定位关联来源：${linked.name}` : "关联来源不在当前来源目录中。";
    } else if (preserve) message.value = `已刷新 ${items.value.length} 个来源频道。`;
  } catch (error) {
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
  } finally {
    window.clearTimeout(timer);
    refreshing.value = false;
  }
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
  if (!editing.value?.provisioned) return;
  saving.value = true;
  message.value = "";
  try {
    const isAutomatic = editing.value.availability === "automatic";
    const source = editing.value.provisioned;
    const requiresPublicSmoke =
      source.status !== "enabled" &&
      form.status === "enabled" &&
      ["public_page", "public_rss"].includes(editing.value.access_mode);
    let saved = await api<any>(`/platform/provider-sources/${source.id}/configuration`, {
      method: "PUT",
      body: JSON.stringify({
        ...form,
        status: requiresPublicSmoke ? "disabled" : form.status,
        expected_version: source.version,
      }),
    });
    if (requiresPublicSmoke) {
      Object.assign(source, saved);
      const smoke = await api<any>(`/platform/provider-adapters/${source.id}/health-check`, {
        method: "POST",
      });
      if (smoke?.health_status !== "ready") {
        message.value = `当前配置已安全保存为停用；真实页面烟测未通过：${smoke?.last_error_code ?? "来源暂不可用"}。`;
        return;
      }
      saved = await api<any>(`/platform/provider-sources/${source.id}/configuration`, {
        method: "PUT",
        body: JSON.stringify({ ...form, expected_version: saved.version }),
      });
    }
    editing.value = null;
    await load();
    message.value = requiresPublicSmoke
      ? "真实页面烟测已通过，来源配置已启用。"
      : isAutomatic
        ? "来源配置已保存；频率、超时、重试和启停状态不会再被启动同步覆盖。"
        : "来源设置已保存；该来源完成网页登录和可用性检查前不会进入自动采集。";
  } catch {
    if (!message.value) message.value = "来源配置服务暂不可用，本次没有保存。";
  } finally {
    saving.value = false;
  }
}
async function loadConfigurationVersions(item: SourceItem) {
  if (!item.provisioned) return;
  versionSource.value = item;
  versionLoading.value = true;
  versionHistory.value = [];
  versionCurrentVersion.value = null;
  rollbackReason.value = "恢复已验证的来源采集设置";
  try {
    const result = await api<any>(
      `/platform/provider-sources/${item.provisioned.id}/configuration/versions`,
    );
    const currentVersion = Number(result?.current_version);
    if (!Number.isInteger(currentVersion) || currentVersion < 1) {
      message.value = "配置版本响应缺少有效的当前版本。";
      versionSource.value = null;
      return;
    }
    versionCurrentVersion.value = currentVersion;
    versionHistory.value = result?.versions ?? [];
  } catch {
    if (!message.value) message.value = "配置版本服务暂不可用。";
    versionSource.value = null;
  } finally {
    versionLoading.value = false;
  }
}
async function rollbackConfiguration(version: ConfigurationVersion) {
  const source = versionSource.value?.provisioned;
  if (!source || versionCurrentVersion.value === null || !version.rollback_available) return;
  rollingBack.value = version.version;
  try {
    await api(`/platform/provider-sources/${source.id}/configuration/rollbacks`, {
      method: "POST",
      body: JSON.stringify({
        target_version: version.version,
        expected_version: versionCurrentVersion.value,
        reason: rollbackReason.value,
      }),
    });
    const code = versionSource.value?.code;
    await load();
    const refreshed = items.value.find((item) => item.code === code);
    if (refreshed) await loadConfigurationVersions(refreshed);
    message.value = `已从第 ${version.version} 版生成新的当前版本；历史记录保持不变。`;
  } catch {
    if (!message.value) message.value = "配置回滚服务暂不可用，本次没有修改。";
  } finally {
    rollingBack.value = null;
  }
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
async function loadParserSamples(item: SourceItem) {
  if (!item.provisioned) return;
  sampleSource.value = item;
  sampleLoading.value = true;
  latestReplay.value = null;
  try {
    const result = await api<any>(
      `/platform/provider-sources/${item.provisioned.id}/parser-samples`,
    );
    sampleOverview.samples = result?.samples ?? [];
    sampleOverview.candidates = result?.candidates ?? [];
  } catch {
    if (!message.value) message.value = "固定样本服务暂不可用。";
    sampleSource.value = null;
  } finally {
    sampleLoading.value = false;
  }
}
async function createParserSample(candidate: ParserSampleCandidate) {
  if (!sampleSource.value?.provisioned) return;
  sampleSaving.value = candidate.browser_job_id;
  try {
    await api(`/platform/provider-sources/${sampleSource.value.provisioned.id}/parser-samples`, {
      method: "POST",
      body: JSON.stringify({
        browser_job_id: candidate.browser_job_id,
        name: `真实登录样本 ${new Date(candidate.captured_at).toLocaleString("zh-CN")}`,
      }),
    });
    await loadParserSamples(sampleSource.value);
    message.value = "已从真实登录作业固定样本；请执行差异回放后再启用来源。";
  } catch {
    if (!message.value) message.value = "固定样本服务暂不可用。";
  } finally {
    sampleSaving.value = null;
  }
}
async function replayParserSample(sample: ParserSample) {
  if (!sampleSource.value?.provisioned) return;
  sampleReplaying.value = sample.id;
  latestReplay.value = null;
  try {
    const result = await api<ParserSampleReplay>(
      `/platform/provider-sources/${sampleSource.value.provisioned.id}/parser-samples/${sample.id}/replays`,
      { method: "POST" },
    );
    latestReplay.value = result;
    await loadParserSamples(sampleSource.value);
    latestReplay.value = result;
    message.value =
      result.status === "passed"
        ? "固定样本与当前解析结果一致。"
        : "回放已留存差异，来源继续保持停用。";
  } catch {
    if (!message.value) message.value = "固定样本回放服务暂不可用。";
  } finally {
    sampleReplaying.value = null;
  }
}
async function reviewParserSample(
  sample: ParserSample,
  decision: "approved" | "rejected",
  reason: string,
) {
  if (!sampleSource.value?.provisioned) return;
  sampleReviewing.value = sample.id;
  try {
    await api(
      `/platform/provider-sources/${sampleSource.value.provisioned.id}/parser-samples/${sample.id}/reviews`,
      {
        method: "POST",
        body: JSON.stringify({
          decision,
          reason: reason.trim(),
          expected_version: sample.review_version,
        }),
      },
    );
    await loadParserSamples(sampleSource.value);
    message.value =
      decision === "approved"
        ? "固定样本审批通过；当前解析器回放一致后可启用来源。"
        : "固定样本已驳回并保留审计记录；请从新的真实作业重新固定样本。";
  } catch {
    if (!message.value) message.value = "固定样本审批服务暂不可用。";
  } finally {
    sampleReviewing.value = null;
  }
}

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
        @samples="loadParserSamples"
      />
    </template>
    <ProviderSourceConfigurationDialog
      :editing="editing"
      :form="form"
      :preview="configurationPreview"
      :saving="saving"
      :version-source="versionSource"
      :version-loading="versionLoading"
      :version-history="versionHistory"
      :rolling-back="rollingBack"
      :rollback-reason="rollbackReason"
      @close-edit="editing = null"
      @save="save"
      @close-versions="versionSource = null"
      @rollback="rollbackConfiguration"
      @update:form="Object.assign(form, $event)"
      @update:rollback-reason="rollbackReason = $event"
    />
    <ProviderParserSampleDialog
      v-if="sampleSource"
      :source-name="sampleSource.name"
      :loading="sampleLoading"
      :samples="sampleOverview.samples"
      :candidates="sampleOverview.candidates"
      :latest-replay="latestReplay"
      :saving-candidate-id="sampleSaving"
      :replaying-sample-id="sampleReplaying"
      :reviewing-sample-id="sampleReviewing"
      @close="sampleSource = null"
      @create="createParserSample"
      @replay="replayParserSample"
      @review="reviewParserSample"
    />
    <ProviderCompatibilityMatrixDialog
      v-if="compatibilitySource"
      :source-name="compatibilitySource.name"
      :adapter-version="compatibilityAdapterVersion"
      :loading="compatibilityLoading"
      :error="compatibilityError"
      :rows="compatibilityRows"
      @close="compatibilitySource = null"
    />
  </section>
</template>

<style scoped src="./ProviderSourceCenter.css"></style>
<style scoped src="./ProviderSourceCenter.p48.css"></style>
