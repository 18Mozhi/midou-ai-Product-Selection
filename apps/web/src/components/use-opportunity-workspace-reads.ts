import type { ComputedRef, Ref } from "vue";
import { ApiClientError, createApiClient, type ApiFailureKind } from "../api-client";
import {
  loadAutomaticSelectionReadiness,
  type AutomaticSelectionReadiness,
} from "../automatic-selection-readiness";
import { createOpportunityWorkspaceForms } from "./opportunity-workspace-forms";
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
  memberOptions: Ref<Array<{ id: string; label: string }>>;
  costReviewerOptions: Ref<Array<{ id: string; label: string }>>;
  costReviewerLoadState: Ref<OpportunityTypes.OpportunityPartialLoadState>;
  costReviewerErrorMessage: Ref<string>;
  costReviewerRequestId: Ref<string>;
  detail: Ref<OpportunityTypes.OpportunityDetail | null>;
  profit: Ref<OpportunityTypes.OpportunityProfitAnalysis | null>;
  profitLoadState: Ref<OpportunityTypes.OpportunityPartialLoadState>;
  profitErrorMessage: Ref<string>;
  profitRequestId: Ref<string>;
  aiAnalyses: Ref<OpportunityTypes.OpportunityAiAnalysis[]>;
  aiLoadState: Ref<OpportunityTypes.OpportunityPartialLoadState>;
  aiLoadErrorMessage: Ref<string>;
  aiRequestId: Ref<string>;
  downstreamLoadState: Ref<OpportunityDownstreamStates>;
  competitorItems: Ref<OpportunityTypes.OpportunityCompetitorSummary[]>;
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
  canConfirmCost: ComputedRef<boolean>;
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
    aiAnalyses,
    aiLoadState,
    aiLoadErrorMessage,
    aiRequestId,
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
  } = options;
  let readGeneration = 0;
  let aiRequestGeneration = 0;
  let aiSnapshotOpportunityId = "";
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

  async function loadAi(
    currentOpportunityId = getOpportunityId(),
    isCurrent?: () => boolean,
    signal?: AbortSignal,
  ) {
    const generation = readGeneration;
    const requestGeneration = ++aiRequestGeneration;
    const ownsRead = () => !signal?.aborted && (isCurrent?.() ?? generation === readGeneration);
    aiLoadState.value = "loading";
    aiLoadErrorMessage.value = "";
    aiRequestId.value = "";
    try {
      const response = await request<unknown>(
        `/opportunities/${currentOpportunityId}/ai-analyses`,
        { signal },
      );
      if (!ownsRead() || requestGeneration !== aiRequestGeneration) return;
      if (!Array.isArray(response.data))
        throw new Error("AI 分析接口返回格式异常，不能将其解释为没有分析记录。");
      aiAnalyses.value = response.data as OpportunityTypes.OpportunityAiAnalysis[];
      aiSnapshotOpportunityId = currentOpportunityId ?? "";
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
              "/competitors",
              { signal },
            );
            if (!ownsRead()) return;
            const competitors = response.data.filter(
              (item) => item.opportunity_id === currentOpportunityId,
            );
            competitorItems.value = competitors;
            downstream.value = {
              ...downstream.value,
              competitors: competitors.length,
              snapshots: competitors.reduce(
                (sum, item) => sum + Number(item.snapshot_count ?? 0),
                0,
              ),
            };
          } else {
            const response = await request<any[]>("/sourcing/searches", { signal });
            if (!ownsRead()) return;
            const searches = response.data.filter(
              (item: any) =>
                item.input_type === "opportunity" && item.input_ref === currentOpportunityId,
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

  async function loadCostReviewers(isCurrent: () => boolean = () => true, signal?: AbortSignal) {
    costReviewerLoadState.value = "loading";
    costReviewerErrorMessage.value = "";
    costReviewerRequestId.value = "";
    try {
      const reviewers = await request<Array<{ id: string; label: string }>>(
        "/cost-input-reviewers",
        { signal },
      );
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
    const currentOpportunityId = getOpportunityId();
    if (!currentOpportunityId || !canConfirmCost.value || costReviewerLoadState.value === "loading")
      return;
    await loadCostReviewers(
      () =>
        generation === readGeneration &&
        getOpportunityId() === currentOpportunityId &&
        !workspaceReadController?.signal.aborted,
      workspaceReadController?.signal,
    );
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
    const nextAiOwner = currentOpportunityId ?? "";
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
        if (canConfirmCost.value) {
          await loadCostReviewers(isCurrent, controller.signal);
        } else {
          costReviewerOptions.value = [];
          costReviewerLoadState.value = "ready";
          costReviewerErrorMessage.value = "";
          costReviewerRequestId.value = "";
        }
        if (!isCurrent()) return;
        await Promise.all([
          loadAi(currentOpportunityId, isCurrent, controller.signal),
          loadDownstream(currentOpportunityId, isCurrent, undefined, controller.signal),
        ]);
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
      try {
        memberOptions.value = (
          await request<any[]>("/opportunities/member-options", { signal: controller.signal })
        ).data;
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
      if (pendingDecisionFocus.value?.opportunityId === currentOpportunityId)
        pendingDecisionFocus.value = null;
      if (isCurrent() && !(error instanceof ApiClientError)) state.value = "blocked";
    }
  }

  return {
    invalidateReads,
    load,
    loadAi,
    loadDownstream,
    retryDownstream,
    loadAutomationReadiness,
    loadCostReviewers,
    retryCostReviewers,
    loadProfitAnalysis,
    retryProfitAnalysis,
    getReadSignal: () => workspaceReadController?.signal,
  };
}
