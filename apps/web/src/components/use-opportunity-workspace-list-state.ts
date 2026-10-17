import { computed, type Ref } from "vue";
import type * as OpportunityTypes from "./opportunity-workspace-types";

interface OpportunityWorkspaceListStateOptions {
  items: Ref<OpportunityTypes.OpportunitySummary[]>;
  selectedOpportunityIds: Ref<string[]>;
  total: Ref<number>;
}

export function useOpportunityWorkspaceListState(options: OpportunityWorkspaceListStateOptions) {
  const { items, selectedOpportunityIds, total } = options;
  const pageCount = computed(() => Math.max(1, Math.ceil(total.value / 20)));
  const currentPageSelectedItems = computed(() =>
    items.value.filter((item) => selectedOpportunityIds.value.includes(item.id)),
  );
  const outsideCurrentPageSelectedCount = computed(() =>
    Math.max(0, selectedOpportunityIds.value.length - currentPageSelectedItems.value.length),
  );

  return { pageCount, currentPageSelectedItems, outsideCurrentPageSelectedCount };
}
