<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ApiClientError, createApiClient, type ApiFailureKind } from "../api-client";
import UiStatePanel from "./UiStatePanel.vue";
import "../competitor.css";
type State = "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
interface Snapshot {
  id: string;
  current_price: number | null;
  currency: string | null;
  rank_value: number | null;
  review_count: number | null;
  rating_value: number | null;
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
  snapshot_count: number;
  latest_snapshot: Snapshot | null;
  snapshots?: Snapshot[];
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
  request = createApiClient(props.apiBaseUrl),
  state = ref<State>("loading"),
  items = ref<Competitor[]>([]),
  rules = ref<Rule[]>([]),
  selected = ref<Competitor | null>(null),
  requestId = ref(""),
  notice = ref(""),
  busy = ref(false),
  showCreate = ref(false),
  showRule = ref(false),
  query = ref(""),
  deleting = ref<Competitor | null>(null),
  deleteReason = ref("");
const form = reactive({
    market: "US",
    product_url: "",
    title: "",
    opportunity_id: "",
  }),
  rule = reactive({
    competitor_id: "",
    metric: "price",
    direction: "decrease",
    threshold_value: 1,
  });
const latest = computed(() => selected.value?.latest_snapshot ?? null),
  baseline = computed(() => {
    const snapshots = selected.value?.snapshots ?? [];
    return snapshots.length ? snapshots[snapshots.length - 1] : latest.value;
  }),
  applicableRules = computed(() =>
    rules.value.filter((item) => !item.competitor_id || item.competitor_id === selected.value?.id),
  ),
  filteredItems = computed(() => {
    const needle = query.value.trim().toLowerCase();
    return needle
      ? items.value.filter((item) =>
          `${item.title} ${item.external_id} ${item.source_site}`.toLowerCase().includes(needle),
        )
      : items.value;
  }),
  summary = computed(() => ({
    total: items.value.length,
    active: items.value.filter((item) => item.status === "active").length,
    pending: items.value.filter((item) => !item.latest_snapshot).length,
    snapshots: items.value.reduce((sum, item) => sum + (item.snapshot_count ?? 0), 0),
  })),
  stateFrom = (kind: ApiFailureKind): State =>
    kind === "expired" || kind === "forbidden"
      ? kind
      : kind === "blocked" || kind === "rate_limited"
        ? "blocked"
        : "error";
const statusText = (value: string) => ({ active: "监控中", paused: "已暂停" })[value] ?? value,
  availabilityText = (value: string) =>
    ({ in_stock: "有货", out_of_stock: "缺货", unknown: "未知" })[value] ?? value,
  sourceStatusText = (value: string) =>
    ({ healthy: "来源正常", degraded: "来源异常", unavailable: "来源不可用" })[value] ?? value,
  freshnessText = (value: string) =>
    ({ fresh: "数据新鲜", stale: "数据已过期", unknown: "时效未知" })[value] ?? value,
  fieldText = (value: string) =>
    ({
      current_price: "当前价格",
      price: "价格",
      availability: "库存",
      rank: "排名",
      rank_value: "排名",
      review_count: "评论数",
      rating_value: "评分",
    })[value] ?? value,
  changeValueText = (field: string, value: string) =>
    field === "availability" ? availabilityText(value) : value,
  impactText = (value: string) =>
    value.replace(/\bin_stock\b/g, "有货").replace(/\bout_of_stock\b/g, "缺货"),
  timeText = (value: string) =>
    new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value)),
  snapshotPrice = (snapshot: Snapshot | null) =>
    snapshot?.current_price == null
      ? "价格未采到"
      : `${snapshot.currency ?? "币种未采到"} ${snapshot.current_price}`,
  changeCurrency = (change: NonNullable<Competitor["changes"]>[number]) =>
    selected.value?.snapshots?.find((snapshot) => snapshot.evidence_id === change.evidence_id)
      ?.currency ?? null,
  changeText = (change: NonNullable<Competitor["changes"]>[number]) => {
    const currency =
        change.field === "current_price" ? `${changeCurrency(change) ?? "币种未采到"} ` : "",
      previous = changeValueText(change.field, change.previous),
      current = changeValueText(change.field, change.current);
    return `${currency}${previous} → ${current}`;
  },
  directionText = (value: string) =>
    (
      ({
        increase: "增加",
        decrease: "减少",
        change: "任意变化",
        became_unavailable: "变为缺货",
      }) as Record<string, string>
    )[value] ?? value,
  ruleText = (item: Rule) => {
    const label = `${fieldText(item.metric)} · ${directionText(item.direction)}`;
    if (item.metric === "availability") return label;
    const currency = item.metric === "price" ? `${latest.value?.currency ?? "币种未采到"} ` : "";
    return `${label} ${currency}${item.threshold_value ?? "未提供"}`;
  };
async function load() {
  state.value = "loading";
  try {
    const response = await request<Competitor[]>("/competitors");
    requestId.value = response.request_id;
    items.value = response.data;
    try {
      rules.value = (await request<Rule[]>("/competitor-monitor-rules")).data;
    } catch {
      rules.value = [];
    }
    selected.value = items.value.find((v) => v.id === selected.value?.id) ?? items.value[0] ?? null;
    state.value = items.value.length ? "ready" : "empty";
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      notice.value = error.actionHint;
      state.value = stateFrom(error.kind);
    } else state.value = "blocked";
  }
}
async function detail(item: Competitor) {
  selected.value = item;
  try {
    const response = await request<Competitor>(`/competitors/${item.id}`);
    requestId.value = response.request_id;
    selected.value = response.data;
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      notice.value = error.actionHint;
    } else notice.value = "详情暂不可用，列表数据未被覆盖。";
  }
}
async function post(path: string, body: unknown) {
  busy.value = true;
  notice.value = "";
  try {
    const response = await request<any>(path, { method: "POST", body });
    requestId.value = response.request_id;
    return response.data;
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      notice.value = error.actionHint;
    } else notice.value = "依赖暂不可用，未写入状态。";
    return null;
  } finally {
    busy.value = false;
  }
}
async function create() {
  const result = await post("/competitors", {
    market: form.market,
    product_url: form.product_url,
    title: form.title,
    ...(form.opportunity_id ? { opportunity_id: form.opportunity_id } : {}),
  });
  if (result) {
    showCreate.value = false;
    await load();
    notice.value = "竞品已建立，商品页公开数据采集已排队。";
  }
}
async function collect() {
  if (!selected.value) return;
  const result = await post(`/competitors/${selected.value.id}/collect`, {});
  if (result) notice.value = `已开始重新采集，任务编号 ${result.task_id}。`;
}
async function remove() {
  if (!deleting.value || !deleteReason.value.trim()) return;
  busy.value = true;
  try {
    const response = await request(`/competitors/${deleting.value.id}`, {
      method: "DELETE",
      body: {
        expected_revision: deleting.value.revision,
        reason: deleteReason.value.trim(),
      },
    });
    requestId.value = response.request_id;
    notice.value = "竞品已从监控列表删除，历史审计仍保留。";
    selected.value = null;
    deleting.value = null;
    deleteReason.value = "";
    await load();
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      notice.value = error.actionHint;
    } else notice.value = "依赖暂不可用，删除未完成。";
  } finally {
    busy.value = false;
  }
}
async function createRule() {
  const result = await post("/competitor-monitor-rules", {
    competitor_id: rule.competitor_id || null,
    metric: rule.metric,
    direction: rule.direction,
    ...(rule.metric === "availability" ? {} : { threshold_value: Number(rule.threshold_value) }),
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
  showCreate.value = new URLSearchParams(window.location.search).get("create") === "1";
  void load();
});
</script>
<template>
  <section class="competitor-monitor" aria-labelledby="competitor-title">
    <section class="member-module-guide">
      <div>
        <p>竞品监控怎么运行</p>
        <h3>添加亚马逊等平台商品后，持续记录价格、评分和页面变化</h3>
        <span
          >每次快照都保留来源网址和采集时间。点击“查看详情”可追溯历史变化；没有真实快照时不会显示虚构曲线。</span
        >
      </div>
      <ol>
        <li>添加商品链接或商品编号</li>
        <li>定时采集公开商品页</li>
        <li>对比新旧快照</li>
        <li>变化超过阈值时提醒</li>
      </ol>
    </section>
    <header class="competitor-head">
      <div>
        <p>竞品情报</p>
        <h2 id="competitor-title">竞品监控</h2>
        <span>每个数字都来自可追溯快照；变化与阈值告警不会覆盖历史。</span>
      </div>
      <div>
        <button type="button" class="ghost" @click="showRule = true">监控规则</button
        ><button type="button" @click="showCreate = true">＋ 添加竞品</button>
      </div>
    </header>
    <p v-if="notice" class="competitor-notice" role="status">
      {{ notice }} <code v-if="requestId">{{ requestId }}</code>
    </p>
    <section class="competitor-summary" aria-label="竞品监控数据总览">
      <article>
        <span>竞品总数</span><b>{{ summary.total }}</b>
      </article>
      <article>
        <span>监控中</span><b>{{ summary.active }}</b>
      </article>
      <article>
        <span>待首次采集</span><b>{{ summary.pending }}</b>
      </article>
      <article>
        <span>历史快照</span><b>{{ summary.snapshots }}</b>
      </article>
    </section>
    <div class="competitor-toolbar">
      <label
        >搜索竞品<input
          v-model="query"
          type="search"
          placeholder="商品标题、ASIN 或来源站点" /></label
      ><span>共 {{ filteredItems.length }} 条结果</span>
    </div>
    <UiStatePanel v-if="state !== 'ready'" :kind="state" :request-id="requestId" @primary="load" />
    <div v-else class="competitor-grid">
      <aside class="competitor-list">
        <button
          v-for="item in filteredItems"
          :key="item.id"
          :class="{ selected: selected?.id === item.id }"
          @click="detail(item)"
        >
          <span
            ><b>{{ item.title }}</b
            ><small>{{ item.source_site }} · {{ item.market }}</small></span
          ><strong v-if="item.latest_snapshot"
            >{{ item.latest_snapshot.currency }} {{ item.latest_snapshot.current_price }}</strong
          ><strong v-else class="competitor-pending">等待首次采集</strong
          ><em :data-status="item.status">{{ statusText(item.status) }}</em>
          <small class="competitor-detail-entry">查看详情 →</small>
        </button>
      </aside>
      <article v-if="selected" class="competitor-detail">
        <header>
          <div>
            <p>{{ selected.source_site }} / {{ selected.external_id }}</p>
            <h3>{{ selected.title }}</h3>
            <a :href="selected.product_url" target="_blank" rel="noopener noreferrer"
              >查看来源商品 ↗</a
            >
          </div>
          <div class="competitor-actions">
            <button type="button" :disabled="busy" @click="collect">立即采集</button
            ><button class="ghost" type="button" :disabled="busy" @click="toggle">
              {{ selected.status === "active" ? "暂停监控" : "恢复监控" }}</button
            ><button
              class="danger ghost"
              type="button"
              :disabled="busy"
              @click="deleting = selected"
            >
              删除
            </button>
          </div>
        </header>
        <section v-if="latest" class="competitor-metrics">
          <article>
            <small>当前价格</small
            ><b>{{
              latest.current_price == null
                ? "未采到"
                : `${latest.currency ?? ""} ${latest.current_price}`
            }}</b>
          </article>
          <article>
            <small>排名</small
            ><b>{{ latest.rank_value == null ? "未采到" : `#${latest.rank_value}` }}</b>
          </article>
          <article>
            <small>评论 / 评分</small
            ><b
              >{{ latest.review_count == null ? "未采到" : latest.review_count }} /
              {{ latest.rating_value == null ? "未采到" : latest.rating_value }}</b
            >
          </article>
          <article>
            <small>库存</small><b>{{ availabilityText(latest.availability) }}</b>
          </article>
        </section>
        <section v-else class="competitor-baseline-pending">
          <strong>已建立竞品，正在等待第一个真实快照</strong>
          <p>
            该商品由 ERP 中的 Amazon ASIN
            建立。价格、排名、评论、评分和库存尚未从商品页采集到，因此这里不会用 0 或演示数据代替。
          </p>
          <a :href="selected.product_url" target="_blank" rel="noopener noreferrer"
            >先查看 Amazon 商品页 ↗</a
          >
        </section>
        <section v-if="latest" class="competitor-comparison" aria-label="基线、变动与阈值">
          <article>
            <small>基线快照</small>
            <b>{{ snapshotPrice(baseline) }}</b>
            <time>{{ baseline ? timeText(baseline.captured_at) : "尚未建立" }}</time>
          </article>
          <article>
            <small>当前快照</small>
            <b>{{ snapshotPrice(latest) }}</b>
            <time>{{ timeText(latest.captured_at) }}</time>
          </article>
          <article>
            <small>已记录变动</small>
            <b>{{ selected.changes?.length ?? 0 }} 项</b>
            <span>首个快照只建立基线，后续快照才记录变化。</span>
          </article>
          <article>
            <small>生效阈值</small>
            <b>{{ applicableRules.length }} 条</b>
            <ul v-if="applicableRules.length">
              <li v-for="item in applicableRules" :key="item.id">{{ ruleText(item) }}</li>
            </ul>
            <span v-else>尚未配置适用于该竞品的阈值。</span>
          </article>
        </section>
        <div v-if="latest" class="competitor-source">
          <span :data-health="latest.source_status">{{
            sourceStatusText(latest.source_status)
          }}</span>
          <p>采集于 {{ timeText(latest.captured_at) }} · {{ freshnessText(latest.freshness) }}</p>
          <code>证据 {{ latest.evidence_id }}</code>
        </div>
        <section class="competitor-history">
          <header>
            <h4>变化记录</h4>
            <span>字段 · 前值 · 当前值 · 时间 · 证据 · 影响</span>
          </header>
          <article v-for="change in selected.changes ?? []" :key="change.id">
            <b>{{ fieldText(change.field) }}</b
            ><strong>{{ changeText(change) }}</strong
            ><time>{{ timeText(change.changed_at) }}</time>
            <p>{{ impactText(change.impact_explanation) }}</p>
            <code>证据 {{ change.evidence_id }}</code>
          </article>
          <p v-if="!selected.changes?.length">尚无变化；首个快照只建立基线，不制造变化。</p>
        </section>
        <section class="competitor-history snapshot-history">
          <header>
            <h4>采集快照</h4>
            <span>价格 · 评分 · 评论 · 采集时间 · 证据</span>
          </header>
          <article v-for="snapshot in selected.snapshots ?? []" :key="snapshot.id">
            <b>{{ snapshotPrice(snapshot) }}</b
            ><strong
              >评分 {{ snapshot.rating_value ?? "未采到" }} · 评论
              {{ snapshot.review_count ?? "未采到" }}</strong
            ><time>{{ timeText(snapshot.captured_at) }}</time
            ><code>证据 {{ snapshot.evidence_id }}</code>
          </article>
          <p v-if="!selected.snapshots?.length">尚无快照；点击“立即采集”可重新读取公开商品页。</p>
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
            <p>公开网页爬虫</p>
            <h3 id="new-competitor">添加 Amazon 竞品</h3>
          </div>
          <button
            type="button"
            aria-label="关闭新建竞品"
            title="关闭新建竞品"
            @click="showCreate = false"
          >
            ×
          </button>
        </header>
        <div class="form-grid">
          <label>市场<input v-model="form.market" required /></label
          ><label>关联机会编号（可选）<input v-model="form.opportunity_id" /></label>
        </div>
        <label>商品网址<input v-model="form.product_url" required type="url" /></label
        ><label
          >内部备注标题<input
            v-model="form.title"
            required
            placeholder="例如：Amazon 收纳箱头部竞品"
        /></label>
        <aside>
          提交后直接读取公开 Amazon 商品页并建立首个证据快照，不需要填写官方 API 或手工填写价格。
        </aside>
        <footer>
          <button type="button" class="ghost" @click="showCreate = false">取消</button
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
            <p>明确阈值</p>
            <h3 id="new-rule">新建监控规则</h3>
          </div>
          <button
            type="button"
            aria-label="关闭告警规则"
            title="关闭告警规则"
            @click="showRule = false"
          >
            ×
          </button>
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
            <option v-if="rule.metric === 'availability'" value="became_unavailable">
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
          <button type="button" class="ghost" @click="showRule = false">取消</button
          ><button type="submit" :disabled="busy">启用规则</button>
        </footer>
      </form>
    </div>
    <div v-if="deleting" class="competitor-modal" role="dialog" aria-modal="true">
      <form class="rule-form" @submit.prevent="remove">
        <header>
          <div>
            <p>保留审计记录</p>
            <h3>删除竞品监控</h3>
          </div>
          <button
            type="button"
            aria-label="关闭删除确认"
            title="关闭删除确认"
            @click="deleting = null"
          >
            ×
          </button>
        </header>
        <p>删除“{{ deleting.title }}”后不再继续监控，已有快照与审计记录仍保留。</p>
        <label
          >删除原因<textarea
            v-model="deleteReason"
            required
            maxlength="500"
            placeholder="请填写删除原因"
          ></textarea>
        </label>
        <footer>
          <button type="button" class="ghost" @click="deleting = null">取消</button
          ><button type="submit" class="danger" :disabled="busy">确认删除</button>
        </footer>
      </form>
    </div>
  </section>
</template>
