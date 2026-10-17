import { onActivated, onBeforeUnmount, onDeactivated, onMounted, watch, type Ref } from "vue";
import type { RouteLocationNormalizedLoaded } from "vue-router";
import type * as OpportunityTypes from "./opportunity-workspace-types";
import type { OpportunityWorkspaceCreateFeedback } from "./use-opportunity-workspace-list-state";

interface OpportunityWorkspaceLifecycleOptions {
  route: Pick<RouteLocationNormalizedLoaded, "fullPath" | "path" | "query">;
  opportunityId: () => string | undefined;
  showCreate: Ref<boolean>;
  showBatch: Ref<boolean>;
  showDecision: Ref<boolean>;
  decisionAction: Ref<"adopt" | "observe" | "reject">;
  decisionReason: Ref<string>;
  selectedOpportunityIds: Ref<string[]>;
  createFeedback: Ref<OpportunityWorkspaceCreateFeedback>;
  busy: Ref<boolean>;
  detail: Ref<OpportunityTypes.OpportunityDetail | null>;
  profit: Ref<OpportunityTypes.OpportunityProfitAnalysis | null>;
  profitLoadState: Ref<OpportunityTypes.OpportunityPartialLoadState>;
  profitErrorMessage: Ref<string>;
  profitRequestId: Ref<string>;
  invalidateReads: () => void;
  pendingWriteCount: () => number;
  syncTabFromRoute: () => void;
  syncListRoute: () => void;
  syncCreateRouteIntent: () => void;
  load: () => Promise<void>;
  setWorkspaceActive: (active: boolean) => void;
  closeTransientDialogs: () => void;
  advanceCreateDialog: () => void;
  advanceDecisionDialog: () => void;
  advanceBatchDialog: () => void;
  advanceBatchIntent: () => void;
  advanceBatchSelection: () => void;
  advanceWriteScope: () => void;
}

export function useOpportunityWorkspaceLifecycle(options: OpportunityWorkspaceLifecycleOptions) {
  const {
    route,
    opportunityId,
    showCreate,
    showBatch,
    showDecision,
    decisionAction,
    decisionReason,
    selectedOpportunityIds,
    createFeedback,
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
    setWorkspaceActive,
    closeTransientDialogs,
    advanceCreateDialog,
    advanceDecisionDialog,
    advanceBatchDialog,
    advanceBatchIntent,
    advanceBatchSelection,
    advanceWriteScope,
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

    invalidateReads();

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
        closeTransientDialogs();
      }
      invalidateReads();

      advanceWriteScope();
      busy.value = pendingWriteCount() > 0;

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
    advanceWriteScope();
  });
}
