<script setup lang="ts">
import { defineAsyncComponent, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ApiClientError, createApiClient } from "../api-client";
const OpportunityListPanel = defineAsyncComponent(() => import("./OpportunityListPanel.vue"));
const OpportunityDecisionPanel = defineAsyncComponent(
  () => import("./OpportunityDecisionPanel.vue"),
);
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
const OpportunityWorkspaceDialogs = defineAsyncComponent(
  () => import("./OpportunityWorkspaceDialogs.vue"),
);
import { createOpportunityWorkspaceForms } from "./opportunity-workspace-forms";
import UiStatePanel from "./UiStatePanel.vue";
import SelectionProductHeader from "./SelectionProductHeader.vue";
import { useModalDialog } from "../use-modal-dialog";
import type { AutomaticSelectionReadiness } from "../automatic-selection-readiness";
import {
  formatOpportunityTime as freshness,
  opportunityStatusLabel,
  opportunityTabs as detailTabs,
} from "./opportunity-workspace-presentation";
import type * as OpportunityTypes from "./opportunity-workspace-types";
import {
  useOpportunityWorkspaceReads,
  type OpportunityDownstreamStates,
} from "./use-opportunity-workspace-reads";
import { useOpportunityWorkspaceNavigation } from "./use-opportunity-workspace-navigation";
import { useOpportunityWorkspaceAccess } from "./use-opportunity-workspace-access";
import { useOpportunityWorkspaceErpImport } from "./use-opportunity-workspace-erp-import";
import { useOpportunityWorkspaceDecisionFocus } from "./use-opportunity-workspace-decision-focus";
import { useOpportunityWorkspaceLifecycle } from "./use-opportunity-workspace-lifecycle";
import { useOpportunityWorkspaceWriteScopes } from "./use-opportunity-workspace-write-scopes";
import { useOpportunityWorkspaceCollectionActions } from "./use-opportunity-workspace-collection-actions";
import { useOpportunityWorkspaceListState } from "./use-opportunity-workspace-list-state";
import "../opportunities.css";
import "../opportunity-profit.css";
import "../opportunity-selection-entry.css";
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
let workspaceActive = true;
const { pendingDecisionFocus, captureDecisionFocus, restoreDecisionFocus } =
  useOpportunityWorkspaceDecisionFocus({
    opportunityId: () => props.opportunityId,
    workspaceActive: () => workspaceActive,
  });
const { createFeedback, pageCount, currentPageSelectedItems, outsideCurrentPageSelectedCount } =
  useOpportunityWorkspaceListState({ items, selectedOpportunityIds, total });
let createDialogGeneration = 0;
let batchDialogGeneration = 0;
let batchIntentGeneration = 0;
let batchSelectionGeneration = 0;
let decisionDialogGeneration = 0;
let erpDialogGeneration = 0;
let erpBridgeGeneration = 0;
let writeScopeGeneration = 0;
const { writeScopeKey, beginScopedWrite, finishScopedWrite, pendingWriteCount } =
  useOpportunityWorkspaceWriteScopes({
    opportunityId: () => props.opportunityId,
    workspaceActive: () => workspaceActive,
    busy,
  });
const { filters, form, costForm } = createOpportunityWorkspaceForms();
const { dialogElement: batchDialogElement, handleCancel: handleBatchCancel } = useModalDialog(
  () => showBatch.value,
  () => (showBatch.value = false),
  undefined,
  { trapFocus: true },
);
const {
  canDecide,
  canManageCompetitors,
  canReadCompetitors,
  canManageSuppliers,
  canReadSourcing,
  canOpenCompetitorComparison,
  canOpenSourcingWorkspace,
  canConfirmCost,
  returnPath,
  statePanelKind,
  statePanelPrimaryLabel,
  statePanelSecondaryLabel,
  returnToOpportunityList,
  handleStatePrimary,
} = useOpportunityWorkspaceAccess({
  capabilities: () => props.capabilities,
  route,
  router,
  state,
  load: () => load(),
});
const {
  invalidateReads,
  load,
  loadDownstream,
  retryDownstream,
  loadAutomationReadiness,
  loadCostReviewers,
  retryCostReviewers,
  loadProfitAnalysis,
  retryProfitAnalysis,
} = useOpportunityWorkspaceReads({
  request,
  opportunityId: () => props.opportunityId,
  state,
  items,
  memberOptions,
  costReviewerOptions,
  costReviewerLoadState,
  costReviewerErrorMessage,
  costReviewerRequestId,
  detail,
  profit,
  profitLoadState,
  profitErrorMessage,
  profitRequestId,
  downstreamLoadState,
  competitorItems,
  total,
  page,
  requestId,
  message,
  automationReadiness,
  selectionView,
  downstream,
  filters,
  canReadCompetitors,
  canReadSourcing,
  canConfirmCost,
  pendingDecisionFocus,
  captureDecisionFocus,
  restoreDecisionFocus,
});
const {
  syncListRoute,
  applyListFilters,
  resetListFilters,
  setSelectionView,
  goListPage,
  setTab,
  syncTabFromRoute,
  syncCreateRouteIntent,
} = useOpportunityWorkspaceNavigation({
  route,
  router,
  opportunityId: () => props.opportunityId,
  canDecide,
  filters,
  form,
  selectionView,
  selectedOpportunityIds,
  page,
  pageCount,
  tab,
  showCreate,
  load,
});
const { importFromErpBrowser, importErpFile } = useOpportunityWorkspaceErpImport({
  route,
  opportunityId: () => props.opportunityId,
  busy,
  bridgeBusy: erpBridgeBusy,
  importLimit: erpImportLimit,
  showImport: showErpImport,
  currentDialogGeneration: () => erpDialogGeneration,
  currentWriteScopeGeneration: () => writeScopeGeneration,
  beginBridgeIntent: () => ++erpBridgeGeneration,
  currentBridgeGeneration: () => erpBridgeGeneration,
  write,
  load,
  message,
});
const { discoverCompetitors, discoverSuppliers } = useOpportunityWorkspaceCollectionActions({
  detail,
  write,
  message,
});
async function write(path: string, body: unknown) {
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
        await load();
        message.value = "页面切换期间写入回执已到达；已刷新当前工作区，请核对最新状态。";
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
function closeTransientDialogs() {
  showCreate.value = false;
  showErpImport.value = false;
  showBatch.value = false;
  showDecision.value = false;
  decisionAction.value = "observe";
  decisionReason.value = "";
}
useOpportunityWorkspaceLifecycle({
  route,
  opportunityId: () => props.opportunityId,
  showCreate,
  showErpImport,
  showBatch,
  showDecision,
  decisionAction,
  decisionReason,
  selectedOpportunityIds,
  createFeedback,
  erpBridgeBusy,
  busy,
  detail,
  profit,
  profitLoadState,
  profitErrorMessage,
  profitRequestId,
  invalidateReads,
  pendingWriteCount,
  syncTabFromRoute,
  syncListRoute,
  syncCreateRouteIntent,
  load,
  setWorkspaceActive: (active) => {
    workspaceActive = active;
  },
  closeTransientDialogs,
  advanceCreateDialog: () => {
    createDialogGeneration += 1;
  },
  advanceDecisionDialog: () => {
    decisionDialogGeneration += 1;
  },
  advanceErpDialog: () => {
    erpDialogGeneration += 1;
  },
  advanceErpBridge: () => {
    erpBridgeGeneration += 1;
  },
  advanceBatchDialog: () => {
    batchDialogGeneration += 1;
  },
  advanceBatchIntent: () => {
    batchIntentGeneration += 1;
  },
  advanceBatchSelection: () => {
    batchSelectionGeneration += 1;
  },
  advanceWriteScope: () => {
    writeScopeGeneration += 1;
  },
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
                ? "选品候选"
                : selectionView === "evidence_pending"
                  ? "采集中"
                  : "全部机会"
          }}
        </h2>
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
      <span v-else>当前为只读权限。</span>
    </header>
    <nav v-else class="opportunity-detail-return" aria-label="机会详情返回路径">
      <RouterLink :to="returnPath">← 返回来源列表</RouterLink>
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
        <main class="opportunity-detail-main">
          <SelectionProductHeader :detail="detail" />
          <OpportunityDetailNavigation :active-tab="tab" :items="detailTabs" @select="setTab" />
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
                v-if="['overview', 'competition', 'risk'].includes(tab)"
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
                :can-open-competitor-comparison="canOpenCompetitorComparison"
                :can-open-sourcing-workspace="canOpenSourcingWorkspace"
                @discover-competitors="discoverCompetitors"
                @discover-suppliers="discoverSuppliers"
                @queue-score="queueScore"
                @retry-downstream="retryDownstream($event)"
                @select-tab="setTab"
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
  </section>
</template>

<style scoped src="./OpportunityWorkspace.css"></style>
