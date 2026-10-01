import { computed, type Ref } from "vue";
import type { Router } from "vue-router";
import { safeOpportunityReturnPath } from "./opportunity-workspace-presentation";
import type * as OpportunityTypes from "./opportunity-workspace-types";

interface OpportunityWorkspaceAccessOptions {
  capabilities: () => string[] | undefined;
  route: { fullPath: string; query: Record<string, unknown> };
  router: Pick<Router, "push">;
  state: Ref<OpportunityTypes.OpportunityWorkspaceState>;
  load: () => Promise<void>;
}

export function useOpportunityWorkspaceAccess(options: OpportunityWorkspaceAccessOptions) {
  const { capabilities, route, router, state, load } = options;
  const canDecide = computed(() => capabilities()?.includes("opportunity:decide") ?? false);
  const canManageCompetitors = computed(
    () => capabilities()?.includes("competitor:manage") ?? false,
  );
  const canReadCompetitors = computed(
    () =>
      capabilities()?.includes("competitor:read") ||
      capabilities()?.includes("competitor:manage") ||
      false,
  );
  const canManageSuppliers = computed(
    () => capabilities()?.includes("supplier_quote:manage") ?? false,
  );
  const canReadSourcing = computed(
    () =>
      capabilities()?.includes("sourcing:read") ||
      capabilities()?.includes("supplier_quote:manage") ||
      false,
  );
  const canOpenCompetitorWorkspace = computed(
    () => capabilities()?.includes("competitor:read") ?? false,
  );
  const canOpenSourcingWorkspace = computed(
    () => capabilities()?.includes("sourcing:read") ?? false,
  );
  const canConfirmCost = computed(() => capabilities()?.includes("cost:confirm") ?? false);
  const returnPath = computed(() => safeOpportunityReturnPath(route.query.from));
  const statePanelKind = computed(() => (state.value === "ready" ? "empty" : state.value));
  const statePanelPrimaryLabel = computed(() =>
    statePanelKind.value === "expired"
      ? "重新登录"
      : ["empty", "forbidden", "not_found"].includes(statePanelKind.value)
        ? "返回机会列表"
        : "",
  );
  const statePanelSecondaryLabel = computed(() =>
    ["error", "blocked"].includes(statePanelKind.value) ? "返回机会列表" : "",
  );

  function returnToOpportunityList() {
    void router.push("/opportunities");
  }

  function handleStatePrimary() {
    if (statePanelKind.value === "expired") {
      void router.push({
        path: "/login",
        query: { reason: "authentication_required", redirect: route.fullPath },
      });
      return;
    }
    if (["empty", "forbidden", "not_found"].includes(statePanelKind.value)) {
      returnToOpportunityList();
      return;
    }
    void load();
  }

  return {
    canDecide,
    canManageCompetitors,
    canReadCompetitors,
    canManageSuppliers,
    canReadSourcing,
    canOpenCompetitorWorkspace,
    canOpenSourcingWorkspace,
    canConfirmCost,
    returnPath,
    statePanelKind,
    statePanelPrimaryLabel,
    statePanelSecondaryLabel,
    returnToOpportunityList,
    handleStatePrimary,
  };
}
