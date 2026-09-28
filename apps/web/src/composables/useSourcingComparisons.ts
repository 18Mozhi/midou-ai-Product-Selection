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
  let hasSnapshot = false,
    active = true,
    readGeneration = 0;

  async function loadComparisons() {
    if (!active) return;
    const generation = ++readGeneration;
    comparisonLoading.value = true;
    comparisonFailure.value = null;
    try {
      const response = await request<SourcingComparison[]>("/sourcing/comparisons");
      if (!active || generation !== readGeneration) return;
      comparisons.value = response.data;
      hasSnapshot = true;
    } catch (error) {
      if (!active || generation !== readGeneration) return;
      const apiError = error instanceof ApiClientError ? error : null;
      comparisonFailure.value = {
        actionHint: apiError?.actionHint ?? "对比历史暂不可用，请稍后重试。",
        requestId: apiError?.requestId ?? "",
        retryable: apiError?.kind !== "expired" && apiError?.kind !== "forbidden",
        retainedSnapshot: hasSnapshot,
      };
    } finally {
      if (active && generation === readGeneration) comparisonLoading.value = false;
    }
  }

  function setActive(value: boolean) {
    if (active === value) return;
    active = value;
    readGeneration += 1;
    comparisonLoading.value = false;
  }

  return { comparisons, comparisonFailure, comparisonLoading, loadComparisons, setActive };
}
