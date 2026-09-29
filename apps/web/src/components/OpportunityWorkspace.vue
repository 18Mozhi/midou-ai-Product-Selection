<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { ApiClientError, createApiClient, type ApiFailureKind } from "../api-client";
const OpportunityListPanel = defineAsyncComponent(() => import("./OpportunityListPanel.vue"));
const OpportunityDecisionPanel = defineAsyncComponent(
  () => import("./OpportunityDecisionPanel.vue"),
);
const OpportunityFeedbackPanel = defineAsyncComponent(
  () => import("./OpportunityFeedbackPanel.vue"),
);
const OpportunityLineagePanel = defineAsyncComponent(() => import("./OpportunityLineagePanel.vue"));
const OpportunityProfitPanel = defineAsyncComponent(() => import("./OpportunityProfitPanel.vue"));
const OpportunityEvidencePanel = defineAsyncComponent(
  () => import("./OpportunityEvidencePanel.vue"),
);
const OpportunityDetailInsights = defineAsyncComponent(
  () => import("./OpportunityDetailInsights.vue"),
);
const OpportunityDetailNavigation = defineAsyncComponent(
  () => import("./OpportunityDetailNavigation.vue"),
);
const OpportunityAiPanel = defineAsyncComponent(() => import("./OpportunityAiPanel.vue"));
const OpportunityWorkspaceDialogs = defineAsyncComponent(
  () => import("./OpportunityWorkspaceDialogs.vue"),
);
import { createOpportunityWorkspaceForms } from "./opportunity-workspace-forms";
import UiStatePanel from "./UiStatePanel.vue";
import AuditedReasonDialog from "./AuditedReasonDialog.vue";
import { durationLabel, statusLabel } from "../ui/status-labels";
import { useAuditedReason } from "../use-audited-reason";
import { useModalDialog } from "../use-modal-dialog";
import {
  loadAutomaticSelectionReadiness,
  type AutomaticSelectionReadiness,
} from "../automatic-selection-readiness";
import {
  formatOpportunityTime as freshness,
  opportunityStatusLabel,
  opportunityTabs as detailTabs,
  resolveOpportunityTab,
  safeOpportunityReturnPath,
} from "./opportunity-workspace-presentation";
import type * as OpportunityTypes from "./opportunity-workspace-types";
import "../opportunities.css";
import "../opportunity-profit.css";
import "../opportunity-selection-entry.css";
import "../opportunity-ai.css";
import "../opportunity-p18-workfaces.css";
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
  costReviewerLoadState = ref<"loading" | "ready" | "error">("loading"),
  costReviewerErrorMessage = ref(""),
  costReviewerRequestId = ref(""),
  selectedOpportunityIds = ref<string[]>([]),
  detail = ref<OpportunityTypes.OpportunityDetail | null>(null),
  profit = ref<OpportunityTypes.OpportunityProfitAnalysis | null>(null),
  profitLoadState = ref<"loading" | "ready" | "error">("loading"),
  profitErrorMessage = ref(""),
  profitRequestId = ref(""),
  aiAnalyses = ref<OpportunityTypes.OpportunityAiAnalysis[]>([]),
  aiLoadState = ref<OpportunityTypes.OpportunityPartialLoadState>("loading"),
  aiLoadErrorMessage = ref(""),
  aiRequestId = ref(""),
  pendingFeedbackWrites = ref<
    Record<string, { idempotencyKey: string; body: Record<string, unknown> }>
  >({}),
  feedbackWriteStates = ref<
    Record<string, { unknown: boolean; message: string; requestId: string }>
  >({}),
  downstreamLoadState = ref<OpportunityDownstreamStates>({
    competitors: "loading",
    sourcing: "loading",
  }),
  competitorItems = ref<OpportunityTypes.OpportunityCompetitorSummary[]>([]),
  total = ref(0),
  page = ref(1),
  requestId = ref(""),
  message = ref(""),
  erpBridgeBusy = ref(false),
  automationReadiness = ref<AutomaticSelectionReadiness | null>(null),
  busy = ref(false),
  selectionView = ref<"recommended" | "rule_candidates" | "evidence_pending" | "all">(
    "recommended",
  ),
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
  decisionReason = ref("");
const aiReviewError = ref("");
const aiReviewSubmission = shallowRef<{
  resultId: string;
  stage: "submitting" | "refreshing";
} | null>(null);
const createFeedback = ref<
  | {
      type: "error";
      message: string;
    }
  | {
      type: "created";
      id: string;
      name: string;
      submitted: { name: string; market: string; category: string; source_topic_id: string };
    }
  | null
>(null);
let createDialogGeneration = 0;
let batchDialogGeneration = 0;
let batchIntentGeneration = 0;
let batchSelectionGeneration = 0;
let decisionDialogGeneration = 0;
let erpDialogGeneration = 0;
let erpBridgeGeneration = 0;
let writeScopeGeneration = 0;
let activeWriteCounts = new Map<string, number>();
let workspaceActive = true;
let tabIntentGeneration = 0;
let aiRequestGeneration = 0;
let aiReviewIntentGeneration = 0;
let aiSnapshotOpportunityId = "";
function writeScopeKey(opportunityId = props.opportunityId) {
  return opportunityId ? `opportunity:${opportunityId}` : "opportunity-list";
}
function beginScopedWrite(scopeKey: string) {
  activeWriteCounts.set(scopeKey, (activeWriteCounts.get(scopeKey) ?? 0) + 1);
  if (workspaceActive && scopeKey === writeScopeKey()) busy.value = true;
}
function finishScopedWrite(scopeKey: string) {
  const remaining = Math.max(0, (activeWriteCounts.get(scopeKey) ?? 0) - 1);
  if (remaining) activeWriteCounts.set(scopeKey, remaining);
  else activeWriteCounts.delete(scopeKey);
  if (workspaceActive && scopeKey === writeScopeKey()) busy.value = remaining > 0;
}
function pendingWriteCount(scopeKey = writeScopeKey()) {
  return activeWriteCounts.get(scopeKey) ?? 0;
}
watch(
  showCreate,
  () => {
    createDialogGeneration += 1;
    createFeedback.value = null;
  },
  { flush: "sync" },
);
watch(
  showDecision,
  () => {
    decisionDialogGeneration += 1;
  },
  { flush: "sync" },
);
watch(
  showErpImport,
  () => {
    erpDialogGeneration += 1;
  },
  { flush: "sync" },
);
watch(
  () => [showBatch.value, route.fullPath, props.opportunityId],
  () => {
    batchDialogGeneration += 1;
  },
  { flush: "sync" },
);
watch(
  showBatch,
  (open) => {
    if (open) batchIntentGeneration += 1;
  },
  { flush: "sync" },
);
watch(
  selectedOpportunityIds,
  () => {
    batchSelectionGeneration += 1;
  },
  { deep: true, flush: "sync" },
);
watch(
  () => [route.fullPath, props.opportunityId],
  () => {
    createDialogGeneration += 1;
    createFeedback.value = null;
  },
  { flush: "sync" },
);
const { filters, form, costForm, feedbackForm } = createOpportunityWorkspaceForms();
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
type OpportunityDownstreamSource = "competitors" | "sourcing";
type OpportunityDownstreamStates = Record<
  OpportunityDownstreamSource,
  OpportunityTypes.OpportunityPartialLoadState
>;
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / 20)));
const currentPageSelectedItems = computed(() =>
  items.value.filter((item) => selectedOpportunityIds.value.includes(item.id)),
);
const outsideCurrentPageSelectedCount = computed(() =>
  Math.max(0, selectedOpportunityIds.value.length - currentPageSelectedItems.value.length),
);
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
const canOpenCompetitorWorkspace = computed(
  () => props.capabilities?.includes("competitor:read") ?? false,
);
const canOpenSourcingWorkspace = computed(
  () => props.capabilities?.includes("sourcing:read") ?? false,
);
const canConfirmCost = computed(() => props.capabilities?.includes("cost:confirm") ?? false);
const returnPath = computed(() => safeOpportunityReturnPath(route.query.from));
const stateFrom = (kind: ApiFailureKind): OpportunityTypes.OpportunityWorkspaceState =>
  kind === "expired" || kind === "forbidden"
    ? kind
    : kind === "blocked" || kind === "rate_limited"
      ? "blocked"
      : "error";
const statePanelKind = computed(() => (state.value === "ready" ? "empty" : state.value));
const statePanelPrimaryLabel = computed(() =>
  statePanelKind.value === "expired"
    ? "重新登录"
    : ["empty", "forbidden", "not_found"].includes(statePanelKind.value)
      ? "返回机会列表"
      : "",
);
const statePanelSecondaryLabel = computed(() =>
  ["error", "blocked"].includes(statePanelKind.value) ? "返回机会列表" : "",
);
function returnToOpportunityList() {
  void router.push("/opportunities");
}
function handleStatePrimary() {
  if (statePanelKind.value === "expired") {
    void router.push({
      path: "/login",
      query: { reason: "authentication_required", redirect: route.fullPath },
    });
    return;
  }
  if (["empty", "forbidden", "not_found"].includes(statePanelKind.value)) {
    returnToOpportunityList();
    return;
  }
  void load();
}
let readGeneration = 0;
async function read(path: string, isCurrent: () => boolean = () => true) {
  try {
    const response = await request<any>(path);
    if (isCurrent()) requestId.value = response.request_id;
    return response;
  } catch (error) {
    if (isCurrent() && error instanceof ApiClientError) {
      requestId.value = error.requestId;
      message.value = error.actionHint;
      state.value = stateFrom(error.kind);
    }
    throw error;
  }
}
async function loadAi(opportunityId = props.opportunityId, isCurrent?: () => boolean) {
  const generation = readGeneration;
  const requestGeneration = ++aiRequestGeneration;
  const ownsRead = isCurrent ?? (() => generation === readGeneration);
  aiLoadState.value = "loading";
  aiLoadErrorMessage.value = "";
  aiRequestId.value = "";
  try {
    const response = await request<unknown>(`/opportunities/${opportunityId}/ai-analyses`);
    if (!ownsRead() || requestGeneration !== aiRequestGeneration) return;
    if (!Array.isArray(response.data))
      throw new Error("AI 分析接口返回格式异常，不能将其解释为没有分析记录。");
    aiAnalyses.value = response.data as OpportunityTypes.OpportunityAiAnalysis[];
    aiSnapshotOpportunityId = opportunityId ?? "";
    aiLoadState.value = "ready";
  } catch (error) {
    if (!ownsRead() || requestGeneration !== aiRequestGeneration) return;
    aiLoadState.value = "error";
    if (error instanceof ApiClientError) {
      aiRequestId.value = error.requestId;
      aiLoadErrorMessage.value = error.actionHint;
    } else {
      aiLoadErrorMessage.value =
        error instanceof Error
          ? error.message
          : "AI 分析记录读取失败；当前数据保留为上次成功快照。";
    }
    if (aiRequestId.value) requestId.value = aiRequestId.value;
  }
}
async function loadDownstream(
  opportunityId = props.opportunityId,
  isCurrent?: () => boolean,
  onlySource?: OpportunityDownstreamSource,
) {
  const generation = readGeneration;
  const ownsRead = isCurrent ?? (() => generation === readGeneration);
  const sources: OpportunityDownstreamSource[] = onlySource
    ? [onlySource]
    : ["competitors", "sourcing"];

  for (const source of sources) {
    downstreamLoadState.value = { ...downstreamLoadState.value, [source]: "loading" };
    if (source === "competitors") {
      competitorItems.value = [];
      downstream.value = { ...downstream.value, competitors: 0, snapshots: 0 };
    } else {
      downstream.value = { ...downstream.value, searches: 0, suppliers: 0 };
    }
  }

  await Promise.all(
    sources.map(async (source) => {
      const hasAccess = source === "competitors" ? canReadCompetitors.value : canReadSourcing.value;
      if (!hasAccess || !opportunityId) {
        if (!ownsRead()) return;
        downstreamLoadState.value = { ...downstreamLoadState.value, [source]: "ready" };
        return;
      }

      try {
        if (source === "competitors") {
          const response =
            await request<OpportunityTypes.OpportunityCompetitorSummary[]>("/competitors");
          if (!ownsRead()) return;
          const competitors = response.data.filter((item) => item.opportunity_id === opportunityId);
          competitorItems.value = competitors;
          downstream.value = {
            ...downstream.value,
            competitors: competitors.length,
            snapshots: competitors.reduce((sum, item) => sum + Number(item.snapshot_count ?? 0), 0),
          };
        } else {
          const response = await request<any[]>("/sourcing/searches");
          if (!ownsRead()) return;
          const searches = response.data.filter(
            (item: any) => item.input_type === "opportunity" && item.input_ref === opportunityId,
          );
          downstream.value = {
            ...downstream.value,
            searches: searches.length,
            suppliers: searches.reduce(
              (sum: number, item: any) => sum + Number(item.candidate_count ?? 0),
              0,
            ),
          };
        }
        downstreamLoadState.value = { ...downstreamLoadState.value, [source]: "ready" };
      } catch (error) {
        if (!ownsRead()) return;
        if (source === "competitors") competitorItems.value = [];
        downstreamLoadState.value = { ...downstreamLoadState.value, [source]: "error" };
        if (error instanceof ApiClientError) requestId.value = error.requestId;
      }
    }),
  );
}
async function loadAutomationReadiness(isCurrent: () => boolean = () => true) {
  automationReadiness.value = null;
  const readiness = await loadAutomaticSelectionReadiness(request);
  if (isCurrent()) automationReadiness.value = readiness;
}
async function loadCostReviewers(isCurrent: () => boolean = () => true) {
  costReviewerLoadState.value = "loading";
  costReviewerErrorMessage.value = "";
  costReviewerRequestId.value = "";
  try {
    const reviewers = await request<Array<{ id: string; label: string }>>("/cost-input-reviewers");
    if (!isCurrent()) return;
    costReviewerOptions.value = reviewers.data;
    costReviewerLoadState.value = "ready";
  } catch (error) {
    if (!isCurrent()) return;
    costReviewerOptions.value = [];
    costReviewerLoadState.value = "error";
    if (error instanceof ApiClientError) {
      costReviewerRequestId.value = error.requestId;
      costReviewerErrorMessage.value = error.actionHint;
    } else {
      costReviewerErrorMessage.value = "暂时无法读取成本复核人名单，请稍后重试。";
    }
  }
}
async function retryCostReviewers() {
  const generation = readGeneration;
  const opportunityId = props.opportunityId;
  if (!opportunityId || !canConfirmCost.value || costReviewerLoadState.value === "loading") return;
  await loadCostReviewers(
    () => generation === readGeneration && props.opportunityId === opportunityId,
  );
}
async function loadProfitAnalysis(opportunityId: string, isCurrent: () => boolean) {
  profitLoadState.value = "loading";
  profitErrorMessage.value = "";
  profitRequestId.value = "";
  try {
    const response = await request<OpportunityTypes.OpportunityProfitAnalysis>(
      `/opportunities/${opportunityId}/profit-analysis`,
    );
    if (!isCurrent()) return false;
    profit.value = response.data;
    profitLoadState.value = "ready";
    return true;
  } catch (error) {
    if (!isCurrent()) return false;
    profitLoadState.value = "error";
    if (error instanceof ApiClientError) {
      profitErrorMessage.value = error.actionHint;
      profitRequestId.value = error.requestId;
      if (error.kind === "expired") {
        requestId.value = error.requestId;
        message.value = error.actionHint;
        state.value = stateFrom(error.kind);
        return false;
      }
    } else {
      profitErrorMessage.value = "暂时无法读取利润与成本，请稍后重试。";
    }
    return true;
  }
}
async function retryProfitAnalysis() {
  const generation = readGeneration;
  const opportunityId = props.opportunityId;
  if (!opportunityId || profitLoadState.value === "loading") return;
  await loadProfitAnalysis(
    opportunityId,
    () => generation === readGeneration && props.opportunityId === opportunityId,
  );
}
async function load() {
  const generation = ++readGeneration;
  const opportunityId = props.opportunityId;
  const isCurrent = () => generation === readGeneration;
  const nextAiOwner = opportunityId ?? "";
  if (aiSnapshotOpportunityId !== nextAiOwner) {
    aiAnalyses.value = [];
    aiSnapshotOpportunityId = nextAiOwner;
  }
  aiRequestGeneration += 1;
  aiLoadState.value = "loading";
  aiLoadErrorMessage.value = "";
  aiRequestId.value = "";
  state.value = "loading";
  message.value = "";
  try {
    if (opportunityId) {
      detail.value = null;
      profit.value = null;
      profitLoadState.value = "loading";
      profitErrorMessage.value = "";
      profitRequestId.value = "";
      const detailResponse = await read(`/opportunities/${opportunityId}`, isCurrent);
      if (!isCurrent()) return;
      detail.value = detailResponse.data;
      if (!(await loadProfitAnalysis(opportunityId, isCurrent)) || !isCurrent()) return;
      if (canConfirmCost.value) {
        await loadCostReviewers(isCurrent);
      } else {
        costReviewerOptions.value = [];
        costReviewerLoadState.value = "ready";
        costReviewerErrorMessage.value = "";
        costReviewerRequestId.value = "";
      }
      if (!isCurrent()) return;
      await Promise.all([
        loadAi(opportunityId, isCurrent),
        loadDownstream(opportunityId, isCurrent),
      ]);
      if (!isCurrent()) return;
      state.value = "ready";
      return;
    }
    const params = new URLSearchParams({
      page: String(page.value),
      page_size: "20",
      selection_view: selectionView.value,
    });
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    const result = await read(`/opportunities?${params}`, isCurrent);
    if (!isCurrent()) return;
    items.value = result.data;
    const readinessPromise = loadAutomationReadiness(isCurrent);
    try {
      memberOptions.value = (await request<any[]>("/opportunities/member-options")).data;
    } catch (error) {
      if (!isCurrent()) return;
      if (!(error instanceof ApiClientError)) throw error;
      memberOptions.value = [];
      requestId.value = error.requestId;
      message.value = "机会已加载；组织成员选项暂不可用，批量指派需稍后重试。";
    }
    await readinessPromise;
    if (!isCurrent()) return;
    total.value = (result.meta as { total: number }).total;
    state.value = items.value.length ? "ready" : "empty";
  } catch (error) {
    if (isCurrent() && !(error instanceof ApiClientError)) state.value = "blocked";
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
  const opportunityId = detail.value.id;
  let pending = pendingFeedbackWrites.value[opportunityId];
  if (!pending) {
    feedbackForm.observed_at = new Date().toISOString();
    pending = {
      idempotencyKey: crypto.randomUUID(),
      body: {
        ...feedbackForm,
        currency: feedbackForm.currency.toUpperCase(),
        expected_version: detail.value.version,
      },
    };
    pendingFeedbackWrites.value = {
      ...pendingFeedbackWrites.value,
      [opportunityId]: pending,
    };
  }
  await sendOperatingFeedback(opportunityId, pending);
}
async function retryUnknownOperatingFeedback() {
  const opportunityId = detail.value?.id;
  const pending = opportunityId ? pendingFeedbackWrites.value[opportunityId] : undefined;
  if (!opportunityId || !pending || !feedbackWriteStates.value[opportunityId]?.unknown) return;
  await sendOperatingFeedback(opportunityId, pending);
}
function markPendingFeedbackWritesUnknown() {
  const next = { ...feedbackWriteStates.value };
  let changed = false;
  for (const opportunityId of Object.keys(pendingFeedbackWrites.value)) {
    const current = next[opportunityId];
    if (current?.unknown) continue;
    next[opportunityId] = {
      unknown: true,
      message: "页面切换前未能确认本次提交结果；请返回该机会并用同一请求标识恢复核对。",
      requestId: current?.requestId ?? "",
    };
    changed = true;
  }
  if (changed) feedbackWriteStates.value = next;
}
async function sendOperatingFeedback(
  opportunityId: string,
  pending: { idempotencyKey: string; body: Record<string, unknown> },
) {
  if (busy.value) return;
  const generation = writeScopeGeneration;
  const scopeKey = writeScopeKey(opportunityId);
  const ownsScope = () => generation === writeScopeGeneration;
  beginScopedWrite(scopeKey);
  message.value = "";
  feedbackWriteStates.value = {
    ...feedbackWriteStates.value,
    [opportunityId]: { unknown: false, message: "", requestId: "" },
  };
  try {
    const response = await request<OpportunityTypes.OpportunityDetail["operating_feedback"]>(
      `/opportunities/${opportunityId}/operating-feedback`,
      { method: "POST", body: pending.body, idempotencyKey: pending.idempotencyKey },
    );
    if (!ownsScope()) return;
    const result = response.data;
    if (!result || !Array.isArray(result.facts) || !("calibration" in result))
      throw new Error("服务端已响应，但返回内容不完整；请使用原请求标识恢复核对。");
    requestId.value = response.request_id;
    delete pendingFeedbackWrites.value[opportunityId];
    delete feedbackWriteStates.value[opportunityId];
    if (detail.value?.id !== opportunityId) return;
    detail.value.operating_feedback = result;
    feedbackForm.source_ref = "";
    feedbackForm.notes = "";
    message.value = "经营复盘事实已写入；规则和人工决策均未自动变更。";
  } catch (error) {
    if (!ownsScope()) return;
    const apiError = error instanceof ApiClientError ? error : null;
    const unknown = !apiError || apiError.status === 0 || apiError.status >= 500;
    const nextState = {
      unknown,
      message:
        apiError?.actionHint ?? (error instanceof Error ? error.message : "提交结果暂未确认。"),
      requestId: apiError?.requestId ?? "",
    };
    if (!unknown) delete pendingFeedbackWrites.value[opportunityId];
    feedbackWriteStates.value = {
      ...feedbackWriteStates.value,
      [opportunityId]: nextState,
    };
    if (nextState.requestId) requestId.value = nextState.requestId;
    message.value = nextState.message;
  } finally {
    finishScopedWrite(scopeKey);
  }
}
async function write(path: string, body: unknown, refreshOnStaleReceipt = true) {
  if (busy.value) return null;
  const generation = writeScopeGeneration;
  const scopeKey = writeScopeKey();
  const ownsScope = () => generation === writeScopeGeneration;
  beginScopedWrite(scopeKey);
  message.value = "";
  try {
    const response = await request<any>(path, { method: "POST", body });
    if (!ownsScope()) {
      if (workspaceActive && scopeKey === writeScopeKey()) {
        requestId.value = response.request_id;
        if (refreshOnStaleReceipt) {
          await load();
          message.value = "页面切换期间写入回执已到达；已刷新当前工作区，请核对最新状态。";
        }
      }
      return null;
    }
    requestId.value = response.request_id;
    return response.data;
  } catch (error) {
    if (!ownsScope()) {
      if (workspaceActive && scopeKey === writeScopeKey()) {
        const apiError = error instanceof ApiClientError ? error : null;
        await load();
        if (apiError) {
          requestId.value = apiError.requestId;
          message.value = `页面切换期间未能确认写入结果；已重新读取当前工作区。${apiError.actionHint}`;
        } else {
          message.value = "页面切换期间未能确认写入结果；已重新读取当前工作区，且不会自动重试。";
        }
      }
      return null;
    }
    if (error instanceof ApiClientError) {
      requestId.value = error.requestId;
      message.value = error.actionHint;
    } else message.value = "依赖暂不可用，未写入任何状态。";
    return null;
  } finally {
    finishScopedWrite(scopeKey);
  }
}
async function create() {
  if (busy.value) return;
  const submitted = { ...form },
    dialogGeneration = createDialogGeneration,
    routePath = route.fullPath,
    opportunityId = props.opportunityId;
  const result = await write("/opportunities", {
    name: submitted.name,
    market: submitted.market,
    category: submitted.category || null,
    source_topic_id: submitted.source_topic_id || null,
  });
  const sameRoute = route.fullPath === routePath && props.opportunityId === opportunityId;
  if (!result) {
    if (sameRoute && showCreate.value)
      createFeedback.value = {
        type: "error",
        message: message.value || "本次创建未能确认；请核对反馈后再重试。",
      };
    return;
  }
  if (sameRoute && showCreate.value && dialogGeneration === createDialogGeneration) {
    createFeedback.value = null;
    showCreate.value = false;
    await router.push(`/opportunities/${result.id}`);
    return;
  }
  const staleSuccess = {
    type: "created" as const,
    id: String(result.id),
    name: submitted.name,
    submitted,
  };
  if (!sameRoute) return;
  if (showCreate.value) createFeedback.value = staleSuccess;
  else message.value = `机会“${submitted.name}”已创建；当前列表未跳转，请在列表中查看。`;
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
async function persistErpProducts(
  data: {
    items: unknown[];
    source_url: string;
    captured_at: string;
    total?: number;
  },
  ownsIntent: () => boolean,
  ownsPage: () => boolean,
) {
  const result = await write("/imports/erp-products", data);
  if (!result) return;
  if (ownsIntent()) showErpImport.value = false;
  if (!ownsPage()) return;
  await load();
  if (!ownsPage()) return;
  message.value =
    `ERP 已读取 ${result.received_count} 条：新增 ${result.opportunity_count} 个机会、` +
    `${result.competitor_count} 个亚马逊待采集竞品、` +
    `${result.sourcing_search_count} 个货源匹配任务；原始记录已保存为证据。`;
}
async function importFromErpBrowser() {
  if (busy.value || erpBridgeBusy.value) return;
  const bridgeGeneration = ++erpBridgeGeneration;
  const ownership = captureErpImportOwnership();
  const ownsBridge = () => bridgeGeneration === erpBridgeGeneration && ownership.ownsPage();
  erpBridgeBusy.value = true;
  message.value = "正在从已登录的 ERP 商品列表读取数据…";
  try {
    const data = await browserBridge<{
      items: unknown[];
      source_url: string;
      captured_at: string;
      total: number;
    }>("erp.products.read", { limit: Number(erpImportLimit.value) });
    if (!ownsBridge() || !ownership.ownsIntent()) return;
    await persistErpProducts(data, ownership.ownsIntent, ownership.ownsPage);
  } catch (error) {
    if (!ownsBridge() || !ownership.ownsIntent()) return;
    const code = error instanceof Error ? error.message : "";
    message.value =
      code === "erp_login_page_opened"
        ? "已打开 ERP 登录页。登录完成并进入商品列表后，再点击“从当前浏览器读取”。"
        : code === "erp_login_required"
          ? "ERP 登录状态无效，请在 ERP 页面重新登录。"
          : "未检测到浏览器助手或 ERP 权限未授予。请先下载并加载浏览器助手。";
  } finally {
    if (bridgeGeneration === erpBridgeGeneration) erpBridgeBusy.value = false;
  }
}
async function importErpFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const ownership = captureErpImportOwnership();
  try {
    const parsed = JSON.parse(await file.text());
    if (!ownership.ownsIntent()) return;
    const items = Array.isArray(parsed) ? parsed : parsed?.list;
    await persistErpProducts(
      {
        items,
        source_url: "https://medou.medouai.com/#/ProductList",
        captured_at: new Date().toISOString(),
      },
      ownership.ownsIntent,
      ownership.ownsPage,
    );
  } catch {
    if (ownership.ownsIntent())
      message.value = "ERP JSON 文件格式无效；应为接口返回的 list 数组或商品数组。";
  }
}
function captureErpImportOwnership() {
  const dialogGeneration = erpDialogGeneration;
  const scopeGeneration = writeScopeGeneration;
  const routePath = route.fullPath;
  const ownsPage = () =>
    scopeGeneration === writeScopeGeneration &&
    route.fullPath === routePath &&
    route.path === "/opportunities" &&
    !props.opportunityId;
  const ownsIntent = () =>
    ownsPage() && showErpImport.value && dialogGeneration === erpDialogGeneration;
  return { ownsIntent, ownsPage };
}
function startDecision(action: "adopt" | "observe" | "reject") {
  decisionAction.value = action;
  decisionReason.value = "";
  showDecision.value = true;
}
async function decide() {
  if (busy.value || !detail.value) return;
  const submitted = {
    opportunityId: detail.value.id,
    action: decisionAction.value,
    reason: decisionReason.value,
    expectedVersion: detail.value.version,
  };
  const dialogGeneration = decisionDialogGeneration;
  const result = await write(`/opportunities/${submitted.opportunityId}/decisions`, {
    action: submitted.action,
    reason: submitted.reason,
    expected_version: submitted.expectedVersion,
  });
  if (result) {
    if (detail.value?.id !== submitted.opportunityId) return;
    if (decisionDialogGeneration === dialogGeneration) showDecision.value = false;
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
    const queueReceipt = "评分任务已进入宝塔 Node Worker 队列；完成后刷新可见新运行记录。";
    if (state.value !== "ready") {
      const refreshFailure = message.value || "工作区暂时无法刷新。";
      message.value = `${queueReceipt} 工作区刷新失败：${refreshFailure}`;
      return;
    }
    message.value = queueReceipt;
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
  if (!currentPageSelectedItems.value.length) return;
  batchAction.value = action;
  batchReason.value = "";
  batchAssigneeId.value = "";
  showBatch.value = true;
}
async function confirmBatch() {
  if (busy.value) return;
  const selectedItems = currentPageSelectedItems.value;
  if (!selectedItems.length || !batchReason.value.trim()) return;
  const dialogGeneration = batchDialogGeneration,
    intentGeneration = batchIntentGeneration,
    selectionGeneration = batchSelectionGeneration,
    routePath = route.fullPath,
    opportunityId = props.opportunityId;
  const result = await write("/opportunities/batch", {
    action: batchAction.value,
    items: selectedItems.map((item) => ({ id: item.id, expected_version: item.version })),
    reason: batchReason.value.trim(),
    assignee_id: batchAction.value === "assign" ? batchAssigneeId.value : null,
  });
  if (!result || route.fullPath !== routePath || props.opportunityId !== opportunityId) return;

  if (batchDialogGeneration === dialogGeneration) showBatch.value = false;
  if (
    batchIntentGeneration === intentGeneration &&
    batchSelectionGeneration === selectionGeneration
  )
    selectedOpportunityIds.value = [];
  const completionGeneration = batchDialogGeneration;
  await load();
  if (
    route.fullPath === routePath &&
    props.opportunityId === opportunityId &&
    batchDialogGeneration === completionGeneration &&
    !showBatch.value
  )
    message.value = `批量操作已完成 ${result.affected_count} 项，每个机会均保留独立事件。`;
}
async function confirmCost() {
  if (busy.value || !detail.value) return;
  const submitted = {
    opportunityId: detail.value.id,
    inputType: costForm.input_type,
    body: {
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
    },
  };
  const result = await write(
    `/opportunities/${submitted.opportunityId}/cost-inputs`,
    submitted.body,
  );
  if (result) {
    await load();
    message.value = `${submitted.inputType} 已提交双人复核；通过前不会影响利润。`;
  }
}
async function reviewCost(payload: {
  reviewId: string;
  decision: "approved" | "rejected";
  reason: string;
  expectedVersion: number;
}) {
  if (busy.value || !detail.value) return;
  const submitted = {
    opportunityId: detail.value.id,
    reviewId: payload.reviewId,
    decision: payload.decision,
    reason: payload.reason,
    expectedVersion: payload.expectedVersion,
  };
  const result = await write(
    `/opportunities/${submitted.opportunityId}/cost-input-reviews/${submitted.reviewId}/actions`,
    {
      decision: submitted.decision,
      reason: submitted.reason,
      expected_version: submitted.expectedVersion,
    },
  );
  if (!result) return;
  await load();
  message.value =
    submitted.decision === "approved"
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
  const opportunityId = detail.value.id;
  const routePath = route.path;
  const tabGeneration = tabIntentGeneration;
  const result = await write(`/opportunities/${opportunityId}/ai-analyses`, {
    expected_version: detail.value.version,
  });
  if (result) {
    if (detail.value?.id !== opportunityId || route.path !== routePath) return;
    if (tabIntentGeneration === tabGeneration) await setTab("ai");
    message.value = "AI 辅助分析已进入宝塔 Node Worker 队列；不会自动修改评分或决策。";
    await loadAi(
      opportunityId,
      () => detail.value?.id === opportunityId && route.path === routePath,
    );
  }
}
async function reviewAi(resultId: string, outcome: "approved" | "rejected") {
  if (busy.value || aiReviewSubmission.value) return;
  const opportunityId = detail.value?.id;
  if (!opportunityId) return;
  const intentGeneration = aiReviewIntentGeneration;
  const reasonRequest = {
    title: outcome === "approved" ? "填写抽检通过说明" : "填写驳回原因",
    description: "说明会写入 AI 分析人工复核记录，原始输出不会被改写。",
    minimumLength: 2,
    maximumLength: 1000,
  };
  aiReviewError.value = "";
  let notes = await askAiReviewReason(reasonRequest);
  try {
    while (notes) {
      if (intentGeneration !== aiReviewIntentGeneration || detail.value?.id !== opportunityId)
        return;
      if (busy.value || aiReviewSubmission.value) return;
      aiReviewError.value = "";
      aiReviewSubmission.value = { resultId, stage: "submitting" };
      const result = await write(`/ai-analyses/${resultId}/reviews`, { outcome, notes }, false);
      if (detail.value?.id !== opportunityId) return;
      if (intentGeneration !== aiReviewIntentGeneration) {
        if (route.path === `/opportunities/${opportunityId}`) {
          aiReviewSubmission.value = { resultId, stage: "refreshing" };
          message.value = "页面切换期间抽检回执未在原操作面板确认；正在重新读取最新状态。";
          await loadAi(opportunityId, () => detail.value?.id === opportunityId);
        }
        return;
      }
      if (result) {
        aiReviewSubmission.value = { resultId, stage: "refreshing" };
        message.value = "人工抽检已记录，AI 原始输出未被改写。";
        await loadAi(opportunityId, () => detail.value?.id === opportunityId);
        return;
      }
      aiReviewSubmission.value = null;
      if (detail.value?.id !== opportunityId || tab.value !== "ai") return;
      aiReviewError.value = message.value || "本次抽检未能确认，请核对记录后再决定是否重试。";
      notes = await askAiReviewReason({ ...reasonRequest, initialValue: notes });
    }
  } finally {
    aiReviewSubmission.value = null;
    if (!notes) aiReviewError.value = "";
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
    route.query.view === "rule_candidates"
      ? "rule_candidates"
      : route.query.view === "evidence_pending"
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
async function setSelectionView(
  nextView: "recommended" | "rule_candidates" | "evidence_pending" | "all",
) {
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
  if (tab.value !== nextTab) tabIntentGeneration += 1;
  tab.value = nextTab;
  await router.replace({
    query: { ...route.query, tab: nextTab === "overview" ? undefined : nextTab },
  });
}
function syncTabFromRoute() {
  const nextTab = resolveOpportunityTab(route.query.tab);
  if (tab.value !== nextTab) tabIntentGeneration += 1;
  tab.value = nextTab;
}
function syncCreateRouteIntent() {
  if (
    props.opportunityId ||
    route.path !== "/opportunities" ||
    !canDecide.value ||
    (route.query.create !== "1" && !route.query.source_topic_id)
  )
    return;
  form.source_topic_id =
    typeof route.query.source_topic_id === "string" ? route.query.source_topic_id : "";
  form.name = typeof route.query.name === "string" ? route.query.name : "";
  form.market = typeof route.query.market === "string" ? route.query.market : "US";
  form.category = typeof route.query.category === "string" ? route.query.category : "";
  showCreate.value = true;
}
let loadQueued = false;
let wasDeactivated = false;
function closeTransientDialogs() {
  showCreate.value = false;
  showErpImport.value = false;
  showBatch.value = false;
  showDecision.value = false;
  decisionAction.value = "observe";
  decisionReason.value = "";
}
function queueLoad() {
  if (loadQueued) return;
  loadQueued = true;
  queueMicrotask(() => {
    loadQueued = false;
    void load();
  });
}
onDeactivated(() => {
  workspaceActive = false;
  closeTransientDialogs();
  if (aiReviewSubmission.value) aiReviewIntentGeneration += 1;
  readGeneration += 1;
  erpBridgeGeneration += 1;
  erpBridgeBusy.value = false;
  markPendingFeedbackWritesUnknown();
  writeScopeGeneration += 1;
  busy.value = false;
  wasDeactivated = true;
});
onActivated(() => {
  workspaceActive = true;
  busy.value = pendingWriteCount() > 0;
  if (!wasDeactivated) return;
  wasDeactivated = false;
  syncCreateRouteIntent();
  queueLoad();
});
onMounted(() => {
  syncTabFromRoute();
  syncListRoute();
  syncCreateRouteIntent();
  void load();
});
watch(
  () => props.opportunityId,
  (opportunityId, previousOpportunityId) => {
    if (opportunityId !== previousOpportunityId) {
      aiReviewIntentGeneration += 1;
      closeTransientDialogs();
      cancelAiReviewReason();
      aiReviewError.value = "";
    }
    readGeneration += 1;
    erpBridgeGeneration += 1;
    erpBridgeBusy.value = false;
    markPendingFeedbackWritesUnknown();
    writeScopeGeneration += 1;
    busy.value = pendingWriteCount() > 0;
    aiReviewSubmission.value = null;
    detail.value = null;
    profit.value = null;
    profitLoadState.value = "loading";
    profitErrorMessage.value = "";
    profitRequestId.value = "";
    syncTabFromRoute();
    queueLoad();
  },
  { flush: "sync" },
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
    readGeneration += 1;
    syncListRoute();
    queueLoad();
  },
  { flush: "sync" },
);
onBeforeUnmount(() => {
  readGeneration += 1;
  erpBridgeGeneration += 1;
  erpBridgeBusy.value = false;
  writeScopeGeneration += 1;
  aiReviewSubmission.value = null;
});
</script>
<template>
  <section class="opportunity-workspace opportunity-workspace--review">
    <header v-if="!opportunityId" class="opportunity-hero">
      <div>
        <p>自动选品</p>
        <h2>
          {{
            selectionView === "recommended"
              ? "待我采纳"
              : selectionView === "rule_candidates"
                ? "规则命中候选"
                : selectionView === "evidence_pending"
                  ? "采集中"
                  : "全部机会"
          }}
        </h2>
        <span>规则命中先进入候选；五项质量门全部通过后，才进入你的人工采纳清单。</span>
      </div>
      <div v-if="canDecide" class="opportunity-hero-actions">
        <RouterLink class="primary so-action-primary" to="/opportunities/start"
          >创建选品 →</RouterLink
        ><RouterLink class="secondary so-action-secondary" to="/trends?section=rules"
          >管理选品规则</RouterLink
        ><button
          v-if="selectionView === 'all'"
          type="button"
          class="ghost secondary so-action-secondary"
          @click="showErpImport = true"
        >
          从 ERP 导入</button
        ><button
          v-if="selectionView === 'all'"
          type="button"
          class="ghost secondary so-action-secondary"
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
      :current-page-selected-count="currentPageSelectedItems.length"
      :outside-current-page-selected-count="outsideCurrentPageSelectedCount"
      :page="page"
      :can-decide="canDecide"
      :automation-readiness="automationReadiness"
      @apply="applyListFilters"
      @batch="openBatch"
      @create="showCreate = true"
      @manage-setup="router.push($event)"
      @page="goListPage"
      @reset="resetListFilters"
      @view="setSelectionView"
      @update:selected-ids="selectedOpportunityIds = $event"
    />
    <template v-else
      ><UiStatePanel
        v-if="state !== 'ready' || !detail"
        :kind="statePanelKind"
        :request-id="requestId"
        :primary-label="statePanelPrimaryLabel"
        :secondary-label="statePanelSecondaryLabel"
        :hide-secondary="!statePanelSecondaryLabel"
        @primary="handleStatePrimary"
        @secondary="returnToOpportunityList"
      />
      <article v-else class="opportunity-detail opportunity-detail--c">
        <OpportunityDetailNavigation :active-tab="tab" :items="detailTabs" @select="setTab" />
        <main class="opportunity-detail-main">
          <header class="opportunity-detail-heading">
            <p class="opportunity-detail-heading__eyebrow">
              {{ statusLabel(detail.lifecycle_status) }} · {{ detail.market }} ·
              {{ detail.category || "未分类" }}
            </p>
            <h1>{{ detail.name }}</h1>
            <div class="opportunity-detail-heading__meta">
              <span>更新 {{ freshness(detail.updated_at) }}</span>
              <span>来源 {{ opportunityStatusLabel(detail.source_type) }}</span>
            </div>
            <details class="opportunity-technical-details">
              <summary>运行信息</summary>
              <small
                >当前阶段已停留 {{ durationLabel(detail.lifecycle_dwell_seconds) }} · 数据版本 v{{
                  detail.version
                }}
                · 评分规则 {{ detail.score_rule_version ?? "尚未计算" }}</small
              >
            </details>
          </header>
          <div class="opportunity-detail-workface">
            <OpportunityDecisionPanel
              :detail="detail"
              :busy="busy"
              :can-decide="canDecide"
              @decide="startDecision"
              @create-evidence-task="createEvidenceTask"
            />
            <section
              v-if="detail.selection_stage !== 'recommended'"
              class="opportunity-next-steps opportunity-collection-tools"
            >
              <details>
                <summary>补证异常时手动处理</summary>
                <p>系统会持续自动补证；只有需要立即重试时才使用下面的操作。</p>
                <div>
                  <button
                    v-if="canManageCompetitors"
                    type="button"
                    :disabled="busy"
                    @click="discoverCompetitors"
                  >
                    采集 Amazon 竞品</button
                  ><button
                    v-if="canManageSuppliers"
                    type="button"
                    :disabled="busy"
                    @click="discoverSuppliers"
                  >
                    采集公开供应商</button
                  ><RouterLink to="/opportunities/scoring-rules">检查评分规则</RouterLink>
                </div>
              </details>
            </section>
            <div class="opportunity-detail-section-content">
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
                :can-open-competitor-workspace="canOpenCompetitorWorkspace"
                :can-open-sourcing-workspace="canOpenSourcingWorkspace"
                @discover-competitors="discoverCompetitors"
                @discover-suppliers="discoverSuppliers"
                @queue-score="queueScore"
                @retry-downstream="loadDownstream(detail?.id, undefined, $event)"
                @select-tab="setTab"
              />
              <OpportunityLineagePanel v-else-if="tab === 'lineage'" :lineage="detail.lineage" />
              <OpportunityFeedbackPanel
                v-else-if="tab === 'feedback'"
                :feedback="detail.operating_feedback"
                :form="feedbackForm"
                :busy="busy"
                :can-write="canDecide"
                :error-message="feedbackWriteStates[detail.id]?.message || ''"
                :request-id="feedbackWriteStates[detail.id]?.requestId || ''"
                :unknown-write="Boolean(feedbackWriteStates[detail.id]?.unknown)"
                @submit="submitOperatingFeedback"
                @retry-unknown="retryUnknownOperatingFeedback"
              />
              <OpportunityProfitPanel
                v-else-if="tab === 'profit'"
                :profit="profit"
                :profit-load-state="profitLoadState"
                :profit-error-message="profitErrorMessage"
                :profit-request-id="profitRequestId"
                :cost-form="costForm"
                :reviewer-options="costReviewerOptions"
                :reviewer-load-state="costReviewerLoadState"
                :reviewer-error-message="costReviewerErrorMessage"
                :reviewer-request-id="costReviewerRequestId"
                :can-confirm-cost="canConfirmCost"
                :busy="busy"
                @confirm-cost="confirmCost"
                @retry-reviewers="retryCostReviewers"
                @retry-profit="retryProfitAnalysis"
                @review-cost="reviewCost"
                @queue-profit="queueProfit"
              />
              <OpportunityAiPanel
                v-else-if="tab === 'ai'"
                :analyses="aiAnalyses"
                :load-state="aiLoadState"
                :load-error-message="aiLoadErrorMessage"
                :request-id="aiRequestId"
                :busy="busy"
                :reviewing-result-id="aiReviewSubmission?.resultId ?? ''"
                :review-stage="aiReviewSubmission?.stage ?? ''"
                :can-decide="canDecide"
                @queue="queueAi"
                @retry="loadAi"
                @review="reviewAi"
              />
              <OpportunityEvidencePanel
                v-else-if="tab === 'evidence'"
                :evidence="detail.evidence"
                :opportunity-id="detail.id"
              />
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
                      >{{ freshness(item.created_at) }} · 版本 v{{ item.opportunity_version }} ·
                      操作者 {{ item.actor_id.slice(0, 8) }}…</small
                    >
                  </div>
                </article>
              </section>
            </div>
          </div>
        </main>
      </article></template
    >
    <OpportunityWorkspaceDialogs
      v-if="canDecide"
      v-model:erp-import-open="showErpImport"
      v-model:create-open="showCreate"
      v-model:decision-open="showDecision"
      v-model:erp-import-limit="erpImportLimit"
      v-model:decision-reason="decisionReason"
      :busy="busy || erpBridgeBusy"
      :form="form"
      :create-feedback="createFeedback"
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
          本次仅处理当前结果中已选的
          {{ currentPageSelectedItems.length }} 个机会；任一版本变化都会整批回滚。
        </p>
        <p v-if="outsideCurrentPageSelectedCount" class="opportunity-batch-scope-note">
          另有 {{ outsideCurrentPageSelectedCount }} 个已选机会不在当前结果中，不会随本次操作提交。
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
      :error="aiReviewError"
      :minimum-length="aiReviewReasonRequest?.minimumLength"
      :maximum-length="aiReviewReasonRequest?.maximumLength"
      @submit="submitAiReviewReason"
      @cancel="cancelAiReviewReason"
    />
  </section>
</template>

<style scoped src="./OpportunityWorkspace.css"></style>
