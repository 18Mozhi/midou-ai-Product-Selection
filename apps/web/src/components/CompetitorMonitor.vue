<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import UiStatePanel from "./UiStatePanel.vue";
import "../competitor.css";
type State =
  "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
interface Snapshot {
  id: string;
  current_price: number;
  currency: string;
  rank_value: number;
  review_count: number;
  rating_value: number;
  availability: string;
  captured_at: string;
  freshness: string;
  source_status: string;
  evidence_id: string;
}
interface Competitor {
  id: string;
  market: string;
  source_site: string;
  external_id: string;
  product_url: string;
  title: string;
  status: string;
  revision: number;
  latest_snapshot: Snapshot | null;
  changes?: Array<{
    id: string;
    field: string;
    previous: string;
    current: string;
    changed_at: string;
    evidence_id: string;
    impact_explanation: string;
  }>;
  alerts?: Array<{
    id: string;
    notification_status: string;
    task_status: string;
    payload: Record<string, string>;
  }>;
}
interface Rule {
  id: string;
  competitor_id: string | null;
  metric: string;
  direction: string;
  threshold_value: number | null;
  status: string;
}
const props = defineProps<{ apiBaseUrl: string }>(),
  state = ref<State>("loading"),
  items = ref<Competitor[]>([]),
  rules = ref<Rule[]>([]),
  selected = ref<Competitor | null>(null),
  requestId = ref(""),
  notice = ref(""),
  busy = ref(false),
  showCreate = ref(false),
  showRule = ref(false);
const form = reactive({
    provider_id: "",
    market: "US",
    source_site: "",
    external_id: "",
    product_url: "",
    title: "",
    current_price: 0,
    currency: "USD",
    rank_value: 0,
    review_count: 0,
    rating_value: 0,
    availability: "in_stock",
    captured_at: new Date().toISOString().slice(0, 16),
    source_ref_id: "",
    evidence_id: "",
  }),
  rule = reactive({
    competitor_id: "",
    metric: "price",
    direction: "decrease",
    threshold_value: 1,
  });
const latest = computed(() => selected.value?.latest_snapshot ?? null),
  stateFrom = (s: number): State =>
    s === 401
      ? "expired"
      : s === 403
        ? "forbidden"
        : [408, 425, 429, 502, 503, 504].includes(s)
          ? "blocked"
          : "error";
async function load() {
  state.value = "loading";
  try {
    const [a, b] = await Promise.all([
        fetch(`${props.apiBaseUrl}/competitors`, { credentials: "include" }),
        fetch(`${props.apiBaseUrl}/competitor-monitor-rules`, {
          credentials: "include",
        }),
      ]),
      [body, ruleBody] = await Promise.all([
        a.json().catch(() => null),
        b.json().catch(() => null),
      ]);
    requestId.value = body?.request_id ?? "";
    if (!a.ok) {
      state.value = stateFrom(a.status);
      return;
    }
    items.value = body.data;
    rules.value = b.ok ? ruleBody.data : [];
    selected.value =
      items.value.find((v) => v.id === selected.value?.id) ??
      items.value[0] ??
      null;
    state.value = items.value.length ? "ready" : "empty";
  } catch {
    state.value = "blocked";
  }
}
async function detail(item: Competitor) {
  selected.value = item;
  try {
    const r = await fetch(`${props.apiBaseUrl}/competitors/${item.id}`, {
        credentials: "include",
      }),
      b = await r.json();
    if (r.ok) selected.value = b.data;
  } catch {
    notice.value = "详情暂不可用，列表数据未被覆盖。";
  }
}
async function post(path: string, body: unknown) {
  busy.value = true;
  notice.value = "";
  try {
    const r = await fetch(`${props.apiBaseUrl}${path}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify(body),
      }),
      b = await r.json().catch(() => null);
    requestId.value = b?.request_id ?? "";
    if (!r.ok) {
      notice.value = b?.error?.action_hint ?? "操作未完成。";
      return null;
    }
    return b.data;
  } catch {
    notice.value = "依赖暂不可用，未写入状态。";
    return null;
  } finally {
    busy.value = false;
  }
}
async function create() {
  const result = await post("/competitors", {
    provider_id: form.provider_id,
    market: form.market,
    source_site: form.source_site,
    external_id: form.external_id,
    product_url: form.product_url,
    title: form.title,
    snapshot: {
      current_price: Number(form.current_price),
      currency: form.currency,
      rank_value: Number(form.rank_value),
      review_count: Number(form.review_count),
      rating_value: Number(form.rating_value),
      availability: form.availability,
      captured_at: new Date(form.captured_at).toISOString(),
      freshness: "fresh",
      source_status: "healthy",
      source_ref_id: form.source_ref_id,
      evidence_id: form.evidence_id,
    },
  });
  if (result) {
    showCreate.value = false;
    await load();
    notice.value = "竞品与首个来源快照已进入比较队列。";
  }
}
async function createRule() {
  const result = await post("/competitor-monitor-rules", {
    competitor_id: rule.competitor_id || null,
    metric: rule.metric,
    direction: rule.direction,
    ...(rule.metric === "availability"
      ? {}
      : { threshold_value: Number(rule.threshold_value) }),
  });
  if (result) {
    showRule.value = false;
    await load();
    notice.value = "监控阈值已启用。";
  }
}
async function toggle() {
  if (!selected.value) return;
  const status = selected.value.status === "active" ? "paused" : "active",
    result = await post(`/competitors/${selected.value.id}/actions`, {
      status,
      expected_revision: selected.value.revision,
    });
  if (result) {
    await load();
    notice.value = status === "paused" ? "监控已暂停。" : "监控已恢复。";
  }
}
onMounted(() => {
  showCreate.value =
    new URLSearchParams(window.location.search).get("create") === "1";
  void load();
});
</script>
<template>
  <section class="competitor-monitor" aria-labelledby="competitor-title">
    <header class="competitor-head">
      <div>
        <p>COMPETITIVE INTELLIGENCE</p>
        <h2 id="competitor-title">竞品监控</h2>
        <span>每个数字都来自可追溯快照；变化与阈值告警不会覆盖历史。</span>
      </div>
      <div>
        <button type="button" class="ghost" @click="showRule = true">
          监控规则</button
        ><button type="button" @click="showCreate = true">＋ 添加竞品</button>
      </div>
    </header>
    <p v-if="notice" class="competitor-notice" role="status">
      {{ notice }} <code v-if="requestId">{{ requestId }}</code>
    </p>
    <UiStatePanel
      v-if="state !== 'ready'"
      :kind="state"
      :request-id="requestId"
      @primary="load"
    />
    <div v-else class="competitor-grid">
      <aside class="competitor-list">
        <button
          v-for="item in items"
          :key="item.id"
          :class="{ selected: selected?.id === item.id }"
          @click="detail(item)"
        >
          <span
            ><b>{{ item.title }}</b
            ><small>{{ item.source_site }} · {{ item.market }}</small></span
          ><strong v-if="item.latest_snapshot"
            >{{ item.latest_snapshot.currency }}
            {{ item.latest_snapshot.current_price }}</strong
          ><em :data-status="item.status">{{ item.status }}</em>
        </button>
      </aside>
      <article v-if="selected" class="competitor-detail">
        <header>
          <div>
            <p>{{ selected.source_site }} / {{ selected.external_id }}</p>
            <h3>{{ selected.title }}</h3>
            <a
              :href="selected.product_url"
              target="_blank"
              rel="noopener noreferrer"
              >查看来源商品 ↗</a
            >
          </div>
          <button class="ghost" type="button" :disabled="busy" @click="toggle">
            {{ selected.status === "active" ? "暂停监控" : "恢复监控" }}
          </button>
        </header>
        <section v-if="latest" class="competitor-metrics">
          <article>
            <small>当前价格</small
            ><b>{{ latest.currency }} {{ latest.current_price }}</b>
          </article>
          <article>
            <small>排名</small><b>#{{ latest.rank_value }}</b>
          </article>
          <article>
            <small>评论 / 评分</small
            ><b>{{ latest.review_count }} / {{ latest.rating_value }}</b>
          </article>
          <article>
            <small>库存</small><b>{{ latest.availability }}</b>
          </article>
        </section>
        <div v-if="latest" class="competitor-source">
          <span :data-health="latest.source_status">{{
            latest.source_status
          }}</span>
          <p>采集于 {{ latest.captured_at }} · {{ latest.freshness }}</p>
          <code>evidence {{ latest.evidence_id }}</code>
        </div>
        <section class="competitor-history">
          <header>
            <h4>变化记录</h4>
            <span>字段 · 前值 · 当前值 · 时间 · 证据 · 影响</span>
          </header>
          <article v-for="change in selected.changes ?? []" :key="change.id">
            <b>{{ change.field }}</b
            ><strong>{{ change.previous }} → {{ change.current }}</strong
            ><time>{{ change.changed_at }}</time>
            <p>{{ change.impact_explanation }}</p>
            <code>{{ change.evidence_id }}</code>
          </article>
          <p v-if="!selected.changes?.length">
            尚无变化；首个快照只建立基线，不制造变化。
          </p>
        </section>
      </article>
    </div>
    <div
      v-if="showCreate"
      class="competitor-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-competitor"
    >
      <form @submit.prevent="create">
        <header>
          <div>
            <p>PROVENANCE REQUIRED</p>
            <h3 id="new-competitor">添加竞品与基线快照</h3>
          </div>
          <button type="button" @click="showCreate = false">×</button>
        </header>
        <div class="form-grid">
          <label>Provider ID<input v-model="form.provider_id" required /></label
          ><label>市场<input v-model="form.market" required /></label
          ><label>来源站点<input v-model="form.source_site" required /></label
          ><label
            >外部商品 ID<input v-model="form.external_id" required
          /></label>
        </div>
        <label
          >商品网址<input
            v-model="form.product_url"
            required
            type="url" /></label
        ><label>标题<input v-model="form.title" required /></label>
        <fieldset>
          <legend>不可变来源快照</legend>
          <label
            >价格<input
              v-model.number="form.current_price"
              type="number"
              min="0"
              step="0.000001"
              required /></label
          ><label
            >币种<input v-model="form.currency" maxlength="3" required /></label
          ><label
            >排名<input
              v-model.number="form.rank_value"
              type="number"
              min="0"
              required /></label
          ><label
            >评论数<input
              v-model.number="form.review_count"
              type="number"
              min="0"
              required /></label
          ><label
            >评分<input
              v-model.number="form.rating_value"
              type="number"
              min="0"
              max="5"
              step="0.01"
              required /></label
          ><label
            >库存<select v-model="form.availability">
              <option value="in_stock">有货</option>
              <option value="out_of_stock">缺货</option>
              <option value="unknown">未知</option>
            </select></label
          ><label
            >采集时间<input
              v-model="form.captured_at"
              type="datetime-local"
              required /></label
          ><label>来源引用<input v-model="form.source_ref_id" required /></label
          ><label
            >Evidence ID<input v-model="form.evidence_id" required
          /></label>
        </fieldset>
        <footer>
          <button type="button" class="ghost" @click="showCreate = false">
            取消</button
          ><button type="submit" :disabled="busy">
            {{ busy ? "保存中…" : "建立监控" }}
          </button>
        </footer>
      </form>
    </div>
    <div
      v-if="showRule"
      class="competitor-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-rule"
    >
      <form class="rule-form" @submit.prevent="createRule">
        <header>
          <div>
            <p>EXPLICIT THRESHOLD</p>
            <h3 id="new-rule">新建监控规则</h3>
          </div>
          <button type="button" @click="showRule = false">×</button>
        </header>
        <label
          >竞品（留空为工作区全局）<select v-model="rule.competitor_id">
            <option value="">全部竞品</option>
            <option v-for="item in items" :key="item.id" :value="item.id">
              {{ item.title }}
            </option>
          </select></label
        ><label
          >指标<select v-model="rule.metric">
            <option value="price">价格</option>
            <option value="rank">排名</option>
            <option value="review_count">评论数</option>
            <option value="availability">库存</option>
          </select></label
        ><label
          >方向<select v-model="rule.direction">
            <option value="increase">增加</option>
            <option value="decrease">减少</option>
            <option value="change">任意变化</option>
            <option
              v-if="rule.metric === 'availability'"
              value="became_unavailable"
            >
              变为缺货
            </option>
          </select></label
        ><label v-if="rule.metric !== 'availability'"
          >阈值<input
            v-model.number="rule.threshold_value"
            type="number"
            min="0"
            step="0.000001"
            required
        /></label>
        <aside>
          当前已启用
          {{ rules.length }} 条规则；只有达到显式阈值的变化才排队通知与任务。
        </aside>
        <footer>
          <button type="button" class="ghost" @click="showRule = false">
            取消</button
          ><button type="submit" :disabled="busy">启用规则</button>
        </footer>
      </form>
    </div>
  </section>
</template>
