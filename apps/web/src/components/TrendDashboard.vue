<script setup lang="ts">
import {
  computed,
  nextTick,
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
import TrendEvidenceDialogs from "./TrendEvidenceDialogs.vue";
import UiStatePanel from "./UiStatePanel.vue";
import MonitoringReadinessStrip from "./shared/MonitoringReadinessStrip.vue";
import { buildTrendMonitoringReadiness } from "./shared/monitoring-readiness";
import TrendDetailPanel from "./TrendDetailPanel.vue";
import TrendFilterPanel from "./TrendFilterPanel.vue";
import TrendChangeQueue from "./TrendChangeQueue.vue";
import TrendRuleDialog, { type TrendRuleDraft } from "./TrendRuleDialog.vue";
import TrendRuleList from "./TrendRuleList.vue";
import TrendMetricExplainer from "./TrendMetricExplainer.vue";
import { statusLabel } from "../ui/status-labels";
import type {
  TrendDetail as Detail,
  TrendFilters,
  TrendRule as Rule,
  TrendSort,
  TrendTopic as Topic,
  TrendTopicChangeRequest,
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
  rules = ref<Rule[]>([]),
  changeRequests = ref<TrendTopicChangeRequest[]>([]),
  requestId = ref(""),
  message = ref(""),
  busy = ref(""),
  tab = ref<"topics" | "rules" | "governance">("topics"),
  showRule = ref(false),
  anomalyEvidence = ref<Detail["evidence"][number] | null>(null),
  anomalySeverity = ref<"warning" | "critical">("warning"),
  anomalyReason = ref(""),
  qualityIssueIds = reactive<Record<string, string>>({}),
  relevanceDialog = ref<"active" | "irrelevant" | null>(null),
  relevanceReason = ref(""),
  evidenceDialogs = ref<{ discardAnomalyReturnFocus: () => void } | null>(null),
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
const canManageTrends = computed(() => props.capabilities.includes("trend:manage")),
  enabledRules = computed(() => rules.value.filter((item) => item.status === "enabled")),
  evaluatedRuleCount = computed(
    () => enabledRules.value.filter((item) => Boolean(item.last_evaluated_at)).length,
  ),
  failedRuleSources = computed(() => [
    ...new Set(enabledRules.value.flatMap((item) => item.last_failed_sources)),
  ]),
  trendReadiness = computed(() =>
    buildTrendMonitoringReadiness({
      loading: state.value === "loading",
      enabledRules: enabledRules.value.length,
      evaluatedRules: evaluatedRuleCount.value,
      totalTopics: total.value,
      failedSources: failedRuleSources.value.length,
    }),
  ),
  activeFilterCount = computed(
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
    if (sort.value === "followed")
      return items.sort(
        (left, right) =>
          Number(right.followed) - Number(left.followed) || right.heat.value - left.heat.value,
      );
    return items.sort(
      (left, right) => right.heat.value - left.heat.value || right.source_count - left.source_count,
    );
  });
const opportunityRoute = computed(() => {
  const topic = selected.value;
  if (!topic) return "/opportunities";
  return (
    "/opportunities" +
    `?source_topic_id=${encodeURIComponent(topic.id)}` +
    `&name=${encodeURIComponent(topic.title)}` +
    `&market=${encodeURIComponent(topic.market)}` +
    `&category=${encodeURIComponent(topic.category || "")}`
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
    canManageTrends.value,
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
    const governanceRequest = canManageTrends.value
      ? read("/trends/change-requests", isCurrent, controller.signal)
      : Promise.resolve({ data: [] });
    const [list, ruleList, governanceList] = await Promise.all([
      read(`/trends?${params}`, isCurrent, controller.signal),
      read("/trends/monitoring-rules", isCurrent, controller.signal),
      governanceRequest,
    ]);
    if (!isCurrent()) return;
    topics.value = list.data;
    rules.value = ruleList.data.map((item: Rule) => ({
      ...item,
      last_failed_sources: item.last_failed_sources ?? [],
    }));
    changeRequests.value = governanceList.data;
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
    canManageTrends.value,
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
  sort.value = ["impact", "latest", "momentum", "followed"].includes(String(route.query.sort))
    ? (route.query.sort as typeof sort.value)
    : "impact";
  const rulesRequested = route.query.section === "rules" || route.query.tab === "rules";
  const governanceRequested = route.query.section === "governance";
  tab.value = rulesRequested
    ? "rules"
    : governanceRequested && canManageTrends.value
      ? "governance"
      : "topics";
  if (governanceRequested && !canManageTrends.value)
    void router.replace({ query: { ...route.query, section: undefined } });
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
async function setTab(nextTab: "topics" | "rules" | "governance") {
  if (nextTab === "governance" && !canManageTrends.value) return;
  await router.push({
    query: {
      ...route.query,
      tab: undefined,
      section: nextTab === "topics" ? undefined : nextTab,
    },
  });
}
async function saveViewLink() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    message.value = "当前排序、筛选和页码链接已复制，可作为此视图入口。";
  } catch {
    message.value = "当前视图已同步到地址栏，可复制地址保存。";
  }
}
async function viewRuleTopics(item: Rule) {
  filters.q = item.include_keywords[0] ?? "";
  await applyFilters();
}
async function write(path: string, method: string, body?: unknown) {
  busy.value = path;
  message.value = "";
  try {
    const response = await request<any>(path, {
      method,
      ...(body ? { body } : {}),
    });
    requestId.value = response.request_id;
    return response.data;
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      message.value = error.actionHint;
      return null;
    }
    message.value = "依赖暂不可用，未写入任何状态。";
    return null;
  } finally {
    busy.value = "";
  }
}
function requireTrendManage() {
  if (canManageTrends.value) return true;
  message.value = "当前账号仅有趋势查看权限，管理操作未执行。";
  return false;
}
async function follow() {
  const target = selected.value;
  if (!target || !requireTrendManage()) return;
  const result = await write(`/trends/${target.id}/follow`, target.followed ? "DELETE" : "PUT");
  if (result) {
    target.followed = result.followed;
    const item = topics.value.find((topic) => topic.id === target.id);
    if (item) item.followed = result.followed;
    message.value = result.followed ? "已关注该主题。" : "已取消关注。";
  }
}
async function markIrrelevant() {
  if (!selected.value || !relevanceDialog.value || !requireTrendManage()) return;
  const targetStatus = relevanceDialog.value;
  const result = await write(`/trends/${selected.value.id}/relevance`, "POST", {
    status: targetStatus,
    reason: relevanceReason.value.trim(),
    expected_version: selected.value.version,
  });
  if (!result) return;
  relevanceDialog.value = null;
  relevanceReason.value = "";
  message.value =
    targetStatus === "active"
      ? "已恢复为相关主题；历史原因完整保留。"
      : "已标记无关；原始证据与原因保留。";
  await load();
}
function openRelevance(status: "active" | "irrelevant") {
  if (!requireTrendManage()) return;
  relevanceReason.value = "";
  relevanceDialog.value = status;
}
function openAnomaly(item: Detail["evidence"][number]) {
  if (!requireTrendManage()) return;
  anomalyEvidence.value = item;
  anomalySeverity.value = "warning";
  anomalyReason.value = "";
}
async function createQualityIssue() {
  if (!selected.value || !anomalyEvidence.value || !requireTrendManage()) return;
  const evidenceId = anomalyEvidence.value.id,
    result = await write(
      `/trends/${selected.value.id}/evidence/${evidenceId}/quality-issues`,
      "POST",
      { severity: anomalySeverity.value, reason: anomalyReason.value.trim() },
    );
  if (!result) return;
  qualityIssueIds[evidenceId] = result.issue.id;
  evidenceDialogs.value?.discardAnomalyReturnFocus();
  anomalyEvidence.value = null;
  anomalyReason.value = "";
  message.value = result.created
    ? `质量工单 ${result.issue.id} 已创建，可在数据质量页继续处理。`
    : `该证据已有未关闭质量工单 ${result.issue.id}，请直接继续处理。`;
  await nextTick();
  document.querySelector<HTMLButtonElement>('.trend-tabs button[aria-current="page"]')?.focus();
}
async function createRule(form: TrendRuleDraft) {
  if (!requireTrendManage()) return;
  const result = await write("/trends/monitoring-rules", "POST", form);
  if (result) {
    showRule.value = false;
    await load();
    message.value = "监控规则已启用；命中来源门槛只会形成规则命中候选。";
    await setTab("rules");
  }
}
async function toggleRule(item: Rule) {
  if (!requireTrendManage()) return;
  const result = await write(`/trends/monitoring-rules/${item.id}`, "PATCH", {
    status: item.status === "enabled" ? "paused" : "enabled",
    expected_version: item.version,
    collection_interval_minutes: item.collection_interval_minutes,
    recommendation_min_source_count: item.recommendation_min_source_count,
  });
  if (result) {
    Object.assign(item, result);
    message.value = item.status === "enabled" ? "规则已启用。" : "规则已暂停。";
  }
}
async function proposeTopicChange(payload: Record<string, unknown>) {
  if (!requireTrendManage()) return;
  const result = await write("/trends/change-requests", "POST", payload);
  if (!result) return;
  await load();
  await setTab("governance");
  message.value = "治理提议已进入确认队列；需要另一位趋势管理员确认。";
}
async function decideTopicChange(payload: {
  requestId: string;
  decision: "confirm" | "reject";
  reason: string;
  expectedVersion: number;
}) {
  if (!requireTrendManage()) return;
  const result = await write(`/trends/change-requests/${payload.requestId}/decisions`, "POST", {
    decision: payload.decision,
    reason: payload.reason,
    expected_version: payload.expectedVersion,
  });
  if (!result) return;
  await load();
  message.value =
    payload.decision === "confirm"
      ? "主题治理已确认执行；信号、关注和允许迁移的机会关联已同步。"
      : "治理提议已驳回并保留处理说明。";
}
async function refreshHotspots() {
  const result = await write("/provider-sources/refresh", "POST", {
    organization_id: props.organizationId,
    workspace_id: props.workspaceId,
  });
  if (result)
    message.value = `已开始从 ${result.source_count} 个实时频道获取热点，通常几分钟内出现在列表中。`;
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
watch(canManageTrends, (allowed) => {
  if (allowed && pageActive) {
    lastAutoLoadKey = null;
    queueLoad();
    return;
  }
  changeRequests.value = [];
  showRule.value = false;
  anomalyEvidence.value = null;
  relevanceDialog.value = null;
  if (tab.value === "governance") void setTab("topics");
});
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
    <MonitoringReadinessStrip
      eyebrow="市场质量门 · 证据就绪"
      :title="trendReadiness.summary.title"
      description="这里确认市场证据是否持续产出；单个商品是否通过市场质量门，仍以机会详情中的真实评分输入为准。"
      :status="trendReadiness.summary.status"
      :tone="trendReadiness.summary.tone"
      :facts="trendReadiness.facts"
    >
      <button
        v-if="canManageTrends"
        class="primary so-action-primary"
        type="button"
        @click="showRule = true"
      >
        {{ enabledRules.length ? "创建趋势监控" : "创建第一条监控规则" }}
      </button>
      <button class="secondary" type="button" :disabled="Boolean(busy)" @click="refreshHotspots">
        {{ busy === "/provider-sources/refresh" ? "正在启动…" : "立即刷新来源" }}
      </button>
      <button type="button" @click="setTab('rules')">管理监控规则</button>
    </MonitoringReadinessStrip>
    <nav class="trend-tabs" aria-label="热点趋势视图">
      <button :aria-current="tab === 'topics' ? 'page' : undefined" @click="setTab('topics')">
        趋势主题</button
      ><button :aria-current="tab === 'rules' ? 'page' : undefined" @click="setTab('rules')">
        监控规则 <b>{{ rules.length }}</b></button
      ><button
        v-if="canManageTrends"
        :aria-current="tab === 'governance' ? 'page' : undefined"
        @click="setTab('governance')"
      >
        合并与拆分 <b>{{ changeRequests.filter((item) => item.status === "pending").length }}</b>
      </button>
    </nav>
    <p v-if="message" class="trend-message" role="status">
      {{ message }} <code v-if="requestId">{{ requestId }}</code>
    </p>
    <template v-if="tab === 'topics'">
      <TrendFilterPanel
        :filters="filters"
        :sort="sort"
        :active-count="activeFilterCount"
        @apply="applyFilters"
        @clear="clearFilters"
        @save-view="saveViewLink"
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
              <strong>趋势列表</strong><span>共 {{ total }} 个主题</span>
            </div>
            <small>{{ sort === "impact" ? "按影响程度排序" : "按所选视图排序" }}</small>
          </header>
          <button
            v-for="topic in sortedTopics"
            :key="topic.id"
            type="button"
            :aria-pressed="selected?.id === topic.id"
            @click="selectTopic(topic)"
          >
            <span class="topic-mark" :data-followed="topic.followed" aria-hidden="true"></span
            ><span
              ><strong>{{ topic.title }}</strong
              ><small
                >{{ topic.market }} · {{ topic.category || "未分类" }} ·
                {{ statusLabel(topic.status) }}</small
              ><small
                >{{ topic.source_count }} 个来源 · 新鲜度
                {{ freshness(topic.source_fresh_at) }}</small
              ><small
                >{{ confidenceLabel(topic)
                }}<template v-if="topic.followed"> · 已关注</template></small
              ></span
            ><span class="topic-heat"
              ><b>{{ topic.heat.value }}</b
              ><small>热度 / 条信号</small></span
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
        <TrendDetailPanel
          v-if="selected"
          :detail="selected"
          :busy="busy"
          :quality-issue-ids="qualityIssueIds"
          :opportunity-route="opportunityRoute"
          :can-manage="canManageTrends"
          @back="returnToTopicList"
          @follow="follow"
          @create-rule="showRule = true"
          @change-relevance="openRelevance"
          @report-anomaly="openAnomaly"
        />
      </div>
      <TrendMetricExplainer />
    </template>
    <TrendRuleList
      v-else-if="tab === 'rules'"
      :state="state"
      :request-id="requestId"
      :rules="rules"
      :can-manage="canManageTrends"
      @reload="load"
      @create="showRule = true"
      @toggle="toggleRule"
      @view-topics="viewRuleTopics"
    />
    <TrendChangeQueue
      v-else-if="canManageTrends"
      :topics="topics"
      :selected="selected"
      :requests="changeRequests"
      :busy="busy"
      @propose="proposeTopicChange"
      @decide="decideTopicChange"
    />
    <TrendRuleDialog
      :open="showRule && canManageTrends"
      :busy="Boolean(busy)"
      @close="showRule = false"
      @submit="createRule"
    />
    <TrendEvidenceDialogs
      ref="evidenceDialogs"
      v-model:anomaly-evidence="anomalyEvidence"
      v-model:anomaly-severity="anomalySeverity"
      v-model:anomaly-reason="anomalyReason"
      v-model:relevance-dialog="relevanceDialog"
      v-model:relevance-reason="relevanceReason"
      :can-manage="canManageTrends"
      :busy="busy"
      @create-quality-issue="createQualityIssue"
      @mark-irrelevant="markIrrelevant"
    />
  </section>
</template>
