<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ApiClientError, createApiClient, type ApiFailureKind } from "../api-client";
import UiStatePanel from "./UiStatePanel.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import ResponsiveFilterDrawer from "./ResponsiveFilterDrawer.vue";
import { statusLabel } from "../ui/status-labels";
import "../trends.css";
import "../trends-quality.css";

type State = "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
interface Topic {
  id: string;
  title: string;
  category: string | null;
  market: string;
  language: string;
  status: "active" | "irrelevant" | "stale";
  signal_count: number;
  source_count: number;
  heat: { value: number; unit: "signals" };
  momentum_percent: number | null;
  confidence: {
    score: number | null;
    status: "measured" | "insufficient_data";
  };
  first_seen_at: string;
  last_seen_at: string;
  source_fresh_at: string;
  followed: boolean;
  version: number;
}
interface Detail extends Topic {
  keywords: Array<{
    keyword: string;
    type: string;
    language: string;
    market: string;
  }>;
  timeline: Array<{ at: string; signal_count: number; source_count: number }>;
  timeline_sources: Array<{
    source_id: string;
    source_label: string;
    points: Array<{ at: string; signal_count: number }>;
  }>;
  evidence: Array<{
    id: string;
    title: string;
    publisher: string;
    canonical_url: string;
    published_at: string;
    observed_at: string;
  }>;
  data_quality: {
    coverage_status: string;
    evidence_count: number;
    source_count: number;
    stale: boolean;
  };
}
interface Rule {
  id: string;
  name: string;
  include_keywords: string[];
  negative_keywords: string[];
  market: string;
  language: string;
  category: string | null;
  notification_channel: "in_app";
  collection_interval_minutes: number;
  status: "enabled" | "paused";
  last_evaluated_at: string | null;
  last_collection_at: string | null;
  next_collection_at: string | null;
  last_collection_task_id: string | null;
  version: number;
  updated_at: string;
}
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
  requestId = ref(""),
  message = ref(""),
  busy = ref(""),
  tab = ref<"topics" | "rules">("topics"),
  showRule = ref(false),
  irrelevant = ref(false),
  total = ref(0),
  timelineSource = ref(""),
  page = ref(1),
  sort = ref<"impact" | "latest" | "momentum" | "followed">("impact"),
  masterWidth = ref(38),
  filters = reactive({ q: "", market: "", category: "", status: "active" }),
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
const timelinePoints = computed(() => {
    if (!selected.value || !timelineSource.value) return selected.value?.timeline ?? [];
    return (
      selected.value.timeline_sources
        .find((source) => source.source_id === timelineSource.value)
        ?.points.map((point) => ({ ...point, source_count: 1 })) ?? []
    );
  }),
  activeFilterCount = computed(() => Object.values(filters).filter(Boolean).length),
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
  }),
  timelineSourceLabel = computed(
    () =>
      selected.value?.timeline_sources.find((source) => source.source_id === timelineSource.value)
        ?.source_label ?? "全部来源",
  ),
  maxSignal = computed(() =>
    Math.max(1, ...(timelinePoints.value.map((item) => item.signal_count) ?? [1])),
  );
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
    const [list, ruleList] = await Promise.all([
      read(`/trends?${params}`),
      read("/trends/monitoring-rules"),
    ]);
    topics.value = list.data;
    rules.value = ruleList.data;
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
    selected.value = (await read(`/trends/${currentId}`)).data;
    timelineSource.value = "";
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
  tab.value = route.query.section === "rules" ? "rules" : "topics";
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
async function setTab(nextTab: "topics" | "rules") {
  await router.push({
    query: { ...route.query, section: nextTab === "rules" ? "rules" : undefined },
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
  if (!selected.value) return;
  const result = await write(`/trends/${selected.value.id}/relevance`, "POST", {
    status: "irrelevant",
    reason: "用户在趋势详情中标记无关",
    expected_version: selected.value.version,
  });
  irrelevant.value = false;
  if (result) {
    message.value = "已标记无关；原始证据保留。";
    await load();
  }
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
      selected.value = (await read(`/trends/${topicId}`)).data;
      timelineSource.value = "";
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
        监控规则 <b>{{ rules.length }}</b>
      </button>
    </nav>
    <p v-if="message" class="trend-message" role="status">
      {{ message }} <code v-if="requestId">{{ requestId }}</code>
    </p>
    <template v-if="tab === 'topics'">
      <ResponsiveFilterDrawer label="筛选趋势" :active-count="activeFilterCount">
        <form class="trend-filters" @submit.prevent="applyFilters">
          <label
            >市场<select v-model="filters.market">
              <option value="">全部市场</option>
              <option value="US">US</option>
            </select></label
          ><label
            >分类<input v-model="filters.category" maxlength="80" placeholder="全部分类" /></label
          ><label
            >状态<select v-model="filters.status">
              <option value="active">活跃</option>
              <option value="irrelevant">已标记无关</option>
              <option value="stale">已过期</option>
              <option value="">全部状态</option>
            </select></label
          ><label class="search"
            >关键词<input
              v-model="filters.q"
              maxlength="200"
              placeholder="搜索主题或关键词" /></label
          ><label
            >排序<select v-model="sort">
              <option value="impact">影响程度</option>
              <option value="latest">最新信号</option>
              <option value="momentum">增长速度</option>
              <option value="followed">我的关注优先</option>
            </select></label
          ><button type="submit">筛选</button
          ><button type="button" class="secondary" @click="clearFilters">清除</button
          ><button type="button" class="secondary" @click="saveViewLink">保存视图链接</button>
        </form>
      </ResponsiveFilterDrawer>
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
        <article v-if="selected" class="trend-detail" :aria-busy="busy === 'detail'">
          <header>
            <div>
              <a href="#trend-list">← 返回趋势列表</a>
              <p>
                {{ statusLabel(selected.status) }} · {{ selected.market }} ·
                {{ selected.language }}
              </p>
              <h3>{{ selected.title }}</h3>
              <span
                >首次 {{ freshness(selected.first_seen_at) }} · 最近来源
                {{ freshness(selected.source_fresh_at) }}</span
              >
            </div>
            <div class="heat-summary">
              <b>{{ selected.heat.value }}</b
              ><small>实际信号数</small>
            </div>
          </header>
          <div class="trend-actions">
            <button type="button" @click="follow">
              {{ selected.followed ? "已关注" : "关注" }}</button
            ><button type="button" @click="showRule = true">创建监控</button
            ><RouterLink :to="opportunityRoute">转为机会</RouterLink
            ><button class="quiet" type="button" @click="irrelevant = true">标记无关</button>
          </div>
          <section class="trend-conclusion">
            <div>
              <p>可验证结论</p>
              <strong
                >该主题包含 {{ selected.signal_count }} 条信号，来自
                {{ selected.source_count }} 个来源。</strong
              ><span v-if="selected.confidence.status === 'insufficient_data'"
                >置信度：数据不足；不会用默认分数代替。</span
              ><span v-else>置信度 {{ selected.confidence.score }} / 100</span>
            </div>
            <dl>
              <div>
                <dt>证据覆盖</dt>
                <dd>{{ selected.data_quality.evidence_count }} 条</dd>
              </div>
              <div>
                <dt>数据状态</dt>
                <dd>{{ selected.data_quality.coverage_status }}</dd>
              </div>
              <div>
                <dt>环比</dt>
                <dd>
                  {{
                    selected.momentum_percent == null ? "数据不足" : `${selected.momentum_percent}%`
                  }}
                </dd>
              </div>
            </dl>
          </section>
          <section class="trend-evidence">
            <header>
              <div>
                <p>主要证据</p>
                <h4>主要证据</h4>
              </div>
              <span
                >来源 {{ selected.source_count }} · 最新
                {{ freshness(selected.source_fresh_at) }}</span
              >
            </header>
            <a
              v-for="item in selected.evidence"
              :key="item.id"
              :href="item.canonical_url"
              target="_blank"
              rel="noopener noreferrer"
              ><span
                ><strong>{{ item.title }}</strong
                ><small
                  >{{ item.publisher }} · 发布 {{ freshness(item.published_at) }} · 采集
                  {{ freshness(item.observed_at) }} · 原始来源可核对</small
                ></span
              ><b>查看原文 ↗</b></a
            >
          </section>
          <div class="trend-lower">
            <section>
              <header>
                <div>
                  <p>信号时间线</p>
                  <h4>信号时间线</h4>
                </div>
                <label class="timeline-source-filter"
                  >来源筛选<select v-model="timelineSource">
                    <option value="">全部来源</option>
                    <option
                      v-for="source in selected.timeline_sources"
                      :key="source.source_id"
                      :value="source.source_id"
                    >
                      {{ source.source_label }}
                    </option>
                  </select></label
                >
              </header>
              <div
                class="timeline-bars"
                role="img"
                :aria-label="`信号时间线，来源 ${timelineSourceLabel}，共 ${timelinePoints.length} 个时间点`"
              >
                <span v-for="point in timelinePoints" :key="point.at"
                  ><i
                    :style="{
                      height: `${Math.max(12, (point.signal_count / maxSignal) * 100)}%`,
                    }"
                  ></i
                  ><b>{{ point.signal_count }}</b
                  ><small>{{ freshness(point.at) }}</small></span
                >
              </div>
            </section>
            <section>
              <header>
                <p>关键词</p>
                <h4>关键词</h4>
              </header>
              <div class="keyword-cloud">
                <span
                  v-for="item in selected.keywords"
                  :key="`${item.type}-${item.keyword}`"
                  :data-type="item.type"
                  >{{ item.keyword }}<small>{{ item.type }} · {{ item.market }}</small></span
                >
              </div>
            </section>
          </div>
        </article>
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
    <section v-else class="trend-rules">
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
    <ConfirmDialog
      :open="irrelevant"
      title="将主题标记为无关？"
      description="主题会从默认活跃列表移出。"
      impact="原始证据、时间线和审计不会删除；可通过状态筛选查看并恢复。"
      confirm-label="标记无关"
      confirmation-text="确认标记"
      @cancel="irrelevant = false"
      @confirm="markIrrelevant"
    />
  </section>
</template>
