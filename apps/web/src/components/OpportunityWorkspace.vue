<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ApiClientError, createApiClient, type ApiFailureKind } from "../api-client";
import OpportunityListPanel from "./OpportunityListPanel.vue";
import OpportunityProfitPanel from "./OpportunityProfitPanel.vue";
import UiStatePanel from "./UiStatePanel.vue";
import { statusLabel } from "../ui/status-labels";
import "../opportunities.css";
import "../opportunity-profit.css";
import "../opportunity-selection-entry.css";
import "../opportunity-ai.css";
type State = "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";
const router = useRouter();
type Tab =
  "overview" | "market" | "competition" | "profit" | "risk" | "ai" | "evidence" | "decisions";
interface Opportunity {
  id: string;
  name: string;
  image_url: string | null;
  market: string;
  category: string | null;
  source_type: "manual" | "trend_topic";
  source_ref_id: string | null;
  owner_id: string | null;
  lifecycle_status: string;
  recommendation_status: string;
  overall_score: number | null;
  trend_score: number | null;
  competition_score: number | null;
  profit_status: string;
  risk_level: string;
  confidence: { status: string; score: number | null };
  evidence_count: number;
  source_count: number;
  competitor_count: number;
  supplier_candidate_count: number;
  coverage_status: string;
  blocking_reasons: Array<"evidence_insufficient" | "recommendation_insufficient">;
  decision_status: string;
  version: number;
  updated_at: string;
}
interface Detail extends Opportunity {
  score_rule_version: string | null;
  scored_at: string | null;
  latest_score_run: null | {
    id: string;
    status: string;
    coverage_percent: number;
    confidence_score: number | null;
    recommendation_status: string;
    missing_fields: string[];
    scored_at: string;
  };
  score_components: Array<{
    dimension_code: string;
    weight_percent: number;
    input_score: number | null;
    weighted_score: number | null;
    evidence_ids: string[];
    missing_fields: string[];
  }>;
  evidence: Array<{
    id: string;
    title: string;
    publisher: string;
    canonical_url: string;
    observed_at: string;
  }>;
  decisions: Array<{
    id: string;
    action: string;
    reason: string;
    actor_id: string;
    created_at: string;
    opportunity_version: number;
  }>;
  section_status: {
    market: string;
    competition: string;
    profit: string;
    risk: string;
    execution: string;
  };
}
const opportunityStatus = (value: string) =>
  (
    ({
      pending: "待判断",
      adopt: "采纳",
      adopted: "已采纳",
      observe: "继续观察",
      observing: "观察中",
      reject: "驳回",
      rejected: "已驳回",
      insufficient: "不完整",
      partial: "部分完整",
      complete: "完整",
      insufficient_data: "待补充数据",
      calculated: "已计算",
      unknown: "待识别",
      low: "低",
      medium: "中",
      high: "高",
      manual: "手动创建",
      trend_topic: "热点自动发现",
      evidence_insufficient: "缺少可采纳证据",
      recommendation_insufficient: "尚无可靠推荐结论",
    }) as Record<string, string>
  )[value] ?? value;
interface ProfitAnalysis {
  latest_run: null | {
    id: string;
    status: "calculated" | "insufficient_data";
    rule_version_code: string;
    platform: string;
    market: string;
    currency: string | null;
    sale_price: number | null;
    total_cost: number | null;
    net_profit: number | null;
    net_margin_percent: number | null;
    missing_fields: string[];
    calculated_at: string;
    components: Array<{
      component_type: string;
      source_amount: number | null;
      source_currency: string | null;
      converted_amount: number | null;
      target_currency: string | null;
      source_ref_id: string | null;
      evidence_id: string | null;
      exchange_quote_id: string | null;
      missing_reason: string | null;
    }>;
  };
  current_inputs: Array<{
    input_type: "sale_price" | "purchase_price" | "logistics";
    amount_value: number;
    currency: string;
    source_type: string;
    source_ref_id: string;
    evidence_id: string;
    observed_at: string;
    input_version: number;
    platform: string;
  }>;
}
const props = defineProps<{ apiBaseUrl: string; opportunityId?: string }>(),
  request = createApiClient(props.apiBaseUrl),
  state = ref<State>("loading"),
  items = ref<Opportunity[]>([]),
  detail = ref<Detail | null>(null),
  profit = ref<ProfitAnalysis | null>(null),
  aiAnalyses = ref<any[]>([]),
  total = ref(0),
  requestId = ref(""),
  message = ref(""),
  busy = ref(false),
  listScope = ref<"product" | "all">("product"),
  downstream = ref({ competitors: 0, snapshots: 0, searches: 0, suppliers: 0 }),
  tab = ref<Tab>("overview"),
  showCreate = ref(false),
  showErpImport = ref(false),
  erpImportLimit = ref(200),
  showDecision = ref(false),
  decisionAction = ref<"adopt" | "observe" | "reject">("observe"),
  decisionReason = ref(""),
  filters = reactive({
    q: "",
    market: "",
    decision_status: "",
    coverage_status: "",
    blocking_reason: "",
  }),
  form = reactive({
    name: "",
    market: "US",
    category: "",
    source_topic_id: "",
  }),
  costForm = reactive({
    platform: "amazon",
    input_type: "sale_price" as "sale_price" | "purchase_price" | "logistics",
    amount_value: 0,
    currency: "USD",
    source_type: "manual_confirmation",
    source_ref_id: "",
    evidence_id: "",
    observed_at: new Date().toISOString().slice(0, 16),
  });
const tabs: [Tab, string][] = [
  ["overview", "结论"],
  ["evidence", "证据"],
  ["profit", "利润与成本"],
  ["risk", "风险"],
  ["market", "市场"],
  ["competition", "竞争"],
  ["ai", "AI 辅助"],
  ["decisions", "决策历史"],
];
const evidenceTaskHref = computed(() => {
  if (!detail.value) return "/tasks";
  const title = encodeURIComponent(`补齐机会证据 · ${detail.value.name}`),
    description = encodeURIComponent(
      `补齐机会 ${detail.value.id} 的缺失证据，并复核来源新鲜度与可信度。`,
    );
  return `/tasks?create=1&title=${title}&description=${description}`;
});
const stateFrom = (kind: ApiFailureKind): State =>
  kind === "expired" || kind === "forbidden"
    ? kind
    : kind === "blocked" || kind === "rate_limited"
      ? "blocked"
      : "error";
const freshness = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
async function read(path: string) {
  try {
    const response = await request<any>(path);
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
async function loadAi() {
  try {
    const response = await request<any[]>(`/opportunities/${props.opportunityId}/ai-analyses`);
    aiAnalyses.value = Array.isArray(response.data) ? response.data : [];
  } catch {
    aiAnalyses.value = [];
  }
}
async function load() {
  state.value = "loading";
  message.value = "";
  try {
    if (props.opportunityId) {
      detail.value = (await read(`/opportunities/${props.opportunityId}`)).data;
      profit.value = (await read(`/opportunities/${props.opportunityId}/profit-analysis`)).data;
      await loadAi();
      try {
        const [competitorsResponse, sourcingResponse] = await Promise.all([
            request<any[]>("/competitors"),
            request<any[]>("/sourcing/searches"),
          ]),
          competitors = competitorsResponse.data.filter(
            (item: any) => item.opportunity_id === props.opportunityId,
          ),
          searches = sourcingResponse.data.filter(
            (item: any) =>
              item.input_type === "opportunity" && item.input_ref === props.opportunityId,
          );
        downstream.value = {
          competitors: competitors.length,
          snapshots: competitors.reduce(
            (sum: number, item: any) => sum + Number(item.snapshot_count ?? 0),
            0,
          ),
          searches: searches.length,
          suppliers: searches.reduce(
            (sum: number, item: any) => sum + Number(item.candidate_count ?? 0),
            0,
          ),
        };
      } catch {
        downstream.value = {
          competitors: 0,
          snapshots: 0,
          searches: 0,
          suppliers: 0,
        };
      }
      state.value = "ready";
      return;
    }
    const params = new URLSearchParams({ page: "1", page_size: "20", scope: listScope.value });
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    const result = await read(`/opportunities?${params}`);
    items.value = result.data;
    total.value = (result.meta as { total: number }).total;
    state.value = items.value.length ? "ready" : "empty";
  } catch (error) {
    if (!(error instanceof ApiClientError)) state.value = "blocked";
  }
}
async function discoverCompetitors() {
  if (!detail.value) return;
  const result = await write(`/opportunities/${detail.value.id}/competitor-discovery`, {});
  if (result) message.value = `Amazon 竞品采集已排队，任务编号 ${result.task_id}。`;
}
async function discoverSuppliers() {
  if (!detail.value) return;
  const result = await write("/sourcing/searches", {
    input_type: "opportunity",
    input_ref: detail.value.id,
  });
  if (result) message.value = `公开供应商采集已排队，任务编号 ${result.task_id}。`;
}
async function write(path: string, body: unknown) {
  busy.value = true;
  message.value = "";
  try {
    const response = await request<any>(path, { method: "POST", body });
    requestId.value = response.request_id;
    return response.data;
  } catch (error) {
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      message.value = error.actionHint;
    } else message.value = "依赖暂不可用，未写入任何状态。";
    return null;
  } finally {
    busy.value = false;
  }
}
async function create() {
  const result = await write("/opportunities", {
    name: form.name,
    market: form.market,
    category: form.category || null,
    source_topic_id: form.source_topic_id || null,
  });
  if (result) {
    showCreate.value = false;
    await router.push(`/opportunities/${result.id}`);
  }
}
function browserBridge<T>(action: string, payload: Record<string, unknown>) {
  return new Promise<T>((resolve, reject) => {
    const request_id = crypto.randomUUID();
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", receive);
      reject(new Error("browser_helper_unavailable"));
    }, 120000);
    function receive(event: MessageEvent) {
      if (
        event.source !== window ||
        event.data?.type !== "SCOUTOPS_BROWSER_BRIDGE_RESULT" ||
        event.data?.request_id !== request_id
      )
        return;
      window.clearTimeout(timeout);
      window.removeEventListener("message", receive);
      if (!event.data.ok) reject(new Error(String(event.data.error || "browser_helper_failed")));
      else resolve(event.data.data as T);
    }
    window.addEventListener("message", receive);
    window.postMessage(
      {
        type: "SCOUTOPS_BROWSER_BRIDGE_REQUEST",
        request_id,
        action,
        payload,
      },
      location.origin,
    );
  });
}
async function persistErpProducts(data: {
  items: unknown[];
  source_url: string;
  captured_at: string;
  total?: number;
}) {
  const result = await write("/imports/erp-products", data);
  if (!result) return;
  showErpImport.value = false;
  await load();
  message.value =
    `ERP 已读取 ${result.received_count} 条：新增 ${result.opportunity_count} 个机会、` +
    `${result.competitor_count} 个亚马逊待采集竞品、` +
    `${result.sourcing_search_count} 个货源匹配任务；原始记录已保存为证据。`;
}
async function importFromErpBrowser() {
  busy.value = true;
  message.value = "正在从已登录的 ERP 商品列表读取数据…";
  try {
    const data = await browserBridge<{
      items: unknown[];
      source_url: string;
      captured_at: string;
      total: number;
    }>("erp.products.read", { limit: Number(erpImportLimit.value) });
    busy.value = false;
    await persistErpProducts(data);
  } catch (error) {
    busy.value = false;
    const code = error instanceof Error ? error.message : "";
    message.value =
      code === "erp_login_page_opened"
        ? "已打开 ERP 登录页。登录完成并进入商品列表后，再点击“从当前浏览器读取”。"
        : code === "erp_login_required"
          ? "ERP 登录状态无效，请在 ERP 页面重新登录。"
          : "未检测到浏览器助手或 ERP 权限未授予。请先下载并加载浏览器助手。";
  }
}
async function importErpFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const items = Array.isArray(parsed) ? parsed : parsed?.list;
    await persistErpProducts({
      items,
      source_url: "https://medou.medouai.com/#/ProductList",
      captured_at: new Date().toISOString(),
    });
  } catch {
    message.value = "ERP JSON 文件格式无效；应为接口返回的 list 数组或商品数组。";
  }
}
function startDecision(action: "adopt" | "observe" | "reject") {
  decisionAction.value = action;
  decisionReason.value = "";
  showDecision.value = true;
}
async function decide() {
  if (!detail.value) return;
  const result = await write(`/opportunities/${detail.value.id}/decisions`, {
    action: decisionAction.value,
    reason: decisionReason.value,
    expected_version: detail.value.version,
  });
  if (result) {
    showDecision.value = false;
    await load();
    message.value = "决策已记录；原始评分与证据未被改写。";
  }
}
async function queueScore() {
  if (!detail.value) return;
  const result = await write(`/opportunities/${detail.value.id}/score-runs`, {
    expected_version: detail.value.version,
  });
  if (result) {
    await load();
    message.value = "评分任务已进入宝塔 Node Worker 队列；完成后刷新可见新运行记录。";
  }
}
async function confirmCost() {
  if (!detail.value) return;
  const result = await write(`/opportunities/${detail.value.id}/cost-inputs`, {
    platform: costForm.platform,
    input_type: costForm.input_type,
    amount_value: Number(costForm.amount_value),
    currency: costForm.currency,
    source_type: costForm.source_type,
    source_ref_id: costForm.source_ref_id,
    evidence_id: costForm.evidence_id,
    observed_at: new Date(costForm.observed_at).toISOString(),
    expected_version: detail.value.version,
  });
  if (result) {
    await load();
    message.value = `${costForm.input_type} 已确认并保留来源；旧版本未改写。`;
  }
}
async function queueProfit() {
  if (!detail.value) return;
  const result = await write(`/opportunities/${detail.value.id}/profit-runs`, {
    platform: costForm.platform,
    expected_version: detail.value.version,
  });
  if (result) {
    await load();
    message.value = "利润计算已进入宝塔 Node Worker 队列；刷新后查看不可变运行快照。";
  }
}
async function queueAi() {
  if (!detail.value) return;
  const result = await write(`/opportunities/${detail.value.id}/ai-analyses`, {
    expected_version: detail.value.version,
  });
  if (result) {
    await load();
    tab.value = "ai";
    message.value = "AI 辅助分析已进入宝塔 Node Worker 队列；不会自动修改评分或决策。";
  }
}
async function reviewAi(resultId: string, outcome: "approved" | "rejected") {
  const notes = window.prompt(outcome === "approved" ? "填写抽检通过说明" : "填写驳回原因");
  if (!notes) return;
  if (await write(`/ai-analyses/${resultId}/reviews`, { outcome, notes })) {
    await load();
    tab.value = "ai";
    message.value = "人工抽检已记录，AI 原始输出未被改写。";
  }
}
onMounted(() => {
  const query = new URLSearchParams(window.location.search);
  const requestedTab = query.get("tab");
  if (props.opportunityId && tabs.some(([value]) => value === requestedTab)) {
    tab.value = requestedTab as Tab;
  }
  if (!props.opportunityId && (query.get("create") === "1" || query.get("source_topic_id"))) {
    form.source_topic_id = query.get("source_topic_id") ?? "";
    form.name = query.get("name") ?? "";
    form.market = query.get("market") ?? "US";
    form.category = query.get("category") ?? "";
    showCreate.value = true;
  }
  void load();
});
</script>
<template>
  <section class="opportunity-workspace">
    <header class="opportunity-hero">
      <div>
        <p>决策工作台</p>
        <h2>{{ opportunityId ? "机会详情" : "选品机会" }}</h2>
        <span>评分、利润、风险和证据均展示真实状态；缺少下游输入时明确标记数据不足。</span>
      </div>
      <div v-if="!opportunityId" class="opportunity-hero-actions">
        <RouterLink to="/opportunities/start">开始真实选品</RouterLink
        ><button type="button" class="ghost" @click="showErpImport = true">从 ERP 导入</button
        ><button type="button" @click="showCreate = true">＋ 手工创建机会</button>
      </div>
      <RouterLink v-else to="/opportunities">← 返回机会列表</RouterLink>
    </header>
    <p v-if="message" class="opportunity-message" role="status">
      {{ message }} <code v-if="requestId">{{ requestId }}</code>
    </p>
    <OpportunityListPanel
      v-if="!opportunityId"
      v-model:list-scope="listScope"
      :items="items"
      :total="total"
      :state="state"
      :request-id="requestId"
      :filters="filters"
      @apply="load"
    />
    <template v-else
      ><UiStatePanel
        v-if="state !== 'ready' || !detail"
        :kind="state === 'ready' ? 'empty' : state"
        :request-id="requestId"
        @primary="load"
      />
      <article v-else class="opportunity-detail">
        <section
          v-if="detail.recommendation_status === 'insufficient_data'"
          class="opportunity-next-steps"
        >
          <div>
            <b>为什么还不能给出结论？</b
            ><span>系统只在证据足够时评分。可直接启动真实网页采集，不需要填写官方 API。</span>
          </div>
          <button type="button" :disabled="busy" @click="discoverCompetitors">
            ① 采集 Amazon 竞品</button
          ><button type="button" :disabled="busy" @click="discoverSuppliers">
            ② 采集公开供应商</button
          ><RouterLink to="/opportunities/scoring-rules">③ 检查评分规则</RouterLink>
        </section>
        <header>
          <div>
            <p>
              {{ statusLabel(detail.lifecycle_status) }} · {{ detail.market }} ·
              {{ detail.category || "未分类" }}
            </p>
            <h3>{{ detail.name }}</h3>
            <span
              >更新 {{ freshness(detail.updated_at) }} · v{{ detail.version }} · 来源
              {{ opportunityStatus(detail.source_type) }}</span
            >
          </div>
          <div>
            <strong>{{ detail.overall_score ?? "—" }}</strong
            ><small>综合评分<br />{{ detail.overall_score == null ? "数据不足" : "已计算" }}</small>
          </div>
        </header>
        <section class="opportunity-decision-bar">
          <div>
            <span>推荐结论</span><strong>{{ statusLabel(detail.recommendation_status) }}</strong
            ><small
              >规则版本：{{ detail.score_rule_version ?? "尚未计算" }} · 置信度：{{
                statusLabel(detail.confidence.status)
              }}</small
            >
          </div>
          <button
            :disabled="
              detail.recommendation_status === 'insufficient_data' ||
              detail.coverage_status === 'insufficient' ||
              detail.evidence_count === 0
            "
            :title="
              detail.recommendation_status === 'insufficient_data' ||
              detail.coverage_status === 'insufficient' ||
              detail.evidence_count === 0
                ? '证据不足，先补齐缺失项'
                : '采纳当前机会'
            "
            @click="startDecision('adopt')"
          >
            ✓ 采纳</button
          ><button @click="startDecision('observe')">◉ 继续观察</button
          ><button class="reject" @click="startDecision('reject')">× 驳回</button>
          <RouterLink
            v-if="
              detail.recommendation_status === 'insufficient_data' ||
              detail.coverage_status === 'insufficient'
            "
            :to="evidenceTaskHref"
            >分派证据补齐任务</RouterLink
          >
        </section>
        <nav class="opportunity-tabs" aria-label="机会详情分区">
          <button
            v-for="item in tabs"
            :key="item[0]"
            type="button"
            :aria-current="tab === item[0] ? 'page' : undefined"
            @click="tab = item[0]"
          >
            {{ item[1] }}
          </button>
        </nav>
        <section v-if="tab === 'overview'" class="opportunity-overview">
          <article class="opportunity-downstream">
            <p>下游补全</p>
            <h4>竞品与供应链数据</h4>
            <strong>{{ downstream.competitors + downstream.suppliers }} 项</strong
            ><span
              >{{ downstream.competitors }} 个竞品 · {{ downstream.snapshots }} 个快照 ·
              {{ downstream.suppliers }} 个供应商候选</span
            >
            <footer>
              <button type="button" :disabled="busy" @click="discoverCompetitors">采集竞品</button
              ><button type="button" :disabled="busy" @click="discoverSuppliers">采集供应商</button
              ><RouterLink to="/competitors">查看竞品详情</RouterLink
              ><RouterLink to="/sourcing">查看供应链详情</RouterLink>
            </footer>
          </article>
          <article class="opportunity-score">
            <p>评分解释</p>
            <h4>机会评分解读</h4>
            <strong>{{ detail.overall_score ?? "数据不足" }}</strong
            ><span v-if="detail.latest_score_run"
              >规则 {{ detail.score_rule_version }} · 覆盖
              {{ detail.latest_score_run.coverage_percent }}% ·
              {{ freshness(detail.latest_score_run.scored_at) }}</span
            ><span v-else>尚无评分运行；缺失输入不会用默认值补齐。</span>
            <dl>
              <div v-for="item in detail.score_components" :key="item.dimension_code">
                <dt>{{ item.dimension_code }} · {{ item.weight_percent }}%</dt>
                <dd>
                  {{ item.input_score ?? "缺失" }}
                  <small>{{ item.evidence_ids.length }} 条证据</small>
                </dd>
              </div>
              <div v-if="!detail.score_components.length">
                <dt>缺失项</dt>
                <dd>尚无评分输入</dd>
              </div>
            </dl>
            <aside v-if="detail.latest_score_run?.missing_fields.length">
              缺失：{{ detail.latest_score_run.missing_fields.join("、") }}
            </aside>
            <footer>
              <RouterLink to="/opportunities/scoring-rules">管理规则版本</RouterLink
              ><button type="button" :disabled="busy" @click="queueScore">重新评分</button>
            </footer>
          </article>
          <article>
            <p>证据覆盖</p>
            <h4>证据覆盖</h4>
            <strong>{{ detail.evidence_count }} 条 / {{ detail.source_count }} 个来源</strong
            ><span
              >覆盖状态：{{
                opportunityStatus(detail.coverage_status)
              }}。市场、竞争、成本三类未齐全时不能自动推荐。</span
            >
          </article>
          <article>
            <p>利润</p>
            <h4>利润与成本</h4>
            <strong>{{
              profit?.latest_run?.status === "calculated"
                ? `${profit.latest_run.net_margin_percent}%`
                : opportunityStatus(detail.profit_status)
            }}</strong
            ><span v-if="profit?.latest_run?.status === 'calculated'"
              >净利润 {{ profit.latest_run.net_profit }} {{ profit.latest_run.currency }} · 规则
              {{ profit.latest_run.rule_version_code }}</span
            ><span v-else>数据不足时不生成投资回报率；缺失项在利润页逐项展示。</span>
          </article>
          <article>
            <p>风险</p>
            <h4>风险</h4>
            <strong>{{ opportunityStatus(detail.risk_level) }}</strong
            ><span>尚无适用风险输入，不以“低风险”代替未知。</span>
          </article>
        </section>
        <section v-else-if="tab === 'market'" class="opportunity-section">
          <p>市场证据</p>
          <h4>市场证据</h4>
          <strong>{{ detail.section_status.market }}</strong
          ><span
            >已关联 {{ detail.evidence_count }} 条趋势信号，来自
            {{ detail.source_count }} 个真实来源。</span
          >
        </section>
        <section v-else-if="tab === 'competition'" class="opportunity-section">
          <p>竞争情况</p>
          <h4>竞争对比</h4>
          <strong
            >{{ downstream.competitors }} 个竞品 · {{ downstream.snapshots }} 个真实快照</strong
          ><span v-if="downstream.snapshots"
            >快照已经保留价格、评分、评论、采集时间和原始证据，可进入竞品工作台查看变化历史。</span
          ><span v-else>尚未关联竞品快照；点击下方按钮即可采集公开 Amazon 商品页。</span>
          <footer>
            <button type="button" :disabled="busy" @click="discoverCompetitors">立即采集竞品</button
            ><RouterLink to="/competitors">打开竞品监控详情</RouterLink>
          </footer>
        </section>
        <OpportunityProfitPanel
          v-else-if="tab === 'profit'"
          :profit="profit"
          :cost-form="costForm"
          :busy="busy"
          @confirm-cost="confirmCost"
          @queue-profit="queueProfit"
        />
        <section v-else-if="tab === 'risk'" class="opportunity-section">
          <p>风险</p>
          <h4>风险分析</h4>
          <strong>数据不足</strong
          ><span>合规、侵权、供应、趋势、利润和数据质量风险尚未全部评估。</span>
        </section>
        <section v-else-if="tab === 'ai'" class="opportunity-ai">
          <header>
            <div>
              <p>智能辅助</p>
              <h4>AI 辅助分析</h4>
              <span>仅摘要、分类和缺失提示；输出不能替代事实、评分、利润或人工决策。</span>
            </div>
            <button type="button" :disabled="busy" @click="queueAi">生成新分析</button>
          </header>
          <aside>所有内容均标记 ai_generated，并保留输入快照哈希、模型名和人工抽检状态。</aside>
          <p v-if="!aiAnalyses.length" class="opportunity-empty-copy">
            尚无 AI 分析；当前机会事实未被修改。
          </p>
          <article v-for="item in aiAnalyses" :key="item.id">
            <header>
              <div>
                <b>{{ item.status }}</b
                ><small
                  >{{ freshness(item.created_at) }} · 输入
                  {{ item.input_sha256.slice(0, 12) }}…</small
                >
              </div>
              <em v-if="item.result"
                >智能分析 · {{ item.result.review_status === "pending" ? "待复核" : "已复核" }}</em
              >
            </header>
            <template v-if="item.result"
              ><h5>{{ item.result.content.summary }}</h5>
              <section>
                <div>
                  <strong>分类观察</strong>
                  <p v-for="entry in item.result.content.classifications" :key="entry.label">
                    <b>{{ entry.label }}</b
                    >{{ entry.rationale }}<code>{{ entry.source_refs.join(" · ") }}</code>
                  </p>
                </div>
                <div>
                  <strong>缺失提示</strong>
                  <p v-for="entry in item.result.content.missing_fields" :key="entry.field">
                    <b>{{ entry.field }}</b
                    >{{ entry.reason }}<code>{{ entry.source_refs.join(" · ") }}</code>
                  </p>
                </div>
              </section>
              <footer>
                <span>模型 {{ item.result.model_name }} · 原始输出不可改写</span
                ><template v-if="item.result.review_status === 'pending'"
                  ><button type="button" @click="reviewAi(item.result.id, 'approved')">
                    抽检通过</button
                  ><button
                    type="button"
                    class="reject"
                    @click="reviewAi(item.result.id, 'rejected')"
                  >
                    抽检驳回
                  </button></template
                ><b v-else>{{ item.result.review?.notes }}</b>
              </footer></template
            >
            <p v-else>
              等待 Worker；失败时显示
              {{ item.last_error_code || "无错误码" }}，可重新生成而不覆盖本记录。
            </p>
          </article>
        </section>
        <section v-else-if="tab === 'evidence'" class="opportunity-evidence">
          <header>
            <div>
              <p>可追溯证据</p>
              <h4>证据管理</h4>
            </div>
            <span>{{ detail.evidence.length }} 条</span>
          </header>
          <p v-if="!detail.evidence.length" class="opportunity-empty-copy">
            尚无真实证据；不会展示示例来源。
          </p>
          <a
            v-for="item in detail.evidence"
            :key="item.id"
            :href="item.canonical_url"
            target="_blank"
            rel="noopener noreferrer"
            ><span
              ><strong>{{ item.title }}</strong
              ><small>{{ item.publisher }} · {{ freshness(item.observed_at) }}</small></span
            ><b>查看原文 ↗</b></a
          >
        </section>
        <section v-else class="opportunity-decisions">
          <header>
            <div>
              <p>决策历史</p>
              <h4>决策历史</h4>
            </div>
            <span>{{ detail.decisions.length }} 条</span>
          </header>
          <p v-if="!detail.decisions.length" class="opportunity-empty-copy">尚无决策记录。</p>
          <article v-for="item in detail.decisions" :key="item.id">
            <b>{{ opportunityStatus(item.action) }}</b>
            <div>
              <strong>{{ item.reason }}</strong
              ><small
                >{{ freshness(item.created_at) }} · 版本 v{{ item.opportunity_version }} · 操作者
                {{ item.actor_id.slice(0, 8) }}…</small
              >
            </div>
          </article>
        </section>
      </article></template
    >
    <div
      v-if="showErpImport"
      class="opportunity-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="erp-import-title"
    >
      <form @submit.prevent="importFromErpBrowser">
        <header>
          <div>
            <p>使用已有商品数据补齐系统</p>
            <h3 id="erp-import-title">从米豆 ERP 商品列表导入</h3>
          </div>
          <button type="button" aria-label="关闭 ERP 导入" @click="showErpImport = false">×</button>
        </header>
        <aside class="erp-import-guide">
          <strong>真实数据流</strong>
          <span
            >浏览器助手在本机读取 ERP 登录令牌并请求商品列表；令牌不会发送给
            ai选品。商品原始记录、来源网址和采集时间会保存为可追溯证据。</span
          >
        </aside>
        <label
          >本次导入数量<input
            v-model.number="erpImportLimit"
            type="number"
            min="1"
            max="500"
            required
        /></label>
        <label class="erp-file-fallback"
          >没有安装助手时上传 ERP JSON<input
            type="file"
            accept=".json,application/json"
            @change="importErpFile"
          /><small>接受接口返回的 list 数组或商品数组。</small></label
        >
        <footer>
          <a href="/browser-helper/scoutops-browser-helper.zip">下载浏览器助手</a>
          <button type="button" @click="showErpImport = false">取消</button>
          <button type="submit" :disabled="busy">
            {{ busy ? "读取并导入中…" : "从当前浏览器读取" }}
          </button>
        </footer>
      </form>
    </div>
    <div
      v-if="showCreate"
      class="opportunity-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="opportunity-create-title"
    >
      <form @submit.prevent="create">
        <header>
          <div>
            <p>新候选项</p>
            <h3 id="opportunity-create-title">创建机会候选</h3>
          </div>
          <button type="button" aria-label="关闭" @click="showCreate = false">×</button>
        </header>
        <label>机会名称<input v-model="form.name" required maxlength="200" /></label>
        <div>
          <label>市场<input v-model="form.market" required maxlength="40" /></label
          ><label>分类（可选）<input v-model="form.category" maxlength="80" /></label>
        </div>
        <label
          >来源趋势 ID（可选，只接受当前工作区主题）<input
            v-model="form.source_topic_id"
            maxlength="36"
        /></label>
        <aside>创建后由宝塔 Node Worker 刷新真实证据覆盖；评分、利润与风险不会自动填充。</aside>
        <footer>
          <button type="button" @click="showCreate = false">取消</button
          ><button type="submit" :disabled="busy">
            {{ busy ? "创建中…" : "创建机会" }}
          </button>
        </footer>
      </form>
    </div>
    <div
      v-if="showDecision && detail"
      class="opportunity-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="opportunity-decision-title"
    >
      <form @submit.prevent="decide">
        <header>
          <div>
            <p>留痕决策</p>
            <h3 id="opportunity-decision-title">
              记录{{
                decisionAction === "adopt"
                  ? "采纳"
                  : decisionAction === "observe"
                    ? "继续观察"
                    : "驳回"
              }}决定
            </h3>
          </div>
          <button type="button" aria-label="关闭" @click="showDecision = false">×</button>
        </header>
        <label
          >原因（必填）<textarea v-model="decisionReason" required maxlength="1000"></textarea>
        </label>
        <aside>此决定会覆盖推荐展示，但不会改写原始分数、证据或历史。</aside>
        <footer>
          <button type="button" @click="showDecision = false">取消</button
          ><button type="submit" :disabled="busy">
            {{ busy ? "保存中…" : "确认记录" }}
          </button>
        </footer>
      </form>
    </div>
  </section>
</template>
