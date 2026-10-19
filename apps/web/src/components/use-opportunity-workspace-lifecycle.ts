import { onActivated, onBeforeUnmount, onDeactivated, onMounted, watch, type Ref } from "vue";
import type { RouteLocationNormalizedLoaded } from "vue-router";
import type * as OpportunityTypes from "./opportunity-workspace-types";

interface OpportunityWorkspaceLifecycleOptions {
  route: Pick<RouteLocationNormalizedLoaded, "fullPath" | "path" | "query">;
  opportunityId: () => string | undefined;
  showDecision: Ref<boolean>;
  decisionAction: Ref<"adopt" | "observe" | "reject">;
  decisionReason: Ref<string>;
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
  load: () => Promise<void>;
  setWorkspaceActive: (active: boolean) => void;
  closeTransientDialogs: () => void;
  advanceDecisionDialog: () => void;
  advanceWriteScope: () => void;
}

export function useOpportunityWorkspaceLifecycle(options: OpportunityWorkspaceLifecycleOptions) {
  const {
    route,
    opportunityId,
    showDecision,
    decisionAction,
    decisionReason,
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
    load,
    setWorkspaceActive,
    closeTransientDialogs,
    advanceDecisionDialog,
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

  watch(showDecision, advanceDecisionDialog, { flush: "sync" });
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
    queueLoad();
  });

  onMounted(() => {
    syncTabFromRoute();
    syncListRoute();
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
