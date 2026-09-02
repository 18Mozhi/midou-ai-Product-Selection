<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ApiClientError, createApiClient, type ApiFailureKind } from "../api-client";
import OpportunityListPanel from "./OpportunityListPanel.vue";
import OpportunityDecisionPanel from "./OpportunityDecisionPanel.vue";
import OpportunityFeedbackPanel from "./OpportunityFeedbackPanel.vue";
import OpportunityLineagePanel from "./OpportunityLineagePanel.vue";
import OpportunityProfitPanel from "./OpportunityProfitPanel.vue";
import OpportunityDetailInsights from "./OpportunityDetailInsights.vue";
import OpportunityAiPanel from "./OpportunityAiPanel.vue";
import OpportunityWorkspaceDialogs from "./OpportunityWorkspaceDialogs.vue";
import UiStatePanel from "./UiStatePanel.vue";
import AuditedReasonDialog from "./AuditedReasonDialog.vue";
import { durationLabel, statusLabel } from "../ui/status-labels";
import { useAuditedReason } from "../use-audited-reason";
import { useModalDialog } from "../use-modal-dialog";
import {
  formatOpportunityTime as freshness,
  opportunityStatusLabel,
  opportunityTabs as tabs,
  resolveOpportunityTab,
  safeOpportunityReturnPath,
} from "./opportunity-workspace-presentation";
import type * as OpportunityTypes from "./opportunity-workspace-types";
import "../opportunities.css";
import "../opportunity-profit.css";
import "../opportunity-selection-entry.css";
import "../opportunity-ai.css";
import "../automatic-selection.css";
const route = useRoute(),
  router = useRouter();
const props = defineProps<{
    apiBaseUrl: string;
    opportunityId?: string;
    capabilities?: string[];
  }>(),
  request = createApiClient(props.apiBaseUrl),
  state = ref<OpportunityTypes.OpportunityWorkspaceState>("loading"),
  items = ref<OpportunityTypes.OpportunitySummary[]>([]),
  memberOptions = ref<Array<{ id: string; label: string }>>([]),
  costReviewerOptions = ref<Array<{ id: string; label: string }>>([]),
  selectedOpportunityIds = ref<string[]>([]),
  detail = ref<OpportunityTypes.OpportunityDetail | null>(null),
  profit = ref<OpportunityTypes.OpportunityProfitAnalysis | null>(null),
  aiAnalyses = ref<any[]>([]),
  aiLoadState = ref<OpportunityTypes.OpportunityPartialLoadState>("loading"),
  downstreamLoadState = ref<OpportunityTypes.OpportunityPartialLoadState>("loading"),
  competitorItems = ref<OpportunityTypes.OpportunityCompetitorSummary[]>([]),
  total = ref(0),
  page = ref(1),
  requestId = ref(""),
  message = ref(""),
  busy = ref(false),
  selectionView = ref<"recommended" | "evidence_pending" | "all">("recommended"),
  downstream = ref({ competitors: 0, snapshots: 0, searches: 0, suppliers: 0 }),
  tab = ref<OpportunityTypes.OpportunityTab>("overview"),
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
  }),
  feedbackForm = reactive({
    period_start: new Date().toISOString().slice(0, 10),
    period_end: new Date().toISOString().slice(0, 10),
    sales_units: 0,
    revenue_amount: 0,
    ad_spend_amount: 0,
    returned_units: 0,
    purchase_lead_time_days: 0,
    actual_profit_amount: 0,
    currency: "USD",
    source_ref: "",
    notes: "",
    observed_at: new Date().toISOString(),
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
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / 20)));
const canDecide = computed(() => props.capabilities?.includes("opportunity:decide") ?? false);
const canManageCompetitors = computed(
  () => props.capabilities?.includes("competitor:manage") ?? false,
);
const canReadCompetitors = computed(
  () =>
    props.capabilities?.includes("competitor:read") ||
    props.capabilities?.includes("competitor:manage") ||
    false,
);
const canManageSuppliers = computed(
  () => props.capabilities?.includes("supplier_quote:manage") ?? false,
);
const canReadSourcing = computed(
  () =>
    props.capabilities?.includes("sourcing:read") ||
    props.capabilities?.includes("supplier_quote:manage") ||
    false,
);
const canConfirmCost = computed(() => props.capabilities?.includes("cost:confirm") ?? false);
const returnPath = computed(() => safeOpportunityReturnPath(route.query.from));
const stateFrom = (kind: ApiFailureKind): OpportunityTypes.OpportunityWorkspaceState =>
  kind === "expired" || kind === "forbidden"
    ? kind
    : kind === "blocked" || kind === "rate_limited"
      ? "blocked"
      : "error";
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
  aiLoadState.value = "loading";
  try {
    const response = await request<any[]>(`/opportunities/${props.opportunityId}/ai-analyses`);
    aiAnalyses.value = Array.isArray(response.data) ? response.data : [];
    aiLoadState.value = "ready";
  } catch (error) {
    aiLoadState.value = "error";
    if (error instanceof ApiClientError) requestId.value = error.requestId;
  }
}
async function loadDownstream() {
  downstreamLoadState.value = "loading";
  try {
    const [competitorsResponse, sourcingResponse] = await Promise.all([
        canReadCompetitors.value
          ? request<OpportunityTypes.OpportunityCompetitorSummary[]>("/competitors")
          : Promise.resolve({ data: [] as OpportunityTypes.OpportunityCompetitorSummary[] }),
        canReadSourcing.value
          ? request<any[]>("/sourcing/searches")
          : Promise.resolve({ data: [] as any[] }),
      ]),
      competitors = competitorsResponse.data.filter(
        (item) => item.opportunity_id === props.opportunityId,
      ),
      searches = sourcingResponse.data.filter(
        (item: any) => item.input_type === "opportunity" && item.input_ref === props.opportunityId,
      );
    competitorItems.value = competitors;
    downstream.value = {
      competitors: competitors.length,
      snapshots: competitors.reduce((sum, item) => sum + Number(item.snapshot_count ?? 0), 0),
      searches: searches.length,
      suppliers: searches.reduce(
        (sum: number, item: any) => sum + Number(item.candidate_count ?? 0),
        0,
      ),
    };
    downstreamLoadState.value = "ready";
  } catch (error) {
    downstreamLoadState.value = "error";
    if (error instanceof ApiClientError) requestId.value = error.requestId;
  }
}
async function load() {
  state.value = "loading";
  message.value = "";
  try {
    if (props.opportunityId) {
      detail.value = (await read(`/opportunities/${props.opportunityId}`)).data;
      profit.value = (await read(`/opportunities/${props.opportunityId}/profit-analysis`)).data;
      if (canConfirmCost.value) {
        try {
          costReviewerOptions.value = (
            await request<Array<{ id: string; label: string }>>("/cost-input-reviewers")
          ).data;
        } catch {
          costReviewerOptions.value = [];
        }
      } else {
        costReviewerOptions.value = [];
      }
      await Promise.all([loadAi(), loadDownstream()]);
      state.value = "ready";
      return;
    }
    const params = new URLSearchParams({
      page: String(page.value),
      page_size: "20",
      selection_view: selectionView.value,
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
async function submitOperatingFeedback() {
  if (!detail.value) return;
  feedbackForm.observed_at = new Date().toISOString();
  const result = await write("/opportunities/" + detail.value.id + "/operating-feedback", {
    ...feedbackForm,
    currency: feedbackForm.currency.toUpperCase(),
    expected_version: detail.value.version,
  });
  if (!result) return;
  detail.value.operating_feedback = result;
  feedbackForm.source_ref = "";
  feedbackForm.notes = "";
  message.value = "经营复盘事实已写入；规则和人工决策均未自动变更。";
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
    await load();
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
  selectionView.value =
    route.query.view === "evidence_pending"
      ? "evidence_pending"
      : route.query.view === "all" || route.query.scope === "all"
        ? "all"
        : "recommended";
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
      view: selectionView.value === "recommended" ? undefined : selectionView.value,
    },
  });
  if (route.fullPath === previousPath) await load();
}
async function resetListFilters() {
  for (const key of Object.keys(filters) as Array<keyof typeof filters>) filters[key] = "";
  const previousPath = route.fullPath;
  await router.push({
    query: { view: selectionView.value === "recommended" ? undefined : selectionView.value },
  });
  if (route.fullPath === previousPath) await load();
}
async function setSelectionView(nextView: "recommended" | "evidence_pending" | "all") {
  if (selectionView.value === nextView) return;
  selectedOpportunityIds.value = [];
  await router.push({
    query: {
      ...route.query,
      view: nextView === "recommended" ? undefined : nextView,
      scope: undefined,
      page: undefined,
      decision_status: nextView === "all" ? route.query.decision_status : undefined,
    },
  });
}
async function goListPage(nextPage: number) {
  if (nextPage < 1 || nextPage > pageCount.value) return;
  await router.push({ query: { ...route.query, page: nextPage === 1 ? undefined : nextPage } });
}
async function setTab(nextTab: OpportunityTypes.OpportunityTab) {
  tab.value = nextTab;
  await router.replace({
    query: { ...route.query, tab: nextTab === "overview" ? undefined : nextTab },
  });
}
function syncTabFromRoute() {
  tab.value = resolveOpportunityTab(route.query.tab);
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
  if (
    !props.opportunityId &&
    canDecide.value &&
    (route.query.create === "1" || route.query.source_topic_id)
  ) {
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
    route.query.view,
    route.query.scope,
    route.query.page,
  ],
  () => {
    if (props.opportunityId || route.path !== "/opportunities") return;
    syncListRoute();
    queueLoad();
  },
);
</script>
<template>
  <section class="opportunity-workspace">
    <header v-if="!opportunityId" class="opportunity-hero">
      <div>
        <p>自动选品</p>
        <h2>
          {{
            selectionView === "recommended"
              ? "待我采纳"
              : selectionView === "evidence_pending"
                ? "自动补证中"
                : "全部机会"
          }}
        </h2>
        <span>系统持续监控和补证；只有达到规则要求的商品才会进入人工采纳队列。</span>
      </div>
      <div v-if="canDecide" class="opportunity-hero-actions">
        <RouterLink to="/trends?section=rules">管理选品规则</RouterLink
        ><button
          v-if="selectionView === 'all'"
          type="button"
          class="ghost"
          @click="showErpImport = true"
        >
          从 ERP 导入</button
        ><button
          v-if="selectionView === 'all'"
          type="button"
          class="ghost"
          @click="showCreate = true"
        >
          手工添加
        </button>
      </div>
      <span v-else>当前角色可查看机会事实与历史，写入操作需要“机会决策”权限。</span>
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
      :selection-view="selectionView"
      :items="items"
      :total="total"
      :state="state"
      :request-id="requestId"
      :filters="filters"
      :member-options="memberOptions"
      :selected-ids="selectedOpportunityIds"
      :page="page"
      :can-decide="canDecide"
      @apply="applyListFilters"
      @batch="openBatch"
      @create="showCreate = true"
      @manage-rules="router.push('/trends?section=rules')"
      @page="goListPage"
      @reset="resetListFilters"
      @view="setSelectionView"
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
            <span>推荐结论</span
            ><strong>{{ opportunityStatusLabel(detail.recommendation_status) }}</strong
            ><small
              >规则版本：{{ detail.score_rule_version ?? "尚未计算" }} · 置信度：{{
                opportunityStatusLabel(detail.confidence.status)
              }}{{ detail.confidence.score == null ? "" : `（${detail.confidence.score}）` }}</small
            >
          </div>
        </section>
        <OpportunityDecisionPanel
          :detail="detail"
          :busy="busy"
          :can-decide="canDecide"
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
          <button
            v-if="canManageCompetitors"
            type="button"
            :disabled="busy"
            @click="discoverCompetitors"
          >
            ① 采集 Amazon 竞品</button
          ><button
            v-if="canManageSuppliers"
            type="button"
            :disabled="busy"
            @click="discoverSuppliers"
          >
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
        <OpportunityDetailInsights
          v-if="['overview', 'market', 'competition', 'risk'].includes(tab)"
          :tab="tab"
          :detail="detail"
          :profit="profit"
          :downstream="downstream"
          :downstream-state="downstreamLoadState"
          :competitor-items="competitorItems"
          :busy="busy"
          :can-decide="canDecide"
          :can-manage-competitors="canManageCompetitors"
          :can-manage-suppliers="canManageSuppliers"
          :can-read-competitors="canReadCompetitors"
          :can-read-sourcing="canReadSourcing"
          @discover-competitors="discoverCompetitors"
          @discover-suppliers="discoverSuppliers"
          @queue-score="queueScore"
          @retry-downstream="loadDownstream"
        />
        <OpportunityLineagePanel v-else-if="tab === 'lineage'" :lineage="detail.lineage" />
        <OpportunityFeedbackPanel
          v-else-if="tab === 'feedback'"
          :feedback="detail.operating_feedback"
          :form="feedbackForm"
          :busy="busy"
          :can-write="canDecide"
          @submit="submitOperatingFeedback"
        />
        <OpportunityProfitPanel
          v-else-if="tab === 'profit'"
          :profit="profit"
          :cost-form="costForm"
          :reviewer-options="costReviewerOptions"
          :can-confirm-cost="canConfirmCost"
          :busy="busy"
          @confirm-cost="confirmCost"
          @review-cost="reviewCost"
          @queue-profit="queueProfit"
        />
        <OpportunityAiPanel
          v-else-if="tab === 'ai'"
          :analyses="aiAnalyses"
          :load-state="aiLoadState"
          :busy="busy"
          :can-decide="canDecide"
          @queue="queueAi"
          @retry="loadAi"
          @review="reviewAi"
        />
        <section v-else-if="tab === 'evidence'" class="opportunity-evidence">
          <header>
            <div>
              <p>可追溯证据</p>
              <h4>证据管理</h4>
            </div>
            <span>{{ detail.evidence.length }} 条</span>
          </header>
          <p v-if="!detail.evidence.length" class="opportunity-empty-copy">
            当前机会尚无关联证据。
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
      v-if="canDecide"
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
      v-if="canDecide"
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
