<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ApiClientError, createApiClient, type ApiFailureKind } from "../api-client";
import OpportunityListPanel from "./OpportunityListPanel.vue";
import OpportunityDecisionPanel from "./OpportunityDecisionPanel.vue";
import OpportunityProfitPanel from "./OpportunityProfitPanel.vue";
import OpportunityWorkspaceDialogs from "./OpportunityWorkspaceDialogs.vue";
import UiStatePanel from "./UiStatePanel.vue";
import AuditedReasonDialog from "./AuditedReasonDialog.vue";
import { durationLabel, statusLabel } from "../ui/status-labels";
import { useAuditedReason } from "../use-audited-reason";
import { useModalDialog } from "../use-modal-dialog";
import { opportunityStatusLabel } from "./opportunity-workspace-presentation";
import type {
  OpportunityDetail as Detail,
  OpportunityProfitAnalysis as ProfitAnalysis,
  OpportunitySummary as Opportunity,
  OpportunityTab as Tab,
  OpportunityWorkspaceState as State,
} from "./opportunity-workspace-types";
import "../opportunities.css";
import "../opportunity-profit.css";
import "../opportunity-selection-entry.css";
import "../opportunity-ai.css";
const route = useRoute();
const router = useRouter();
const props = defineProps<{ apiBaseUrl: string; opportunityId?: string }>(),
  request = createApiClient(props.apiBaseUrl),
  state = ref<State>("loading"),
  items = ref<Opportunity[]>([]),
  memberOptions = ref<Array<{ id: string; label: string }>>([]),
  costReviewerOptions = ref<Array<{ id: string; label: string }>>([]),
  selectedOpportunityIds = ref<string[]>([]),
  detail = ref<Detail | null>(null),
  profit = ref<ProfitAnalysis | null>(null),
  aiAnalyses = ref<any[]>([]),
  total = ref(0),
  page = ref(1),
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
  showBatch = ref(false),
  batchAction = ref<"assign" | "archive" | "review">("assign"),
  batchReason = ref(""),
  batchAssigneeId = ref(""),
  decisionAction = ref<"adopt" | "observe" | "reject">("observe"),
  decisionReason = ref(""),
  filters = reactive({
    q: "",
    market: "",
    decision_status: "",
    coverage_status: "",
    blocking_reason: "",
    lifecycle_status: "",
    owner_id: "",
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
    reviewer_id: "",
  });
const { dialogElement: batchDialogElement, handleCancel: handleBatchCancel } = useModalDialog(
  () => showBatch.value,
  () => (showBatch.value = false),
);
const {
  request: aiReviewReasonRequest,
  open: aiReviewReasonOpen,
  ask: askAiReviewReason,
  submit: submitAiReviewReason,
  cancel: cancelAiReviewReason,
} = useAuditedReason();
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
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / 20)));
const returnPath = computed(() => {
  const value = typeof route.query.from === "string" ? route.query.from : "/opportunities";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/opportunities";
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
      try {
        costReviewerOptions.value = (
          await request<Array<{ id: string; label: string }>>("/cost-input-reviewers")
        ).data;
      } catch {
        costReviewerOptions.value = [];
      }
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
    const params = new URLSearchParams({
      page: String(page.value),
      page_size: "20",
      scope: listScope.value,
    });
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    const result = await read(`/opportunities?${params}`);
    items.value = result.data;
    try {
      memberOptions.value = (await request<any[]>("/opportunities/member-options")).data;
    } catch (error) {
      if (!(error instanceof ApiClientError)) throw error;
      memberOptions.value = [];
      requestId.value = error.requestId;
      message.value = "机会已加载；组织成员选项暂不可用，批量指派需稍后重试。";
    }
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
async function createEvidenceTask() {
  if (!detail.value) return;
  const result = await write(`/opportunities/${detail.value.id}/evidence-completion-tasks`, {
    expected_version: detail.value.version,
  });
  if (result) {
    message.value = result.created
      ? "补数任务已创建；完成任务后系统会自动重新评分。"
      : "该机会已有补数任务，已保留原任务与审计链。";
    await router.push({ path: `/tasks/${result.task_id}`, query: { from: route.fullPath } });
  }
}
function openBatch(action: "assign" | "archive" | "review") {
  batchAction.value = action;
  batchReason.value = "";
  batchAssigneeId.value = "";
  showBatch.value = true;
}
async function confirmBatch() {
  const selectedItems = items.value.filter((item) =>
    selectedOpportunityIds.value.includes(item.id),
  );
  if (!selectedItems.length || !batchReason.value.trim()) return;
  const result = await write("/opportunities/batch", {
    action: batchAction.value,
    items: selectedItems.map((item) => ({ id: item.id, expected_version: item.version })),
    reason: batchReason.value.trim(),
    assignee_id: batchAction.value === "assign" ? batchAssigneeId.value : null,
  });
  if (result) {
    showBatch.value = false;
    selectedOpportunityIds.value = [];
    await load();
    message.value = `批量操作已完成 ${result.affected_count} 项，每个机会均保留独立事件。`;
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
    reviewer_id: costForm.reviewer_id,
    expected_version: detail.value.version,
  });
  if (result) {
    await load();
    message.value = `${costForm.input_type} 已提交双人复核；通过前不会影响利润。`;
  }
}
async function reviewCost(payload: {
  reviewId: string;
  decision: "approved" | "rejected";
  reason: string;
  expectedVersion: number;
}) {
  if (!detail.value) return;
  const result = await write(
    `/opportunities/${detail.value.id}/cost-input-reviews/${payload.reviewId}/actions`,
    {
      decision: payload.decision,
      reason: payload.reason,
      expected_version: payload.expectedVersion,
    },
  );
  if (!result) return;
  await load();
  message.value =
    payload.decision === "approved"
      ? "成本复核已通过并生效；如有活动费用规则，利润重算已排队。"
      : "成本复核已驳回；原提交保留但不会进入利润计算。";
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
    await setTab("ai");
    message.value = "AI 辅助分析已进入宝塔 Node Worker 队列；不会自动修改评分或决策。";
  }
}
async function reviewAi(resultId: string, outcome: "approved" | "rejected") {
  const notes = await askAiReviewReason({
    title: outcome === "approved" ? "填写抽检通过说明" : "填写驳回原因",
    description: "说明会写入 AI 分析人工复核记录，原始输出不会被改写。",
  });
  if (!notes) return;
  if (await write(`/ai-analyses/${resultId}/reviews`, { outcome, notes })) {
    await load();
    await setTab("ai");
    message.value = "人工抽检已记录，AI 原始输出未被改写。";
  }
}
function syncListRoute() {
  filters.q = typeof route.query.q === "string" ? route.query.q : "";
  filters.market = typeof route.query.market === "string" ? route.query.market : "";
  filters.decision_status =
    typeof route.query.decision_status === "string" ? route.query.decision_status : "";
  filters.coverage_status =
    typeof route.query.coverage_status === "string" ? route.query.coverage_status : "";
  filters.blocking_reason =
    typeof route.query.blocking_reason === "string" ? route.query.blocking_reason : "";
  filters.lifecycle_status =
    typeof route.query.lifecycle_status === "string" ? route.query.lifecycle_status : "";
  filters.owner_id = typeof route.query.owner_id === "string" ? route.query.owner_id : "";
  listScope.value = route.query.scope === "all" ? "all" : "product";
  const requestedPage = Number(route.query.page ?? 1);
  page.value = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
}
async function applyListFilters() {
  const previousPath = route.fullPath;
  await router.push({
    query: {
      q: filters.q || undefined,
      market: filters.market || undefined,
      decision_status: filters.decision_status || undefined,
      coverage_status: filters.coverage_status || undefined,
      blocking_reason: filters.blocking_reason || undefined,
      lifecycle_status: filters.lifecycle_status || undefined,
      owner_id: filters.owner_id || undefined,
      scope: listScope.value === "all" ? "all" : undefined,
    },
  });
  if (route.fullPath === previousPath) await load();
}
async function goListPage(nextPage: number) {
  if (nextPage < 1 || nextPage > pageCount.value) return;
  await router.push({ query: { ...route.query, page: nextPage === 1 ? undefined : nextPage } });
}
async function setTab(nextTab: Tab) {
  tab.value = nextTab;
  await router.replace({
    query: { ...route.query, tab: nextTab === "overview" ? undefined : nextTab },
  });
}
function syncTabFromRoute() {
  const requestedTab = typeof route.query.tab === "string" ? route.query.tab : "overview";
  tab.value = tabs.some(([value]) => value === requestedTab) ? (requestedTab as Tab) : "overview";
}
let loadQueued = false;
function queueLoad() {
  if (loadQueued) return;
  loadQueued = true;
  queueMicrotask(() => {
    loadQueued = false;
    void load();
  });
}
onMounted(() => {
  syncTabFromRoute();
  syncListRoute();
  if (!props.opportunityId && (route.query.create === "1" || route.query.source_topic_id)) {
    form.source_topic_id =
      typeof route.query.source_topic_id === "string" ? route.query.source_topic_id : "";
    form.name = typeof route.query.name === "string" ? route.query.name : "";
    form.market = typeof route.query.market === "string" ? route.query.market : "US";
    form.category = typeof route.query.category === "string" ? route.query.category : "";
    showCreate.value = true;
  }
  void load();
});
watch(
  () => props.opportunityId,
  () => {
    detail.value = null;
    syncTabFromRoute();
    queueLoad();
  },
);
watch(
  () => route.query.tab,
  () => syncTabFromRoute(),
);
watch(
  () => [
    route.query.q,
    route.query.market,
    route.query.decision_status,
    route.query.coverage_status,
    route.query.blocking_reason,
    route.query.lifecycle_status,
    route.query.owner_id,
    route.query.scope,
    route.query.page,
  ],
  () => {
    if (props.opportunityId) return;
    syncListRoute();
    queueLoad();
  },
);
</script>
<template>
  <section class="opportunity-workspace">
    <header v-if="!opportunityId" class="opportunity-hero">
      <div>
        <p>决策工作台</p>
        <h2>{{ opportunityId ? "机会详情" : "选品机会" }}</h2>
        <span>评分、利润、风险和证据均展示真实状态；缺少下游输入时明确标记数据不足。</span>
      </div>
      <div class="opportunity-hero-actions">
        <RouterLink to="/opportunities/start">开始真实选品</RouterLink
        ><button type="button" class="ghost" @click="showErpImport = true">从 ERP 导入</button
        ><button type="button" @click="showCreate = true">＋ 手工创建机会</button>
      </div>
    </header>
    <nav v-else class="opportunity-detail-return" aria-label="机会详情返回路径">
      <RouterLink :to="returnPath">← 返回来源列表</RouterLink>
      <span>机会详情</span>
    </nav>
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
      :member-options="memberOptions"
      :selected-ids="selectedOpportunityIds"
      :page="page"
      @apply="applyListFilters"
      @batch="openBatch"
      @page="goListPage"
      @update:selected-ids="selectedOpportunityIds = $event"
    />
    <template v-else
      ><UiStatePanel
        v-if="state !== 'ready' || !detail"
        :kind="state === 'ready' ? 'empty' : state"
        :request-id="requestId"
        @primary="load"
      />
      <article v-else class="opportunity-detail">
        <header>
          <div>
            <p>
              {{ statusLabel(detail.lifecycle_status) }} · {{ detail.market }} ·
              {{ detail.category || "未分类" }}
            </p>
            <h3>{{ detail.name }}</h3>
            <span
              >当前阶段已停留 {{ durationLabel(detail.lifecycle_dwell_seconds) }} · 更新
              {{ freshness(detail.updated_at) }} · v{{ detail.version }} · 来源
              {{ opportunityStatusLabel(detail.source_type) }}</span
            >
          </div>
          <div>
            <strong>{{ detail.overall_score ?? "—" }}</strong
            ><small>综合评分 · {{ detail.overall_score == null ? "数据不足" : "已计算" }}</small>
          </div>
        </header>
        <section class="opportunity-recommendation">
          <div>
            <span>推荐结论</span><strong>{{ statusLabel(detail.recommendation_status) }}</strong
            ><small
              >规则版本：{{ detail.score_rule_version ?? "尚未计算" }} · 置信度：{{
                statusLabel(detail.confidence.status)
              }}</small
            >
          </div>
        </section>
        <OpportunityDecisionPanel
          :detail="detail"
          :busy="busy"
          @decide="startDecision"
          @create-evidence-task="createEvidenceTask"
        />
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
        <nav class="opportunity-tabs" aria-label="机会详情分区">
          <button
            v-for="item in tabs"
            :key="item[0]"
            type="button"
            :aria-current="tab === item[0] ? 'page' : undefined"
            @click="setTab(item[0])"
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
                opportunityStatusLabel(detail.coverage_status)
              }}。市场、竞争、成本三类未齐全时不能自动推荐。</span
            >
          </article>
          <article>
            <p>利润</p>
            <h4>利润与成本</h4>
            <strong>{{
              profit?.latest_run?.status === "calculated"
                ? `${profit.latest_run.net_margin_percent}%`
                : opportunityStatusLabel(detail.profit_status)
            }}</strong
            ><span v-if="profit?.latest_run?.status === 'calculated'"
              >净利润 {{ profit.latest_run.net_profit }} {{ profit.latest_run.currency }} · 规则
              {{ profit.latest_run.rule_version_code }}</span
            ><span v-else>数据不足时不生成投资回报率；缺失项在利润页逐项展示。</span>
          </article>
          <article>
            <p>风险</p>
            <h4>风险</h4>
            <strong>{{ opportunityStatusLabel(detail.risk_level) }}</strong
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
          :reviewer-options="costReviewerOptions"
          :busy="busy"
          @confirm-cost="confirmCost"
          @review-cost="reviewCost"
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
              ><small
                >{{ item.publisher }} · 证据新鲜度：观测于 {{ freshness(item.observed_at) }}</small
              ></span
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
            <b>{{ opportunityStatusLabel(item.action) }}</b>
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
    <OpportunityWorkspaceDialogs
      v-model:erp-import-open="showErpImport"
      v-model:create-open="showCreate"
      v-model:decision-open="showDecision"
      v-model:erp-import-limit="erpImportLimit"
      v-model:decision-reason="decisionReason"
      :busy="busy"
      :form="form"
      :decision-action="decisionAction"
      :has-detail="Boolean(detail)"
      @create="create"
      @decide="decide"
      @import-browser="importFromErpBrowser"
      @import-file="importErpFile"
    />
    <dialog
      ref="batchDialogElement"
      class="opportunity-modal opportunity-batch-dialog"
      aria-label="机会批量操作影响预览"
      @cancel="handleBatchCancel"
    >
      <form @submit.prevent="confirmBatch">
        <header>
          <p>影响预览</p>
          <h3>
            批量{{
              batchAction === "assign" ? "指派" : batchAction === "archive" ? "归档" : "复核"
            }}
          </h3>
        </header>
        <p>
          将处理当前已选的 {{ selectedOpportunityIds.length }} 个机会；任一版本变化都会整批回滚。
        </p>
        <label v-if="batchAction === 'assign'">
          负责人
          <select v-model="batchAssigneeId" required>
            <option value="" disabled>请选择可访问当前工作区的成员</option>
            <option v-for="member in memberOptions" :key="member.id" :value="member.id">
              {{ member.label }}
            </option>
          </select>
        </label>
        <aside v-if="batchAction === 'review'">
          每个机会会进入“验证中”阶段，并创建或复用一条人工复核任务；不会自动改变决策结论。
        </aside>
        <aside v-else-if="batchAction === 'archive'">
          已归档机会默认不在列表显示，可通过“阶段：已归档”筛选恢复查看。
        </aside>
        <label>
          操作原因
          <textarea v-model="batchReason" required maxlength="1000"></textarea>
        </label>
        <footer>
          <button type="button" @click="showBatch = false">返回</button>
          <button type="submit" :disabled="busy">确认执行</button>
        </footer>
      </form>
    </dialog>
    <AuditedReasonDialog
      :open="aiReviewReasonOpen"
      :title="aiReviewReasonRequest?.title || '填写复核说明'"
      :description="aiReviewReasonRequest?.description || ''"
      :initial-value="aiReviewReasonRequest?.initialValue"
      :minimum-length="aiReviewReasonRequest?.minimumLength"
      @submit="submitAiReviewReason"
      @cancel="cancelAiReviewReason"
    />
  </section>
</template>
