import { ref } from "vue";
import { ApiClientError, createApiClient } from "../api-client";
import type { SourcingComparison } from "../components/sourcing-workspace-types";

export interface SourcingComparisonFailure {
  actionHint: string;
  requestId: string;
  retryable: boolean;
  retainedSnapshot: boolean;
}

export function useSourcingComparisons(request: ReturnType<typeof createApiClient>) {
  const comparisons = ref<SourcingComparison[]>([]),
    comparisonLoading = ref(false),
    comparisonFailure = ref<SourcingComparisonFailure | null>(null);
  let hasSnapshot = false;

  async function loadComparisons() {
    if (comparisonLoading.value) return;
    comparisonLoading.value = true;
    comparisonFailure.value = null;
    try {
      const response = await request<SourcingComparison[]>("/sourcing/comparisons");
      comparisons.value = response.data;
      hasSnapshot = true;
    } catch (error) {
      const apiError = error instanceof ApiClientError ? error : null;
      comparisonFailure.value = {
        actionHint: apiError?.actionHint ?? "对比历史暂不可用，请稍后重试。",
        requestId: apiError?.requestId ?? "",
        retryable: apiError?.kind !== "expired" && apiError?.kind !== "forbidden",
        retainedSnapshot: hasSnapshot,
      };
    } finally {
      comparisonLoading.value = false;
    }
  }

  return { comparisons, comparisonFailure, comparisonLoading, loadComparisons };
}
