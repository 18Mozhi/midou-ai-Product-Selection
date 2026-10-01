import { onActivated, onBeforeUnmount, onDeactivated, onMounted, watch, type Ref } from "vue";
import type { RouteLocationNormalizedLoaded } from "vue-router";
import type * as OpportunityTypes from "./opportunity-workspace-types";
import type { OpportunityWorkspaceCreateFeedback } from "./use-opportunity-workspace-list-state";

interface OpportunityWorkspaceLifecycleOptions {
  route: Pick<RouteLocationNormalizedLoaded, "fullPath" | "path" | "query">;
  opportunityId: () => string | undefined;
  showCreate: Ref<boolean>;
  showErpImport: Ref<boolean>;
  showBatch: Ref<boolean>;
  showDecision: Ref<boolean>;
  decisionAction: Ref<"adopt" | "observe" | "reject">;
  decisionReason: Ref<string>;
  selectedOpportunityIds: Ref<string[]>;
  createFeedback: Ref<OpportunityWorkspaceCreateFeedback>;
  aiReviewError: Ref<string>;
  aiReviewSubmission: Ref<{ resultId: string; stage: "submitting" | "refreshing" } | null>;
  erpBridgeBusy: Ref<boolean>;
  busy: Ref<boolean>;
  detail: Ref<OpportunityTypes.OpportunityDetail | null>;
  profit: Ref<OpportunityTypes.OpportunityProfitAnalysis | null>;
  profitLoadState: Ref<OpportunityTypes.OpportunityPartialLoadState>;
  profitErrorMessage: Ref<string>;
  profitRequestId: Ref<string>;
  invalidateReads: () => void;
  pendingWriteCount: () => number;
  closeAiReviewReason: () => void;
  markPendingFeedbackWritesUnknown: () => void;
  syncTabFromRoute: () => void;
  syncListRoute: () => void;
  syncCreateRouteIntent: () => void;
  load: () => Promise<void>;
  setWorkspaceActive: (active: boolean) => void;
  closeTransientDialogs: () => void;
  advanceCreateDialog: () => void;
  advanceDecisionDialog: () => void;
  advanceErpDialog: () => void;
  advanceErpBridge: () => void;
  advanceBatchDialog: () => void;
  advanceBatchIntent: () => void;
  advanceBatchSelection: () => void;
  advanceWriteScope: () => void;
  advanceAiReviewIntent: () => void;
}

export function useOpportunityWorkspaceLifecycle(options: OpportunityWorkspaceLifecycleOptions) {
  const {
    route,
    opportunityId,
    showCreate,
    showErpImport,
    showBatch,
    showDecision,
    decisionAction,
    decisionReason,
    selectedOpportunityIds,
    createFeedback,
    aiReviewError,
    aiReviewSubmission,
    erpBridgeBusy,
    busy,
    detail,
    profit,
    profitLoadState,
    profitErrorMessage,
    profitRequestId,
    invalidateReads,
    pendingWriteCount,
    closeAiReviewReason,
    markPendingFeedbackWritesUnknown,
    syncTabFromRoute,
    syncListRoute,
    syncCreateRouteIntent,
    load,
    setWorkspaceActive,
    closeTransientDialogs,
    advanceCreateDialog,
    advanceDecisionDialog,
    advanceErpDialog,
    advanceErpBridge,
    advanceBatchDialog,
    advanceBatchIntent,
    advanceBatchSelection,
    advanceWriteScope,
    advanceAiReviewIntent,
  } = options;
  let loadQueued = false;
  let wasDeactivated = false;

  function queueLoad() {
    if (loadQueued) return;
    loadQueued = true;
    queueMicrotask(() => {
      loadQueued = false;
      void load();
    });
  }

  watch(
    showCreate,
    () => {
      advanceCreateDialog();
      createFeedback.value = null;
    },
    { flush: "sync" },
  );
  watch(showDecision, advanceDecisionDialog, { flush: "sync" });
  watch(showErpImport, advanceErpDialog, { flush: "sync" });
  watch(() => [showBatch.value, route.fullPath, opportunityId()], advanceBatchDialog, {
    flush: "sync",
  });
  watch(
    showBatch,
    (open) => {
      if (open) advanceBatchIntent();
    },
    { flush: "sync" },
  );
  watch(selectedOpportunityIds, advanceBatchSelection, { deep: true, flush: "sync" });
  watch(
    () => [route.fullPath, opportunityId()],
    () => {
      advanceCreateDialog();
      createFeedback.value = null;
    },
    { flush: "sync" },
  );

  onDeactivated(() => {
    setWorkspaceActive(false);
    closeTransientDialogs();
    if (aiReviewSubmission.value) advanceAiReviewIntent();
    invalidateReads();
    advanceErpBridge();
    erpBridgeBusy.value = false;
    markPendingFeedbackWritesUnknown();
    advanceWriteScope();
    busy.value = false;
    wasDeactivated = true;
  });

  onActivated(() => {
    setWorkspaceActive(true);
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
    opportunityId,
    (currentOpportunityId, previousOpportunityId) => {
      if (currentOpportunityId !== previousOpportunityId) {
        advanceAiReviewIntent();
        closeTransientDialogs();
        closeAiReviewReason();
        aiReviewError.value = "";
      }
      invalidateReads();
      advanceErpBridge();
      erpBridgeBusy.value = false;
      markPendingFeedbackWritesUnknown();
      advanceWriteScope();
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
      if (opportunityId() || route.path !== "/opportunities") return;
      invalidateReads();
      syncListRoute();
      queueLoad();
    },
    { flush: "sync" },
  );

  onBeforeUnmount(() => {
    invalidateReads();
    advanceErpBridge();
    erpBridgeBusy.value = false;
    advanceWriteScope();
    aiReviewSubmission.value = null;
  });
}
