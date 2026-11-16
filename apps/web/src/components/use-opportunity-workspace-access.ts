import { computed, type Ref } from "vue";
import type { Router } from "vue-router";
import { safeOpportunityReturnPath } from "./opportunity-workspace-presentation";
import type * as OpportunityTypes from "./opportunity-workspace-types";

interface OpportunityWorkspaceAccessOptions {
  capabilities: () => string[] | undefined;
  accountRehearsal: () => boolean | undefined;
  route: { fullPath: string; query: Record<string, unknown> };
  router: Pick<Router, "push">;
  state: Ref<OpportunityTypes.OpportunityWorkspaceState>;
  load: () => Promise<void>;
}

export function useOpportunityWorkspaceAccess(options: OpportunityWorkspaceAccessOptions) {
  const { capabilities, accountRehearsal, route, router, state, load } = options;
  const canDecide = computed(() => capabilities()?.includes("opportunity:decide") ?? false);

  const canReadCompetitors = computed(
    () =>
      accountRehearsal() === true ||
      capabilities()?.includes("competitor:read") ||
      capabilities()?.includes("competitor:manage") ||
      false,
  );

  const canReadSourcing = computed(
    () =>
      accountRehearsal() === true ||
      capabilities()?.includes("sourcing:read") ||
      capabilities()?.includes("supplier_quote:manage") ||
      false,
  );
  const canOpenCompetitorComparison = computed(
    () => accountRehearsal() === true || capabilities()?.includes("competitor:read") === true,
  );
  const canOpenSourcingWorkspace = computed(
    () => accountRehearsal() === true || capabilities()?.includes("sourcing:read") === true,
  );
  const returnPath = computed(() => safeOpportunityReturnPath(route.query.from));
  const statePanelKind = computed(() => (state.value === "ready" ? "empty" : state.value));
  const statePanelPrimaryLabel = computed(() =>
    statePanelKind.value === "expired"
      ? "重新登录"
      : ["empty", "forbidden", "not_found"].includes(statePanelKind.value)
        ? "返回选品列表"
        : "",
  );
  const statePanelSecondaryLabel = computed(() =>
    ["error", "blocked"].includes(statePanelKind.value) ? "返回选品列表" : "",
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
    canReadCompetitors,
    canReadSourcing,
    canOpenCompetitorComparison,
    canOpenSourcingWorkspace,
    returnPath,
    statePanelKind,
    statePanelPrimaryLabel,
    statePanelSecondaryLabel,
    returnToOpportunityList,
    handleStatePrimary,
  };
}
