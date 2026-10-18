import { reactive } from "vue";

export function createOpportunityWorkspaceForms() {
  return {
    filters: reactive({
      q: "",
      market: "",
      decision_status: "",
      coverage_status: "",
      blocking_reason: "",
      lifecycle_status: "",
      owner_id: "",
    }),
  };
}
