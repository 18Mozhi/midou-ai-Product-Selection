<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ApiClientError, createApiClient } from "../api-client";
import ProviderCompatibilityMatrixDialog from "./ProviderCompatibilityMatrixDialog.vue";
import ProviderParserSampleDialog from "./ProviderParserSampleDialog.vue";
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
      (!availability.value || item.availability === availability.value) &&
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
  item.availability === "setup_required"
    ? 0
    : item.availability === "automatic" && item.provisioned?.status !== "enabled"
      ? 1
      : item.availability === "automatic"
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
  automatic: items.value.filter((item) => item.availability === "automatic").length,
  nonGoogle: items.value.filter(
    (item) => item.availability === "automatic" && !item.target_url.includes("news.google.com"),
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
  if (item.availability === "automatic")
    return item.provisioned?.status === "enabled"
      ? "生产可用"
      : item.provisioned
        ? "待配置"
        : "等待同步";
  if (item.availability === "setup_required") return "待配置";
  return "手工来源";
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

async function load() {
  const preserve = items.value.length > 0;
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
    if (linkedProviderId.value) {
      const linked = items.value.find((item) => item.provisioned?.id === linkedProviderId.value);
      message.value = linked ? `已定位关联来源：${linked.name}` : "关联来源不在当前来源目录中。";
    } else if (preserve) message.value = `已刷新 ${items.value.length} 个来源频道。`;
  } catch (error) {
    if (preserve) {
      state.value = "ready";
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
  <section class="source-center novice">
    <header class="source-guide">
      <div>
        <p>热点来源</p>
        <h2>多平台、多国家来源已自动登记</h2>
        <span>公开信息源由系统自动采集；需要登录的平台完成网页登录配置后才能运行。</span>
      </div>
      <div class="source-guide-actions">
        <small v-if="lastUpdatedAt">最近刷新 {{ lastUpdatedAt.slice(11, 19) }}</small>
        <button type="button" :disabled="refreshing" @click="load">
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
    <form class="source-filter" aria-label="来源目录筛选" @submit.prevent>
      <label class="source-search"
        >搜索来源<input
          v-model="query"
          type="search"
          autocomplete="off"
          placeholder="搜索 Amazon、eBay、Reddit、国家或来源网址"
      /></label>
      <label
        >业务类型<select v-model="category">
          <option value="">全部类型</option>
          <option value="news">新闻</option>
          <option value="ecommerce">电商平台</option>
          <option value="data">趋势数据</option>
          <option value="community">论坛社区</option>
          <option value="product_supply">商品供应链</option>
        </select></label
      ><label
        >准备状态<select v-model="availability">
          <option value="">全部状态</option>
          <option value="automatic">自动采集</option>
          <option value="setup_required">需要完成配置</option>
          <option value="manual">手动来源</option>
        </select></label
      ><label
        >市场<select v-model="market">
          <option value="">全部地区</option>
          <option v-for="item in marketOptions" :key="item" :value="item">{{ item }}</option>
        </select></label
      ><label
        >语言<select v-model="language">
          <option value="">全部语言</option>
          <option v-for="item in languageOptions" :key="item" :value="item">{{ item }}</option>
        </select></label
      ><label
        >接入模式<select v-model="accessMode">
          <option value="">全部接入模式</option>
          <option value="public_rss">公开 RSS/Atom</option>
          <option value="public_page">公开页面</option>
          <option value="authenticated_browser">网页登录</option>
          <option value="import">文件导入</option>
          <option value="manual">人工录入</option>
        </select></label
      ><label
        >排序<select v-model="sort">
          <option value="business">业务目录顺序</option>
          <option value="attention">待配置优先</option>
          <option value="name">名称顺序</option>
          <option value="recent">最近成功任务</option>
        </select></label
      ><button type="button" class="source-reset" @click="resetFilters">重置筛选</button>
      <span class="source-result-count">找到 {{ filtered.length }} 个来源</span>
    </form>
    <p v-if="message" class="source-message" role="status">
      {{ message }} <code v-if="requestId">{{ requestId }}</code>
    </p>
    <div v-if="state === 'loading'" class="source-state">正在读取来源目录…</div>
    <div v-else-if="state !== 'ready'" class="source-state" :data-kind="state">
      <strong>{{
        state === "empty"
          ? "还没有来源目录"
          : state === "expired"
            ? "登录已过期"
            : state === "forbidden"
              ? "当前账号不能管理平台来源"
              : "来源服务暂不可用"
      }}</strong>
      <p>{{ message }}</p>
      <button v-if="!['expired', 'forbidden'].includes(state)" @click="load">重新加载</button>
    </div>
    <section
      v-else
      id="source-results"
      class="source-purpose-groups"
      aria-label="按业务用途分组的热点来源"
    >
      <section v-for="group in groupedSources" :key="group.key" class="source-purpose-group">
        <header class="source-purpose-head">
          <div>
            <p>业务用途</p>
            <h3>{{ group.label }}</h3>
          </div>
          <span
            >{{ group.description }} 本页 {{ group.items.length }} 个，筛选结果共
            {{ group.total }} 个</span
          >
        </header>
        <div class="source-list">
          <article
            v-for="item in group.items"
            :key="item.code"
            :data-availability="item.availability"
          >
            <header>
              <div>
                <small>{{ categoryText(item.category) }} · {{ item.markets.join(" / ") }}</small>
                <h3>{{ item.name }}</h3>
              </div>
              <b>{{ statusText(item) }}</b>
            </header>
            <p>
              {{ item.policy_note }}
              <a
                v-if="item.target_url.startsWith('https://')"
                class="source-target"
                :href="item.target_url"
                target="_blank"
                rel="noopener noreferrer"
                >查看来源页面 ↗</a
              >
            </p>
            <dl>
              <div>
                <dt>采集方式</dt>
                <dd>{{ modeText(item.access_mode) }}</dd>
              </div>
              <div>
                <dt>频率</dt>
                <dd>
                  {{ item.provisioned?.schedule_minutes ?? item.schedule_minutes }}
                  分钟
                </dd>
              </div>
              <div>
                <dt>超时 / 重试</dt>
                <dd>
                  {{ item.provisioned?.timeout_ms ?? item.timeout_ms }} ms /
                  {{ item.provisioned?.retry_limit ?? item.retry_limit }} 次
                </dd>
              </div>
              <div>
                <dt>负责人</dt>
                <dd>{{ item.owner_label }}</dd>
              </div>
              <div>
                <dt>更新 SLA</dt>
                <dd>{{ slaText(item) }}</dd>
              </div>
              <div>
                <dt>最近成功任务</dt>
                <dd>{{ successText(item) }}</dd>
              </div>
              <div>
                <dt>影响范围</dt>
                <dd>
                  {{ categoryText(item.category) }} · {{ item.markets.join(" / ") }} ·
                  {{ item.fields.length }} 类字段
                </dd>
              </div>
            </dl>
            <footer>
              <span>{{ item.languages.join(" / ") }} · {{ item.fields.length }} 类数据字段</span
              ><button
                v-if="
                  item.provisioned &&
                  item.availability === 'automatic' &&
                  ['public_page', 'public_rss'].includes(item.access_mode)
                "
                type="button"
                :disabled="Boolean(testing)"
                @click="testSource(item)"
              >
                {{ testing === item.provisioned.id ? "测试中…" : "匿名测试" }}</button
              ><button v-if="item.provisioned" type="button" @click="beginEdit(item)">
                编辑采集设置</button
              ><button
                v-if="
                  item.provisioned &&
                  ['public_page', 'authenticated_browser'].includes(item.access_mode)
                "
                type="button"
                @click="loadCompatibility(item)"
              >
                解析兼容矩阵</button
              ><button
                v-if="item.provisioned"
                type="button"
                @click="loadConfigurationVersions(item)"
              >
                版本与回滚</button
              ><RouterLink
                v-if="item.access_mode === 'authenticated_browser'"
                :to="`/platform-admin/credentials?provider_code=${encodeURIComponent(item.code)}&mode=login`"
                >配置网页登录</RouterLink
              ><button
                v-if="item.code === '1688_search' && item.provisioned"
                type="button"
                @click="loadParserSamples(item)"
              >
                固定样本回放</button
              ><RouterLink
                v-if="item.code === '1688_search'"
                to="/platform-admin/providers/sources/1688-acceptance"
                >登录准备状态</RouterLink
              ><span v-if="!item.provisioned && item.access_mode !== 'authenticated_browser'"
                >等待系统登记</span
              >
            </footer>
          </article>
        </div>
      </section>
      <p v-if="!groupedSources.length" class="source-state">没有符合筛选条件的来源。</p>
      <nav v-if="filtered.length" class="source-pagination" aria-label="热点来源分页">
        <button type="button" :disabled="page === 1" @click="changePage(page - 1)">上一页</button>
        <span
          >第 {{ page }} / {{ totalPages }} 页 · 当前 {{ resultRange.start }}–{{
            resultRange.end
          }}，共 {{ filtered.length }} 个来源</span
        >
        <button type="button" :disabled="page === totalPages" @click="changePage(page + 1)">
          下一页
        </button>
      </nav>
    </section>
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

<style scoped>
.novice {
  display: grid;
  gap: 16px;
}
.source-guide {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-radius: 18px;
  background: linear-gradient(135deg, var(--so-panel-soft), var(--so-bg-elevated));
  color: var(--so-text);
}
.source-guide p {
  color: var(--so-primary);
  font-weight: 800;
  margin: 0;
}
.source-guide h2 {
  font-size: 28px;
  margin: 6px 0;
}
.source-guide span {
  opacity: 0.8;
}
.source-guide-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}
.source-guide-actions small {
  color: var(--so-text-muted);
}
.source-guide a,
.source-guide button {
  white-space: nowrap;
  color: var(--so-on-primary);
  background: var(--so-primary);
  padding: 11px 16px;
  border: 1px solid transparent;
  border-radius: 10px;
  font-weight: 800;
  text-decoration: none;
}
.source-guide button:disabled {
  cursor: wait;
  opacity: 0.65;
}
.source-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.source-metrics article {
  padding: 18px;
  border: 1px solid var(--so-border);
  border-radius: 14px;
  background: var(--so-panel);
  color: var(--so-text);
}
.source-metrics small,
.source-metrics span {
  display: block;
  color: var(--so-text-muted);
}
.source-metrics strong {
  display: block;
  margin: 5px 0;
  font-size: 28px;
}
.source-help {
  padding: 16px 20px;
  border: 1px solid color-mix(in srgb, var(--so-success) 35%, transparent);
  background: color-mix(in srgb, var(--so-success) 8%, var(--so-panel));
  border-radius: 13px;
  color: var(--so-text);
}
.source-help ol {
  margin: 8px 0 0;
  padding-left: 20px;
  color: var(--so-text-muted);
}
.source-filter {
  display: flex;
  align-items: end;
  flex-wrap: wrap;
  gap: 10px;
}
.source-filter label {
  display: grid;
  gap: 5px;
  color: var(--so-text-muted);
  font-size: 12px;
  font-weight: 700;
}
.source-filter label input,
.source-filter label select {
  padding: 10px;
  border: 1px solid var(--so-border);
  border-radius: 9px;
  color: var(--so-text);
  background: var(--so-panel-soft);
  font: inherit;
  font-weight: 500;
}
.source-filter .source-search {
  flex: 1;
  min-width: 280px;
}
.source-reset {
  min-height: 39px;
  padding: 9px 13px;
  border: 1px solid var(--so-border);
  border-radius: 9px;
  color: var(--so-text);
  background: var(--so-panel);
}
.source-result-count {
  align-self: center;
  margin-left: auto;
  color: var(--so-text-muted);
  white-space: nowrap;
}
.source-purpose-groups,
.source-purpose-group {
  display: grid;
  gap: 16px;
}
.source-purpose-group {
  padding: 16px;
  border: 1px solid var(--so-border);
  border-radius: 16px;
  background: color-mix(in srgb, var(--so-panel-soft) 58%, transparent);
}
.source-purpose-head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
}
.source-purpose-head p,
.source-purpose-head h3 {
  margin: 0;
}
.source-purpose-head p {
  color: var(--so-info);
  font-size: 13px;
}
.source-purpose-head span {
  color: var(--so-text-muted);
  text-align: right;
}
.source-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
.source-list article {
  display: grid;
  grid-template-columns:
    minmax(220px, 1.4fr) minmax(200px, 1fr) minmax(320px, 1.5fr)
    auto;
  align-items: center;
  gap: 16px;
  padding: 16px 18px;
  border: 1px solid var(--so-border);
  border-left: 5px solid var(--so-success);
  border-radius: 13px;
  background: var(--so-panel);
  color: var(--so-text);
}
.source-list article[data-availability="setup_required"] {
  border-left-color: var(--so-warning);
}
.source-list article[data-availability="manual"] {
  border-left-color: var(--so-info);
}
.source-list header,
.source-list footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.source-list article > header {
  min-width: 0;
}
.source-list article > p {
  margin: 0;
}
.source-target {
  display: block;
  margin-top: 6px;
  color: var(--so-info);
  font-size: 13px;
  overflow-wrap: anywhere;
  text-decoration: none;
}
.source-list h3 {
  margin: 4px 0;
}
.source-list small,
.source-list p,
.source-list footer,
.source-list dt {
  color: var(--so-text-muted);
}
.source-list b {
  white-space: nowrap;
  color: var(--so-success);
}
.source-list dl {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.source-list dl div {
  padding: 9px;
  border-radius: 8px;
  background: var(--so-panel-soft);
}
.source-list dt {
  font-size: 13px;
}
.source-list dd {
  margin: 5px 0 0;
}
.source-list footer {
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
}
.source-list footer button,
.source-list footer a {
  padding: 8px 10px;
  border-radius: 8px;
  color: var(--so-text);
  border: 1px solid var(--so-border);
  background: var(--so-panel-soft);
  text-decoration: none;
}
.source-message {
  padding: 12px 14px;
  border: 1px solid var(--so-border);
  border-radius: 10px;
  background: var(--so-panel-soft);
}
.source-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 8px 0 4px;
  color: var(--so-text-muted);
}
.source-pagination button {
  min-width: 88px;
  padding: 9px 14px;
  border: 1px solid var(--so-border);
  border-radius: 9px;
  color: var(--so-text);
  background: var(--so-panel);
}
.source-pagination button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
.source-state {
  padding: 30px;
  text-align: center;
}
@media (max-width: 760px) {
  .novice {
    padding-bottom: 76px;
  }
  .source-guide {
    align-items: flex-start;
    flex-direction: column;
    gap: 16px;
  }
  .source-guide-actions {
    width: 100%;
    justify-content: flex-start;
  }
  .source-metrics {
    grid-template-columns: 1fr 1fr;
  }
  .source-filter {
    flex-direction: column;
    align-items: stretch;
  }
  .source-filter label,
  .source-filter .source-search {
    width: 100%;
    min-width: 0;
  }
  .source-result-count {
    align-self: flex-start;
    margin-left: 0;
  }
  .source-purpose-group {
    padding: 12px;
  }
  .source-purpose-head {
    align-items: flex-start;
    flex-direction: column;
  }
  .source-purpose-head span {
    text-align: left;
  }
  .source-list {
    grid-template-columns: 1fr;
  }
  .source-list article {
    grid-template-columns: 1fr;
  }
  .source-list dl {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .source-pagination {
    align-items: stretch;
    flex-direction: column;
    text-align: center;
  }
}
</style>
