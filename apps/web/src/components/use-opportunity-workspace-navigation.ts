import type { ComputedRef, Ref } from "vue";
import type { RouteLocationNormalizedLoaded, Router } from "vue-router";
import type { createOpportunityWorkspaceForms } from "./opportunity-workspace-forms";
import type * as OpportunityTypes from "./opportunity-workspace-types";
import { resolveOpportunityTab } from "./opportunity-workspace-presentation";

type OpportunitySelectionView = "recommended" | "rule_candidates" | "evidence_pending" | "all";
type OpportunityWorkspaceForms = ReturnType<typeof createOpportunityWorkspaceForms>;

interface OpportunityWorkspaceNavigationOptions {
  route: Pick<RouteLocationNormalizedLoaded, "fullPath" | "path" | "query">;
  router: Pick<Router, "push" | "replace">;
  filters: OpportunityWorkspaceForms["filters"];
  selectionView: Ref<OpportunitySelectionView>;
  selectedOpportunityIds: Ref<string[]>;
  page: Ref<number>;
  pageCount: ComputedRef<number>;
  tab: Ref<OpportunityTypes.OpportunityTab>;
  load: () => Promise<void>;
}

export function useOpportunityWorkspaceNavigation(options: OpportunityWorkspaceNavigationOptions) {
  const {
    route,
    router,
    filters,
    selectionView,
    selectedOpportunityIds,
    page,
    pageCount,
    tab,
    load,
  } = options;

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

  async function setSelectionView(nextView: OpportunitySelectionView) {
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
    tab.value = nextTab;
    await router.replace({
      query: { ...route.query, tab: nextTab === "overview" ? undefined : nextTab },
    });
  }

  function syncTabFromRoute() {
    const nextTab = resolveOpportunityTab(route.query.tab);
    tab.value = nextTab;
    if (["market", "ai", "lineage", "feedback"].includes(String(route.query.tab)))
      void router.replace({
        query: { ...route.query, tab: nextTab === "overview" ? undefined : nextTab },
      });
  }

  return {
    syncListRoute,
    applyListFilters,
    resetListFilters,
    setSelectionView,
    goListPage,
    setTab,
    syncTabFromRoute,
  };
}
