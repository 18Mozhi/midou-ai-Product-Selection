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
import UiStatePanel from "./UiStatePanel.vue";
import TrendDetailPanel from "./TrendDetailPanel.vue";
import TrendRelatedProducts from "./TrendRelatedProducts.vue";
import TrendFilterPanel from "./TrendFilterPanel.vue";
import TrendMetricExplainer from "./TrendMetricExplainer.vue";
import { statusLabel } from "../ui/status-labels";
import type {
  TrendDetail as Detail,
  TrendFilters,
  TrendSort,
  TrendTopic as Topic,
  TrendWorkspaceState as State,
} from "./trend-workspace-types";
import "../trends.css";
import "../trends-quality.css";
const props = defineProps<{
    apiBaseUrl: string;
    organizationId: string;
    workspaceId: string;
    capabilities: string[];
  }>(),
  route = useRoute(),
  router = useRouter(),
  request = createApiClient(props.apiBaseUrl),
  state = ref<State>("loading"),
  topics = ref<Topic[]>([]),
  selected = ref<Detail | null>(null),
  mobileDetailOpen = ref(typeof route.query.topic === "string"),
  requestId = ref(""),
  message = ref(""),
  busy = ref(""),
  total = ref(0),
  page = ref(1),
  sort = ref<TrendSort>("impact"),
  filters = reactive<TrendFilters>({ q: "", market: "", category: "", status: "active" });
let listReadGeneration = 0,
  topicDetailReadGeneration = 0,
  listReadController: AbortController | null = null,
  topicDetailReadController: AbortController | null = null,
  pageActive = true,
  wasDeactivated = false,
  activeListReadKey: string | null = null,
  queuedLoadKey: string | null = null,
  lastAutoLoadKey: string | null = null;
const freshness = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
const confidenceLabel = (topic: Topic) =>
  topic.confidence.status === "measured"
    ? `可信度 ${topic.confidence.score} / 100`
    : "可信度 数据不足";
const stateFrom = (kind: ApiFailureKind): State =>
  kind === "expired"
    ? "expired"
    : kind === "forbidden"
      ? "forbidden"
      : kind === "blocked" || kind === "rate_limited"
        ? "blocked"
        : "error";
const activeFilterCount = computed(
    () =>
      [filters.q, filters.market, filters.category].filter(Boolean).length +
      Number(filters.status !== "active"),
  ),
  pageCount = computed(() => Math.max(1, Math.ceil(total.value / 20))),
  sortedTopics = computed(() => {
    const items = [...topics.value];
    if (sort.value === "latest")
      return items.sort(
        (left, right) => Date.parse(right.last_seen_at) - Date.parse(left.last_seen_at),
      );
    if (sort.value === "momentum")
      return items.sort(
        (left, right) =>
          (right.momentum_percent ?? -Infinity) - (left.momentum_percent ?? -Infinity),
      );
    return items.sort(
      (left, right) => right.heat.value - left.heat.value || right.source_count - left.source_count,
    );
  });
async function read<T = any>(
  path: string,
  isCurrent: () => boolean = () => true,
  signal?: AbortSignal,
) {
  try {
    const response = await request<T>(path, signal ? { signal } : undefined);
    if (!isCurrent()) throw new Error("trend_read_superseded");
    requestId.value = response.request_id;
    return response;
  } catch (error) {
    if (!isCurrent()) throw error;
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      message.value = error.actionHint;
      state.value = stateFrom(error.kind);
    }
    throw error;
  }
}
async function load() {
  if (!pageActive) return;
  const readKey = JSON.stringify([
    page.value,
    filters.q,
    filters.market,
    filters.category,
    filters.status,
    props.organizationId,
    props.workspaceId,
  ]);
  if (activeListReadKey === readKey && listReadController && !listReadController.signal.aborted)
    return;
  lastAutoLoadKey = readKey;
  activeListReadKey = readKey;
  const generation = ++listReadGeneration;
  listReadController?.abort();
  const controller = new AbortController();
  listReadController = controller;
  const detailGeneration = ++topicDetailReadGeneration;
  topicDetailReadController?.abort();
  topicDetailReadController = null;
  const isCurrent = () =>
    pageActive && generation === listReadGeneration && !controller.signal.aborted;
  state.value = "loading";
  message.value = "";
  try {
    const params = new URLSearchParams({ page: String(page.value), page_size: "20" });
    for (const [key, value] of Object.entries(filters))
      if (value) params.set(key === "q" ? "q" : key, value);
    const list = await read(`/trends?${params}`, isCurrent, controller.signal);
    if (!isCurrent()) return;
    topics.value = list.data;
    total.value = (list.meta as { total: number }).total;
    if (detailGeneration !== topicDetailReadGeneration) return;
    const requestedTopic = typeof route.query.topic === "string" ? route.query.topic : "";
    const currentId =
      requestedTopic ||
      topics.value.find((item) => item.id === selected.value?.id)?.id ||
      topics.value[0]?.id;
    if (!currentId) {
      state.value = "empty";
      return;
    }
    const detailController = new AbortController();
    topicDetailReadController = detailController;
    const isCurrentDetail = () =>
      isCurrent() &&
      detailGeneration === topicDetailReadGeneration &&
      !detailController.signal.aborted;
    const topicDetail = (
      await read(`/trends/${currentId}`, isCurrentDetail, detailController.signal)
    ).data as Detail;
    if (!isCurrentDetail()) return;
    selected.value = {
      ...topicDetail,
      relevance_history: topicDetail.relevance_history ?? [],
    };
    state.value = "ready";
    if (requestedTopic !== currentId)
      await router.replace({ query: { ...route.query, topic: currentId } });
  } catch (error) {
    if (!isCurrent() || detailGeneration !== topicDetailReadGeneration) return;
    if (!(error instanceof ApiClientError)) state.value = "blocked";
  } finally {
    if (generation === listReadGeneration) {
      activeListReadKey = null;
      listReadController = null;
    }
  }
}
function queueLoad() {
  if (!pageActive) return;
  const key = JSON.stringify([
    page.value,
    filters.q,
    filters.market,
    filters.category,
    filters.status,
    props.organizationId,
    props.workspaceId,
  ]);
  if (queuedLoadKey === key || lastAutoLoadKey === key) return;
  lastAutoLoadKey = key;
  queuedLoadKey = key;
  queueMicrotask(() => {
    if (queuedLoadKey !== key) return;
    queuedLoadKey = null;
    if (pageActive) void load();
  });
}
async function selectTopic(topic: Topic) {
  if (selected.value?.id !== topic.id) busy.value = "detail";
  mobileDetailOpen.value = true;
  await router.push({ query: { ...route.query, topic: topic.id, section: undefined } });
}

function returnToTopicList() {
  mobileDetailOpen.value = false;
}
function syncFromRoute() {
  filters.q = typeof route.query.q === "string" ? route.query.q : "";
  filters.market = typeof route.query.market === "string" ? route.query.market : "";
  filters.category = typeof route.query.category === "string" ? route.query.category : "";
  filters.status = typeof route.query.status === "string" ? route.query.status : "active";
  const requestedPage = Number(route.query.page ?? 1);
  page.value = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  sort.value = ["impact", "latest", "momentum"].includes(String(route.query.sort))
    ? (route.query.sort as typeof sort.value)
    : "impact";
  if (
    route.query.section !== undefined ||
    route.query.tab !== undefined ||
    route.query.sort === "followed"
  )
    void router.replace({
      query: {
        ...route.query,
        section: undefined,
        tab: undefined,
        sort: sort.value === "impact" ? undefined : sort.value,
      },
    });
}
async function applyFilters() {
  const previousPath = route.fullPath;
  await router.push({
    query: {
      ...route.query,
      q: filters.q || undefined,
      market: filters.market || undefined,
      category: filters.category || undefined,
      status: filters.status === "active" ? undefined : filters.status,
      sort: sort.value === "impact" ? undefined : sort.value,
      page: undefined,
      topic: undefined,
      section: undefined,
    },
  });
  if (route.fullPath === previousPath) await load();
}
async function clearFilters() {
  Object.assign(filters, { q: "", market: "", category: "", status: "active" });
  sort.value = "impact";
  await applyFilters();
}
async function recoverTopics() {
  if (state.value === "empty") await clearFilters();
  else await load();
}
async function goPage(nextPage: number) {
  if (nextPage < 1 || nextPage > pageCount.value) return;
  await router.push({
    query: { ...route.query, page: nextPage === 1 ? undefined : nextPage, topic: undefined },
  });
}
watch(
  () => [
    route.query.q,
    route.query.market,
    route.query.category,
    route.query.status,
    route.query.page,
  ],
  () => {
    syncFromRoute();
    queueLoad();
  },
);
watch(
  () => route.query.topic,
  async (topicId) => {
    const generation = ++topicDetailReadGeneration;
    topicDetailReadController?.abort();
    topicDetailReadController = null;
    if (typeof topicId !== "string" || selected.value?.id === topicId) {
      if (busy.value === "detail") busy.value = "";
      return;
    }
    if (!pageActive) {
      if (busy.value === "detail") busy.value = "";
      return;
    }
    const controller = new AbortController();
    topicDetailReadController = controller;
    const isCurrent = () =>
      pageActive && generation === topicDetailReadGeneration && !controller.signal.aborted;
    busy.value = "detail";
    try {
      const topicDetail = (await read(`/trends/${topicId}`, isCurrent, controller.signal))
        .data as Detail;
      if (!isCurrent()) return;
      selected.value = {
        ...topicDetail,
        relevance_history: topicDetail.relevance_history ?? [],
      };
      state.value = "ready";
    } catch {
      if (!isCurrent()) return;
    } finally {
      if (isCurrent() && busy.value === "detail") busy.value = "";
    }
  },
  { flush: "sync" },
);
watch(
  () => [route.query.section, route.query.tab, route.query.sort],
  () => syncFromRoute(),
);
watch(
  () => [props.organizationId, props.workspaceId],
  () => {
    selected.value = null;
    topics.value = [];
    lastAutoLoadKey = null;
    queueLoad();
  },
);
onMounted(() => {
  syncFromRoute();
  void load();
});
onDeactivated(() => {
  pageActive = false;
  wasDeactivated = true;
  queuedLoadKey = null;
  lastAutoLoadKey = null;
  listReadGeneration += 1;
  topicDetailReadGeneration += 1;
  listReadController?.abort();
  topicDetailReadController?.abort();
  listReadController = null;
  topicDetailReadController = null;
  if (busy.value === "detail") busy.value = "";
});
onActivated(() => {
  pageActive = true;
  if (!wasDeactivated) return;
  wasDeactivated = false;
  syncFromRoute();
  queueLoad();
});
onBeforeUnmount(() => {
  pageActive = false;
  listReadGeneration += 1;
  topicDetailReadGeneration += 1;
  listReadController?.abort();
  topicDetailReadController?.abort();
  listReadController = null;
  topicDetailReadController = null;
  activeListReadKey = null;
  queuedLoadKey = null;
  lastAutoLoadKey = null;
});
</script>

<template>
  <section class="trend-dashboard trend-dashboard--review">
    <header class="trend-market-heading">
      <div>
        <h2>
          市场情报 <span v-if="state === 'ready' || state === 'empty'">{{ total }} 个主题</span>
        </h2>
        <p>查看来源证据，追踪商品需求线索</p>
      </div>
      <div class="trend-market-actions">
        <button
          type="button"
          class="so-action-secondary"
          :disabled="state === 'loading'"
          @click="load"
        >
          刷新情报
        </button>
      </div>
    </header>
    <p v-if="message" class="trend-message" role="status">
      {{ message }} <code v-if="requestId">{{ requestId }}</code>
    </p>
    <TrendFilterPanel
      :filters="filters"
      :sort="sort"
      :active-count="activeFilterCount"
      @apply="applyFilters"
      @clear="clearFilters"
      @update-filters="Object.assign(filters, $event)"
      @update-sort="sort = $event"
    />
    <UiStatePanel
      v-if="state !== 'ready'"
      :kind="state"
      :request-id="requestId"
      :primary-label="state === 'empty' ? '清除筛选并恢复' : '重新加载'"
      :hide-secondary="true"
      @primary="recoverTopics"
    />
    <div v-else class="trend-workbench" :class="{ 'is-mobile-detail-open': mobileDetailOpen }">
      <section id="trend-list" class="trend-list">
        <header>
          <div>
            <strong>情报列表</strong><span>共 {{ total }} 个主题</span>
          </div>
          <small>{{ sort === "impact" ? "按影响程度排序" : "按所选视图排序" }}</small>
        </header>
        <button
          v-for="(topic, index) in sortedTopics"
          :key="topic.id"
          type="button"
          :aria-pressed="selected?.id === topic.id"
          @click="selectTopic(topic)"
        >
          <span class="topic-index" aria-hidden="true">{{ (page - 1) * 20 + index + 1 }}</span
          ><span
            ><strong>{{ topic.title }}</strong
            ><small
              >{{ topic.market }} · {{ topic.category || "未分类" }} ·
              {{ statusLabel(topic.status) }}</small
            ><small
              >{{ topic.source_count }} 个来源 · 新鲜度
              {{ freshness(topic.source_fresh_at) }}</small
            ><small>{{ confidenceLabel(topic) }}</small></span
          ><span class="topic-heat"
            ><b>{{ topic.heat.value }}</b
            ><small>条信号</small></span
          ><em :data-status="topic.status">{{ statusLabel(topic.status) }}</em>
        </button>
        <footer class="trend-pagination" aria-label="趋势分页">
          <button type="button" :disabled="page <= 1" @click="goPage(page - 1)">上一页</button>
          <span>第 {{ page }} / {{ pageCount }} 页</span>
          <button type="button" :disabled="page >= pageCount" @click="goPage(page + 1)">
            下一页
          </button>
        </footer>
      </section>
      <TrendDetailPanel v-if="selected" :detail="selected" :busy="busy" @back="returnToTopicList">
        <template #related-products>
          <TrendRelatedProducts
            v-if="capabilities.includes('opportunity:read')"
            :api-base-url="apiBaseUrl"
            :topic-id="selected.id"
            :organization-id="organizationId"
            :workspace-id="workspaceId"
          />
        </template>
      </TrendDetailPanel>
    </div>
    <TrendMetricExplainer />
  </section>
</template>
