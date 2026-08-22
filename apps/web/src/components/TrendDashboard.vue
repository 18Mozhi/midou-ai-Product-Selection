<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ApiClientError, createApiClient, type ApiFailureKind } from "../api-client";
import UiStatePanel from "./UiStatePanel.vue";
import TrendDetailPanel from "./TrendDetailPanel.vue";
import TrendFilterPanel from "./TrendFilterPanel.vue";
import TrendChangeQueue from "./TrendChangeQueue.vue";
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
  }>(),
  route = useRoute(),
  router = useRouter(),
  request = createApiClient(props.apiBaseUrl),
  state = ref<State>("loading"),
  topics = ref<Topic[]>([]),
  selected = ref<Detail | null>(null),
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
  total = ref(0),
  page = ref(1),
  sort = ref<TrendSort>("impact"),
  masterWidth = ref(38),
  filters = reactive<TrendFilters>({ q: "", market: "", category: "", status: "active" }),
  form = reactive({
    name: "",
    include_keywords: "",
    negative_keywords: "",
    market: "US",
    language: "en-US",
    category: "",
    collection_interval_minutes: 60,
  });
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
const activeFilterCount = computed(() => Object.values(filters).filter(Boolean).length),
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
async function read<T = any>(path: string) {
  try {
    const response = await request<T>(path);
    requestId.value = response.request_id;
    return response;
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      message.value = error.actionHint;
      state.value = stateFrom(error.kind);
    }
    throw error;
  }
}
async function load() {
  state.value = "loading";
  message.value = "";
  try {
    const params = new URLSearchParams({ page: String(page.value), page_size: "20" });
    for (const [key, value] of Object.entries(filters))
      if (value) params.set(key === "q" ? "q" : key, value);
    const [list, ruleList, governanceList] = await Promise.all([
      read(`/trends?${params}`),
      read("/trends/monitoring-rules"),
      read("/trends/change-requests"),
    ]);
    topics.value = list.data;
    rules.value = ruleList.data.map((item: Rule) => ({
      ...item,
      last_failed_sources: item.last_failed_sources ?? [],
    }));
    changeRequests.value = governanceList.data;
    total.value = (list.meta as { total: number }).total;
    const requestedTopic = typeof route.query.topic === "string" ? route.query.topic : "";
    const currentId =
      requestedTopic ||
      topics.value.find((item) => item.id === selected.value?.id)?.id ||
      topics.value[0]?.id;
    if (!currentId) {
      state.value = "empty";
      return;
    }
    const topicDetail = (await read(`/trends/${currentId}`)).data as Detail;
    selected.value = {
      ...topicDetail,
      relevance_history: topicDetail.relevance_history ?? [],
    };
    state.value = "ready";
    if (requestedTopic !== currentId)
      await router.replace({ query: { ...route.query, topic: currentId } });
  } catch (error) {
    if (!(error instanceof ApiClientError)) state.value = "blocked";
  }
}
async function selectTopic(topic: Topic) {
  await router.push({ query: { ...route.query, topic: topic.id, section: undefined } });
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
  tab.value =
    route.query.section === "rules"
      ? "rules"
      : route.query.section === "governance"
        ? "governance"
        : "topics";
}
async function applyFilters() {
  const previousPath = route.fullPath;
  await router.push({
    query: {
      ...route.query,
      q: filters.q || undefined,
      market: filters.market || undefined,
      category: filters.category || undefined,
      status: filters.status === "active" ? undefined : filters.status || undefined,
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
  await router.push({
    query: {
      ...route.query,
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
async function follow() {
  if (!selected.value) return;
  const result = await write(
    `/trends/${selected.value.id}/follow`,
    selected.value.followed ? "DELETE" : "PUT",
  );
  if (result) {
    selected.value.followed = result.followed;
    const item = topics.value.find((topic) => topic.id === selected.value?.id);
    if (item) item.followed = result.followed;
    message.value = result.followed ? "已关注该主题。" : "已取消关注。";
  }
}
async function markIrrelevant() {
  if (!selected.value || !relevanceDialog.value) return;
  const targetStatus = relevanceDialog.value;
  const result = await write(`/trends/${selected.value.id}/relevance`, "POST", {
    status: targetStatus,
    reason: relevanceReason.value.trim(),
    expected_version: selected.value.version,
  });
  relevanceDialog.value = null;
  relevanceReason.value = "";
  if (result) {
    message.value =
      targetStatus === "active"
        ? "已恢复为相关主题；历史原因完整保留。"
        : "已标记无关；原始证据与原因保留。";
    await load();
  }
}
function openRelevance(status: "active" | "irrelevant") {
  relevanceReason.value = "";
  relevanceDialog.value = status;
}
function openAnomaly(item: Detail["evidence"][number]) {
  anomalyEvidence.value = item;
  anomalySeverity.value = "warning";
  anomalyReason.value = "";
}
async function createQualityIssue() {
  if (!selected.value || !anomalyEvidence.value) return;
  const evidenceId = anomalyEvidence.value.id,
    result = await write(
      `/trends/${selected.value.id}/evidence/${evidenceId}/quality-issues`,
      "POST",
      { severity: anomalySeverity.value, reason: anomalyReason.value.trim() },
    );
  if (!result) return;
  qualityIssueIds[evidenceId] = result.issue.id;
  anomalyEvidence.value = null;
  anomalyReason.value = "";
  message.value = result.created
    ? `质量工单 ${result.issue.id} 已创建，可在数据质量页继续处理。`
    : `该证据已有未关闭质量工单 ${result.issue.id}，请直接继续处理。`;
}
async function createRule() {
  const result = await write("/trends/monitoring-rules", "POST", {
    name: form.name,
    include_keywords: form.include_keywords
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    negative_keywords: form.negative_keywords
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    market: form.market,
    language: form.language,
    category: form.category || null,
    notification_channel: "in_app",
    collection_interval_minutes: form.collection_interval_minutes,
  });
  if (result) {
    showRule.value = false;
    Object.assign(form, {
      name: "",
      include_keywords: "",
      negative_keywords: "",
      market: "US",
      language: "en-US",
      category: "",
      collection_interval_minutes: 60,
    });
    await load();
    message.value = "监控规则已启用；当前仅发送站内通知。";
    await setTab("rules");
  }
}
async function toggleRule(item: Rule) {
  const result = await write(`/trends/monitoring-rules/${item.id}`, "PATCH", {
    status: item.status === "enabled" ? "paused" : "enabled",
    expected_version: item.version,
    collection_interval_minutes: item.collection_interval_minutes,
  });
  if (result) {
    Object.assign(item, result);
    message.value = item.status === "enabled" ? "规则已启用。" : "规则已暂停。";
  }
}
async function proposeTopicChange(payload: Record<string, unknown>) {
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
    void load();
  },
);
watch(
  () => route.query.topic,
  async (topicId) => {
    if (typeof topicId !== "string" || selected.value?.id === topicId) return;
    busy.value = "detail";
    try {
      const topicDetail = (await read(`/trends/${topicId}`)).data as Detail;
      selected.value = {
        ...topicDetail,
        relevance_history: topicDetail.relevance_history ?? [],
      };
    } finally {
      busy.value = "";
    }
  },
);
watch(
  () => [route.query.section, route.query.sort],
  () => syncFromRoute(),
);
onMounted(() => {
  syncFromRoute();
  void load();
});
</script>

<template>
  <section class="trend-dashboard">
    <header class="trend-hero">
      <div>
        <p>全网热点雷达</p>
        <h2>系统自动找热点，你也可以马上刷新</h2>
        <span>新闻、电商、数据与社区频道每 15 分钟自动采集；所有结论都能打开原文核对。</span>
      </div>
      <div>
        <button type="button" :disabled="Boolean(busy)" @click="refreshHotspots">
          {{
            busy === "/provider-sources/refresh" ? "正在启动，预计 1–3 分钟" : "立即获取热点"
          }}</button
        ><button type="button" @click="showRule = true">＋ 创建监控</button
        ><button class="secondary" type="button" @click="setTab('rules')">订阅管理</button>
      </div>
    </header>
    <nav class="trend-tabs" aria-label="热点趋势视图">
      <button :aria-current="tab === 'topics' ? 'page' : undefined" @click="setTab('topics')">
        趋势主题</button
      ><button :aria-current="tab === 'rules' ? 'page' : undefined" @click="setTab('rules')">
        监控规则 <b>{{ rules.length }}</b></button
      ><button
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
        @primary="recoverTopics"
      />
      <div v-else class="trend-workbench" :style="{ '--trend-master-width': `${masterWidth}%` }">
        <section id="trend-list" class="trend-list">
          <header>
            <div>
              <strong>趋势列表</strong><span>共 {{ total }} 个主题</span>
            </div>
            <label class="trend-width-control"
              >列表宽度<input
                v-model.number="masterWidth"
                type="range"
                min="32"
                max="48"
                step="2"
                aria-label="调整趋势列表宽度" /></label
            ><small>{{ sort === "impact" ? "按影响程度排序" : "按所选视图排序" }}</small>
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
          @follow="follow"
          @create-rule="showRule = true"
          @change-relevance="openRelevance"
          @report-anomaly="openAnomaly"
        />
      </div>
      <details class="trend-explainer">
        <summary>帮助：热点趋势怎么看</summary>
        <div>
          <p>热点趋势怎么看</p>
          <h3>不是热搜榜，而是可追溯的选品信号</h3>
          <span
            >系统定时抓取公开页面，把同一话题合并后展示热度、增长速度、来源数量和证据；点击任一热点可核对原始来源。</span
          >
        </div>
        <ol>
          <li><b>热度</b><span>当前收集到的相关信号数</span></li>
          <li><b>增速</b><span>近期相对上一周期的变化</span></li>
          <li><b>来源</b><span>支持结论的独立站点数量</span></li>
          <li><b>可信度</b><span>按证据数量与新鲜度计算</span></li>
        </ol>
      </details>
    </template>
    <section v-else-if="tab === 'rules'" class="trend-rules">
      <header>
        <div>
          <p>订阅规则</p>
          <h3>趋势监控规则</h3>
          <span>当前仅提供站内通知；邮件服务未确认，不显示为已接通。</span>
        </div>
        <button type="button" @click="showRule = true">＋ 创建规则</button>
      </header>
      <UiStatePanel
        v-if="state !== 'ready' && state !== 'empty'"
        :kind="state"
        :request-id="requestId"
        @primary="load"
      />
      <div v-else-if="!rules.length" class="trend-rule-empty">
        <strong>还没有监控规则</strong><span>按关键词、市场和语言建立第一条规则。</span
        ><button type="button" @click="showRule = true">创建监控规则</button>
      </div>
      <article v-for="item in rules" :key="item.id">
        <div>
          <b :data-status="item.status">{{ statusLabel(item.status) }}</b>
          <h4>{{ item.name }}</h4>
          <span>{{ item.market }} · {{ item.language }} · {{ item.category || "全部分类" }}</span>
        </div>
        <p>
          <strong>包含</strong>{{ item.include_keywords.join(" · ")
          }}<small v-if="item.negative_keywords.length"
            >排除：{{ item.negative_keywords.join(" · ") }}</small
          >
        </p>
        <dl>
          <div>
            <dt>通知</dt>
            <dd>站内</dd>
          </div>
          <div>
            <dt>采集周期</dt>
            <dd>每 {{ item.collection_interval_minutes }} 分钟</dd>
          </div>
          <div>
            <dt>最后评估</dt>
            <dd>
              {{ item.last_evaluated_at ? freshness(item.last_evaluated_at) : "尚未评估" }}
            </dd>
          </div>
          <div>
            <dt>下次采集</dt>
            <dd>{{ item.next_collection_at ? freshness(item.next_collection_at) : "已暂停" }}</dd>
          </div>
          <div>
            <dt>上次失败来源</dt>
            <dd>
              {{ item.last_failed_sources.length ? item.last_failed_sources.join("、") : "无" }}
            </dd>
          </div>
          <div>
            <dt>版本</dt>
            <dd>v{{ item.version }}</dd>
          </div>
        </dl>
        <button type="button" @click="toggleRule(item)">
          {{ item.status === "enabled" ? "暂停" : "启用" }}
        </button>
        <button type="button" class="secondary" @click="viewRuleTopics(item)">查看趋势结果</button>
      </article>
    </section>
    <TrendChangeQueue
      v-else
      :topics="topics"
      :selected="selected"
      :requests="changeRequests"
      :busy="busy"
      @propose="proposeTopicChange"
      @decide="decideTopicChange"
    />
    <div
      v-if="showRule"
      class="trend-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trend-rule-title"
    >
      <form @submit.prevent="createRule">
        <header>
          <div>
            <p>监控规则</p>
            <h3 id="trend-rule-title">创建趋势监控</h3>
          </div>
          <button type="button" aria-label="关闭" @click="showRule = false">×</button>
        </header>
        <label>规则名称<input v-model="form.name" required maxlength="120" /></label
        ><label
          >包含关键词（逗号分隔）<input
            v-model="form.include_keywords"
            required
            maxlength="500" /></label
        ><label>排除关键词（可选）<input v-model="form.negative_keywords" maxlength="500" /></label>
        <div>
          <label>市场<input v-model="form.market" required maxlength="40" /></label
          ><label>语言<input v-model="form.language" required maxlength="40" /></label>
        </div>
        <label>分类（可选）<input v-model="form.category" maxlength="80" /></label>
        <label
          >自动采集周期<select v-model.number="form.collection_interval_minutes">
            <option :value="15">每 15 分钟</option>
            <option :value="30">每 30 分钟</option>
            <option :value="60">每 1 小时</option>
            <option :value="180">每 3 小时</option>
            <option :value="360">每 6 小时</option>
            <option :value="720">每 12 小时</option>
            <option :value="1440">每天</option>
          </select></label
        >
        <aside><strong>通知渠道</strong><span>站内通知。邮件服务尚未确认，不能选择。</span></aside>
        <footer>
          <button type="button" @click="showRule = false">取消</button
          ><button type="submit" :disabled="Boolean(busy)">
            {{ busy ? "保存中…" : "创建并启用" }}
          </button>
        </footer>
      </form>
    </div>
    <div
      v-if="anomalyEvidence"
      class="trend-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trend-anomaly-title"
    >
      <form @submit.prevent="createQualityIssue">
        <header>
          <div>
            <p>异常证据</p>
            <h3 id="trend-anomaly-title">创建数据质量工单</h3>
          </div>
          <button type="button" aria-label="关闭异常报告" @click="anomalyEvidence = null">×</button>
        </header>
        <p>{{ anomalyEvidence.title }}</p>
        <label
          >风险等级<select v-model="anomalySeverity">
            <option value="warning">需要复核</option>
            <option value="critical">严重异常</option>
          </select></label
        ><label
          >异常说明<textarea
            v-model="anomalyReason"
            required
            minlength="2"
            maxlength="500"
            rows="4"
            placeholder="说明哪个事实异常，以及复核时应检查什么"
          ></textarea>
        </label>
        <aside>工单会关联当前主题、证据、来源、原始证据和解析器版本。</aside>
        <footer>
          <button type="button" @click="anomalyEvidence = null">取消</button
          ><button type="submit" :disabled="anomalyReason.trim().length < 2 || Boolean(busy)">
            {{ busy.includes("quality-issues") ? "创建中…" : "创建质量工单" }}
          </button>
        </footer>
      </form>
    </div>
    <div
      v-if="relevanceDialog"
      class="trend-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trend-relevance-title"
    >
      <form @submit.prevent="markIrrelevant">
        <header>
          <div>
            <p>相关性治理</p>
            <h3 id="trend-relevance-title">
              {{ relevanceDialog === "irrelevant" ? "标记为无关" : "恢复为相关" }}
            </h3>
          </div>
          <button type="button" aria-label="关闭相关性变更" @click="relevanceDialog = null">
            ×
          </button>
        </header>
        <p>原始证据、时间线和历史原因不会删除；本次变更会形成可回溯审计。</p>
        <label
          >变更原因<textarea
            v-model="relevanceReason"
            required
            minlength="2"
            maxlength="500"
            rows="4"
            placeholder="说明判定依据，便于后续复核"
          ></textarea>
        </label>
        <footer>
          <button type="button" @click="relevanceDialog = null">取消</button
          ><button type="submit" :disabled="relevanceReason.trim().length < 2 || Boolean(busy)">
            确认并记录
          </button>
        </footer>
      </form>
    </div>
  </section>
</template>
