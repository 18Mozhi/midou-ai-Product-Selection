import type { ComputedRef, Ref } from "vue";
import { ApiClientError, createApiClient, type ApiFailureKind } from "../api-client";
import {
  loadAutomaticSelectionReadiness,
  type AutomaticSelectionReadiness,
} from "../automatic-selection-readiness";
import { createOpportunityWorkspaceForms } from "./opportunity-workspace-forms";
import type { SourcingSearch } from "./sourcing-workspace-types";
import type * as OpportunityTypes from "./opportunity-workspace-types";

export type OpportunityDownstreamSource = "competitors" | "sourcing";
export type OpportunityDownstreamStates = Record<
  OpportunityDownstreamSource,
  OpportunityTypes.OpportunityPartialLoadState
>;

type OpportunityWorkspaceFilters = ReturnType<typeof createOpportunityWorkspaceForms>["filters"];
type OpportunityApiRequest = ReturnType<typeof createApiClient>;
type OpportunityDecisionFocus = {
  opportunityId: string;
  action: "adopt" | "observe" | "reject";
};

interface OpportunityWorkspaceReadOptions {
  request: OpportunityApiRequest;
  opportunityId: () => string | undefined;
  state: Ref<OpportunityTypes.OpportunityWorkspaceState>;
  items: Ref<OpportunityTypes.OpportunitySummary[]>;
  detail: Ref<OpportunityTypes.OpportunityDetail | null>;
  profit: Ref<OpportunityTypes.OpportunityProfitAnalysis | null>;
  profitLoadState: Ref<OpportunityTypes.OpportunityPartialLoadState>;
  profitErrorMessage: Ref<string>;
  profitRequestId: Ref<string>;
  downstreamLoadState: Ref<OpportunityDownstreamStates>;
  competitorItems: Ref<OpportunityTypes.OpportunityCompetitorSummary[]>;
  sourcingSearches: Ref<SourcingSearch[]>;
  total: Ref<number>;
  page: Ref<number>;
  requestId: Ref<string>;
  message: Ref<string>;
  automationReadiness: Ref<AutomaticSelectionReadiness | null>;
  selectionView: Ref<"recommended" | "rule_candidates" | "evidence_pending" | "all">;
  downstream: Ref<{ competitors: number; snapshots: number; searches: number; suppliers: number }>;
  filters: OpportunityWorkspaceFilters;
  canReadCompetitors: ComputedRef<boolean>;
  canReadSourcing: ComputedRef<boolean>;
  pendingDecisionFocus: Ref<OpportunityDecisionFocus | null>;
  captureDecisionFocus: (opportunityId: string | undefined) => void;
  restoreDecisionFocus: (opportunityId: string) => Promise<void>;
}

export function useOpportunityWorkspaceReads(options: OpportunityWorkspaceReadOptions) {
  const {
    request,
    opportunityId: getOpportunityId,
    state,
    items,
    detail,
    profit,
    profitLoadState,
    profitErrorMessage,
    profitRequestId,
    downstreamLoadState,
    competitorItems,
    sourcingSearches,
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
    pendingDecisionFocus,
    captureDecisionFocus,
    restoreDecisionFocus,
  } = options;
  let readGeneration = 0;
  let workspaceReadController: AbortController | null = null;

  const stateFrom = (kind: ApiFailureKind): OpportunityTypes.OpportunityWorkspaceState =>
    kind === "expired" || kind === "forbidden"
      ? kind
      : kind === "blocked" || kind === "rate_limited"
        ? "blocked"
        : "error";

  function invalidateReads() {
    readGeneration += 1;
    workspaceReadController?.abort();
    workspaceReadController = null;
  }

  async function read(path: string, isCurrent: () => boolean = () => true, signal?: AbortSignal) {
    try {
      const response = await request<any>(path, { signal });
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

  async function loadDownstream(
    currentOpportunityId = getOpportunityId(),
    isCurrent?: () => boolean,
    onlySource?: OpportunityDownstreamSource,
    signal?: AbortSignal,
  ) {
    const generation = readGeneration;
    const ownsRead = () => !signal?.aborted && (isCurrent?.() ?? generation === readGeneration);
    const sources: OpportunityDownstreamSource[] = onlySource
      ? [onlySource]
      : ["competitors", "sourcing"];

    for (const source of sources) {
      downstreamLoadState.value = { ...downstreamLoadState.value, [source]: "loading" };
      if (source === "competitors") {
        competitorItems.value = [];
        downstream.value = { ...downstream.value, competitors: 0, snapshots: 0 };
      } else {
        sourcingSearches.value = [];
        downstream.value = { ...downstream.value, searches: 0, suppliers: 0 };
      }
    }

    await Promise.all(
      sources.map(async (source) => {
        const hasAccess =
          source === "competitors" ? canReadCompetitors.value : canReadSourcing.value;
        if (!hasAccess || !currentOpportunityId) {
          if (!ownsRead()) return;
          downstreamLoadState.value = { ...downstreamLoadState.value, [source]: "ready" };
          return;
        }

        try {
          if (source === "competitors") {
            const response = await request<OpportunityTypes.OpportunityCompetitorSummary[]>(
              `/competitors?opportunity_id=${encodeURIComponent(currentOpportunityId)}`,
              { signal },
            );
            if (!ownsRead()) return;
            const competitors = response.data.filter(
              (item) => item.opportunity_id === currentOpportunityId,
            );
            competitorItems.value = competitors;
            const independent = [
              ...new Map(
                competitors
                  .filter(
                    (item) =>
                      item.source_site.toLowerCase() === "amazon" &&
                      /^[A-Z0-9]{10}$/i.test(item.external_id) &&
                      item.external_id.toUpperCase() !== detail.value?.main_asin?.toUpperCase(),
                  )
                  .map((item) => [item.external_id.toUpperCase(), item] as const),
              ).values(),
            ];
            downstream.value = {
              ...downstream.value,
              competitors: independent.length,
              snapshots: independent.reduce(
                (sum, item) => sum + Number(item.snapshot_count ?? 0),
                0,
              ),
            };
          } else {
            const response = await request<SourcingSearch[]>("/sourcing/searches", { signal });
            if (!ownsRead()) return;
            const searches = response.data.filter(
              (item) =>
                item.input_type === "opportunity" && item.input_ref === currentOpportunityId,
            );
            sourcingSearches.value = searches;
            downstream.value = {
              ...downstream.value,
              searches: searches.length,
              suppliers: searches.reduce((sum, item) => sum + Number(item.candidate_count ?? 0), 0),
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

  function retryDownstream(source: OpportunityDownstreamSource) {
    void loadDownstream(detail.value?.id, undefined, source, workspaceReadController?.signal);
  }

  async function loadAutomationReadiness(
    isCurrent: () => boolean = () => true,
    signal?: AbortSignal,
  ) {
    automationReadiness.value = null;
    const readiness = await loadAutomaticSelectionReadiness(request, signal);
    if (isCurrent()) automationReadiness.value = readiness;
  }

  async function loadProfitAnalysis(
    currentOpportunityId: string,
    isCurrent: () => boolean,
    signal?: AbortSignal,
  ) {
    profitLoadState.value = "loading";
    profitErrorMessage.value = "";
    profitRequestId.value = "";
    try {
      const response = await request<OpportunityTypes.OpportunityProfitAnalysis>(
        `/opportunities/${currentOpportunityId}/profit-analysis`,
        { signal },
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
    const currentOpportunityId = getOpportunityId();
    if (!currentOpportunityId || profitLoadState.value === "loading") return;
    await loadProfitAnalysis(
      currentOpportunityId,
      () =>
        generation === readGeneration &&
        getOpportunityId() === currentOpportunityId &&
        !workspaceReadController?.signal.aborted,
      workspaceReadController?.signal,
    );
  }

  async function load() {
    const generation = readGeneration + 1;
    workspaceReadController?.abort();
    const controller = new AbortController();
    workspaceReadController = controller;
    readGeneration = generation;
    const currentOpportunityId = getOpportunityId();
    if (pendingDecisionFocus.value?.opportunityId !== currentOpportunityId)
      pendingDecisionFocus.value = null;
    captureDecisionFocus(currentOpportunityId);
    const isCurrent = () => generation === readGeneration && !controller.signal.aborted;
    state.value = "loading";
    message.value = "";
    try {
      if (currentOpportunityId) {
        detail.value = null;
        profit.value = null;
        profitLoadState.value = "loading";
        profitErrorMessage.value = "";
        profitRequestId.value = "";
        const detailResponse = await read(
          `/opportunities/${currentOpportunityId}`,
          isCurrent,
          controller.signal,
        );
        if (!isCurrent()) return;
        detail.value = detailResponse.data;
        if (
          !(await loadProfitAnalysis(currentOpportunityId, isCurrent, controller.signal)) ||
          !isCurrent()
        )
          return;
        if (!isCurrent()) return;
        await loadDownstream(currentOpportunityId, isCurrent, undefined, controller.signal);
        if (!isCurrent()) return;
        state.value = "ready";
        await restoreDecisionFocus(currentOpportunityId);
        return;
      }
      const params = new URLSearchParams({
        page: String(page.value),
        page_size: "20",
        selection_view: selectionView.value,
      });
      for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
      const result = await read(`/opportunities?${params}`, isCurrent, controller.signal);
      if (!isCurrent()) return;
      items.value = result.data;
      const readinessPromise = loadAutomationReadiness(isCurrent, controller.signal);
      await readinessPromise;
      if (!isCurrent()) return;
      total.value = (result.meta as { total: number }).total;
      state.value = items.value.length ? "ready" : "empty";
    } catch (error) {
      if (pendingDecisionFocus.value?.opportunityId === currentOpportunityId)
        pendingDecisionFocus.value = null;
      if (isCurrent() && !(error instanceof ApiClientError)) state.value = "blocked";
    }
  }

  return {
    invalidateReads,
    load,
    loadDownstream,
    retryDownstream,
    loadAutomationReadiness,
    loadProfitAnalysis,
    retryProfitAnalysis,
  };
}
